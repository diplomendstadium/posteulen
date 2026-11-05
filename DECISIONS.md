# PostEulen.de – Entscheidungen

> Format: Nummer · Datum · Entscheidung · Begründung · verworfene Alternativen. Einträge mit **(offen: F-xx)** warten auf die Antwort des Auftraggebers.
> Prüfskripte und Messungen aus Schritt P liefen am 2026-11-05 auf dem Entwicklungsrechner (Debian 13, Node.js 26.13.0).

---

## Teil A – Prüfergebnisse aus Schritt P

### P-1 OPAQUE: `@serenity-kit/opaque` 1.1.0
- **RFC 9807 (final):** ja. 1.0.0 (2025-11-01) hat auf opaque-ke 4.0.0 umgestellt („Synced implementation with RFC 9807“, 2025-10-23). 1.1.0 ergänzt die RFC-Parameter `rfc-recommended`. Ciphersuite: ristretto255 (OPRF und AKE), SHA-512, Argon2id als Key-Stretching.
- **`export_key`:** ja, `client.finishRegistration` und `client.finishLogin` liefern `exportKey` (64 Byte). Getestet: Er ist über Logins hinweg stabil.
- **Argon2id einstellbar:** ja, per `keyStretching: { "argon2id-custom": { memory, iterations, parallelism } }`. Der Standard `memory-constrained` ist m = 2¹⁶ KiB = 64 MiB, t = 3, p = 4, genau die speicherschonende Empfehlung aus RFC 9106 und damit SPEC 5.3. Messung Desktop (p = 1): Registrierung 330 ms, Login 318 ms. Die Handy-Messung folgt in Stufe 1 ([Frage F-06]).
- **Fake-Datensatz für unbekannte Namen:** `server.startLogin` mit `registrationRecord: null` erzeugt (opaque-ke 4: „dummy record is always created to avoid timing attack issues“) eine Antwort gleicher Länge (320 Byte, gemessen). Das OPRF-Ergebnis hängt nur von Server-Setup und Credential-ID ab: Bei gleicher Credential-ID ist es deterministisch, bei anderer verschieden (gemessen). Mit der deterministischen HMAC-Credential-ID aus SPEC 5.3 sind wiederholte Anfragen zum selben unbekannten Namen damit nicht von echten Konten zu unterscheiden. Laufzeit `startLogin` echt 1,9 ms zu Fake 1,8 ms (Mittel aus 200 Aufrufen, im Rauschen). Die DB-Abfrage ist in beiden Fällen dieselbe.
- **Weitere Ergebnisse:** falsches Passwort → `finishLogin` liefert `undefined`. Ein mitgeschnittener `finishLoginRequest` wird gegen einen neuen Server-Zustand abgelehnt (Replay-Schutz).
- **Risiko:** Der Changelog von 1.1.1 (noch nicht auf npm) behebt ein WASM-Speicherleck bei falsch geformten Parametern. Gegenmaßnahme: strikte Schema-Prüfung vor jedem Aufruf (siehe `DEPENDENCIES.md`). Update auf 1.1.1, sobald veröffentlicht.

### P-2 Zusammenspiel der Krypto-Bibliotheken
- **X25519 aus libsodium in hpke-js:** funktioniert. Schlüssel aus `crypto_box_keypair()` lassen sich mit `deserializePublicKey/PrivateKey` in `@hpke/core` 1.x + `@hpke/dhkem-x25519` verwenden. Ein HPKE-Rundlauf mit ChaCha20-Poly1305 hat geklappt (enc 32 Byte, Wrap 48 Byte). Umgekehrt stimmt ein von hpke-js erzeugter öffentlicher Schlüssel mit `crypto_scalarmult_base` überein.
- **HKDF-SHA256 in `libsodium-wrappers-sumo`:** **nein.** libsodium 1.0.22 enthält `crypto_kdf_hkdf_sha256_*` zwar in der WASM-Datei, die JavaScript-Hülle 0.8.4 stellt aber nur die Konstanten bereit, nicht die Funktionen. SPEC 4.1 nennt HKDF bei libsodium; das trifft für diese Hülle nicht zu → **[Frage F-01]**, Vorschlag D-02.
- **ISO 7816-4-Padding:** `sodium.pad`/`unpad` arbeiten wie erwartet (100 → 4 096, 4 095 → 4 096). Inhalte müssen höchstens Blockgröße − 1 Byte lang sein; das ist gegeben (Architektur 2.4).

