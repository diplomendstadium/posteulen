#!/usr/bin/env bash
# Konsistente, verschlüsselte Sicherung der Datenbank (SPEC 16.4 Punkt 5, ARCHITECTURE 10.4).
# Aufruf: backup.sh [--reason taeglich|update|manuell]
# Bei --reason update bleibt zusätzlich eine unverschlüsselte Momentaufnahme in
# /var/lib/posteulen/snapshots (nur für den automatischen Rückfall, D-29); auch sie wird nach
# 7 Tagen gelöscht.
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
RELEASE=$(cd "$SELF_DIR/.." && pwd)

reason=manuell
while [[ $# -gt 0 ]]; do
  case $1 in
    --reason) reason=${2:-}; shift 2 ;;
    *) die "Unbekannter Parameter: $1" ;;
  esac
done
[[ $reason =~ ^(taeglich|update|manuell)$ ]] || die "Ungültiger Grund: $reason"

require_root
[[ -f $PE_BACKUP_PUB ]] || die "Öffentlicher Backup-Schlüssel fehlt: $PE_BACKUP_PUB" "install.sh erneut ausführen."
[[ -f $PE_DATA/posteulen.sqlite ]] || die "Keine Datenbank gefunden." "Ist PostEulen installiert?"

install -d -m 0700 -o root -g root "$PE_BACKUPS"
install -d -m 0700 -o "$PE_USER" -g "$PE_USER" "$PE_DATA/tmp" "$PE_SNAPSHOTS"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp=$(runuser -u "$PE_USER" -- mktemp -d "$PE_DATA/tmp/backup.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
plain="$tmp/posteulen.sqlite"

# Als Dienstbenutzer, damit keine root-eigenen WAL-Dateien entstehen.
as_service node "$RELEASE/backend/src/cli.ts" backup --out "$plain" >/dev/null

target="$PE_BACKUPS/posteulen-$stamp-$reason.sqlite.age"
age --encrypt --recipients-file "$PE_BACKUP_PUB" --output "$target.part" "$plain"
chmod 0600 "$target.part"
mv "$target.part" "$target"

if [[ $reason == update ]]; then
  snapshot="$PE_SNAPSHOTS/vor-update-$stamp.sqlite"
  mv "$plain" "$snapshot"
  chown "$PE_USER:$PE_USER" "$snapshot"
  chmod 0600 "$snapshot"
  install -d -m 0755 "$PE_STATE"
  printf '%s\n' "$snapshot" >"$PE_STATE/last-snapshot"
fi

# Aufbewahrung: höchstens 7 Tage (SPEC 8.11, 16.3).
find "$PE_BACKUPS" -maxdepth 1 -name 'posteulen-*.sqlite.age' -mmin +$((PE_BACKUP_DAYS * 24 * 60)) -delete
find "$PE_SNAPSHOTS" -maxdepth 1 -name 'vor-update-*.sqlite' -mmin +$((PE_BACKUP_DAYS * 24 * 60)) -delete

ok "Sicherung erstellt: $target"
