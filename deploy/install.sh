#!/usr/bin/env bash
# PostEulen – Installation auf einem frischen Debian 13 mit einem Befehl (SPEC 16.2).
#
#   git clone --depth=1 --filter=blob:none --sparse <Repository> posteulen
#   git -C posteulen sparse-checkout set deploy && sudo ./posteulen/deploy/install.sh
#
# Für den Start genügt dieser kleine Klon mit den Deployment-Dateien (v1.4.1); die zu
# installierende Version lädt das Skript selbst – flach, nur sie – und behält kein Repository.
#
# Parameter (alle Rückfragen lassen sich so beantworten):
#   --domain <domain>          z. B. posteulen.de (admin.<domain> wird automatisch genutzt)
#   --repo <url>               Quelle für Updates (Standard: Herkunft dieses Klons)
#   --ref <tag|commit>         zu installierende Version (Standard: neuestes Tag; ein Commit mit
#                              vollständiger Kennung aus 40 Zeichen)
#   --admin-allowlist <ips>    kommagetrennte IP-Bereiche, die das Adminpanel sehen dürfen
#   --backup-pubkey <age1…>    eigener öffentlicher age-Schlüssel für Backups (empfohlen)
#   --ssh-hardening ja|nein    SSH nur noch mit Schlüssel (nur wenn ein Schlüssel hinterlegt ist)
#   --swap ja|nein             Swap-Datei anlegen, falls der RAM knapp ist
#   --test-mode                lokale Zertifikate (Caddy „tls internal“), keine DNS-Prüfung
#   --tor-only                 nur im Tor-Netz: keine Domain, keine Zertifikate, keine offenen Ports
#                              außer SSH – die App, das Adminpanel und das Bots-Kontrollzentrum
#                              nur unter ihren Onion-Adressen, ohne Benachrichtigungen (v1.4.2)
#   --no-verify-tags           Tag-Signatur NICHT prüfen (nur bewusst, z. B. für eigene Builds)
#   --yes                      keine Rückfragen, Vorgaben verwenden
#
# Seit v0.6.1 wird nur eine Version mit gültig signiertem Tag installiert (Prüfung gegen
# deploy/allowed_signers dieses Klons); der Fingerabdruck des Schlüssels wird angezeigt.
#
# Das Skript ist idempotent: Ein erneuter Lauf repariert oder ergänzt, überschreibt aber nie
# Geheimnis-Datei, Datenbank, Backups oder lokale Anpassungen.
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
SOURCE_CLONE=$(cd "$SELF_DIR/.." && pwd)

domain='' repo='' ref='' allowlist='' backup_pubkey='' ssh_hardening='' swap='' test_mode=0
verify=1 tor_only=0
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
    --tor-only) tor_only=1; shift ;;
    --no-verify-tags) verify=0; shift ;;
    --yes) PE_ASSUME_YES=1; shift ;;
    -h | --help) sed -n '2,30p' "$0"; exit 0 ;;
    *) die "Unbekannter Parameter: $1" "Hilfe mit „$0 --help“." ;;
  esac
done
export PE_ASSUME_YES
for value in "$ssh_hardening" "$swap"; do
  [[ -z $value || $value == ja || $value == nein ]] || die "Erlaubt sind „ja“ oder „nein“, nicht „$value“."
done

# ───────────────────────── 1. Prüfungen ─────────────────────────
# v1.4.3: Fortschritt in zehn Schritten (SPEC 16.1).
progress_init 10
step "Prüfe, ob dieser Server passt (Debian 13, Speicher, Ports) …"
require_root
# v0.9: nicht gleichzeitig mit einem Update oder dem Tor-Schalter (tor.sh apply wartet darauf).
exec 9>/run/posteulen-update.lock
flock -n 9 || die "Es läuft bereits eine Installation oder ein Update." "Warten, bis es fertig ist."
rm -f "$PE_NOTICES"
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
# v1.4.2: Eine bestehende Installation bleibt, was sie ist: mit Domain oder nur im Tor-Netz.
existing_domain=$(conf_get POSTEULEN_DOMAIN)
if [[ $(conf_get POSTEULEN_TOR_ONLY) == 1 ]]; then
  [[ -z $domain ]] || die "Diese Installation läuft nur im Tor-Netz." "Eine Umstellung auf eine Domain ist nicht vorgesehen: neu installieren und ein Backup einspielen (README.md)."
  tor_only=1
