#!/usr/bin/env bash
# PostEulen im Tor-Netz (SPEC 16.5): Onion-Dienst parallel zur normalen Domain.
#
#   tor.sh setup     Installation/Update: Tor-Instanz „tor@posteulen“ einrichten, Schlüssel
#                    erhalten oder wiederherstellen, Units schreiben, Tor starten (falls erwünscht)
#   tor.sh check     nach dem Start: Onion-Seite lokal prüfen und – mit --network – einmal über
#                    das Tor-Netz abrufen
#   tor.sh apply     Schalter aus dem Adminpanel anwenden (systemd: posteulen-tor.path)
#   tor.sh started   Tor läuft wieder (systemd: ExecStartPost von tor@posteulen)
#   tor.sh failed    Tor ist dauerhaft ausgefallen (systemd: OnFailure von tor@posteulen)
#
# Grundsätze: Die Onion-Adressen ändern sich nie mehr, wenn sie einmal da sind. Es gibt drei:
# die Spieler-App, seit v1.4 auch Adminpanel und Bots-Kontrollzentrum – im selben Tor-Dienst.
# Maßgeblich ist jeweils die Kopie der Schlüssel in /etc/posteulen/onion, onion-admin bzw.
# onion-bots (nie überschrieben, Teil jeder Sicherung); fehlt sie, wird sie aus dem
# Schlüsselverzeichnis von Tor angelegt; fehlt beides, erzeugt Tor neue Schlüssel. Ein Problem mit Tor hält PostEulen nie auf: Dieses Skript endet immer mit 0, meldet
# Probleme als deutlichen Hinweis und im Fehlerprotokoll des Adminpanels, und die normale Seite
# läuft weiter.
set -uo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
RELEASE=$(cd "$SELF_DIR/.." && pwd)
require_root

KEY_FILES=(hs_ed25519_secret_key hs_ed25519_public_key hostname)
# v1.4: die drei Onion-Dienste – maßgebliche Kopie, Schlüsselverzeichnis von Tor, lokaler Port.
SERVICES=(
  "$PE_ONION_KEYS $PE_TOR_HS_DIR $PE_ONION_LISTEN_PORT"
  "$PE_ONION_KEYS_ADMIN $PE_TOR_HS_DIR_ADMIN $PE_ONION_ADMIN_LISTEN_PORT"
  "$PE_ONION_KEYS_BOTS $PE_TOR_HS_DIR_BOTS $PE_ONION_BOTS_LISTEN_PORT"
)

# Meldet einen Fehler: Hinweis bei Installation/Update und Eintrag im Fehlerprotokoll.
tor_problem() {
  local what=$1 cause=$2 action=${3:-„journalctl -u $PE_TOR_UNIT -n 50“ auf dem Server ansehen.}
  notice "Tor: $what $cause Die normale Seite läuft weiter. Was tun: $action"
  tor_report error --what "$what" --cause "$cause" --action "$action"
}

keys_complete() {
  local dir=$1 file
  for file in "${KEY_FILES[@]}"; do [[ -s $dir/$file ]] || return 1; done
}

keys_equal() {
  local copy=$1 dir=$2 file
  for file in hs_ed25519_secret_key hs_ed25519_public_key; do
    cmp -s "$copy/$file" "$dir/$file" || return 1
  done
}

# Tor-Paket aus Debian (Sicherheitsupdates über unattended-upgrades). Wurde es hier erst
# installiert, wird die Standard-Instanz (ein Tor-Client mit SOCKS-Port) abgeschaltet – PostEulen
# braucht nur den Onion-Dienst.
ensure_package() {
  if command -v tor >/dev/null 2>&1 && [[ -x /usr/sbin/tor-instance-create ]]; then return 0; fi
  info "Installiere Tor …"
  export DEBIAN_FRONTEND=noninteractive
  if ! apt-get install -y -qq tor >/dev/null; then
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y -qq tor >/dev/null || return 1
  fi
  install -d -m 0755 "$PE_STATE"
  touch "$PE_STATE/tor-von-posteulen-installiert"
  systemctl mask --now tor@default.service >/dev/null 2>&1 || true
  ok "Tor $(tor --version 2>/dev/null | head -n1 | awk '{print $3}' | sed 's/\.$//') installiert."
}

