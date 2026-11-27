#!/usr/bin/env bash
# Schreibt alle erzeugten Konfigurationsdateien aus dem gerade aktiven Release:
# service.env, systemd-Units, Caddyfile, Befehle in /usr/local/sbin, Platzhalter in local/.
# v0.9: mit www-Weiterleitung (wenn www im DNS auf diesen Server zeigt) und Onion-Seite (SPEC 16.5).
# v1.4.2: Eine Tor-only-Instanz (SPEC 16.6) hat keine Domain – nur die drei Onion-Seiten.
# Lokale Anpassungen in /etc/posteulen/local/ werden nie überschrieben (SPEC 16.3).
set -euo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$SELF_DIR/lib.sh"
RELEASE=$(cd "$SELF_DIR/.." && pwd)

require_root
domain=$(conf_get POSTEULEN_DOMAIN)
test_mode=$(conf_get POSTEULEN_TEST_MODE)
tor_only && domain=''
tor_only || valid_domain "$domain" || die "Keine gültige Domain in $PE_CONF." "Die Datei prüfen oder install.sh erneut ausführen."

# v0.9: Onion-Adresse aus der maßgeblichen Schlüsselkopie (leer, solange Tor nicht eingerichtet ist).
onion=$(onion_host)
# v1.4: die Onion-Adressen von Adminpanel und Bots-Kontrollzentrum (SPEC 16.5).
onion_admin=$(onion_host "$PE_ONION_KEYS_ADMIN")
onion_bots=$(onion_host "$PE_ONION_KEYS_BOTS")

umask 022
{
  if tor_only; then printf 'POSTEULEN_TOR_ONLY=1\n'; else printf 'POSTEULEN_DOMAIN=%s\n' "$domain"; fi
  [[ -n $onion ]] && printf 'POSTEULEN_ONION=%s\n' "$onion"
  [[ -n $onion_admin ]] && printf 'POSTEULEN_ONION_ADMIN=%s\n' "$onion_admin"
  [[ -n $onion_bots ]] && printf 'POSTEULEN_ONION_BOTS=%s\n' "$onion_bots"
  true
} >"$PE_SERVICE_ENV.new"
chmod 0644 "$PE_SERVICE_ENV.new"
mv "$PE_SERVICE_ENV.new" "$PE_SERVICE_ENV"

# Platzhalter für lokale Anpassungen (nur anlegen, nie überschreiben).
install -d -m 0755 "$PE_LOCAL"
[[ -e $PE_LOCAL/global-00-leer.caddy ]] || printf '# Eigene globale Caddy-Blöcke hier oder in weiteren global-*.caddy-Dateien.\n' >"$PE_LOCAL/global-00-leer.caddy"
[[ -e $PE_LOCAL/admin-00-leer.caddy ]] || printf '# Eigene Regeln für das Adminpanel hier oder in weiteren admin-*.caddy-Dateien.\n' >"$PE_LOCAL/admin-00-leer.caddy"
[[ -e $PE_LOCAL/bots-00-leer.caddy ]] || printf '# Eigene Regeln für das Bots-Kontrollzentrum hier oder in weiteren bots-*.caddy-Dateien.\n' >"$PE_LOCAL/bots-00-leer.caddy"

# v0.8.2: Firewall auch für IPv6 (eine später hinzugefügte IPv6-Adresse funktioniert dann sofort).
ensure_firewall

# systemd-Units
# v1.2.1: posteulen-stats sammelt die Messwerte für das Server-Dashboard im Adminpanel.
# v1.4.3: posteulen-check (stündlich: Laufzeit, wartende Updates), posteulen-blocklists (täglich)
# und posteulen-autoupdate (nach der nächtlichen Sicherung) für „Server der Instanz“.
for unit in posteulen.service posteulen-backup.service posteulen-backup.timer posteulen-nightly.service posteulen-stats.service posteulen-stats.timer \
  posteulen-autoupdate.service posteulen-check.service posteulen-check.timer posteulen-blocklists.service posteulen-blocklists.timer; do
  install -m 0644 "$RELEASE/deploy/systemd/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload

# Befehle
install -m 0755 "$RELEASE/deploy/posteulen-update" /usr/local/sbin/posteulen-update
install -m 0755 "$RELEASE/deploy/posteulen-cli" /usr/local/sbin/posteulen-cli
# v1.2.1: liegt außerhalb des Releases, damit der Timer auch nach einem Rückfall weiterläuft.
install -m 0755 "$RELEASE/deploy/posteulen-server-load" /usr/local/sbin/posteulen-server-load
systemctl enable --now --quiet posteulen-stats.timer
systemctl enable --now --quiet posteulen-check.timer posteulen-blocklists.timer

# Caddyfile (eine fremde, vorhandene Caddyfile wird einmalig gesichert)
caddyfile=/etc/caddy/Caddyfile
if [[ -f $caddyfile ]] && ! grep -q '^# Erzeugt von posteulen-cli caddyfile' "$caddyfile"; then
  [[ -e $caddyfile.vor-posteulen ]] || cp -a "$caddyfile" "$caddyfile.vor-posteulen"
fi
if tor_only; then
  # v1.4.2: nur die Onion-Seiten – ohne alle drei Adressen gäbe es keinen Weg hinein.
  [[ -n $onion && -n $onion_admin && -n $onion_bots ]] || die "Die Onion-Adressen fehlen." "Tor einrichten: „sudo $RELEASE/deploy/tor.sh setup“, danach dieses Skript erneut ausführen."
  args=(caddyfile --tor-only)
else
  args=(caddyfile --domain "$domain")
  [[ $test_mode == 1 ]] && args+=(--test-mode)
  # v0.9: www.<Domain> leitet auf <Domain> um – nur, wenn www im DNS auf diesen Server zeigt.
  www_wanted "$domain" "${test_mode:-0}" && args+=(--www)
fi
# v0.9: Onion-Seite (nur lokal, für Tor) und – solange Tor läuft – Onion-Location für den Tor Browser.
if [[ -n $onion ]]; then
  args+=(--onion "$onion")
  tor_wanted && systemctl is-active --quiet "$PE_TOR_UNIT" && args+=(--onion-active)
  # v1.4: eigene Onion-Seiten für Adminpanel und Bots-Kontrollzentrum.
  [[ -n $onion_admin ]] && args+=(--onion-admin "$onion_admin")
  [[ -n $onion_bots ]] && args+=(--onion-bots "$onion_bots")
fi
node "$RELEASE/backend/src/cli.ts" "${args[@]}" >"$caddyfile.new"
if ! caddy validate --config "$caddyfile.new" --adapter caddyfile >/dev/null 2>&1; then
  caddy validate --config "$caddyfile.new" --adapter caddyfile || true
  rm -f "$caddyfile.new"
  die "Die erzeugte Caddyfile ist ungültig." "Eigene Dateien in $PE_LOCAL prüfen."
fi
mv "$caddyfile.new" "$caddyfile"
if systemctl is-active --quiet caddy; then systemctl reload caddy; else systemctl enable --now caddy; fi
ok "Konfiguration geschrieben (Units, Caddyfile, Befehle)."
