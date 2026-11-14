# PostEulen.de – Abhängigkeiten

> Stand: Version 0.9.0 (2026-11-14); keine neuen npm-Pakete gegenüber 0.6.1 – `sharp` ist seit 0.8 zusätzlich Laufzeitabhängigkeit des Backends; seit 0.9 kommt auf dem Server das Debian-Paket `tor` für den Onion-Dienst dazu; die Schriften Dancing Script und Playwrite DE Grund nutzt seit 0.8 auch das Bots-Kontrollzentrum (Vorschau). Alle Versionen sind im Lockfile exakt gepinnt (`package-lock.json`). Regel für die Versionswahl: die neueste Version, die mindestens 14 Tage alt ist; Ausnahmen nur für Sicherheitskorrekturen. Alle Lizenzen sind OSI-anerkannt bzw. für Schriften die SIL OFL 1.1.
> `npm audit` vom 2026-11-14: Laufzeit-Abhängigkeiten **0 Funde**. Entwicklungs-Abhängigkeiten: 2 niedrige Funde, beide `deepmerge` über `@sveltejs/vite-plugin-svelte` (siehe unten). Regel: Laufzeit 0 Funde Pflicht, Entwicklung blockiert ab „hoch“.
> Vollständige Liste aller indirekten Pakete mit Lizenz: `npm run deps:report` (Lizenzen MIT, Apache-2.0, ISC, BSD-2/3-Clause, MPL-2.0, LGPL-3.0-or-later (libvips in sharp, Build und seit v0.8 Bilder der Bots), BlueOak-1.0.0, 0BSD, OFL-1.1).

## Laufzeit – Backend

| Paket | Version | Lizenz | Zweck |
|---|---|---|---|
| Node.js | 26.x LTS „Lithium“ (Entwicklung: 26.13.0) | MIT | Laufzeit; eingebaut genutzt: `node:sqlite`, `node:crypto`, WebCrypto, Type-Stripping |
| `fastify` | 5.12.7 | MIT | HTTP-Server, Routing, Schema-Hooks |
| `@fastify/cookie` | 11.1.3 | MIT | Cookies lesen und setzen |
| `pino` | über Fastify | MIT | strukturiertes Logging mit Redaktion (keine eigene Abhängigkeit, kommt mit Fastify) |
| `valibot` | 1.5.0 | MIT | Schema-Validierung, gemeinsam mit dem Browser (`shared/`, D-13) |
| `@serenity-kit/opaque` | 1.1.0 | MIT | OPAQUE (RFC 9807; auf Basis von opaque-ke 4.0.0) |
| `libsodium-wrappers-sumo` | 0.8.4 (libsodium 1.0.22) | ISC | Ed25519, X25519, XChaCha20-Poly1305, Zufall, Padding |
| `@hpke/core` | 1.9.0 | MIT | HPKE (RFC 9180) |
| `@hpke/dhkem-x25519` | 1.8.0 | MIT | HPKE-KEM DHKEM(X25519, HKDF-SHA256) |
| `@hpke/chacha20poly1305` | 1.8.0 | MIT | HPKE-AEAD ChaCha20-Poly1305 |
| `web-push` | 3.6.7 | MPL-2.0 | VAPID und Nutzlast-Verschlüsselung (RFC 8291/8292); der Versand läuft über einen eigenen HTTPS-Client (D-06) |
| `altcha-lib` | 2.7.0 | MIT | ALTCHA-Challenges erzeugen und prüfen |
| `suncalc` | 2.1.1 | BSD-2-Clause | Sonnenhöhe (Flug Tag/Nacht, Karte). Hinweis: Im npm-Paket fehlt das Feld `license`; die LICENSE-Datei im Repository ist BSD-2-Clause |

Indirekte Laufzeit-Abhängigkeiten: rund 100 Pakete (vor allem Fastify und Pino). Die vollständige Liste mit Lizenzen erzeugt `npm run deps:report` aus dem Lockfile.