write_torrc() {
  install -d -m 0755 "$PE_TOR_ETC"
  local service copy dir port
  {
    cat <<TORRC
# Erzeugt von PostEulen (deploy/tor.sh). Nicht von Hand ändern – wird bei jedem Update neu
# geschrieben. Onion-Dienste von PostEulen (SPEC 16.5): die Spieler-App, das Adminpanel und das
# Bots-Kontrollzentrum. Tor übernimmt Verschlüsselung und Authentifizierung, deshalb sprechen
# die Onion-Seiten einfaches http mit dem lokalen Caddy. Je Dienst: Rechenaufgabe (Proof of
# Work) bei Andrang, Begrenzung an den Einführungspunkten und höchstens 64 gleichzeitige
# Verbindungen je Tor-Kreis.
TORRC
    for service in "${SERVICES[@]}"; do
      read -r copy dir port <<<"$service"
      cat <<TORRC

HiddenServiceDir $dir
HiddenServiceVersion 3
HiddenServicePort 80 127.0.0.1:$port
HiddenServicePoWDefensesEnabled 1
HiddenServiceEnableIntroDoSDefense 1
HiddenServiceMaxStreams 64
HiddenServiceMaxStreamsCloseCircuit 1
TORRC
    done
  } >"$PE_TOR_ETC/torrc.new"
  # Prüfen wie die Unit es tut; kennt diese Tor-Version die Abwehr per Rechenaufgabe nicht, ohne sie.
  local defaults
  defaults=$(mktemp)
  sed -e "s/@@NAME@@/$PE_TOR_INSTANCE/g" /usr/share/tor/tor-service-defaults-torrc-instances >"$defaults"
  if ! tor --defaults-torrc "$defaults" -f "$PE_TOR_ETC/torrc.new" --verify-config >/dev/null 2>&1; then
    sed -i '/^HiddenServicePoWDefensesEnabled/d' "$PE_TOR_ETC/torrc.new"
    if ! tor --defaults-torrc "$defaults" -f "$PE_TOR_ETC/torrc.new" --verify-config >/dev/null 2>&1; then
      rm -f "$defaults" "$PE_TOR_ETC/torrc.new"
      return 1
    fi
    notice "Tor: Diese Tor-Version kennt den Schutz per Rechenaufgabe (PoW) nicht – der Onion-Dienst läuft ohne ihn."
  fi
  rm -f "$defaults"
  local changed=1
  cmp -s "$PE_TOR_ETC/torrc.new" "$PE_TOR_ETC/torrc" && changed=0
  mv "$PE_TOR_ETC/torrc.new" "$PE_TOR_ETC/torrc"
  chmod 0644 "$PE_TOR_ETC/torrc"
  return $((changed == 1 ? 10 : 0))
}

write_units() {
  local unit
  for unit in posteulen-tor.path posteulen-tor-apply.service posteulen-tor-failed.service; do
    install -m 0644 "$RELEASE/deploy/systemd/$unit" "/etc/systemd/system/$unit"
  done
  install -d -m 0755 "/etc/systemd/system/$PE_TOR_UNIT.d"
  install -m 0644 "$RELEASE/deploy/systemd/tor-posteulen.conf" "/etc/systemd/system/$PE_TOR_UNIT.d/posteulen.conf"
  systemctl daemon-reload
  systemctl enable --quiet posteulen-tor.path 2>/dev/null || true
  systemctl restart posteulen-tor.path 2>/dev/null || true
  # Der Sammeldienst „tor.service“ startet beim Booten alle Instanzen (auch tor@posteulen).
  systemctl enable --quiet tor.service 2>/dev/null || true
}

