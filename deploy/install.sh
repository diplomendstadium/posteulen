#!/usr/bin/env bash
# PostEulen – Installation auf einem frischen Debian 13 mit einem Befehl (SPEC 16.2).
#
#   git clone <Repository> posteulen && sudo ./posteulen/deploy/install.sh
#
# Parameter (alle Rückfragen lassen sich so beantworten):
#   --domain <domain>          z. B. posteulen.de (admin.<domain> wird automatisch genutzt)
#   --repo <url>               Quelle für Updates (Standard: Herkunft dieses Klons)
#   --ref <tag|commit>         zu installierende Version (Standard: neuestes Tag)
#   --admin-allowlist <ips>    kommagetrennte IP-Bereiche, die das Adminpanel sehen dürfen
#   --backup-pubkey <age1…>    eigener öffentlicher age-Schlüssel für Backups (empfohlen)
#   --ssh-hardening ja|nein    SSH nur noch mit Schlüssel (nur wenn ein Schlüssel hinterlegt ist)
#   --swap ja|nein             Swap-Datei anlegen, falls der RAM knapp ist
#   --test-mode                lokale Zertifikate (Caddy „tls internal“), keine DNS-Prüfung
#   --yes                      keine Rückfragen, Vorgaben verwenden
#
# Das Skript ist idempotent: Ein erneuter Lauf repariert oder ergänzt, überschreibt aber nie
# Geheimnis-Datei, Datenbank, Backups oder lokale Anpassungen.
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
SOURCE_CLONE=$(cd "$SELF_DIR/.." && pwd)

domain='' repo='' ref='' allowlist='' backup_pubkey='' ssh_hardening='' swap='' test_mode=0
PE_ASSUME_YES=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) domain=${2:-}; shift 2 ;;
    --repo) repo=${2:-}; shift 2 ;;
    --ref) ref=${2:-}; shift 2 ;;
    --admin-allowlist) allowlist=${2:-}; shift 2 ;;
    --backup-pubkey) backup_pubkey=${2:-}; shift 2 ;;
    --ssh-hardening) ssh_hardening=${2:-}; shift 2 ;;
    --swap) swap=${2:-}; shift 2 ;;
    --test-mode) test_mode=1; shift ;;
    --yes) PE_ASSUME_YES=1; shift ;;
    -h | --help) sed -n '2,22p' "$0"; exit 0 ;;
    *) die "Unbekannter Parameter: $1" "Hilfe mit „$0 --help“." ;;
  esac
done
export PE_ASSUME_YES
for value in "$ssh_hardening" "$swap"; do
  [[ -z $value || $value == ja || $value == nein ]] || die "Erlaubt sind „ja“ oder „nein“, nicht „$value“."
done

# ───────────────────────── 1. Prüfungen ─────────────────────────
info "Prüfe das System …"
require_root
# shellcheck source=/dev/null
. /etc/os-release
[[ ${ID:-} == debian && ${VERSION_ID:-} == 13 ]] || die "PostEulen braucht Debian 13 (gefunden: ${PRETTY_NAME:-unbekannt})." "Einen frischen Debian-13-Server verwenden."
arch=$(dpkg --print-architecture)
[[ $arch == amd64 || $arch == arm64 ]] || die "Architektur $arch wird nicht unterstützt." "Einen Server mit amd64 oder arm64 verwenden."
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
disk_mb=$(df --output=avail -m / | tail -1 | tr -d ' ')
((mem_mb >= 900)) || die "Zu wenig Arbeitsspeicher (${mem_mb} MB, mindestens 1 GB)." "Einen größeren Server wählen."
((disk_mb >= 4000)) || die "Zu wenig freier Speicher (${disk_mb} MB, mindestens 4 GB)." "Speicher freigeben oder vergrößern."
for port in 80 443; do
  if ss -Hltn "sport = :$port" | grep -q . && ! ss -Hltnp "sport = :$port" | grep -q caddy; then
    die "Port $port ist bereits belegt." "Den anderen Webserver beenden (z. B. „systemctl disable --now apache2 nginx“)."
  fi
done
ok "Debian 13 ($arch), ${mem_mb} MB RAM, ${disk_mb} MB frei."

# ───────────────────────── 2. Angaben ─────────────────────────
existing_domain=$(conf_get POSTEULEN_DOMAIN)
if [[ -n $existing_domain ]]; then
  [[ -z $domain || $domain == "$existing_domain" ]] || die "Diese Installation läuft bereits unter $existing_domain." "Ein Domainwechsel ist in v0.1 nicht vorgesehen."
  domain=$existing_domain
  existing_test_mode=$(conf_get POSTEULEN_TEST_MODE)
  [[ $existing_test_mode == 1 ]] && test_mode=1
