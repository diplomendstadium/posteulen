#!/usr/bin/env bash
# v1.4.2: Tor-only-Installation in einer zweiten, frischen Test-VM (SPEC 16.6, 17.6).
# Läuft als root in der VM (aufgerufen von run-vm-tests.sh). $1 = Basisversion.
set -euo pipefail
base=$1
v1="v$base-vmtest.1" v2="v$base-vmtest.2"
pass=0 failed=0
check() {
  local name=$1
  shift
  if "$@"; then printf '\e[32m✔\e[0m %s\n' "$name"; pass=$((pass + 1)); else printf '\e[31m✘\e[0m %s\n' "$name"; failed=$((failed + 1)); fi
}
onion_of() { tr -d '[:space:]' <"/etc/posteulen/$1/hostname" 2>/dev/null; }
local_get() { curl -s --max-time 10 -H "Host: $(onion_of "$1")" "http://127.0.0.1:$2$3"; }
health_of() { local_get "$1" "$2" /api/health | grep -q "\"api\":\"$3\""; }
api_version() { local_get onion 3005 /api/health | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'; }
edition_tor_only() { local_get onion 3005 /api/edition | grep -q '"torOnly":true'; }
push_gone() {
  [[ $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $(onion_of onion)" http://127.0.0.1:3005/api/push/key) == 404 ]]
}
conf_tor_only() { grep -qx 'POSTEULEN_TOR_ONLY=1' /etc/posteulen/posteulen.conf; }
env_tor_only() {
  grep -qx 'POSTEULEN_TOR_ONLY=1' /etc/posteulen/service.env &&
    ! grep -q '^POSTEULEN_DOMAIN=' /etc/posteulen/service.env &&
    grep -q "^POSTEULEN_ONION=$(onion_of onion)$" /etc/posteulen/service.env
}
caddy_onion_only() {
  grep -q 'auto_https off' /etc/caddy/Caddyfile &&
    ! grep -Eq '^(admin\.|bots\.|www\.)|^[a-z0-9.-]+\.[a-z]+ \{' /etc/caddy/Caddyfile &&
    [[ $(grep -Ec '^http://[a-z2-7]{56}\.onion:300[567] \{' /etc/caddy/Caddyfile) -eq 3 ]]
}
no_web_ports() { ! ss -Hltn | grep -Eq ':(80|443) '; }
firewall_ssh_only() { ufw status | grep -q 'Status: active' && ! ufw status | grep -Eq '^(80|443)'; }
onion_loopback_only() { ! ss -Hltn | grep -E ':300[0-9] ' | grep -vq '127.0.0.1'; }
ACCOUNT_NAME='Tor Testeule'
ACCOUNT_PASSWORD='ein langes Passwort fuer die Tor-VM'
account() {
  POSTEULEN_TEST_BASE="http://$(onion_of onion):3005" POSTEULEN_TEST_ORIGIN="http://$(onion_of onion)" \
    POSTEULEN_TEST_STATE=/root/vmtest-tor-account.json \
    node /opt/posteulen/current/deploy/test/vm-account.ts "$1" "$ACCOUNT_NAME" "$ACCOUNT_PASSWORD"
}
sql() {
  runuser -u posteulen -- node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/var/lib/posteulen/posteulen.sqlite');const r=d.prepare(process.argv[1]).all();console.log(JSON.stringify(r))" "$1"
}
onion_over_tor() {
  local _
  for _ in 1 2 3 4; do
    curl -s --max-time 60 --proxy "socks5h://localhost/run/tor-instances/posteulen/socks" "http://$(onion_of onion)/api/health" | grep -q '"status":"ok"' && return 0
  done
  return 1
}

apt-get update -qq && apt-get install -y -qq git >/dev/null
git clone --quiet --bare /var/tmp/posteulen.bundle /srv/posteulen.git
rm -f /var/tmp/posteulen.bundle
git -C /srv/posteulen.git config uploadpack.allowFilter true
git clone --quiet /srv/posteulen.git /root/posteulen
git -C /root/posteulen checkout --quiet "$v1"

echo "── T1. Frische Installation nur im Tor-Netz ($v1)"
start=$(date +%s)
check "install.sh --tor-only läuft fehlerfrei durch" /root/posteulen/deploy/install.sh --tor-only --yes \
  --repo file:///srv/posteulen.git --ref "$v1" --ssh-hardening ja
echo "   Dauer: $(($(date +%s) - start)) s"
check "Version $v1 antwortet über die Onion-Seite" test "$(api_version)" = "${v1#v}"
check "Konfiguration: Tor-only, keine Domain" conf_tor_only
check "service.env: Tor-only mit Onion-Adresse, ohne Domain" env_tor_only
check "Caddyfile: nur die drei Onion-Seiten, kein HTTPS" caddy_onion_only
check "Keine offenen Web-Ports (80, 443)" no_web_ports
check "Firewall: nur SSH" firewall_ssh_only
check "Onion-Listener nur auf 127.0.0.1" onion_loopback_only
check "Adminpanel im Tor-Netz antwortet lokal" health_of onion-admin 3006 admin
check "Bots-Kontrollzentrum im Tor-Netz antwortet lokal" health_of onion-bots 3007 bots
check "Die App erkennt die Tor-only-Instanz" edition_tor_only
check "Keine Benachrichtigungen (Push-Schlüssel: 404)" push_gone
check "Adminzugang angelegt" bash -c "posteulen-cli admin-init | grep -q 'vorhanden'"
sql "UPDATE settings SET value = 'open' WHERE key = 'registration_mode'" >/dev/null
check "Testkonto über die Onion-Seite registrieren" account register
check "Testkonto meldet sich über die Onion-Seite an (mit Rechenaufgabe)" account login
onion_before=$(onion_of onion)

echo "── T2. Zweiter Lauf und Schutz vor Umstellung"
check "install.sh ein zweites Mal (nichts überschrieben)" /root/posteulen/deploy/install.sh --yes \
  --repo file:///srv/posteulen.git --ssh-hardening ja
check "Onion-Adresse unverändert" test "$(onion_of onion)" = "$onion_before"
check "install.sh --domain auf einer Tor-only-Instanz wird abgelehnt" \
  bash -c "! /root/posteulen/deploy/install.sh --domain posteulen.test --yes --repo file:///srv/posteulen.git >/dev/null 2>&1"

echo "── T3. Update ($v2)"
check "posteulen-update $v2" posteulen-update "$v2" --yes
check "Version $v2 antwortet über die Onion-Seite" test "$(api_version)" = "${v2#v}"
check "Nach dem Update weiter Tor-only" env_tor_only
check "Nach dem Update nur die Onion-Seiten" caddy_onion_only
check "Onion-Adresse nach dem Update unverändert" test "$(onion_of onion)" = "$onion_before"
check "Konto meldet sich nach dem Update an" account login

echo "── T4. Über das Tor-Netz (braucht Internet in der VM)"
if onion_over_tor; then
  printf '\e[32m✔\e[0m %s\n' "Über das Tor-Netz erreichbar"
  pass=$((pass + 1))
else
  printf '\e[33m!\e[0m %s\n' "Über das Tor-Netz (noch) nicht erreichbar – ohne Internetzugang der VM erwartet"
fi

echo
echo "Tor-only: $pass bestanden, $failed fehlgeschlagen."
[[ $failed -eq 0 ]]