### P-3 Node.js und Datenbank
- **LTS-Hauptversion:** Node.js **26** („Lithium“, LTS seit 2026-10-28, Support bis 2029-04-30). Node 24 ist seit 2026-10-20 nur noch in Wartung (Ende 2028-04-30) → D-01.
- **Signierte Quelle für Debian 13:** NodeSource-APT-Quelle `deb.nodesource.com/node_26.x nodistro main` (amd64 und arm64, Paket 26.13.0-1nodesource1), eingebunden mit `signed-by` und dem NodeSource-Schlüssel. Das ist die auf nodejs.org verlinkte Paketquelle. Das Debian-Paket (Node 20) ist veraltet (SPEC 4.1).
- **Native Abhängigkeiten vermeiden:** ja. `node:sqlite` (Node 26: Stabilität 1.2 „Release Candidate“, SQLite 3.54.0) unterstützt `DatabaseSync`, vorbereitete Statements, `secure_delete`, `foreign_keys` und `backup()` (getestet) → D-05, **[Frage F-02]**. Die übrigen Werkzeuge mit Binärteilen (Rolldown in Vite, sharp) bringen vorkompilierte Pakete für amd64 und arm64 mit; auf dem Server wird nichts kompiliert.

### P-4 Bekannte Sicherheitslücken
- `npm audit` über alle geplanten Pakete (2026-11-05): **Laufzeit 0 Funde.** Entwicklung: `minimatch` (mittel, behoben in 11.0.1) und `deepmerge` (niedrig, ohne Korrektur), beide nur in Lint/Build → **[Frage F-03]**.
- `@serenity-kit/opaque` 1.1.0: Speicherleck bei falsch geformten Eingaben (siehe P-1).
- `web-push` 3.6.7: kein Advisory. Die eingebaute `sendNotification` liest die Antwort aber ohne Größenlimit und löst DNS selbst auf. Deshalb nutzen wir sie nicht für den Versand (D-06).
- `suncalc` 2.1.2 wurde am Prüftag veröffentlicht. Nach D-10 wird 2.1.1 verwendet.

### P-5 Web Push auf Google-freiem Android (11.7), Stand 2026-11
- **IronFox** (aktuell 159.0.1, UnifiedPush-AC 1.0.8 seit 157.0) und **Fennec F-Droid** unterstützen Web Push über UnifiedPush. IronFox empfiehlt als Verteiler-App **Sunup** (ntfy geht ebenfalls). Der Menüpfad ist unverändert: IronFox → IronFox-Einstellungen → Verschiedenes („Misc“) → „Use UnifiedPush“, danach Neustart des Browsers.
- IronFox **blockiert Benachrichtigungsanfragen standardmäßig**: Datenschutz und Sicherheit → Website-Einstellungen → Berechtigungen → Benachrichtigungen → „Erlauben erfragen“.
- **GrapheneOS + IronFox:** Für Benachrichtigungen im Hintergrund muss eventuell der Exploit-Schutz „Dynamic code loading via storage“ für IronFox erlaubt werden (IronFox-FAQ).
- Bekannter Fehler (gemeldet 2026-07-14): UnifiedPush-AC verarbeitet Benachrichtigungen nicht, wenn die App über eine Push-Benachrichtigung geöffnet wird. Für PostEulen unkritisch, weil die App beim Öffnen ohnehin vollständig abgleicht (11.6).
- **Vanadium/Chromium ohne Play-Dienste:** weiterhin kein Web Push (FCM). Mit „Sandboxed Google Play“ und Chrome funktioniert es (Akku-Ausnahme für die Play-Dienste nötig).
- Folge: Hilfe-Text wie SPEC 11.7, ergänzt um die drei Punkte oben. Erneute Prüfung vor Stufe 2 und vor Stufe 6, dann möglichst im Android-Emulator mit IronFox und Sunup.
- Quellen: ironfoxoss.org/docs/faq, ironfoxoss.org/releases, f-droid.org (2026-01-08, „5 years of UnifiedPush“), discuss.grapheneos.org.

### P-6 Svelte und CSP (6)
- Svelte 5.57 setzt dynamische Styles über das CSSOM (`element.style`) und Übergänge über die Web Animations API. Beides ist mit `style-src 'self'` erlaubt. Zu vermeiden sind statische `style="…"`-Attribute in Templates, weil sie beim Einfügen von Template-HTML als Inline-Style blockiert würden.
- Trusted Types: Svelte legt eine Policy `svelte-trusted-html` an (ohne eigene Prüfung) und nutzt sie für sein Template-HTML → mit `require-trusted-types-for 'script'; trusted-types svelte-trusted-html` vereinbar (D-07).

### P-7 web-push und SSRF-Schutz (11.3)
- `web-push` erlaubt eigene `https.Agent`s, liest Antworten aber unbegrenzt. `generateRequestDetails()` liefert Endpunkt, Header (VAPID, Verschlüsselung) und verschlüsselte Nutzlast, ohne etwas zu senden. Damit ist der SSRF-Schutz vollständig umsetzbar (D-06).

