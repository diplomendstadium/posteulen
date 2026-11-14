#!/usr/bin/env bash
# Gemeinsame Funktionen für install.sh, update.sh, configure.sh und backup.sh (SPEC 16).
# Wird per „source“ eingebunden, nie direkt ausgeführt.
# shellcheck disable=SC2034 # Die Konstanten werden von den einbindenden Skripten genutzt.

# Pfade (SPEC Anhang L.7)
readonly PE_OPT=/opt/posteulen
readonly PE_REPO=$PE_OPT/repo
readonly PE_RELEASES=$PE_OPT/releases
readonly PE_CURRENT=$PE_OPT/current
readonly PE_STATE=$PE_OPT/state
readonly PE_DATA=/var/lib/posteulen
readonly PE_SNAPSHOTS=$PE_DATA/snapshots
readonly PE_ETC=/etc/posteulen
readonly PE_SECRETS=$PE_ETC/secrets.json
readonly PE_CONF=$PE_ETC/posteulen.conf
readonly PE_SERVICE_ENV=$PE_ETC/service.env
readonly PE_LOCAL=$PE_ETC/local
readonly PE_BACKUP_PUB=$PE_ETC/backup.pub
readonly PE_BACKUPS=/var/backups/posteulen
readonly PE_USER=posteulen
readonly PE_NODE_MAJOR=26
readonly PE_RELEASES_KEPT=3
readonly PE_BACKUP_DAYS=7

# v0.9: Onion-Dienst (SPEC 16.5). Eigene Tor-Instanz nach Debian-Art („tor@posteulen“), damit die
# Konfiguration ganz PostEulen gehört; die Schlüssel liegen zusätzlich als maßgebliche Kopie in
# /etc/posteulen/onion (nie überschrieben, Teil der Sicherung).
readonly PE_TOR_INSTANCE=posteulen
readonly PE_TOR_UNIT=tor@posteulen.service
readonly PE_TOR_ETC=/etc/tor/instances/posteulen
readonly PE_TOR_DATA=/var/lib/tor-instances/posteulen
readonly PE_TOR_HS_DIR=$PE_TOR_DATA/onion
readonly PE_TOR_SOCKS=/run/tor-instances/posteulen/socks
readonly PE_ONION_KEYS=$PE_ETC/onion
readonly PE_TOR_SWITCH=$PE_DATA/tor-switch
# Caddy nimmt die Onion-Seite nur lokal an; Tor leitet Port 80 der Onion-Adresse hierher.
readonly PE_ONION_LISTEN_PORT=3005
# Hinweise, die am Ende von Installation oder Update gesammelt angezeigt werden.
readonly PE_NOTICES=/run/posteulen-hinweise

# Fest eingetragene Fingerabdrücke der Paketquellen-Schlüssel (geprüft am 2026-11-05).
readonly NODESOURCE_KEY_URL=https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key
readonly NODESOURCE_KEY_FPR=6F71F525282841EEDAF851B42F59B5F99B1BE0B4
readonly CADDY_KEY_URL=https://dl.cloudsmith.io/public/caddy/stable/gpg.key
readonly CADDY_KEY_FPR=65760C51EDEA2017CEA2CA15155B6D79CA56EA34

if [[ -t 1 ]]; then
  PE_BOLD=$'\e[1m' PE_RED=$'\e[31m' PE_GREEN=$'\e[32m' PE_YELLOW=$'\e[33m' PE_RESET=$'\e[0m'
else
  PE_BOLD='' PE_RED='' PE_GREEN='' PE_YELLOW='' PE_RESET=''
fi