elif [[ -n $existing_domain && $tor_only -eq 1 ]]; then
  die "Diese Installation läuft bereits unter $existing_domain." "„--tor-only“ gilt nur für neue Installationen."
fi
if [[ $tor_only -eq 1 ]]; then
  [[ -z $domain ]] || die "„--tor-only“ und „--domain“ schließen sich aus." "Entweder eine Domain oder nur das Tor-Netz."
  [[ $test_mode -eq 0 ]] || warn "„--test-mode“ hat mit „--tor-only“ keine Wirkung (es gibt keine Zertifikate)."
  if [[ -n $allowlist ]]; then
    warn "„--admin-allowlist“ hat mit „--tor-only“ keine Wirkung (über Tor gibt es keine IP-Adressen)."
    allowlist=''
  fi
  test_mode=0
else
  for port in 80 443; do
    if ss -Hltn "sport = :$port" | grep -q . && ! ss -Hltnp "sport = :$port" | grep -q caddy; then
      die "Port $port ist bereits belegt." "Den anderen Webserver beenden (z. B. „systemctl disable --now apache2 nginx“)."
    fi
  done
fi
ok "Debian 13 ($arch), ${mem_mb} MB RAM, ${disk_mb} MB frei."
# v1.4.2: Die Datenbank lässt immer 3 GB frei (Adminpanel, SPEC 13) – bei wenig Platz ein Hinweis.
((disk_mb >= 6000)) || notice "Nur ${disk_mb} MB frei: Ab 4 GB freiem Speicher warnt das Fehlerprotokoll, ab 3 GB können Spieler keine Briefe mehr schreiben (Werte im Adminpanel änderbar)."

# ───────────────────────── 2. Angaben ─────────────────────────
step "Angaben zur Instanz (Domain, Quelle der Updates) …"
if [[ -n $existing_domain ]]; then
  [[ -z $domain || $domain == "$existing_domain" ]] || die "Diese Installation läuft bereits unter $existing_domain." "Ein Domainwechsel ist in v0.1 nicht vorgesehen."
  domain=$existing_domain
  existing_test_mode=$(conf_get POSTEULEN_TEST_MODE)
  [[ $existing_test_mode == 1 ]] && test_mode=1
fi
if [[ -z $domain && $tor_only -eq 0 ]]; then
  [[ $PE_ASSUME_YES -eq 0 && -t 0 ]] || die "Keine Domain angegeben." "Mit „--domain beispiel.de“ aufrufen (oder „--tor-only“ für eine Instanz nur im Tor-Netz)."
  read -r -p "Unter welcher Domain soll PostEulen laufen (z. B. posteulen.de)? " domain
fi
domain=${domain,,}
[[ $tor_only -eq 1 ]] || valid_domain "$domain" || die "„$domain“ ist keine gültige Domain."
if [[ -z $repo ]]; then
  repo=$(conf_get POSTEULEN_REPO)
  [[ -n $repo ]] || repo=$(git -C "$SOURCE_CLONE" remote get-url origin 2>/dev/null || true)
  [[ -n $repo ]] || repo=$SOURCE_CLONE
fi
if [[ -n $backup_pubkey && ! $backup_pubkey =~ ^age1[02-9ac-hj-np-z]{58}$ ]]; then
  die "„$backup_pubkey“ ist kein öffentlicher age-Schlüssel." "Er beginnt mit „age1“ und hat 62 Zeichen."
fi

if [[ $test_mode -eq 0 && $tor_only -eq 0 ]]; then
  addresses=$(ip -o addr show scope global | awk '{print $4}' | cut -d/ -f1)
  for host in "$domain" "admin.$domain" "bots.$domain"; do
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