fi
if [[ -z $domain ]]; then
  [[ $PE_ASSUME_YES -eq 0 && -t 0 ]] || die "Keine Domain angegeben." "Mit „--domain beispiel.de“ aufrufen."
  read -r -p "Unter welcher Domain soll PostEulen laufen (z. B. posteulen.de)? " domain
fi
domain=${domain,,}
valid_domain "$domain" || die "„$domain“ ist keine gültige Domain."
if [[ -z $repo ]]; then
  repo=$(conf_get POSTEULEN_REPO)
  [[ -n $repo ]] || repo=$(git -C "$SOURCE_CLONE" remote get-url origin 2>/dev/null || true)
  [[ -n $repo ]] || repo=$SOURCE_CLONE
fi
if [[ -n $backup_pubkey && ! $backup_pubkey =~ ^age1[02-9ac-hj-np-z]{58}$ ]]; then
  die "„$backup_pubkey“ ist kein öffentlicher age-Schlüssel." "Er beginnt mit „age1“ und hat 62 Zeichen."
fi

if [[ $test_mode -eq 0 ]]; then
  addresses=$(ip -o addr show scope global | awk '{print $4}' | cut -d/ -f1)
  for host in "$domain" "admin.$domain"; do
    resolved=$(getent ahosts "$host" | awk '{print $1}' | sort -u || true)
    match=0
    for address in $resolved; do grep -qxF "$address" <<<"$addresses" && match=1; done
    [[ $match -eq 1 ]] || warn "DNS: $host zeigt nicht auf diesen Server (${resolved:-kein Eintrag}). HTTPS-Zertifikate klappen erst, wenn A/AAAA-Einträge stimmen."
  done
fi

# ───────────────────────── 3. Pakete und Grundabsicherung ─────────────────────────
add_key() {
  local url=$1 fpr=$2 keyring=$3 tmp
  tmp=$(mktemp)
  curl --silent --show-error --fail --proto '=https' --tlsv1.2 --max-time 30 "$url" -o "$tmp" || die "Schlüssel $url nicht ladbar." "Netzwerk prüfen und erneut versuchen."
  if ! gpg --show-keys --with-colons "$tmp" 2>/dev/null | awk -F: '/^fpr/ {print $10}' | grep -qx "$fpr"; then
    rm -f "$tmp"
    die "Der Schlüssel von $url hat nicht den erwarteten Fingerabdruck $fpr." "Nicht fortfahren und den Hinweis an die Entwickler melden."
  fi
  gpg --dearmor --yes --output "$keyring.new" "$tmp"
  rm -f "$tmp"
  chmod 0644 "$keyring.new"
  mv "$keyring.new" "$keyring"
}

info "Installiere Pakete …"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git age ufw unattended-upgrades needrestart iproute2 >/dev/null
add_key "$NODESOURCE_KEY_URL" "$NODESOURCE_KEY_FPR" /usr/share/keyrings/nodesource.gpg
add_key "$CADDY_KEY_URL" "$CADDY_KEY_FPR" /usr/share/keyrings/caddy-stable.gpg
cat >/etc/apt/sources.list.d/nodesource.sources <<SRC
Types: deb
URIs: https://deb.nodesource.com/node_${PE_NODE_MAJOR}.x
Suites: nodistro
Components: main
Signed-By: /usr/share/keyrings/nodesource.gpg
SRC
cat >/etc/apt/preferences.d/nodesource <<'PIN'
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
PIN
cat >/etc/apt/sources.list.d/caddy-stable.sources <<'SRC'
Types: deb
URIs: https://dl.cloudsmith.io/public/caddy/stable/deb/debian
Suites: any-version
Components: main
Signed-By: /usr/share/keyrings/caddy-stable.gpg
SRC
apt-get update -qq
apt-get install -y -qq nodejs caddy >/dev/null
node_major=$(node --version | sed -E 's/^v([0-9]+).*/\1/')
[[ $node_major == "$PE_NODE_MAJOR" ]] || die "Node.js $node_major statt $PE_NODE_MAJOR installiert." "„apt-cache policy nodejs“ prüfen."
ok "Node.js $(node --version), Caddy $(caddy version | cut -d' ' -f1), age, git installiert."

