#!/usr/bin/env bash
# Versionsspezifische Update-Schritte der NEUEN Version (SPEC 16.3), z. B. neue Pakete oder
# ein Wechsel der Node.js-Hauptversion. Wird vom Update vor dem Bauen ausgeführt.
# $1 = Version, von der aus aktualisiert wird.
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"

from_version=${1:-unbekannt}
info "Update-Schritte (von $from_version)."

# v0.9: Tor für den Onion-Dienst (SPEC 16.5) – schon jetzt, während die alte Version noch läuft.
# Ein Fehler hier hält das Update nicht auf; tor.sh meldet ihn später deutlich.
if ! command -v tor >/dev/null 2>&1; then
  info "Installiere Tor für den Onion-Dienst …"
  install -d -m 0755 "$PE_STATE"
  if DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tor >/dev/null 2>&1; then
    touch "$PE_STATE/tor-von-posteulen-installiert"
    systemctl mask --now tor@default.service >/dev/null 2>&1 || true
    ok "Tor installiert."
  else
    warn "Tor ließ sich (noch) nicht installieren – das Update läuft trotzdem weiter."
  fi
fi

# Node.js-Hauptversion sicherstellen (falls eine spätere Version sie anhebt, reicht es,
# PE_NODE_MAJOR in lib.sh zu ändern; install.sh richtet die Quelle passend ein).
current_major=$(node --version | sed -E 's/^v([0-9]+).*/\1/')
if [[ $current_major != "$PE_NODE_MAJOR" ]]; then
  die "Node.js $current_major ist installiert, diese Version braucht Node.js $PE_NODE_MAJOR." \
    "install.sh dieser Version ausführen, um die Paketquelle umzustellen."
fi
