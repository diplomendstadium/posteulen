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
  # v0.8: das Bots-Kontrollzentrum (bots.<domain>). Fehlt dort noch der DNS-Eintrag, gibt es
  # kein Zertifikat – das ist kein Grund für einen Rückfall, nur ein Hinweis.
  if ! curl "${curl_opts[@]}" "https://bots.$domain/api/health" >/dev/null 2>&1; then
    warn "https://bots.$domain antwortet (noch) nicht. Für das Bots-Kontrollzentrum braucht bots.$domain einen DNS-Eintrag (A/AAAA) auf diesen Server."
  fi
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
