# PostEulen.de – Fortschritt

**Aktueller Stand:** Version 0.4.0 (fertig; Tag `v0.4.0` signiert der Auftraggeber)
**Stand:** 2026-11-07

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

### Stufe 4
- Leiheulen (Tagesangebot, HMAC-Namen, Verfall), Papeterie, Krankheit (Schutzfrist, Pflegebonus, Behandlung, grummeliges Bild), Eier/Brüten/Küken (Benennen, Verschenkpflicht, Los, Kükenflug, Erwachsenwerden).
- Konten: Namens- und Wohnortwechsel (mit Kursänderung), Löschung mit 24-Stunden-Frist und endgültiger Löschung, Inaktivitätswarnung und automatische Löschung, tägliches Aufräumen.
- Adminpanel: Statistik, Löschfrist, Rundnachrichten.
- Tests: 327 Unit-Tests (Abdeckung shared/ je Datei ≥ 90 %), 110 E2E-Tests in 4 Browserprofilen, VM-Test 52/52 inkl. Update von `v0.1.0-stufe.3`.

### Stufe 5
- Bots je Konto (Erklärbär, Tante, Onkel) mit festen Briefen und Goldsendungen, Bot-Eulen, Briefe an Bots mit 24-Stunden-Sperre, KI-Antworten mit Zusammenfassung und Tageslimit, Bots entfernen; Altkonten erhalten ihre Bots beim Update (D-82).
- Adminpanel: OpenAI-Key (verschlüsselt, nur schreibbar), Modell, Tageslimit, Verbindungstest.
- Tests: 348 Unit-Tests (Abdeckung shared/ je Datei ≥ 90 %), 116 E2E-Tests in 4 Browserprofilen, VM-Test 52/52 inkl. Update von `v0.1.0-stufe.4`.

### Nach Stufe 5 (Rückmeldung)
- Standardmodell `gpt-6-luna`, Token-Budget für Reasoning-Modelle (D-90).

### Stufe 6
- Hilfe (alle Funktionen, FAQ, Google-freies Android, Krisenhilfe), Datenschutzerklärung (Entwurf), Impressum; Hilfe als Wissensbasis des Erklärbärs (D-91).
- Barrierefreiheit: axe-core (WCAG 2.2 AA) an allen Seiten und Screenshot-Zuständen; Namen nie in der Zierschrift; Karte mit überlappungsfreien Beschriftungen und Bot-Raute (D-93, D-95).
- Sicherheits-Review entlang SPEC 6 (`SECURITY-REVIEW.md`): 4 niedrige Funde behoben (u. a. leere Inhalte, Sitzungs-Cookie mit 30 Tagen, D-92, D-94).
- readme.txt final (u. a. Wiederherstellung nach Totalausfall); VM-Test um Totalausfall auf neu installiertem Server erweitert.
- Lage Google-freies Android erneut geprüft: unverändert (D-97).
- Tests: 449 Unit-Tests (Abdeckung 95,1 %, shared/ je Datei ≥ 90 %), 142 E2E-Tests in 4 Browserprofilen (inkl. Barrierefreiheit), VM-Test 63/63: Installation `v0.1.0-stufe.5`, Update, zweiter Lauf, kaputtes Update, `--rollback`, Wiederherstellung auf demselben Server und nach Totalausfall.

### Version 0.1.0
- Stufe 6 freigegeben, Tag `v0.1.0-stufe.6` signiert (auf `10fe7c3`).
- Impressum gekürzt, readme mit Einleitung; Versionswahl der Skripte nach Semantic Versioning (D-98).
- Tests: 453 Unit-Tests, 142 E2E-Tests in 4 Browserprofilen, VM-Test 63/63 inkl. Update von `v0.1.0-stufe.6`.