---

## Teil B – Entscheidungen

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-01 | 2026-11-05 | Node.js 26 LTS aus NodeSource (`node_26.x`, `signed-by`) | längster Support (bis 2029-04), signierte offizielle Quelle, amd64 und arm64 | Node 24 (nur noch Wartung); Debian-Paket (Node 20); Tarball-Installation (keine Updates über apt) |
| D-02 | 2026-11-05 | HKDF-SHA256 über WebCrypto (`crypto.subtle.deriveBits`, leeres Salt, `info` = Kontext-String) in Browser und Node | etablierte, geprüfte Implementierung in jedem Zielbrowser und in Node; mit RFC-5869-Testvektor 1 geprüft | rohe WASM-Exporte von libsodium (fehleranfällige manuelle Speicherverwaltung); zusätzliche Bibliothek `@noble/hashes` (neue Abhängigkeit) |
| D-03 | 2026-11-05 | Argon2id fest m = 65 536 KiB, t = 3, p = 4 als `argon2id-custom` (identisch zum aktuellen Standard der Bibliothek, aber explizit) | ändert die Bibliothek ihren Standard, wären sonst alle Logins kaputt; Werte erfüllen SPEC 5.3 und RFC 9106 | `rfc-recommended` (2 GiB, für Handys ungeeignet) |
| D-04 | 2026-11-05 | Backend als TypeScript direkt mit Node-26-Type-Stripping ausführen; `erasableSyntaxOnly`; Typprüfung mit `tsc --noEmit` | kein Build-Schritt fürs Backend, einfachere Updates und Fehlersuche | `tsx`/esbuild-Build (zusätzliche Abhängigkeit, Quellkarten nötig) |
| D-05 | 2026-11-05 | `node:sqlite` statt better-sqlite3, hinter einer dünnen eigenen Schicht (`backend/db/`) | keine native Kompilierung auf dem Server (16.1); getestet: `secure_delete`, Fremdschlüssel, `backup()`; Wechsel bliebe auf eine Datei begrenzt | better-sqlite3 (natives Modul, Prebuilds nicht für jede Node-Version garantiert) |
| D-06 | 2026-11-05 | Push-Versand: `web-push.generateRequestDetails()` für VAPID und Verschlüsselung, Versand mit eigenem `https.request`: Host nur https:443; DNS einmal auflösen; alle Adressen gegen gesperrte Bereiche prüfen (`node:net` BlockList: privat, Loopback, Link-Local, CGNAT, Multicast, Dokumentation, IPv4-mapped, ULA usw.); Verbindung per `lookup`-Override an genau die geprüfte IP; SNI = Hostname; keine Weiterleitungen; Timeout 10 s; Antwort höchstens 4 KiB | erfüllt 11.3 vollständig | `sendNotification` (liest unbegrenzt, löst selbst auf) |
| D-07 | 2026-11-05 | CSP wie SPEC 6 plus `require-trusted-types-for 'script'; trusted-types svelte-trusted-html`; Lint verbietet `{@html}` und statische `style`-Attribute; Playwright schlägt bei jeder CSP-Verletzung fehl | Trusted Types laut SPEC 6 SOLL; Svelte unterstützt es (P-6) | ohne Trusted Types |
| D-08 | 2026-11-05 | Service Worker selbst schreiben (App-Hülle cachen, Push, Bestätigung, Versionswechsel) | wenige Zeilen, volle Kontrolle, keine große Abhängigkeit | `vite-plugin-pwa`/Workbox (groß, mehr Angriffsfläche) |
| D-09 | 2026-11-05 | Kartenvorverarbeitung als eigenes Werkzeug `tools/map/` (eigene `package.json`, nicht auf dem Server installiert); Ergebnisse (Geometrie, Land/Wasser-Maske, Quell-Prüfsummen) liegen im Repository | Server-Build bleibt klein und braucht keine Natural-Earth-Downloads; reproduzierbar | Vorverarbeitung bei jedem Server-Build; `mapshaper` (zieht `better-sqlite3`) |
| D-10 | 2026-11-05 | Abhängigkeiten: exakte Versionen, `npm ci --ignore-scripts`, neue Versionen erst ab 14 Tagen Alter (Sicherheitskorrekturen ausgenommen) | Schutz vor kompromittierten Neuveröffentlichungen (Lieferkette) | immer die neueste Version |
| D-11 | 2026-11-05 | TypeScript 6.0.3 statt 7.0 | typescript-eslint 8.72 unterstützt höchstens TypeScript < 6.1 | TypeScript 7 (Lint wäre nicht möglich) |
| D-12 | 2026-11-05 | Ein Node-Prozess, zwei Listener (Nutzer-API 127.0.0.1:3001, Admin-API 127.0.0.1:3002) mit getrennten Routern | Admin-Routen sind über die Nutzer-Domain technisch unerreichbar; ein Prozess teilt sich Warteschlange und DB-Verbindung | zwei Prozesse (zwei Schreiber auf SQLite, mehr Betrieb); ein Listener mit Host-Weiche (fehleranfälliger) |
| D-13 | 2026-11-05 | Valibot als Schema-Validator | klein, gut baumbar fürs Browser-Paket, strikte Objekte (`strictObject`) | zod (größeres Browser-Paket) |
| D-14 | 2026-11-05 | Eigene binäre, längenpräfixierte Kodierung für Signatur- und AD-Daten (Architektur 2.3) | eindeutig, einfach testbar; das ist ein Datenformat, keine eigene Kryptografie | JSON-Kanonisierung (RFC 8785, aufwendiger und fehleranfälliger) |
| D-15 | 2026-11-05 | Offene Kontaktanfragen speichern das Ziel als HMAC des Vergleichsschlüssels | Anfragen an nicht existierende Namen hinterlassen keinen lesbaren Namen (2.2); immer gleiche Antwort (8.8) | Ziel als Nutzer-ID (verriete Existenz über das Verhalten, und Namen ohne Konto ließen sich nicht speichern) |
| D-16 | 2026-11-05 | `sharp` für die WebP-Erzeugung beim Build | vorkompiliert für amd64 und arm64, schnell, verbreitet | WASM-Codecs (`@jsquash/*`, langsamer); `cwebp` per apt (mehr Pakete auf dem Server) |
| D-17 | 2026-11-05 | Flüchtige Sicherheitszustände nur im Arbeitsspeicher: Fehlversuche je Name und IP, Reservierungen, OPAQUE-Zustände, Re-Auth- und Vorbereitungs-Tokens, benutzte ALTCHA-Challenges | keine dauerhaften Sperren (5.10), Datensparsamkeit; ein Neustart setzt nur Wartezeiten zurück | Speicherung in der DB |
| D-18 | 2026-11-05 | Fake-Credential-ID = base64url(erste 16 Byte von HMAC-SHA256(K_fake, Vergleichsschlüssel)) – gleiches Format wie echte Nutzer-IDs | SPEC 5.3 | Zufalls-ID je Anfrage (unterscheidbar) |
| D-19 | 2026-11-05 | Login-Fehlversuch wird beim Start gezählt und erst bei erfolgreichem Abschluss zurückgesetzt | Der Server sieht bei falschem Passwort keinen zweiten Request; so verhalten sich bekannte und unbekannte Namen identisch | Zählen erst beim Abschluss (für unbekannte Namen unmöglich) |
| D-20 | 2026-11-05 | OpenAI-Anbindung per `fetch` ohne SDK | eine Handvoll Aufrufe; feste Basis-URL, Timeout und `store: false` lassen sich direkt kontrollieren | offizielles SDK (große Abhängigkeit) |
| D-21 | 2026-11-05 | Logging mit Pino (Fastify-Standard), Redaktion von IP, Headern, Cookies, Bodies; kein Request-Log; Caddy: kein Access-Log, Fehler-Logger per `format filter` ohne `remote_ip`/`client_ip`/Header (Umsetzung wird in Stufe 0 geprüft) | 2.2, 6 | Standard-Logging |
| D-22 | 2026-11-05 | Installations- und Update-Tests in einer QEMU/KVM-VM mit offiziellem Debian-13-Cloud-Image (ohne Root auf dem Entwicklungsrechner möglich, KVM-Zugriff vorhanden) | 17.6; `sudo` steht dem Agenten nicht zur Verfügung, daher kein systemd-nspawn | systemd-nspawn (braucht root) |
| D-23 | 2026-11-05 | `sentAt` (signiert) vergibt der Server beim Vorbereiten; der Flug startet beim Absenden zur Serverzeit; Token ist 5 Minuten gültig | SPEC 5.8; die Abweichung beträgt höchstens die Bedienzeit | Signatur erst nach dem Abflug (bräuchte einen zweiten Rundlauf) |
| D-24 | 2026-11-05 | Sicherheitsnummer: SHA-512 über die kanonische Kodierung, 12 × 5 Byte jeweils `mod 100 000` | SPEC 5.7; bewährtes Verfahren (Signal) | BLAKE2b (gleichwertig, aber weniger verbreitet in WebCrypto) |
| D-25 | 2026-11-05 | Statische Dateien liefert Caddy direkt aus `current/web/dist` und `current/admin/dist`; Node bedient nur `/api` | weniger Last auf Node, Caddy setzt Header und Caching | Fastify-Static |

