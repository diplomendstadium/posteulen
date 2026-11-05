# PostEulen.de – Fortschritt

**Aktuelle Stufe:** 3 – Eulen, Flug, Karte, Gold (abgeschlossen, wartet auf Feedback und Tag-Signatur)
**Stand:** 2026-11-06

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

### Stufe 2
- Koppeln, Kontakt-Tresor, Sicherheitsnummer, Schlüsselwarnung; Briefe (Signatur, Padding, XChaCha20, HPKE), Mehrfachempfänger, Lesebestätigungen, Chat löschen; Systemchat, Neuigkeiten, Web Push mit SSRF-Schutz und Verifikation, SSE; Ereignis-Warteschlange; Platzhalter-Eule.
- Nachgeholt aus D-50: Systemnachricht „Passwort geändert“, Push-Abo beim Login/Logout löschen.
- Tests: 209 Unit-Tests, 63 E2E-Tests (u. a. zwei Nutzer, simulierter Schlüsseltausch durch den Server), VM-Test 52/52 mit Konto aus Stufe 1 und Brief über alle Updates.

### Nach Stufe 2 (Rückmeldung)
- Web Push repariert (D-64), Argon2id-Messung eingetragen (Pixel 3 XL 964 ms, Laptop 146 ms; F-06 erledigt).

### Stufe 3
- Spiellogik in `shared/game/`: Großkreis, Sonnenstand (SunCalc), Flugsimulation mit Tag/Nacht, Wasser-Regel, Schlafpausen, Küken-Rhythmus, Positionsinterpolation, Neuplanung; Energie, Pflegemaske, Gold-Arithmetik, Eulenzustände.
- Backend: Schema 4 (Eulen, Flüge, Buchungen), Eulenkauf/-pflege, Flugvorschau, Briefe/Gold/Geschenke mit echten Eulen und Begleitbriefen, Umkehren (9.5), Umzug-Neuplanung (9.4.6, Aufruf durch den Wohnortwechsel in Stufe 4), tägliches Gold, Finanzübersicht, Kartendaten; Aushilfseule bis Stufe 4 (D-65).
- Web: Eulen, Menagerie (Kauf), Finanzen, Karte (Tag/Nacht, Eulen, Kontakte), Eulenwahl beim Versand, Bildeinblendungen, Ankunftsbilder in Chat und Systemchat; Kartendaten als eigener Chunk.
- Tests: 286 Unit-Tests (Abdeckung shared/ je Datei ≥ 90 %), 88 E2E-Tests in 4 Browserprofilen, VM-Test 52/52 inkl. Update von `v0.1.0-stufe.2`.

## Offen
- Tag `v0.1.0-stufe.3` signieren und pushen (Auftraggeber, D-28).
- Web Push auf echten Geräten erneut prüfen (nach dem Fix D-64; D-61).
- Freigabe für Stufe 4.

## Nächste Stufe: 4 – Restliche Spielmechanik
Leiheulen (ersetzen die Aushilfseule), Papeterie, Krankheiten inkl. Schutzfrist und grummeligem Bild, Küken inkl. Begleitbrief, Inaktivität, automatische und manuelle Kontolöschung vollständig (inkl. Umkehren bei Löschzustand), Namens- und Wohnortwechsel (inkl. Kursänderung, 9.4.6); Adminpanel: Statistik, Löschfrist, Rundnachricht.