# Automatische Sicherheitsupdates, auch für Node.js und Caddy, mit Neustart betroffener Dienste.
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
cat >/etc/apt/apt.conf.d/52posteulen-unattended-upgrades <<'APT'
// Von PostEulen ergänzt: Updates auch aus den Quellen von Node.js und Caddy.
Unattended-Upgrade::Origins-Pattern {
        "origin=. nodistro,codename=nodistro";
        "origin=cloudsmith/caddy/stable";
};
APT
install -d /etc/needrestart/conf.d
printf "# Von PostEulen: betroffene Dienste nach Updates automatisch neu starten.\n\$nrconf{restart} = 'a';\n" >/etc/needrestart/conf.d/posteulen.conf
ok "Automatische Sicherheitsupdates eingerichtet."

# Firewall: nur SSH, HTTP, HTTPS (inkl. HTTP/3).
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
ok "Firewall aktiv: 22/tcp, 80/tcp, 443/tcp, 443/udp."

# SSH nur mit Schlüssel – nur nach Rückfrage und wenn ein Schlüssel hinterlegt ist.
login_user=${SUDO_USER:-root}
login_home=$(getent passwd "$login_user" | cut -d: -f6)
sshd_conf=/etc/ssh/sshd_config.d/50-posteulen.conf
if [[ -f $sshd_conf ]]; then
  ok "SSH ist bereits auf Schlüssel-Anmeldung umgestellt."
elif [[ -s $login_home/.ssh/authorized_keys ]]; then
  if ask_yes_no "SSH-Anmeldung per Passwort abschalten (nur noch mit Schlüssel)?" ja "$ssh_hardening"; then
    printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' >"$sshd_conf"
    if sshd -t; then
      systemctl reload ssh
      ok "SSH nur noch mit Schlüssel."
    else
      rm -f "$sshd_conf"
      warn "SSH-Konfiguration ungültig – Änderung zurückgenommen."
    fi
  fi
else
  warn "Für $login_user ist kein SSH-Schlüssel hinterlegt – SSH-Härtung übersprungen (Schutz vor Aussperren)."
fi

# Swap, falls der RAM für den Build knapp ist (SPEC 16.1).
if ((mem_mb < 1800 && swap_mb < 1000)) && [[ ! -e /swapfile ]]; then
  if ask_yes_no "Wenig Arbeitsspeicher (${mem_mb} MB). Swap-Datei (2 GB) für den Build anlegen?" ja "$swap"; then
    fallocate -l 2G /swapfile
    chmod 0600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    ok "Swap-Datei angelegt."
  fi
fi

# ───────────────────────── 4. Benutzer, Verzeichnisse, Release ─────────────────────────
info "Richte PostEulen ein …"
id -u "$PE_USER" >/dev/null 2>&1 || useradd --system --home-dir "$PE_DATA" --shell /usr/sbin/nologin --user-group "$PE_USER"
install -d -m 0755 "$PE_OPT" "$PE_RELEASES" "$PE_STATE"
install -d -m 0700 -o "$PE_USER" -g "$PE_USER" "$PE_DATA"
install -d -m 0750 -o root -g "$PE_USER" "$PE_ETC"
install -d -m 0700 "$PE_BACKUPS"
if [[ ! -f $PE_CONF ]]; then
  umask 027
  printf 'POSTEULEN_DOMAIN=%s\nPOSTEULEN_REPO=%s\nPOSTEULEN_TEST_MODE=%s\n' "$domain" "$repo" "$test_mode" >"$PE_CONF"
  umask 022
fi

if [[ ! -d $PE_REPO ]]; then
  git clone --quiet --bare --filter=blob:none "$repo" "$PE_REPO" || die "Repository $repo nicht erreichbar." "Adresse und Zugang (z. B. Deploy-Key) prüfen."
fi
git -C "$PE_REPO" fetch --quiet --force --tags origin '+refs/heads/*:refs/heads/*' || warn "Konnte keine neuen Versionen holen – nutze den vorhandenen Stand."

if [[ -L $PE_CURRENT ]]; then
  release=$(readlink -f "$PE_CURRENT")
  if [[ -n $ref ]]; then
    wanted=$(git -C "$PE_REPO" rev-parse --short=12 "$ref^{commit}" 2>/dev/null || true)
    [[ $release == *"-$wanted" ]] || die "Hier ist bereits $(release_version "$release") installiert." "Für andere Versionen „sudo posteulen-update <Version>“ verwenden."
  fi
  ok "Vorhandenes Release bleibt: $release"