---

## Teil C – Antworten des Auftraggebers zu Schritt P (2026-11-05)

| Frage | Antwort |
|---|---|
| F-01 HKDF | WebCrypto wie vorgeschlagen (D-02). SPEC 4.1 angepasst. |
| F-02 Datenbank | `node:sqlite` wie vorgeschlagen (D-05). SPEC 4.1 angepasst. |
| F-03 `npm audit` | Laufzeit-Abhängigkeiten: 0 Funde Pflicht. Entwicklungs-Abhängigkeiten: Funde ab „hoch“ blockieren, niedrigere mit Eintrag in `DEPENDENCIES.md`/`DECISIONS.md`. `minimatch` per `overrides` auf ≥ 11.0.1 (D-26). |
| F-04 Ort des Repositorys | Das Repository liegt lokal im Nextcloud-Ordner (`Entwicklungsumgebung/`). Der Auftraggeber pausiert die Synchronisierung, während der Agent arbeitet. Erzeugte Ordner (`node_modules`, `dist`, `coverage`, `test-results`, `playwright-report`) werden nicht synchronisiert (Empfehlung an den Auftraggeber); VM-Abbilder liegen unter `~/.cache/posteulen-vm/`. |
| F-05 Backup-Schlüssel | wie vorgeschlagen: `--backup-pubkey`, sonst einmalige Anzeige und Datei unter `/root` mit Warnung bei jedem Update |
| F-06 Argon2 auf dem Handy | wie vorgeschlagen: Messseite im Testmodus + Schätzung per CPU-Drosselung |
| F-07 Repository | `https://github.com/diplomendstadium/posteulen` (öffentlich, Standardzweig `main`). Der Server klont per HTTPS ohne Zugangsdaten. Der Agent pusht über einen nur für dieses Repository gültigen Deploy-Key mit Schreibrecht (D-27). |
| F-08 Zierschrift | Cinzel Decorative |
| F-09 Fehlversuchszähler | nur im Arbeitsspeicher (D-17) |
| F-10 Signierte Tags | ja. Der Auftraggeber signiert jeden Stufen-Tag selbst mit seinem SSH-Schlüssel (`SHA256:DVR9kntFOoln4Oiqhwn13rEa/wpVDo5gvbV4C6uR900`); der öffentliche Schlüssel liegt in `deploy/allowed_signers`. `posteulen-update --verify-tags` prüft gegen diese Datei (D-28). |
| F-11 OPAQUE-Setup für den Admin | gemeinsames Server-Setup, eigene zufällige Credential-ID |

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-26 | 2026-11-05 | `npm audit`-Regel wie F-03; `minimatch` per `overrides` | Antwort F-03 | – |
| D-27 | 2026-11-05 | Push-Zugang des Agenten über einen Deploy-Key (`~/.ssh/posteulen-github-deploy`, ohne Passphrase, nur dieses Repository, Schreibrecht), eingebunden per repo-lokalem `core.sshCommand`; GitHub-Hostschlüssel gegen den veröffentlichten Fingerabdruck geprüft | geringste Rechte: kein Zugriff auf das übrige GitHub-Konto | persönlicher SSH-Schlüssel oder Access-Token des Kontos (zu weitreichend) |
| D-28 | 2026-11-05 | Tags signiert ausschließlich der Auftraggeber; der Agent bereitet den Befehl vor und signiert nie selbst | Die Freigabe einer Stufe ist zugleich ihre Unterschrift; ein kompromittierter Git-Hoster kann keine Version auf den Server bringen | Signatur durch einen Agenten-Schlüssel (schwächere Aussage) |

