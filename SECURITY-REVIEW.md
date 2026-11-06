# Sicherheits-Review PostEulen v0.1 (Stufe 6)

**Stand:** 2026-11-06, Version `0.1.0-stufe.6`
**Umfang:** SPEC 6 (Web- und Serversicherheit) vollständig, dazu die Schutzziele aus SPEC 3. Geprüft wurden Quelltext, Konfiguration (Caddyfile, systemd), Skripte und das laufende System (Tests, VM).
**Methode:** Jede Anforderung gegen den Code geprüft. Wo möglich gibt es einen automatischen Test, der sie dauerhaft absichert (Spalte „Nachweis“). Neue Funde wurden sofort behoben und mit Tests versehen.

## Ergebnis in Kürze

- Alle MUSS-Anforderungen aus SPEC 6 sind umgesetzt und automatisch getestet.
- Das Review fand **4 Schwachstellen niedriger Schwere**. Alle sind behoben (B-1 bis B-4).
- **4 Hinweise** sind bewusst akzeptiert, mit Begründung (H-1 bis H-4).
- Keine hohen oder mittleren Funde.

## 1. Anforderungen aus SPEC 6

| # | Anforderung | Umsetzung | Nachweis | Status |
|---|---|---|---|---|
| 1 | Strikte Schemaprüfung jeder Eingabe, keine unbekannten Felder | `valibot` mit `strictObject` für alle Anfragedaten. Pfadparameter laufen über `Id`- bzw. Zahl-Schemas. Endpunkte ohne Nutzdaten lehnen jeden Inhalt außer `{}` ab (neu, B-1). | `backend/test/routes.test.ts` (Inventar aller 94 Endpunkte), `fuzz.test.ts` (Zufallseingaben, nie 500) | ✔ |
| 2 | Höchstens 64 KiB je Anfrage, Briefversand 128 KiB, nur JSON | Fastify `bodyLimit`; nur `/api/letters/send` hat 128 KiB; der `text/plain`-Parser ist entfernt | `http.test.ts` (413/415) | ✔ |
| 3 | Autorisierung bei jedem Endpunkt | Außer 14 ausdrücklich öffentlichen Endpunkten (Anmeldung, Registrierung, Health, Version, Push-Bestätigung) verlangen alle 80 Endpunkte eine Sitzung. Objekte werden immer mit `owner_id`/`holder_id` des Nutzers abgefragt, Kontakte über bestätigte, aktive Beziehungen. IDs sind 128 Bit zufällig. | `routes.test.ts`: jede Route aus dem Quelltext → 401 ohne Sitzung; die Liste der öffentlichen Endpunkte ist festgeschrieben. Berechtigungstests je Bereich in `letters`, `owls`, `stage4`, `bots` | ✔ |
| 4 | SQL nur mit Parametern | Alle Abfragen verwenden `?`-Platzhalter. Nur zwei Stellen setzen Text ein, beide ausschließlich feste Werte: Spaltenname aus zwei Literalen (`warn_lo`/`warn_hi`) und die Migrationsnummer aus dem Dateinamen | Quelltext-Durchsicht (Skript über alle `run/get/all/exec`) | ✔ |
| 5 | CSRF: SameSite=Strict, Pflicht-Header, Origin-Prüfung | Cookie `SameSite=Strict`. Ändernde Anfragen brauchen den Header `x-posteulen: 1` und den exakten Origin. Fetch-Metadata (`Sec-Fetch-Site`) wird geprüft, weil App und Admin dieselbe Site sind | `http.test.ts` | ✔ |
| 6 | CSP ohne Inline und fremde Quellen; Trusted Types | CSP wie SPEC plus `require-trusted-types-for 'script'`, eine zentrale Definition für Caddy und Vorschau | E2E-Wächter: jeder E2E-Test schlägt bei CSP-Verstoß oder fremder Anfrage fehl (4 Browserprofile) | ✔ |
| 7 | HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP | Zentrale Header-Definition (`shared/src/security/headers.ts`); HSTS 2 Jahre inkl. Subdomains | `shell.spec.ts`, `texts-headers.test.ts`, VM-Prüfung über HTTPS | ✔ |
| 8 | Nutzer- und Bot-Text nur als Text; nur http(s)-Links, vollständig angezeigt, `noopener noreferrer nofollow` | Keine `{@html}`/`innerHTML` (ESLint-Regel verbietet sie). `LetterText` verlinkt nur http(s) und zeigt die URL vollständig. Textregeln entfernen Richtungs- und unsichtbare Zeichen auch beim Empfänger | ESLint, `letter.test.ts`, `stage6.spec.ts` (Impressum-Link) | ✔ |
| 9 | Ausgehende Verbindungen nur zu OpenAI (feste URL) und Push mit SSRF-Schutz | Nur zwei Stellen bauen Verbindungen auf: `bots/ai.ts` (feste Basis-URL, `redirect: 'error'`, 60 s Timeout) und `push/transport.ts` (DNS einmal auflösen, private und reservierte Bereiche ablehnen, Verbindung an die geprüfte IP, keine Weiterleitungen, Timeout, Größenlimit) | `push-transport.test.ts` (SSRF-Fälle), `bots.test.ts` | ✔ |
| 10 | Fehlerantworten ohne Interna | Eigener Fehler- und 404-Handler mit festen Codes; unerwartete Fehler → `{code:'internal'}` | `http.test.ts` | ✔ |
| 11 | Logs ohne IP, Namen, Inhalte, Schlüssel, Tokens, API-Keys | Fastify ohne Request-Log, Redaktion und leere Serializer. Caddy ohne Access-Log, Fehlerlog filtert IP, Port, Header, TLS und IP-Muster. Das Fehlerprotokoll im Adminpanel enthält nur feste Texte | `log.test.ts`, VM-Prüfung „Kein Access-Log“ | ✔ (H-1) |
| 12 | systemd-Härtung | Alle in SPEC 6 geforderten Optionen und weitere (`ProtectProc`, `RestrictNamespaces` …), kein `MemoryDenyWriteExecute`. Node lauscht nur auf localhost | VM: `systemd-analyze security` ≤ 2,5 (gemessen 1,5), Dienstnutzer, Ports | ✔ |
| 13 | Lockfile gepinnt, `npm audit` im Testbefehl | `package-lock.json`, exakte Versionen; `npm test` prüft Laufzeit (0 Funde Pflicht) und Entwicklung (ab „hoch“) | `scripts/test-all.ts` | ✔ (H-3) |
| 14 | Statische Dateien mit Hash, Service Worker versioniert | Vite `[name]-[hash]`; der SW cacht mit Versionsnamen, alte Caches werden gelöscht. Veraltete Clients bekommen `409 client_outdated` und eine Aufforderung zum Neuladen | `pwa.spec.ts`, `http.test.ts` (`client_outdated`) | ✔ |

