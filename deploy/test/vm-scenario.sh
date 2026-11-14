#!/usr/bin/env bash
# Läuft als root in der Test-VM (aufgerufen von run-vm-tests.sh).
# $1 = Basisversion, $2 = Tag der vorigen Stufe (leer = keiner).
set -euo pipefail
base=$1
previous=${2:-}
v1="v$base-vmtest.1" v2="v$base-vmtest.2" v3="v$base-vmtest.3"
# Unsigniert bzw. ein signiertes Tag unter fremdem Namen (v0.6.1: beides muss scheitern).
unsigned="v$base-vmtest.0" renamed="v$base-vmtest.00"
DOMAIN=posteulen.test
pass=0 failed=0
check() {
  local name=$1
  shift
  if "$@"; then printf '\e[32m✔\e[0m %s\n' "$name"; pass=$((pass + 1)); else printf '\e[31m✘\e[0m %s\n' "$name"; failed=$((failed + 1)); fi
}
api_version() {
  curl -s --insecure --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'
}
sql() {
  runuser -u posteulen -- node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/var/lib/posteulen/posteulen.sqlite');const r=d.prepare(process.argv[1]).all();console.log(JSON.stringify(r))" "$1"
}
fingerprint() { sha256sum /etc/posteulen/secrets.json /etc/posteulen/backup.pub | sha256sum | cut -d' ' -f1; }
has_marker() { [[ $(sql "SELECT value FROM settings WHERE key = 'vmtest-marker'") == *bleibt* ]]; }
no_broken_table() { [[ $(sql "SELECT name FROM sqlite_master WHERE name = 'vmtest_broken'") == '[]' ]]; }
runs_as_service_user() {
  local pid
  pid=$(systemctl show --property MainPID --value posteulen.service)
  [[ $pid != 0 && $(stat -c %U "/proc/$pid") == posteulen ]]
}
secrets_permissions() { [[ $(stat -c '%a %U %G' /etc/posteulen/secrets.json) == '640 root posteulen' ]]; }
listens_on_localhost_only() { ! ss -Hltn | grep -E ':300[12] ' | grep -vq '127.0.0.1'; }
no_access_log() { ! grep -Eq '^\s*log\s*$' /etc/caddy/Caddyfile; }
firewall_active() { ufw status | grep -q 'Status: active'; }
hardening_score() {
  local score
  score=$(systemd-analyze security posteulen.service 2>/dev/null | sed -n 's/.*Overall exposure level for [^:]*: \([0-9.]*\).*/\1/p')
  echo "   Exposure: $score"
  awk -v s="$score" 'BEGIN {exit !(s <= 2.5)}'
}
update_backup_exists() { compgen -G '/var/backups/posteulen/*-update.sqlite.age' >/dev/null; }
ACCOUNT_NAME='Vm Testeule'
ACCOUNT_PASSWORD='ein langes Passwort fuer die VM'
account() {
  NODE_EXTRA_CA_CERTS=/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt \
    node /opt/posteulen/current/deploy/test/vm-account.ts "$1" "$ACCOUNT_NAME" "$ACCOUNT_PASSWORD"
}
has_previous_marker() { [[ $(sql "SELECT value FROM settings WHERE key = 'vmtest-vorher'") == *bleibt* ]]; }
has_account_support() { [[ -f /opt/posteulen/current/deploy/test/vm-account.ts ]]; }
# v0.8: das Bots-Kontrollzentrum (bots.<domain>) mit eigenem Zugang.
has_bots_support() { grep -q 'bots-init' /opt/posteulen/current/backend/src/cli.ts 2>/dev/null; }
bots_health() { curl -s --insecure --resolve "bots.$DOMAIN:443:127.0.0.1" "https://bots.$DOMAIN/api/health" | grep -q '"api":"bots"'; }
bots_access() { sql "SELECT opaque_record FROM bots_admin" | sha256sum | cut -d' ' -f1; }
bots_backup_ok() {
  local zip
  zip=$(find /var/backups/posteulen -name 'posteulen-bots-*-taeglich.zip' | sort | tail -1)
  [[ -n $zip && $(head -c 2 "$zip") == PK && $(stat -c %a "$zip") == 600 ]]
}
has_letter_support() { grep -q 'letters-check' /opt/posteulen/current/deploy/test/vm-account.ts 2>/dev/null; }
letters() {
  NODE_EXTRA_CA_CERTS=/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt \
    node /opt/posteulen/current/deploy/test/vm-account.ts "$1" "$ACCOUNT_NAME" "$ACCOUNT_PASSWORD" "${2:-}"
}
# v0.9: Onion-Dienst (SPEC 16.5).
has_tor_support() { [[ -x /opt/posteulen/current/deploy/tor.sh ]]; }
onion() { tr -d '[:space:]' </etc/posteulen/onion/hostname 2>/dev/null; }
tor_running() { systemctl is-active --quiet tor@posteulen; }
onion_keys_saved() {
  [[ $(stat -c '%a %U' /etc/posteulen/onion) == '700 root' ]] &&
    [[ $(stat -c '%a %U' /etc/posteulen/onion/hs_ed25519_secret_key) == '600 root' ]] &&
    cmp -s /etc/posteulen/onion/hs_ed25519_secret_key /var/lib/tor-instances/posteulen/onion/hs_ed25519_secret_key
}
onion_local() { curl -s --max-time 10 -H "Host: $(onion)" http://127.0.0.1:3005/api/health | grep -q '"status":"ok"'; }
onion_loopback_only() { ! ss -Hltn | grep -E ':300[45] ' | grep -vq '127.0.0.1'; }
onion_location() {
  curl -s --insecure -o /dev/null -D - --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" | grep -qi "^onion-location: http://$(onion)/"
}
no_onion_location() {
  ! curl -s --insecure -o /dev/null -D - --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" | grep -qi '^onion-location:'
}
footer_link() {
  curl -s --insecure --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/onion" | grep -q "\"url\":\"http://$(onion)/\""
}
www_redirect() {
  curl -s --insecure -o /dev/null -D - --resolve "www.$DOMAIN:443:127.0.0.1" "https://www.$DOMAIN/hilfe?x=1" |
    grep -qi "^location: https://$DOMAIN/hilfe?x=1"
}
onion_over_tor() {
  local _
  for _ in 1 2 3 4; do
    curl -s --max-time 60 --proxy "socks5h://localhost/run/tor-instances/posteulen/socks" "http://$(onion)/api/health" | grep -q '"status":"ok"' && return 0
  done
  return 1
}
wait_for() {
  local _
  for _ in $(seq 1 30); do "$@" && return 0; sleep 2; done
  return 1
}
tor_stopped() { ! tor_running; }
tor_checks() {
  check "Tor-Instanz läuft ($1)" tor_running
  check "Onion-Adresse unverändert ($1)" test "$(onion)" = "$onion_before"
  check "Onion-Seite antwortet lokal ($1)" onion_local
}
account_registered=0
wait_delivered() {
  local _
  for _ in $(seq 1 36); do
    [[ $(sql "SELECT status FROM letters") == *delivered* ]] && return 0
    sleep 5
  done
  diag
  return 1
}
diag() {
  echo "   Diagnose: $(date -u +%H:%M:%S) UTC"
  sql "SELECT type, due_at, attempts FROM scheduled_events" | sed 's/^/   Warteschlange: /'
  sql "SELECT status, arrives_at, sent_at FROM letters" | sed 's/^/   Briefe: /'
  sql "SELECT what, cause FROM error_log" | sed 's/^/   Fehlerprotokoll: /'
  node -e 'console.log("   Jetzt (ms):", Date.now())'
  journalctl -u posteulen --no-pager -n 15 | sed 's/^/   journal: /'
}

apt-get update -qq && apt-get install -y -qq git >/dev/null
git clone --quiet --bare /tmp/posteulen.bundle /srv/posteulen.git
git -C /srv/posteulen.git config uploadpack.allowFilter true
git clone --quiet /srv/posteulen.git /root/posteulen
printf '127.0.0.1 %s admin.%s bots.%s www.%s\n' "$DOMAIN" "$DOMAIN" "$DOMAIN" "$DOMAIN" >>/etc/hosts

if [[ -n $previous ]]; then
  echo "── 0. Installation der vorigen Stufe ($previous) und Update auf $v1"
  git -C /root/posteulen checkout --quiet "$previous"
  check "install.sh ($previous)" /root/posteulen/deploy/install.sh --domain "$DOMAIN" --test-mode --yes \
    --repo file:///srv/posteulen.git --ref "$previous" --ssh-hardening ja
  sql "INSERT INTO settings (key, value) VALUES ('vmtest-vorher', 'bleibt')" >/dev/null
  # Konto mit dem Code der vorigen Stufe anlegen (SPEC 17.6: Konten melden sich nach dem Update an).
  if has_account_support && posteulen-cli admin-init >/dev/null 2>&1; then
    sql "UPDATE settings SET value = 'open' WHERE key = 'registration_mode'" >/dev/null
    check "Testkonto mit $previous registrieren" account register && account_registered=1
  fi
  before_update=$(fingerprint)
  # Seit v0.6.1 prüft schon die installierte Vorversion jede Signatur gegen ihre eigene
  # allowed_signers (Schlüssel des Auftraggebers). Die Test-Tags trägt der Testschlüssel: Ihm
  # vertraut die Vorversion hier zusätzlich – das steht für die echte Signatur des Auftraggebers.
  git -C /root/posteulen show "$v1:deploy/allowed_signers" >>/opt/posteulen/current/deploy/allowed_signers
  check "posteulen-update $v1 (von $previous)" posteulen-update "$v1" --yes
  check "Version $v1 antwortet" test "$(api_version)" = "${v1#v}"
  check "Daten der vorigen Stufe erhalten" has_previous_marker
  check "Geheimnisse beim Update unverändert" test "$(fingerprint)" = "$before_update"
  [[ $account_registered -eq 1 ]] && check "Konto der vorigen Stufe meldet sich nach dem Update an" account login
else
  echo "── 1. Frische Installation ($v1)"
  git -C /root/posteulen checkout --quiet "$v1"
  start=$(date +%s)
  check "install.sh läuft fehlerfrei durch" /root/posteulen/deploy/install.sh --domain "$DOMAIN" --test-mode --yes \
    --repo file:///srv/posteulen.git --ref "$v1" --ssh-hardening ja
  echo "   Dauer: $(($(date +%s) - start)) s"
  check "Version $v1 antwortet" test "$(api_version)" = "${v1#v}"
fi
git -C /root/posteulen checkout --quiet "$v1"
if has_account_support; then
  check "Adminzugang angelegt" bash -c "posteulen-cli admin-init | grep -q 'vorhanden'"
fi
if has_bots_support; then
  check "Zugang zum Bots-Kontrollzentrum angelegt" bash -c "posteulen-cli bots-init | grep -q 'vorhanden'"
  check "bots.$DOMAIN antwortet" bots_health
  bots_before=$(bots_access)
fi
if has_account_support; then
  sql "UPDATE settings SET value = 'open' WHERE key = 'registration_mode'" >/dev/null
  if [[ $account_registered -eq 0 ]]; then
    check "Testkonto registrieren (über HTTPS)" account register
  fi
  check "Testkonto meldet sich an" account login
fi
if has_letter_support; then
  check "Zweites Konto, Koppeln und Brief (Ende-zu-Ende)" letters letters-setup
  check "Absender liest den eigenen Brief" letters letters-check
  # Beide Konten wohnen am selben Ort: Die Aushilfseule landet sofort, die Warteschlange stellt zu (SPEC 4.5).
  check "Warteschlange stellt den Brief zu (höchstens 3 Minuten)" wait_delivered
  check "Empfänger liest den Brief" letters letters-check --delivered
fi
check "Dienst läuft als posteulen" runs_as_service_user
check "Geheimnis-Datei 0640 root:posteulen" secrets_permissions
check "Node lauscht nur auf localhost" listens_on_localhost_only
check "Kein Access-Log in Caddy" no_access_log
check "Firewall aktiv" firewall_active
# v0.8.2: Firewall auch für IPv6, jeder Hostname über jede eigene Adresse.
grep -q 'address_check' /opt/posteulen/current/deploy/lib.sh 2>/dev/null &&
  check "Firewall öffnet 443 auch für IPv6" bash -c "ufw status | grep -q '443/tcp (v6)'"
grep -q 'address_check' /opt/posteulen/current/deploy/lib.sh 2>/dev/null &&
  check "Jeder Hostname über jede eigene Adresse" bash -c "source /opt/posteulen/current/deploy/lib.sh && address_check '$DOMAIN' 1 2>&1 | grep -q 'über alle ihre Adressen'"
check "SSH nur mit Schlüssel" test -f /etc/ssh/sshd_config.d/50-posteulen.conf
check "Backup-Timer aktiv" systemctl is-active --quiet posteulen-backup.timer
check "systemd-Härtung (Bewertung ≤ 2,5)" hardening_score
onion_before=''
if has_tor_support; then
  echo "── 1a. Onion-Dienst (v0.9, SPEC 16.5)"
  check "Tor-Instanz tor@posteulen läuft" tor_running
  check "Onion-Adresse (v3) vorhanden" bash -c "[[ \$(tr -d '[:space:]' </etc/posteulen/onion/hostname) =~ ^[a-z2-7]{56}\\.onion\$ ]]"
  onion_before=$(onion)
  echo "   Onion-Adresse: $onion_before"
  check "Schlüssel maßgeblich gesichert (/etc/posteulen/onion, 0700/0600 root)" onion_keys_saved
  check "Standard-Tor-Client abgeschaltet" bash -c "! systemctl is-active --quiet tor@default"
  check "Onion-Seite antwortet lokal (http, ohne HSTS)" onion_local
  check "Onion-Listener nur auf localhost" onion_loopback_only
  check "Onion-Location auf der normalen Seite" onion_location
  check "Footer-Link nennt die Onion-Adresse" footer_link
  check "Service-Umgebung kennt die Onion-Adresse" grep -qx "POSTEULEN_ONION=$onion_before" /etc/posteulen/service.env
  check "www leitet dauerhaft auf die Domain um (308, mit Pfad)" www_redirect
  check "Onion-Adresse über das Tor-Netz erreichbar" onion_over_tor
  echo "   Schalter im Adminpanel: aus (Einstellung in der Datenbank, Neustart gleicht ab)"
  sql "INSERT INTO settings (key, value) VALUES ('tor_enabled', '0') ON CONFLICT (key) DO UPDATE SET value = excluded.value" >/dev/null
  systemctl restart posteulen
  check "Schalter aus: Tor gestoppt" wait_for tor_stopped
  check "Schalter aus: kein Onion-Location mehr" wait_for no_onion_location
  check "Schalter aus: normale Seite läuft" test "$(api_version)" = "${v1#v}"
  check "Schalter aus: Tor startet auch nicht von selbst" bash -c "systemctl start tor@posteulen; ! systemctl is-active --quiet tor@posteulen"
  sql "UPDATE settings SET value = '1' WHERE key = 'tor_enabled'" >/dev/null
  systemctl restart posteulen
  check "Schalter an: Tor läuft wieder" wait_for tor_running
  check "Schalter an: Onion-Location wieder da" wait_for onion_location
  check "Schalter an: dieselbe Onion-Adresse" test "$(onion)" = "$onion_before"
fi

echo "── 2. Zweiter Lauf überschreibt nichts"
sql "INSERT INTO settings (key, value) VALUES ('vmtest-marker', 'bleibt')" >/dev/null
printf '# lokale Anpassung\n' >>/etc/posteulen/local/admin-00-leer.caddy
before=$(fingerprint)
check "install.sh erneut" /root/posteulen/deploy/install.sh --domain "$DOMAIN" --test-mode --yes --repo file:///srv/posteulen.git --ssh-hardening ja
check "Geheimnis-Datei und Backup-Schlüssel unverändert" test "$(fingerprint)" = "$before"
check "Datenbank-Inhalt erhalten" has_marker
check "Lokale Anpassung erhalten" grep -q '# lokale Anpassung' /etc/posteulen/local/admin-00-leer.caddy
check "Dienst läuft weiter" test "$(api_version)" = "${v1#v}"
has_account_support && check "Konto nach zweitem Lauf" account login
has_tor_support && tor_checks "zweiter Lauf"

echo "── 3. Update $v1 → $v2"
check "posteulen-update --check" posteulen-update --check
check "posteulen-update $v2" posteulen-update "$v2" --yes
check "Version $v2 antwortet" test "$(api_version)" = "${v2#v}"
check "Daten erhalten" has_marker
check "Geheimnisse unverändert" test "$(fingerprint)" = "$before"
check "Verschlüsselte Sicherung vor dem Update" update_backup_exists
has_bots_support && check "Passwort des Kontrollzentrums beim Update unverändert" test "$(bots_access)" = "$bots_before"
has_account_support && check "Konto nach Update" account login
has_letter_support && check "Brief nach Update für beide lesbar" letters letters-check --delivered
has_tor_support && tor_checks "Update"

echo "── 3a. Nur signierte Tags (v0.6.1)"
if posteulen-update "$unsigned" --yes; then check "unsigniertes Tag abgelehnt" false; else check "unsigniertes Tag abgelehnt" true; fi
if posteulen-update "$renamed" --yes; then check "umbenanntes signiertes Tag abgelehnt" false; else check "umbenanntes signiertes Tag abgelehnt" true; fi
check "Version $v2 läuft unverändert" test "$(api_version)" = "${v2#v}"

echo "── 4. Kaputtes Update $v2 → $v3 wird zurückgerollt"
if posteulen-update "$v3" --yes; then check "kaputtes Update schlägt fehl" false; else check "kaputtes Update schlägt fehl" true; fi
check "Version $v2 läuft wieder" test "$(api_version)" = "${v2#v}"
check "Daten nach Rückfall erhalten" has_marker
check "Kaputte Migration nicht in der DB" no_broken_table
has_account_support && check "Konto nach Rückfall" account login
has_letter_support && check "Brief nach Rückfall für beide lesbar" letters letters-check --delivered
has_tor_support && tor_checks "automatischer Rückfall"

echo "── 5. posteulen-update --rollback ($v2 → $v1)"
check "Rollback" posteulen-update --rollback --yes
check "Version $v1 läuft" test "$(api_version)" = "${v1#v}"
check "Daten von vor dem Update" has_marker
has_account_support && check "Konto nach --rollback" account login
has_letter_support && check "Brief nach --rollback für beide lesbar" letters letters-check --delivered
has_tor_support && tor_checks "--rollback"

echo "── 6. Sicherung und Wiederherstellung nach README.md"
check "Sicherung manuell" systemctl start posteulen-backup.service
has_bots_support && check "Tägliche Bot-Sicherung als ZIP (0600)" bots_backup_ok
onion_backup_ok() {
  local file
  file=$(find /var/backups/posteulen -name 'posteulen-onion-*-taeglich.tar.age' | sort | tail -1)
  [[ -n $file && $(stat -c %a "$file") == 600 ]] || return 1
  rm -rf /tmp/onion-test && install -d -m 0700 /tmp/onion-test
  age --decrypt --identity /root/posteulen-backup-schluessel.txt --output /tmp/onion-test/onion.tar "$file" || return 1
  tar -x -C /tmp/onion-test -f /tmp/onion-test/onion.tar || return 1
  cmp -s /tmp/onion-test/onion/hs_ed25519_secret_key /etc/posteulen/onion/hs_ed25519_secret_key
  local result=$?
  rm -rf /tmp/onion-test
  return $result
}
has_tor_support && check "Onion-Schlüssel verschlüsselt in der Sicherung" onion_backup_ok
latest=$(find /var/backups/posteulen -name '*-taeglich.sqlite.age' | sort | tail -1)
check "Sicherung ist verschlüsselt (kein SQLite-Klartext)" bash -c "! head -c 16 \"\$1\" | grep -q 'SQLite format'" _ "$latest"
sql "DELETE FROM settings WHERE key = 'vmtest-marker'" >/dev/null
systemctl stop posteulen
age --decrypt --identity /root/posteulen-backup-schluessel.txt --output /tmp/restore.sqlite "$latest"
rm -f /var/lib/posteulen/posteulen.sqlite-wal /var/lib/posteulen/posteulen.sqlite-shm
install -m 0600 -o posteulen -g posteulen /tmp/restore.sqlite /var/lib/posteulen/posteulen.sqlite
rm -f /tmp/restore.sqlite
check "posteulen-cli check nach Wiederherstellung" posteulen-cli check
systemctl start posteulen
sleep 2
check "Wiederhergestellte Daten da" has_marker
has_account_support && check "Konto nach Wiederherstellung" account login
has_letter_support && check "Brief nach Wiederherstellung für beide lesbar" letters letters-check --delivered

echo "── 7. Totalausfall: neuer Server, Wiederherstellung nach README.md"
# Gerettet ist nur, was die readme außerhalb des Servers zu sichern verlangt.
rescue=/root/rettung
rm -rf "$rescue" && install -d -m 0700 "$rescue"
cp /etc/posteulen/secrets.json "$rescue/posteulen-secrets.json"
cp /root/posteulen-backup-schluessel.txt "$rescue/posteulen-backup-schluessel.txt"
systemctl start posteulen-backup.service
cp "$(find /var/backups/posteulen -name '*-taeglich.sqlite.age' | sort | tail -1)" "$rescue/"
rescued_backup=$(find "$rescue" -name '*-taeglich.sqlite.age' | head -1)
if has_tor_support; then
  cp "$(find /var/backups/posteulen -name 'posteulen-onion-*-taeglich.tar.age' | sort | tail -1)" "$rescue/"
fi
rescued_onion=$(find "$rescue" -name 'posteulen-onion-*.tar.age' | head -1)
# Der Server ist weg: nur der Testlauf löscht hier, nie die Skripte selbst.
systemctl stop posteulen.service posteulen-backup.timer
rm -rf /etc/posteulen /var/lib/posteulen /var/backups/posteulen /opt/posteulen /root/posteulen-backup-schluessel.txt
# v0.9: auch die Tor-Instanz samt Schlüsseln ist weg (das Paket darf bleiben).
systemctl stop tor@posteulen >/dev/null 2>&1 || true
rm -rf /etc/tor/instances/posteulen /var/lib/tor-instances/posteulen
# Schritt 1 der readme: Geheimnis-Datei vor der Installation zurücklegen.
install -d -m 0700 /etc/posteulen
install -m 0600 "$rescue/posteulen-secrets.json" /etc/posteulen/secrets.json
# v0.9, ebenfalls Schritt 1: die Onion-Schlüssel aus der Sicherung zurücklegen.
if [[ -n $rescued_onion ]]; then
  age --decrypt --identity "$rescue/posteulen-backup-schluessel.txt" "$rescued_onion" | tar -x -C /etc/posteulen
fi
old_pub=$(sed -n 's/^# public key: //p' "$rescue/posteulen-backup-schluessel.txt")
# Schritt 2: installieren, mit dem bisherigen öffentlichen Backup-Schlüssel.
check "Neuinstallation mit geretteter Geheimnis-Datei" /root/posteulen/deploy/install.sh --domain "$DOMAIN" --test-mode --yes \
  --repo file:///srv/posteulen.git --ref "$v1" --ssh-hardening ja --backup-pubkey "$old_pub"
check "Geheimnis-Datei unverändert übernommen" cmp -s "$rescue/posteulen-secrets.json" /etc/posteulen/secrets.json
check "Backup-Schlüssel ist der bisherige" test "$(cat /etc/posteulen/backup.pub)" = "$old_pub"
check "Kein neuer privater Backup-Schlüssel" test ! -e /root/posteulen-backup-schluessel.txt
# Schritt 3: Sicherung einspielen.
systemctl stop posteulen
age --decrypt --identity "$rescue/posteulen-backup-schluessel.txt" --output /tmp/restore.sqlite "$rescued_backup"
rm -f /var/lib/posteulen/posteulen.sqlite-wal /var/lib/posteulen/posteulen.sqlite-shm
install -m 0600 -o posteulen -g posteulen /tmp/restore.sqlite /var/lib/posteulen/posteulen.sqlite
rm -f /tmp/restore.sqlite
check "posteulen-cli migrate" posteulen-cli migrate
check "posteulen-cli check nach Neuaufbau" posteulen-cli check
systemctl start posteulen
sleep 2
check "Version $v1 antwortet" test "$(api_version)" = "${v1#v}"
check "Daten nach Neuaufbau da" has_marker
has_account_support && check "Konto nach Neuaufbau" account login
has_letter_support && check "Brief nach Neuaufbau für beide lesbar" letters letters-check --delivered
new_backup_readable() {
  systemctl start posteulen-backup.service || return 1
  local newest
  newest=$(find /var/backups/posteulen -name '*-taeglich.sqlite.age' | sort | tail -1)
  # In eine Datei entschlüsseln: Ein früh beendetes „head“ würde „age“ mit SIGPIPE abbrechen (pipefail).
  age --decrypt --identity "$rescue/posteulen-backup-schluessel.txt" --output /tmp/neu.sqlite "$newest" || return 1
  local header
  header=$(head -c 15 /tmp/neu.sqlite)
  rm -f /tmp/neu.sqlite
  [[ $header == 'SQLite format 3' ]]
}
check "Neue Sicherungen mit dem bisherigen Schlüssel lesbar" new_backup_readable
if [[ -n $onion_before ]]; then
  check "Neuer Server behält die Onion-Adresse" test "$(onion)" = "$onion_before"
  check "Tor läuft auf dem neuen Server" tor_running
  check "Onion-Seite antwortet auf dem neuen Server" onion_local
fi
rm -rf "$rescue"

echo
echo "Ergebnis: $pass bestanden, $failed fehlgeschlagen"
[[ $failed -eq 0 ]]
