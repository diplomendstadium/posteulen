#!/usr/bin/env bash
# PostEulen – nächtliche automatische Updates (v1.4.3, SPEC 16.3). Läuft als
# posteulen-autoupdate.service direkt nach der täglichen Sicherung (OnSuccess/OnFailure von
# posteulen-backup.service):
#
#   1. Debian und alle installierten Pakete: apt-get update && apt-get full-upgrade
#      (ohne Rückfragen, geänderte Konfigurationsdateien bleiben, wie sie sind),
#   2. PostEulen: posteulen-update --yes (prüft wie immer die Signatur und rollt bei Problemen
#      selbst zurück),
#   3. Neustart des Servers, wenn Debian ihn verlangt (/run/reboot-required, z. B. neuer Kernel).
#
# Abschaltbar im Adminpanel („Server der Instanz“). Was nicht geht, steht mit einer verständlichen
# Meldung im Fehlerprotokoll des Adminpanels; das Ergebnis des letzten Laufs in
# /var/lib/posteulen/auto-update.
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
require_root
cd /

readonly COMPONENT='Automatische Updates'
log=$(mktemp)
trap 'rm -f "$log"' EXIT

started=$(printf '%(%s)T' -1)
apt_state=off apt_upgraded=0 pe_state=current reboot=0 result=ok

save_status() {
  printf 'run_at=%s\nresult=%s\napt=%s\napt_upgraded=%s\nposteulen=%s\nreboot=%s\n' \
    "$started" "$result" "$apt_state" "$apt_upgraded" "$pe_state" "$reboot" | write_state auto-update
}

# Die letzten aussagekräftigen Zeilen einer Ausgabe, ohne Farben, als eine Zeile.
last_lines() {
  sed -e 's/\x1b\[[0-9;]*m//g' "$log" | grep -v '^[[:space:]]*$' | tail -n "${1:-3}" | tr '\n' ' ' |
    cut -c1-400
}

if [[ $(cat "$PE_AUTO_UPDATE_SWITCH" 2>/dev/null || true) == off ]]; then
  result=off apt_state=off pe_state=current
  save_status
  info "Automatische Updates sind im Adminpanel abgeschaltet."
  exit 0
fi

# Ohne frische Sicherung keine Updates.
backup_result=$(systemctl show -p Result --value posteulen-nightly.service 2>/dev/null || true)
if [[ $backup_result != success ]]; then
  result=skipped
  save_status
  ops_report "$COMPONENT" error \
    'Die nächtliche Sicherung ist fehlgeschlagen – die automatischen Updates wurden deshalb ausgelassen.' \
    "systemd meldet für posteulen-nightly.service: ${backup_result:-unbekannt}." \
    '„sudo journalctl -u posteulen-nightly -n 50“ ansehen und die Sicherung mit „sudo /opt/posteulen/current/deploy/backup.sh“ von Hand prüfen.'
  exit 0
fi

# ── 1. Debian ──
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
info "Aktualisiere Debian und die installierten Pakete …"
if ! apt-get update -q -o DPkg::Lock::Timeout=600 >"$log" 2>&1; then
  apt_state=error result=error
  ops_report "$COMPONENT" error \
    'Die Paketlisten von Debian ließen sich nicht laden – der Server wurde heute Nacht nicht aktualisiert.' \
    "apt-get update meldet: $(last_lines 2)" \
    'Netzwerk und Paketquellen prüfen („sudo apt-get update“ von Hand ausführen). PostEulen läuft weiter.'
elif ! apt-get -y -q -o DPkg::Lock::Timeout=600 -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold full-upgrade >"$log" 2>&1; then
  apt_state=error result=error
  ops_report "$COMPONENT" error \
    'Die Updates für Debian und die installierten Pakete sind fehlgeschlagen.' \
    "apt-get full-upgrade meldet: $(last_lines 3)" \
    '„sudo apt-get full-upgrade“ von Hand ausführen und die Ausgabe lesen; bei einem abgebrochenen Lauf zuerst „sudo dpkg --configure -a“. PostEulen läuft weiter.'
else
  apt_state=ok
  apt_upgraded=$(sed -n 's/^\([0-9][0-9]*\) upgraded, \([0-9][0-9]*\) newly installed.*/\1 \2/p' "$log" |
    awk '{print $1 + $2}' | tail -n1)
  apt_upgraded=${apt_upgraded:-0}
  ok "Debian aktualisiert ($apt_upgraded Pakete)."
fi

# ── 2. PostEulen ──
info "Prüfe auf eine neue Version von PostEulen …"
if /usr/local/sbin/posteulen-update --yes >"$log" 2>&1; then
  if grep -q 'ist bereits installiert' "$log"; then pe_state=current; else pe_state=updated; fi
  ok "PostEulen: $(last_lines 1)"
else
  pe_state=error result=error
  ops_report "$COMPONENT" error \
    'Das automatische Update von PostEulen ist fehlgeschlagen – die bisherige Version läuft weiter.' \
    "posteulen-update meldet: $(last_lines 3)" \
    '„sudo posteulen-update“ von Hand ausführen und die Ausgabe lesen. Lehnt es die Version ab (Signatur, älter), nichts erzwingen und die Herkunft prüfen.'
fi

# ── 3. Neustart, wenn Debian ihn verlangt ──
if [[ -f /run/reboot-required ]]; then
  reboot=1
  save_status
  packages=$(tr '\n' ' ' 2>/dev/null </run/reboot-required.pkgs | cut -c1-200 || true)
  ops_report "$COMPONENT" info \
    'Der Server wurde nach den automatischen Updates neu gestartet.' \
    "Debian verlangte einen Neustart${packages:+ (wegen: $packages)}." \
    'Nichts zu tun – PostEulen startet von selbst wieder.'
  info "Debian verlangt einen Neustart – starte den Server neu."
  systemctl reboot
  exit 0
fi
save_status