## Laufzeit – Browser (Nutzer-PWA und Adminpanel)

| Paket | Version | Lizenz | Zweck |
|---|---|---|---|
| `svelte` | 5.57.2 | MIT | UI-Framework (kompiliert, ohne SSR) |
| `@serenity-kit/opaque`, `libsodium-wrappers-sumo`, `@hpke/*`, `valibot`, `suncalc` | wie oben | wie oben | Client-Kryptografie, Schemas, Kartenanzeige |
| `altcha-lib` | 2.7.0 | MIT | Lösen der Proof-of-Work-Aufgabe im Browser; eigene kleine Oberfläche statt des ALTCHA-Widgets (strikte CSP) |
| `@fontsource/atkinson-hyperlegible-next` | 5.3.0 | OFL-1.1 | Fließtext und alle Namen |
| `@fontsource/cinzel-decorative` | 5.3.0 | OFL-1.1 | Zierschrift für Überschriften (F-08) |
| `@fontsource/dancing-script` | 5.3.0 | OFL-1.1 | Handschrift für eigene Briefe (v0.3, D-112; veröffentlicht 2026-07-19) |
| `@fontsource/playwrite-de-grund` | 5.3.0 | OFL-1.1 | Handschrift für Briefe des Gegenübers (v0.3, D-112; veröffentlicht 2026-07-19) |

## Entwicklung, Build, Tests

| Paket | Version | Lizenz | Zweck |
|---|---|---|---|
| `vite` | 8.3.5 | MIT | Build von `web/` und `admin/` (Rolldown, vorkompilierte Binärdateien) |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | MIT | Svelte in Vite |
| `typescript` | 6.0.3 | Apache-2.0 | Typprüfung (`tsc --noEmit`). Nicht 7.x, weil typescript-eslint dafür noch keine Unterstützung hat (D-11) |
| `svelte-check` | 4.7.7 | MIT | Typprüfung der Svelte-Komponenten |
| `eslint` | 10.13.0 | MIT | Lint |
| `typescript-eslint` | 8.72.0 | MIT | Lint-Regeln für TypeScript |
| `eslint-plugin-svelte` | 3.23.1 | MIT | Lint für Svelte, u. a. `no-at-html-tags` als Fehler |
| `prettier` | 3.9.10 | MIT | Formatierung |
| `prettier-plugin-svelte` | 4.1.1 | MIT | Formatierung von Svelte |
| `vitest` | 5.0.5 | MIT | Unit- und Integrationstests |
| `@vitest/coverage-v8` | 5.0.5 | MIT | Abdeckung |
| `fast-check` | 4.10.2 | MIT | Property-based Tests |
| `@playwright/test` | 1.64.1 | Apache-2.0 | Ende-zu-Ende-Tests, Screenshots (Browser werden nur auf dem Entwicklungsrechner geladen, nie auf dem Server) |
| `@axe-core/playwright` (mit `axe-core` 4.14.0) | 4.14.0 | MPL-2.0 | Automatische Prüfung der Barrierefreiheit (WCAG 2.2 AA) in den E2E-Tests (D-93) |
| `@types/node` | 26.6.5 | MIT | Typen für Node.js |
| `@types/web-push` | 3.6.4 | MIT | Typen für web-push |
| `@eslint/js` | 10.0.1 | MIT | Grundregeln für ESLint |
| `globals` | 17.13.0 | MIT | Liste globaler Bezeichner für ESLint |
| `sharp` | 0.35.5 | Apache-2.0 (libvips: LGPL-3.0) | Eulenbilder → WebP beim Build; seit v0.8 auch zur Laufzeit im Backend: Bilder der Bots normalisieren (WebP, ohne Metadaten, SPEC 10.11, D-240); vorkompilierte Binärdatei für amd64 und arm64, nichts wird auf dem Server kompiliert (D-16) |

## Werkzeug Kartendaten (`tools/map/`, nur Entwicklungsrechner)