## 2. Schutzziele aus SPEC 3 (Stichproben)

| Bedrohung | Maßnahme | Nachweis |
|---|---|---|
| Datenbankdiebstahl | OPAQUE (kein Passwort-Hash in der DB); OPRF-Schlüssel nur in der Geheimnis-Datei; Hauptschlüssel und private Schlüssel nur verschlüsselt; Sitzungen nur als SHA-256; Einladungscodes und Namenssperren nur als HMAC; OpenAI-Key mit XChaCha20-Poly1305 | `crypto`- und `auth`-Tests, `admin.test.ts` |
| Neugieriger Admin | Adminpanel ohne Nutzerliste, Briefe oder Änderungsfunktionen; Briefe zwischen Menschen Ende-zu-Ende-verschlüsselt und signiert | `admin.test.ts`, `letters.test.ts` |
| Passwort-Raten | Wartezeiten je Konto und IP (nur im Speicher), Captcha ab 3 Fehlversuchen, Fake-Records für unbekannte Namen mit deterministischer ID | `auth.test.ts` |
| Sitzungsdiebstahl | `__Host-`-Cookie, HttpOnly, Secure, SameSite=Strict; nur eine Sitzung je Konto; gleitender Ablauf | `auth.test.ts` (neu: Lebensdauer, D-92) |
| XSS | CSP ohne Inline, Trusted Types, nur Textdarstellung | E2E-Wächter, ESLint |
| Andere Nutzer | Server autoritativ; Homoglyphen-Normalisierung; signierte Empfänger-ID gegen Weiterreichen; Schlüsselbindung mit Warnung und Versandsperre | `names.test.ts`, `letter.test.ts`, `letters.test.ts` (Kontakte, Schlüsselwarnung) |
| Prompt-Injection gegen Bots | Briefe sind Inhalt, keine Anweisungen (System-Prompt); Ausgabe gefiltert und gekürzt; keine Kennungen an OpenAI | `bots.test.ts` (prüft jetzt alle IDs der Datenbank gegen die Anfrage) |

## 3. Befunde