step "Installiere die nötigen Programme (Node.js, Caddy, git, age …) – das dauert ein paar Minuten."
export DEBIAN_FRONTEND=noninteractive
busy 'Lade die Paketlisten von Debian' apt-get update -qq
busy 'Installiere Grundpakete' apt-get install -y -qq ca-certificates curl gnupg git openssh-client age ufw unattended-upgrades needrestart iproute2
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
busy 'Lade die Paketlisten von Node.js und Caddy' apt-get update -qq
busy 'Installiere Node.js und Caddy' apt-get install -y -qq nodejs caddy
node_major=$(node --version | sed -E 's/^v([0-9]+).*/\1/')
[[ $node_major == "$PE_NODE_MAJOR" ]] || die "Node.js $node_major statt $PE_NODE_MAJOR installiert." "„apt-cache policy nodejs“ prüfen."
ok "Node.js $(node --version), Caddy $(caddy version | cut -d' ' -f1), age, git installiert."

# Automatische Sicherheitsupdates, auch für Node.js und Caddy, mit Neustart betroffener Dienste.
step "Sichere den Server ab (Sicherheitsupdates, Firewall, SSH) …"
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

# Firewall: nur SSH, HTTP, HTTPS (inkl. HTTP/3). v1.4.2: Tor-only nur SSH – Tor verbindet sich
# selbst nach außen, die Onion-Seiten brauchen keinen offenen Port.
ufw allow 22/tcp >/dev/null
if [[ $tor_only -eq 0 ]]; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
fi
ufw --force enable >/dev/null
if [[ $tor_only -eq 1 ]]; then ok "Firewall aktiv: nur 22/tcp (SSH)."; else ok "Firewall aktiv: 22/tcp, 80/tcp, 443/tcp, 443/udp."; fi

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
step "Lade und baue PostEulen – auf schwachen Servern dauert das bis zu 30 Minuten."
info "Richte PostEulen ein …"
id -u "$PE_USER" >/dev/null 2>&1 || useradd --system --home-dir "$PE_DATA" --shell /usr/sbin/nologin --user-group "$PE_USER"
install -d -m 0755 "$PE_OPT" "$PE_RELEASES" "$PE_STATE"
install -d -m 0700 -o "$PE_USER" -g "$PE_USER" "$PE_DATA"
install -d -m 0750 -o root -g "$PE_USER" "$PE_ETC"
install -d -m 0700 "$PE_BACKUPS"
if [[ ! -f $PE_CONF ]]; then
  umask 027
  printf 'POSTEULEN_DOMAIN=%s\nPOSTEULEN_REPO=%s\nPOSTEULEN_TEST_MODE=%s\nPOSTEULEN_TOR_ONLY=%s\n' "$domain" "$repo" "$test_mode" "$tor_only" >"$PE_CONF"
  umask 022
fi