---

## Teil D – Entscheidungen in Stufe 0

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-29 | 2026-11-05 | Vor jedem Update bleibt neben der verschlüsselten Sicherung eine **unverschlüsselte** Momentaufnahme in `/var/lib/posteulen/snapshots` (0600, Dienstbenutzer), gelöscht nach 7 Tagen | Der Server besitzt den privaten Backup-Schlüssel absichtlich nicht; ohne Klartext-Kopie wären automatischer Rückfall und `--rollback` (SPEC 16.3) unmöglich. Die Kopie liegt neben der Datenbank mit denselben Rechten, ist also nicht schwächer geschützt; Aufbewahrung wie Backups (7 Tage, SPEC 8.11) | privaten Backup-Schlüssel auf dem Server lassen (würde die Verschlüsselung der Backups entwerten) |
| D-30 | 2026-11-05 | Zweite Trusted-Types-Policy `posteulen-sw`, die genau die URL `/sw.js` erlaubt | Ohne sie blockiert Trusted Types `serviceWorker.register()` (im Browser gefunden) | Trusted Types abschalten |
| D-31 | 2026-11-05 | `.shellcheckrc` schaltet nur SC1111 ab (deutsche Anführungszeichen „…“ in Meldungen) | Die Skripte geben deutsche Meldungen aus (SPEC 16.1); die Zeichen stehen absichtlich in Zeichenketten | englische Anführungszeichen in deutschen Texten |
| D-32 | 2026-11-05 | Symbole in Kacheln und Navigation vorerst als Unicode-Zeichen (u. a. 🦉 als System-Emoji); Ersatz durch eigene SVG-Symbole im Design-Feinschliff (Stufe 6) | Stufe 0 verlangt nur eine leere Hülle; Text steht immer daneben, Symbole sind `aria-hidden` | sofort eigene Symbolsätze zeichnen |
| D-33 | 2026-11-05 | Strikte CSP nur im Produktions-Build (`npm start`, Server); im Entwicklungsmodus (`npm run dev`) ohne CSP | Vite injiziert im Entwicklungsmodus Styles zur Laufzeit; alle E2E-Tests laufen gegen den Produktions-Build mit CSP | Nonces im Dev-Server (zusätzlicher Aufwand ohne Nutzen für Produktion) |
| D-34 | 2026-11-05 | Installation auf dem Server: partieller Git-Klon (`--filter=blob:none`) als Bare-Repository; Releases entstehen per `git archive` | Bilder älterer Versionen werden nicht geladen (F-Bilder: Repository wird groß); Releases enthalten kein `.git` | vollständiger Klon (lädt die komplette Bildhistorie) |
| D-35 | 2026-11-05 | `minimatch` per `overrides` auf 11.0.4 (2026-11-02), Ausnahme von D-10 als Sicherheitskorrektur | GHSA-g3hv-75wg-m249 | warten, bis die Version 14 Tage alt ist |
| D-36 | 2026-11-05 | shellcheck 0.10.0 auf dem Entwicklungsrechner per `apt-get download` aus der signierten Debian-Quelle, entpackt nach `~/.cache/posteulen-tools` (kein root nötig) | `npm test` prüft die Skripte; Server brauchen shellcheck nicht | Binärdatei von GitHub (keine signierte Quelle) |
| D-37 | 2026-11-05 | v0.1 hat **17 Eulenarten** – genau die mit vollständigen Bildern. Entfernt: Bindenfischeule, Perlkauz, Rauhfußkauz, Rußeule, Schwarzbindeneule, Steinkauz, Uhu, Zwergohreule. Die Dateien „Mähnenkauz-…“ und „Weißgesichtseule-…“ wurden in die Bildnamen aus Anhang B umbenannt („Maehnenkauz“, „Suedliche-Weissgesichtseule“); die Art heißt weiter „Südliche Weißgesichtseule“. SPEC 8.7 und Anhang B angepasst | Anweisung und Antworten des Auftraggebers (2026-11-05); ein Test prüft, dass für jede Art alle sieben Bilder unter dem exakten Namen vorliegen | Build tolerant für Umlaute machen |