else
  if [[ -z $ref ]]; then
    ref=$(git -C "$PE_REPO" tag --list 'v*' --sort=-v:refname | head -n1)
    [[ -n $ref ]] || die "Im Repository gibt es noch keine Version (Tag)." "Mit „--ref <Commit>“ eine Version angeben."
  fi
  commit=$(git -C "$PE_REPO" rev-parse --short=12 "$ref^{commit}" 2>/dev/null) || die "Version „$ref“ nicht gefunden."
  release="$PE_RELEASES/$(tr -c 'A-Za-z0-9._-' '_' <<<"$ref" | sed 's/_$//')-$commit"
  rm -rf "$release"
  mkdir -p "$release"
  git -C "$PE_REPO" archive --format=tar "$commit" | tar -x -C "$release"
  build_release "$release" || die "Der Build ist fehlgeschlagen." "Ausgabe oben lesen; bei Speichermangel mit „--swap ja“ erneut versuchen."
fi

# Geheimnisse (nur anlegen, nie überschreiben, SPEC 4.4).
secrets_created=0
if [[ ! -f $PE_SECRETS ]]; then
  POSTEULEN_SECRETS_FILE=$PE_SECRETS node "$release/backend/src/cli.ts" setup
  secrets_created=1
fi
chgrp "$PE_USER" "$PE_SECRETS"
chmod 0640 "$PE_SECRETS"

# Backup-Schlüssel (D-Teil C, F-05).
backup_private_file=''
if [[ ! -f $PE_BACKUP_PUB ]]; then
  if [[ -n $backup_pubkey ]]; then
    printf '%s\n' "$backup_pubkey" >"$PE_BACKUP_PUB"
  else
    backup_private_file=/root/posteulen-backup-schluessel.txt
    [[ -e $backup_private_file ]] && die "$backup_private_file existiert, aber $PE_BACKUP_PUB fehlt." "Den öffentlichen Schlüssel aus der Datei (Zeile „public key“) nach $PE_BACKUP_PUB schreiben."
    (umask 077 && age-keygen -o "$backup_private_file" 2>/dev/null)
    age-keygen -y "$backup_private_file" >"$PE_BACKUP_PUB"
  fi
  chmod 0644 "$PE_BACKUP_PUB"
fi
[[ -f /root/posteulen-backup-schluessel.txt ]] && backup_private_file=/root/posteulen-backup-schluessel.txt

# Admin-Freigabeliste (lokale Anpassung, nur anlegen).
install -d -m 0755 "$PE_LOCAL"
if [[ -n $allowlist && ! -e $PE_LOCAL/admin-allowlist.caddy ]]; then
  ranges=${allowlist//,/ }
  for range in $ranges; do
    [[ $range =~ ^[0-9a-fA-F:.]+(/[0-9]{1,3})?$ ]] || die "„$range“ ist kein IP-Bereich."
  done
  printf '# Nur diese IP-Bereiche dürfen das Adminpanel sehen.\n@nicht_erlaubt not remote_ip %s\nrespond @nicht_erlaubt 403\n' "$ranges" >"$PE_LOCAL/admin-allowlist.caddy"
fi

# Datenbank-Migrationen als Dienstbenutzer.
printf 'POSTEULEN_DOMAIN=%s\n' "$domain" >"$PE_SERVICE_ENV"
chmod 0644 "$PE_SERVICE_ENV"
as_service node "$release/backend/src/cli.ts" migrate

switch_symlink "$release" "$PE_CURRENT"
"$PE_CURRENT/deploy/configure.sh"

# ───────────────────────── 5. Start und Prüfung ─────────────────────────
systemctl enable --quiet posteulen.service posteulen-backup.timer
systemctl restart posteulen.service
systemctl start posteulen-backup.timer
health_check "$domain" "$test_mode" || die "Die Funktionsprüfung ist fehlgeschlagen." "„journalctl -u posteulen -u caddy -n 100“ ansehen."

# ───────────────────────── 6. Zusammenfassung ─────────────────────────
version=$(release_version "$(readlink -f "$PE_CURRENT")")
printf '\n%s\n' "${PE_GREEN}${PE_BOLD}PostEulen $version läuft.${PE_RESET}"
printf '  Website:      https://%s\n  Verwaltung:   https://admin.%s\n  Updates:      sudo posteulen-update\n' "$domain" "$domain"
messages=(
  "WICHTIG: Jetzt die Geheimnis-Datei außerhalb des Servers sichern:"
  "  $PE_SECRETS"
  "Ohne diese Datei kann sich nach einem Serverausfall NIEMAND mehr anmelden."
)
if [[ -n $backup_private_file ]]; then
  messages+=(
    ""
    "Privater Backup-Schlüssel: $backup_private_file"
    "Bitte außerhalb des Servers sichern und danach hier löschen. Ohne ihn lassen sich"
    "die verschlüsselten Backups nicht wiederherstellen."
  )
fi
[[ $secrets_created -eq 1 ]] || messages+=("" "(Die Geheimnis-Datei war schon vorhanden und ist unverändert.)")
banner "${messages[@]}"
