#!/usr/bin/env bash
# PostEulen – Angaben für „Server der Instanz“ im Adminpanel (v1.4.3, SPEC 13 Punkt 13).
#
#   server-check.sh updates     stündlich (posteulen-check.timer): Laufzeit, wartende Updates von
#                               Debian (apt) und PostEulen, ob Debian einen Neustart verlangt
#   server-check.sh blocklists  täglich (posteulen-blocklists.timer): stehen Domain oder Adressen
#                               des Servers auf großen öffentlichen Blocklisten? Nicht bei Tor-only.
#
# Die Ergebnisse landen als kleine Dateien im Datenverzeichnis (server-info, blocklists), die das
# Backend nur liest. Der Hauptdienst selbst fragt weder apt noch das Netz.
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"

now() { printf '%(%s)T' -1; }

# ── Stündlich: Laufzeit und wartende Updates ────────────────────────────────────────────────
check_updates() {
  # Läuft gerade ein Update (oder der Tor-Helfer), kommt die nächste Stunde dran.
  exec 9>"$PE_UPDATE_LOCK"
  flock -n 9 || exit 0
  local uptime boot apt_ok=0 apt_updates=0 reboot=0 latest='' url
  read -r uptime _ </proc/uptime
  boot=$(($(now) - ${uptime%.*}))
  if timeout 600 apt-get update -qq -o DPkg::Lock::Timeout=120 >/dev/null 2>&1; then
    apt_ok=1
    apt_updates=$(apt-get -s -o Debug::NoLocking=1 full-upgrade 2>/dev/null | grep -c '^Inst ' || true)
  fi
  [[ -f /run/reboot-required ]] && reboot=1
  # Nur die Namen der Versionen (ls-remote, ohne Download); die Signatur prüft erst das Update.
  url=$(repo_url)
  if [[ -n $url ]]; then
    latest=$(timeout 120 git -c versionsort.suffix=- ls-remote --quiet --tags --refs --sort=-v:refname \
      "$url" 'refs/tags/v*' 2>/dev/null | sed -n '1s#^[0-9a-f]*[[:space:]]*refs/tags/##p' || true)
  fi
  printf 'checked_at=%s\nboot_at=%s\napt_ok=%s\napt_updates=%s\nreboot_required=%s\nposteulen_latest=%s\n' \
    "$(now)" "$boot" "$apt_ok" "${apt_updates:-0}" "$reboot" "$latest" | write_state server-info
}

# ── Täglich: öffentliche Blocklisten ──────────────────────────────────────────────────────

# Erste IPv4-Antwort auf einen Namen (leer: gibt es nicht).
dns_answer() {
  timeout 10 getent ahostsv4 "$1" 2>/dev/null | awk 'NR == 1 {print $1}' || true
}

# Antwort einer DNS-Blockliste: listed (127.x), clean (keine Antwort) oder unknown (die Liste
# lehnt die Abfrage ab – oft bei großen öffentlichen Resolvern – oder der Resolver leitet um).
dnsbl_state() {
  local answer
  answer=$(dns_answer "$1")
  case $answer in
    '') printf clean ;;
    127.0.0.1 | 127.255.255.*) printf unknown ;;
    127.*) printf listed ;;
    *) printf unknown ;;
  esac
}

ipv4_reverse() {
  local a b c d
  IFS=. read -r a b c d <<<"$1"
  printf '%s.%s.%s.%s' "$d" "$c" "$b" "$a"
}