---

## Teil E – Entscheidungen in Stufe 1

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-38 | 2026-11-05 | Kartenwerkzeug `tools/map/build.ts` ohne Abhängigkeiten (eigene Rasterung, Douglas–Peucker, Rechteck-Zuschnitt, LAEA-Projektion in `shared/map/projection.ts`); Natural Earth 5.1.2 per SHA-256 festgeschrieben (`tools/map/sources.json`). Ersetzt den Plan aus D-09 (eigene `package.json` mit d3/topojson) | keine zusätzlichen Pakete; die Algorithmen sind kurz und getestet (Projektions-Rundlauf, bekannte Orte) | d3-geo, topojson, mapshaper |
| D-39 | 2026-11-05 | Standard-Registrierungsmodus nach Installation: **geschlossen** | sicherer Ausgangszustand; der Admin öffnet bewusst | offen oder nur mit Einladung |
| D-40 | 2026-11-05 | ALTCHA mit SHA-256, geheimer Zähler bis 50 000 (im Mittel 25 000 Hashes), 10 min gültig, jede Lösung nur einmal; eigene kleine Oberfläche statt Widget (`altcha-lib` im Browser) | keine Inline-Styles des Widgets, CSP bleibt strikt; Ablauf prüft altcha-lib gegen die Systemuhr | ALTCHA-Widget; PBKDF2/Argon2 als PoW (auf Handys zu langsam) |
| D-41 | 2026-11-05 | Fehlversuche je IP großzügiger als je Name: Captcha ab 10, Wartezeit ab 20 Fehlversuchen (je Name: 3 bzw. 5 wie SPEC 5.10) | viele Menschen können sich eine IP teilen (Mobilfunk, NAT); je Name greifen die SPEC-Werte | gleiche Schwellen wie je Name |
| D-42 | 2026-11-05 | `GET /api/session` (Nutzer und Admin) antwortet beim App-Start ohne 401, wenn niemand angemeldet ist; geschützte Endpunkte antworten weiter mit 401 und Grund | ein fehlender Login ist beim Start kein Fehler; die E2E-Tests schlagen bei jedem Konsolenfehler an | 401 beim Start und Fehler im Test ignorieren |
| D-43 | 2026-11-05 | Lokale Vorschau über http://localhost nutzt Cookie-Namen `pe_session`/`pe_admin` ohne `Secure`; über HTTPS (Server) immer `__Host-…` mit `Secure` | `__Host-` verlangt HTTPS; nicht jeder Browser erlaubt es auf http://localhost | HTTPS mit eigenem Zertifikat lokal |
| D-44 | 2026-11-05 | Lokale Vorschau: Admin mit Erstpasswort in `data/admin-erstpasswort.txt`; für automatische Tests optional gelockerte Rate-Limits (`POSTEULEN_PREVIEW_RELAXED_LIMITS=1`, nur im Entwicklungsmodus, sonst Abbruch) und eine zweite Instanz für Admin-Tests | E2E-Tests registrieren viele Konten von einer IP; Moduswechsel dürfen andere Tests nicht stören | Limits im Code abschalten |
| D-45 | 2026-11-05 | Einladungscodes: 12 Zeichen aus 31 gut lesbaren Zeichen (≈ 59 Bit), Format XXXX-XXXX-XXXX; gespeichert HMAC + letzte 4 Zeichen als Hinweis für die Liste | SPEC 13: leicht abtippbar, Anzeige offener Codes; die 4 Zeichen helfen ohne HMAC-Schlüssel nicht beim Raten | gar kein Hinweis (Liste wäre nicht unterscheidbar) |
| D-46 | 2026-11-05 | Admin-Erstpasswort: 6 Gruppen à 4 Zeichen (≈ 119 Bit) | gut abtippbar, mehr als 15 Zeichen | Wortliste (zusätzliche Daten) |
| D-47 | 2026-11-05 | Admin-Passwortwechsel immer mit frischer Anmeldung (auch beim Pflichtwechsel; die Oberfläche verwendet dafür das eben eingegebene Erstpasswort) | ein einheitlicher, sicherer Ablauf | Wechsel ohne Re-Authentifizierung |
| D-48 | 2026-11-05 | Der Passwortwechsel lehnt ein Schlüsselpaket ab, dessen verschlüsselte private Schlüssel sich geändert haben | SPEC 5.6 Punkt 5: Identitätsschlüssel bleiben unverändert | nur Format prüfen |
| D-49 | 2026-11-05 | Service Worker lädt beim ersten Installieren **nicht** neu, nur bei einem echten Versionswechsel | sonst gingen gerade ausgefüllte Formulare verloren (im E2E-Test gefunden) | immer neu laden |
| D-50 | 2026-11-05 | Folgende Teile von SPEC 5.2–5.6 folgen in späteren Stufen, weil ihre Grundlage noch fehlt: Systemnachricht „Passwort geändert“ (Systemchat, Stufe 2); Push-Abos beim Login löschen (Push, Stufe 2); drei Bots und Tag-0-Brief bei der Registrierung (Stufe 5); Kontolöschung mit 24-Stunden-Frist (Stufe 4; der Login hebt einen Löschantrag bereits auf) | Stufenplan SPEC 18 | Platzhalter-Implementierungen |
| D-51 | 2026-11-05 | Messung Argon2id (64 MiB, t = 3, p = 4) im Browser: Chromium auf dem Entwicklungsrechner 259 ms; **Pixel 3 XL 964 ms**, Laptop des Auftraggebers 146 ms (gemessen vom Auftraggeber über `/messung`). Parameter bleiben (F-06 erledigt) | SPEC 5.3: unter 1 s auf einem älteren Mittelklasse-Handy ist für eine Anmeldung gut vertretbar | p = 1 oder Web Worker (nicht nötig) |
| D-52 | 2026-11-05 | VM-Test: installiert zuerst das Tag der vorigen Stufe, aktualisiert dann; ein Testkonto (registriert über HTTPS mit dem Krypto-Code des Releases) muss sich nach jedem Update, Rückfall und jeder Wiederherstellung anmelden und dieselben Schlüssel entpacken | SPEC 17.6 | nur Datenbankinhalte prüfen |