# Schlüssel: die Kopie in /etc/posteulen/onion (bzw. onion-admin, onion-bots) ist maßgeblich
# (SPEC 16.5). Gibt 10 zurück, wenn Schlüssel im Verzeichnis von Tor ersetzt wurden (dann muss
# Tor neu starten).
sync_keys() {
  local service copy dir port file replaced=0
  for service in "${SERVICES[@]}"; do
    read -r copy dir port <<<"$service"
    if keys_complete "$copy"; then
      if ! keys_complete "$dir" || ! keys_equal "$copy" "$dir"; then
        systemctl stop "$PE_TOR_UNIT" >/dev/null 2>&1 || true
        install -d -m 0700 -o "_tor-$PE_TOR_INSTANCE" -g "_tor-$PE_TOR_INSTANCE" "$dir"
        for file in "${KEY_FILES[@]}"; do
          install -m 0600 -o "_tor-$PE_TOR_INSTANCE" -g "_tor-$PE_TOR_INSTANCE" "$copy/$file" "$dir/$file"
        done
        info "Onion-Schlüssel aus $copy übernommen (Adresse $(onion_host "$copy"))."
        replaced=1
      fi
    elif keys_complete "$dir"; then
      save_keys
    fi
  done
  return $((replaced == 1 ? 10 : 0))
}

# Legt die maßgeblichen Kopien an – nur, wo es sie noch nicht gibt (nie überschreiben).
save_keys() {
  local service copy dir port file
  for service in "${SERVICES[@]}"; do
    read -r copy dir port <<<"$service"
    keys_complete "$copy" && continue
    keys_complete "$dir" || continue
    if [[ -e $copy ]] && [[ -n $(ls -A "$copy" 2>/dev/null) ]]; then
      notice "Tor: $copy ist unvollständig und wurde nicht angerührt. Die Dateien ${KEY_FILES[*]} gehören dort hinein (z. B. aus einer Sicherung)."
      continue
    fi
    install -d -m 0700 -o root -g root "$copy"
    for file in "${KEY_FILES[@]}"; do install -m 0600 -o root -g root "$dir/$file" "$copy/$file"; done
    ok "Onion-Schlüssel gesichert in $copy (Teil der täglichen Sicherung)."
  done
}

# Alle drei Schlüsselverzeichnisse von Tor sind vollständig.
all_keys_ready() {
  local service copy dir port
  for service in "${SERVICES[@]}"; do
    read -r copy dir port <<<"$service"
    keys_complete "$dir" || return 1
  done
}

# Startet Tor (neu) und wartet auf die Onion-Adresse.
start_tor() {
  local mode=$1 attempt
  systemctl reset-failed "$PE_TOR_UNIT" >/dev/null 2>&1 || true
  if [[ $mode == restart ]] || ! systemctl is-active --quiet "$PE_TOR_UNIT"; then
    systemctl restart "$PE_TOR_UNIT" >/dev/null 2>&1 || return 1
  else
    systemctl reload "$PE_TOR_UNIT" >/dev/null 2>&1 || systemctl restart "$PE_TOR_UNIT" >/dev/null 2>&1 || return 1
  fi
  for attempt in $(seq 1 30); do
    all_keys_ready && systemctl is-active --quiet "$PE_TOR_UNIT" && return 0
    sleep 1
  done
  return 1
}

