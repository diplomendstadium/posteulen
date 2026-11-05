# PostEulen.de – Fortschritt

**Aktuelle Stufe:** 0 – Gerüst (abgeschlossen, wartet auf Feedback und Tag-Signatur)
**Stand:** 2026-11-05

## Erledigt
### Stufe P
- SPEC gelesen; `ARCHITECTURE.md`, `DEPENDENCIES.md`, `DECISIONS.md` (P-1 bis P-7, D-01 bis D-28); Antworten F-01 bis F-11 eingetragen; SPEC 4.1 und 11.7 nach Absprache angepasst.

### Stufe 0
- npm-Workspaces `shared`, `backend`, `web`, `admin`; TypeScript strict, ESLint, Prettier, Vitest, Playwright; `npm start`, `npm run dev`, `npm test`, `npm run test:vm`.
- shared: Konstanten (Anhang A), Eulenarten (B), Namen (D, E), Texte `texts/de.ts`, Sicherheits-Header, HKDF (WebCrypto), Kontext-Strings, Version.
- Backend: `node:sqlite` mit WAL/secure_delete/Fremdschlüsseln, Migrationen mit Schema-Schutz, Geheimnis-Datei (einmalig, nie überschrieben), Prüfsumme Geheimnis-Datei ↔ DB, zwei API-Listener mit Origin-/Header-/Fetch-Metadata-Prüfung, nur JSON, 64 KiB, Fehler ohne Interna, Logging ohne IPs; CLI `setup|migrate|check|caddyfile|backup|version|schema-version`.
- Web/Admin: App-Hülle im Grund-Design (Startseite, Übersicht mit Kacheln und unterer Navigation, Platzhalterseiten), eigener Router, Service Worker (App-Hülle, offline), Offline-Hinweis, Manifest, Icons, Bilder-Pipeline mit Platzhaltern.
- Betrieb: `install.sh`, `posteulen-update` + `update.sh` (Rückfall, `--rollback`, `--check`, `--verify-tags`), `configure.sh`, `backup.sh` (age), systemd-Units (gehärtet, Exposure 1.5), Caddyfile-Generator, `readme.txt` (Entwurf), `CHANGELOG.md`.
- Tests: 44 Unit-Tests, 56 E2E-Tests (Chromium, Firefox, WebKit), VM-Test 32/32.

## Offen
- Tag `v0.1.0-stufe.0` signieren und pushen (Auftraggeber, D-28).
- Freigabe für Stufe 1.
- Eulenbilder: 48 von 175 Dateien vorhanden (Liste: `web/src/generated/owl-images/missing.json` nach dem Build).

## Nächste Stufe: 1 – Konten und Krypto
Kartenwerkzeug und Land/Wasser-Maske, Namensregeln, Registrierung (Modi, Einladungscodes, ALTCHA), Login/Logout, Einzel-Sitzung, Schlüsselpaket, IndexedDB, Passwortwechsel, Wohnort-Pin; Adminpanel: Login, Erstpasswort, Reset, Registrierungsmodus, Einladungscodes, Fehlerprotokoll; Argon2-Messseite.