# Umgedrehte Halbbytes einer IPv6-Adresse für DNS-Blocklisten (RFC 5782).
ipv6_reverse() {
  local addr=${1,,} left right part hex='' out='' i
  local -a head=() tail=() groups=()
  if [[ $addr == *::* ]]; then
    left=${addr%%::*} right=${addr#*::}
    [[ -n $left ]] && IFS=: read -r -a head <<<"$left"
    [[ -n $right ]] && IFS=: read -r -a tail <<<"$right"
    groups=("${head[@]}")
    for ((i = ${#head[@]} + ${#tail[@]}; i < 8; i++)); do groups+=(0); done
    groups+=("${tail[@]}")
  else
    IFS=: read -r -a groups <<<"$addr"
  fi
  ((${#groups[@]} == 8)) || return 1
  for part in "${groups[@]}"; do
    [[ $part =~ ^[0-9a-f]{1,4}$ ]] || return 1
    printf -v part '%04x' "0x$part"
    hex+=$part
  done
  for ((i = 31; i >= 0; i--)); do out+="${hex:i:1}."; done
  printf '%s' "${out%.}"
}

# Eine Domain und ihre übergeordneten Domains (ohne die Endung allein): a.b.de → a.b.de b.de
domain_and_parents() {
  local name=$1
  while [[ $name == *.*.* ]]; do
    printf '%s\n' "$name"
    name=${name#*.}
  done
  printf '%s\n' "$name"
}

results=''
listed=()
result() { results+="result $1 $2 $3"$'\n'; [[ $3 == listed ]] && listed+=("$1 $2"); return 0; }

# Name und Webseite einer Liste für das Fehlerprotokoll.
list_label() {
  case $1 in
    zen.spamhaus.org) printf 'Spamhaus ZEN (check.spamhaus.org)' ;;
    dbl.spamhaus.org) printf 'Spamhaus DBL (check.spamhaus.org)' ;;
    bl.spamcop.net) printf 'SpamCop (www.spamcop.net)' ;;
    dnsbl-1.uceprotect.net) printf 'UCEPROTECT Level 1 (www.uceprotect.net)' ;;
    psbl.surriel.com) printf 'PSBL (psbl.org)' ;;
    bl.mailspike.net) printf 'Mailspike (mailspike.org)' ;;
    multi.surbl.org) printf 'SURBL (surbl.org)' ;;
    multi.uribl.com) printf 'URIBL (uribl.com)' ;;
    stevenblack) printf 'StevenBlack Hosts (github.com/StevenBlack/hosts)' ;;
    hagezi-pro) printf 'HaGeZi Pro (github.com/hagezi/dns-blocklists)' ;;
    oisd-big) printf 'OISD big (oisd.nl)' ;;
    *) printf '%s' "$1" ;;
  esac
}

# Adressen gegen eine DNS-Blockliste. $1 = Liste, $2 = nur IPv4 (1) oder auch IPv6 (0), Rest = Adressen.
check_ip_list() {
  local list=$1 v4_only=$2 address name state
  shift 2
  # Prüfpunkt 127.0.0.2 steht auf jeder dieser Listen – sonst ist sie von hier aus nicht nutzbar.
  if [[ $(dnsbl_state "2.0.0.127.$list") != listed ]]; then
    for address in "$@"; do result "$list" "$address" unknown; done
    return 0
  fi
  for address in "$@"; do
    if [[ $address == *:* ]]; then
      [[ $v4_only == 1 ]] && continue
      name=$(ipv6_reverse "$address") || continue
    else
      name=$(ipv4_reverse "$address")
    fi
    state=$(dnsbl_state "$name.$list")
    result "$list" "$address" "$state"
  done
}

# Domain gegen eine DNS-Blockliste für Domains. $1 = Liste, $2 = Prüfname, Rest = Domains.
check_domain_list() {
  local list=$1 test_name=$2 name
  shift 2
  if [[ $(dnsbl_state "$test_name.$list") != listed ]]; then
    for name in "$@"; do result "$list" "$name" unknown; done
    return 0
  fi
  for name in "$@"; do result "$list" "$name" "$(dnsbl_state "$name.$list")"; done
}