cmd_setup() {
  info "Richte den Onion-Dienst ein (Tor) …"
  if ! ensure_package; then
    tor_problem "Tor ließ sich nicht installieren." "apt-get install tor ist fehlgeschlagen." "„sudo apt-get install tor“ von Hand versuchen und danach „sudo posteulen-update“ erneut ausführen."
    return 0
  fi
  [[ -d $PE_TOR_ETC ]] || tor-instance-create "$PE_TOR_INSTANCE" >/dev/null 2>&1 || {
    tor_problem "Die Tor-Instanz „$PE_TOR_INSTANCE“ ließ sich nicht anlegen." "tor-instance-create ist fehlgeschlagen."
    return 0
  }
  local restart=reload
  write_torrc
  case $? in
    0) ;;
    10) restart=restart ;;
    *)
      tor_problem "Die Tor-Konfiguration ist ungültig." "tor --verify-config hat sie abgelehnt."
      return 0
      ;;
  esac
  write_units
  sync_keys
  [[ $? -eq 10 ]] && restart=restart
  if ! tor_wanted; then
    systemctl stop "$PE_TOR_UNIT" >/dev/null 2>&1 || true
    info "Tor ist im Adminpanel abgeschaltet – der Onion-Dienst bleibt aus (Schlüssel bleiben erhalten)."
    tor_report off
    return 0
  fi
  if ! start_tor "$restart"; then
    tor_problem "Der Tor-Dienst startet nicht." "$(systemctl show -p Result --value "$PE_TOR_UNIT" 2>/dev/null)"
    return 0
  fi
  save_keys
  ok "Onion-Dienst läuft: http://$(onion_host)"
  [[ -n $(onion_host "$PE_ONION_KEYS_ADMIN") ]] && ok "Adminpanel im Tor-Netz: http://$(onion_host "$PE_ONION_KEYS_ADMIN")"
  [[ -n $(onion_host "$PE_ONION_KEYS_BOTS") ]] && ok "Bots-Kontrollzentrum im Tor-Netz: http://$(onion_host "$PE_ONION_KEYS_BOTS")"
  return 0
}

# Lokale Prüfung über den Caddy-Listener einer Onion-Seite (genau der Weg, den Tor nimmt).
# Antwortet die API dort mit 503, ist die Seite im Adminpanel abgeschaltet – auch das ist in Ordnung.
local_check() {
  local onion=$1 port=${2:-$PE_ONION_LISTEN_PORT} attempt code
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 -H "Host: $onion" "http://127.0.0.1:$port/api/health" 2>/dev/null || true)
    [[ $code == 200 || $code == 503 ]] && return 0
    sleep 2
  done
  return 1
}

cmd_check() {
  local network=0 onion attempt
  [[ ${1:-} == --network ]] && network=1
  onion=$(onion_host)
  if ! tor_wanted; then
    tor_report off
    return 0
  fi
  if [[ -z $onion ]]; then
    tor_problem "Es gibt (noch) keine Onion-Adresse." "Die Einrichtung von Tor ist nicht abgeschlossen." "„sudo posteulen-update“ erneut ausführen; die Ausgabe zu Tor lesen."
    return 0
  fi
  if ! systemctl is-active --quiet "$PE_TOR_UNIT"; then
    tor_problem "Der Tor-Dienst läuft nicht." "systemctl meldet $PE_TOR_UNIT als nicht aktiv." "„sudo systemctl restart $PE_TOR_UNIT“ und „journalctl -u $PE_TOR_UNIT -n 50“."
    return 0
  fi
  if ! local_check "$onion"; then
    tor_problem "Die Onion-Seite antwortet lokal nicht." "Caddy liefert unter 127.0.0.1:$PE_ONION_LISTEN_PORT keine Antwort für $onion." "„journalctl -u caddy -u posteulen -n 50“ ansehen."
    return 0
  fi
  # v1.4: die Onion-Seiten von Adminpanel und Bots-Kontrollzentrum.
  local panel_onion panel_port panel_keys
  for panel_keys in "$PE_ONION_KEYS_ADMIN $PE_ONION_ADMIN_LISTEN_PORT" "$PE_ONION_KEYS_BOTS $PE_ONION_BOTS_LISTEN_PORT"; do
    read -r panel_keys panel_port <<<"$panel_keys"
    panel_onion=$(onion_host "$panel_keys")
    [[ -n $panel_onion ]] || continue
    if ! local_check "$panel_onion" "$panel_port"; then
      tor_problem "Eine Onion-Seite antwortet lokal nicht." "Caddy liefert unter 127.0.0.1:$panel_port keine Antwort für $panel_onion." "„journalctl -u caddy -u posteulen -n 50“ ansehen."
      return 0
    fi
  done
  tor_report ok
  ok "Onion-Seiten antworten lokal (http://$onion)."
  [[ $network -eq 1 ]] || return 0
  # Einmal über das Tor-Netz (eigener SOCKS-Zugang der Instanz, nur lokal). Nach der ersten
  # Einrichtung braucht die Veröffentlichung im Tor-Netz manchmal einige Minuten.
  info "Prüfe die Onion-Adresse über das Tor-Netz (bis zu 3 Minuten) …"
  for attempt in 1 2 3; do
    if curl --silent --fail --max-time 60 --proxy "socks5h://localhost$PE_TOR_SOCKS" "http://$onion/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
      ok "PostEulen ist im Tor-Netz erreichbar: http://$onion"
      return 0
    fi
  done
  notice "Tor: http://$onion war über das Tor-Netz noch nicht erreichbar. Nach der ersten Einrichtung dauert die Veröffentlichung oft 5 bis 10 Minuten; lokal funktioniert die Onion-Seite. Später prüfen: „sudo $PE_CURRENT/deploy/tor.sh check --network“ oder im Tor Browser."
  tor_report warning --what "Die Onion-Adresse war bei der Prüfung über das Tor-Netz nicht erreichbar." --cause "Veröffentlichung im Tor-Netz noch nicht abgeschlossen oder keine Verbindung zum Tor-Netz." --action "Später im Tor Browser prüfen; bleibt es so: „journalctl -u $PE_TOR_UNIT -n 50“."
}

