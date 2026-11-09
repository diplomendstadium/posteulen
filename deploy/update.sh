#!/usr/bin/env bash
# Update-Ablauf der NEUEN Version (SPEC 16.3). Wird von posteulen-update aufgerufen.
#
#   update.sh --apply <bisheriges Release>   dieses Release einspielen
#   update.sh --rollback                     zum vorigen Release zurück (aus dem aktiven Release)
#
# Ablauf: Update-Schritte → Bauen (alter Stand läuft weiter) → Sicherung → Dienst stoppen →
# Migrationen → Umschalten → Konfiguration → Start → Funktionsprüfung. Schlägt ein Schritt ab
# der Sicherung fehl, geht es automatisch samt Datenbank zum bisherigen Release zurück.
# -E: die Fehlerbehandlung (trap ERR) gilt auch in Funktionen.
set -Eeuo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
RELEASE=$(cd "$SELF_DIR/.." && pwd)
require_root

domain=$(conf_get POSTEULEN_DOMAIN)
test_mode=$(conf_get POSTEULEN_TEST_MODE)
[[ $test_mode == 1 ]] || test_mode=0

# Stellt Release und Datenbank wieder her. $1 = Release, $2 = Momentaufnahme der Datenbank.
restore() {
  local release=$1 snapshot=$2
  systemctl stop posteulen.service || true
  if [[ -n $snapshot ]]; then
    [[ -f $snapshot ]] || die "Momentaufnahme $snapshot fehlt – automatischer Rückfall unmöglich." "Ein Backup nach README.md (Abschnitt Wiederherstellung) einspielen."
    rm -f "$PE_DATA/posteulen.sqlite-wal" "$PE_DATA/posteulen.sqlite-shm"
    install -m 0600 -o "$PE_USER" -g "$PE_USER" "$snapshot" "$PE_DATA/posteulen.sqlite"
  fi
  switch_symlink "$release" "$PE_CURRENT"
  "$release/deploy/configure.sh"
  systemctl start posteulen.service
  health_check "$domain" "$test_mode"
}

if [[ ${1:-} == --rollback ]]; then
  previous=$(cat "$PE_STATE/previous-release" 2>/dev/null || true)
  snapshot=$(cat "$PE_STATE/previous-snapshot" 2>/dev/null || true)
  [[ -n $previous && -d $previous ]] || die "Kein vorheriges Release vorhanden." "Rückfall ist nur nach einem Update möglich."
  [[ -n $snapshot && -f $snapshot ]] || die "Die Datenbank-Momentaufnahme vor dem letzten Update fehlt (älter als 7 Tage?)." "Ein Backup nach README.md einspielen."
  warn "Zurück zu $(release_version "$previous"). Alles, was seit dem letzten Update entstanden ist (Briefe, Konten, Gold …), geht verloren."
  ask_yes_no "Wirklich zurückkehren?" nein "" || die "Abgebrochen." "Nichts wurde verändert."
  current=$(readlink -f "$PE_CURRENT")
  restore "$previous" "$snapshot" || die "Der Rückfall ist fehlgeschlagen." "„journalctl -u posteulen -n 100“ ansehen."
  printf '%s\n' "$current" >"$PE_STATE/rolled-back-from"
  rm -f "$PE_STATE/previous-release" "$PE_STATE/previous-snapshot"
  ok "Zurück auf $(release_version "$previous")."
  exit 0
fi

[[ ${1:-} == --apply && -n ${2:-} ]] || die "Aufruf nur über posteulen-update."
old_release=$2
old_version=$(release_version "$old_release")
new_version=$(release_version "$RELEASE")
info "Update von $old_version auf $new_version"

"$RELEASE/deploy/update-steps.sh" "$old_version"
build_release "$RELEASE" || die "Der Build ist fehlgeschlagen; der bisherige Stand läuft unverändert weiter." "Ausgabe oben lesen und erneut versuchen."

"$old_release/deploy/backup.sh" --reason update
snapshot=$(cat "$PE_STATE/last-snapshot")

rollback_on_error() {
  trap - ERR
  warn "Das Update ist fehlgeschlagen. Kehre automatisch zu $old_version zurück …"
  if restore "$old_release" "$snapshot"; then
    die "Das Update auf $new_version ist fehlgeschlagen. Version $old_version läuft wieder mit dem Datenstand von vor dem Update." "„journalctl -u posteulen -n 100“ ansehen und den Fehler melden."
  fi
  die "Update UND automatischer Rückfall sind fehlgeschlagen." "README.md, Abschnitt „Wenn ein Update schiefgeht“."
}
trap rollback_on_error ERR

systemctl stop posteulen.service
as_service node "$RELEASE/backend/src/cli.ts" migrate
admin_output=$(as_service node "$RELEASE/backend/src/cli.ts" admin-init)
# v0.8: Zugang zum Bots-Kontrollzentrum – nur beim ersten Update mit dem Kontrollzentrum.
bots_output=$(as_service node "$RELEASE/backend/src/cli.ts" bots-init)
switch_symlink "$RELEASE" "$PE_CURRENT"
"$RELEASE/deploy/configure.sh"
systemctl start posteulen.service
health_check "$domain" "$test_mode"
trap - ERR

printf '%s\n' "$old_release" >"$PE_STATE/previous-release"
printf '%s\n' "$snapshot" >"$PE_STATE/previous-snapshot"
# Die letzten Releases behalten (SPEC 16.3), nie das aktive oder das vorige löschen.
mapfile -t old < <(find "$PE_RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2- | tail -n +$((PE_RELEASES_KEPT + 1)))
for dir in "${old[@]}"; do
  [[ $dir == "$RELEASE" || $dir == "$old_release" ]] || rm -rf "$dir"
done
ok "PostEulen läuft jetzt in Version $new_version."
admin_password=$(sed -n 's/^ADMIN-ERSTPASSWORT: //p' <<<"$admin_output")
if [[ -n $admin_password ]]; then
  banner "Neu: Adminpanel. Erstpasswort (wird nur jetzt angezeigt): $admin_password" \
    "Anmelden unter https://admin.$domain – beim ersten Login muss es geändert werden."
fi
bots_password=$(sed -n 's/^BOTS-ERSTPASSWORT: //p' <<<"$bots_output")
if [[ -n $bots_password ]]; then
  banner "Neu: Bots-Kontrollzentrum. Erstpasswort (wird nur jetzt angezeigt): $bots_password" \
    "Anmelden unter https://bots.$domain – beim ersten Login muss es geändert werden." \
    "Dafür braucht bots.$domain einen DNS-Eintrag (A/AAAA) auf diesen Server." \
    "Vergessen? „sudo posteulen-cli bots-reset“ erzeugt ein neues."
fi
if [[ -f $RELEASE/CHANGELOG.md ]]; then
  info "Hinweise für Betreiber (CHANGELOG.md):"
  sed -n '1,40p' "$RELEASE/CHANGELOG.md"
fi