---

## Teil F – Entscheidungen in Stufe 2

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-53 | 2026-11-05 | Platzhalter-Eule „Postkauz Paul“ (Waldkauz) mit fester Flugzeit 2 min je Empfänger, nacheinander; Zustellung über die Ereignis-Warteschlange | SPEC 18 Stufe 2; echte Flüge folgen in Stufe 3 und ersetzen nur die Ankunftszeit | sofortige Zustellung (würde die Warteschlange nicht prüfen) |
| D-54 | 2026-11-05 | Die eigene offene Kontaktanfrage speichert den angefragten Namen nur verschlüsselt mit dem Tresor-Schlüssel des Anfragenden („label“); der Server sieht nur HMAC und Chiffrat | SPEC 8.8 verlangt die Anzeige „unbestätigt“ mit Name und Restzeit, D-15 keine lesbaren Namen nicht existierender Konten | Name lesbar speichern; Liste nur lokal führen (geht bei Gerätewechsel verloren) |
| D-55 | 2026-11-05 | SSRF-Prüfung der Push-Adressen mit eigenem Präfixvergleich (IPv4/IPv6 inkl. IPv4-mapped) statt `node:net.BlockList` | `BlockList` meldete in Kombination der Regeln auch öffentliche IPv4-Adressen (8.8.8.8) als gesperrt (im Test gefunden) | BlockList |
| D-56 | 2026-11-05 | Push-Nutzlast enthält nur `{id, type}`; die sichtbaren Texte stehen im Service Worker (beim Build aus `texts/de.ts` eingesetzt, ein klassischer Service Worker kann nicht importieren) | SPEC 11.2: keine Namen und Inhalte im Push | Text im Push mitschicken |
| D-57 | 2026-11-05 | Push-Versand in einer eigenen Warteschlange im Speicher (4 parallel); nicht gesendete Pushes werden nach einem Neustart erneut versucht (bis 24 h) | Netzwerkzugriffe gehören nicht in Datenbank-Transaktionen | Push als Ereignis der Warteschlange |
| D-58 | 2026-11-05 | „Neuigkeiten“ = Benachrichtigungen ohne bestätigten Push; sie verschwinden mit der Bestätigung des Service Workers oder beim Anzeigen auf der Übersicht | SPEC 11.5 | getrennte Tabelle |
| D-59 | 2026-11-05 | Tresor-Einträge haben eine Versionsnummer, die nur wachsen darf (der Server lehnt kleinere ab); der Browser vergleicht vor jedem Senden die vom Server gelieferten Schlüssel mit dem Tresor und meldet Abweichungen | SPEC 5.7; Schutz gegen Zurückspielen alter Einträge | – |
| D-60 | 2026-11-05 | Gold-Abbuchung für großes Pergament ohne Eintrag in der Transaktionsliste – die Liste kommt mit der Finanzübersicht in Stufe 3 | SPEC 18 | vorgezogene Finanzübersicht |
| D-61 | 2026-11-05 | Web-Push-Ende-zu-Ende ist in den automatischen Tests nur mit nachgebildetem Push-Dienst geprüft (Unit-Tests); echte Zustellung über Mozilla/Google/UnifiedPush muss auf einem Gerät erfolgen | Playwright-Browser können keine echten Push-Abos anlegen | – |
| D-62 | 2026-11-05 | E2E-Tests ignorieren in WebKit nur die Meldung „… /api/… due to access control checks“ (abgebrochene gleiche-Origin-Anfragen beim Seitenwechsel) | WebKit-Eigenheit; gleiche Origin kann CORS nicht verletzen | Fehlerprüfung in WebKit abschalten |
| D-63 | 2026-11-05 | Lage Web Push auf Google-freiem Android vor Stufe 2 erneut geprüft: unverändert (IronFox 159.0.1, UnifiedPush-AC 1.0.8); Test im Emulator steht aus (kein Android-Emulator auf dem Entwicklungsrechner) | SPEC 11.7 | – |

---

## Teil G – Fehlerbehebung nach Stufe 2 (Rückmeldung des Auftraggebers)

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-64 | 2026-11-06 | **Fehler:** Kein Web Push kam an, die Anzeige blieb bei „wird geprüft …“. **Ursache:** Die Verbindung zur geprüften IP nutzt einen eigenen `lookup`; Node ruft ihn mit `{ all: true }` auf und erwartet eine Liste – die Antwort im alten Format ließ jede Anfrage mit „Invalid IP address“ scheitern. Zusätzlich galt ein nie bestätigter Test unbegrenzt als „läuft“. **Behebung:** `lookup` beantwortet beide Formen; neuer Test gegen einen echten lokalen TLS-Server (SNI/Host, keine Weiterleitungen, falsches Zertifikat); der Test gilt nur 60 s bzw. bis zum Fehlschlag als laufend; der Service Worker bestätigt den Empfang auch, wenn die Anzeige scheitert; ein E2E-Test schickt ein Push-Ereignis in den Service Worker und erwartet „aktiv und bestätigt“ | Rückmeldung des Auftraggebers; die bisherigen Tests prüften nur Ablehnungen, nicht den Erfolgsweg | – |
