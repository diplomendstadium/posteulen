# PostEulen.de – Fortschritt

**Aktuelle Stufe:** 1 – Konten und Krypto (abgeschlossen, wartet auf Feedback und Tag-Signatur)
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

### Stufe 1
- Kartenwerkzeug (Natural Earth 5.1.2), Land/Wasser-Maske, Karte mit Zoom/Verschieben/Tastatur, Wohnort-Pin.
- Namensregeln 7.1; Registrierung (Modi, Einladungscodes, ALTCHA), Login/Logout, Einzel-Sitzung, Wartezeiten/Captcha, Schlüsselpaket, IndexedDB-Speicher, Passwortwechsel.
- Adminpanel: OPAQUE-Login, Erstpasswort mit Pflichtwechsel, Reset-Befehl, Registrierungsmodus, Einladungscodes, Fehlerprotokoll.
- 17 Eulenarten (D-37); Messseite `/messung` für Argon2id.
- Tests: 166 Unit-Tests (u. a. Fuzzing aller Auth-Endpunkte), 54 E2E-Tests in 4 Browserprofilen, VM-Test 43/43 inkl. Update von `v0.1.0-stufe.0`.

## Offen
- Tag `v0.1.0-stufe.1` signieren und pushen (Auftraggeber, D-28).
- Argon2id-Messung auf einem Mittelklasse-Handy (Seite `/messung`, F-06).
- Freigabe für Stufe 2.
- Eulenbilder vollständig: 17 Arten × 7 Bilder = 119 Dateien (D-37).

## Nächste Stufe: 2 – Kontakte und Briefe
Vorher: Stand von Web Push auf Google-freiem Android erneut prüfen (SPEC 11.7). Dann Koppeln, Kontakt-Tresor, Sicherheitsnummer, Schlüsselwarnung, Briefe inkl. Pergament und Padding, Mehrfachempfänger, Lesebestätigungen, Chat löschen, Systemchat, PWA, Push mit Verifikation, SSE; Ereignis-Warteschlange; nachgeholte Teile aus D-50 (Systemnachricht „Passwort geändert“, Push-Abos beim Login löschen).