cmd_apply() {
  # Nicht gleichzeitig mit einem Update (es wendet den Schalter am Ende ohnehin selbst an).
  exec 9>/run/posteulen-update.lock
  flock -w 1800 9 || return 0
  [[ -d $PE_TOR_ETC ]] || { "$RELEASE/deploy/configure.sh" >/dev/null || true; return 0; }
  if tor_wanted; then
    # Läuft Tor schon (z. B. der erste Abgleich nach der Installation), bleibt es dabei –
    # ein Neustart würde die Onion-Adresse unnötig für eine Weile unerreichbar machen.
    if ! systemctl is-active --quiet "$PE_TOR_UNIT"; then
      info "Tor wird eingeschaltet."
      sync_keys
      if ! start_tor restart; then
        tor_problem "Der Tor-Dienst startet nicht." "$(systemctl show -p Result --value "$PE_TOR_UNIT" 2>/dev/null)"
      fi
    fi
  else
    info "Tor wird abgeschaltet."
    systemctl stop "$PE_TOR_UNIT" >/dev/null 2>&1 || true
  fi
  # Caddy: Onion-Location nur, solange Tor läuft.
  "$RELEASE/deploy/configure.sh" >/dev/null || tor_problem "Die Caddy-Konfiguration ließ sich nicht anpassen." "configure.sh ist fehlgeschlagen." "„sudo $PE_CURRENT/deploy/configure.sh“ von Hand ausführen."
  cmd_check
}

case ${1:-} in
  setup) cmd_setup ;;
  check) cmd_check "${2:-}" ;;
  apply) cmd_apply ;;
  started) tor_wanted && tor_report ok ;;
  failed)
    tor_report error --what "Der Tor-Dienst ist ausgefallen und startet nicht mehr von selbst." \
      --cause "systemd meldet: $(systemctl show -p Result --value "$PE_TOR_UNIT" 2>/dev/null)." \
      --action "„sudo systemctl restart $PE_TOR_UNIT“ und „journalctl -u $PE_TOR_UNIT -n 50“ ansehen. Die normale Seite läuft weiter."
    ;;
  *) die "Aufruf: tor.sh <setup|check [--network]|apply|started|failed>" ;;
esac
exit 0