| # | Schwere | Befund | Behebung |
|---|---|---|---|
| B-1 | niedrig | 18 ändernde Endpunkte ohne Nutzdaten (z. B. Füttern, Streicheln, Abmelden) ignorierten einen mitgeschickten Inhalt, statt ihn abzulehnen. Das widerspricht „keine unbekannten Felder“; ausnutzbar war es nicht. | Pre-Handler `emptyBody`: nur kein Inhalt oder `{}`; Test über alle betroffenen Endpunkte, automatisch aus dem Quelltext ermittelt |
| B-2 | niedrig | IDs im Fehlerprotokoll des Adminpanels wurden mit `Number()` gelesen und akzeptierten z. B. `1e2`. | Striktes Schema (Dezimalzahl ohne Vorzeichen und führende Null); Test |
| B-3 | niedrig | Das Sitzungs-Cookie hatte keine Lebensdauer und konnte beim Schließen des Browsers verschwinden. Die App löscht dann beim nächsten Start alle lokalen Schlüssel (SPEC 5.5); „angemeldet bleiben“ hielt also nicht verlässlich. | Cookie mit `Max-Age` = 30 Tage, erneuert zusammen mit der Serversitzung (höchstens einmal pro Minute); Admin-Cookie bleibt ein Cookie der Browsersitzung (D-92); Tests |
| B-4 | niedrig | Neuer Code dieser Stufe: Ein kaputter Seitenanker (`/hilfe#%E0`) löste im Browser eine Ausnahme aus. | Abgefangen; E2E-Test |

## 4. Bewusst akzeptierte Hinweise

| # | Hinweis | Begründung |
|---|---|---|
| H-1 | Caddys Fehlerlog enthält bei Proxy-Fehlern die angefragte URI, z. B. `/api/chats/<zufällige ID>`. | Keine IP, kein Name, kein Inhalt; die IDs sind zufällig und nur zusammen mit der Datenbank zuordenbar. Ohne URI wären Fehler kaum zu finden. |
| H-2 | Antworten von OpenAI werden ohne eigenes Größenlimit gelesen. | Feste, per TLS geprüfte Adresse, 60 s Timeout, keine Weiterleitungen. Push-Antworten (beliebige Hosts) sind dagegen begrenzt. |
| H-3 | `npm audit`: `deepmerge` (niedrig, ohne Korrektur) in `@sveltejs/vite-plugin-svelte`. | Nur beim Build, verarbeitet nur die eigene Konfiguration; Regel F-03/D-26. Laufzeit: 0 Funde. |
| H-4 | Unerwartete 500-Fehler schreiben `error.message` ins Journal. | Technische Meldungen (z. B. von SQLite) ohne Nutzerdaten. Die Anfragedaten selbst werden nie geloggt. |

## 5. Nicht im Bedrohungsmodell (zur Erinnerung, SPEC 3)

- **Aktiv manipulierter Server oder ausgelieferte Software:** Ein bösartiger Server könnte manipuliertes JavaScript ausliefern. Die Schlüsselbindung und die Sicherheitsnummer schützen nur gegen Schlüsseltausch, nicht gegen manipulierten Code.
- **Vollständige Serverübernahme inklusive Geheimnis-Datei.**
- **Kompromittierte Endgeräte:** Wer das entsperrte Gerät in der Hand hat, kann die Briefe lesen. Das steht so in Hilfe und Datenschutzerklärung.

## 6. Nachtrag Version 0.2.0 (2026-11-06)

Geprüft wurden die neuen und geänderten Stellen; kein neuer Befund.

| Änderung | Prüfung | Nachweis |
|---|---|---|
| Neuer Endpunkt `PATCH /api/account/letters` (Löschfrist, Druckschrift) | Sitzung nötig, striktes Schema (nur 30/90/180/365, Boolean, keine weiteren Felder), löscht nur Kopien des eigenen Kontos | `routes.test.ts` (Inventar, jetzt 95 Endpunkte), `v02.test.ts` |
| Eulen-Referenz `loan:<Art>` beim Versand | Schema erlaubt nur die festen Artnamen; Leihen prüft Angebot, Limit und Deckung serverseitig in derselben Transaktion wie den Abflug | `stage4.test.ts` (nicht angebotene, unbekannte und schon geliehene Arten) |
| Löschung alter Briefe | Gelöschte Briefe werden tatsächlich gelöscht (`secure_delete`); Briefe unterwegs bleiben unberührt | `v02.test.ts` |
| SQL mit eingesetztem Text | Neu: der Spaltenname `sender_has`/`recipient_has` in `letters/retention.ts`, ausschließlich aus einem festen Tupel im Code | Quelltext-Durchsicht |
| Handschriften im Chat | Links, Namen und Metadaten bleiben in der Schrift, in der I/l/1 und O/0 unterscheidbar sind (SPEC 6, 7.1) | `v02.spec.ts`, CSS in `LetterText.svelte` |
| Link auf das Repository | Fester Link aus `shared/src/version.ts`, `noopener noreferrer`, keine Anfrage an fremde Hosts beim Laden | `v02.spec.ts`, E2E-Wächter |
| Migration 0007 (Neuaufbau `owls`) | Zuordnung Flug → Eule bleibt erhalten, `PRAGMA foreign_key_check` leer | `v02.test.ts` |