# v1.4.1: Kein dauerhaftes Repository mehr. Die Version kommt flach (nur ihr Stand) in ein
# vorübergehendes Repository unter staging/, wird ins Staging ausgepackt, dort gebaut und erst
# fertig und verkleinert zum Release. Repository und Staging verschwinden danach in jedem Fall.
[[ $repo == /* ]] && repo="file://$repo"
clean_staging
staging=''
fetch_repo=''
install_cleanup() {
  [[ -n $fetch_repo ]] && rm -rf "$fetch_repo"
  [[ -n $staging ]] && rm -rf "$staging"
  rm -rf "$PE_NPM_CACHE"
  return 0
}
trap install_cleanup EXIT
fetch_repo=$(temp_repo "$repo")

if [[ -L $PE_CURRENT ]]; then
  release=$(readlink -f "$PE_CURRENT")
  if [[ -n $ref ]]; then
    wanted=$(remote_commit "$fetch_repo" "$ref")
    [[ -n $wanted && $release == *"-$wanted" ]] || die "Hier ist bereits $(release_version "$release") installiert." "Für andere Versionen „sudo posteulen-update <Version>“ verwenden."
  fi
  ok "Vorhandenes Release bleibt: $release"
else
  if [[ -z $ref ]]; then
    ref=$(newest_remote_tag "$fetch_repo") || die "Repository $repo nicht erreichbar." "Adresse und Zugang (z. B. Deploy-Key) prüfen."
    [[ -n $ref ]] || die "Im Repository gibt es noch keine Version (Tag)." "Mit „--ref <Commit>“ (vollständige Kennung, 40 Zeichen) eine Version angeben."
  fi
  info "Lade $ref …"
  fetch_release "$fetch_repo" "$ref" ||
    die "Version „$ref“ nicht gefunden oder Repository $repo nicht erreichbar." "Adresse, Zugang und Versionsangabe (Tag, Branch oder vollständige Commit-Kennung) prüfen."
  commit=$(release_commit "$fetch_repo" "$ref" 2>/dev/null) || die "Version „$ref“ nicht gefunden."
  if [[ $verify -eq 1 ]]; then
    signature=$(verify_release_tag "$fetch_repo" "$ref" "$SOURCE_CLONE/deploy/allowed_signers") ||
      die "Die Signatur von $ref ist ungültig oder fehlt (oder „$ref“ ist kein signiertes Tag)." \
        "Nur signierte Versionen installieren. Für bewusst unsignierte eigene Stände: --no-verify-tags."
    ok "Signatur von $ref geprüft: $signature"
    info "Diesen Fingerabdruck mit dem in README.md veröffentlichten vergleichen."
  else
    warn "Die Signatur von $ref wird NICHT geprüft (--no-verify-tags)."
  fi
  name=$(release_name "$ref" "$commit")
  staging="$PE_STAGING/$name"
  rm -rf "$staging"
  mkdir -p "$staging"
  git -C "$fetch_repo" archive --format=tar "$commit" | tar -x -C "$staging"
  rm -rf "$fetch_repo"
  fetch_repo=''
  build_release "$staging" || die "Der Build ist fehlgeschlagen." "Ausgabe oben lesen; bei Speichermangel mit „--swap ja“ erneut versuchen."
  release="$PE_RELEASES/$name"
  rm -rf "$release"
  mv -T "$staging" "$release"
  staging=''
fi
rm -rf "$fetch_repo"
fetch_repo=''
# v1.4.1: Reste abgebrochener Läufe und die einmalige Umstellung (siehe update.sh).
clean_staging
prune_releases "$release"
remove_legacy_repo

# Geheimnisse (nur anlegen, nie überschreiben, SPEC 4.4).
step "Lege Geheimnisse, Datenbank und Zugänge an …"
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
if [[ $tor_only -eq 1 ]]; then
  printf 'POSTEULEN_TOR_ONLY=1\n' >"$PE_SERVICE_ENV"
else
  printf 'POSTEULEN_DOMAIN=%s\n' "$domain" >"$PE_SERVICE_ENV"
fi
chmod 0644 "$PE_SERVICE_ENV"
busy 'Richte die Datenbank ein' as_service node "$release/backend/src/cli.ts" migrate
# Adminzugang mit Erstpasswort, nur wenn noch keiner existiert (SPEC 13).
admin_output=$(as_service node "$release/backend/src/cli.ts" admin-init)
admin_password=$(sed -n 's/^ADMIN-ERSTPASSWORT: //p' <<<"$admin_output")
# v0.8: eigener Zugang zum Bots-Kontrollzentrum, ebenfalls nur einmal (SPEC 10.12).
bots_output=$(as_service node "$release/backend/src/cli.ts" bots-init)
bots_password=$(sed -n 's/^BOTS-ERSTPASSWORT: //p' <<<"$bots_output")

switch_symlink "$release" "$PE_CURRENT"
# v0.9: Onion-Dienst (SPEC 16.5) – Tor installieren, Schlüssel erhalten oder aus
# /etc/posteulen/onion wiederherstellen. Probleme damit halten die Installation nie auf –
# v1.4.2: außer bei einer Tor-only-Instanz, die ohne Tor nicht erreichbar wäre.
step "Richte das Tor-Netz ein (Onion-Adressen) – das kann einige Minuten dauern."
busy --show 'Tor einrichten' "$PE_CURRENT/deploy/tor.sh" setup || true
if [[ $tor_only -eq 1 ]]; then
  [[ -n $(onion_host) && -n $(onion_host "$PE_ONION_KEYS_ADMIN") && -n $(onion_host "$PE_ONION_KEYS_BOTS") ]] ||
    die "Tor ließ sich nicht einrichten – ohne Tor ist eine Tor-only-Instanz nicht erreichbar." "Die Hinweise zu Tor oben lesen, das Problem beheben und install.sh erneut ausführen."
fi
step "Schreibe die Konfiguration (Webserver, Dienste, Zeitgeber) …"
busy --show 'Konfiguration schreiben' "$PE_CURRENT/deploy/configure.sh"

# ───────────────────────── 5. Start und Prüfung ─────────────────────────
step "Starte PostEulen und prüfe, ob alles erreichbar ist …"
systemctl enable --quiet posteulen.service posteulen-backup.timer
systemctl restart posteulen.service
systemctl start posteulen-backup.timer
busy --show 'Funktionsprüfung' health_check "$domain" "$test_mode" || die "Die Funktionsprüfung ist fehlgeschlagen." "„journalctl -u posteulen -u caddy -n 100“ ansehen."
step "Prüfe die Onion-Adresse über das Tor-Netz – das kann einige Minuten dauern."
busy --show 'Prüfung über das Tor-Netz' "$PE_CURRENT/deploy/tor.sh" check --network || true
onion=$(onion_host)

# ───────────────────────── 6. Zusammenfassung ─────────────────────────
version=$(release_version "$(readlink -f "$PE_CURRENT")")
printf '\n%s\n' "${PE_GREEN}${PE_BOLD}PostEulen $version läuft.${PE_RESET}"
if [[ $tor_only -eq 1 ]]; then
  printf '  Nur im Tor-Netz (Tor Browser):\n'
else
  printf '  Website:      https://%s\n  Verwaltung:   https://admin.%s\n  Bots:         https://bots.%s\n' "$domain" "$domain" "$domain"
fi
[[ -n $onion ]] && printf '  Tor-Netz:     http://%s\n' "$onion"
# v1.4: Adminpanel und Bots-Kontrollzentrum im Tor-Netz.
onion_admin=$(onion_host "$PE_ONION_KEYS_ADMIN")
onion_bots=$(onion_host "$PE_ONION_KEYS_BOTS")
[[ -n $onion_admin ]] && printf '  Admin (Tor):  http://%s\n' "$onion_admin"
[[ -n $onion_bots ]] && printf '  Bots (Tor):   http://%s\n' "$onion_bots"
# v1.4.2: Eine Tor-only-Instanz hat ihre Panels nur unter den Onion-Adressen.
admin_url=https://admin.$domain bots_url=https://bots.$domain
if [[ $tor_only -eq 1 ]]; then
  admin_url="http://$onion_admin (im Tor Browser)"
  bots_url="http://$onion_bots (im Tor Browser)"
fi
printf '  Updates:      sudo posteulen-update\n'
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
if [[ -n $onion ]]; then
  messages+=(
    ""
    "Onion-Adresse im Tor-Netz: http://$onion"
    "Ihre Schlüssel liegen in $PE_ONION_KEYS (Adminpanel und Bots-Kontrollzentrum:"
    "$PE_ONION_KEYS_ADMIN, $PE_ONION_KEYS_BOTS) und sind Teil jeder Sicherung"
    "(posteulen-onion-….tar.age) – so behält ein neuer Server dieselben Adressen."
  )
fi
if [[ -n $admin_password ]]; then
  messages+=(
    ""
    "Admin-Erstpasswort (wird nur jetzt angezeigt): $admin_password"
    "Anmelden unter $admin_url – beim ersten Login muss es geändert werden."
    "Vergessen? „sudo posteulen-cli admin-reset“ erzeugt ein neues."
  )
fi
if [[ -n $bots_password ]]; then
  messages+=(
    ""
    "Erstpasswort des Bots-Kontrollzentrums (wird nur jetzt angezeigt): $bots_password"
    "Anmelden unter $bots_url – beim ersten Login muss es geändert werden."
    "Vergessen? „sudo posteulen-cli bots-reset“ erzeugt ein neues."
  )
fi
banner "${messages[@]}"
show_notices