### Version 0.2.0
- Tag `v0.1.0` vom Auftraggeber signiert (auf `fe1cb43`).
- Umgesetzt nach Rückfragen (Teil K in DECISIONS, D-100 bis D-111): Leiheule in der Eulenwahl, verschiedene Leiheulen-Namen, Löschfrist für Briefe mit Einstellung, Schriftrollen mit Handschriften und Druckschrift-Einstellung, „Neue Post!“, Versionsnummer, Karte (Pixelgrößen, Städte, Landesteile Großbritanniens, Auto-Zoom), 3 Umzüge pro Monat, neuer Pflegebonus, einheitlich „Menagerie“ (Migration 0007), Rechtstexte als Standardtexte, `README.md`, Hilfe und Erklärbär.
- SPEC auf Stand v0.2 gebracht (alle Entscheidungen eingearbeitet, Anhang F).
- Tests: 471 Unit-Tests (Abdeckung 95,3 %, shared/ je Datei ≥ 90 %), 154 E2E-Tests in 4 Browserprofilen, VM-Test 63/63 inkl. Update von `v0.1.0`.

### Version 0.3.0
- Tag `v0.2.0` vom Auftraggeber signiert.
- Designvorschläge (je drei für Briefe und Hintergrund) vorgelegt; gewählt: Briefbogen mit Wachssiegel, Aquarell-Weltkarte. Umgesetzt nach Rückfragen (Teil L in DECISIONS, D-112 bis D-128): längere Briefe (800/15 000), Briefbögen, Weltkarten-Hintergrund und Boxen für jeden Text, Ungelesen ohne Neuladen, Heimkehr mit Bild und Push, Spendenbitte, Update-Nachricht, Flug- und Stangenbilder, getrennte Eulengruppen, Menagerie-Reihenfolge mit Beschreibungen, Freilassen mit Namen, Flugspur mit „Zzz“, Tante nach 5 Minuten, Erklärbär erst nach dem ersten Brief auf der Karte, ausblendbarer Push-Hinweis, Gruppenbild, neue Erklärtexte (Migration 0008).
- SPEC auf Stand v0.3 gebracht (Anhang G); README mit neuen Bildern.
- Tests: 483 Unit-Tests (Abdeckung 95,3 %, shared/ je Datei ≥ 90 %), 178 E2E-Tests in 4 Browserprofilen (u. a. kein Text ohne Box auf allen Seiten), VM-Test 63/63 inkl. Update von `v0.2.0`.

### Version 0.3.1 und 0.3.2
- 0.3.1: Gruppenbild neben der Anmeldung (D-129).
- 0.3.2 nach Rückfragen (Teil M, D-130 bis D-135): Leihen pro Tag (Migration 0009), neue Leiheulen-Namen, kürzeste Route als Vorschlag, Pergament-Texturen ohne Siegel, Gruppenbild auf der Übersicht, README/Hilfe zu Kindern. SPEC auf Stand v0.3.2 (Anhang H).
- Tests auf Wunsch nur die nötigen: Lint, Typen, Unit-Tests (neu: Route, Leihen pro Tag), betroffene E2E-Tests.

### Version 0.4.0
- Nach Rückfragen (Teil N, D-136 bis D-145): Spendenlink auf der Startseite, Leiheulen mit bis zu 5 Empfängern, Tageslohn 3,0/2,0 Gold, Chats öffnen beim neuesten Brief, Gruppenbild gleich hoch wie die Kacheln, quadratische Karte, englische Ansicht mit Fähnchen und Kontosprache (Migration 0010), englische Hilfe, Rechtstexte, Bot-Briefe, Push-Texte, Karte, Artnamen und Leiheulen-Namen, `README.en.md`. SPEC auf Stand v0.4 (8.12, Anhang I).
- Tests: 497 Unit-Tests (Abdeckung 95,5 %, shared/ je Datei ≥ 90 %; neu: Tageslohn, Leiheule mit mehreren Empfängern und Umkehren, Kontosprache, englische Texte), 178 E2E-Tests in 4 Browserprofilen grün, Lint, Typen, `npm audit` ohne Befund; Prüfung im Browser (englische Registrierung, Fähnchen, Einstellungen, Login mit Kontosprache, Karte, Übersicht, Chat, Handy 390 px). VM-Test nicht erneut gelaufen.

## Offen
- Tag `v0.4.0` signieren und pushen (Auftraggeber, D-28).
- OpenAI-Key im Adminpanel hinterlegen und eine echte Bot-Antwort prüfen.
- Web Push auf echten Geräten prüfen (D-61), Google-freies Android auf einem Gerät (D-97).

## Nächster Schritt
v0.4 ist fertig. Weitere Arbeit nur nach neuem Auftrag.
