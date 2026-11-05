#!/usr/bin/env bash
# Läuft als root in der Test-VM (aufgerufen von run-vm-tests.sh). $1 = Basisversion.
set -euo pipefail
base=$1
v1="v$base-vmtest.1" v2="v$base-vmtest.2" v3="v$base-vmtest.3"
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

apt-get update -qq && apt-get install -y -qq git >/dev/null
git clone --quiet --bare /tmp/posteulen.bundle /srv/posteulen.git
git -C /srv/posteulen.git config uploadpack.allowFilter true
git clone --quiet /srv/posteulen.git /root/posteulen
git -C /root/posteulen checkout --quiet "$v1"

echo "── 1. Frische Installation ($v1)"
start=$(date +%s)
check "install.sh läuft fehlerfrei durch" /root/posteulen/deploy/install.sh --domain "$DOMAIN" --test-mode --yes \
  --repo file:///srv/posteulen.git --ref "$v1" --ssh-hardening ja
echo "   Dauer: $(($(date +%s) - start)) s"
check "Version $v1 antwortet" test "$(api_version)" = "${v1#v}"
check "Dienst läuft als posteulen" runs_as_service_user
check "Geheimnis-Datei 0640 root:posteulen" secrets_permissions
check "Node lauscht nur auf localhost" listens_on_localhost_only
check "Kein Access-Log in Caddy" no_access_log
check "Firewall aktiv" firewall_active
check "SSH nur mit Schlüssel" test -f /etc/ssh/sshd_config.d/50-posteulen.conf
check "Backup-Timer aktiv" systemctl is-active --quiet posteulen-backup.timer
check "systemd-Härtung (Bewertung ≤ 2,5)" hardening_score

echo "── 2. Zweiter Lauf überschreibt nichts"
sql "INSERT INTO settings (key, value) VALUES ('vmtest-marker', 'bleibt')" >/dev/null
printf '# lokale Anpassung\n' >>/etc/posteulen/local/admin-00-leer.caddy
before=$(fingerprint)
check "install.sh erneut" /root/posteulen/deploy/install.sh --domain "$DOMAIN" --test-mode --yes --repo file:///srv/posteulen.git --ssh-hardening ja
check "Geheimnis-Datei und Backup-Schlüssel unverändert" test "$(fingerprint)" = "$before"
check "Datenbank-Inhalt erhalten" has_marker
check "Lokale Anpassung erhalten" grep -q '# lokale Anpassung' /etc/posteulen/local/admin-00-leer.caddy
check "Dienst läuft weiter" test "$(api_version)" = "${v1#v}"

echo "── 3. Update $v1 → $v2"
check "posteulen-update --check" posteulen-update --check
check "posteulen-update $v2" posteulen-update "$v2" --yes
check "Version $v2 antwortet" test "$(api_version)" = "${v2#v}"
check "Daten erhalten" has_marker
check "Geheimnisse unverändert" test "$(fingerprint)" = "$before"
check "Verschlüsselte Sicherung vor dem Update" update_backup_exists

echo "── 4. Kaputtes Update $v2 → $v3 wird zurückgerollt"
if posteulen-update "$v3" --yes; then check "kaputtes Update schlägt fehl" false; else check "kaputtes Update schlägt fehl" true; fi
check "Version $v2 läuft wieder" test "$(api_version)" = "${v2#v}"
check "Daten nach Rückfall erhalten" has_marker
check "Kaputte Migration nicht in der DB" no_broken_table

echo "── 5. posteulen-update --rollback ($v2 → $v1)"
check "Rollback" posteulen-update --rollback --yes
check "Version $v1 läuft" test "$(api_version)" = "${v1#v}"
check "Daten von vor dem Update" has_marker

echo "── 6. Sicherung und Wiederherstellung nach readme.txt"
check "Sicherung manuell" systemctl start posteulen-backup.service
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

echo
echo "Ergebnis: $pass bestanden, $failed fehlgeschlagen"
[[ $failed -eq 0 ]]
