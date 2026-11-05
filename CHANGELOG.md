# Changelog

Alle Versionen von PostEulen.de. Format: neueste Version oben. Jede Version enthält einen
Abschnitt **Hinweise für Betreiber**.

## v0.1.0-stufe.1 – Konten und Krypto

- Registrierung mit Proof-of-Work-Captcha (ALTCHA, selbst gehostet), Registrierungsmodi und
  Einmal-Einladungscodes; Namensregeln aus SPEC 7.1; fiktiver Wohnort per Pin auf der Karte mit
  Land/Wasser-Prüfung (Natural Earth).
- Anmeldung per OPAQUE (RFC 9807) mit Argon2id; unbekannte Namen sind von bekannten nicht zu
  unterscheiden; Wartezeiten und Captcha nach Fehlversuchen; nur eine Sitzung je Konto.
- Hauptschlüssel und Identitätsschlüssel (Ed25519, X25519) entstehen im Browser und liegen auf dem
  Server nur verschlüsselt; „angemeldet bleiben“ über IndexedDB mit nicht exportierbarem Schlüssel.
- Passwortwechsel ohne neue Schlüssel; Abmelden löscht alle lokalen Schlüssel.
- Adminpanel: Anmeldung per OPAQUE, Erstpasswort mit Pflichtwechsel, Registrierungsmodus,
  Einladungscodes, Fehlerprotokoll; `posteulen-cli admin-reset`.
- 17 Eulenarten (alle mit Bildern).

### Hinweise für Betreiber

- Beim Update von Stufe 0 wird der Adminzugang angelegt; das **Erstpasswort erscheint einmalig**
  am Ende des Updates. Danach unter `https://admin.<domain>` anmelden und ändern.
- Die Registrierung ist zunächst **geschlossen**; im Adminpanel auf „nur mit Einladungscode“
  oder „offen“ stellen.

## v0.1.0-stufe.0 – Gerüst

- Ordnerstruktur `backend/`, `web/`, `admin/`, `shared/`, `deploy/`, `images/`.
- Build, Lint, Formatierung, Typprüfung, Unit- und Ende-zu-Ende-Tests; `npm test` prüft alles.
- Backend: zwei getrennte API-Listener (Nutzer und Verwaltung), Sicherheits-Header,
  Origin-Prüfung, nur JSON, Größenlimit, Health-Endpunkt; SQLite mit Migrationen.
- Setup-Befehl für die Geheimnis-Datei (`posteulen-cli setup`, überschreibt nie).
- Nutzer-PWA und Adminpanel als leere Hüllen im Grund-Design; Service Worker, Offline-Hinweis.
- Bilder-Pipeline: WebP in drei Größen, Platzhalter für fehlende Eulenbilder.
- Installations- und Update-Skript für Debian 13 mit automatischem Rückfall, tägliche
  verschlüsselte Sicherung.

### Hinweise für Betreiber

- Erste Installation: `sudo ./posteulen/deploy/install.sh --domain <domain>` (siehe readme.txt).
- **Geheimnis-Datei `/etc/posteulen/secrets.json` sofort extern sichern.**
- Noch keine Anmeldung möglich (folgt in Stufe 1).