# Domain gegen eine herunterladbare Werbe-/Tracking-Liste. $1 = Liste, $2 = Adresse,
# $3 = Format (hosts: „0.0.0.0 name“, domains: ein Name je Zeile), $4 = Domain, Rest = Namen.
check_download_list() {
  local list=$1 url=$2 format=$3 domain=$4 file names found=0 name
  shift 4
  file=$(mktemp -d "${TMPDIR:-/tmp}/blocklist.XXXXXX")
  if ! curl -fsS --max-time 300 --max-filesize 104857600 -o "$file/raw" "$url" 2>/dev/null; then
    rm -rf "$file"
    result "$list" "$domain" unknown
    return 0
  fi
  if [[ $format == hosts ]]; then
    awk '$1 == "0.0.0.0" || $1 == "127.0.0.1" {print tolower($2)}' "$file/raw" >"$file/names"
  else
    awk '!/^[[:space:]]*[#!]/ && NF {n = tolower($1); sub(/^\*\./, "", n); sub(/^\|\|/, "", n); sub(/\^.*$/, "", n); print n}' \
      "$file/raw" >"$file/names"
  fi
  rm -f "$file/raw"
  names=$(wc -l <"$file/names")
  if ((names < 1000)); then
    rm -rf "$file"
    result "$list" "$domain" unknown
    return 0
  fi
  for name in "$@"; do
    if grep -qxF "$name" "$file/names"; then
      result "$list" "$name" listed
      found=1
    fi
  done
  ((found == 1)) || result "$list" "$domain" clean
  rm -rf "$file"
}

check_blocklists() {
  local domain address entry list target
  local -a addresses=() domains=() hosts=()
  if tor_only; then
    printf 'checked_at=%s\ntor_only=1\n' "$(now)" | write_state blocklists
    return 0
  fi
  domain=$(conf_get POSTEULEN_DOMAIN)
  valid_domain "$domain" || die "Keine gültige Domain in $PE_CONF."
  for address in $(server_addresses | grep -E '^[0-9a-fA-F.:]+$' || true); do
    is_public_address "$address" && addresses+=("$address")
  done
  mapfile -t domains < <(domain_and_parents "$domain")
  hosts=("$domain" "www.$domain" "admin.$domain" "bots.$domain" "${domains[@]:1}")

  check_ip_list zen.spamhaus.org 0 "${addresses[@]}"
  check_ip_list bl.spamcop.net 1 "${addresses[@]}"
  check_ip_list dnsbl-1.uceprotect.net 1 "${addresses[@]}"
  check_ip_list psbl.surriel.com 1 "${addresses[@]}"
  check_ip_list bl.mailspike.net 1 "${addresses[@]}"
  check_domain_list dbl.spamhaus.org dbltest.com "${domains[@]}"
  check_domain_list multi.surbl.org test.surbl.org "${domains[@]}"
  check_domain_list multi.uribl.com test.uribl.com "${domains[@]}"
  check_download_list stevenblack https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts hosts "$domain" "${hosts[@]}"
  check_download_list hagezi-pro https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/pro-onlydomains.txt domains "$domain" "${hosts[@]}"
  check_download_list oisd-big https://big.oisd.nl/domainswild2 domains "$domain" "${hosts[@]}"

  printf 'checked_at=%s\n%s' "$(now)" "$results" | write_state blocklists
  for entry in "${listed[@]}"; do
    list=${entry%% *} target=${entry#* }
    ops_report Blocklisten warning "$target steht auf der Blockliste $(list_label "$list")." \
      "Tägliche Prüfung der öffentlichen Blocklisten für Spam, Werbung und Tracking." \
      "Auf der Seite der Liste nachsehen, warum, und die Löschung beantragen. Solange der Eintrag besteht, können manche Netze, Mailfilter oder Werbeblocker die Instanz sperren."
  done
}

# Nur beim Aufruf, nicht beim Einlesen (die Tests lesen die Funktionen ein).
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  require_root
  cd /
  case ${1:-} in
    updates) check_updates ;;
    blocklists) check_blocklists ;;
    *) die "Aufruf: server-check.sh <updates|blocklists>" ;;
  esac
fi
