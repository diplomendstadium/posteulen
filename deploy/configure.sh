#!/usr/bin/env bash
# Schreibt alle erzeugten Konfigurationsdateien aus dem gerade aktiven Release:
# service.env, systemd-Units, Caddyfile, Befehle in /usr/local/sbin, Platzhalter in local/.
# Lokale Anpassungen in /etc/posteulen/local/ werden nie überschrieben (SPEC 16.3).
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
RELEASE=$(cd "$SELF_DIR/.." && pwd)

require_root
domain=$(conf_get POSTEULEN_DOMAIN)
test_mode=$(conf_get POSTEULEN_TEST_MODE)
valid_domain "$domain" || die "Keine gültige Domain in $PE_CONF." "Die Datei prüfen oder install.sh erneut ausführen."

umask 022
printf 'POSTEULEN_DOMAIN=%s\n' "$domain" >"$PE_SERVICE_ENV.new"
chmod 0644 "$PE_SERVICE_ENV.new"
mv "$PE_SERVICE_ENV.new" "$PE_SERVICE_ENV"

# Platzhalter für lokale Anpassungen (nur anlegen, nie überschreiben).
install -d -m 0755 "$PE_LOCAL"
[[ -e $PE_LOCAL/global-00-leer.caddy ]] || printf '# Eigene globale Caddy-Blöcke hier oder in weiteren global-*.caddy-Dateien.\n' >"$PE_LOCAL/global-00-leer.caddy"
[[ -e $PE_LOCAL/admin-00-leer.caddy ]] || printf '# Eigene Regeln für admin.%s hier oder in weiteren admin-*.caddy-Dateien.\n' "$domain" >"$PE_LOCAL/admin-00-leer.caddy"
[[ -e $PE_LOCAL/bots-00-leer.caddy ]] || printf '# Eigene Regeln für bots.%s hier oder in weiteren bots-*.caddy-Dateien.\n' "$domain" >"$PE_LOCAL/bots-00-leer.caddy"

# systemd-Units
for unit in posteulen.service posteulen-backup.service posteulen-backup.timer; do
  install -m 0644 "$RELEASE/deploy/systemd/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload

# Befehle
install -m 0755 "$RELEASE/deploy/posteulen-update" /usr/local/sbin/posteulen-update
install -m 0755 "$RELEASE/deploy/posteulen-cli" /usr/local/sbin/posteulen-cli

# Caddyfile (eine fremde, vorhandene Caddyfile wird einmalig gesichert)
caddyfile=/etc/caddy/Caddyfile
if [[ -f $caddyfile ]] && ! grep -q '^# Erzeugt von posteulen-cli caddyfile' "$caddyfile"; then
  [[ -e $caddyfile.vor-posteulen ]] || cp -a "$caddyfile" "$caddyfile.vor-posteulen"
fi
args=(caddyfile --domain "$domain")
[[ $test_mode == 1 ]] && args+=(--test-mode)
node "$RELEASE/backend/src/cli.ts" "${args[@]}" >"$caddyfile.new"
if ! caddy validate --config "$caddyfile.new" --adapter caddyfile >/dev/null 2>&1; then
  caddy validate --config "$caddyfile.new" --adapter caddyfile || true
  rm -f "$caddyfile.new"
  die "Die erzeugte Caddyfile ist ungültig." "Eigene Dateien in $PE_LOCAL prüfen."
fi
mv "$caddyfile.new" "$caddyfile"
if systemctl is-active --quiet caddy; then systemctl reload caddy; else systemctl enable --now caddy; fi
ok "Konfiguration geschrieben (Units, Caddyfile, Befehle)."