| Paket / Daten | Version | Lizenz | Zweck |
|---|---|---|---|
| Natural Earth 1:10m / 1:50m (Länder, Land, Seen; ab v0.2 auch „Map Units“ für England/Schottland/Wales/Nordirland und besiedelte Orte) | 5.1.2 | gemeinfrei | Kartengeometrie, Land/Wasser-Maske, deutsche Länder- und Städtenamen (`NAME_DE`), Einwohnerzahlen (`POP_MAX`) |
| Natural Earth 1:110m Land (ab v0.3) | 5.1.2 | gemeinfrei | Weltkarte im Seitenhintergrund (`tools/map/background.ts`) |
Das Werkzeug kommt ohne npm-Abhängigkeiten aus (eigene Rasterung, Douglas–Peucker-Vereinfachung, Rechteck-Zuschnitt, LAEA-Projektion in `shared/src/map/`). Quell-Dateien sind mit SHA-256 in `tools/map/sources.json` festgeschrieben.

## Server (APT, Debian 13)

| Paket | Quelle | Lizenz | Zweck |
|---|---|---|---|
| `nodejs` 26.x | NodeSource `https://deb.nodesource.com/node_26.x nodistro main`, `signed-by` | MIT | Laufzeit |
| `caddy` 2.11.x | Cloudsmith `caddy/stable` (offizielle Caddy-Quelle), `signed-by` | Apache-2.0 | Reverse Proxy, HTTPS, statische Dateien |
| `age` 1.2.1 | Debian | BSD-3-Clause | Verschlüsselung der Backups |
| `tor` 0.4.9.x | Debian (`trixie` bzw. `trixie-security`, Sicherheitsupdates über unattended-upgrades) | BSD-3-Clause (mit `--enable-gpl` gebaut: GPL-3.0 für die PoW-Abwehr) | v0.9: Onion-Dienst (eigene Instanz `tor@posteulen`, SPEC 16.5) |
| `git`, `nftables`/`ufw`, `unattended-upgrades`, `ca-certificates`, `curl`, `gnupg` | Debian | GPL/LGPL/MIT | Betrieb |
| `shellcheck` 0.10.0 | Debian (nur Entwicklung und Test, D-36) | GPL-3.0 | Skriptprüfung |
| `qemu-system-x86`, `xorriso` | Debian (nur Entwicklungsrechner) | GPL-2.0 | VM-Test (D-22) |

## Bekannte Funde (`npm audit`, 2026-11-08)

| Paket | Schwere | Advisory | Weg | Bewertung |
|---|---|---|---|---|
| `minimatch` 10.2.6 | mittel | GHSA-g3hv-75wg-m249 (DoS bei Glob-Mustern) | eslint, typescript-eslint (nur Entwicklung) | **Behoben:** per `overrides` auf 11.0.4 (`package.json`) |
| `deepmerge` 4.3.1 | niedrig | GHSA-gcqx-w48m-w2h4 (Prototype Poisoning) | `@sveltejs/vite-plugin-svelte` (nur Build) | Keine korrigierte Version verfügbar; verarbeitet nur eigene Build-Konfiguration, keine fremden Eingaben |
| `@serenity-kit/opaque` 1.1.0 | – (kein Advisory) | Changelog 1.1.1 (noch nicht veröffentlicht): Speicherleck im WASM bei Aufrufen mit falsch geformten Parametern; nach einigen tausend Aufrufen bricht die Instanz | Laufzeit | Abgefangen: Jede Eingabe wird vor dem Aufruf strikt per Schema geprüft (Typ, Base64url, exakte Länge); was die Bibliothek trotzdem nicht lesen kann (z. B. kein gültiger Punkt), ergibt seit v0.6.1 `400` statt `500` (`backend/src/auth/opaque-guard.ts`). Gemessen (D-178): 60 000 solche Aufrufe → etwa 20 MB mehr Speicher, die Instanz bleibt funktionsfähig. Auf 1.1.1 wechseln, sobald veröffentlicht (Stand 2026-11-08: neueste Version 1.1.0) |