info() { printf '%s\n' "${PE_BOLD}==>${PE_RESET} $*"; }
ok() { printf '%s\n' "${PE_GREEN}✔${PE_RESET} $*"; }
warn() { printf '%s\n' "${PE_YELLOW}Warnung:${PE_RESET} $*" >&2; }
die() {
  printf '%s\n' "${PE_RED}Fehler:${PE_RESET} $1" >&2
  if [[ $# -gt 1 ]]; then printf '%s\n' "Was tun: $2" >&2; fi
  exit 1
}

# Großer, unübersehbarer Hinweis (z. B. Sicherung der Geheimnis-Datei).
banner() {
  local line
  printf '\n%s\n' "${PE_YELLOW}${PE_BOLD}################################################################${PE_RESET}"
  for line in "$@"; do printf '%s\n' "${PE_YELLOW}${PE_BOLD}#${PE_RESET} $line"; done
  printf '%s\n\n' "${PE_YELLOW}${PE_BOLD}################################################################${PE_RESET}"
}

# v0.9: ein Hinweis, der sofort erscheint UND am Ende gesammelt und unübersehbar wiederholt wird
# (Erreichbarkeit über www, IPv4/IPv6, Tor). Hinweise halten Installation und Update nie auf.
notice() {
  warn "$*"
  printf '%s\n' "$*" >>"$PE_NOTICES" 2>/dev/null || true
}

# Zeigt alle gesammelten Hinweise als Banner und leert die Sammlung.
show_notices() {
  [[ -s $PE_NOTICES ]] || return 0
  local -a lines=("ACHTUNG – bitte prüfen (PostEulen läuft trotzdem):" "")
  local line
  while IFS= read -r line; do lines+=("• $line"); done <"$PE_NOTICES"
  rm -f "$PE_NOTICES"
  banner "${lines[@]}"
}

require_root() {
  [[ $EUID -eq 0 ]] || die "Dieses Skript braucht root-Rechte." "Mit „sudo $0 …“ erneut aufrufen."
}

# Frage mit Ja/Nein. $1 = Frage, $2 = Vorgabe (ja|nein), $3 = Antwort aus Parameter (leer = fragen).
# Mit --yes (PE_ASSUME_YES=1) gilt „ja“; ohne Terminal und ohne --yes gilt die Vorgabe.
ask_yes_no() {
  local question=$1 default=$2 preset=${3:-} answer
  if [[ -n $preset ]]; then [[ $preset == ja ]]; return; fi
  if [[ ${PE_ASSUME_YES:-0} -eq 1 ]]; then return 0; fi
  if [[ ! -t 0 ]]; then [[ $default == ja ]]; return; fi
  read -r -p "$question [${default}] " answer
  answer=${answer:-$default}
  [[ ${answer,,} == j* || ${answer,,} == y* ]]
}

# Liest einen Wert aus /etc/posteulen/posteulen.conf, ohne die Datei auszuführen.
conf_get() {
  local key=$1 line
  [[ -f $PE_CONF ]] || return 0
  while IFS= read -r line; do
    if [[ $line =~ ^${key}=(.*)$ ]]; then
      printf '%s' "${BASH_REMATCH[1]}"
      return 0
    fi
  done <"$PE_CONF"
}

valid_domain() {
  [[ $1 =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ && ${#1} -le 253 ]]
}

# Führt einen Befehl als Dienstbenutzer aus, mit der Umgebung des Dienstes.
as_service() {
  local -a env=(POSTEULEN_ENV=production "POSTEULEN_DATA_DIR=$PE_DATA" "POSTEULEN_SECRETS_FILE=$PE_SECRETS")
  if [[ -f $PE_SERVICE_ENV ]]; then
    local line
    while IFS= read -r line; do [[ $line =~ ^POSTEULEN_[A-Z_]+=.*$ ]] && env+=("$line"); done <"$PE_SERVICE_ENV"
  fi
  runuser -u "$PE_USER" -- env -i PATH=/usr/bin:/bin HOME="$PE_DATA" "${env[@]}" "$@"
}

# Atomares Umschalten eines Symlinks.
switch_symlink() {
  local target=$1 link=$2
  ln -sfn "$target" "$link.new"
  mv -T "$link.new" "$link"
}

# Funktionsprüfung über HTTPS (SPEC 16.2 Schritt 5). $1 = Domain, $2 = Testmodus (0|1).
health_check() {
  local domain=$1 test_mode=$2 attempt host url headers
  local -a curl_opts=(--silent --show-error --fail --max-time 10 --resolve "$domain:443:127.0.0.1" --resolve "admin.$domain:443:127.0.0.1" --resolve "bots.$domain:443:127.0.0.1")
  if [[ $test_mode -eq 1 ]]; then
    local ca=/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
    [[ -f $ca ]] && curl_opts+=(--cacert "$ca") || curl_opts+=(--insecure)
  fi
  for attempt in $(seq 1 30); do
    if curl "${curl_opts[@]}" "https://$domain/api/health" >/dev/null 2>&1 &&
      curl "${curl_opts[@]}" "https://admin.$domain/api/health" >/dev/null 2>&1; then
      break
    fi
    [[ $attempt -eq 30 ]] && { warn "Health-Endpunkt antwortet nicht."; return 1; }
    sleep 2
  done
  for host in "$domain" "admin.$domain"; do
    url="https://$host/"
    headers=$(curl "${curl_opts[@]}" --dump-header - --output /dev/null "$url") || { warn "$url nicht erreichbar."; return 1; }
    local header
    for header in content-security-policy strict-transport-security x-content-type-options referrer-policy cross-origin-opener-policy; do
      if ! grep -qi "^$header:" <<<"$headers"; then
        warn "Sicherheits-Header $header fehlt bei $url."
        return 1
      fi
    done
  done
  local health
  health=$(curl "${curl_opts[@]}" "https://$domain/api/health") || return 1
  grep -q '"status":"ok"' <<<"$health" || { warn "Unerwartete Antwort: $health"; return 1; }
  ok "Funktionsprüfung bestanden: Website, Verwaltung, Health-Endpunkt und Sicherheits-Header."
  # Nur Warnungen: in einer eigenen Subshell ohne Fehlerfalle und ohne errexit, damit kein Fehler
  # darin je den Rückfall des Updates auslöst (der VM-Test fand genau das: ein Fehler in der
  # Adressabfrage startete den Rückfall in der Prozess-Substitution).
  (
    trap - ERR
    set +e
    address_check "$domain" "$test_mode"
  ) || true
  # v0.8: das Bots-Kontrollzentrum (bots.<domain>). Fehlt dort noch der DNS-Eintrag, gibt es
  # kein Zertifikat – das ist kein Grund für einen Rückfall, nur ein Hinweis.
  # Nur wenn die laufende Version das Kontrollzentrum kennt (nach einem Rückfall auf eine ältere nicht).
  if grep -q "bots.$domain" /etc/caddy/Caddyfile 2>/dev/null &&
    ! curl "${curl_opts[@]}" "https://bots.$domain/api/health" >/dev/null 2>&1; then
    notice "https://bots.$domain antwortet (noch) nicht. Für das Bots-Kontrollzentrum braucht bots.$domain einen DNS-Eintrag (A/AAAA) auf diesen Server."
  fi
}

# v0.8.2: Firewall für IPv4 UND IPv6 (SPEC 16.2). Kommt später eine IPv6-Adresse dazu, muss ufw
# auch IPv6 filtern und die Ports dort öffnen – sonst scheitern Zertifikate über AAAA-Einträge.
ensure_firewall() {
  command -v ufw >/dev/null 2>&1 || return 0
  if [[ -f /etc/default/ufw ]] && grep -q '^IPV6=no' /etc/default/ufw; then
    sed -i 's/^IPV6=no/IPV6=yes/' /etc/default/ufw
    info "Firewall: IPv6 eingeschaltet."
  fi
  local rule
  for rule in 22/tcp 80/tcp 443/tcp 443/udp; do ufw allow "$rule" >/dev/null; done
  if ufw status | grep -q '^Status: active'; then ufw reload >/dev/null; fi
}

# Eigene öffentliche Adressen des Servers (IPv4 und IPv6, ohne temporäre IPv6-Adressen).
server_addresses() {
  ip -o addr show scope global 2>/dev/null | awk '$0 !~ / temporary/ {print $4}' | cut -d/ -f1 | sort -u
}

# v0.9: Onion-Adresse dieser Instanz aus der maßgeblichen Schlüsselkopie (leer, wenn es keine gibt).
onion_host() {
  local host
  [[ -f $PE_ONION_KEYS/hostname ]] || return 0
  host=$(tr -d '[:space:]' <"$PE_ONION_KEYS/hostname")
  [[ $host =~ ^[a-z2-7]{56}\.onion$ ]] && printf '%s' "$host"
  return 0
}

# v0.9: Soll Tor laufen? Ja, außer der Schalter im Adminpanel steht auf „aus“ (SPEC 16.5).
tor_wanted() {
  [[ $(cat "$PE_TOR_SWITCH" 2>/dev/null || true) != off ]]
}

# v0.9: Meldet den Zustand von Tor ans Adminpanel (ok|off|error|warning, bei error/warning mit
# --what/--cause/--action). Ohne laufende Datenbank oder mit älterer Version still ohne Wirkung.
tor_report() {
  local cli=$PE_CURRENT/backend/src/cli.ts
  [[ -f $cli ]] || return 0
  as_service node "$cli" tor-status "$@" >/dev/null 2>&1 || true
}

# v0.9: Soll www.<Domain> per Weiterleitung bedient werden? Ja im Testmodus; sonst nur, wenn
# www im DNS auf eine Adresse dieses Servers zeigt (sonst gäbe es kein Zertifikat).
www_wanted() {
  local domain=$1 test_mode=$2 address
  [[ $test_mode == 1 ]] && return 0
  for address in $(getent ahosts "www.$domain" 2>/dev/null | awk '{print $1}' | sort -u); do
    server_addresses | grep -qxF "$address" && return 0
  done
  return 1
}

# Öffentlich erreichbare Adresse? (Private IPv4-Netze und IPv6-ULA zählen nicht – ein Server hinter
# NAT oder mit internem IPv6 braucht dafür keinen DNS-Eintrag.)
is_public_address() {
  case $1 in
    10.* | 192.168.* | 127.* | 169.254.*) return 1 ;;
    172.1[6-9].* | 172.2[0-9].* | 172.3[01].*) return 1 ;;
    100.6[4-9].* | 100.[7-9][0-9].* | 100.1[01][0-9].* | 100.12[0-7].*) return 1 ;;
    [fF][cCdD]*:* | ::1) return 1 ;;
  esac
  return 0
}

# v0.8.2: Jeder Hostname über jede eigene Adresse (SPEC 16.2): DNS-Einträge (A/AAAA) gegen die
# Adressen des Servers abgleichen und je Adresse prüfen, ob HTTPS mit gültigem Zertifikat
# antwortet. Fehlende Zertifikate stößt ein Neuladen von Caddy an. Nur Hinweise – DNS liegt
# außerhalb des Servers und ist kein Grund für einen Rückfall. $1 = Domain, $2 = Testmodus.
# v0.9: auch www.<Domain> (Weiterleitung, sofern im DNS eingetragen) und die Frage, ob jeder
# Hostname über IPv4 UND IPv6 erreichbar ist, wenn der Server beides hat. Probleme erscheinen am
# Ende von Installation und Update noch einmal gesammelt (notice).
address_check() {
  local domain=$1 test_mode=$2 host address resolved problems=0 attempt reloaded=0
  local -a hosts=("$domain") own_addresses ca_opts=() public_v4=() public_v6=()
  local caddyfile=/etc/caddy/Caddyfile
  grep -q "^www\.$domain {" "$caddyfile" 2>/dev/null && hosts+=("www.$domain")
  hosts+=("admin.$domain")
  grep -q "bots.$domain" "$caddyfile" 2>/dev/null && hosts+=("bots.$domain")
  # Nur Zeilen, die wie IPv4- oder IPv6-Adressen aussehen.
  mapfile -t own_addresses < <(server_addresses | grep -E '^[0-9a-fA-F.:]+$' || true)
  if [[ ${#own_addresses[@]} -eq 0 ]]; then
    notice "Die Adressen dieses Servers ließen sich nicht ermitteln („ip -o addr“); die Prüfung von DNS, IPv4 und IPv6 entfällt."
    return 0
  fi
  for address in "${own_addresses[@]}"; do
    is_public_address "$address" || continue
    if [[ $address == *:* ]]; then public_v6+=("$address"); else public_v4+=("$address"); fi
  done
  if [[ $test_mode -eq 1 ]]; then
    local ca=/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
    [[ -f $ca ]] && ca_opts=(--cacert "$ca") || ca_opts=(--insecure)
  elif [[ ! " ${hosts[*]} " == *" www.$domain "* ]]; then
    resolved=$(getent ahosts "www.$domain" | awk '{print $1}' | sort -u || true)
    if [[ -z $resolved ]]; then
      info "www.$domain hat keinen DNS-Eintrag – PostEulen ist nur unter https://$domain erreichbar. Wer auch www möchte: A/AAAA-Eintrag für www.$domain auf diesen Server setzen und danach „sudo $PE_CURRENT/deploy/configure.sh“ ausführen."
    else
      notice "DNS: www.$domain zeigt auf ${resolved//$'\n'/, } – keine Adresse dieses Servers. Deshalb leitet www nicht auf https://$domain weiter. Den A- bzw. AAAA-Eintrag von www korrigieren und danach „sudo $PE_CURRENT/deploy/configure.sh“ ausführen."
    fi
  fi
  probe() {
    local target=$2
    [[ $target == *:* ]] && target="[$target]"
    curl --silent --fail --max-time 10 "${ca_opts[@]}" --resolve "$1:443:$target" "https://$1/api/health" >/dev/null 2>&1
  }
  for host in "${hosts[@]}"; do
    if [[ $test_mode -eq 1 ]]; then
      # Ohne öffentliches DNS: jede eigene Adresse muss den Hostnamen ausliefern.
      resolved=$(printf '%s\n' "${own_addresses[@]}")
    else
      resolved=$(getent ahosts "$host" | awk '{print $1}' | sort -u || true)
      [[ -z $resolved ]] && { notice "DNS: $host hat keinen A/AAAA-Eintrag – über diese Adresse ist PostEulen nicht erreichbar."; problems=1; continue; }
      # v0.9: hat der Server eine öffentliche IPv4- bzw. IPv6-Adresse, soll der Name sie auch nennen.
      if [[ ${#public_v4[@]} -gt 0 ]] && ! grep -qv ':' <<<"$resolved"; then
        notice "DNS: $host hat keinen A-Eintrag (IPv4), obwohl der Server die IPv4-Adresse ${public_v4[0]} hat – Besucher ohne IPv6 erreichen $host nicht. Einen A-Eintrag auf ${public_v4[0]} anlegen."
        problems=1
      fi
      if [[ ${#public_v6[@]} -gt 0 ]] && ! grep -q ':' <<<"$resolved"; then
        notice "DNS: $host hat keinen AAAA-Eintrag (IPv6), obwohl der Server die IPv6-Adresse ${public_v6[0]} hat – über IPv6 ist $host nicht erreichbar. Einen AAAA-Eintrag auf ${public_v6[0]} anlegen (oder die IPv6-Adresse bewusst ungenutzt lassen)."
        problems=1
      fi
    fi
    for address in $resolved; do
      if ! printf '%s\n' "${own_addresses[@]}" | grep -qxF "$address"; then
        notice "DNS: $host zeigt auf $address – das ist keine Adresse dieses Servers. Den A- bzw. AAAA-Eintrag korrigieren oder entfernen; sonst schlagen Zertifikate und Verbindungen über diese Adresse fehl."
        problems=1
        continue
      fi
      for attempt in 1 2 3 4 5 6; do
        probe "$host" "$address" && break
        if [[ $reloaded -eq 0 ]]; then
          # Ein Neuladen lässt Caddy fehlende Zertifikate sofort neu anfordern.
          systemctl reload caddy >/dev/null 2>&1 || true
          reloaded=1
        fi
        sleep 10
      done
      if ! probe "$host" "$address"; then
        notice "https://$host über $address ($([[ $address == *:* ]] && echo IPv6 || echo IPv4)) antwortet nicht mit gültigem Zertifikat. Prüfen: Firewall (Ports 80 und 443 auch für IPv6), DNS-Eintrag, „journalctl -u caddy -n 50“."
        problems=1
      fi
    done
  done
  [[ $problems -eq 0 ]] && ok "Alle Hostnamen (${hosts[*]}) antworten über alle ihre Adressen (IPv4/IPv6) mit gültigem Zertifikat."
  return 0
}

# Neueste Version (Tag) im Repository $1. Nach Semantic Versioning ist eine Vorabversion älter
# als die fertige Version: v0.1.0-stufe.6 < v0.1.0 < v0.2.0-stufe.1. Gits Versionssortierung
# braucht dafür „versionsort.suffix=-“, sonst stünde v0.1.0 vor v0.1.0-stufe.6.
newest_tag() {
  git -C "$1" -c versionsort.suffix=- tag --list 'v*' --sort=-v:refname | head -n1
}

# Prüft die Signatur eines Release-Tags (SPEC 16.3, seit v0.6.1 Standard).
# $1 = Repository, $2 = Tag-Name, $3 = allowed_signers-Datei. Erfolg nur für ein annotiertes,
# gültig signiertes Tag, dessen eingetragener Name zum Ref passt (sonst ließe sich ein altes,
# echt signiertes Tag unter neuem Namen unterschieben). Gibt die Prüfmeldung von git aus.
verify_release_tag() {
  local repo=$1 tag=$2 signers name output
  # Absolut, denn git -C wechselt das Verzeichnis.
  signers=$(readlink -f "$3") && [[ -f $signers ]] || return 1
  git -C "$repo" rev-parse --quiet --verify "refs/tags/$tag" >/dev/null || return 1
  [[ $(git -C "$repo" cat-file -t "refs/tags/$tag") == tag ]] || return 1
  name=$(git -C "$repo" cat-file tag "refs/tags/$tag" | sed -n 's/^tag //p' | head -n1)
  [[ $name == "$tag" ]] || return 1
  output=$(git -C "$repo" -c gpg.format=ssh -c "gpg.ssh.allowedSignersFile=$signers" \
    verify-tag "refs/tags/$tag" 2>&1) || return 1
  grep -m1 '^Good ' <<<"$output" || printf 'gültig\n'
}

# Commit eines Tags oder einer Commit-Angabe; Tags haben Vorrang vor gleichnamigen Branches.
release_commit() {
  local repo=$1 ref=$2
  if git -C "$repo" rev-parse --quiet --verify "refs/tags/$ref" >/dev/null; then
    git -C "$repo" rev-parse --short=12 "refs/tags/$ref^{commit}"
  else
    git -C "$repo" rev-parse --short=12 "$ref^{commit}"
  fi
}

# Versionsnummer eines Release-Verzeichnisses (aus shared/src/version.ts).
release_version() {
  sed -n "s/^export const VERSION = '\(.*\)';$/\1/p" "$1/shared/src/version.ts"
}

# Baut ein Release-Verzeichnis (während der alte Stand weiterläuft, SPEC 16.3).
build_release() {
  local dir=$1
  info "Baue $(release_version "$dir") in $dir …"
  (
    cd "$dir"
    export HOME=/root npm_config_update_notifier=false
    # v0.7: minimal fontconfig configuration – a fresh Debian 13 has none, and the image
    # library printed "Fontconfig error: Cannot load default config file" (harmless).
    if [ -f deploy/fontconfig/fonts.conf ]; then
      export FONTCONFIG_FILE="$PWD/deploy/fontconfig/fonts.conf"
    fi
    npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
    npm run build --silent
    npm prune --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
  ) || return 1
  chmod -R u=rwX,go=rX "$dir"
}
