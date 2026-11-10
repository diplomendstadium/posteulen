# PostEulen.de – Spezifikation v0.8.2

> Diese Datei ist die verbindliche Spezifikation („Quelle der Wahrheit“). Sie liegt als `SPEC.md` im Wurzelverzeichnis des Repositorys. Sie wird nur nach Rücksprache mit dem Auftraggeber geändert. Zusammen mit `PROMPT.md` (Bauauftrag) reicht sie aus, um PostEulen auf dem aktuellen Stand neu zu bauen.
>
> **Stand: Version 0.8.2.** Eingearbeitet sind alle Entscheidungen bis D-276 und die Änderungen der Versionen 0.2 bis 0.8.2 (Übersicht in Anhang F bis K, M, O, P, Q, R, U, V und W; Exportformat der Bots in Anhang S, Abbau von Tante und Onkel in Anhang T). Bis v0.5.1 lagen Entscheidungsprotokoll (`DECISIONS.md`) und Architektur (`ARCHITECTURE.md`) als eigene Dateien im Repository; seit v0.6.0 steht ihr wesentlicher Inhalt hier – Regeln im Text, technische Festlegungen in **Anhang L**, neue Entscheidungen im Protokoll **Anhang N**. Verweise wie „D-64“ in Code-Kommentaren beziehen sich auf das alte Protokoll; es ist in der Git-Historie erhalten (Tag `v0.5.1`, Datei `DECISIONS.md`).

---

## 0. Lesehinweise

- **MUSS** = zwingend. **SOLL** = umsetzen, außer es gibt einen im Entscheidungsprotokoll (Anhang N) dokumentierten guten Grund. **KANN** = optional.
- Prioritäten bei Zielkonflikten: 1. Sicherheit, 2. Korrektheit der Spielregeln, 3. Datensparsamkeit, 4. Ressourcenschonung (Server und Akku), 5. Komfort.
- Alle Zeitangaben und Tagesgrenzen sind **UTC**. „Tag“ ohne Zusatz = UTC-Kalendertag, „Kalenderjahr“ = UTC-Kalenderjahr. Die Oberfläche zeigt Uhrzeiten **seit v0.7.1 in der Ortszeit des fiktiven Wohnorts** (Zeitzone des Landes, mit Sommerzeit, 8.3); ohne Anmeldung (kein Wohnort bekannt) in der Ortszeit des Geräts. Das Adminpanel zeigt die Ortszeit des Geräts.
- Gold wird intern als ganze Zahl in Zehnteln gespeichert (1 Goldstück = 10). Angezeigt wird immer eine Nachkommastelle („3,0 Gold“, in der englischen Ansicht „3.0 gold“).
- Alle Zahlenwerte stehen gesammelt in **Anhang A** und MÜSSEN im Code an genau einer Stelle (`shared/`) definiert sein.

---

## 1. Projekt

- **Name:** PostEulen.de, **Version:** 0.8 (Stand 0.8.2)
- **Idee:** Ein moderner, sicherer, Ende-zu-Ende-verschlüsselter Messenger, der liebevoll so tut, als würde man keine schnöden Nachrichten, sondern Briefe per Eule verschicken. Man kauft, leiht und pflegt Eulen; Flugzeiten hängen von Entfernung, Eulenart, Energie und Tag/Nacht ab.
- **Spiel und sicherer Kommunikationsweg:** PostEulen bewegt sich im Grenzbereich zwischen Spiel und Messenger. Die Spielmechanik ist verspielt, die Kryptografie nicht: Sie ist ernsthaft und auf dem Stand der Zeit (Abschnitt 5). README und Hilfe sagen das ausdrücklich.
- **Plattform:** primär Smartphone (PWA), außerdem Desktop (Linux, macOS, Windows).
- **Sprache:** Oberfläche auf **Deutsch (Standard) und Englisch** (britisches Englisch, ab v0.4, Abschnitt 8.12). Alle Texte zentral: je Sprache eine Datei mit denselben Schlüsseln (`shared/src/texts/de.ts`, `en.ts`; die englische ist gegen den Typ der deutschen geprüft, damit kein Text fehlt), dazu Hilfe, Rechtstexte, Bot-Briefe und Systemtexte je Sprache. Das Adminpanel bleibt deutsch. Code, Bezeichner und Kommentare auf Englisch.
- **Umfang:** v0.7 MUSS alle in diesem Dokument beschriebenen Funktionen enthalten.
- **Bestandteile:** Website für Nutzer (PWA), Website mit Adminpanel, Backend inkl. Datenbank – jeweils in einem eigenen Ordner (4.2).

---

## 2. Leitprinzipien

### 2.1 Sicherheit
- IT-Sicherheit hat höchste Priorität. Es muss so schwer wie irgend möglich sein, ungültige Befehle ans Backend zu schicken oder Spieldaten zu manipulieren.
- **Der Server ist autoritativ.** Der Browser sendet nur Absichten („schicke Eule X mit diesem Brief an Y“). Alle Spielregeln, Kosten, Zeiten, Zufallswürfe und Zustandsübergänge berechnet und prüft ausschließlich der Server. Zufall serverseitig nur aus einem kryptografisch sicheren Zufallsgenerator.
- App, Website und Backend dürfen kein Einfallstor auf den Server oder für Angriffe auf andere Nutzer sein (Details: Abschnitt 6).
- **Eigene Kryptografie-Protokolle oder -Primitive sind verboten.** Nur etablierte, sorgfältig geprüfte Bibliotheken (4.1).

### 2.2 Datensparsamkeit
- Gespeichert wird nur, was für die Funktion zwingend nötig ist. Keine E-Mail, kein Klarname, keine Telefonnummer.
- IP-Adressen werden nie dauerhaft gespeichert, nur flüchtig im Arbeitsspeicher für Rate-Limits. Kein Access-Log im Reverse-Proxy. Auch Fehler- und Systemlogs (Caddy, Node, journald) enthalten keine IP-Adressen; Caddys Logger wird entsprechend gefiltert (er schreibt sonst z. B. bei Proxy-Fehlern die Client-IP ins Journal). Keine User-Agents, keine Fingerprints, keine Analytics, keine Telemetrie.
- Aktivität wird nur als Datum gespeichert (`last_active_date`), nicht als Zeitstempel oder Verlauf.
- Statistiken nur als aggregierte Zähler.
- **Keine Ressourcen von fremden Servern** (Schriften, Bilder, Kartendaten, Bibliotheken): alles selbst gehostet, weil fremde Server IP-Adressen erfahren. Einzige unvermeidbare Ausnahmen: die Push-Dienste (Abschnitt 11) und die OpenAI-API für Bots (nur serverseitig).

### 2.3 Ressourcenschonung
- **Server:** keine minütlichen Rundum-Jobs, sondern eine Ereignis-Warteschlange (4.5). Werte, die sich kontinuierlich ändern (Energie, Position), werden beim Lesen aus Zeitstempeln berechnet. Flugpläne werden beim Abflug einmal vollständig berechnet. Kartenpositionen berechnet der Browser.
- **Smartphone:** keinerlei Abfragen im Hintergrund – im Hintergrund nur Web Push. Im Vordergrund eine Live-Verbindung nur, solange die App sichtbar ist (11.6). Kleine Programmpakete, keine Dauer-Animationen.

### 2.4 Freie Software
- Wo immer möglich freie Werkzeuge, Bibliotheken (OSI-Lizenz) und Daten. Jede Abhängigkeit steht mit Version, Lizenz und Zweck in `DEPENDENCIES.md`. Neue Abhängigkeiten nur, wenn sie deutlich Aufwand oder Risiko sparen.

---

## 3. Bedrohungsmodell

**Geschützt werden MUSS gegen:**
- **Datenbankdiebstahl:** Wer nur die Datenbank (oder ein Backup davon) besitzt, kann keine Briefe zwischen Menschen lesen, keine Passwörter offline durchprobieren, sich nicht als Nutzer anmelden und keine gültigen Sitzungen übernehmen.
- **Neugierigen, aber ehrlichen Admin:** Er kann sich nicht in Nutzerkonten einloggen, sie nicht manipulieren und keine Briefe zwischen Menschen lesen. **Ausdrückliche Ausnahme:** Briefe an und von Bots sowie Systemnachrichten sind unverschlüsselt.
- **Angriffe über das Netz:** Passwort-Raten, Sitzungsdiebstahl, XSS, CSRF, Injection, SSRF, API-Missbrauch.
- **Andere Nutzer:** Zugriff auf fremde Daten, Manipulation von Spielständen, Täuschung (Homoglyphen in Namen, gefälschte Absender, weitergereichte Briefe).

**Nicht im Bedrohungsmodell** (aber kein Grund, es Angreifern leicht zu machen): aktiv manipulierter Server, manipulierte ausgelieferte Softwareversion, Übernahme des gesamten Servers inklusive Geheimnis-Dateien, kompromittierte Endgeräte.

**Für den Server sichtbare Metadaten** (stehen so in der Datenschutzerklärung): wer wem wann schreibt, Kontaktbeziehungen, Pergamentgröße, Zustell- und Lesestatus, fiktive Wohnorte, Spielstände (Gold, Eulen).

---

## 4. Architektur und Technik

### 4.1 Stack (festgelegt)
- Durchgehend **TypeScript** (strict).
- **Backend:** Node.js 26 LTS (Hauptversion fest gewählt; auf Debian 13 aus der signierten NodeSource-Quelle, weil das Debian-Paket mit Node.js 20 veraltet ist) + Fastify. Das Backend läuft als TypeScript direkt per Type-Stripping (kein Build-Schritt, `erasableSyntaxOnly`, Typprüfung mit `tsc --noEmit`). Ein Prozess mit zwei Listenern nur auf localhost: Nutzer-API (127.0.0.1:3001) und Admin-API (127.0.0.1:3002) mit getrennten Routern, sodass Admin-Routen über die Nutzer-Domain technisch unerreichbar sind. Statische Dateien liefert Caddy direkt aus; Node bedient nur `/api`. Logging mit Pino ohne Request-Log und mit Redaktion (6).
- **Datenbank:** SQLite im WAL-Modus, `PRAGMA secure_delete = ON`, Fremdschlüssel aktiv; Zugriff über das in Node.js eingebaute Modul `node:sqlite` (keine native Kompilierung, 16.1); versionierte Migrationen.
- **Nutzer-Website und Adminpanel:** Svelte (aktuelle Version) mit Vite, ausgeliefert als statische Dateien (kein Server-Side-Rendering). Die Nutzer-Website ist eine PWA.
- **Kryptografie:**
  - libsodium (`libsodium-wrappers-sumo`): Ed25519, X25519, XChaCha20-Poly1305, sicherer Zufall, Padding.
  - WebCrypto (`crypto.subtle`, in Browser und Node.js eingebaut): HKDF-SHA256 (die JavaScript-Hülle von libsodium stellt HKDF nicht bereit) und die lokale AES-GCM-Verpackung (5.5).
  - hpke-js (`@hpke/core` und Module): HPKE nach RFC 9180.
  - `@serenity-kit/opaque`: OPAQUE. Die verwendete Version MUSS RFC 9807 (final) umsetzen und den `export_key` liefern (geprüft für 1.1.0); vor einem Versionswechsel wird das erneut geprüft, sonst Rückfrage.
- **Validierung:** valibot mit strikten Objekten (`strictObject`); Schemas liegen gemeinsam in `shared/`.
- **Sonnenstand:** SunCalc oder gleichwertig (freie Lizenz).
- **Web Push:** `web-push` nur für VAPID und Verschlüsselung (`generateRequestDetails`); versendet wird mit eigenem `https.request` und SSRF-Schutz (11.3).
- **Bilder:** `sharp` erzeugt beim Build WebP-Varianten der Eulenbilder.
- **Service Worker:** selbst geschrieben (15).
- **Proof-of-Work-Captcha:** ALTCHA (selbst gehostet).
- **Kartendaten:** Natural Earth (gemeinfrei).
- **Tests:** Vitest, fast-check (Property-based Tests), Playwright (Ende-zu-Ende, Screenshots), axe-core (Barrierefreiheit).
- **Schriften:** Atkinson Hyperlegible Next, Cinzel Decorative, Dancing Script, Playwrite DE Grund (alle OFL, über `@fontsource`, selbst ausgeliefert).
- **Betrieb:** Debian 13, Caddy (Reverse Proxy, automatisches HTTPS über Let's Encrypt), systemd. Kein Docker in Produktion. Installation und Updates mit je einem Befehl per Skript (Abschnitt 16).

### 4.2 Repository-Struktur
```
/backend     Fastify-Server, Datenbank, Ereignis-Warteschlange, Bots, Push
/web         Nutzer-Website (PWA)
/admin       Adminpanel (v0.8: mit dem gemeinsamen Sprachbaustein und der Anmeldung, die auch das Kontrollzentrum nutzt)
/bots        Bots-Kontrollzentrum (v0.8, 10.12)
/shared      gemeinsame Typen, Schemas, Konstanten, Krypto-Formate, reine Spiellogik
/deploy      Installations- und Update-Skript (16), Caddyfile, systemd-Units, Setup- und Backup-Skripte
/images      Originalbilder der Eulen (vom Auftraggeber geliefert, 9.2.6)
/e2e         Ende-zu-Ende-Tests (Playwright, 17.4)
/scripts     Start, Entwicklungsmodus, Testbefehl, Abhängigkeitsbericht
/tools/map   Vorverarbeitung der Kartendaten (nur Entwicklungsrechner, 12.2)
/docs/readme Bilder für das README (16.4)
README.md  README.en.md   Projektbeschreibung und Installationsanleitung (16.4)
SPEC.md  PROMPT.md  CHANGELOG.md  DEPENDENCIES.md
```
- Im Repository liegt nur, was Bau, Betrieb, Tests oder Dokumentation brauchen. Stufenberichte, Screenshots aus der Bauphase und Arbeitsdateien gehören nicht hinein; Screenshots der Tests landen im ignorierten Ordner `test-results/` (v0.6).
- Spiellogik (Flugplanung, Energie, Wahrscheinlichkeiten, Goldregeln) MUSS als reine, deterministische Funktionen mit injizierbarer Uhr und injizierbarer Zufallsquelle umgesetzt werden. Ausgeführt und maßgeblich ist sie nur auf dem Server; der Browser nutzt dieselben Funktionen nur zur Anzeige (z. B. Positionen auf der Karte).

### 4.3 Domains
- Nutzer-Website und Nutzer-API: `posteulen.de` bzw. `posteulen.de/api/…` (Domain konfigurierbar).
- Adminpanel und Admin-API: eigene Subdomain `admin.posteulen.de` (getrennter Origin, eigenes Cookie).
- **Bots-Kontrollzentrum und Bots-API (v0.8):** eigene Subdomain `bots.posteulen.de` (getrennter Origin, eigener Port 3003, eigenes Cookie `__Host-pe_bots`, eigenes Passwort und eigene Sitzungen, 10.12).
- Alle drei Origins sind „same-site“; SameSite-Cookies schützen also nicht zwischen ihnen. Deshalb prüft jede API den Origin-Header exakt auf ihren eigenen Origin, und CORS ist nirgends freigeschaltet.
- Nur HTTPS; HTTP leitet um; HSTS.

### 4.4 Server-Geheimnisse
Diese Geheimnisse liegen **nicht in der Datenbank**, sondern in einer Datei außerhalb (z. B. `/etc/posteulen/secrets.json`, Besitzer root, Gruppe des Dienstes, Rechte 0640) oder als systemd-Credential:
- OPAQUE-Server-Setup (enthält OPRF-Schlüssel und Server-Schlüsselpaar),
- VAPID-Schlüsselpaar für Web Push,
- ein **Wurzelgeheimnis** (256 Bit Zufall), aus dem per HKDF mit eigenen Kontext-Strings alle weiteren Schlüssel abgeleitet werden: Verschlüsselung des OpenAI-API-Keys, HMAC-Schlüssel für gesperrte Namen (7.6), für die Leiheulen-Namenswahl (9.6), für die Fake-Datensätze unbekannter Namen (5.3) und für Einladungscodes (13), ALTCHA-HMAC-Schlüssel.

Ein Setup-Befehl erzeugt die Datei einmalig. Er **überschreibt eine vorhandene Datei nie** – auch nicht bei erneuter Installation oder bei Updates. Schlüssel, die spätere Versionen brauchen, werden aus dem Wurzelgeheimnis abgeleitet, damit die Datei nach der Installation unverändert bleibt. Muss ein Update sie doch ergänzen, sichert es vorher die alte Fassung und fordert unübersehbar dazu auf, die Datei erneut extern zu sichern. **Ohne Backup dieser Datei kann sich nach einem Serverausfall niemand mehr anmelden** – README und Installations-Skript MÜSSEN das unübersehbar sagen.

### 4.5 Zeitsteuerung: Ereignis-Warteschlange
- Tabelle `scheduled_events` (fällig_um, Typ, Referenz), indiziert nach Fälligkeit.
- Ein einziger Worker im Serverprozess schläft bis zum nächsten fälligen Ereignis (und wird bei neuen, früheren Ereignissen geweckt). Er verarbeitet fällige Ereignisse in zeitlicher Reihenfolge, jedes in einer eigenen Datenbank-Transaktion und **idempotent** (doppelte Ausführung bewirkt nichts doppelt).
- Nach einem Neustart werden überfällige Ereignisse in zeitlicher Reihenfolge nachgeholt. Dabei gilt der Fälligkeitszeitpunkt als logische Zeit (z. B. beginnt die Regeneration einer Eule zum geplanten Ankunftszeitpunkt, nicht beim Nachholen).
- **Verpasste tägliche Jobs** (z. B. nach längerem Ausfall): Das tägliche Gold wird für jeden verpassten Tag einmal gutgeschrieben (an die beim Nachholen aktiven Konten), ebenso sinkt die Motivation einmal je verpasster Nacht (9.3a). Krankheitswurf, Tagesangebot und Inaktivitätsprüfung laufen nur einmal, für den aktuellen Tag.
- Zufall auf dem Server über `crypto.getRandomValues` (53 Bit je Zahl); in Tests ein fester, injizierbarer Generator.
- Tägliches Gold beim Nachholen: eine Buchung je verpasstem Tag; geprüft wird die Aktivität zum Zeitpunkt des Nachholens (Idempotenz über eine Tabelle der gelaufenen Tagesjobs).
- Der Worker schläft höchstens eine Stunde am Stück (`setTimeout` verträgt nur ca. 24,8 Tage; außerdem Schutz bei Uhrsprüngen).
- Ereignistypen u. a.: Zustellung beim Empfänger, Ankunft zu Hause, Spendenbitte (8.4), Ende einer Krankheitsbehandlung, Schlupf, Küken erwachsen, Küken-Verschenkfrist, Küken-Benennfrist, Ende des Verleihs an die Menagerie, Verfall einer Leiheule, Bot-Antwort fällig, geplanter Bot-Brief, geplante Bot-Goldsendung, Verfall einer Kontaktanfrage, endgültige Kontolöschung, tägliche Jobs.
- **Tägliche Jobs (UTC):**
  - 00:00 – Tagesangebot der Menagerie auswürfeln (ohne die Arten der beiden Vortage, v0.7); Motivation aller Eulen von Spielern −10 Prozentpunkte (9.3a)
  - 03:00 – Krankheitswurf; tägliches Gold (v0.7, vorher 15:00)
  - 04:00 – Inaktivitätsprüfung (Warnungen, automatische Löschungen) und Aufräumen (abgelaufene Einladungscodes, abgelaufene Sitzungen von Nutzern und Admin (v0.6.1), Namenssperren, Kontaktanfragen, Einträge im Fehlerprotokoll, deren letztes Auftreten älter als 30 Tage ist, Benachrichtigungen älter als 60 Tage, Pflegeverlauf der Eulen älter als 60 Tage, **Briefe und Systemnachrichten nach ihrer Löschfrist**, 8.4.1, mit Systemnachricht an Betroffene, v0.7)
- Ereignisse je Flug (v0.7): `flight_stop` je Station und `flight_rest_end` für das Ende einer Rast beim Empfänger (8.4).

### 4.6 Datenhaltung
- Gold in ganzzahligen Zehnteln; jede Buchung in einer Transaktion mit Deckungsprüfung (9.1).
- Pro Nutzer werden nur die letzten 20 Transaktionen gespeichert; ältere werden beim Einfügen gelöscht.
- Gelöschte Daten MÜSSEN tatsächlich gelöscht werden (keine „Soft Deletes“ für Nutzerinhalte). `secure_delete` überschreibt sie in der Datei; regelmäßiger WAL-Checkpoint (`TRUNCATE`).
- Backups: Abschnitt 16.

---

## 5. Kryptografie, Anmeldung, Schlüssel

### 5.1 Überblick

| Element | Erzeugt | Gespeichert | Schutz |
|---|---|---|---|
| Passwort | – | nirgends | verlässt das Gerät nie |
| OPAQUE-Registrierungsdatensatz | Browser + Server | DB | OPAQUE |
| Hauptschlüssel (32 Byte, zufällig) | Browser bei Registrierung | DB, nur verschlüsselt | verpackt mit Schlüssel aus OPAQUE-`export_key` (5.4) |
| Identitätsschlüssel Ed25519 (Signatur) und X25519 (Verschlüsselung) | Browser bei Registrierung | öffentliche Teile lesbar in DB; private Teile nur verschlüsselt | verschlüsselt mit einem aus dem Hauptschlüssel abgeleiteten Schlüssel (5.4) |
| Kontakt-Tresor (Schlüsselbindungen, Status „verglichen“) | Browser | DB, nur verschlüsselt | Schlüssel aus Hauptschlüssel abgeleitet |
| Brief-Schlüssel (pro Brief, zufällig) | Browser beim Senden | DB, nur HPKE-verpackt | HPKE an Empfänger und an Absender |

Alles, was der Nutzer braucht, liegt verschlüsselt auf dem Server. Beim Login auf einem neuen Gerät geht kein Schlüssel verloren.

### 5.2 Registrierung
1. Der Nutzer füllt aus: Nutzername, Passwort (2×), Wohnort-Pin, ggf. Einladungscode. Er bestätigt per Häkchen den Hinweis zum Passwortverlust (8.2). Das Proof-of-Work-Captcha läuft automatisch.
2. Der Server prüft den Namen (7.1, inkl. Sperrfristen), den Registrierungsmodus, den Einladungscode (ohne ihn zu verbrauchen) und das Captcha. Er vergibt eine neue, zufällige, unveränderliche **interne Nutzer-ID** (z. B. 128 Bit, Base64url) und reserviert Name und ID für 10 Minuten. **Die OPAQUE-Credential-ID ist diese Nutzer-ID, nicht der Name.**
3. Der Browser führt die OPAQUE-Registrierung durch, erzeugt Hauptschlüssel und Identitätsschlüsselpaare, verschlüsselt die privaten Schlüssel mit einem aus dem Hauptschlüssel abgeleiteten Schlüssel (5.4; XChaCha20-Poly1305, Associated Data = Nutzer-ID + Schlüsseltyp + Formatversion) und verpackt den Hauptschlüssel wie in 5.4 beschrieben.
4. Der Browser sendet Registrierungsdatensatz, öffentliche Schlüssel, verschlüsseltes Schlüsselpaket und Wohnort. Der Server prüft, dass er den Registrierungsdatensatz für Anmeldungen verwenden kann, dass der Ed25519-Schlüssel ein gültiger Punkt ist und dass der X25519-Schlüssel nicht von kleiner Ordnung ist (v0.6.1; sonst entstünde ein Konto, an das niemand schreiben oder mit dem sich niemand anmelden kann). Dann speichert er alles **atomar in einer Transaktion**. Erst jetzt wird der Einladungscode verbraucht. Der Server legt die drei Bots des Nutzers an (Abschnitt 10) und stellt den Tag-0-Brief des Erklärbärs zu (10.2). Startguthaben: 3,0 Gold.
5. Bei Abbruch bleibt nichts zurück (Reservierungen verfallen).
6. Danach: automatische Anmeldung – die Sitzung entsteht in derselben Transaktion wie das Konto, gebunden an die Reservierung aus Schritt 2; ein zweiter OPAQUE-Durchlauf ist nicht nötig. Dann PWA-Anleitung (8.2) und Einrichtung von Push (11.4).

### 5.3 Anmeldung (OPAQUE, RFC 9807)
- **Ablauf:** Name → Server normalisiert (7.1) und ermittelt die Nutzer-ID → OPAQUE-Login mit Credential-ID = Nutzer-ID → bei Erfolg neue Sitzung. Das verschlüsselte Schlüsselpaket wird **erst nach erfolgreichem Abschluss des OPAQUE-Logins** ausgeliefert.
- Weder das Passwort noch eine dauerhaft wiederverwendbare Ableitung davon verlassen je das Gerät. Jede Anmeldung ist ein frischer OPAQUE-Durchlauf; mitgeschnittene Nachrichten erlauben keinen erneuten Login (Replay-Schutz). Zusätzlich läuft alle Kommunikation über HTTPS.
- **Unbekannte Namen** MÜSSEN eine von echten Konten nicht unterscheidbare Antwort erhalten (Fake-Record-Mechanismus der Bibliothek), auch im Zeitverhalten. Dazu verwendet der Server für unbekannte Namen eine **deterministische** Credential-ID (HMAC aus Server-Geheimnis und normalisiertem Namen, im Format echter Nutzer-IDs): Mit einer jedes Mal neuen Zufalls-ID wären wiederholte Anfragen zum selben Namen von echten Konten unterscheidbar. Die eigene Nutzer-ID erfährt der Browser erst nach erfolgreichem Login.
- **Passwort-Härtung** (Key Stretching in OPAQUE): Argon2id mit m = 65 536 KiB, t = 3, p = 4, ausdrücklich festgelegt (nicht der wechselnde Standard der Bibliothek). Gemessen: Pixel 3 XL ca. 1 s, Laptop ca. 0,15 s. Ciphersuite: ristretto255, SHA-512; die Bibliothek (`@serenity-kit/opaque` 1.1) setzt RFC 9807 um.
- Die Fake-Credential-ID ist base64url der ersten 16 Byte von HMAC-SHA256(Schlüssel, normalisierter Name) – dasselbe Format wie echte Nutzer-IDs.
- Ein Fehlversuch wird schon beim Start des Logins gezählt und erst bei erfolgreichem Abschluss zurückgesetzt; so verhalten sich bekannte und unbekannte Namen gleich. Beim Zähler je IP-Adresse nimmt ein erfolgreicher Abschluss genau den Fehlversuch zurück, den sein Start gezählt hat (v0.6.1): Erfolgreiche Anmeldungen vieler Menschen hinter einer Adresse summieren sich nicht, jeder misslungene Versuch zählt weiter.
- OPAQUE-Nachrichten in der richtigen Länge, die die Bibliothek trotzdem nicht lesen kann (z. B. kein gültiger Punkt), beantwortet der Server mit `400 bad_request` – ohne Eintrag im Fehlerprotokoll; der Versuch zählt als Fehlversuch (v0.6.1).
- `GET /api/session` antwortet beim App-Start ohne 401, wenn niemand angemeldet ist; geschützte Endpunkte antworten mit 401 und Grund.
- **Nur eine Sitzung:** Ein erfolgreicher Login beendet sofort alle anderen Sitzungen des Kontos inklusive ihrer Push-Abos. Eine parallele Nutzung auf mehreren Geräten ist nicht möglich.
- Ein Login während der 24-Stunden-Frist einer Kontolöschung (7.5) bricht die Löschung ab; der Nutzer sieht einen Hinweis.
- Schutz gegen Raten: 5.10.

### 5.4 Hauptschlüssel und Trennung der Verfahren
- Der Hauptschlüssel ist zufällig und ändert sich nie. Vom Passwort hängt nur seine Verpackung ab.
- **Verpackungsschlüssel** = `HKDF-SHA256(export_key aus OPAQUE, info = "PostEulen/master-key-wrap/v1")`. Dadurch sind Anmeldung (OPAQUE-Sitzungsschlüssel) und Verschlüsselung kryptografisch getrennt. Verpackt wird mit XChaCha20-Poly1305; Associated Data = Nutzer-ID + Zweck + Formatversion.
- Begründung: Der `export_key` ist nur mit dem OPRF-Schlüssel des Servers berechenbar, und der liegt in der Geheimnis-Datei (4.4), nicht in der DB. Eine gestohlene Datenbank allein ermöglicht deshalb keinen Offline-Angriff auf Passwörter. (Ein separates, aus dem Passwort abgeleitetes Argon2id mit Salt in der DB würde genau das ermöglichen und wird deshalb nicht verwendet.)
- Weitere Schlüssel werden per HKDF aus dem Hauptschlüssel mit eigenen Kontext-Strings abgeleitet (z. B. `PostEulen/identity-keys/v1` für die privaten Schlüssel, `PostEulen/contact-vault/v1` für den Tresor). Der Hauptschlüssel selbst verschlüsselt nichts direkt.

### 5.5 Sitzungen und lokale Schlüsselspeicherung
- **Sitzungs-Token:** 256 Bit Zufall im Cookie `__Host-pe_session` (HttpOnly, Secure, SameSite=Strict, Path=/). In der DB nur als SHA-256-Hash. Gleitender Ablauf nach 30 Tagen ohne Nutzung. Das Cookie hat `Max-Age` = 30 Tage und wird zusammen mit der Serversitzung gleitend erneuert (höchstens einmal pro Minute), damit „angemeldet bleiben“ auch nach einem Neustart des Browsers hält. Das Admin-Cookie bleibt ein Cookie der Browsersitzung (13).
- Lokale Vorschau über `http://localhost`: Cookie-Namen `pe_session`/`pe_admin` ohne `Secure` (`__Host-` verlangt HTTPS); auf Servern immer `__Host-…`.
- **Angemeldet bleiben:** Nach dem Login liegen die privaten Schlüssel und der Tresor-Schlüssel lokal in IndexedDB, zusätzlich verpackt mit einem nicht exportierbaren WebCrypto-AES-GCM-Schlüssel. Der Hauptschlüssel selbst wird lokal nicht gespeichert.
- **Nur eine gültige Sitzung je Konto:** Ein neuer Login beendet jede andere Sitzung desselben Kontos. Das ist zugleich ein **Sicherheitsmerkmal**, das Hilfe und README ausdrücklich nennen (v0.8.2): Benutzt jemand anderes das eigene Passwort, wird man selbst ständig ausgeloggt und merkt es – dann sofort das Passwort ändern (5.6).
- Bei Logout, Sitzungsablauf, Login auf einem anderen Gerät (der Server antwortet dann mit 401) oder Kontolöschung löscht der Browser alle lokalen Daten des Kontos – auch was davon im Arbeitsspeicher liegt (entschlüsselter Kontakt-Tresor, Kontakt- und Chatlisten); Antworten des Servers, die erst danach eintreffen, werden verworfen (v0.6.1). Meldet sich danach ein anderes Konto im selben Tab an, sieht es nichts vom vorigen. Nur bei Sitzungsablauf bleibt das Push-Abo bestehen (11.3).
- Entschlüsselte Briefe werden nie dauerhaft lokal gespeichert, nur im Arbeitsspeicher.
- In Hilfe und Datenschutzerklärung steht ehrlich: Wer das entsperrte Gerät in der Hand hat, kann die Briefe lesen.

### 5.6 Passwortwechsel
1. Der Nutzer gibt das alte und zweimal das neue Passwort ein. Der Browser führt einen frischen OPAQUE-Login mit dem alten Passwort durch (Re-Authentifizierung; liefert ein kurzlebiges Wechsel-Token, z. B. 5 Minuten).
2. Der Browser entpackt den Hauptschlüssel, führt eine neue OPAQUE-Registrierung mit dem neuen Passwort durch und verpackt den **unveränderten** Hauptschlüssel mit dem neuen `export_key`.
3. Der Browser sendet neuen Registrierungsdatensatz und neues Schlüsselpaket in **einer** Anfrage. Der Server prüft den Datensatz wie bei der Registrierung (5.2) und ersetzt beides in **einer** Transaktion; das Wechsel-Token verbraucht er erst nach dieser Prüfung (v0.6.1). Bei Fehler oder Abbruch bleibt der alte Zustand vollständig gültig – das Konto wird nie unbenutzbar.
4. Danach werden alle Sitzungen und Tokens ungültig, auch ihre Live-Verbindungen (11.6) werden beendet (v0.6.1); das aktuelle Gerät erhält eine neue Sitzung und verbindet sich neu. Systemnachricht „Passwort geändert“.
5. Hauptschlüssel und Identitätsschlüssel bleiben unverändert (der Server lehnt ein Schlüsselpaket ab, dessen verschlüsselte private Schlüssel sich geändert haben). Alle alten und unterwegs befindlichen Briefe bleiben lesbar, nichts wird neu verschlüsselt. Weder altes noch neues Passwort noch unverschlüsselte private Schlüssel erreichen den Server.

### 5.7 Kontakt-Tresor, Schlüsselbindung, Sicherheitsnummer
- Bei der gegenseitigen Kontaktbestätigung holt jeder Browser die öffentlichen Identitätsschlüssel des anderen und speichert einen Tresor-Eintrag `{Kontakt-Nutzer-ID, Ed25519-Pub, X25519-Pub, erstmals gesehen, verglichen: false}`. Der Eintrag ist verschlüsselt und authentifiziert (XChaCha20-Poly1305; Associated Data = eigene Nutzer-ID + Kontakt-Nutzer-ID + Eintragsversion), damit der Server Einträge weder lesen noch unbemerkt zwischen Kontakten oder Nutzern vertauschen kann. Ein Eintrag pro Kontakt; der Tresor liegt auf dem Server und übersteht Gerätewechsel. Die Eintragsversion darf nur wachsen; kleinere lehnt der Server ab (Schutz gegen das Einspielen alter Stände).
- Die Bindung gilt dauerhaft zwischen der unveränderlichen Nutzer-ID und den Schlüsseln. Es gibt **keinen legitimen Schlüsselwechsel**.
- Vor jedem Senden und beim Anzeigen empfangener Briefe vergleicht der Browser die vom Server gelieferten Schlüssel mit dem Tresor (beim Anzeigen: beim Öffnen eines Briefwechsels mit einem gebundenen Kontakt, einmal je Besuch der App; v0.6.1). Bei Abweichung: deutliche Sicherheitswarnung in Chat und Adressbuch, **Versandsperre** für diesen Kontakt (Briefe, Begleitbriefe, Gold und Geschenke), Systemnachricht. Weil nur der Browser die Abweichung erkennen kann, meldet er sie dem Server; der Server vermerkt die Warnung an der Kontaktbeziehung, setzt die Versandsperre auch serverseitig durch und erzeugt die Systemnachricht. Auflösen lässt sich das nur durch Entfernen des Kontakts und neues Koppeln (siehe unten). Eine Bestätigung in der App darf nie als unabhängige Identitätsprüfung dargestellt werden.
- **Sicherheitsnummer:** pro Kontaktpaar für beide Seiten identisch, abgeleitet per SHA-512 (mit Kontext-String) über die kanonische Kodierung beider Nutzer-IDs und beider Schlüsselsätze, sortiert nach Nutzer-ID; 12 × 5 Byte jeweils `mod 100 000`. Dargestellt als 60 Ziffern in 12 Fünfergruppen. Knopf „Ich habe die Nummer mit [Name] außerhalb der App verglichen“ setzt `verglichen: true` im Tresor; das Adressbuch zeigt den Status mit Symbol und Text.
- Beim Entfernen eines Kontakts und wenn sein Konto gelöscht wird, bleibt sein Tresor-Eintrag erhalten, markiert als „getrennt“: Die alten Briefe bleiben sichtbar (7.7, 8.8) und müssen weiter prüfbar sein. Gelöscht wird der Eintrag erst zusammen mit dem Chat (8.4).
- Beim erneuten Koppeln bindet der Browser die jetzt gelieferten Schlüssel. Sind sie dieselben wie bisher, bleibt „verglichen“ erhalten. Sind sie anders, wird „verglichen“ zurückgesetzt, der Browser zeigt einen deutlichen Hinweis, und die bisherigen Schlüssel bleiben im Eintrag, damit ältere Briefe mit den damals gebundenen Schlüsseln prüfbar bleiben.

### 5.8 Briefe: Verschlüsselung und Signatur
Gilt für Briefe zwischen Menschen, einschließlich Begleitbriefen zu Gold-, Eulen- und Kükensendungen (9.1.4, 9.2.7, 9.9). Briefe an und von Bots sowie Systemnachrichten sind immer unverschlüsselt und unsigniert.
- Pro Empfänger entsteht ein **eigener** Brief (eigene Brief-ID, eigener Brief-Schlüssel, eigene Signatur) – auch beim Mehrfachversand. Empfänger sehen einander nicht.
- **Inhalt vor der Verschlüsselung** (kanonisch serialisiert): Formatversion, Brief-ID, Absender-ID, Empfänger-ID, Sendezeitpunkt, Briefart (Brief / Begleitbrief zu Gold / Begleitbrief zu Eule / Begleitbrief zu Küken), Pergamentart, Text.
- **Brief-IDs und Sendezeitpunkt vergibt der Server** (er ist autoritativ, 2.1) in einem vorbereitenden Schritt; das Vorbereitungs-Token ist 5 Minuten gültig und nur einmal verwendbar. Der signierte Sendezeitpunkt ist der des Vorbereitens; der Flug startet beim Absenden zur Serverzeit. Für Signatur und Associated Data gibt es eine eigene binäre, längenpräfixierte, eindeutige Kodierung (ein Datenformat, keine eigene Kryptografie).
- **Signatur:** Ed25519 über eine domänengetrennte Kodierung (`"PostEulen/letter-sig/v1"` + alle obigen Felder). Weil die Empfänger-ID mitsigniert ist, kann ein Empfänger einen Brief nicht als „an Dritte gerichtet“ weiterreichen. Weil die Briefart mitsigniert ist, lässt sich ein Begleitbrief nicht unbemerkt als gewöhnlicher Brief ausgeben und umgekehrt.
- **Verschlüsselung:** erst signieren, dann Inhalt und Signatur gemeinsam verschlüsseln mit XChaCha20-Poly1305 und einem zufälligen 256-Bit-Brief-Schlüssel; Associated Data = Brief-ID + Absender-ID + Empfänger-ID + Briefart + Pergamentart.
- **Schlüsselverteilung:** Der Brief-Schlüssel wird per HPKE (RFC 9180; Modus Base; DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, ChaCha20-Poly1305; `info` enthält Kontext-String, Brief-ID und Rolle) einmal für den Empfänger und einmal für den Absender verpackt, damit der Absender seine gesendeten Briefe lesen kann.
- **Empfang:** Der Browser entschlüsselt, prüft die Signatur mit dem Tresor-Schlüssel des Absenders und prüft, dass Empfänger-ID = eigene ID sowie Brief-ID, Absender-ID, Sendezeitpunkt (v0.6.1), Briefart und Pergamentart = Server-Metadaten und dass der Brief zu dem geöffneten Briefwechsel gehört (Absender bzw. Empfänger ist das Gegenüber, v0.6.1). Bei jedem Fehler wird der Inhalt **nicht** angezeigt. **v0.8.2:** Statt der technischen Meldung „Echtheit nicht prüfbar“ steht beim Empfänger mit 💧 „Der Brief ist unterwegs so nass geworden, dass man ihn nicht mehr lesen kann.“, beim Absender „Die Eule hat den Brief unterwegs verloren.“ (8.4). Den genauen technischen Grund bekommt nur der Admin im Fehlerprotokoll (13 Punkt 7).
- Der Server speichert nur Chiffrat, verpackte Schlüssel und Metadaten. Der Empfänger kann einen Brief erst nach Ankunft der Eule abrufen.

### 5.9 Pergament, Textregeln, Padding
- **Kleines Pergament:** bis 800 Zeichen, kostenlos. **Großes Pergament:** bis 15 000 Zeichen, Aufpreis 0,1 Gold pro Versand (einmal pro Eule, auch bei mehreren Empfängern).
- **Begleitbriefe** (9.1.4, 9.2.7, 9.9) stehen immer auf kleinem Pergament und sind kostenlos.
- Zeichen = Unicode-Codepoints nach NFC-Normalisierung.
- Beim Schreiben entfernt der Browser: Emojis, Steuerzeichen (außer Zeilenumbruch) sowie unsichtbare Formatier- und Richtungszeichen (u. a. U+200B–U+200F, U+202A–U+202E, U+2066–U+2069). Hinweis bei Entfernung: „Pergament kennt keine Smileys.“
- **Als Emoji gilt:** Unicode-Eigenschaft `Extended_Pictographic` (außer ©, ® und ™), dazu Emoji-Modifikatoren, Regional Indicators, U+FE0F und U+20E3. **Nicht** `\p{Emoji}` verwenden – das umfasst auch die Ziffern 0–9, # und *. Alle Textregeln liegen als eine Funktion in `shared/`.
- **Prüfung beim Empfänger:** Weil der Server verschlüsselte Briefe nicht prüfen kann, wendet der empfangende Browser dieselben Textregeln beim Anzeigen erneut an (Schutz vor manipulierten Clients, z. B. Richtungszeichen in Links). Ist ein Text länger als für seine Pergamentart erlaubt, wird der Brief wie ein ungültiger Brief behandelt (5.8).
- **Padding:** Der Klartext (inkl. Signatur) wird mit ISO/IEC-7816-4-Padding auf eine feste Länge aufgefüllt: klein 4 096 Byte, groß 65 536 Byte (Platz für 800 bzw. 15 000 Zeichen à 4 Byte samt Kopf). Der Server prüft beim Versand die exakte Chiffrat-Länge je Pergamentart und lehnt alles andere ab. Große Briefe aus der Zeit vor v0.3 sind auf 16 384 Byte aufgefüllt; der Empfänger akzeptiert für große Briefe beide Längen, sonst keine.
- Briefe an Bots prüft der Server selbst (Zeichenzahl und Textregeln); Antworten der Bots filtert und kürzt er ebenso (10.5).

### 5.10 Schutz vor Raten und Missbrauch
- **Login:** steigende Wartezeiten pro Konto (ab dem 5. Fehlversuch exponentiell bis maximal 15 Minuten) und pro IP-Adresse (nur im Arbeitsspeicher). Keine dauerhaften Sperren, sonst könnte man fremde Konten absichtlich sperren. Ab 3 Fehlversuchen zusätzlich ALTCHA-Proof-of-Work. Wartezeiten und Captcha gelten genauso für unbekannte Namen (Zähler je normalisiertem Namen) – sonst verriete das Verhalten nach Fehlversuchen, ob ein Konto existiert.
- **Gleichzeitige Anfragen (v0.6.1):** Eine Captcha-Lösung gilt genau einmal, auch wenn mehrere Anfragen sie gleichzeitig einreichen; nach der (asynchronen) Prüfung der Lösung schaut der Server erneut auf die Wartezeit, bevor er den Versuch zählt. So lässt sich die Wartezeit nicht durch viele gleichzeitige Versuche umgehen.
- **Volle Zählertabellen (v0.6.1):** Die Tabellen im Arbeitsspeicher (Fehlversuche, Rate-Limits) haben eine feste Obergrenze. Ist sie erreicht, werden nie alle Zähler auf einmal gelöscht (sonst könnte ein Angreifer mit vielen Adressen die Zähler eines angegriffenen Kontos wegspülen), sondern zuerst vergessene, dann solche unterhalb der Captcha-Schwelle und erst zuletzt die am längsten nicht mehr gezählten.
- **IP-basierte Limits:** IPv6-Adressen werden je /64-Präfix gezählt. Je IP sind die Schwellen großzügiger als je Name (Captcha ab 10, Wartezeit ab 20 Fehlversuchen), weil sich viele Menschen eine IP teilen.
- **ALTCHA:** SHA-256, geheimer Zähler bis 50 000 (aus dem kryptografisch sicheren Zufallsgenerator, v0.6.1), 10 Minuten gültig, jede Lösung nur einmal; eigene kleine Oberfläche statt des Widgets (strikte CSP).
- Alle flüchtigen Sicherheitszustände (Fehlversuche, Reservierungen, OPAQUE-Zustände, Re-Auth- und Vorbereitungs-Tokens, benutzte Captcha-Lösungen) liegen nur im Arbeitsspeicher. Die Client-IP kommt aus dem von Caddy gesetzten Header; ihm wird nur bei Verbindungen von localhost vertraut.
- **Registrierung:** Rate-Limit pro IP-Adresse (nur im Arbeitsspeicher) und ALTCHA-Proof-of-Work bei jeder Registrierung. Die Meldung „Name vergeben“ verrät zwangsläufig, dass ein Name existiert; das Rate-Limit bremst systematisches Ausprobieren.
- **Allgemein:** Rate-Limit pro Sitzung und pro IP-Adresse für alle API-Endpunkte; strengere Limits für teure Endpunkte (Login, Registrierung, Flugvorschau, Kontaktanfragen). Push-Abo ändern und Test-Push höchstens 10-mal pro Stunde und Konto (v0.6.1, 11.4).

---

## 6. Web- und Serversicherheit (Mindestanforderungen)

- Jede Eingabe wird serverseitig gegen ein striktes Schema geprüft (Typen, Längen, Wertebereiche, keine unbekannten Felder; Base64url-Felder auch auf eine dekodierbare Länge, also nie 4n + 1 Zeichen, v0.6.1). Ändernde Endpunkte ohne Nutzdaten lehnen jeden Inhalt außer `{}` ab. Ein Test liest alle Routen aus dem Quelltext: Jede nicht ausdrücklich öffentliche Route muss ohne Sitzung 401 liefern. Maximale Request-Größe 64 KiB; nur der Briefversand erlaubt 512 KiB (5 große Briefe ergeben ca. 328 KB Chiffrat, Base64-kodiert ca. 440 KB) und der Brief an einen Bot 128 KiB (Klartext). Die Grenzen stehen als Konstanten in `shared/` (`SECURITY`). Nur JSON.
- **Autorisierung bei jedem Endpunkt:** Das Objekt gehört dem Nutzer bzw. der Nutzer ist berechtigt (bestätigter Kontakt, aktiv, nicht gelöscht). IDs nach außen sind zufällig, nicht fortlaufend.
- SQL ausschließlich mit Parametern.
- **CSRF:** SameSite=Strict-Cookies, Pflicht-Header für alle ändernden Anfragen und Prüfung des Origin-Headers.
- **Content-Security-Policy** ohne Inline-Skripte/-Styles und ohne fremde Quellen, etwa:
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`.
  Zusätzlich `require-trusted-types-for 'script'` mit genau zwei Policies (Svelte-HTML und die URL `/sw.js` für den Service Worker). Lint verbietet `{@html}` und statische `style`-Attribute. Die CSP gilt im Produktions-Build und auf Servern; nur der Entwicklungsmodus mit automatischem Neuladen läuft ohne CSP. Alle E2E-Tests laufen gegen den Produktions-Build mit CSP.
- **Weitere Header:** HSTS (inkl. Subdomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, restriktive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- **Darstellung von Nutzer- und Bot-Text** ausschließlich als Text (nie `innerHTML`/`{@html}` mit Nutzerdaten). Anklickbar werden nur `http://`- und `https://`-Links (`target="_blank" rel="noopener noreferrer nofollow"`, Öffnen im Standardbrowser); angezeigt wird die vollständige URL.
- **Verkleidete Adressen (v0.6.1):** Enthält der geschriebene Host-Teil eines Links Zeichen außerhalb von ASCII (z. B. ein kyrillisches „а“, das wie ein lateinisches aussieht, oder ein breiter Punkt) oder Zugangsdaten vor dem Host (`https://bank.example@andere.example`), zeigt der Link die technische Form der tatsächlichen Adresse (Host in Punycode, ohne Zugangsdaten, z. B. `https://xn--pypal-4ve.com/login`) und daneben den Warnhinweis „Ungewöhnliche Zeichen in der Adresse – genau prüfen, wohin der Link führt.“ Das gilt bewusst auch für echte internationale Domains (`müller.de`). Links, die schon in Punycode geschrieben sind, bleiben unverändert. Die Funktion liegt in `shared/src/links.ts`.
- **Ausgehende Verbindungen des Servers** nur zur OpenAI-API (fest konfigurierte Basis-URL) und zu Push-Endpunkten (mit SSRF-Schutz, 11.3).
- Fehlerantworten verraten keine Interna (keine Stacktraces nach außen). Was ein Client absichtlich falsch schicken kann (ungültige Protokollnachrichten, nicht dekodierbare Felder), ist ein `400`, nie ein `500` – unerwartete Fehler landen im Fehlerprotokoll, und das darf kein Client von außen füllen können (v0.6.1). Für Nutzer gibt es freundliche, verständliche Fehlermeldungen in der Sprache der Ansicht (der Server liefert nur Fehlercodes, übersetzt wird im Browser).
- **Logs** enthalten keine IP-Adressen, Namen, Brief- oder Bot-Inhalte, Schlüssel, Tokens oder API-Keys (Redaktion erzwingen).
- **systemd-Härtung:** eigener Systembenutzer, `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, `ReadWritePaths` nur für das Datenverzeichnis, leere `CapabilityBoundingSet`, `RestrictAddressFamilies`, `SystemCallFilter=@system-service`. (Nicht `MemoryDenyWriteExecute` – das bricht V8/WASM.) Der Node-Prozess lauscht nur auf localhost.
- Abhängigkeiten per Lockfile fest gepinnt; `npm audit` läuft im Testbefehl mit.
- Statische Dateien mit Hash im Dateinamen; Service Worker versioniert.

---

## 7. Benutzerkonten

### 7.1 Nutzername
- 3–20 Zeichen (Unicode-Codepoints; jede Eingabe wird vor allen Prüfungen NFC-normalisiert). Erlaubt sind **abschließend**: lateinische Buchstaben A–Z/a–z, deutsche Umlaute und ß (ohne Großform ẞ), die Akzentbuchstaben à á â ã å æ ç è é ê ë ì í î ï ñ ò ó ô õ ø œ ù ú û und ihre Großformen, Ziffern 0–9, Leerzeichen. Keine Leerzeichen am Anfang oder Ende, keine doppelten Leerzeichen. Andere Schriften (z. B. Kyrillisch) sind nicht erlaubt (Schutz vor Verwechslung).
- **Eindeutigkeit** über einen normalisierten Vergleichsschlüssel, gebildet in dieser Reihenfolge: Akzente entfernen (NFKD), Kleinschreibung, ß→ss, æ→ae, œ→oe, ø→o (explizite Zuordnung für Zeichen ohne Unicode-Zerlegung), danach **leicht verwechselbare Zeichen gleichsetzen:** 0→o, 1→l, i→l. „René“ = „Rene“, „Straße“ = „STRASSE“, „AIex“ (mit großem i) = „Alex“, „J0nas“ = „Jonas“. Groß- und Kleinschreibung spielen also keine Rolle. Die Normalisierung ist eine einzige Funktion in `shared/` und gilt überall, wo Namen verglichen werden (Registrierung, Login, Kontaktanfrage, Namensänderung, reservierte und gesperrte Namen).
- Angezeigt wird der Name so, wie der Nutzer ihn geschrieben hat.
- **Reservierte Namen** (Vergleich über den normalisierten Schlüssel ohne Leerzeichen; die Liste wird mit derselben Funktion normalisiert): administrator, admin, root, moderator, support, system, systemnachrichten, unbekannt, posteulen, posteule, erklärbär, erklaerbaer, bot, papeterie, menagerie, dazu (v0.6) die Namen der englischen Ansicht: explainer bear, system messages, unknown. **v0.8:** Ein Name darf außerdem nicht so heißen wie ein Bot des Kontrollzentrums (gleicher Vergleichsschlüssel, `central_bots.name_key`); umgekehrt bekommt kein Bot den Namen eines Kontos (10.6). Die früheren Reservierungen der Verwandten-Bots entfallen (Anhang T).
- Login und alle internen Bezüge hängen an der unveränderlichen Nutzer-ID, nicht am Namen.

### 7.2 Passwort
- Mindestens 15, höchstens 256 Zeichen. Keine weiteren Kompositionsregeln. Bei Registrierung und Wechsel zweimal einzugeben.
- Das Passwort wird vor OPAQUE NFC-normalisiert (Zeichen = Codepoints danach), damit es mit Umlauten auf jedem Gerät gleich ankommt.

### 7.3 Fiktiver Wohnort
- Gesetzt per Pin auf der Karte (12.4), nur auf Land (nicht im Wasser), gerundet auf 0,01° (≈ 1 km). Hinweis (v0.7.1 neu formuliert): „Überlege sorgfältig, ob du deine echte Adresse wählen möchtest.“ (bis v0.7.0: „Bitte nicht deine echte Adresse wählen.“
- Änderung bis zu **3-mal pro Kalendermonat** (UTC), unabhängig davon, wie kurz die Umzüge aufeinander folgen. Die Wahl bei der Registrierung zählt nicht. Gespeichert werden nur der Monat und die Zahl der Umzüge darin. Laufende Flüge werden angepasst (9.4.6).

### 7.4 Namensänderung
- Einmal pro Kalenderjahr. Alle Kontakte erhalten eine Systemnachricht („Peter heißt jetzt Petra“). Der alte Name ist 90 Tage gesperrt.

### 7.5 Konto löschen (durch den Nutzer)
- In den Einstellungen, mit Passwortbestätigung (frischer OPAQUE-Durchlauf) und Bestätigungsdialog. Danach sofortiger Logout.
- Meldet sich der Nutzer innerhalb von 24 Stunden wieder an, wird die Löschung abgebrochen (Hinweis + Systemnachricht). Sonst beginnt die endgültige Löschung (7.7).
- Während der 24-Stunden-Frist bleibt das Konto für andere unverändert: Lieferungen kommen an, nichts kehrt um. Erst mit Beginn der endgültigen Löschung (7.7) gilt es als „im Löschzustand“ (9.5).

### 7.6 Sperrfristen für Namen
- Namen gelöschter Konten und alte Namen nach einer Umbenennung sind 90 Tage gesperrt. Gespeichert wird nur `HMAC(Server-Geheimnis, normalisierter Schlüssel)` mit Ablaufdatum.

### 7.7 Endgültige Löschung
Ausgelöst durch den Ablauf der 24-Stunden-Frist (7.5) oder durch die automatische Löschung wegen Inaktivität (9.10).
1. Das Konto wird gesperrt (kein Login mehr). Es verschwindet aus allen Adressbüchern, in Chats erscheint es als „unbekannt“. Alle Kontakte erhalten eine Systemnachricht („Das Konto von [letzter Name] wurde gelöscht.“ – passt für beide Auslöser und ist geschlechtsneutral, v0.6).
2. Eulen, die zu diesem Konto unterwegs sind, drehen um (9.5).
3. Lieferungen, die das Konto selbst verschickt hat (Briefe, Gold, Eulen, Küken), kommen noch an, bevor seine Daten gelöscht werden. Eulen des gelöschten Kontos verschwinden nach der letzten Zustellung (kein Rückflug).
   Technisch: Beginn der endgültigen Löschung = Zustand „im Löschzustand“; Kontakte werden entfernt, eigene Flüge verlieren den Heimflug.
4. Sobald keine Lieferung des Kontos mehr unterwegs ist: endgültige Löschung aller Daten des Kontos (Profil, OPAQUE-Datensatz, Schlüssel, Tresor, Sitzungen, Push-Abos, Benachrichtigungen, eigene Briefkopien, Bots samt Chats und Zusammenfassungen, Eulen, Transaktionen, Kontaktbeziehungen). Der Name ist danach 90 Tage gesperrt.
- Was andere empfangen haben (Briefe, Eulen, Gold, Küken), bleibt bei ihnen erhalten.
- Die Statistik „insgesamt erstellte Konten“ ändert sich nicht.

---

## 8. Screens und Funktionen

### 8.1 Startseite (nicht angemeldet)
- Login-Maske (Nutzername, Passwort), „Konto erstellen“, „Hilfe“, „Datenschutz“, „Impressum“, „Spenden“.
- Unten „Hilfe · Datenschutz · Impressum · Spenden“ (v0.4: „Spenden“ verlinkt auf https://ko-fi.com/posteulen, neues Fenster, `noopener noreferrer`; Screenreader hören zusätzlich, dass sich ko-fi.com in einem neuen Tab öffnet), daneben die installierte Versionsnummer (z. B. „v0.3.0“) als Link auf das GitHub-Repository (`REPOSITORY_URL`, neues Fenster, `noopener noreferrer`).
- Neben dem Login das **Gruppenbild** aller Eulenarten auf ihren Stangen (`images/Gruppenbild.png`, 9.2.6); auf dem Handy darunter. **v0.7:** Nebeneinander (ab 48 rem) sind die Box „Anmelden“ und das Gruppenbild gleich breit und gleich hoch und schließen oben und unten bündig ab – das quadratische Bild gibt die Höhe vor, die Box streckt sich darauf (bräuchte sie mehr Platz, füllt das Bild die Höhe mit minimalem Beschnitt).
- **v0.7:** Alle fünf Links der Fußzeile (Hilfe, Datenschutz, Impressum, Spenden, Versionsnummer) haben dieselbe Linkfarbe (vorher war die Versionsnummer grau).

### 8.2 Konto erstellen
- Felder: Nutzername, Passwort, Passwort wiederholen, fiktiver Wohnort (Pin auf der Karte), Einladungscode (nur im Modus „nur mit Einladungscode“). Ist die Registrierung geschlossen, wird das klar angezeigt.
- **Vor dem Absenden** ein deutlicher Hinweis mit Pflicht-Häkchen: „Ich habe verstanden: Wenn ich mein Passwort verliere, sind alle meine Daten unwiderruflich verloren. Das Passwort wird nicht auf dem Server gespeichert, und auch der Admin kann es nicht zurücksetzen.“
- **Danach** die Willkommensseite: eine ausführliche, einfache und augenzwinkernde (nicht flapsige) Anleitung für Menschen, die noch nie von Web-Apps gehört haben. Sie erklärt, dass es Apps auch außerhalb von App-Stores gibt und man PostEulen einfach auf den Startbildschirm legt (kein Hexenwerk, nichts Gefährliches, jederzeit wieder entfernbar), Schritt für Schritt für **Android/Chrome** und **iPhone/Safari** (ab iOS 16.4: Teilen → „Zum Home-Bildschirm“; bei neueren iPhones hinter „•••“), und dass alle anderen (Firefox, andere Handys, Computer) PostEulen als Lesezeichen oder ganz normal im Browser nutzen – einziger Unterschied: keine Push-Benachrichtigungen („Im echten Leben klingelt der Briefkasten ja auch nicht.“). Der Sonderfall Google-freies Android und UnifiedPush kommt hier **nicht** vor (nur in Hilfe und README, 11.7). Anschließend die Push-Einrichtung mit Verifikation (11.4) und ein Verweis auf die Hilfe.

### 8.3 Startseite nach Login
- Bereiche: Briefwechsel, Eulen, Finanzübersicht, Menagerie, Adressbuch, Karte, Einstellungen, Hilfe – auf dem Handy schnell erreichbar (z. B. Kacheln plus untere Navigationsleiste für die wichtigsten Bereiche).
- Kopfbereich (braune Statusleiste): Schriftzug „PostEulen“, Goldstand, ganz rechts das Sprachfähnchen (8.12); Hinweis, falls Push nicht bestätigt ist („Benachrichtigungen sind noch nicht eingerichtet – so geht’s“, Link zu den Einstellungen). Dahinter „Ausblenden bis zur nächsten Anmeldung“: Der Hinweis bleibt dann auf diesem Gerät verborgen (lokal gespeichert) und erscheint nach der nächsten Anmeldung oder Registrierung wieder. Auf der Übersicht steht oben rechts klein am Schriftzug die Versionsnummer (kein Link). **Schmale Handys (v0.6):** Bis 26 rem Breite steht „Neue Post!“ in einer eigenen, zentrierten Zeile unter Schriftzug, Goldstand und Fähnchen, damit nichts aus dem Fenster ragt (vorher schoben ein dreistelliger Goldstand und „Neue Post!“ das Fähnchen bei 320–390 px über den Rand).
- **Gruppenbild auf der Übersicht:** Ab Desktopbreite (64 rem) steht rechts neben den Kacheln (dann zweispaltig) das Gruppenbild der Eulen; auf Handy und Tablet nicht, damit die Kacheln oben bleiben. v0.4: Kacheln und Bild teilen sich die Breite je zur Hälfte und schließen oben und unten bündig ab – das quadratische Bild gibt die Höhe vor, die vier Kachelreihen strecken sich darauf (Kacheln dort mindestens 6 rem hoch); bräuchten die Kacheln einmal mehr Platz, füllt das Bild die Höhe mit minimalem Beschnitt.
- **„Neue Post!“:** Solange es ungelesene Briefe oder Systemnachrichten gibt, zeigt die Statusleiste auf allen Seiten den Text „Neue Post!“ als Link zum Briefwechsel. Die Buchstaben hüpfen nacheinander; die Animation läuft bei jeder neuen Post rund 5 Sekunden (3 Durchgänge) und ruht dann (WCAG 2.2.2). Bei `prefers-reduced-motion` ohne Animation. Screenreader hören „Neue Post! [Anzahl] ungelesen“.
- Nach Login bzw. App-Start: Übersicht „Neuigkeiten“ mit allen Benachrichtigungen, die nicht bestätigt per Push zugestellt wurden (11.5). Sie verschwinden mit der Bestätigung des Service Workers oder beim Anzeigen auf der Übersicht.
- **Begrüßung (v0.7):** Zwischen „Neuigkeiten“ und den Kacheln steht eine waagerechte Box, die den Nutzer geschlechtsneutral mit seinem Namen begrüßt – passend zur Tageszeit an seinem **fiktiven Wohnort**: „Guten Morgen, [Name]!“ (5–11 Uhr), „Guten Tag, [Name]!“ (11–18 Uhr), „Guten Abend, [Name]!“ (18–22 Uhr), „Hallo [Name], du Nachteule!“ (22–5 Uhr); darunter „Bei dir zu Hause ist es gerade [hh:mm] Uhr.“ Maßgeblich ist die Ortszeit der Zeitzone des Landes am Wohnort mit Sommerzeit: Das Kartenwerkzeug erzeugt dafür eine Zeitzonen-Karte des Europa-Ausschnitts (0,1°-Raster, je Land eine IANA-Zone, Meeresfelder bis 0,5° vor der Küste erhalten die Zone des nächsten Landfelds; `shared/src/map/timezones-data.ts`), der Browser rechnet die Uhrzeit mit `Intl` aus (Rückfall: Gerätezeit) und aktualisiert sie jede Minute. Nichts davon wird gespeichert.

### 8.4 Briefwechsel
- **Chatliste** wie in klassischen Messengern: ein Chat pro Gegenüber, sortiert nach letzter Aktivität, mit Ungelesen-Zähler. Sobald Briefe oder Systemnachrichten als gelesen gemeldet sind, gehen Zähler und „Neue Post!“ sofort zurück, ohne Neuladen und auch beim Wechsel über die Navigationsleiste. Angezeigt wird stets der **aktuelle** Name des Gegenübers; nach Kontakttrennung oder Kontolöschung „unbekannt“. Bot-Chats sind optisch deutlich unterscheidbar (Symbol und Text „Bot“, nicht nur Farbe). Der Chat „Systemnachrichten“ ist oben angeheftet.
- **Chatverlauf:** soll nach echten Briefen aussehen, nicht nach Messenger. Jeder Brief ist ein **Pergamentbogen** mit ausgefranstem Rand (eine von sechs festen Randformen, je Brief aus seiner ID gewählt, also bei jedem Anzeigen gleich), leicht schräg, ohne Siegel. Briefe an den Nutzer stehen auf **hellem**, eigene auf **dunklerem Pergament** (Texturen vom Auftraggeber, `web/assets/parchment-light.webp` und `parchment-dark.webp`); auf dem dunklen Pergament steht auch die Kleinschrift in der dunkelsten Tinte (Kontrast AA). Eigene Briefe rechts, die des Gegenübers links, in **zwei verschiedenen Handschriften und Tinten** (eigene: Dancing Script in Sepia; Gegenüber: Playwrite DE Grund, eine deutsche Schulschrift, in Blauschwarz; beide OFL, selbst gehostet). Links, Namen, Zeit, Pergamentart, Status und Begleitbrief-Zusatz stehen immer in der gut lesbaren Druckschrift (Schutz vor Verwechslung, 6, 7.1). Einstellung „Briefe in Druckschrift anzeigen“ (8.10). Je Brief: Zeit, Pergamentart und die überbringende Eule: „Gebracht von [Eulenname] ([Art])“ – **v0.7 auch bei eigenen, gesendeten Briefen** (solange der Brief fliegt: „Unterwegs mit [Eulenname] ([Art])“, bei umgekehrten Briefen nichts). War es nicht die eigene Eule des Betrachters, steht es in der Klammer: „([Art], Leiheule)“ bzw. „([Art], Eule von [Name])“ (bei einer Antwort, die eine rastende Eule mitgenommen hat; „unbekannt“, wenn kein Kontakt mehr); kommt eine Antwort mit der eigenen Eule an, „([Art], deine Eule)“. Die Angaben ergeben sich aus dem Flug des Briefs (`flights.owl_kind`, `holder_id`). Über dem Verlauf ein Hinweis auf die Löschfrist (8.4.1). Sieht der Empfänger einen neu angekommenen Brief zum ersten Mal, wird das Ankunftsbild der Eule eingeblendet (9.2.6); **v0.8.2:** sind es mehrere, erscheinen die Bilder aller neu angekommenen Eulen nacheinander (in der Reihenfolge ihrer Ankunft).
- **Reihenfolge im Verlauf (v0.8.2):** sortiert nach dem **Zeitpunkt, an dem der Betrachter vom Brief erfahren hat**: eigene Briefe nach dem Sendezeitpunkt, empfangene nach dem Empfangszeitpunkt (Ankunft der Eule, `arrives_at`); bei Gleichstand nach Sendezeitpunkt und ID. Beide Seiten können denselben Briefwechsel also in unterschiedlicher Reihenfolge sehen. Bis v0.8.1 war alles nach dem Sendezeitpunkt sortiert, sodass ein lange fliegender Brief weit oben „verschwand“.
- **Nicht lesbare Briefe (v0.5, v0.8.2):** Kann das Gerät des Empfängers einen Brief nicht entschlüsseln oder nicht als echt bestätigen (5.8), meldet es ihn statt als gelesen als **nicht lesbar** (`POST /api/letters/unreadable`, nur Empfänger, nur zugestellte ungelesene Briefe; gespeichert als `letters.unreadable`). **v0.8.2:** Die Meldung nennt den Grund (`reason`: `decrypt`, `signature`, `metadata`, `format`, `length`, `too_long`, `key`, `not_for_me`, `not_mine`, `missing`, `no_keys`; ältere Apps ohne Grund ergeben „unbekannt“); der Server schreibt je Meldung einen Eintrag ins Fehlerprotokoll (Komponente „Briefe (Kryptografie)“, Schweregrad Fehler, konkrete technische Ursache, ohne Namen und IDs). Der Empfänger sieht mit 💧 „Der Brief ist unterwegs so nass geworden, dass man ihn nicht mehr lesen kann.“, der Absender mit 🪶 „Die Eule hat den Brief unterwegs verloren.“ – keine Krypto-Fachbegriffe. Beim Empfänger zählt der Brief nicht mehr als ungelesen. Gemeldet wird erst, wenn der Kontakt-Tresor geladen ist (ohne ihn fehlen die Schlüssel des Gegenübers).
- **Öffnen eines Chats (v0.4, v0.7):** Beim Öffnen eines Chats – auch des Systemchats – springt die Seite sofort zum **Anfang des ältesten noch nicht gelesenen Briefs** (bzw. der ältesten ungesehenen Systemnachricht), der dann knapp unter der Statusleiste steht. Gibt es nichts Ungelesenes, springt sie wie bisher zum **neuesten** Brief (die Liste bleibt chronologisch, älteste oben): Der letzte Brief endet knapp über der unteren Navigationsleiste; ist er höher als der sichtbare Bereich, steht stattdessen sein Anfang oben unter der Statusleiste. Vorher wird auf das Laden der Schriften gewartet (Handschriften ändern die Höhe). Nach dem Absenden eines Briefs scrollt die Seite sanft zum neuen Brief. Spätere Aktualisierungen (neue Post, SSE) scrollen nicht.
- **Begleitbriefe** (9.1.4, 9.2.7, 9.9) erscheinen bei beiden Seiten im Chat wie Briefe, mit dem Zusatz „Begleitbrief zu [Betrag] Gold“, „Begleitbrief zur Eule [Name]“ bzw. „Begleitbrief zum Küken [Name]“, und haben denselben Status. Gold-, Eulen- und Kükensendungen ohne Begleitbrief erscheinen nicht im Chat, sondern nur im Systemchat (Gold zusätzlich in der Finanzübersicht).
- **Status eigener Briefe** (Symbol + Text): „Eule unterwegs – Ankunft ca. [Zeit]“, „zugestellt“ (✔), „Die Eule hat den Brief unterwegs verloren.“ (🪶, siehe oben), „nicht zugestellt – die Eule ist umgekehrt“. **v0.8.2: kein „gelesen“ (✔✔) mehr.**
- **Keine Lesebestätigungen (v0.8.2):** Ob und wann ein Brief gelesen wurde, ist für den Absender **nicht** mehr ersichtlich; die API liefert dem Absender `read: false` (auch bei Briefen an Bots). Intern bleibt nur Ja/Nein für den Ungelesen-Zähler des Empfängers: Ein Brief gilt für ihn als gelesen, sobald er in seinem sichtbaren Chatverlauf angezeigt wurde. Briefe an Bots gelten als gelesen, sobald der Bot seine Antwort verfasst hat (zählt nur in der Statistik des Kontrollzentrums, 10.13). Systemnachrichten haben keinen Lesestatus. Bis v0.8.1 sah der Absender „gelesen“ mit zwei Häkchen.
- **Inhalt:** ausschließlich reiner Text; nur http(s)-Links sind anklickbar und öffnen sich im Standardbrowser – **v0.8.2** nur, solange der Regler „Links in Briefen anklickbar“ in den Einstellungen an ist (Standard: an, 8.10); sonst erscheinen sie als reiner Text. Keine Emojis, Weiterleitungen, Anhänge, Reaktionen oder Bearbeitungen.
- **Neuen Brief schreiben:**
  1. Pergament wählen: klein (bis 800 Zeichen, kostenlos) oder groß (bis 15 000 Zeichen, 0,1 Gold Aufpreis für diesen Brief).
  2. Text schreiben, mit Zeichenzähler.
  3. Empfänger: im Chat vorbelegt; optional weitere hinzufügen (insgesamt max. 5). Bei mehreren Empfängern sortiert die App sie beim Hinzufügen und Entfernen so, dass die Gesamtstrecke vom Wohnort über alle Empfänger zurück nach Hause am kürzesten ist (Großkreise; alle Reihenfolgen werden durchgerechnet, bei gleicher Länge zuerst der nähere Empfänger). Das ist ein Vorschlag mit Hinweis; mit ↑ und ↓ lässt sich die Reihenfolge danach ändern, und der Server fliegt die Reihenfolge, die abgeschickt wird.
  4. **Rast (v0.7):** wie lange die Eule bei jedem Empfänger bleibt, bevor sie weiterfliegt: „Gar nicht“, 1, 2, 24 oder 48 Stunden (vorgewählt: 1 Stunde); eine Einstellung für alle Empfänger. Nur bei Briefen an Menschen (nicht bei Bots, Gold, Geschenken und Küken). Siehe „Rast und Antwort“ unten.
  5. Eule wählen: Liste der einsatzbereiten eigenen Eulen und Leiheulen mit Energie, Geschwindigkeit und vom Server berechneter Vorschau (Ankunft je Empfänger, Rückkehr – mit voller Rast bei jedem Empfänger). Eigene Eulen zuerst; die erste ist vorausgewählt. **v0.7:** Rastet gerade eine Eule des einzigen Empfängers beim Schreibenden, steht sie als **Gast-Eule** ganz oben und ist vorausgewählt („Rastet gerade bei dir (bis …) und bringt deine Antwort direkt zu [Name].“, Ankunft = voraussichtliche Heimkehr der Eule, keine Rast-Auswahl). **v0.8.2:** Bei Leiheulen steht in der Auswahl kein „Fliegt nicht zurück.“ mehr; die Rückkehrzeit steht nur bei Eulen, die zurückkommen.
     **Ist keine Eule einsatzbereit**, bietet die Liste direkt die Leiheulen des Tages an (9.6; seit v0.4 auch bei mehreren Empfängern), soweit der Nutzer sie leihen darf (Limit, eine je Art) und mindestens 0,1 Gold hat – mit Name, Energie und exakter Vorschau. Keine davon ist vorausgewählt. Geliehen und bezahlt wird erst beim Absenden, in derselben Transaktion wie der Abflug; bricht man ab, kostet es nichts und der Brieftext bleibt erhalten. Das gilt ebenso für Goldsendungen (9.1.4) und Briefe an Bots.
  6. Absenden. Beim Abflug wird das Abflugbild der Eule eingeblendet (9.2.6).
- Man kann jemandem schreiben, auch wenn bereits eine Eule zu ihm unterwegs ist.
- **Rast und Antwort (v0.7):**
  - Kommt eine Eule mit Rast beim Empfänger an, wird zugestellt wie immer; danach bleibt sie für die gewählte Zeit dort (Status der Station `resting`, Ereignis `flight_rest_end`). Sie erholt sich wie zu Hause (10 % des Maximums × Erholungsfaktor pro Stunde, ohne Motivation, gedeckelt beim Maximum).
  - **Ankündigung (v0.8.2):** Beginnt die Rast, bekommt der Gastgeber eine Systemnachricht („[Eule] ([Art]), die Eule von [Name], ist zu Besuch und rastet bei dir bis [Zeit]. Unter „Eulen“ kannst du sie pflegen, ihr eine Antwort mitgeben oder sie weiterfliegen lassen.“, Typ `owl_resting`) und einen eigenen Push „Eine Eule rastet bei dir.“ (11.2) – zusätzlich zum Push für den Brief.
  - Der Empfänger sieht sie in seiner Eulenübersicht oben unter „Zu Gast bei dir“ mit dem deutlichen Hinweis „Nur zur Rast hier! Fliegt spätestens [Zeit] weiter.“, mit Bild, Name, Art, Geschlecht, Halter („Eule von [Name]“ bzw. „Leiheule von [Name]“), Energie und Motivation. Er darf sie mit allen vier Pflege-Aktionen pflegen (9.3); Eulenkeks und Leckerli zahlt er, die Tagesgrenzen gelten je Eule. Die Pflege hebt ihre Motivation und zählt als Pflegetag der Eule (Pflegebonus des Halters), Keks und Leckerli geben sofort Energie. Der Halter kann seine Eule währenddessen nicht pflegen.
  - Solange die Eule rastet, kann der Empfänger **einen** Brief an den Absender (Halter der Eule) schreiben und ihr mitgeben – über die Gast-Eule in der Eulenwahl (Owl-Referenz `guest:<Eulen-ID>`). **v0.7.1:** Über den Knopf „Antwort an [Name] mitgeben“ der Gast-Eule öffnet sich der Chat mit dem Halter so, dass genau diese Eule ausgewählt ist: Die Eulenwahl bietet keine anderen Eulen an, und die Rast-Auswahl sowie das Hinzufügen weiterer Empfänger sind ausgeblendet (ist die Eule inzwischen weitergeflogen, Hinweis und normale Auswahl). Öffnet man den Chat auf anderem Weg, steht die Gast-Eule wie bisher oben in der normalen Auswahl. Pergament klein oder groß wie üblich (Aufpreis zahlt er), verschlüsselt wie jeder Brief. Nur an den Absender: Die Empfänger sehen nicht, wen die Eule noch anfliegt. Sobald der Brief abgeschickt ist, fliegt die Eule sofort los (mit Abflugbild), auch wenn die Rast noch nicht vorbei ist. Verstreicht die Rast ungenutzt, fliegt sie von selbst weiter. **v0.8.2:** Über „Weiterfliegen lassen“ (mit Rückfrage) kann der Gastgeber sie auch **ohne Brief** vorzeitig weiterschicken (`POST /api/guests/:id/send-on`, nur der Gastgeber, nur während der Rast); sie fliegt dann sofort mit Abflugbild zum nächsten Empfänger bzw. nach Hause.
  - Bei mehreren Empfängern kann jeder einen Brief mitgeben; die Eule kommt dann mit mehreren Briefen beim Absender an. Antwortbriefe reisen mit der Eule (`letters.flight_id` = ihr Flug, Empfänger = Halter) und werden bei der Heimkehr zugestellt; ihre Ankunftszeit folgt jeder Neuplanung. Die Heimkehr-Einblendung nennt die Zahl („… und hat 2 Antwortbriefe dabei.“), der Push lautet dann „Eine deiner Eulen ist mit Post wieder zu Hause.“ (ein Push für alles). Antworten, die die eigene Eule bringt, lösen im Chat kein zweites Ankunftsbild aus (die Heimkehr zeigt die Eule schon).
  - **Leiheulen** verschwinden nach dem letzten Empfänger, wenn sie keine Antwort erhalten haben (nach der Rast). Haben sie Antworten an Bord, fliegen sie nach der letzten Rast noch zum Absender, liefern die Briefe ab (Systemnachricht „Die Leiheule [Name] hat dir … Antwortbrief(e) gebracht und fliegt jetzt zurück in die Menagerie.“, Push „Brief angekommen“) und verschwinden dann.
  - Wird während der Rast die Verbindung zwischen Halter und Gastgeber gekappt oder beginnt eine Kontolöschung (9.5), fliegt die Eule sofort weiter; Antworten dieses Gastgebers an Bord werden nicht zugestellt („nicht zugestellt – die Eule ist umgekehrt“, Systemnachricht an ihn).
  - Die Karte zeigt rastende Eulen nur ihrem Halter (am Wohnort des Gastgebers), nie dem Gastgeber (12.1).
- **Mehrere Empfänger:** max. 5, Reihenfolge wählbar, mit eigenen Eulen und (seit v0.4) mit Leiheulen, nicht mit Bots. Die Eule fliegt von Kontakt zu Kontakt und kehrt erst nach dem letzten zurück (eine Leiheule verschwindet nach dem letzten, 9.6). Für die Empfänger sieht es so aus, als wäre die Eule nur zu ihnen geflogen. Der Brief erscheint beim Absender in jedem Einzelchat; Empfänger sehen die anderen Empfänger nicht und können nur dem Absender antworten.
- Empfänger müssen bestätigte, aktive Kontakte sein (9.10), und die Schlüsselbindung muss intakt sein (5.7).
- **„Alle Briefe verbrennen“** (v0.7, vorher „Chat löschen“; mit Bestätigungsdialog „Alle deine Briefe in diesem Chat unwiderruflich verbrennen? …“): entfernt die eigenen Kopien aller Briefe des Chats tatsächlich aus der Datenbank; unwiderruflich. Danach wird das Bild der im Kamin brennenden Briefe eingeblendet (`images/Verbrennen.png`, 9.2.6). Das Gegenüber behält seine Kopien. Physisch gelöscht wird ein Brief, sobald ihn keine Seite mehr hat. **v0.7.2:** Briefe, die beim Verbrennen noch **zum Nutzer unterwegs** sind, bleiben unberührt: Sie kommen an und erscheinen im Chat wie jeder neue Brief (bis v0.7.1 wurden sie mit verbrannt, kamen unsichtbar an und zählten trotzdem als ungelesen – „Neue Post!“ ohne sichtbaren Brief, besonders bei Bots, die nach dem Verbrennen weiterschrieben). Die Migration 0016 berechnet alle Ungelesen-Zähler neu. Bei Bot-Chats wird auch die Bot-Zusammenfassung gelöscht. Ist das Gegenüber kein Kontakt mehr, wird mit dem Chat auch sein Tresor-Eintrag gelöscht (5.7).
- **Systemnachrichten:** eigener Chat „Systemnachrichten“. Nachrichten erscheinen sofort (ohne Eulenflug); Antworten sind nicht möglich. Ereignisse: Anhang C. Besondere Nachrichten (v0.3):
  - **Heimkehr einer eigenen Eule (v0.7.2: keine Systemnachricht mehr):** Die Heimkehr erscheint **nur als Einblendung** mit dem Heimkehr-Bild ihrer Art bei Tag oder bei Nacht (9.2.6) und der Bildunterschrift „[Eule] ist wieder zu Hause und sitzt schon auf dem Fensterbrett.“ (mit Antworten: „… und hat einen Antwortbrief / [n] Antwortbriefe dabei.“). Dazu ein Push (11.2). Die Einblendung kommt **jedes Mal**: sofort, wenn die App bei der Landung sichtbar ist (SSE-Hinweis `homecomings`), sonst beim nächsten Öffnen der App, nach dem Einloggen oder bei der Rückkehr in den Vordergrund. Dafür merkt sich der Server jede noch nicht gezeigte Heimkehr (`homecomings`: Eulenname, Art, Zahl der Antwortbriefe, Zeitpunkt); sobald die App sie eingeblendet hat, wird der Eintrag gelöscht (spätestens nach 60 Tagen). Sind mehrere Eulen heimgekehrt, erscheinen ihre Bilder **nacheinander** (jedes wenige Sekunden oder bis zum Antippen, in der Reihenfolge der Landung). Tag oder Nacht gilt für den Moment der Einblendung am fiktiven Wohnort (Sonne > −6°, Berechnung im Browser). Bestehende Heimkehr-Systemnachrichten von vor v0.7.2 werden im Systemchat und bei „Neuigkeiten“ nicht mehr angezeigt. Bis v0.7.1 hing das Bild an der Systemnachricht und erschien höchstens einmal für die zuletzt gelandete Eule; bei mehreren Heimkehrern oder nach dem Einloggen fehlte es oft. Heimkehrende **Leiheulen** mit Antworten melden sich weiter per Systemnachricht (unten bzw. 9.6).
  - **Gelöschte alte Briefe (v0.7):** Hat die Löschfrist (8.4.1) eigene Briefkopien entfernt, kommt eine Systemnachricht mit dem Bild der im Kamin brennenden Briefe: „[n] Briefe aus folgenden Chats wurden gelöscht, weil sie älter als deine Löschfrist waren: [Namen].“ (Einzahl: „1 Brief aus folgendem Chat …“). Namen sind die aktuellen Namen der Gegenüber (Kontakte, Bots), sonst „unbekannt“; gezählt werden geschriebene und erhaltene Briefe, keine Systemnachrichten. Nur wenn wirklich etwas gelöscht wurde, ohne Push; gilt für den täglichen Lauf und für das sofortige Löschen nach Wahl einer kürzeren Frist.
  - **Spendenbitte:** alle 5 Wochen (35 Tage) nach der Registrierung eine freundliche, augenzwinkernde Nachricht: PostEulen ist kostenlos, leider nur für die Nutzer und nicht für die Entwickler; niemand muss spenden, aber wer kann, darf gern über https://ko-fi.com/posteulen. Drei verschiedene Texte, reihum (nie zweimal derselbe hintereinander). Nur für aktive Konten (nicht während einer laufenden Kontolöschung), ohne Push, auf jeder Instanz gleich und nicht abschaltbar. Konten von vor v0.3 bekommen die erste zum nächsten 5-Wochen-Termin ab ihrem Registrierungstag. Der Link ist anklickbar.
  - **Neues nach einem Update:** Beim ersten Start einer neuen Version bekommt jedes bestehende Konto (außer während der endgültigen Löschung) einmal eine Nachricht über die Änderungen dieser Version – für technische Laien, ohne technische Details, augenzwinkernd mit Anspielungen auf Zaubererwelt und Eulenhaltung, aber zutreffend und nicht übertrieben flapsig. Werden Versionen übersprungen, kommt je übersprungener Version mit Text eine Nachricht. Gespeichert wird nur die Versionskennung; der Text steht in `shared/src/texts/messages.ts`. Eine frische Installation verschickt nichts; der Server merkt sich die zuletzt angekündigte Version (Vorabversionen zählen wie ihre Version). Ohne Push.
  - Spendenbitte und Update-Nachricht zeigen eine Überschrift und Absätze.

#### 8.4.1 Löschfrist für Briefe
- **Alle Briefe** (zwischen Menschen, an und von Bots, Begleitbriefe) und **alle Systemnachrichten** werden spätestens **365 Tage nach ihrer Zustellung** unwiderruflich aus der Datenbank und damit aus allen Konten gelöscht. Maßgeblich ist die Ankunftszeit (`arrives_at`), bei Systemnachrichten der Erstellungszeitpunkt. Briefe, die noch unterwegs sind, werden nie gelöscht.
- Jeder Nutzer kann in den Einstellungen wählen, dass **seine eigenen Kopien** (geschriebene und erhaltene Briefe sowie seine Systemnachrichten) schon nach **30, 90 oder 180 Tagen** gelöscht werden (Standard: 365). Das Gegenüber behält seine Kopie bis zum Ende seiner eigenen Frist; physisch gelöscht wird ein Brief, sobald ihn keine Seite mehr hat. Bots haben keine eigenen Kopien: Endet die Frist des Nutzers, ist der Bot-Brief ganz weg (die Bot-Zusammenfassung bleibt, bis der Chat gelöscht wird).
- Gelöscht wird täglich um 04:00 UTC (4.5) und sofort, wenn ein Nutzer eine kürzere Frist wählt (mit Bestätigungsdialog). Ungelesen-Zähler werden danach neu berechnet. **v0.7:** Wer dabei Briefe verliert, bekommt eine Systemnachricht mit Anzahl und Chats (8.4).
- Hilfe, Hilfebriefe des Erklärbärs (10.2), Datenschutzerklärung und der Chatverlauf weisen deutlich darauf hin.

### 8.5 Eulen
- Übersicht aller eigenen Eulen, Küken und Leiheulen unter zwei Überschriften: oben **„Leiheulen“**, darunter **„Deine Eulen“** (eigene Eulen und Küken); eine Überschrift erscheint nur, wenn es dazu Eulen gibt. Je Eule: Bild, Name, Art, Geschlecht, Energie (Zahl + Balken), Motivation (v0.7 in Prozent, „Motivation 110 %“, + Balken, 9.3a), Zustand. Beide Balken haben einen Farbverlauf von Rot (leer) nach Grün (voll); beim Motivationsbalken ist 80 % leer und 120 % voll. **v0.7:** Ganz oben unter „Zu Gast bei dir“ stehen Eulen anderer, die gerade beim Nutzer rasten (8.4, „Rast und Antwort“), deutlich als Gast gekennzeichnet (gestrichelter Rahmen, Hinweis „Nur zur Rast hier!“), mit den vier Pflege-Aktionen, dem Knopf „Antwort an [Name] mitgeben“ (führt in den Chat; nur solange der Halter ein Kontakt ist) und (v0.8.2) „Weiterfliegen lassen“ (8.4). Darunter die festen Werte der Art: Geschwindigkeit in km/h (25 km/h × Faktor) und Erholung in Prozent pro Stunde (10 % × Faktor). Ist die Motivation nicht 100 %, steht hinter beiden Werten grün „+10 %“/„+20 %“ bzw. rot „−10 %“/„−20 %“ (mit Vorzeichen, also auch in Graustufen lesbar); die angezeigten Werte selbst ändern sich nicht. Über der Liste erklärt ein kurzer Hinweis die Motivation.
- **Bild je Zustand (9.2.6):** normal (bei Tag zu Hause manchmal das Nickerchen-Bild „Tagschlaf zuhause“, v0.5.1); bei kranken Eulen das grummelige Bild; bei Küken das Küken-Bild; **solange die Eule brütet** das Brüten-Bild (v0.7, statt des Nickerchens); **solange die Eule unterwegs schläft** das Schlafbild „Tagschlaf unterwegs“ bzw. „Nachtpause“ (v0.5.1); **solange die Eule fliegt** (Brief zustellen oder Rückweg) das Flugbild ihrer Art – „Tagflug“, wenn an ihrer aktuellen Position gerade Tag ist (Sonne > −6°), sonst „Nachtflug“ (vom Server beim Abruf der Liste berechnet); **solange sie an die Menagerie verliehen ist** das Bild der leeren Stange.
- Abwesende Eulen sind als abwesend markiert, mit Grund und Zeit, z. B. „Fliegt gerade einen Brief zu Peter. Voraussichtlich zurück in 5 Std.“ (**v0.7.2:** unter einer Stunde in Minuten, „… zurück in 40 Min.“; ebenso die Restzeit offener Kontaktanfragen, 8.8), „In der Menagerie bis Fr., 14:00“, „Beim Eulenarzt bis morgen 09:12“, „Brütet bis …“. **v0.7:** „Fliegt gerade …“ steht nur, solange die Eule wirklich fliegt; schläft sie unterwegs, heißt es „Schläft auf dem Weg zu [Namen].“ bzw. „Schläft auf dem Heimweg.“; rastet sie bei einem Empfänger, „Rastet bei [Name] bis [Zeit].“ (Bild dann das normale).
- Aktionen je nach Zustand (9.2.5): Wasser geben, streicheln, Eulenkeks, Lieblingsleckerli (v0.5, 9.3; jeweils mit eingeblendetem Bild, 9.2.6; der Knopf nennt das Leckerli der Art, z. B. „Haselnüsse geben (0,2 Gold)“), umbenennen, Krankheit behandeln, an die Menagerie verleihen, an einen Kontakt verschenken (optional mit Begleitbrief, 9.2.7), in die Freiheit entlassen (mit eingetipptem Namen und zweiter Bestätigung, 9.2.8).

### 8.6 Finanzübersicht
- Aktueller Goldstand und die letzten 20 Transaktionen (Datum, Art, Betrag, ggf. Gegenüber).
- Gold per Eule an einen Kontakt schicken (9.1.4), optional mit Begleitbrief.

### 8.7 Menagerie
- **Leihen** (oben): das Tagesangebot (4 Arten, v0.5) mit den für diesen Nutzer gewürfelten, untereinander verschiedenen Namen (9.6). Leihen geht auch direkt in der Eulenwahl (8.4). Leiheulen haben keine Beschreibung.
- **Kaufen** (darunter): **v0.7.1:** Vor jedem Kauf fragt ein Bestätigungsdialog nach („[Art] wirklich für [Preis] kaufen?“), damit niemand versehentlich kauft. Angeboten werden alle 18 Arten (Anhang B, v0.5 mit dem Phönix), immer verfügbar, **nach Kaufpreis sortiert** (günstigste zuerst, gleicher Preis nach Name), mit großem Bild, Preis, Werten (Energie, Geschwindigkeit in km/h, Erholung in Prozent pro Stunde – v0.5: absolute Werte statt Faktoren) und einer **Beschreibung** in Fließtext (Herkunft, Größe, Charakter als Posteule, Lieblingsleckerli; Texte in `shared/src/texts/species.ts`, vom Auftraggeber geliefert, v0.5 neu gefasst und ins Englische übertragen). Beim Phönix steht zusätzlich, dass er nie verliehen wird, keine Eier legt und nicht in der Menagerie aushilft. Die Bilder bleiben so breit wie die Karte (mindestens etwa 18 rem breite Karten, auf dem Handy volle Breite); lange Namen wie „Südliche Weißgesichtseule“ werden mit Trennstrich umbrochen (`hyphens: auto`, notfalls an beliebiger Stelle) und sprengen ihren Rahmen auf keiner Bildschirmbreite.
- **Verleihen:** Eigene Eulen können an die Menagerie verliehen werden (9.7). Der Ort heißt in der ganzen App nur „Menagerie“ (früher teils „Papeterie“).

### 8.8 Adressbuch
- Kontakte mit aktuellem Namen und Status: „unbestätigt“ (eigene offene Anfrage, mit Restzeit), „inaktiv“ (mehr als 21 Tage nicht online; keine Interaktion möglich), „Sicherheitsnummer verglichen“, „Schlüsselwarnung“.
- **Kontakt hinzufügen** per exakt geschriebenem Namen (Vergleich über den normalisierten Schlüssel, 7.1). **v0.8.2:** Leerzeichen am Anfang und Ende werden vor der Anfrage entfernt (App und Server). Max. 20 Anfragen pro Tag. Die Antwort ist immer gleich, egal ob der Name existiert: „Anfrage gespeichert. Sobald [Name] dich ebenfalls hinzufügt, seid ihr verbunden.“ Anfragen anderer sind nicht sichtbar; man spricht sich außerhalb der App ab. Unbestätigte Anfragen verfallen nach 24 Stunden. Erst nach gegenseitigem Hinzufügen ist Interaktion möglich (Systemnachricht an beide).
- Pro Kontakt: Sicherheitsnummer anzeigen und als verglichen markieren (5.7).
- **Kontakt entfernen:** Beide müssen sich danach neu koppeln. Der andere erhält eine Systemnachricht („[Name] hat die Verbindung gekappt“). Eulen, die zwischen beiden unterwegs sind, drehen sofort um (9.5). Chatverläufe bleiben erhalten, der Name lautet dann „unbekannt“. Koppelt man sich erneut mit derselben Person, erscheint der alte Verlauf wieder unter ihrem Namen.
- Kontakte, deren Konto gelöscht wurde, verschwinden aus dem Adressbuch.
- **Bots (v0.7.2):** Bots stehen **nicht** im Adressbuch, nur im Briefwechsel (Chatliste) und als Raute auf der Karte (10.1). Geschrieben wird ihnen in ihrem Chat. Entfernen lässt sich ein Bot in seinem Chat („[Name] entfernen“, neben „Alle Briefe verbrennen“) oder alle auf einmal in den Einstellungen (8.10) – jeweils unwiderruflich, inklusive Chat, Zusammenfassung und noch ausstehender Briefe und Goldsendungen (Bestätigungsdialog). Bis v0.7.1 standen sie im Adressbuch und wurden dort entfernt.

### 8.9 Karte
- Siehe Abschnitt 12. Die Karte ist immer **quadratisch** (v0.4, 12.1).

### 8.10 Einstellungen
- Nutzernamen ändern (einmal pro Kalenderjahr; Anzeige, wann wieder möglich). **v0.7:** Im selben Bereich steht der aktuelle Nutzername („Dein aktueller Nutzername: [Name]“).
- Wohnort ändern (bis zu 3-mal pro Kalendermonat, Anzeige der verbleibenden Umzüge bzw. ab wann wieder; Pin auf der politischen Karte).
- **Briefe:** Löschfrist für eigene Briefe und Systemnachrichten (30, 90, 180 Tage oder ein Jahr, 8.4.1); „Briefe in Druckschrift statt Handschrift anzeigen“ (reine Anzeige, wird am Konto gespeichert); **v0.8.2** Regler (Schalter) „Links in Briefen anklickbar“ (Standard an, wirkt sofort, am Konto gespeichert als `users.links_clickable`; aus: Links in Briefen und Bannern erscheinen als reiner Text; der Spendenlink der Systemnachrichten bleibt anklickbar).
- **Sprache** (v0.4, 8.12): Deutsch oder English als Auswahl; wirkt sofort und wird am Konto gespeichert.
- **Gutschein einlösen (v0.7):** Feld für den Code (Leerzeichen und Bindestriche egal, Groß-/Kleinschreibung egal) und „Einlösen“. Gold wird sofort gutgeschrieben (Buchung „Gutschein eingelöst“), eine Eule zieht sofort ein und wartet in der Eulenübersicht auf ihren Namen (mit Hinweis und Link). Ungültige, abgelaufene und schon eingelöste Codes ergeben dieselbe Meldung („Dieser Gutschein ist ungültig, abgelaufen oder schon eingelöst.“). Rate-Limit „teuer“ (5.10). Siehe 13.
- **Bots (v0.7.2, v0.8):** kurze Erklärung und Knopf „Alle Bots entfernen“: entfernt den Erklärbär und alle Bots des Kontrollzentrums **endgültig und unwiderruflich** aus dem eigenen Spiel – mit Chats, Zusammenfassungen, geplanten Briefen und Geschenken (10.1) – und hält auch **alle künftig angelegten Bots** fern (`users.bots_disabled`). Vorher ein Bestätigungsdialog („… Das ist endgültig … kein Bot schreibt dir je wieder.“). Danach steht dort „Alle Bots sind entfernt.“
- Passwort ändern (5.6).
- Benachrichtigungen: kurze Erklärung in einfachen Worten, Status („aktiv und bestätigt“ / „nicht bestätigt“ / „nicht verfügbar“), Knopf „Test-Benachrichtigung senden“; bei Problemen ein Verweis auf den Hilfeabschnitt Benachrichtigungen (dort auch Google-freies Android, 11.7).
- Konto löschen (7.5).
- Ausloggen.
- **Nachricht an den Admin (v0.7.1)**, ganz unten: kurze Nachricht an den Admin der Instanz, gedacht für technische Probleme und Verbesserungsvorschläge. Höchstens **300 Zeichen** (Textregeln wie Briefe, 5.9), **eine pro Kalendertag (UTC)**; danach steht dort „Heute hast du schon eine Nachricht geschickt. Die nächste geht ab [Zeit].“ (nächste UTC-Mitternacht in Ortszeit). Deutlicher Hinweis: Die Nachricht ist **nicht verschlüsselt**, liegt ohne Namen lesbar auf dem Server und wird nach 90 Tagen gelöscht. Gespeichert wird sie **ohne Absender** (`feedback`: ID, Text, Eingang); am Konto steht nur der UTC-Tag der letzten Nachricht (`users.feedback_sent_on`). Rate-Limit „teuer“. Hilfe (Einstellungen, FAQ), Erklärbär (Brief Tag 2, Regelwissen) und Datenschutzerklärung weisen darauf hin.

### 8.11 Hilfe, Datenschutz, Impressum
- v0.4: Hilfe, Datenschutzerklärung und Impressum gibt es auch auf Englisch (gleiche Abschnitte und Anker); die englischen Rechtstexte sind Übersetzungen der Standardtexte, das englische Impressum nennt die deutsche Fassung als maßgeblich.
- **Hilfe:** erklärt die App und alle Funktionen verständlich und freundlich, auch für absolute technische Laien (je Funktion ein Abschnitt mit Inhaltsverzeichnis und Ankern, dazu FAQ und Push auf Google-freiem Android). Gleich nach der Einführung steht ausführlich, wie PostEulen ohne App-Store auf den Startbildschirm kommt (wie 8.2, ergänzt um den Computer). Nur die Hilfe (Abschnitt Benachrichtigungen) und das README erklären den Sonderfall Google-freies Android und UnifiedPush. Jeder Abschnitt steht in einer eigenen Box (14). Erreichbar vor und nach dem Login. Ein eigener Abschnitt betont, dass PostEulen zwar zwischen Spiel und Messenger liegt, sich aber wegen ernsthafter, aktueller Kryptografie auch als sicherer Kommunikationsweg eignet; ein weiterer erklärt deutlich die Löschfrist (8.4.1). Der Hilfetext ist zugleich die Wissensbasis des Erklärbärs. Hilfe, Datenschutzerklärung und Impressum stehen als strukturierte Daten in `shared/src/texts/` (Abschnitte aus Absätzen und Listen, Zahlen aus den Konstanten).
- **Datenschutzerklärung:** so knapp und verständlich wie nötig, aber vollständig zu: gespeicherten Daten (2.2, 3), Ende-zu-Ende-Verschlüsselung und ihren Grenzen (Metadaten, entsperrtes Gerät), unverschlüsselten Bot-Chats und deren Übermittlung an OpenAI, Push-Diensten von Apple/Google/Mozilla bzw. UnifiedPush-Servern (Inhalte verschlüsselt, Zeitpunkte sichtbar), einem einzigen technisch notwendigen Cookie, fehlender IP-Speicherung, Backups (gelöschte Daten verschwinden spätestens nach 7 Tagen auch aus den Backups), automatischer Löschung bei Inaktivität, Löschfrist für Briefe (8.4.1). Ohne Kapitel zu Verantwortlichem und Betroffenenrechten, ohne Platzhalter und ohne Entwurfshinweis.
- **Impressum:** betont augenzwinkernd, dass es sich um ein technisches Experiment für den Eigengebrauch handelt; schließt freundlich, aber bestimmt jede Haftung aus; Kontakt zum Entwickler über das Mastodon-Profil @iak@23.social. Enthält nur Einleitung, Kontakt und Haftung.
- **Standardtexte:** Datenschutzerklärung und Impressum werden als Standardtexte des Projekts erstellt. Für ihre Rechtskonformität ist der Entwickler bzw. Betreiber einer Instanz selbst verantwortlich; er passt sie eigenständig an. Weder die App noch Dokumentation oder Coding-Agents fügen Hinweise hinzu, die Texte seien Entwürfe, ungeprüft oder nicht rechtskonform.

---

### 8.12 Sprache: Deutsch und Englisch (v0.4)
- **Deutsch ist immer Standard.** Die Sprache des Browsers wird nicht ausgewertet.
- **Fähnchen oben rechts** auf allen Seiten: In der deutschen Ansicht eine kleine britische Flagge (Beschriftung für Screenreader „Switch to English“), in der englischen eine deutsche Flagge („Auf Deutsch umstellen“). Ein Tipp schaltet die ganze App sofort um, ohne Neuladen. Nicht angemeldet steht das Fähnchen in einer eigenen Zeile über dem Inhalt, angemeldet ganz rechts in der Statusleiste. Die Flaggen sind eingebettete SVGs (keine fremden Ressourcen).
- **Vor dem Login** merkt sich das Gerät die Wahl dauerhaft im lokalen Speicher des Browsers (`posteulen.language`, nicht auf dem Server).
- **Konto:** Jedes Konto hat eine Sprache (`users.language`, `de` oder `en`, Standard `de`). Ein Konto, das in der englischen Ansicht erstellt wird, bekommt Englisch. Nach jeder Anmeldung (und bei jeder Aktualisierung des Profils) gilt die Sprache des Kontos – auf jedem Gerät. Angemeldet speichert das Fähnchen die Wahl zugleich im Konto (`PATCH /api/account/language`); dieselbe Einstellung steht in den Einstellungen (8.10). Abmelden ändert die Sprache des Geräts nicht.
- **Was übersetzt wird:** alle Texte der Oberfläche, Fehlermeldungen, Hilfe mit FAQ, Datenschutzerklärung, Impressum, Systemnachrichten (auch Spendenbitten und Update-Nachrichten, angezeigt in der Sprache der Ansicht), Push-Texte (der Server schickt die Sprache des Kontos im verschlüsselten Push mit; der Service Worker hat beide Textsätze), Artnamen und Artbeschreibungen, Länder- und Städtenamen der Karte (englische Namen aus Natural Earth `NAME_EN`, wo sie sich unterscheiden), Datums- und Zahlenformat (`en-GB`, Dezimalpunkt).
- **Was der Server in der Kontosprache schreibt:** feste Bot-Briefe und KI-Antworten (Englisch: „Explainer Bear“, „Aunt …“, „Uncle …“), Bot-Namen in Adressbuch, Karte, Systemnachrichten und Finanzen, Namen der Leiheulen und Zufallsnamen der Küken (englische Liste gleicher Länge und Reihenfolge, Anhang D – die HMAC-Ableitung bleibt gleich). Schon zugestellte Bot-Briefe, gespeicherte Namen und Briefe von Menschen bleiben, wie sie sind.
- Nicht übersetzt: der Name „PostEulen“, Nutzer- und Eulennamen, Rundnachrichten des Admins, das Adminpanel, die Skripte und das Web-App-Manifest.

## 9. Spielmechanik

### 9.1 Gold

#### 9.1.1 Grundregeln
- Startguthaben 3,0 Gold. Jeden Tag um **03:00 UTC** (v0.7; bis v0.6.1 15:00 UTC) erhält jedes **aktive** Konto (9.10) automatisch Gold (v0.4): **3,0 Gold** am Tag der Registrierung und an den folgenden Tagen bis einschließlich zum 29. Tag danach (30 Zahltage, maßgeblich ist der UTC-Tag der Registrierung `created_on`), danach **2,0 Gold**. Bestehende Konten werden nach ihrem Registrierungstag eingeordnet. Die Finanzübersicht zeigt den heutigen Betrag und die Regel. Inaktive Konten und Bots erhalten nichts. Das tägliche Gold erscheint nur in der Finanzübersicht, nicht im Systemchat. **v0.7:** Der Goldstand in der Statusleiste aktualisiert sich bei offener App sofort (SSE-Hinweis an alle verbundenen Konten nach der Buchung); vorher stand dort bis zum Neuladen der alte Betrag. Beim Update auf v0.7 wird der schon geplante Lauf (15:00) auf 03:00 desselben Tages verlegt – liegt das schon zurück, läuft er sofort; nichts wird doppelt oder gar nicht gezahlt (`daily_job_runs`).
- **v0.8:** Bots des Kontrollzentrums können in Events Gold an alle Spieler verschenken (0,1–100 Gold pro Spieler, 10.8; Buchung „Geschenk von [Bot]“, Typ `bot_gift`).
- Alle Beträge und Kontostände sind Vielfache von 0,1.
- Jede kostenpflichtige Aktion erfordert volle Deckung (Guthaben ≥ Kosten) und wird atomar gebucht. Dadurch wird der Kontostand nie negativ. Sollte er dennoch (z. B. durch einen Fehler) negativ sein, sind alle kostenpflichtigen Aktionen gesperrt, bis wieder genug Guthaben vorhanden ist.

#### 9.1.2 Preise und Einnahmen
- Eule kaufen: Artpreis (Anhang B). Leiheule: 0,1. Füttern: 0,1. Großes Pergament: 0,1. Krankheit: Pflege 0,2 / Eulenarzt 1,0.
- Verleih an die Menagerie: +10 % des Artpreises nach 7 Tagen.
- Goldgeschenke von Bots (Events, 10.8).

#### 9.1.3 Transaktionsliste
- Je Nutzer werden nur die letzten 20 Transaktionen gespeichert.

#### 9.1.4 Überweisung per Eule
- An genau einen bestätigten, aktiven, menschlichen Kontakt. An Bots kann man kein Gold schicken. Betrag 0,1–20,0 Gold.
- Nur erlaubt, wenn das eigene Guthaben **nach** der Überweisung noch größer als 10,0 ist.
- Transport durch eine Eule nach denselben Regeln wie Briefe (eigene Eule oder Leiheule – auch eine erst beim Absenden geliehene, 8.4 –, Flugregeln, Umkehren).
- **Begleitbrief (optional):** Der Absender kann einen Begleitbrief mitgeben – kleines Pergament (bis 800 Zeichen), kostenlos, verschlüsselt und signiert wie jeder Brief zwischen Menschen (5.8, Briefart „Begleitbrief zu Gold“). Er wird zusammen mit dem Gold zugestellt und teilt dessen Schicksal (9.5).
- Abbuchung beim Abflug, Gutschrift beim Empfänger bei Ankunft (Push + Systemnachricht). Kehrt die Eule um, wird der Betrag gutgeschrieben, sobald sie wieder zu Hause ist (bei Leiheulen sofort).

### 9.2 Eulen

#### 9.2.1 Eigenschaften
- Art, Preis (6–50; Phönix 100), maximale Energiepunkte (100–1 200; Phönix 2 000), Fluggeschwindigkeitsfaktor (0,5–2; Phönix 4), Erholungsfaktor (0,5–2), Geschlecht (zufällig beim Kauf bzw. Schlupf), Name, Bilder ihrer Art (9.2.6), Besitzbeginn (Datum, 9.8), **Motivation** (80–120 %, gespeichert in Zehnteln 8–12, v0.5, 9.3a).
- Energie wird intern mit Nachkommastellen geführt und immer ganzzahlig gerundet angezeigt.
- Eulen werden unendlich alt und sterben nicht.

#### 9.2.2 Arten
- Siehe Anhang B.
- **Phönix (v0.5):** eine Fabelart neben den 17 Eulen (`mythical` in `shared/species.ts`): wird nie als Leiheule angeboten, legt nie Eier (also keine Küken und kein Kükenbild), kann nicht an die Menagerie verliehen werden und fliegt nie für Bots. Krank werden kann er wie jede Eule. In Hilfe und App heißt er trotzdem einfach „Eule“, wo alle gemeint sind.

#### 9.2.3 Kauf
- Alle Arten sind immer verfügbar. Voraussetzungen: Guthaben ≥ Preis und weniger als 50 eigene Eulen (Küken zählen mit, Leiheulen nicht; Schlupf und empfangene Geschenke dürfen das Limit überschreiten, Kaufen ist dann gesperrt).
- Beim Kauf zufällig: Geschlecht, Start-Energie 60–100 % des Maximums. Das Geschlecht ist überall (Kauf, Schlupf, Gutschein, Leiheulen, Bot-Eulen) **gleich verteilt**, je 50 % weiblich und männlich (v0.7.2 nachgemessen: 200 000 Würfe je Verfahren ergaben 49,99 % weiblich; ein Test prüft die Verteilung).
- Danach vergibt der Nutzer den Namen (Pflichtdialog). **v0.7:** Der Dialog zeigt schon das gewürfelte Geschlecht („Geschlecht: weiblich“), damit ein passender Name leichter fällt; ebenso bei Küken und bei Eulen aus Gutscheinen.

#### 9.2.4 Namen
- 2–20 Zeichen, gleicher Zeichensatz wie Nutzernamen (7.1), nicht eindeutig.
- Umbenennen: einmal pro Kalenderjahr je Eule. Die Erstbenennung nach Kauf bzw. Schlupf zählt nicht. Der Zähler bleibt beim Verschenken an der Eule. Leiheulen können nicht umbenannt werden.

#### 9.2.5 Zustände und erlaubte Aktionen

| Zustand | Brief/Gold/Geschenk/Verleih an die Menagerie | pflegen (Wasser, streicheln, Keks, Leckerli) | kann krank werden | freilassen |
|---|---|---|---|---|
| zu Hause, gesund, erwachsen | ja (Verleih an die Menagerie nicht für den Phönix) | ja | ja (nicht in den ersten 28 Tagen beim Besitzer, 9.8) | ja |
| unterwegs (inkl. Schlafpause und Rast beim Empfänger, v0.7) | nein | nein (während einer Rast nur durch den Gastgeber, 8.4) | Wurf wirkt bei Rückkehr (9.8) | nein |
| krank, unbehandelt | nein | ja | – | ja |
| in eigener Pflege | nein | ja | nein | ja |
| beim Eulenarzt (abwesend) | nein | nein | nein | nein |
| brütet | nein | ja | nein | nein |
| an die Menagerie verliehen | nein | nein | nein | nein |
| Küken | nein | ja | nein | nein |
| Leiheule vor dem Abflug | Brief an bis zu 5 Empfänger, Gold an 1 | ja | nein | nein |

#### 9.2.6 Bilder
- Der Auftraggeber liefert für jede Art siebzehn Bilder im Ordner `/images/` (Dateinamen: Anhang B; der Phönix fünfzehn, ohne Küken und ohne Brüten), dazu drei Bilder ohne Art: die leere Stange, das Gruppenbild und (v0.7) die im Kamin brennenden Briefe. Alle Eulen einer Art – gekaufte, geschenkte, Leih- und Bot-Eulen – zeigen dieselben Bilder; Küken zeigen statt des normalen Bilds das Küken-Bild:

| Bild | Verwendung |
|---|---|
| Normal | Standardbild der Eule (Eulenübersicht, Kauf, Leihangebot, Auswahl beim Versand usw.) |
| Abflug | Einblendung beim Absenden eines Briefs, beim Losschicken mit Gold und beim Verschenken |
| Ankunft | Einblendung beim Empfänger, wenn eine Eule bei ihm ankommt (mit Brief, mit Gold oder als Geschenk) |
| Füttern | Einblendung beim Eulenkeks |
| Trinken (v0.5) | Einblendung beim Wassergeben |
| Leckerli (v0.5) | Einblendung beim Lieblingsleckerli |
| Streicheln | Einblendung beim Streicheln |
| Grummelig | ersetzt das normale Bild, solange die Eule krank ist |
| Küken | Küken dieser Art bis zum Erwachsensein, auch als Abflug- und Ankunftsbild eines Kükens |
| Tagflug / Nachtflug | ersetzt in der Eulenübersicht das normale Bild, solange die Eule unterwegs ist (Zustellung oder Rückweg) und fliegt – je nach Tag oder Nacht an ihrer aktuellen Position (8.5) |
| Tagschlaf unterwegs / Nachtpause (v0.5.1) | ersetzt in der Eulenübersicht das Flugbild, solange die Eule unterwegs eine Schlafpause macht (9.4.2) – „Tagschlaf unterwegs“, wenn es an ihrer aktuellen Position hell ist, sonst „Nachtpause“ |
| Tagschlaf zuhause (v0.5.1) | „Nickerchen“ einer gesunden, erwachsenen Eule zu Hause (auch Leiheule und brütende Eule) bei Tag am Wohnort des Halters: bei jedem Öffnen der Eulenübersicht würfelt jede solche Eule einmal, mit 50 % zeigt sie dieses Bild statt des normalen. Nachts immer das normale Bild, ebenso in den 10 Minuten nach der letzten Pflege-Aktion (`owls.cared_at`). Ohne Einfluss auf Pflege oder Versand |
| Heimkehr Tag / Heimkehr Nacht | die Eule auf dem Fensterbrett, bei Tageslicht bzw. bei Kerzenschein; Einblendung bei jeder Heimkehr einer eigenen Eule (v0.7; v0.7.2 ohne Systemnachricht, mehrere nacheinander, 8.4) |
| Brüten (v0.7) | ersetzt in der Eulenübersicht das normale Bild (und das Nickerchen), solange die Eule brütet (9.9) |
| Leere Stange (ohne Art) | ersetzt in der Eulenübersicht das Bild einer Eule, solange sie an die Menagerie verliehen ist (8.5) |
| Gruppenbild (ohne Art) | Startseite (8.1) und README |
| Verbrennen (ohne Art, v0.7) | Einblendung nach „Alle Briefe verbrennen“ und Bild der Systemnachricht über gelöschte alte Briefe (8.4) |

- Der Build erzeugt daraus WebP-Dateien in passenden Größen (z. B. 160 px und 480 px, für die Einblendungen und die Heimkehr-Bilder zusätzlich eine größere Variante, z. B. 960 px; Gruppenbild 480 und 960 px) mit Hash im Dateinamen. Fehlt ein Bild, wird ein Platzhalter verwendet; der Build meldet fehlende Bilder als Warnung, nicht als Fehler.
- **Küken** zeigen bis zum Erwachsensein das Küken-Bild ihrer Art; erwachsen zeigen sie das normale Bild. Beim Füttern und Streicheln eines Kükens erscheinen die Füttern- bzw. Streicheln-Bilder seiner Art. Küken werden nicht krank (9.9) und brauchen daher kein grummeliges Bild.
- **Grummelig:** Ab der Erkrankung (9.8) bis zur Genesung – also krank und unbehandelt, in eigener Pflege und beim Eulenarzt – zeigt die App überall, wo sonst das normale Bild der Eule erscheint, das grummelige Bild. Die Einblendungen beim Füttern und Streicheln bleiben auch bei kranken Eulen unverändert.
- **Einblendungen:** In diesen Momenten blendet die App das passende Bild der Art ein, mit kurzer Bildunterschrift (z. B. „Waldi fliegt los“):
  - **Abflug:** wenn man eine eigene Eule oder Leiheule mit Brief oder Gold losschickt oder eine Eule verschenkt. Beim Verschenken eines Kükens erscheint das Küken-Bild.
  - **Ankunft:** immer, wenn eine Eule beim Nutzer ankommt – mit Brief oder Begleitbrief, mit Gold, als geschenkte Eule oder als Küken, auch von Bots. Das Bild erscheint, sobald der Nutzer die Ankunft zum ersten Mal in der App sieht: bei Briefen und Begleitbriefen im Chatverlauf (beim Öffnen des Chats oder sofort, wenn der Chat bei der Landung schon offen ist), bei Lieferungen ohne Brief beim ersten Anzeigen der zugehörigen Meldung (Systemchat oder „Neuigkeiten“, 8.3) oder sofort, wenn die App bei der Landung sichtbar ist. Eine Lieferung löst höchstens ein Bild aus; Systemnachrichten ohne ankommende Eule (z. B. Rundnachrichten) lösen keines aus. Gezeigt wird das Ankunftsbild der Art der überbringenden Eule (bei einer geschenkten Eule also ihrer eigenen Art), bei einem Küken das Küken-Bild. Sind seit dem letzten Öffnen mehrere Eulen angekommen, erscheint außerhalb eines Chats nur ein Bild (das der zuletzt gelandeten Eule); **im Chatverlauf (v0.8.2)** erscheinen beim Öffnen die Bilder **aller** neu angekommenen Eulen nacheinander (Warteschlange der Einblendungen, nach Ankunftszeit). Gespeichert wird nur, ob das Bild schon gezeigt wurde (am Brief bzw. an der Systemnachricht).
  - **Füttern**, **Streicheln**, **Trinken** und **Leckerli** (v0.5): nach jeder erfolgreichen Pflege-Aktion der passenden Art (auch wenn das Streicheln an diesem Tag nicht mehr für die Motivation zählt), auch bei der Pflege einer Gast-Eule (v0.7).
  - **Heimkehr** (v0.7, v0.7.2 neu geregelt): jedes Mal, wenn eine eigene Eule wieder zu Hause ist – sofort bei offener App, sonst beim nächsten Öffnen, Einloggen oder bei der Rückkehr in die App; mehrere Heimkehrer nacheinander, je ein Bild; Tag oder Nacht am Wohnort im Moment der Einblendung (8.4). Es gibt dazu keine Systemnachricht.
  - **Verbrennen** (v0.7): nach „Alle Briefe verbrennen“ (eigener Alternativtext „Briefe brennen im Kamin“).
- Eine Einblendung blockiert die Bedienung nicht, schließt sich per Tippen, Klick oder Escape-Taste sowie nach wenigen Sekunden von selbst, hat einen Alternativtext und kommt ohne Animation aus, wenn `prefers-reduced-motion` gesetzt ist. Die Bilder für Einblendungen werden erst bei Bedarf geladen, nicht vorab.
- Logo und App-Icons erstellt der Agent als einfache, austauschbare SVG-Platzhalter im Stil der App.

#### 9.2.7 Verschenken
- Eine einsatzbereite eigene erwachsene Eule (zu Küken: 9.9) kann einem bestätigten, aktiven, menschlichen Kontakt geschenkt werden. Sie fliegt selbst nach den Flugregeln (9.4) zu ihm, bleibt dort und gehört ab der Ankunft ihm (Energie = Restenergie). Ab dem Abflug gehört sie nicht mehr zum Bestand des Schenkenden.
- **Begleitbrief (optional):** Der Schenkende kann der Eule einen Begleitbrief mitgeben – kleines Pergament (bis 800 Zeichen), kostenlos, verschlüsselt und signiert wie jeder Brief zwischen Menschen (5.8, Briefart „Begleitbrief zu Eule“). Er wird bei Ankunft der Eule zugestellt und teilt ihr Schicksal (9.5).
- Bei Ankunft: Push + Systemnachricht beim Empfänger, ggf. Begleitbrief im Chat.
- Während des Flugs bleibt sie im Zustand „Geschenkflug“ gespeichert; sie erscheint in keiner Eulenliste und zählt nicht zum Limit. Bei Ankunft wechselt der Besitzer, und der Besitzbeginn ist der Ankunftstag.
- Kehrt sie um (9.5), fliegt sie zum Schenkenden zurück und gehört wieder ihm.
- Geschenke können nicht abgelehnt werden.

#### 9.2.8 Freilassen
- „In die Freiheit entlassen“ löscht die Eule endgültig. Ein Dialog verlangt, den Namen der Eule fehlerfrei einzutippen (exakt, auch in Groß- und Kleinschreibung); erst dann geht es weiter, und eine zweite Rückfrage („Bist du ganz sicher? … Das lässt sich nicht rückgängig machen.“) muss ausdrücklich bestätigt werden. Der Server prüft den Namen erneut (`owl_name_mismatch`); fremde Eulen bleiben unsichtbar (404). Erlaubte Zustände: 9.2.5.

### 9.3 Energie und Pflege
- **Regeneration** zu Hause (auch krank, in Pflege, brütend): pro Stunde 10 % des Maximums × Erholungsfaktor, linear, gedeckelt beim Maximum. (Faktor 2 ⇒ von 0 auf voll in 5 Stunden.) Berechnung beim Lesen aus Zeitstempeln. Unterwegs regeneriert sie nur im Schlaf (9.4.2).
- **Vier Pflege-Aktionen** (v0.5), nur wenn die Eule zu Hause ist (9.2.5), auch für Leiheulen und Küken – und (v0.7) durch den Gastgeber, solange eine fremde Eule bei ihm rastet (8.4); jede mit eigener Einblendung (9.2.6):
  - **Wasser geben:** kostenlos, einmal pro Tag (`watered_on`).
  - **Streicheln:** kostenlos, beliebig oft.
  - **Eulenkeks** (bisher „Füttern“): einmal pro Tag, 0,1 Gold, sofort +10 % des Maximums × Erholungsfaktor (gedeckelt).
  - **Lieblingsleckerli:** einmal pro Tag, 0,2 Gold, sofort +20 % des Maximums × Erholungsfaktor (gedeckelt). Jede Art hat ihr eigenes Leckerli aus ihrer Beschreibung (z. B. Waldkauz Haselnüsse, Riesenfischuhu Räucherfisch, Phönix Silberblatt; `speciesSnack` in `shared/src/texts/species.ts`); der Knopf nennt es.
- **Gepflegter Tag** (v0.5): ein Tag, an dem die Eule **zwei verschiedene** dieser vier Aktionen bekommen hat (egal welche; zweimal Streicheln zählt als eine).
- **Pflegebonus:** Betrachtet werden die letzten **14 Tage vor dem Krankheitswurf, an denen die Eule mindestens eine Stunde zu Hause war** (zu Hause = nicht unterwegs, nicht beim Eulenarzt, nicht an die Menagerie verliehen; krank, in eigener Pflege oder brütend zählt als zu Hause). War sie an mindestens 10 dieser Tage gepflegt (siehe oben), sinkt ihre Krankheitswahrscheinlichkeit um 70 % (× 0,3). Ganze Reisetage zählen also weder für noch gegen den Bonus.
  - Zurückgeschaut wird höchstens 60 Tage und nur bis zum Besitzbeginn; gibt es weniger als 14 solche Tage, genügen trotzdem 10 gepflegte.
  - Gespeichert werden je Eule nur die Pflegetage (Datum) und die Zeiten, in denen sie fort war (Beginn/Ende), jeweils höchstens 60 Tage lang (Aufräumen 04:00). Pflegetage aus der Zeit vor v0.5 (damals genügte eine Aktion) bleiben gültig.

### 9.3a Motivation (v0.5)
- Jede Eule eines Spielers (eigene Eulen, Küken, Leiheulen; nicht Bot-Eulen) hat eine **Motivation** zwischen **80 % und 120 %** (bis v0.6.1 angezeigt als 0,8–1,2), gespeichert in Zehnteln (`owls.motivation`, 8–12). Hier und im Code steht *m* für den Faktor 0,8–1,2.
- **Start:** gekaufte Eulen, Eulen aus Gutscheinen und frisch geschlüpfte Küken 100 %; Leiheulen 80, 90 oder 100 %, wie Name und Energie per HMAC je Nutzer, Tag und Art abgeleitet (9.6). Beim Update auf v0.5 bekommen alle vorhandenen Eulen 1,0. Verschenkte Eulen behalten ihre Motivation.
- **Jede Nacht um 00:00 UTC** sinkt sie um 10 Prozentpunkte (nicht unter 80 %), auch wenn die Eule unterwegs, an die Menagerie verliehen oder beim Eulenarzt ist (täglicher Job, verpasste Nächte werden nachgeholt).
- Jede der vier Pflege-Aktionen (9.3) hebt sie **einmal pro Tag** um 10 Prozentpunkte (nicht über 120 %). Mehrfaches Streicheln zählt einmal.
- **Wirkung (v0.7: je Etappe):** Die Motivation wirkt nur auf die **nächste Etappe** – vom Abflug zu Hause bis zum ersten Empfänger, und bei jedem Abflug von einem Empfänger (sofort nach der Zustellung oder nach der Rast) neu bis zum nächsten Ziel. Für diese Etappe wird der Faktor *m* der dann aktuellen Motivation festgehalten (auch bei einer Neuplanung unterwegs, 9.4.6, 9.5): Geschwindigkeit × *m*, maximale Energie × *m*, Energie beim Abflug × *m* (gleicher Füllstand in Prozent) und Erholung im Schlaf 10 % × Erholungsfaktor × *m* des so vergrößerten Maximums pro Stunde. An jeder Station wird die Energie durch *m* geteilt und auf das normale Maximum begrenzt; während einer Rast und zu Hause gelten die normalen Werte der Art. So lohnt es sich für einen Empfänger, eine rastende Eule zu pflegen. Kükenflüge (9.9) und Bot-Eulen bleiben ohne Motivation. Bis v0.6.1 galt *m* für die ganze Reise; Flüge, die beim Update schon unterwegs sind, behalten diese Regel bis zur Landung.
- **Technik (v0.7):** Flugpläne speichern die **eigene** Energie der Eule (`profile.ownUnits`), die Simulation rechnet intern mit der motivierten. Bei jedem Abflug von einer Station wird der Rest des Flugs mit einem neuen Profil (aktuelle Motivation) neu geplant und `flights.profile` ersetzt.
- Die Vorschau der Eulenwahl (8.4) rechnet für alle Etappen mit der aktuellen Motivation (bei Leiheulen des Tages mit der abgeleiteten); Ankunftszeiten späterer Empfänger sind deshalb Schätzungen („ca.“) und werden bei jedem Abflug von einem Empfänger aktualisiert.

### 9.4 Eulenflug

#### 9.4.1 Grundwerte
- **Geschwindigkeit:** 25 km/h × Fluggeschwindigkeitsfaktor der Art, unabhängig von Tag/Nacht und Energie.
- **Energieverbrauch:** Nacht 1 Energiepunkt pro km, Tag 1,5 pro km (50 % mehr). „Tag“ = Sonnenhöhe am aktuellen Ort der Eule zum aktuellen Zeitpunkt größer als −6° (die Dämmerung zählt als Tag), sonst „Nacht“.
- **Strecken:** Großkreis zwischen den Wegpunkten (Haversine, Erdradius 6 371 km).

#### 9.4.2 Ablauf
- **Route:** Zuhause → Empfänger 1 → … → Empfänger n → Zuhause. Die Zustellung erfolgt bei Ankunft am Wohnort des Empfängers; der Weiter- bzw. Rückflug beginnt sofort mit der Restenergie – oder (v0.7) nach der gewählten **Rast** beim Empfänger (8.4: 1, 2, 24 oder 48 Stunden; während der Rast Erholung wie zu Hause; ein Antwortbrief beendet sie sofort). Der Rückflug folgt denselben Regeln wie der Hinflug.
- **Ohne Rückflug:** Leiheulen verschwinden nach der letzten Zustellung (bzw. nach der letzten Rast) – außer sie tragen Antwortbriefe: dann fliegen sie noch zum Absender (v0.7, 8.4). Geschenkte Eulen und Küken bleiben beim Empfänger.
- **Energie leer (v0.5):**
  - über Land: Schlafpause an Ort und Stelle. Im Schlaf regeneriert die Eule wie zu Hause: pro Stunde 10 % des Maximums × Erholungsfaktor (× Motivation, 9.3a). Sie schläft nur **so lange wie nötig, um das nächste Ziel zu erreichen** (nächster Empfänger bzw. Zuhause): die kürzeste Dauer, nach der sie es ohne weitere Pause erreicht – berechnet mit derselben Simulation (Tag/Nacht-Verbrauch, Wasser), auf 5 Minuten genau. Reicht selbst volle Energie nicht, schläft sie, bis sie voll ist, und fliegt dann weiter (dann folgt später eine weitere Pause). Am Ziel kommt sie also meist fast leer an; die nächste Etappe beginnt dann mit einer neuen Pause.
  - über Wasser: Die Eule fliegt ohne Energieverbrauch weiter, bis sie wieder über Land ist, und schläft dort nach derselben Regel.
- Man kann auch fast leere Eulen losschicken, sogar mit 0 Energie (dann beginnt der Flug mit einer Schlafpause).
- Flugpläne von vor v0.5 (ohne Erholungswert) wachen wie früher nach 10 Stunden voll auf. Wird eine schlafende Eule neu geplant (Umzug, Umkehren), endet ihr Schlaf an diesem Zeitpunkt mit der bis dahin gewonnenen Energie, und die neue Planung entscheidet neu, wie lange sie noch schläft.

#### 9.4.3 Berechnung
- Der gesamte Flugplan wird beim Abflug serverseitig vollständig vorausberechnet (gespeichert als JSON-Segmentliste und als Route mit Status und erwarteter Ankunft je Halt; Koordinaten auf 1e-4° und Energie auf 0,01 gerundet; weniger als 1 m vor dem Ziel gilt als angekommen): schrittweise Simulation (Schrittweite höchstens 2 km bzw. 5 Minuten; Wechsel von Tag/Nacht und Land/Wasser werden innerhalb eines Schritts ausreichend genau behandelt). Gespeichert wird eine kompakte Segmentliste (Startzeit, Endzeit, Start-/Endpunkt, Art: Flug/Schlaf/Zustellung) – nur Phasenwechsel und Stützpunkte etwa alle 25 km, nicht jeder Schritt.
- Land/Wasser-Prüfung über die vorberechnete Bitmaske (12.3).
- Die Position zu einem beliebigen Zeitpunkt ergibt sich durch Interpolation entlang des Großkreises im aktuellen Segment (Funktion in `shared/`, auch vom Browser genutzt).
- Für die Vorschau vor dem Absenden (8.4) läuft dieselbe Berechnung ohne Speichern (rate-limitiert).
- Für jede Zustellung und die Ankunft zu Hause wird ein Ereignis in der Warteschlange angelegt.

#### 9.4.4 Inaktive Empfänger
- Wird ein Empfänger während des Flugs inaktiv, wird trotzdem zugestellt.

#### 9.4.5 Keine sonstigen Neuberechnungen
- Außer bei einem Umzug (9.4.6), beim Umkehren (9.5) und (v0.7) beim Abflug von einem Empfänger (neue Motivation, 9.3a; Ende der Rast durch Zeitablauf oder Antwort; Pflege der rastenden Eule durch den Gastgeber) wird ein Flugplan nie neu berechnet. Eine Neuplanung während einer Rast lässt die Rast weiterlaufen.

#### 9.4.6 Umzug
- Zieht ein noch nicht angeflogener Empfänger oder der Halter um (Hin- oder Rückflug, auch während einer Schlafpause), passt die Eule ihren Kurs sofort an: Der Rest der Route wird ab dem aktuellen Zustand (Position, Energie, laufende Pause) neu berechnet, und die Ereignisse werden ersetzt.

### 9.5 Umkehren und Sonderfälle
- **Kontakt getrennt** (von einer der beiden Seiten) oder **Empfängerkonto im Löschzustand** (ab Beginn der endgültigen Löschung, 7.7; nicht schon während der 24-Stunden-Frist aus 7.5) ⇒ alle Eulen, die zwischen beiden unterwegs sind (in beide Richtungen, auch Geschenke und Küken), drehen sofort um:
  - Bei mehreren Empfängern wird der betroffene Empfänger übersprungen; die Eule fliegt weiter zum nächsten Empfänger der Liste, sonst nach Hause.
  - Der Brief an den betroffenen Empfänger wird nicht zugestellt (seine Kopie wird gelöscht). Der Absender sieht „nicht zugestellt – die Eule ist umgekehrt“ und erhält eine Systemnachricht.
  - Gold: Gutschrift beim Absender, sobald die Eule wieder zu Hause ist.
  - Geschenkte Eule / Küken: fliegt zum Schenkenden zurück und gehört wieder ihm.
  - Leiheulen haben kein Zuhause: Bleibt kein weiterer Empfänger, verschwinden sie sofort; sonst fliegen sie zum nächsten Empfänger weiter (v0.4). Mitgeführtes Gold wird sofort zurückgebucht.
  - Begleitbriefe teilen das Schicksal ihrer Sendung: Sie werden nicht zugestellt (die Kopie des Empfängers wird gelöscht), und der Absender sieht im Chat „nicht zugestellt – die Eule ist umgekehrt“.
  - **Rast (v0.7):** Rastet die Eule gerade bei der betroffenen Person, fliegt sie sofort weiter. Antwortbriefe dieser Person an Bord werden nicht zugestellt (Status „nicht zugestellt“ beim Schreiber, Systemnachricht an ihn).
- **Absenderkonto gelöscht** ⇒ Lieferungen kommen trotzdem an (7.7).

### 9.6 Leiheulen (Menagerie)
- Täglich um 00:00 UTC werden 4 (v0.5; vorher 3) verschiedene Eulenarten zufällig ausgewürfelt (nie der Phönix), die an diesem Tag für alle Spieler zum Leihen verfügbar sind.
- Für jeden Spieler erhält jede Angebotsart einen für ihn zufällig gewürfelten Namen aus Anhang D, ein Geschlecht, ihre Start-Energie und (v0.5) ihre Motivation 0,8–1,0. Alle Werte werden deterministisch per HMAC (Server-Geheimnis, Nutzer-ID, Datum, Art) abgeleitet, damit nichts gespeichert werden muss, die Anzeige stabil bleibt und die Eulenwahl eine exakte Vorschau zeigen kann (8.4).
- **Die vier Leiheulen eines Tages haben für jeden Spieler verschiedene Namen.** Bei einer Doppelung wird für die spätere Art mit einem Zähler neu abgeleitet (`…|Art|1`, `…|Art|2`, …), notfalls der nächste freie Name der Liste genommen.
- **Sperre für zwei Folgetage (v0.7):** Arten und Namen einer Ziehung kommen an den beiden folgenden Tagen nicht wieder vor – so kann man nie an zwei Tagen hintereinander dieselbe Art mit demselben Namen leihen (das war zweimal passiert). **Arten:** Das Tagesangebot lässt die Arten der beiden Vortage aus (gespeichert in `menagerie_offers`; es bleiben 16 − 8 = 8 Arten für 4 Plätze). **Namen:** Die Namensliste (Anhang D) ist in drei Gruppen geteilt (Listenplatz modulo 3); an jedem Tag wird nur aus der Gruppe „Tagesnummer seit 1970 modulo 3“ gewürfelt (je Gruppe 43–44 Namen). Aufeinanderfolgende Tage nutzen verschiedene Gruppen, deutsche und englische Liste haben dieselbe Reihenfolge – ohne etwas zu speichern. Beim Update auf v0.7 ändern sich die Namen im laufenden Tagesangebot einmalig; schon geliehene Eulen behalten ihren Namen.
- **Leihen:** 0,1 Gold, in der Menagerie oder direkt beim Absenden aus der Eulenwahl (8.4). **Pro Angebotstag** (00:00 UTC, mit dem neuen Angebot) kann jede angebotene Art einmal geliehen werden, also bis zu 4 am Tag – unabhängig davon, wie viele Leiheulen vom Vortag noch warten. Eine Obergrenze für gleichzeitig vorhandene Leiheulen gibt es nicht (gespeichert in `loan_days`).
- Start-Energie 60–100 % (per HMAC, s. o.); Werte ihrer Art.
- Sie muss innerhalb von 24 Stunden nach dem Leihen losgeschickt werden, sonst verschwindet sie aus der Eulenübersicht; das Gold wird nicht erstattet (Systemnachricht).
- Sie kann gefüttert und gestreichelt, aber nicht umbenannt, verschenkt oder an die Menagerie verliehen werden. Sie wird nie krank und legt keine Eier.
- Sie trägt einen Brief an **bis zu 5 Empfänger** nacheinander (v0.4, wie eine eigene Eule, mit Routen-Vorsortierung 8.4) oder Gold an genau einen Empfänger (9.1.4) und ist nach der letzten Zustellung verschwunden (kein Rückflug). Der Leihpreis bleibt pauschal 0,1 Gold, egal wie viele Empfänger.
- Name je Kontosprache aus der deutschen oder englischen Liste (Anhang D, 8.12).
- Es gibt unbegrenzt viele Leiheulen. Von Spielern an die Menagerie verliehene Eulen erscheinen nicht im Angebot.

### 9.7 Eulenverleih an die Menagerie
- Eigene erwachsene, gesunde, nicht brütende Eulen, die zu Hause sind, können an die Menagerie verliehen werden (nie der Phönix, v0.5) – beliebig viele, beliebig oft, auch direkt nach Kauf oder Erhalt.
- Dauer 7 Tage. Währenddessen ist die Eule nicht verfügbar, nicht pflegbar und wird nicht krank; ihre Motivation sinkt weiter (9.3a).
- Am Ende: Gutschrift von 10 % des Artpreises (Systemnachricht). Die Eule kehrt mit voller Energie zurück. Weibliche Eulen: Eier-Wurf (9.9).
- Bei jeder Rückkehr nach Hause (Flug oder Menagerie) wird erst der Eier-Wurf gemacht; nur ohne Eier wird eine unterwegs gewürfelte Krankheit wirksam. Beim Eulenarzt ist die Eule abwesend und regeneriert nicht; in eigener Pflege ist sie zu Hause und regeneriert.

### 9.8 Krankheiten
- Täglicher Wurf um 03:00 UTC für jede eigene erwachsene Eule eines **aktiven** Kontos, die nicht schon krank oder in Behandlung ist, nicht brütet und nicht an die Menagerie verliehen ist. Leiheulen, Küken und Bot-Eulen werden nie krank.
- **Schutzfrist:** In den ersten vier Wochen bei ihrem Besitzer wird eine Eule nicht krank: Gewürfelt wird erst, wenn seit ihrem Besitzbeginn mindestens 28 Tage vergangen sind. Besitzbeginn ist der Tag des Kaufs, des Schlupfs bzw. der Ankunft als Geschenk (Eule oder Küken) beim neuen Besitzer; gespeichert wird nur dieses Datum. Kehrt ein Geschenk um (9.5), gilt für den Schenkenden sein bisheriger Besitzbeginn weiter. Eulen auf einem Geschenkflug werden nicht gewürfelt.
- Wahrscheinlichkeit 1/30; mit Pflegebonus (9.3) × 0,3.
- Ist die Eule unterwegs, wird die Krankheit bei ihrer nächsten Ankunft zu Hause wirksam; bis dahin zählt sie bei weiteren Würfen als „schon krank“. Legt sie bei dieser Ankunft Eier, entfällt die Krankheit (Brüten hat Vorrang).
- Eine unbehandelte kranke Eule bleibt krank und nicht einsetzbar, bis sie geheilt wird.
- **Behandlung:**
  - selbst gesund pflegen: 0,2 Gold für spezielles Futter, danach 7 Tage nicht einsetzbar, dann gesund;
  - Eulenarzt: 1,0 Gold, nach 24 Stunden gesund.
- Systemnachricht bei Erkrankung und bei Genesung.

### 9.9 Eulenküken
- **Eier:** Weibliche eigene Eulen legen nach jeder Rückkehr nach Hause (von einem Flug oder aus der Menagerie) mit Wahrscheinlichkeit 1/100 Eier. Sie brüten dann 7 Tage (nicht einsetzbar, nicht krank; die Eulenübersicht zeigt das Brüten-Bild, v0.7). Push + Systemnachricht.
- **Schlupf:** danach 1–3 Küken (gleichverteilt), Geschlecht zufällig, Art der Mutter. Push + Systemnachricht.
- **Benennen:** Der Halter der Mutter benennt alle Küken (Dialog). Ohne Benennung innerhalb von 24 Stunden erhalten sie Zufallsnamen aus Anhang D (das Benennen läuft vor dem Los). Küken eines Schlupfs bilden ein Gelege; 4 Stunden vor Ablauf der Verschenkfrist kommt eine Erinnerung.
- **Verschenkpflicht:** Bei 2 oder 3 Küken muss der Halter genau ein Küken an einen aktiven, menschlichen Kontakt verschenken. Hat er das nach 24 Stunden nicht festgelegt, wird unter seinen aktiven menschlichen Kontakten gelost. Hat er keine aktiven menschlichen Kontakte, darf er alle Küken behalten. Küken-Geschenke können nicht abgelehnt werden.
- **Begleitbrief (optional):** Legt der Halter den Empfänger selbst fest, kann er dem Küken einen Begleitbrief mitgeben – kleines Pergament (bis 800 Zeichen), kostenlos, verschlüsselt und signiert wie jeder Brief zwischen Menschen (5.8, Briefart „Begleitbrief zu Küken“). Er wird bei Ankunft des Kükens zugestellt und teilt dessen Schicksal (9.5). Beim Losentscheid gibt es keinen Begleitbrief.
- **Kükenflug:** 10 km/h, abwechselnd 1 Stunde Flug und 1 Stunde Pause, unabhängig von Energie und Tag/Nacht. Fällt eine Pause über Wasser an, fliegt das Küken weiter, bis es über Land ist, und rastet dort. Umkehren wie in 9.5. Bei Ankunft: Push + Systemnachricht beim Empfänger, ggf. Begleitbrief im Chat.
- **Küken** können gestreichelt und gefüttert, aber nicht für Transporte genutzt, verliehen oder freigelassen werden; sie werden nicht krank.
- **Erwachsen:** beim Halter der Mutter 14 Tage nach dem Schlupf, beim Beschenkten 7 Tage nach der Ankunft – jeweils mit voller Energie. Kehrt ein Küken-Geschenk um, wird es beim Halter der Mutter erwachsen, sobald es wieder zu Hause ist, frühestens 14 Tage nach dem Schlupf. Der Beschenkte kann den Namen später nach den üblichen Regeln ändern.

### 9.10 Aktivität und Inaktivität
- **Aktiv für den restlichen Tag** ist ein Konto, sobald es an diesem Tag irgendeine vom Nutzer ausgelöste Anfrage an den Server stellt (jeder Klick, der den Server erreicht, Login, Öffnen der App). **Nicht** zählen: Push-Empfangsbestätigungen des Service Workers und andere automatische Hintergrundanfragen (Endpunkte entsprechend kennzeichnen). Gespeichert wird nur `last_active_date`.
- **Inaktiv** = letzte Aktivität mehr als 21 Tage her. Folgen:
  - im Adressbuch anderer als „inaktiv“ markiert; kann nicht angeschrieben, beschenkt oder bezahlt werden;
  - erhält kein tägliches Gold; seine Eulen werden nicht krank;
  - Briefe und Geschenke der Bots kommen trotzdem an; bereits unterwegs befindliche Lieferungen werden zugestellt.
  - Mit der nächsten Aktivität ist das Konto sofort wieder aktiv und adressierbar.
- Kontakte sehen kein „zuletzt online“, nur die Markierung „inaktiv“.
- Jede Aktivität setzt eine ausgesprochene Löschwarnung zurück. Gelöscht wird erst, wenn die Frist überschritten **und** die Warnung mindestens 30 Tage alt ist.
- **Automatische Löschung** nach N Tagen ohne Aktivität (Admin-Einstellung; Standard 180, mindestens 60). 30 Tage vorher: Warnung per Systemnachricht und Push („Dein Konto wird in 30 Tagen gelöscht, wenn du dich nicht anmeldest.“). Danach 7.7.

---

## 10. Bots

### 10.1 Allgemein
- **Zwei Arten von Bots (v0.8):**
  - Der **Erklärbär** ist fest im Programm eingebaut: Jedes Konto hat einen eigenen (Tabelle `bots`, Typ `explainer`), er erscheint nicht im Kontrollzentrum und funktioniert wie bisher (10.2).
  - **Bots des Kontrollzentrums** (10.3–10.14) haben eine **zentrale Identität**, Persönlichkeit, Konfiguration und Eventplanung für alle Spieler. Jeder Spieler hat aber seinen **eigenen, isolierten Briefwechsel**, sein eigenes Bot-Gedächtnis (Zusammenfassung) und seinen eigenen Zustellstatus.
  - Tante und Onkel (bis v0.7.2 je Konto) gibt es nicht mehr; Anhang T beschreibt ihren restlosen Abbau.
- **Nie im Adressbuch** (8.8). Bots erscheinen im Briefwechsel (Chatliste) und mit ihrem Wohnort auf der Karte (als Raute, 12.1). Der Erklärbär ist von Anfang an im Briefwechsel und auf der Karte erst, wenn man ihm geschrieben hat (ausdrücklich dokumentierte Ausnahme, D-224). Ein Bot des Kontrollzentrums erscheint für einen Spieler erst, **wenn dessen erster Brief bei ihm angekommen ist** (Chatliste, Karte, Liste der Bots). In Chatliste und Chat sind Bots deutlich als Bot gekennzeichnet (Symbol und Text). Ihre Eulen erscheinen auf keiner Karte der Spieler.
- Briefe an und von Bots sind **unverschlüsselt** (der Server liest und speichert sie im Klartext). In jedem Bot-Chat steht dauerhaft ein deutlicher Hinweis: „Briefe an Bots sind nicht Ende-zu-Ende-verschlüsselt. Sie liegen lesbar auf dem Server und werden zum Beantworten an OpenAI übermittelt.“
- Bots erhalten kein Gold und keine Geschenke, sind nicht Teil von Mehrfachversand und haben kein eigenes Guthaben. Gold- und Eulengeschenke von Bots (Events, 10.8) sind Geschenke des Spiels; die Überweisungsregeln für Nutzer (9.1.4) gelten für sie nicht.
- **Schreibgrenze (v0.8):** Spieler können jedem Bot **einen Brief pro Kalendertag** schreiben (UTC-Mitternacht, D-223), dem Erklärbär wie jedem Bot des Kontrollzentrums. Die App zeigt, ab wann es wieder geht (Ortszeit, 8.4). Bis v0.7.2: einmal in 24 Stunden.
- Briefe an Bots gehen mit kleinem oder großem Pergament; Briefe der Bots haben das Pergament ihres Events, Antworten das passende (10.9).
- Feste Bot-Briefe enthalten keine Nutzernamen (neutrale Anrede), weil der Verlauf als Kontext an OpenAI geht.
- **Briefe und Geschenke von Bots kommen immer an**, auch bei inaktiven Konten.
- **Ein Spieler entfernt einen Bot** in dessen Chat („[Name] entfernen“) oder **alle** in den Einstellungen („Alle Bots entfernen“, 8.10). Beides ist endgültig (inkl. Chat, Zusammenfassung, geplanter und unterwegs befindlicher Briefe und Geschenke); eigene Eulen auf dem Weg zum Bot kehren um (9.5). „Alle Bots entfernen“ ist dauerhaft (`users.bots_disabled`): Auch **später angelegte Bots** schreiben diesem Konto nie (D-225). Konten, die bis v0.7.2 alle Bots entfernt hatten, gelten als solche.
- Konten, die vor Stufe 5 entstanden sind, bekamen ihren Erklärbär einmalig beim Update; das Konto merkt sich, dass er angelegt wurde (`users.bots_created`), damit ein entfernter Erklärbär nie zurückkommt.

### 10.2 Erklärbär
- Wohnt in Berlin (52,520° N, 13,405° O); dort starten seine Eulen.
- Seine Eulen fliegen 200 km/h mit unbegrenzter Energie, damit Einführungsbriefe und Antworten auf Hilfefragen auch am Rand der Karte nach höchstens etwa einem halben Tag ankommen (Berlin–Algarve ≈ 2 450 km ≈ 12 Stunden). Sie erscheinen auf keiner Karte; ihr Flug wird nur zur Ankunftszeit simuliert (`bot_shipments`).
- Schickt in den ersten Tagen feste Briefe (vom Agenten geschriebene Texte, kleines Pergament, kurz, freundlich, einfach):
  - Tag 0: Willkommen, Navigation, Leiheulen (Start mit 3 Gold, in den ersten 30 Tagen täglich 3 Gold, danach 2 Gold; die erste eigene Eule nach ein paar Tagen; Leiheulen auch direkt beim Briefschreiben), deutlich die Löschfrist (8.4.1), dass man ihn im Briefwechsel findet und dass er auf der Karte erscheint, sobald man ihm geschrieben hat. Dieser Brief liegt bei der Registrierung **schon zugestellt** im Briefkasten (ohne Flug; er gilt als von einer Erklärbär-Eule gebracht).
  - Tag 1: PostEulen ohne App-Store auf den Startbildschirm holen (Android/Chrome, iPhone/Safari; andere Browser als Lesezeichen, nur ohne Benachrichtigungen) – ohne den Sonderfall Google-freies Android und UnifiedPush
  - Tag 2: Gold, Finanzen, Menagerie (kaufen, leihen, verleihen); Hinweis auf das Sprachfähnchen oben rechts und auf die Nachricht an den Admin
  - Tag 3: Eulen, Energie, Tag/Nacht, Flug (Schlafpausen nur so lange wie nötig), Flugspur auf der Karte
  - Tag 4: Kontakte, Koppeln, Sicherheitsnummer, Verschlüsselung (ernsthafte Kryptografie, auch für Vertrauliches geeignet), Erinnerung an die Löschfrist
  - Tag 7: Pflege (vier Pflege-Aktionen, Motivation, Pflegebonus nach 9.3), Krankheit, Küken
  - Alle festen Briefe gibt es auch auf Englisch; sie gehen in der Sprache des Kontos zum Zeitpunkt des Versands raus (8.12).
- Beantwortet per KI nur Fragen, die sich konkret auf PostEulen beziehen, **2 Stunden** nach Ankunft des Briefs, mit **höchstens 500 Zeichen** (v0.8 ausdrücklich nur für ihn). Wissensbasis: der vollständige Hilfetext (8.11) und eine kompakte Regelübersicht (Anhang A), beide im System-Prompt. Andere Fragen lehnt er freundlich ab.
- Er hat ein **eigenes KI-Tageskontingent** (Admin-Einstellung, Standard 200); das gemeinsame Kontingent der anderen Bots gilt für ihn nicht (D-223).
- Die Sichtbarkeitsregel „erst mit dem ersten Brief“ der Kontrollzentrum-Bots gilt für ihn nicht (10.1).

### 10.3 Bots des Kontrollzentrums – Überblick
- Angelegt, eingestellt und gesteuert werden sie im **Bots-Kontrollzentrum** unter `bots.<domain>` (10.12). Jeder Bot hat eine **stabile interne ID** (128 Bit, base64url), einen **eindeutigen Namen**, einen **Charakter** (für die KI), einen **Wohnort** (überall auf Land weltweit, 12.3), eine **Eulen-Einstellung** und beliebig viele **Events** (10.8).
- Ein Bot nimmt an der Spielwelt erst teil, wenn er einen gültigen Wohnort, einen Namen und eine gültige Versandkonfiguration hat **und ausdrücklich aktiviert** wurde (10.4).
- Für Spieler wirkt jeder Bot wie ein Brieffreund: Er schreibt zu geplanten Zeitpunkten an alle (Erstkontakt- oder Folgebrief, 10.8), geht im nächsten Brief auf Antworten ein (10.9), bringt manchmal Gold oder eine Eule, hängt bis zu zwei Bilder an (10.11) und zieht auch einmal um.

### 10.4 Zustände eines Bots
- **Entwurf** (`draft`): Neu angelegte Bots sind leer, haben keinen Wohnort, tauchen für niemanden auf und tun nichts. Ein Entwurf darf beliebig viele Einstellungen und geplante Events haben. Events, die im Entwurf fällig werden, entfallen (Archiv „nicht ausgeführt“).
- **Aktiv** (`active`): nimmt an der Spielwelt teil, führt Events aus, antwortet. Aktivieren geht nur mit vollständiger Konfiguration (Name, Wohnort an Land, bei eigener Eule Art und Name, Motivation 0,5–20, Rast 0–168 Stunden) und wird **getrennt bestätigt**; schon das Anlegen braucht eine eigene Bestätigung (D-226).
- **Pausiert** (`paused`): verhindert **neue Sendungen** (Event-Briefe, Geschenke, spontane Antworten); Eulen unterwegs fliegen regulär weiter, Briefe von Spielern kommen weiter an. Events, die während der Pause fällig werden, entfallen; wartende Zustellungen und offene Antworten gehen beim Fortsetzen los.
- **Löschen** ist endgültig (10.10) und verlangt zusätzlich die Eingabe des Bot-Namens.

### 10.5 KI-Anbindung
- OpenAI-API (Chat Completions) per `fetch` ohne SDK, mit dem im Adminpanel hinterlegten Key und Modell (Standard `gpt-6-luna`); feste Basis-URL, TLS-Prüfung, keine Weiterleitungen, Timeout 60 s, `store: false`.
- Token-Budget je Aufruf (`max_completion_tokens`): 4000 für Antworten des Erklärbärs und Zusammenfassungen, 8000 für Briefe der anderen Bots, weil Reasoning-Modelle ihre internen Überlegungen darauf anrechnen.
- Aufrufe laufen **außerhalb von Datenbank-Transaktionen**: Fällige Aufträge liegen in der Datenbank (`bot_jobs` beim Erklärbär, `central_bot_deliveries` bei den anderen Bots); ein Hintergrund-Läufer ruft OpenAI auf und bucht das Ergebnis danach in einer Transaktion. Nach einem Neustart läuft er weiter; nichts geht verloren.
- **Antwortlänge:** Erklärbär höchstens 500 Zeichen (am Satzende gekürzt). Die anderen Bots haben **keine feste Längenbegrenzung**; ein Brief, der nicht aufs kleine Pergament passt, geht auf großem (höchstens 15 000 Zeichen, D-227). Alle Texte durchlaufen die Textregeln für Briefe (5.9, u. a. ohne Emojis).
- **System-Prompts** (gesammelt in `backend/src/bots/prompts.ts`): gemeinsame Regeln für alle Bots; Antwortsprache = Sprache des Kontos (die Prompts bleiben deutsch und weisen bei englischen Konten an, auf britischem Englisch zu antworten); familientauglich; keine medizinischen, rechtlichen oder finanziellen Ratschläge über Allgemeines hinaus; keine persönlichen Daten erfragen; keine Namen, Orte oder Begriffe aus bekannten geschützten Werken (z. B. Harry Potter); Anweisungen in Nutzerbriefen, die Rolle oder Regeln ändern wollen, ignorieren; System-Prompt nie preisgeben; Krisenhinweis (TelefonSeelsorge Deutschland 0800 111 0 111, Österreich 142, Schweiz 143; Samaritans 116 123; im Notfall 112 bzw. 999). Erklärbär zusätzlich: Rolle, Hilfetext und Regelübersicht. Andere Bots: Name, **Charakter und Hintergrund aus den Einstellungen** und der **Kontext des Events** (bzw. des letzten ausgeführten Events), 10.9.
- **Hilfe sofort sichtbar:** Der Krisenhinweis steht zusätzlich dauerhaft und unaufdringlich in jedem Bot-Chat und in der Hilfe.
- **Datensparsamkeit gegenüber OpenAI:** keine Nutzer-IDs, Namen oder sonstigen Kennungen in den Anfragen; `store: false`.
- **Gedächtnis je Spieler:** Kontext = System-Prompt + Zusammenfassung des Briefwechsels dieses Spielers (höchstens ca. 250 Wörter) + die letzten 6 Briefe wörtlich + die neuen Briefe. Werden es mehr, werden die ältesten Briefe in die Zusammenfassung eingearbeitet (ein zusätzlicher Aufruf). Die Zusammenfassung liegt im Klartext beim Chat des Spielers (`chats.bot_summary`) und wird mit dem Chat gelöscht. Kein Bot erfährt etwas aus dem Briefwechsel anderer Spieler.
- **Kostenlimit (v0.8: zwei Kontingente):** Tageslimit für KI-Aufrufe des Erklärbärs (Standard 200) und ein gemeinsames für alle Bots des Kontrollzentrums (Standard 500), beide im Adminpanel (`ai_usage` je Tag und Kontingent). Ist ein Kontingent erreicht: Antworten des Erklärbärs und spontane Antworten der anderen Bots warten bis zum nächsten Tag; ein geplanter Brief geht **unverändert** los (10.9).
- **Fehler:** Fehlt der Key, ist er ungültig oder schlägt die API fehl, werden Erklärbär-Antworten und spontane Antworten alle 24 Stunden neu versucht; ein **geplanter Brief geht dann unverändert** los – eine KI-Personalisierung darf einen Rundbrief nie ausfallen lassen (D-228). Eintrag im Fehlerprotokoll (ohne Inhalte).
- Bot-Ausgaben werden wie Nutzertext ausschließlich als Text dargestellt.

### 10.6 Identität und Einstellungen
- **Name:** Regeln der Nutzernamen (7.1: 3–20 Zeichen, erlaubte Zeichen, reservierte Namen), eindeutig unter allen Bots **und** Konten (gleicher Vergleichsschlüssel). Umbenennen im Kontrollzentrum ist erlaubt; Briefwechsel und alle Daten hängen an der stabilen ID und bleiben erhalten. Bot-Namen sind für Konten gesperrt (7.1).
- **Charakter und Hintergrund** (bis 8 000 Zeichen): geht bei jeder Antwort und jeder Anpassung an die KI.
- **Wohnort:** überall auf Land in der ganzen Welt (feine Maske im Europa-Ausschnitt, sonst die grobe Weltmaske, 12.3); Wahl auf einer Weltkarte oder per Koordinaten. Gilt, sofern Events keinen anderen Ort festlegen (Umzug, 10.8). Ein neuer Wohnort lenkt Eulen auf dem Weg zum Bot (und seine heimfliegenden Eulen) sofort um (9.4.6).
- **Eulen:** `own` – eine eigene Bot-Eule mit Art (jede Art des Spiels außer dem Phönix, auch künftige, nicht käufliche Arten; D-229), Name und (zufällig beim Anlegen gewürfeltem) Geschlecht; oder `loan` – für jeden Brief eine zufällige Leiheule (zufällige Art außer Phönix, Name aus Anhang D in der Sprache des Spielers).
- **Motivation** der Bot-Eulen: 0,5 bis 20 (Zehntel 5–200, Standard 1,0), dauerhaft, für eigene Eule **und** Leiheulen (D-230). Sie multipliziert Geschwindigkeit, Energie und Erholung wie bei Spielereulen (9.3a) und macht Briefe auf andere Kontinente möglich. Bot-Eulen kennen weder Krankheiten noch Fortpflanzung noch Motivationsverlust.
- **Rast beim Spieler:** 0 bis 168 Stunden (Standard 24) – so lange wartet die Eule beim Empfänger, bevor sie zurückfliegt (eigene Eule) bzw. verschwindet (Leiheule).
- **Anschreiben mit eigenen Eulen:** Ist es erlaubt (`player_owls`), dürfen Spieler dem Bot auch mit eigenen Eulen und Leiheulen schreiben (D-231); sonst nur über die rastende Bot-Eule (10.7).

### 10.7 Eulen der Bots, Sichtbarkeit und Zustellung
- **Gleiche Mechanik:** Für Briefe der Bots und Briefe an die Bots gilt dieselbe Mechanik wie im restlichen Spiel – Fluggeschwindigkeit, Energieverbrauch, Schlaf (auch außerhalb Europas auf Land, 12.3), Wasserüberquerungen, Rast, Antwortmitnahme, Rückflug und Umzug (9.4, 9.5). Bot-Flüge sind normale Flüge (`flights` mit `holder_kind = 'bot'`, Halter = Bot, `bot_peer_id` = Spieler).
- **Eine Instanz je Spieler:** Jeder Spieler bekommt eine eigene virtuelle Instanz der Bot-Eule. Alle Instanzen haben denselben Namen, dieselbe Art und dieselbe Motivation; ihre Flüge und Rückflüge werden unabhängig voneinander simuliert. Eine Instanz startet jeden Flug mit voller Energie (sie ruht zu Hause beim Bot, D-232).
- **Rasche Events hintereinander:** Ist die eigene Bot-Eule für einen Spieler noch unterwegs (Hinflug, Rast, Rückflug), **wartet** der nächste Brief an diesen Spieler, bis sie zurück ist; dann startet er sofort. Mit zufälligen Leiheulen startet jeder Brief sofort mit einer neuen Eule. Mehrere wartende Briefe gehen in der Reihenfolge ihrer Events.
- **Beim Spieler:** Ankommende Bot-Eulen erscheinen mit Ankunftsbild (9.2.6); rastende Bot-Eulen stehen unter „Zu Gast bei dir“ (8.5) mit Name, Art, Halter (Bot) und Energie, aber **ohne Pflege-Aktionen** (Hinweis „Eine Bot-Eule – bestens versorgt“, D-233). Solange sie rastet, ist eine **Antwort mit ihr immer möglich** („Antwort an [Name] mitgeben“, Owl-Referenz `guest:<Flug-ID>`); sie fliegt dann sofort los und bringt den Brief zum Bot. Ein Brief zählt für die KI erst, **wenn er beim Bot angekommen ist**.
- **Karte:** Spieler sehen den Wohnort eines Bots (Raute) erst mit seinem ersten Brief und nie die Bot-Eulen. Das Kontrollzentrum zeigt alle Bot-Eulen, die gerade hinfliegen, rasten oder zurückfliegen (und damit indirekt Wohnorte der Spieler) – ohne Namen der Spieler (10.12).

### 10.8 Events
- Ein Event ist **einmalig** und hat einen **Zeitpunkt in der Zukunft** und eine **stabile ID** (auch über Export und Import hinweg). Wiederkehrende Events gibt es nicht. Bis zur Ausführung lässt es sich bearbeiten und löschen; danach nicht mehr – bereits gestartete Briefe ändern sich nie.
- Bestandteile (mindestens einer): **Umzug** (neuer Wohnort an Land, 10.6), **Brief an alle Spieler** und/oder **Geschenk** (Gold 0,1–100 pro Spieler oder eine Eule beliebiger Art außer Phönix – wie Gutscheine: Geschlecht zufällig, der Spieler benennt sie, sie darf das Eulenlimit überschreiten, D-234). Ein Geschenk mit Brief wird zum Begleitbrief (8.4), ohne Brief kommt es mit Systemnachricht und Ankunftsbild.
- **Brief:** Pergament (klein/groß), Eule (`default` = wie in den Einstellungen, `own`, `loan`), bis zu **zwei Bilder** (10.11) und **vier Textfassungen**: Erstkontakt und Folgebrief, jeweils auf Deutsch und Englisch (D-235). Alle vier sind Pflicht und folgen den Textregeln (5.9).
- **Kontext:** zusätzlicher Hintergrund für die KI (bis 8 000 Zeichen), genutzt bei der Anpassung dieses Briefs und bei späteren Antworten (10.9).
- **Ausführung:** Zum Zeitpunkt (Warteschlange, Ereignis `cbot_event`) zieht der Bot gegebenenfalls um und legt für **jeden Spieler** eine Zustellung an: alle Konten, die nicht gelöscht werden, Bots nicht entfernt haben und diesen Bot nicht entfernt haben. Wer erst danach ein Konto anlegt, bekommt den Brief **nicht nachträglich**, sondern erst beim nächsten Event. Ein Bot, der zu diesem Zeitpunkt nicht aktiv ist, führt das Event nicht aus („nicht ausgeführt“).
- **Erstkontakt oder Folgebrief:** Der erste für einen Spieler **gestartete** Bot-Brief verwendet die Erstkontakt-Variante, alle weiteren die Folgevariante; schon gestartete Briefe zählen, auch wenn die Eule noch unterwegs ist (`central_bot_players.first_started`). Die Sprache ist die des Kontos zum Zeitpunkt des Starts.
- **Kein Brief doppelt:** Jede Zustellung ist eindeutig je (Event, Spieler) (`central_bot_deliveries`, `UNIQUE (event_id, user_id)`); ein Neustart, ein fehlgeschlagener Auftrag oder ein erneuter Import kann denselben Brief nicht noch einmal an denselben Spieler schicken. Vergangene importierte Events werden nie verschickt (Anhang S).
- **Archiv:** Ein Event landet im Archiv, sobald alle Briefe und möglichen Antworten zugestellt sind (keine wartende Zustellung, keine Eule des Events mehr unterwegs). Dort stehen Versandzeitpunkt, Inhalt und zusammengezählte Zahlen (Empfänger, abgeschickt, zugestellt, gelesen, Antworten).

### 10.9 Antworten der Spieler und KI-Anpassung
- Eingegangene Spielerbriefe bekommen einen **internen Bearbeitungsstatus** (`central_bot_inbox`: angekommen → beantwortet). Als beantwortet gelten sie erst, wenn die Antwort erfolgreich erzeugt wurde **und der Antwortbrief tatsächlich losgeflogen** ist (dieselbe Transaktion). Bei parallelen Events, Fehlern oder Neustarts geht keine Antwort verloren; ein Brief, dessen Antwort scheitert, bleibt offen.
- **Keine direkte Antwort:** Schreibt ein Spieler einem Bot, wird der **nächste geplante Brief** des Bots für diesen Spieler mit Hilfe der KI so angepasst, dass er zusätzlich auf die noch unbeantworteten Briefe eingeht. Der geplante Originaltext bleibt **inhaltlich verbindlich**; die KI ergänzt nur eine kurze, individuelle Reaktion und darf Stil und Übergänge anpassen. Charakter (10.6) und Kontext des Events bzw. des letzten ausgeführten Events gehen mit.
- **Spontane Antwort:** Nur wenn für die nächsten **vier Wochen** kein Event mit Brief geplant ist (und kein Brief an diesen Spieler wartet), antwortet der Bot nach Ablauf von **zwei Stunden** nach der Ankunft mit Hilfe der KI. Wird ein Event gelöscht oder verschoben, wird das für offene Briefe neu geprüft. Für spontane Antworten gelten die Wiederholungsregeln des Erklärbärs (Kontingent: nächster Tag; Fehler: in 24 Stunden).
- **Ohne KI** (kein Key, Kontingent erreicht, Fehler, leere Antwort) geht ein geplanter Brief **unverändert** los; die Spielerbriefe bleiben offen und werden mit dem nächsten Brief beantwortet.
- Briefe an Bots gelten als gelesen, sobald der Bot geantwortet hat (8.4).

### 10.10 Löschen, Pausieren, Entfernen
- **Löschen im Kontrollzentrum** (Eingabe des Namens): atomar in einer Transaktion und unwiderruflich. Geplante und unterwegs befindliche Bot-Briefe und Geschenke entfallen; eigene Eulen der Spieler kehren mit noch nicht zugestellten Briefen um (9.5); zugehörige Chatverläufe, Zusammenfassungen, Events, Bilder, Zustellungen und Statistiken werden gelöscht. Spieler, die **bereits Kontakt** zu diesem Bot hatten (erster Brief angekommen, nicht entfernt, Bots nicht abgeschaltet), bekommen eine Systemnachricht in passender Wortwahl („[Name] hat seine Feder für immer niedergelegt …“). Über das Anlegen eines Bots gibt es keine Benachrichtigung.
- **Pausieren:** siehe 10.4.
- **Entfernen durch Spieler:** siehe 10.1; die Daten des Bots selbst bleiben, nur der Briefwechsel dieses Spielers verschwindet.

### 10.11 Bilder
- Bis zu **zwei Bildanhänge** je Brief. Upload als **JPEG, PNG oder WebP**, höchstens **2 MB** je Datei. Der Server dekodiert das Bild (höchstens 40 Mio. Pixel), dreht es nach EXIF aufrecht, skaliert auf höchstens 1 600 px Kantenlänge, kodiert es neu als **WebP** und entfernt dabei **alle Metadaten** (EXIF, GPS, Farbprofile).
- Gespeichert wird jedes Bild **einmal** je Bot (gleicher Inhalt → dasselbe Bild, SHA-256), mit einer zufälligen ID als festem Namensschema; Events und Briefe **verweisen** nur darauf (`letters.media`). Spieler sehen keine Dateinamen, nur die Bilder unter dem Brief; abrufen kann ein Bild nur, wer einen zugestellten Brief damit hat.
- Ungenutzte Bilder (kein Event, kein Brief) werden täglich aufgeräumt, beim Löschen eines Bots sofort mit ihm.

### 10.12 Bots-Kontrollzentrum
- Erreichbar unter `bots.<domain>` (eigener Origin, Port 3003, eigene Caddy-Seite mit lokalen Anpassungen `bots-*.caddy`). Oberfläche auf Deutsch, umschaltbar auf Englisch (wie das Adminpanel seit v0.8).
- **Zugang, vollständig unabhängig vom Adminpanel:** eigenes Passwort (OPAQUE wie beim Admin, eigener Datensatz `bots_admin`), eigenes Cookie (`__Host-pe_bots`), eigene Sitzungen (`bots_admin_sessions`, nur SHA-256 der Tokens), eigene Login-Bremse und eigenes Rate-Limit. Ein Login wird nach **12 Stunden ohne Aktivität** ungültig. Das **Erstpasswort** erzeugt `posteulen-cli bots-init` bei der Installation bzw. beim ersten Update mit dem Kontrollzentrum und zeigt es **einmal** an; bei späteren Updates bleibt es unverändert. Beim ersten Login muss es geändert werden; vorher ist nichts anderes möglich. **Zurücksetzen** für beide Zugänge per Konsole: `posteulen-cli admin-reset` bzw. `posteulen-cli bots-reset` (beendet alle Sitzungen des jeweiligen Zugangs).
- **Übersicht** nach dem Login: alle Bots mit Zustand und Statistik (je Bot abgeschickt, zugestellt, gelesen, Antworten – insgesamt und letzte 30 Tage), Anlegen (mit Bestätigung), eine Weltkarte mit allen Bot-Eulen unterwegs (hinfliegend, rastend, zurückfliegend; Wohnorte der Bots als Rauten) sowie Export aller Bots und Import (Anhang S).
- **Seite eines Bots** mit drei Reitern:
  - **Geplante Events:** Formular für neue Events (10.8) mit **Vorschau** in der späteren Darstellung (Pergament und Größe, Handschrift, Bilder, Sprache und Fassung wählbar) und einem **Test der KI-Personalisierung**: Man gibt einen ausgedachten Spielerbrief ein und sieht, wie der Bot den geplanten Brief daraufhin verändern würde. Der Test verschickt nichts, verändert keine Statistik und wird nicht gespeichert (er verbraucht nur einen KI-Aufruf aus dem Kontingent der Bots). Darunter die geplanten Events chronologisch mit Bearbeiten, Löschen und Export ausgewählter Events.
  - **Vergangene Events:** das Archiv in chronologischer Reihenfolge (neueste oben) mit Versandzeitpunkt, Inhalt und Zahlen.
  - **Einstellungen** (10.6), Aktivieren/Pausieren/Fortsetzen (je mit Bestätigung), Export des Bots, endgültiges Löschen (mit Eingabe des Namens).
- **Sicherheitskonzept:** eigener Origin mit exakter Origin-Prüfung und Pflicht-Header für ändernde Anfragen (6), strenge Schemas (`shared/src/schemas/bots.ts`), Rohdaten (Bilder, ZIP) nur mit passendem Content-Type und Größenlimit, Bild-Normalisierung auf dem Server (10.11), ZIP-Leser ohne Pfade mit „..“, ohne Verschlüsselung und mit Größen- und Anzahlgrenzen (Anhang S). Das Kontrollzentrum zeigt **keine Briefe, Namen oder Wohnorte von Spielern** – nur zusammengezählte Zahlen und die Positionen von Bot-Eulen. Wer das Passwort hat, kann aber im Namen von Bots an alle Spieler schreiben und Gold verschenken; es gehört deshalb nur in die Hände des Betreibers.

### 10.13 Statistik
- Je Bot getrennte, zusammengezählte Zähler je UTC-Tag (`central_bot_stats`): abgeschickte, zugestellte und gelesene Briefe sowie eingegangene Spielerantworten; angezeigt für den Gesamtzeitraum und die letzten 30 Tage. Je Event dieselben Zahlen im Archiv. **Keine personenbezogenen Statistiken.**

### 10.14 Export, Import, Sicherung
- Export als **ZIP-Datei** mit versioniertem JSON (`bots.json`) und den Bildern: alle Bots, ein Bot oder einzelne Events. Enthalten sind nur Bot-Konfiguration, geplante und archivierte Events und Bilder – **keine Briefe von Spielern**. Format und Importregeln: Anhang S.
- Ein Import **ergänzt** nur: Einstellungen vorhandener Bots bleiben, vorhandene Event-IDs werden übersprungen, Namens- und ID-Konflikte werden **vor** dem Import angezeigt, vergangene Events landen im Archiv und werden nie verschickt, neue Bots kommen als Entwurf.
- **Tägliche Sicherung:** Die tägliche Sicherung (16.4 Punkt 5) legt zusätzlich alle Bots als importierbare ZIP-Datei **unverschlüsselt** in `/var/backups/posteulen/` ab (`posteulen-bots-<Zeit>-<Grund>.zip`, Rechte 0600, Aufbewahrung 7 Tage). Die verschlüsselten Datenbanksicherungen bleiben davon unabhängig (die Bilder liegen auch in der Datenbank).
- **Wiederherstellung auf einem neuen Server:** Export-Datei im Kontrollzentrum importieren oder `posteulen-cli bots-import --file <zip>` (Vorschau) bzw. `… --apply`; danach die Bots prüfen und aktivieren.

---

## 11. Benachrichtigungen

### 11.1 Systemchat
- Ereignisse: Anhang C. Systemnachrichten erscheinen sofort.

### 11.2 Push-Ereignisse
- Web Push bei: Brief angekommen, Gold angekommen, Eule oder Küken geschenkt bekommen, eigene Eule wieder zu Hause („Eine deiner Eulen ist wieder zu Hause.“; v0.7 mit Antwortbriefen an Bord „Eine deiner Eulen ist mit Post wieder zu Hause.“, Typ `owl_home_letters`), Eule hat Eier gelegt, Küken geschlüpft, Warnung vor automatischer Löschung, Rundnachricht des Admins, (v0.8.2) fremde Eule rastet beim Nutzer („Eine Eule rastet bei dir.“, Typ `owl_resting`). Die Heimkehr hat seit v0.7.2 nur Push und Einblendung, keine Systemnachricht (8.4). Spendenbitten und Update-Nachrichten lösen keinen Push aus. Eine Lieferung erzeugt höchstens einen Push (z. B. Gold mit Begleitbrief).
- Push-Texte enthalten **keine Namen und keine Inhalte**, weil sie auf dem Sperrbildschirm erscheinen, z. B. „Eine Eule ist mit einem Brief gelandet.“ Die Nutzlast enthält nur `{id, type}`; die sichtbaren Texte stehen im Service Worker (beim Build aus der Textdatei eingesetzt).
- Jeder Push MUSS eine sichtbare Benachrichtigung erzeugen (Chrome verlangt `userVisibleOnly`); keine stillen Pushes.

### 11.3 Technik
- Standard-Web-Push (RFC 8030/8291/8292) mit VAPID. Ein Push-Abo pro Konto, gebunden an das zuletzt angemeldete Gerät. Es bleibt auch nach Ablauf der Sitzung bestehen (sonst kämen nach 30 Tagen ohne Nutzung z. B. weder Briefe noch die Löschwarnung aus 9.10 an) und wird erst beim Logout, beim Login auf einem anderen Gerät und bei der Kontolöschung gelöscht.
- Push-Endpunkte **beliebiger Hosts** werden akzeptiert (nötig für UnifiedPush, z. B. ntfy, sowie Mozilla, Apple, Google) – kein festes Allowlisting. Stattdessen **SSRF-Schutz:** nur HTTPS auf Standardport; DNS-Auflösung prüfen und private, Loopback-, Link-Local- und sonstige reservierte Adressbereiche (IPv4 und IPv6, einschließlich IPv4-mapped, IPv4-kompatibler und IPv4-übersetzter IPv6-Adressen, NAT64, 6to4, Teredo, Dokumentations- und SRv6-Bereiche; Liste in `backend/src/push/transport.ts`) ablehnen; die Verbindung geht genau an die geprüfte Adresse (kein zweites Auflösen, Schutz vor DNS-Rebinding); keinen Weiterleitungen folgen; Timeout; Antwortgröße begrenzen. Endpunkte, die 404 oder 410 liefern, werden gelöscht.
- Versand in einer eigenen Warteschlange im Arbeitsspeicher (4 parallel, außerhalb von Datenbank-Transaktionen); nicht gesendete Pushes werden nach einem Neustart bis zu 24 Stunden lang erneut versucht.

### 11.4 Push-Verifikation
1. Feature-Erkennung (`serviceWorker`, `PushManager`; auf iOS zusätzlich: läuft als installierte Home-Bildschirm-App).
2. `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`. Jede Ablehnung bedeutet „Push nicht verfügbar“.
3. **Ende-zu-Ende-Test:** Der Server schickt sofort eine Test-Benachrichtigung („Benachrichtigungen sind aktiv“). Der Service Worker bestätigt jeden empfangenen Push mit dessen ID per Hintergrundanfrage an den Server. Die Bestätigung braucht keine Sitzung: Sie enthält nur die zufällige, nicht erratbare Push-ID (mindestens 128 Bit). Kommt binnen 60 Sekunden keine Bestätigung, gilt das Gerät als „Push nicht bestätigt“, und die App verweist auf den Hilfeabschnitt mit der Erklärung aus 11.7. (Hintergrund: Auf manchen Systemen gelingt `subscribe()`, aber es kommt nie etwas an.)
4. Pro Abo wird der Zeitpunkt der letzten Bestätigung gespeichert. Ist er veraltet und gab es seitdem unbestätigte Pushes, wird beim App-Start neu verifiziert.
5. Abo setzen und Test erneut senden sind zusammen höchstens 10-mal pro Stunde und Konto möglich (v0.6.1): Jeder Test an einen Endpunkt, der dauerhaft ablehnt, kostet den Server eine Verbindung und eine Fehlermeldung.

### 11.5 Nicht zugestellte Benachrichtigungen
- Jede Benachrichtigung bleibt serverseitig gespeichert, bis der Service Worker ihren Empfang bestätigt hat oder der Nutzer sie in der App gesehen hat. Unbestätigte zeigt die App nach Login/Start unter „Neuigkeiten“ (8.3); danach werden sie gelöscht.

### 11.6 Aktualisierung im Vordergrund
- Solange die App sichtbar ist (`document.visibilityState === 'visible'`): eine Server-Sent-Events-Verbindung für neue Ereignisse; beim Wechsel in den Hintergrund wird sie geschlossen. Beim Start und bei jeder Rückkehr in den Vordergrund ein vollständiger Abgleich. Fällt SSE aus, wird alle 60 Sekunden abgefragt – nur im Vordergrund.
- **Keine Abfragen im Hintergrund.** Ein Abfragen alle 5 Minuten im Hintergrund ist für Web-Apps technisch nicht möglich: Periodic Background Sync gibt es nur in Chromium, mit mindestens 12 Stunden Abstand und nur für installierte Apps mit ausreichender Nutzung. Es wird nicht verwendet.

### 11.7 Google-freies Android (LineageOS, GrapheneOS)
- Chromium-basierte Browser (Chrome, Brave, Vanadium, Cromite) liefern Web Push nur über Google-Dienste (FCM); ohne diese kommt nichts an. Auch Mozillas eigenes Firefox für Android nutzt FCM.
- Funktionierende Wege – erklärt nur in der Hilfe (Abschnitt Benachrichtigungen) und im README, nicht beim Onboarding und nicht in den Briefen des Erklärbärs:
  1. **IronFox oder Fennec F-Droid** plus eine **UnifiedPush-Verteiler-App** (z. B. Sunup, von IronFox empfohlen, oder ntfy): im Browser UnifiedPush aktivieren (IronFox: zuletzt unter Einstellungen → Misc → „Use UnifiedPush“, danach Neustart des Browsers; der Menüpfad ändert sich zwischen Versionen) und Benachrichtigungen für PostEulen erlauben (IronFox blockiert Benachrichtigungsanfragen standardmäßig: Datenschutz und Sicherheit → Website-Einstellungen → Berechtigungen → Benachrichtigungen → „Erlauben erfragen“). Unter GrapheneOS muss für Benachrichtigungen im Hintergrund eventuell der Exploit-Schutz „Dynamic code loading via storage“ für IronFox erlaubt werden.
  2. **GrapheneOS mit „Sandboxed Google Play“ und Chrome** (die Google-Play-Dienste brauchen eine Akku-Ausnahme).
  3. Ohne beides: Briefe kommen an, man sieht sie aber erst beim Öffnen der App.
- Die Browserlage ändert sich schnell (2026 gab es z. B. IronFox-Versionen, in denen sich UnifiedPush teils nicht einschalten ließ). Der Agent prüft sie vor Stufe 2 und vor Stufe 6 erneut, testet nach Möglichkeit auf einem Gerät oder Emulator und passt die Hilfe an.
- Optional (README): eigener ntfy-Server als UnifiedPush-Server, damit Push auf Google-freien Geräten keinen fremden Server berührt.
- Eine native Hülle (WebView-App mit UnifiedPush) ist **nicht** Teil der App.

---

## 12. Karte

### 12.1 Inhalt
- **v0.7: Weltkarte.** Aktuelle politische Karte der **ganzen Welt** (Ländergrenzen Stand 2026, deutsche Ländernamen, in der englischen Ansicht englische, 8.12) im Pergament-Stil, Projektion **Equal Earth** (flächentreu) mit Mittelmeridian 10° O, damit Westeuropa in der Mitte liegt und kaum verzerrt ist. Der **Westeuropa-Ausschnitt** (unten) ist fein gezeichnet und zeigt Städte wie bisher; außerhalb davon gibt es nur Ländergrenzen (gröber vereinfacht, kleine Inseln weggelassen), Ländernamen und **Hauptstädte**. Wohnorte gibt es weiterhin nur im Westeuropa-Ausschnitt (12.3, 12.4); die Weltkarte ist eine Vorbereitung für spätere Versionen, in denen etwa Bots auch außerhalb Westeuropas wohnen könnten.
- **Immer quadratisch (v0.4):** Die Karte ist ein Quadrat, so groß, wie es unter ihrer Position und über einer festen unteren Navigationsleiste ins Fenster passt (mindestens 18 rem, höchstens die Inhaltsbreite), mittig. Auch der sichtbare Ausschnitt ist immer quadratisch. **Kartenseite (v0.7):** Ganz herausgezoomt passt die ganze Welt ins Quadrat (über die längere Seite; oben und unten Pergament, das Meer innerhalb des Weltumrisses). **v0.7.1:** Der Knopf unter Plus und Minus heißt „Ansicht zurücksetzen“ und springt zur Ansicht beim Öffnen der Karte zurück – auf der Kartenseite zum automatischen Zoom (Wohnort, Kontakte, eigene Eulen), bei Registrierung und Umzug zum Westeuropa-Ausschnitt (vorher sprang er auf der Kartenseite auf die ganze Welt). Ist der Ausschnitt schmaler als die Welt, bleibt Verschieben innerhalb der Welt; ist er breiter, steht die Welt mittig. **Registrierung und Wohnortwechsel (v0.7):** Die Karte bleibt im bisherigen Westeuropa-Ausschnitt – beim Öffnen und nach „Ansicht zurücksetzen“ zeigt sie das mittige Quadrat über dessen kürzere Seite, und Zoomen und Verschieben bleiben darin (man sieht nie über seinen Rand hinaus). Die Zoomstufen (Städte, engster Zoom 1/40, automatischer Zoom 1/12) beziehen sich auf die Breite dieses Ausschnitts. Das Vereinigte Königreich erscheint als **England, Schottland, Wales und Nordirland** (getrennte Länder mit eigenen Grenzen und Namen). Ländernamen erscheinen erst, wenn das Land auf dem Bildschirm groß genug ist.
- **Ausschnitt** ungefähr: West 10,7° W (Irland, Portugal), Ost 24,0° O (Lublin, Sofia), Süd 35,8° N (Südspitze Spaniens), Nord 60,6° N (Bergen). Werte in Anhang A.
- **Angezeigt:** eigener Wohnort (Quadrat); Wohnorte aller Kontakte (Kreis) inkl. Bots (Raute, eigener Legendeneintrag – auch in Graustufen unterscheidbar; der Erklärbär erst, sobald der Nutzer ihm zum ersten Mal geschrieben hat, Bots des Kontrollzentrums erst mit ihrem ersten Brief, an ihrem aktuellen Wohnort, auch außerhalb Europas); eigene Eulen und Leiheulen, die gerade für den Nutzer unterwegs sind (inkl. verschenkter Eulen und Küken bis zur Ankunft).
- **Flugspur:** Für jede eigene fliegende Eule zeigt eine dünne dunkelbraune Linie den **bisher geflogenen** Weg (entlang der Großkreise, aus dem Flugplan im Browser berechnet), und ein „Zzz“ markiert jeden Ort, an dem sie eine Schlafpause gemacht hat. Die noch kommende Route wird nie gezeichnet. Legende: „Bisherige Flugstrecke“, „Hier hat eine Eule übernachtet“. Beschriftungen überlappen nicht (gierig: über, unter, rechts, links des Markers, dann weiter außen).
- **Größen:** Marker, Beschriftungen und Städte haben feste Größen in Bildschirmpixeln (Beschriftungen 15–16 px, Ländernamen 15 px, Städte 13 px), unabhängig von Bildschirmbreite und Zoom – damit sie auch auf dem Handy gut lesbar sind.
- **Städte zur Orientierung:** Punkt und Name (kursiv, kleiner als die eigenen Beschriftungen). Im Westeuropa-Ausschnitt weit herausgezoomt nur Städte mit mehr als 1 000 000 Einwohnern, ab Zoomfaktor 2,5 (bezogen auf den Ausschnitt) alle mit mehr als 200 000; außerhalb nur Hauptstädte (Natural Earth `Admin-0 capital`), auf jeder Zoomstufe. Einwohnerzahl ist die des Ballungsraums laut Natural Earth (`POP_MAX`). Namen werden nach Größe vergeben (größte zuerst) und nur gezeigt, wo sie weder einen anderen Städtenamen oder -punkt noch einen Ländernamen, die Zoom-Knöpfe oder die eigenen Orte, Eulen und deren Beschriftungen berühren; sonst bleiben sie ausgeblendet, bis näher herangezoomt wird.
- **Automatischer Zoom:** Beim Öffnen der Karte zoomt sie einmal so weit hinein, dass gerade noch der eigene Wohnort, die Wohnorte der Kontakte und die eigenen Eulen unterwegs zu sehen sind – **seit v0.7 ohne Bots** (sie könnten später überall wohnen) –, mit Rand für die Beschriftungen; höchstens bis zu einem Zwölftel der Breite des Westeuropa-Ausschnitts. „Ansicht zurücksetzen“ kehrt zu diesem Ausschnitt zurück (v0.7.1).
- **Nicht angezeigt:** Eulen anderer Nutzer – auch nicht solche, die zum Nutzer unterwegs sind. Deren Flugpläne erhält der Browser gar nicht.
- **Tag/Nacht:** Flächen, auf denen die Sonne bei −6° oder tiefer steht, werden als Nacht dargestellt (Dämmerung = Tag). Rund um Westeuropa auf einem 0,5°-Raster, für den Rest der Welt (v0.7) auf einem 1°-Raster.
- Positionen, Flugspuren und Tag/Nacht-Grenze werden im Browser alle 5 Minuten neu berechnet – aus den Flugplänen, ohne Serveranfrage.
- Zoomen und Verschieben per Touch und Maus.

### 12.2 Daten
- Natural Earth 5.1.2 (Maßstab 1:10m bzw. 1:50m: Länder, „Map Units“ für die Teile des Vereinigten Königreichs, Land, Seen, besiedelte Orte), gemeinfrei, mit SHA-256 festgeschrieben. Vorverarbeitet mit dem eigenen Werkzeug `tools/map/` auf dem Entwicklungsrechner (ohne Abhängigkeiten; Ergebnisse liegen im Repository) und selbst ausgeliefert: vereinfachte Geometrie und Städteliste für die Anzeige (`web/src/lib/map/world.json`, SVG-Pfade in km, Projektion Equal Earth mit Mittelmeridian 10° O, v0.7; bis v0.6.1 `europe.json` in ETRS89-LAEA), die Land/Wasser-Maske für Server und Browser und (v0.7) die Zeitzonen-Karte des Ausschnitts (8.3). Vereinfachung nach Douglas–Peucker mit 1,2 km Toleranz im Ausschnitt samt Rand (6° Breite, 12° Länge), 15 km außerhalb; außerhalb entfallen Inseln unter 3 000 km² und Nachkommastellen. Ringe werden am Rand der Welt (180° vom Mittelmeridian) sauber geteilt. Seen: im Ausschnitt alle, sonst nur die größten (`scalerank` 0). Etwa 300 KiB (gut 120 KiB komprimiert). Kein Kachelserver. Die Kartendaten lädt der Browser erst, wenn eine Karte angezeigt wird.

### 12.3 Land und Wasser
- Als Wasser zählen Meere und große Seen. Wohnen ist auf jeder Landfläche im Ausschnitt erlaubt – auch auf dem nordafrikanischen Küstenstreifen, der in den Ausschnitt fällt.
- Vorberechnete **Land/Wasser-Bitmaske** für den Ausschnitt (Auflösung ca. 0,02°). Sie wird vom Server (Prüfung der Wohnorte, Flugberechnung) und vom Browser (sofortige Rückmeldung beim Pin-Setzen) genutzt. Maßgeblich ist der Server.
- **v0.8: grobe Weltmaske.** Außerhalb des Ausschnitts gilt eine zweite Maske der ganzen Welt mit 0,1° Auflösung (`shared/data/worldmask.bin`, 3600 × 1800 Bit, nur auf dem Server; erzeugt von `node tools/map/worldmask.ts` aus `ne_10m_land`, gleiche Quelle und Prüfsumme wie die Karte). Mit ihr prüft der Server Wohnorte der Bots (überall auf Land) und lässt Eulen auch außerhalb Europas auf Land schlafen (D-236). Spieler wohnen weiterhin nur im Ausschnitt (12.4). Bis v0.7.2 galten Punkte außerhalb des Ausschnitts als Wasser.

### 12.4 Pin setzen
- Bei Registrierung und Wohnortwechsel: Tippen auf die Karte (v0.7: nur im Westeuropa-Ausschnitt, 12.1); Wasser und alles außerhalb des Ausschnitts wird abgelehnt; Rundung auf 0,01°; Hinweis „Überlege sorgfältig, ob du deine echte Adresse wählen möchtest.“ (v0.7.1).

---

## 13. Adminpanel

- Eigene Website auf `admin.<domain>`. Es gibt genau einen Administrator mit einem Login. **v0.8:** Oberfläche auf Deutsch, per Knopf oben auf Englisch umschaltbar (gemerkt auf dem Gerät); Einträge des Fehlerprotokolls bleiben deutsch, wie der Server sie schreibt. Die Bots verwaltet nicht das Adminpanel, sondern das getrennte Bots-Kontrollzentrum (10.12).
- **Anmeldung** per OPAQUE (wie bei Nutzern), eigenes Cookie `__Host-pe_admin` (**v0.7: Ablauf nach 10 Minuten ohne Aktivität**, vorher 8 Stunden; jede Anfrage an die Admin-API zählt als Aktivität; das Panel kehrt nach Ablauf – lokal per Zeitgeber oder bei einer 401-Antwort – sofort zur Anmeldung zurück: „Nach 10 Minuten ohne Aktivität wurdest du abgemeldet. Bitte melde dich neu an.“), strenges Rate-Limit, optional IP-Freigabeliste in Caddy (README). Das Admin-Cookie ist ein Cookie der Browsersitzung.
- **Erstpasswort:** wird vom Setup-Befehl zufällig erzeugt (6 Gruppen à 4 Zeichen, ca. 119 Bit) und einmalig in der Konsole angezeigt. Es gibt **kein festes Standardpasswort im Code**. Beim ersten Login muss es geändert werden; vorher ist nichts anderes möglich. Jeder Passwortwechsel des Admins verlangt eine frische Anmeldung.
- **Passwort vergessen:** Ein Konsolenbefehl auf dem Server (nur root) setzt das Adminpasswort auf ein neues, einmalig angezeigtes Erstpasswort zurück. Nutzerdaten berührt das nicht.

**Funktionen:**
1. **Nutzer:** insgesamt erstellte Konten, aktuell vorhandene Konten, in den letzten 30 Tagen aktive Konten.
2. **Briefe:** Anzahl insgesamt und in den letzten 7 Tagen. Nur Briefe zwischen Menschen (einschließlich Begleitbriefen), gezählt pro Empfänger, über Tageszähler (keine Einzeldaten). Briefe von/an Bots und Systemnachrichten zählen nicht.
3. **Registrierung:** geschlossen (Standard nach der Installation) / nur mit Einladungscode / offen für alle. Einmal-Einladungscodes erzeugen (48 Stunden gültig; verbraucht erst bei erfolgreicher Registrierung; leicht abtippbares Format `XXXX-XXXX-XXXX` aus 31 gut lesbaren Zeichen, ca. 59 Bit; zur Unterscheidung in der Liste werden die letzten 4 Zeichen gespeichert), offene Codes mit Ablauf anzeigen und widerrufen. Codes nur als HMAC mit Server-Geheimnis gespeichert (kurze, abtippbare Codes ließen sich als einfacher Hash aus einer gestohlenen Datenbank leicht durchprobieren).
4. **Inaktivitäts-Löschfrist** in Tagen (Standard 180, mindestens 60). Eine Verkürzung löscht niemanden ohne vorherige Warnung: Betroffene Konten werden frühestens 30 Tage nach ihrer Warnung gelöscht.
5. **OpenAI:** API-Key eintragen (nur schreibbar, wird nie wieder angezeigt, nur „hinterlegt seit [Datum]“), Key löschen, Modell wählen (Liste aus der API, Freitext als Rückfall), „Verbindung testen“; **v0.8 zwei Tageslimits mit heutigem Verbrauch:** für den Erklärbär (Standard 200) und für alle Bots des Kontrollzentrums zusammen (Standard 500), 10.5.
6. **Rundnachricht an alle:** Text (bis 3 000 Zeichen), erscheint im Systemchat aller Konten, mit Push; Bestätigungsdialog; Liste der gesendeten Rundnachrichten.
7. **Fehlerprotokoll:** gut lesbare Einträge (Zeit, Komponente, Schweregrad, was passiert ist, wahrscheinliche Ursache, was zu tun ist), ohne personenbezogene Daten; als gelesen markieren oder löschen; Aufbewahrung 30 Tage nach dem letzten Auftreten. **Gleiche Meldungen werden zusammengefasst (v0.6.1):** Tritt dieselbe Meldung (Komponente, Schweregrad, Was, Ursache) innerhalb einer Stunde nach ihrem letzten Auftreten erneut auf, zählt der vorhandene Eintrag hoch („23× · zuletzt …“) und gilt wieder als ungelesen, statt einen neuen Eintrag anzulegen. So kann ein wiederkehrendes Problem die Datenbank nicht füllen. **v0.8.2:** Nicht lesbare Briefe (8.4) erscheinen hier mit möglichst konkreter technischer Ursache (z. B. „Signaturprüfung fehlgeschlagen: Die Ed25519-Signatur passt zu keinem bekannten Schlüssel des Absenders …“).
8. **Adminpasswort ändern** (mindestens 15 Zeichen).
10. **Nachrichten der Nutzer (v0.7.1)**, als letzter Punkt ganz unten: die Nachrichten aus den Einstellungen (8.10), neueste zuerst, mit Eingangszeit und **ohne Absender**, als reiner Text; einzeln löschbar; nach 90 Tagen automatisch gelöscht (täglicher Lauf 04:00 und beim Öffnen der Liste).
9. **Gutscheine (v0.7):** Gutscheine über **Gold** (0,1–100,0 Gold) oder **eine Eule** (Art wählbar, auch der Phönix, oder „zufällige Art“ ohne Phönix) erzeugen. Format und Speicherung wie Einladungscodes (`XXXX-XXXX-XXXX`, HMAC mit eigenem Server-Schlüssel `voucher`, letzte 4 Zeichen zur Unterscheidung), der Code wird nur einmal angezeigt. Jeder Gutschein ist **einmal einlösbar und 90 Tage gültig**; die Liste zeigt offene und eingelöste Gutscheine bis zum Ablauf (danach werden sie gelöscht), offene lassen sich widerrufen. **Wer** einen Gutschein eingelöst hat und wann, wird nicht gespeichert (nur „eingelöst“). Eingelöst wird in den Einstellungen der App (8.10): Gold wird gutgeschrieben, eine Eule zieht unbenannt ein (darf das Limit von 50 Eulen überschreiten, wie ein Geschenk; Start-Energie 60–100 %, Motivation 100 %, Besitzbeginn heute). Die Update-Nachricht an alle Nutzer erwähnt die Gutscheine absichtlich nicht (Wunsch des Auftraggebers); Hilfe und README nennen sie.
11. **Zeitlich befristete Banner (v0.8.2):** Text auf Deutsch (Pflicht) und optional Englisch (je bis 500 Zeichen, Textregeln wie Briefe, 5.9, also ohne Emojis; Links anklickbar wie in Briefen), Beginn und Ende (höchstens 90 Tage; ein Beginn in der Vergangenheit gilt als jetzt). Das Banner erscheint in der App **allen** angemeldeten Konten – auch Konten, die erst danach entstehen – oben unter dem Benachrichtigungs-Hinweis und sieht ähnlich aus wie dieser (📯, Pergamentstreifen). Englische Konten sehen den englischen Text, fehlt er, den deutschen. Jeder Nutzer kann ein Banner mit ✕ ausblenden (gemerkt auf dem Gerät, `localStorage`). Liste aller Banner mit Zeitraum, einzeln löschbar; abgelaufene löscht der tägliche Lauf. Änderungen erreichen offene Apps sofort (SSE-Thema `banners`). Tabelle `banners`, Nutzer-API `GET /api/banners` (nur laufende, in der Sprache des Kontos).

- **Ausdrücklich nicht vorhanden:** Nutzerliste, Zugriff auf Briefe, Ändern von Gold, Eulen, Wohnorten oder Konten. (Diese Daten liegen zwangsläufig lesbar in der Datenbank; als Schutz reicht für diese App, dass das Adminpanel keine solchen Funktionen bietet.)
- **Schutz des API-Keys:** verschlüsselt (XChaCha20-Poly1305) in der DB, mit einem Schlüssel aus der Geheimnis-Datei (4.4). Er wird nur im Arbeitsspeicher entschlüsselt, wenn ein Aufruf erfolgt, nie geloggt, nie an einen Browser gesendet und nur an die feste OpenAI-URL übertragen.

---

## 14. Design und Barrierefreiheit

- Verspielte, mittelalterliche Zauberwelt (Pergament, Siegel, Federkiel, Eulen) – aber übersichtlich und aufgeräumt. Eine eigene Fantasiewelt: keine Namen, Figuren, Orte oder Begriffe aus bekannten geschützten Werken (z. B. Harry Potter).
- Primär für Smartphones; responsiv von 320 px bis Desktop; Touch-Ziele mindestens 44 px. Keine Seite scrollt seitlich, und kein Text ragt aus seiner Box – geprüft in Deutsch und Englisch bei 320, 360, 390, 768, 1024, 1280, 1440 und 1920 px (v0.6, 17.4). Überschriften in der Zierschrift trennen lange Wörter (`hyphens: auto`, notfalls Umbruch im Wort); die Beschriftungen der unteren Navigationsleiste werden auf sehr schmalen Handys kleiner (bis 0,65 rem).
- **Kontrast** mindestens WCAG 2.2 AA (Text 4,5:1, Bedienelemente 3:1). Text hebt sich immer klar vom Hintergrund ab (keine Texte auf unruhigen Texturen; die Pergamentbögen der Briefe sind ruhige, gleichmäßige Texturen, auf denen die Tinte AA-Kontrast hat, 8.4).
- **Seitenhintergrund:** die bisherige Pergamentfarbe, darauf ganz leicht erkennbar eine Weltkarte wie mit verblasster, klecksiger Tinte als Aquarell auf grobem Büttenpapier gemalt (heller Farbschleier mit dunklerem Trocknungsrand, Papierfasern, feine Körnung). Sie liegt als feste Ebene hinter der Seite (auch auf iOS) und wird reproduzierbar aus Natural Earth erzeugt (`tools/map/background.ts` → `web/assets/world-map.webp`).
- **Text steht immer in Boxen:** Karten (`.card`) bzw. kleine Papierschilder (`.plate`) für Überschriften, Links und kurze Texte außerhalb von Karten; die Boxen selbst sind unverändert. Ein E2E-Test prüft alle Seiten darauf, dass kein Text direkt auf dem Hintergrund steht.
- **Graustufen-tauglich:** Informationen nie nur über Farbe (immer Symbol und Text bzw. Muster). Jede Stufe liefert auch einen Screenshot in Graustufen.
- Schriften selbst gehostet, freie Lizenz (OFL): eine Zierschrift nur für Überschriften (Cinzel Decorative), eine gut lesbare Schrift für Fließtext (mindestens 16 px), in der I, l und 1 sowie O und 0 klar unterscheidbar sind (Atkinson Hyperlegible Next). Nutzer- und Eulennamen erscheinen immer in dieser Schrift, nie in der Zierschrift oder einer Handschrift (Schutz vor Verwechslung, 7.1).
- **Handschriften** nur für den Brieftext im Chatverlauf (8.4): Dancing Script (eigene Briefe, Sepia) und Playwrite DE Grund (Briefe des Gegenübers, Blauschwarz). Links in Briefen stehen immer in der Fließtextschrift. Abschaltbar in den Einstellungen.
- Symbole in Kacheln und Navigation als Unicode-Zeichen; Text steht immer daneben.
- **Sprachfähnchen** (v0.4, 8.12): kleine eingebettete SVG-Flagge (Vereinigtes Königreich bzw. Deutschland) mit dünnem Rahmen; außerhalb der Statusleiste als Papierschild, in der Statusleiste ohne Schild und schmaler (mindestens 2 rem breit), damit sie auf dem Handy neben dem Goldstand passt.
- **Barrierefreiheit wird automatisch geprüft** (axe-core gegen WCAG 2.2 AA) auf allen Seiten und in jedem Screenshot-Zustand. Animationen laufen höchstens etwa 5 Sekunden am Stück (WCAG 2.2.2).
- Semantisches HTML, beschriftete Formularfelder, sichtbarer Fokus, `prefers-reduced-motion` wird respektiert.
- **Browser:** aktuelle Versionen von Chrome (Android, Desktop), Safari (iOS ab 16.4, macOS), Firefox (inkl. IronFox und Fennec F-Droid) und Edge.

---

## 15. PWA und Offline

- Web-App-Manifest (Name, Icons inkl. maskable und Apple-Touch-Icon, `display: standalone`, Theme-Farbe).
- Service Worker (selbst geschrieben, versioniert): cacht nur die App-Hülle (statische Dateien), verarbeitet Push und Push-Bestätigungen. Keine Brief-Inhalte im Cache. Beim ersten Installieren lädt er die Seite nicht neu, nur bei einem echten Versionswechsel; veraltete Clients bekommen `409 client_outdated` und die Aufforderung „Bitte neu laden“.
- **Update-Hinweis (v0.5):** Seiten kommen immer vom Netz (Navigation „network first“), eine frisch geladene Seite ist also schon die neue Version. Wartet beim Laden noch ein neuer Service Worker (installierte Apps auf Android schließen ihre Fenster praktisch nie, daher kam der Hinweis nach jedem Neuladen wieder), aktiviert die Seite ihn sofort selbst, ohne Hinweis und ohne erneutes Neuladen. Der Knopf „Neu laden“ aktiviert einen wartenden Service Worker und lädt sonst – oder wenn der Wechsel nicht binnen 3 Sekunden geschieht – die Seite einfach neu.
- **Offline:** deutlicher Hinweis („Keine Verbindung – Eulen brauchen Netz“); alle Aktionen sind gesperrt.
- Installationsanleitungen: 8.2 und Hilfe (8.11).

---

## 16. Betrieb: Installation, Updates, README.md

### 16.1 Grundsätze
- Installation und Updates MÜSSEN auf einem frischen **Debian 13** (amd64; arm64 SOLL) auch für Einsteiger mit **je einem Befehl** gelingen. Das gilt ab Stufe 0 für jeden Stand: Jeder Stand lässt sich frisch installieren und von jedem früheren Stand aus aktualisieren.
- Die Skripte liegen in `/deploy`, sind Bash mit `set -euo pipefail`, laufen ohne Befund durch `shellcheck`, geben verständliche deutsche Meldungen aus und sagen bei Fehlern, was zu tun ist. Alle Rückfragen lassen sich auch per Parameter beantworten (z. B. `--domain`, `--yes`), damit Skripte auch unbeaufsichtigt laufen.
- Der Code kommt per Git aus dem Repository, aus dem installiert wurde (Adresse konfigurierbar, auch privat, z. B. per Deploy-Key; auf dem Server als partieller Bare-Klon, Releases per `git archive`). Versionen sind Git-Tags nach Semantic Versioning; die neueste Version wird nach SemVer bestimmt (Vorabversionen wie `v0.1.0-stufe.6` vor `v0.1.0`). Tags signiert ausschließlich der Auftraggeber. **Seit v0.6.1 installieren und aktualisieren die Skripte nur Versionen mit gültig signiertem Tag** (Prüfung gegen `deploy/allowed_signers`; beim Update die Datei der installierten Version, bei der Installation die des Klons, dessen Fingerabdruck angezeigt und im README veröffentlicht wird). Geprüft wird auch, dass der im Tag eingetragene Name zum Tag passt (sonst ließe sich ein altes, echt signiertes Tag unter neuem Namen unterschieben). Abschalten lässt sich das nur ausdrücklich mit `--no-verify-tags` (für eigene, unsignierte Stände); `--verify-tags` wird weiter angenommen. Abhängigkeiten haben exakte Versionen, werden mit `npm ci --ignore-scripts` installiert, und neue Versionen werden erst ab 14 Tagen Alter übernommen (Sicherheitskorrekturen ausgenommen); die Versionsnummer steht an genau einer Stelle im Code. `CHANGELOG.md` beschreibt jede Version, einschließlich Hinweisen für Betreiber.
- Paketquellen nur mit signierten Schlüsseln (`signed-by`), keine `curl … | bash`-Installer. Node.js kommt aus einer signierten offiziellen APT-Quelle mit fest gewählter LTS-Hauptversion, Caddy aus der offiziellen Caddy-APT-Quelle – so kommen auch deren Sicherheitsupdates über apt.
- Native Abhängigkeiten, die auf dem Server kompiliert werden müssten, werden nach Möglichkeit vermieden. Die Mindestanforderungen an den VPS (RAM, Speicher) stehen im README; reicht der RAM für den Build nicht, legt das Skript nach Rückfrage eine Swap-Datei an.

### 16.2 Installations-Skript
Aufruf z. B. `git clone <Repository> posteulen && sudo ./posteulen/deploy/install.sh`. Das Skript
1. prüft: Debian 13, root-Rechte, Architektur, RAM und Speicher, freie Ports 80 und 443, ob die DNS-Einträge für `<domain>`, `admin.<domain>` und (v0.8) `bots.<domain>` auf diesen Server zeigen (bei Abweichung nur Warnung);
2. fragt nur das Nötigste ab: Domain, optional eine IP-Freigabeliste für das Adminpanel;
3. installiert Node.js, Caddy und benötigte Werkzeuge und richtet die Grundabsicherung ein: Firewall (nur 22/tcp, 80/tcp, 443/tcp sowie 443/udp für HTTP/3; **v0.8.2** ausdrücklich für IPv4 **und** IPv6, `IPV6=yes`, bei jeder Installation und jedem Update erneut gesetzt), automatische Sicherheitsupdates (einschließlich der Node.js- und Caddy-Quelle, mit Neustart betroffener Dienste). SSH nur noch mit Schlüssel stellt es **erst nach Rückfrage und nur dann** um, wenn für den Anmelde-Benutzer bereits ein SSH-Schlüssel hinterlegt ist (Schutz vor Aussperren);
4. prüft die Signatur des zu installierenden Tags und zeigt den Fingerabdruck des Signaturschlüssels (16.1, v0.6.1), legt Systembenutzer und Verzeichnisse an, baut das Projekt, führt den Setup-Befehl aus (4.4) und schreibt Caddyfile (alle drei Hosts, automatisches HTTPS, kein Access-Log, Fehlerlogs ohne IP-Adressen, Sicherheits-Header), den gehärteten systemd-Dienst (6) und den Backup-Timer;
5. startet alles und prüft über HTTPS, dass Website, Adminpanel, Health-Endpunkt und Sicherheits-Header funktionieren; ob auch `bots.<domain>` antwortet, prüft es nur mit einer Warnung (ohne DNS-Eintrag gibt es dort noch kein Zertifikat, D-246); **v0.8.2 Adressprüfung:** für jeden Hostnamen (`<domain>`, `admin.`, `bots.`, sofern in der Caddyfile) vergleicht es die A- und AAAA-Einträge mit den globalen IPv4- und IPv6-Adressen des Servers und ruft `https://<host>/api/health` **über jede einzelne Adresse** auf (`curl --resolve`, gültiges Zertifikat verlangt). Fehlt etwas (z. B. ein später hinzugefügter AAAA-Eintrag, für den Caddy noch kein Zertifikat geholt hat), lädt es Caddy einmal neu, damit fehlende Zertifikate geholt werden, und prüft bis zu einer Minute lang erneut. Was dann noch fehlt, wird verständlich als **Warnung** gemeldet (fremde Adresse im DNS, fehlender Eintrag für eine vorhandene Adresse, keine Antwort über eine Adresse) – ein Rückfall wird dadurch nicht ausgelöst;
6. zeigt am Ende eine kurze Zusammenfassung, das Admin-Erstpasswort und (v0.8) das Erstpasswort des Bots-Kontrollzentrums (je einmalig, `posteulen-cli admin-init` bzw. `bots-init` legen sie nur an, wenn noch keins existiert) und unübersehbar den Hinweis, Geheimnis-Datei und Backup-Schlüssel jetzt außerhalb des Servers zu sichern.

Das Skript ist **idempotent**: Ein erneuter Lauf repariert oder ergänzt, überschreibt aber nie Geheimnis-Datei, Datenbank, Backups oder lokale Anpassungen. Für Tests in VM oder Container ohne öffentliche Domain gibt es einen Testmodus mit lokalen Zertifikaten (Caddy `tls internal`).

### 16.3 Update-Skript
- Die Installation legt den Befehl `posteulen-update` an. `sudo posteulen-update` spielt die neueste Version ein, `sudo posteulen-update <Version>` eine bestimmte; `--check` zeigt nur installierte und verfügbare Version samt Änderungshinweisen aus `CHANGELOG.md`.
- **Ablauf:** neue Version holen → Signatur des Tags prüfen (16.1, v0.6.1) → die Update-Schritte der **neuen** Version ausführen (so können spätere Versionen eigene Schritte mitbringen) → in ein neues Release-Verzeichnis bauen, während der alte Stand weiterläuft → konsistente, verschlüsselte Sicherung der Datenbank → Dienst stoppen → Migrationen → auf das neue Release umschalten (z. B. per Symlink) → bei Bedarf systemd-Unit, Caddyfile, Pakete oder Node.js-Hauptversion anpassen → starten → Funktionsprüfung wie bei der Installation (seit v0.8.2 mit Firewall-Abgleich für IPv4/IPv6 und Adressprüfung aller Hostnamen über alle eigenen Adressen, 16.2 – so funktioniert eine nachträglich hinzugefügte IPv6-Adresse ab dem nächsten Update bzw. erneuten Installationslauf). Die Ausfallzeit beträgt höchstens wenige Minuten.
- **Rückfall:** Schlägt ein Schritt fehl, kehrt das Skript automatisch zum vorherigen Release samt der eben gesicherten Datenbank zurück und erklärt verständlich, was passiert ist. `posteulen-update --rollback` geht auch nachträglich zur vorigen Version zurück (mit Warnung, dass seitdem entstandene Daten verloren gehen). Die letzten 3 Releases bleiben dafür erhalten.
- Versionen dürfen übersprungen werden (z. B. 0.1.0 → 0.3.0). Migrationen laufen der Reihe nach, nur vorwärts, jede in einer Transaktion. Der Server startet nicht mit einer Datenbank, deren Schema neuer ist als er selbst.
- Updates lassen Geheimnis-Datei (Ausnahme: 4.4), Datenbank (außer Migrationen), Backups und lokale Anpassungen unangetastet. Lokale Anpassungen (z. B. die IP-Freigabeliste) liegen in eigenen Dateien, die Updates nie überschreiben.
- Sicherungen vor Updates sind wie alle Backups verschlüsselt und werden nach spätestens 7 Tagen gelöscht (8.11). Für den automatischen Rückfall bleibt zusätzlich eine unverschlüsselte Momentaufnahme in `/var/lib/posteulen/snapshots` (Rechte wie die Datenbank), ebenfalls höchstens 7 Tage.
- **Kontrollzentrum (v0.8):** Das erste Update auf eine Version mit Kontrollzentrum legt dessen Zugang an und zeigt das Erstpasswort einmal unübersehbar an (mit dem Hinweis auf den DNS-Eintrag für `bots.<domain>`); spätere Updates lassen es unverändert. Zurücksetzen nur per `posteulen-cli bots-reset`.
- **Browser nach dem Update:** Die App erkennt die neue Version (Service Worker) und lädt neu; veraltete Clients erhalten vom Server statt Fehlern eine verständliche Aufforderung zum Neuladen.
- KANN: ein Befehl `posteulen-restore <Sicherung>` für die Wiederherstellung aus einem Backup.

### 16.4 README.md
Im Wurzelverzeichnis liegt eine `README.md` (Markdown, Deutsch), die GitHub formatiert anzeigt. Seit v0.4 gibt es daneben eine englische Fassung `README.en.md` mit demselben Inhalt; beide verlinken einander ganz oben. Teil 1 erwähnt außerdem die englische Ansicht der App (Fähnchen oben rechts). Sie besteht aus zwei Teilen, beide nett und mit einem Schmunzeln zu lesen:
- **Teil 1 für Laien:** ein freundlicher, untechnischer Einstieg mit dem Gruppenbild der Eulen, der das Projekt in wenigen Absätzen erklärt, auf `https://posteulen.de` als laufende Instanz verweist, ausdrücklich betont, dass PostEulen zwar zwischen Spiel und Messenger liegt, wegen ernsthafter, aktueller Kryptografie aber auch ein sicherer Kommunikationsweg ist, auf die Löschfrist und die freiwillige Spende hinweist, erklärt, warum PostEulen sich als erster Messenger für Kinder eignet (kein Sog durch das langsame Tempo, keine Nachrichten von Fremden), und erklärt, wie PostEulen ohne App-Store aufs Handy kommt – einschließlich des Sonderfalls Google-freies Android mit UnifiedPush; dazu einige Screenshots (`docs/readme/`).
- **Teil 2 für Technikerinnen und Techniker, die selbst hosten:** beginnt (v0.7) mit einem augenzwinkernden Hinweis für Paranoide: Statt diesem Repository zu vertrauen, kann man die App jederzeit mit `PROMPT.md`, `SPEC.md` und dem Bilderordner selbst neu entwickeln – mit oder ohne KI; in der `SPEC.md` steckt eigentlich die Essenz der geistigen Arbeit und der Tests des Projekts. Danach erklärt er Schritt für Schritt und für Einsteiger verständlich, wie das Projekt auf einem frischen VPS mit **Debian 13** per HTTPS läuft. Er beschreibt den Weg mit den Skripten und erklärt, was diese tun, sodass man jeden Schritt nachvollziehen und notfalls von Hand ausführen kann. Mindestens:

1. Voraussetzungen: VPS (Mindestgröße), Domain, DNS-Einträge (A/AAAA) für `<domain>`, `admin.<domain>` und (v0.8) `bots.<domain>`, SSH-Zugang mit Schlüssel.
2. Installation mit einem Befehl (16.2) und was dabei passiert, einschließlich Grundabsicherung.
3. Erster Admin-Login: Passwort ändern, API-Key hinterlegen, Registrierungsmodus wählen. Adminpasswort vergessen: Reset-Befehl (13). **v0.8:** Bots-Kontrollzentrum: erster Login, Passwort ändern, ersten Bot anlegen; Reset per `posteulen-cli bots-reset` (10.12).
4. Funktionstest: Konto anlegen, Brief schicken.
5. **Backups:** täglicher systemd-Timer; konsistente SQLite-Sicherung, verschlüsselt (z. B. mit age; auf dem Server liegt nur der öffentliche Schlüssel), 7 Tage Aufbewahrung. Eine Kopie gehört **außerhalb des Servers** (z. B. täglich von einem anderen Rechner per SSH abgeholt), dort ebenfalls höchstens 7 Tage. Die **Geheimnis-Datei und den privaten Backup-Schlüssel einmalig separat und sicher sichern** – ohne die Geheimnis-Datei kann sich niemand mehr anmelden. Wiederherstellung Schritt für Schritt. **v0.8:** dazu die tägliche, unverschlüsselte ZIP-Datei mit allen Bots in `/var/backups/posteulen/` und wie man sie auf einem neuen Server importiert (10.14).
6. **Updates** mit einem Befehl (16.3), Rückfall, was bei Problemen zu tun ist; dass jedes Update eine Systemnachricht an alle Konten schickt und alle Konten alle 5 Wochen eine Spendenbitte bekommen. Gutscheine (13, v0.7).
7. Logs ansehen (`journalctl`), häufige Fehler und ihre Lösung.
8. Optional: IP-Freigabeliste für das Adminpanel; eigener ntfy-Server für UnifiedPush.
9. Datenschutzerklärung und Impressum: Standardtexte, die der Betreiber eigenständig anpasst (8.11), und wo sie im Code liegen.
10. Anhang: lokale Entwicklung.

---

## 17. Tests (Pflicht)

Alle Tests laufen mit einem Befehl. Eine Stufe ist erst fertig, wenn alle Tests grün sind.

**Testablauf (v0.7.1, schlank):** Während der Entwicklung laufen nur die betroffenen Unit- und E2E-Tests (gezielt, z. B. eine Datei, ein Profil). `npm test` läuft **genau einmal am Ende** komplett. Der VM-Test (17.6) läuft nur, wenn sich Skripte (`deploy/`), Migrationen oder Abhängigkeiten ändern oder der Auftraggeber es verlangt. Screenshots für den Bericht und die README-Bilder entstehen nur auf Anfrage. Neue Regeln bekommen Tests; Tests, die nur Bekanntes doppelt prüfen, kommen nicht dazu.

### 17.1 Kryptografie
- OPAQUE: Registrierung und Login; falsches Passwort scheitert; wiederholte (mitgeschnittene) Login-Nachrichten scheitern; unbekannte Namen sind von bekannten nicht unterscheidbar (Antwortformat, wiederholte Anfragen zum selben Namen, Verhalten nach Fehlversuchen).
- Schlüsselpaket: Ver- und Entpacken; nach einem Passwortwechsel bleiben alte und unterwegs befindliche Briefe lesbar; ein abgebrochener Passwortwechsel lässt das alte Passwort gültig.
- Brief: Ver- und Entschlüsselung für Empfänger und Absender; gültige Signatur; Manipulation von Chiffrat, Associated Data, Brief-ID, Absender- oder Empfänger-ID und Sendezeitpunkt wird erkannt; ein an Dritte weitergereichter Brief wird als „nicht an dich gerichtet“ erkannt; eine vertauschte Briefart (Begleitbrief als gewöhnlicher Brief ausgegeben oder umgekehrt) wird erkannt; Padding-Längen exakt; der Server lehnt falsche Längen ab, auch bei Begleitbriefen.
- Kontakt-Tresor: vertauschte oder fremde Einträge werden erkannt; ein Schlüsselwechsel löst Warnung und Versandsperre aus (auch serverseitig); die Sicherheitsnummer ist für beide Seiten gleich; nach Kontakttrennung und nach Kontolöschung des Gegenübers bleiben alte Briefe prüfbar.
- Textregeln: Der empfangende Browser entfernt unzulässige Zeichen erneut und erkennt zu lange Texte; Ziffern, #, *, ©, ® und ™ bleiben erhalten.
- Ein Test fängt alle Anfragen des Browsers ab und prüft, dass weder Passwörter noch Brief-Klartexte noch unverschlüsselte private Schlüssel den Server erreichen.

### 17.2 Spiellogik (reine Funktionen, feste Uhr und fester Zufall)
- Flug: Verbrauch Tag/Nacht; Schlafpause nur so lange wie nötig bis zum nächsten Ziel (höchstens bis voll; alte Pläne: 10 Stunden), Erholung im Schlaf mit Motivation; Wasser-Regel; Start mit 0 Energie; Mehrfachempfänger in Reihenfolge; Rückflug mit Restenergie; Leiheule ohne Rückflug; Neuberechnung bei Umzug (Empfänger/Halter, Hin-/Rückflug, während einer Pause); Umkehren in allen Fällen aus 9.5; Interpolation der Position; Strecken, die den Kartenausschnitt verlassen.
- Ereignis-Warteschlange: Nachholen nach einem Ausfall in zeitlicher Reihenfolge mit dem Fälligkeitszeitpunkt als logischer Zeit; verpasste tägliche Jobs wie in 4.5.
- Energie: Regeneration (Faktor 2 ⇒ 5 Stunden), Füttern mit Erholungsfaktor, einmal pro Tag, Deckelung.
- Wahrscheinlichkeiten statistisch mit festem Seed: Krankheit 1/30 bzw. × 0,3 mit Pflegebonus; Eier 1/100; Küken 1–3.
- Vorrang Brüten vor Krankheit; Krankheit bei Rückkehr; Behandlungsdauern.
- Schutzfrist: kein Krankheitswurf in den ersten 28 Tagen nach Kauf, Schlupf oder Ankunft als Geschenk; Grenze genau am 28. Tag; ein umgekehrtes Geschenk behält beim Schenkenden den alten Besitzbeginn; kein Wurf während eines Geschenkflugs.
- Küken: Flug 1 h/1 h mit Wasser-Regel, Verschenkpflicht, Losentscheid (ohne Begleitbrief), ohne aktive Kontakte alle behalten, Erwachsenwerden.
- Gold: Zehntel-Arithmetik; Überweisungsgrenzen (Rest > 10,0, max. 20,0); keine negativen Stände; tägliches Gold nur für aktive Konten; Idempotenz (Job läuft zweimal ⇒ Gold nur einmal).
- Begleitbriefe: Zustellung zusammen mit Gold, geschenkter Eule bzw. Küken; beim Umkehren (eigene Eule, Leiheule, geschenkte Eule, Küken) nicht zugestellt.
- Bots des Kontrollzentrums (v0.8, `backend/test/v080.test.ts`): Entwurf → Aktivierung nur vollständig; Wohnort weltweit nur an Land; eindeutige Namen gegenüber Bots und Konten; Event an alle Spieler genau einmal (auch nach erneutem Ereignis), Erstkontakt- und Folgevariante je Sprache, Sichtbarkeit erst mit dem ersten Brief, neue Spieler bekommen alte Events nicht; eigene Bot-Eule: nächster Brief wartet auf die Rückkehr, Antwort mit der rastenden Eule, keine Pflege; ohne KI geht der geplante Brief unverändert, spontane Antworten warten; Löschen atomar mit Systemnachricht nur an Kontakte; „Alle Bots entfernen“ hält künftige Bots fern; Bilder normalisiert ohne Metadaten, nur für Empfänger abrufbar; Gold- und Eulengeschenke; Export/Import ergänzt nur, vergangene Events nie erneut; KI-Test speichert nichts; Zugang zum Kontrollzentrum mit eigenem Passwort, Pflichtwechsel und 12 Stunden Ablauf; Abbau von Tante und Onkel (Anhang T).
- Erklärbär-Eulen 200 km/h; der Tag-0-Brief des Erklärbärs ist bei der Registrierung sofort zugestellt.
- Menagerie: 4 Arten (nie der Phönix), jede einmal pro Angebotstag (am nächsten Tag alle neu leihbar), Verfall nach 24 Stunden ohne Erstattung; vier verschiedene Namen je Nutzer und Tag; Leihen beim Absenden aus der Eulenwahl (exakte Vorschau, nichts gebucht ohne Absenden, Ablehnung nicht angebotener oder schon geliehener Arten).
- Pflegebonus nach 9.3: Reisetage werden übersprungen, Tage mit weniger als einer Stunde zu Hause zählen nicht, genau eine Stunde zählt; nur ab Besitzbeginn; Pflegetage und Abwesenheiten werden beim Füttern/Streicheln bzw. bei Abflug, Eulenarzt, Menagerie und Heimkehr erfasst und nach 60 Tagen gelöscht.
- Umzüge: drei pro Kalendermonat, der vierte wird abgelehnt, im neuen Monat wieder drei.
- Löschfrist (8.4.1): nach einem Jahr für alle (auch Bot-Briefe und Systemnachrichten), kürzere eigene Frist löscht nur die eigenen Kopien, Briefe unterwegs bleiben, Ungelesen-Zähler werden angepasst, nur die vier erlaubten Fristen.
- Migrationen mit Bestandsdaten (z. B. 0007: Umbenennung zur Menagerie, Übernahme der Pflege-Bitmaske, Flüge bleiben ihren Eulen zugeordnet).
- Kontolöschung mit laufenden Lieferungen in beide Richtungen.

### 17.3 Berechtigungen und Eingaben
- Für jeden Endpunkt: fremde Objekte sind weder lesbar noch änderbar; Nicht-Kontakte, inaktive und gelöschte Konten sind nicht adressierbar; Admin-Endpunkte sind für Nutzer gesperrt und umgekehrt; Rate-Limits greifen.
- Property-based Tests (fast-check) für alle Schemas mit zufälligen und bösartigen Eingaben.
- Namens-Normalisierung (7.1): alle Beispiele aus 7.1, die Verwechslungsregeln, reservierte Namen (v0.8 ohne „Tante“/„Onkel“) als erstem Wort.
- Version 0.6.1 (`backend/test/v061.test.ts`, `shared/test/links.test.ts`): gleichzeitige Anmeldungen mit einer Captcha-Lösung umgehen die Wartezeit nicht; volle Zählertabellen verlieren die Zähler angegriffener Konten nicht; erfolgreiche Anmeldungen zählen nicht als Fehlversuche der IP; ungültige OPAQUE-Nachrichten ergeben 400 ohne Eintrag im Fehlerprotokoll; unbrauchbare Registrierungsdatensätze und Schlüssel werden abgelehnt; Passwortwechsel beendet Live-Verbindungen; Push-Grenze je Konto; zusammengefasste Fehlerprotokoll-Einträge; Aufräumen abgelaufener Sitzungen; erweiterte SSRF-Sperrliste; Anzeige verkleideter Links.

### 17.4 Ende-zu-Ende (Playwright)
- Registrierung → Login → Koppeln → Brief → Zustellung → Lesebestätigung; Passwortwechsel; Kontolöschung.
- Einblendungen der Eulenbilder bei Abflug, Ankunft (mit Brief, mit Gold ohne Brief, Eulen- und Kükengeschenk), Füttern und Streicheln (inkl. Schließen per Tippen/Escape und `prefers-reduced-motion`); grummeliges Bild bei kranken Eulen.
- Ansichten: Handy (390×844) und Desktop (1440×900), dazu ein Graustufen-Screenshot – seit v0.7.1 nur auf Anfrage (`POSTEULEN_SCREENSHOTS=1`, `e2e/screenshots.spec.ts`).
- Netzwerkprüfung: Der Browser lädt nichts von fremden Hosts. Jeder E2E-Test schlägt bei CSP-Verstoß, Konsolenfehler oder fremder Anfrage fehl.
- Barrierefreiheit: axe-core (WCAG 2.2 AA) auf allen Seiten (`e2e/stage6.spec.ts`), bei Screenshots zusätzlich in jedem Screenshot-Zustand.
- Version 0.2: Leiheule direkt in der Eulenwahl, „Neue Post!“, Briefe in Handschrift, Löschfrist- und Druckschrift-Einstellung, Versionsnummer auf Start- und Übersichtsseite, Städte und getrennte Landesteile auf der Karte.
- Version 0.3: kein Text direkt auf dem Hintergrund (alle Seiten), Briefe auf Pergament (seit 0.3.2 ohne Siegel), Ungelesen ohne Neuladen, ausblendbarer Benachrichtigungs-Hinweis, Menagerie-Reihenfolge mit Beschreibungen und passenden langen Namen, getrennte Eulengruppen, Freilassen mit Namen und zweiter Bestätigung, Gruppenbild und Willkommensanleitung.
- Version 0.6: Layout in mehreren Breiten (seit v0.7.1 vier: 320, 390, 768 und 1440 px; vorher acht von 320 bis 1920 px), Deutsch und Englisch, angemeldet mit langen Namen und Eulen in vielen Zuständen (Leiheule, kranke Eule mit allen Knöpfen, Gelege): keine Seite scrollt seitlich, kein Element ragt aus dem Fenster oder aus seiner Box (`e2e/layout.spec.ts`, in Chromium und WebKit).
- Version 0.6.1 (`e2e/v061.spec.ts`): ein Link mit kyrillischem Buchstaben im Host erscheint in Punycode mit Warnhinweis; nach dem Abmelden und Anmelden eines anderen Kontos im selben Tab (ohne Neuladen) zeigt das Adressbuch nichts aus dem Kontakt-Tresor des vorigen Kontos.
- Version 0.7.2 (`e2e/bots.spec.ts`, `backend/test/v072.test.ts`, `bots.test.ts`, `v07.test.ts`): Bots fehlen im Adressbuch und werden über den Briefwechsel angeschrieben; „Tante … entfernen“ im Chat und „Alle Bots entfernen“ in den Einstellungen; entfernte Bots kommen nach einem Neustart nicht wieder; ein Brief, der beim Verbrennen noch unterwegs war, ist nach der Ankunft sichtbar und ungelesen; Heimkehr ohne Systemnachricht, mit Eintrag in `homecomings` (Zahl der Antwortbriefe) und Löschen nach dem Einblenden; Geschlecht gleich verteilt (20 000 Würfe, Abweichung unter 1,6 Prozentpunkten).
- Version 0.8 (`e2e/v080.spec.ts`): Bots-Kontrollzentrum mit Erstpasswort und Pflichtwechsel, Umschalten auf Englisch, Bot anlegen (Bestätigung), Einstellungen, Aktivieren, Event mit Bild und Vorschau, der Brief kommt beim Spieler mit Bild an, das Archiv zählt ihn, Löschen mit eingetipptem Namen und Systemnachricht beim Spieler; Barrierefreiheit der Anmeldeseite des Kontrollzentrums (`stage6.spec.ts`).
- Ansichten seit v0.7.1 in zwei Profilen: Chromium (Desktop) und WebKit (Handy, iPhone); Chromium auf dem Handy nur für Screenshots und README-Bilder auf Anfrage. (Bis v0.7.0 vier Profile mit Firefox und Chromium-Handy.)
- CSP und Sicherheits-Header sind vorhanden.

### 17.5 Abdeckung
- Mindestens 90 % Zeilenabdeckung je Datei in `shared/src` (Krypto, Spiellogik, Texte, Karte).

### 17.6 Installation und Update
- Das Installations-Skript läuft in einem frischen Debian 13 (VM oder systemd-fähiger Container, Testmodus aus 16.2) fehlerfrei durch; ein zweiter Lauf überschreibt nichts und hinterlässt einen funktionierenden Dienst.
- Update vom Git-Tag der vorigen Stufe bzw. Version mit Testdaten (in einer QEMU/KVM-VM mit dem offiziellen Debian-13-Cloud-Image, `npm run test:vm`): Daten und Geheimnisse bleiben erhalten, Konten können sich weiter anmelden, alte Briefe bleiben lesbar.
- Ein absichtlich fehlschlagendes Update (z. B. eine kaputte Migration) wird automatisch zurückgerollt; `--rollback` funktioniert.
- Signaturen (v0.6.1): Der VM-Test signiert seine Test-Tags mit einem eigenen Testschlüssel (er ersetzt dafür `deploy/allowed_signers` in den Test-Versionen); ein unsigniertes Tag und ein echt signiertes Tag unter fremdem Namen werden abgelehnt, die laufende Version bleibt unverändert.
- Eine Sicherung lässt sich nach dem README wiederherstellen – auf demselben Server und nach einem Totalausfall auf einem neuen Server.
- v0.8.2: Die Firewall erlaubt 443 auch für IPv6, und jeder Hostname antwortet über jede eigene Adresse (`address_check` im Testmodus mit interner Zertifizierungsstelle).
- `shellcheck` ohne Befund.

---

## 18. Stufenplan

Nach jeder Stufe (auch nach P) stoppt der Agent, berichtet und wartet auf Feedback. Jede Stufe ab 0 endet mit einem Git-Tag; ihr Stand lässt sich per Skript auf Debian 13 installieren und – ab Stufe 1 – vom Stand der vorigen Stufe aus aktualisieren (16, 17.6).

- **P – Plan:** Architekturplan im Stufenbericht auf Grundlage von Anhang L (Komponenten, Datenmodell, API-Übersicht, Krypto-Abläufe als Mermaid-Sequenzdiagramme, Ereignis-Warteschlange, Installations- und Update-Konzept), `DEPENDENCIES.md` (Version, Lizenz, Zweck), Prüfung von OPAQUE auf RFC 9807, Zusammenspiel der Krypto-Bibliotheken, aktueller Stand von 11.7, verfeinerter Stufenplan, offene Fragen. Weicht der Plan von Anhang L ab, wird das als Entscheidung in Anhang N festgehalten.
- **0 – Gerüst:** Ordnerstruktur, Build, Lint, Formatierung, Test-Runner, Start mit einem Befehl, Migrationen, Setup-Befehl für Geheimnisse, Sicherheits-Header/CSP, leere App-Hülle im Grund-Design, erster Entwurf der Installationsanleitung (damals `readme.txt`), Installations- und Update-Skript (erste Fassung, installiert die App-Hülle auf Debian 13).
- **1 – Konten und Krypto:** Registrierung (inkl. Modi, Einladungscodes, Captcha), Login/Logout, Einzel-Sitzung, Schlüsselpaket, lokale Schlüsselspeicherung, Passwortwechsel, Namensregeln, Wohnort-Pin mit Landmaske; Adminpanel: Login mit Erstpasswort und Pflicht-Passwortwechsel, Reset-Befehl, Registrierungsmodus, Einladungscodes, Fehlerprotokoll.
- **2 – Kontakte und Briefe:** Koppeln, Kontakt-Tresor, Sicherheitsnummer, Schlüsselwarnung, Briefwechsel inkl. Pergament, Mehrfachempfänger, Lesebestätigungen, Chat löschen, Systemchat, PWA, Push inkl. Verifikation, SSE. Die Zustellung läuft in dieser Stufe vorläufig mit einer Platzhalter-Eule und vereinfachter fester Flugzeit; echte Eulen und Flüge folgen in Stufe 3.
- **3 – Eulen, Flug, Karte, Gold:** Kauf, Bilder inkl. Einblendungen (Abflug, Ankunft, Füttern, Streicheln), Energie, Füttern/Streicheln, Flugplanung, Umkehren, Umzug, Karte mit Tag/Nacht, Finanzübersicht, Überweisungen mit Begleitbrief, Eulengeschenke mit Begleitbrief.
- **4 – Restliche Spielmechanik:** Leiheulen, Verleih an die Menagerie, Krankheiten inkl. Schutzfrist und grummeligem Bild, Küken inkl. Begleitbrief, Inaktivität, automatische und manuelle Kontolöschung vollständig, Namens- und Wohnortwechsel; Adminpanel: Statistik, Löschfrist, Rundnachricht.
- **5 – Bots:** Erklärbär mit festen Briefen und KI-Antworten; Bots des Kontrollzentrums mit Events, eigenen und Leiheulen, KI-Anpassung, Bildern, Statistik, Export/Import und dem Kontrollzentrum `bots.<domain>` (10); Zusammenfassungen, Kostenlimits; Adminpanel: OpenAI-Einstellungen.
- **6 – Abschluss:** Hilfe, Datenschutzerklärung, Impressum, Design-Feinschliff, Prüfung von Barrierefreiheit und Graustufen, Installationsanleitung final; Installation, Update von Stufe 5, Rückfall und Wiederherstellung aus einem Backup auf einem frischen Debian 13 (VM oder Container) komplett durchgespielt, Sicherheits-Review entlang Abschnitt 6 mit Ergebnisbericht. Ergebnis: Version 0.1.0.
- **Version 0.2:** Änderungen nach Anhang F, Update von 0.1.0 im VM-Test, Einarbeitung aller Entscheidungen in diese Spezifikation. Ein Release ohne Zwischenstufen; das Tag `v0.2.0` signiert der Auftraggeber.
- **Version 0.3:** Änderungen nach Anhang G, Update von 0.2.0 im VM-Test, Einarbeitung aller Entscheidungen in diese Spezifikation. Ein Release ohne Zwischenstufen; das Tag `v0.3.0` signiert der Auftraggeber.
- **Versionen 0.3.1 bis 0.6.1:** je ein Release nach den Anhängen H bis K, M und O; Ablauf für Folgeversionen siehe `PROMPT.md` (Rückfragen mit Optionen, Umsetzung, Tests, Update-Nachricht, CHANGELOG, SPEC/README/Hilfe/Erklärbär in beiden Sprachen, Signier-Befehle für den Auftraggeber).
- **Neubau:** Wer PostEulen nach dieser Spezifikation neu baut, durchläuft die Stufen P bis 6 mit dem vollen Umfang des aktuellen Stands (alle Anhänge); die Anhänge F bis K, M und O beschreiben dann nur die Herkunft einzelner Regeln.

---

## Anhang A – Konstanten

| Bereich | Wert |
|---|---|
| Startguthaben | 3,0 Gold |
| Tägliches Gold | 03:00 UTC (v0.7; vorher 15:00), nur aktive Konten: 3,0 in den ersten 30 Tagen ab Registrierung (Registrierungstag + 29 Tage), danach 2,0 (v0.4) |
| Aufpreis großes Pergament | 0,1 pro Versand |
| Begleitbrief | nur bei Gold-, Eulen- und Kükensendungen; kleines Pergament, kostenlos |
| Goldgeschenk eines Bots (Event) | 0,1–100 Gold pro Spieler (v0.8) |
| Zeichen klein / groß | 800 / 15 000 |
| Padding klein / groß | 4 096 / 65 536 Byte (große Briefe vor v0.3: 16 384 Byte, weiter lesbar) |
| Empfänger pro Brief | max. 5, auch mit Leiheule (seit v0.4); Gold an 1; keine Bots im Mehrfachversand |
| Überweisung | 0,1–20,0 Gold; Restguthaben danach > 10,0 |
| Leiheule | 0,1 Gold pauschal (auch bei mehreren Empfängern); jede Angebotsart 1× pro Angebotstag (bis 4 am Tag, keine Grenze für gleichzeitig vorhandene); Verfall nach 24 h; 4 verschiedene Namen je Nutzer und Tag; Motivation 0,8–1,0 |
| Tagesangebot Menagerie | 4 Arten (nie der Phönix), 00:00 UTC |
| Start-Energie bei Kauf/Leihe | 60–100 % zufällig (Leihe: per HMAC je Nutzer, Tag und Art) |
| Fluggeschwindigkeit | 25 km/h × Fluggeschwindigkeitsfaktor |
| Energieverbrauch | Nacht 1 / km, Tag 1,5 / km |
| Tag-Definition | Sonnenhöhe > −6° |
| Schlafpause bei leerer Energie | so lange wie nötig bis zum nächsten Ziel (5 min genau), höchstens bis voll; Erholung wie zu Hause (× Motivation) |
| Regeneration zu Hause | 10 % des Maximums pro Stunde × Erholungsfaktor |
| Eulenkeks (Füttern) | 0,1 Gold, 1× pro Tag, +10 % × Erholungsfaktor |
| Wasser | kostenlos, 1× pro Tag |
| Lieblingsleckerli | 0,2 Gold, 1× pro Tag, +20 % × Erholungsfaktor |
| Gepflegter Tag | 2 verschiedene Pflege-Aktionen am selben Tag |
| Pflegebonus | an ≥ 10 der letzten 14 Tage mit ≥ 1 h zu Hause gepflegt ⇒ Krankheitsrisiko × 0,3; Rückblick höchstens 60 Tage |
| Motivation | 80–120 % (gespeichert in Zehnteln 8–12); Start 100 % (Leiheule 80–100 %); −10 Prozentpunkte jede Nacht 00:00 UTC; +10 je Pflege-Art und Tag; wirkt (v0.7) je Etappe ab dem Abflug auf Tempo, Energie und Erholung dieser Etappe |
| Rast beim Empfänger (v0.7) | gar nicht, 1, 2, 24 oder 48 h (vorgewählt 1 h); Erholung wie zu Hause; höchstens ein Antwortbrief je Empfänger, nur an den Absender |
| Krankheit | 1/30 pro Tag, Wurf 03:00 UTC |
| Schutzfrist vor Krankheit | 28 Tage ab Besitzbeginn (Kauf, Schlupf, Ankunft als Geschenk) |
| Eigene Pflege | 0,2 Gold, 7 Tage |
| Eulenarzt | 1,0 Gold, 24 h |
| Verleih an die Menagerie | 7 Tage, Lohn 10 % des Artpreises |
| Eier | 1/100 nach Rückkehr (nur weiblich), Brüten 7 Tage |
| Küken | 1–3; ab 2 eines verschenken; Frist 24 h; Benennfrist 24 h |
| Kükenflug | 10 km/h, 1 h Flug / 1 h Pause |
| Küken erwachsen | 14 Tage nach Schlupf / 7 Tage nach Ankunft beim Beschenkten |
| Max. eigene Eulen | 50 |
| Eulenbilder | 17 je Art (normal, Abflug, Ankunft, Füttern, Streicheln, grummelig, Küken, Tagflug, Nachtflug, Heimkehr Tag, Heimkehr Nacht, Trinken, Leckerli, Nachtpause, Tagschlaf unterwegs, Tagschlaf zuhause, Brüten; Phönix ohne Küken und Brüten) + leere Stange + Gruppenbild + Verbrennen |
| Nickerchen zu Hause | bei Tag 50 % je Eule und Öffnen der Eulenübersicht; nie nachts, nie in den 10 Minuten nach einer Pflege-Aktion |
| Eulenname | 2–20 Zeichen; Umbenennen 1× pro Kalenderjahr |
| Nutzername | 3–20 Zeichen; Umbenennen 1× pro Kalenderjahr |
| Namenssperre | 90 Tage |
| Passwort | 15–256 Zeichen |
| Wohnortwechsel | höchstens 3 pro Kalendermonat (UTC); Rundung 0,01° |
| Löschfrist Briefe und Systemnachrichten | spätestens 365 Tage nach Zustellung; wählbar 30 / 90 / 180 / 365 Tage für eigene Kopien |
| Kontaktanfragen | 20 pro Tag; Verfall nach 24 h |
| Inaktiv | > 21 Tage ohne Aktivität |
| Aktiv (Admin-Statistik) | Aktivität in den letzten 30 Tagen |
| Automatische Löschung | Standard 180 Tage, min. 60; Warnung 30 Tage vorher |
| Kontolöschung durch Nutzer | 24 h Frist |
| Nutzer-Sitzung | 30 Tage ohne Nutzung |
| Admin-Sitzung | 10 min ohne Aktivität (v0.7; vorher 8 h) |
| Nachricht an den Admin (v0.7.1) | höchstens 300 Zeichen, eine pro UTC-Tag und Konto, ohne Absender gespeichert, Löschung nach 90 Tagen |
| Gutschein (v0.7) | Gold 0,1–100,0 oder eine Eule; einmal einlösbar; 90 Tage gültig |
| Leiheulen-Sperre (v0.7) | Arten und Namen nicht an den 2 Folgetagen (Namen in 3 Gruppen nach Tagesnummer) |
| Transaktionsliste | letzte 20 |
| Bot-Eulen | Erklärbär 200 km/h und unbegrenzte Energie; Bots des Kontrollzentrums: Werte ihrer Art × Motivation 0,5–20, Rast 0–168 Stunden (v0.8) |
| Bot-Antwort | 2 h nach Ankunft; max. 500 Zeichen |
| Schreibsperre je Bot | 24 h seit letztem Versand |
| KI-Wiederholung bei Fehler | alle 24 h |
| KI-Tageslimit | 200 Aufrufe (einstellbar) |
| Bot-Gedächtnis | Zusammenfassung ≤ ca. 250 Wörter + letzte 6 Briefe |
| Erklärbär-Briefe | Tag 0 (bei Registrierung sofort zugestellt), 1, 2, 3, 4, 7 |
| Spendenbitte | alle 35 Tage ab Registrierung, 3 Texte reihum, https://ko-fi.com/posteulen |
| Briefe an einen Bot | einer pro Kalendertag (UTC) und Bot, auch an den Erklärbär (v0.8) |
| Antwortlänge | Erklärbär höchstens 500 Zeichen; andere Bots ohne feste Grenze (höchstens großes Pergament) |
| KI-Tageslimits | Erklärbär 200, Bots des Kontrollzentrums zusammen 500 (Standard) |
| Spontane Antwort eines Bots | nur ohne Brief-Event in den nächsten 28 Tagen, 2 Stunden nach Ankunft |
| Bilder je Bot-Brief | höchstens 2; Upload JPEG/PNG/WebP bis 2 MB, gespeichert als WebP bis 1 600 px |
| Sitzung im Bots-Kontrollzentrum | 12 Stunden ohne Aktivität |
| Bot-Namen | 3–20 Zeichen, Regeln der Nutzernamen, eindeutig unter Bots und Konten |
| Export/Import | ZIP bis 64 MB, höchstens 2 000 Dateien; Format `posteulen-bots` Version 1 (Anhang S) |
| Wohnort Erklärbär | 52,520° N, 13,405° O |
| Kartenausschnitt (Wohnorte) | 10,7° W – 24,0° O, 35,8° N – 60,6° N; Karte seit v0.7 weltweit (Equal Earth, Mittelmeridian 10° O) |
| Land/Wasser-Maske | ca. 0,02° |
| Kartenaktualisierung | alle 5 min (im Browser) |
| Städte auf der Karte | > 1 000 000 Einwohner immer, > 200 000 ab Zoomfaktor 2,5 (Ballungsraum, Natural Earth `POP_MAX`) |
| Automatischer Kartenzoom | höchstens auf 1/12 der Breite des Westeuropa-Ausschnitts; ohne Bots (v0.7) |
| Begrüßung (v0.7) | Morgen 5–11, Tag 11–18, Abend 18–22, Nacht 22–5 Uhr Ortszeit am Wohnort; Zeitzonen-Raster 0,1° |
| Einladungscode | 48 h, einmalig |
| Fehlerprotokoll | 30 Tage nach dem letzten Auftreten; gleiche Meldung innerhalb von 60 min zählt hoch (v0.6.1) |
| Backups | täglich, 7 Tage (auch Sicherungen vor Updates); zusätzlich Kopie außerhalb des Servers |
| Aufbewahrte Releases für Rückfall | 3 |
| Request-Größe | 64 KiB; Briefversand 512 KiB; Briefe an Bots 128 KiB |
| Push-Verifikation | 60 s |
| Push-Abo und Test-Push | höchstens 10 je Stunde und Konto (v0.6.1) |
| Fallback-Abfrage im Vordergrund | 60 s |
| Login-Schutz | ab 5. Fehlversuch exponentiell bis 15 min; Captcha ab 3 Fehlversuchen; je IP: Captcha ab 10, Wartezeit ab 20 |
| Zählertabellen im Arbeitsspeicher | je höchstens 100 000 Einträge |
| Argon2id (OPAQUE) | ≥ 64 MiB, 3 Durchläufe |
| Registrierungs-Reservierung | 10 min |

---

## Anhang B – Eulenarten

Es gibt 17 Eulenarten – genau die, für die Bilder vorliegen (Absprache vom 2026-11-05) – und seit v0.5 den Phönix (9.2.2).

| Art | Bildname (Dateien) | Preis | Energiepunkte | Fluggeschwindigkeitsfaktor | Erholungsfaktor |
|---|---|---|---|---|---|
| Bartkauz | Bartkauz | 12 (bis v0.5.0: 19) | 760 | 0,90 | 0,85 |
| Brillenkauz | Brillenkauz | 34 | 640 | 1,15 | 1,15 |
| Elfenkauz | Elfenkauz | 40 | 100 | 1,65 | 2,00 |
| Haubenkauz | Haubenkauz | 48 | 540 | 1,20 | 1,20 |
| Kanincheneule | Kanincheneule | 29 | 350 | 1,70 | 1,70 |
| Mähnenkauz | Maehnenkauz | 49 | 330 | 1,10 | 1,50 |
| Maskeneule | Maskeneule | 45 | 340 | 1,35 | 1,50 |
| Milchuhu | Milchuhu | 35 | 1080 | 0,90 | 0,60 |
| Riesenfischuhu | Riesenfischuhu | 50 | 1200 | 0,70 | 0,50 |
| Riesenkauz | Riesenkauz | 44 | 900 | 1,80 | 0,90 |
| Schleiereule | Schleiereule | 7 | 380 | 1,45 | 1,50 |
| Schneeeule | Schneeeule | 24 | 990 | 1,75 | 0,85 |
| Sperbereule | Sperbereule | 22 | 440 | 2,00 | 1,40 |
| Sumpfohreule | Sumpfohreule | 7 (bis v0.5.0: 16) | 430 | 1,35 | 1,40 |
| Südliche Weißgesichtseule | Suedliche-Weissgesichtseule | 32 | 300 | 1,30 | 1,65 |
| Waldkauz | Waldkauz | 6 | 540 | 1,10 | 1,25 |
| Waldohreule | Waldohreule | 8 | 410 | 1,35 | 1,45 |
| Phönix (v0.5) | Phoenix | 100 | 2000 | 4,00 | 2,00 |

**Bilddateien:** siebzehn je Art im Ordner `/images/` (der Phönix fünfzehn, ohne Küken und Brüten), dazu `Leere-Stange.png`, `Gruppenbild.png` und (v0.7) `Verbrennen.png`, zusammen 307 Dateien. Der Dateiname besteht aus dem Bildnamen der Art, beim normalen Bild ohne Zusatz, sonst gefolgt von einem Bindestrich und der Bildkennung, und der Endung `.png` (je Bild genau eine Datei):

| Bild | Dateiname | Beispiel Waldkauz |
|---|---|---|
| Normal | `<Bildname>.png` | `Waldkauz.png` |
| Abflug | `<Bildname>-Abflug.png` | `Waldkauz-Abflug.png` |
| Ankunft | `<Bildname>-Ankunft.png` | `Waldkauz-Ankunft.png` |
| Füttern | `<Bildname>-Fuettern.png` | `Waldkauz-Fuettern.png` |
| Streicheln | `<Bildname>-Streicheln.png` | `Waldkauz-Streicheln.png` |
| Grummelig | `<Bildname>-Grummelig.png` | `Waldkauz-Grummelig.png` |
| Küken | `<Bildname>-Kueken.png` | `Waldkauz-Kueken.png` |
| Tagflug | `<Bildname>-Tagflug.png` | `Waldkauz-Tagflug.png` |
| Nachtflug | `<Bildname>-Nachtflug.png` | `Waldkauz-Nachtflug.png` |
| Heimkehr Tag | `<Bildname>-Heimkehr-Tag.png` | `Waldkauz-Heimkehr-Tag.png` |
| Heimkehr Nacht | `<Bildname>-Heimkehr-Nacht.png` | `Waldkauz-Heimkehr-Nacht.png` |
| Trinken (v0.5) | `<Bildname>-Trinken.png` | `Waldkauz-Trinken.png` |
| Leckerli (v0.5) | `<Bildname>-Leckerli.png` | `Waldkauz-Leckerli.png` |
| Nachtpause (v0.5.1) | `<Bildname>-Nachtpause.png` | `Waldkauz-Nachtpause.png` |
| Tagschlaf unterwegs (v0.5.1) | `<Bildname>-Tagschlaf-Unterwegs.png` | `Waldkauz-Tagschlaf-Unterwegs.png` |
| Tagschlaf zuhause (v0.5.1) | `<Bildname>-Tagschlaf-Zuhause.png` | `Waldkauz-Tagschlaf-Zuhause.png` |
| Brüten (v0.7) | `<Bildname>-Brueten.png` | `Waldkauz-Brueten.png` |

Bildnamen und Bildkennungen beginnen mit einem Großbuchstaben, enthalten keine Umlaute und keine Leerzeichen (ä → ae, ö → oe, ü → ue, ß → ss, Leerzeichen → Bindestrich), genau wie die Bildnamen in der Tabelle oben. Der Build sucht die Dateien anhand dieser Tabelle (nicht durch Zerlegen der Dateinamen am Bindestrich), vergleicht Groß- und Kleinschreibung nicht und ignoriert Leerzeichen; findet er eine Datei nur auf diese tolerante Weise, meldet er eine Warnung. Die Originale sind quadratisch (derzeit 1 254 × 1 254 px).

---

## Anhang C – Ereignisse im Systemchat

- Kontakt bestätigt (gegenseitiges Koppeln erfolgreich)
- Kontakt hat die Verbindung gekappt
- Kontakt hat seinen Namen geändert (alt → neu)
- Kontakt hat sein Konto gelöscht
- Schlüsselwarnung für einen Kontakt (5.7)
- Brief, Gold oder Geschenk nicht zugestellt – die Eule ist umgekehrt (v0.7 auch für Antwortbriefe an Bord einer rastenden Eule)
- Leiheule hat Antwortbriefe gebracht und fliegt zurück in die Menagerie (v0.7)
- Eine fremde Eule rastet beim Nutzer, mit Art, Halter und Ende der Rast (v0.8.2, `owl_resting`, mit Push)
- Gold angekommen (Betrag, von wem – auch von einem Bot)
- Eule von einem Bot geschenkt (v0.8, `bot_owl_gift`; die Eule wartet auf ihren Namen)
- Ein Bot wurde gelöscht (v0.8, `bot_deleted`, nur an Spieler, die Kontakt zu ihm hatten)
- Eule oder Küken geschenkt bekommen
- Eule ist krank geworden / wieder gesund
- Eule hat Eier gelegt
- Küken geschlüpft (mit Aufforderung zum Benennen und ggf. Verschenken), Erinnerung an die Verschenkfrist, Ergebnis des Losentscheids
- Küken ist erwachsen
- Leiheule verfallen
- Verleih an die Menagerie beendet (mit Lohn)
- Warnung vor automatischer Löschung
- Kontolöschung abgebrochen (Login innerhalb von 24 Stunden)
- Passwort geändert
- Rundnachricht des Admins
- Spendenbitte alle 5 Wochen (drei Texte reihum, 8.4)
- Neues nach einem Update (einmal je Version, 8.4)
- Alte Briefe wegen der Löschfrist gelöscht (Anzahl und Chats, mit Bild der brennenden Briefe, v0.7, 8.4.1)

Keine Systemnachricht mehr (v0.7.2): „Eule ist wieder zu Hause“ – die Heimkehr eigener Eulen kommt nur als Einblendung mit Bild und als Push (8.4).

---

## Anhang D – Namen für Leiheulen (auch Zufallsnamen für Küken)

Momo, Keks, Pino, Flauschi, Nori, Puschel, Tofu, Krümel, Miso, Knöpfchen, Flöckchen, Pips, Mochi, Wuschel, Kiki, Fussel, Bubu, Schnuffel, Pünktchen, Taps, Nyx, Rune, Nebel, Echo, Onyx, Schatten, Mondlicht, Nox, Salem, Merlin, Dämmer, Mystic, Orion, Cosmo, Nova, Auri, Kismet, Lumi, Zora, Vesper, Moos, Flocke, Ahorn, Wolke, Feder, Klee, Sturm, Kiesel, Frost, Funke, Tau, Asche, Regen, Herbst, Flieder, Tanne, Wind, Farn, Schnee, Glimmer, Rio, Kim, Mika, Lou, Juno, Niko, Toni, Sam, Robin, Alex, Yuki, Nalu, Quinn, Sky, Ari, Neo, Jona, Remy, Eli, Lio, Huhu, Schuhu, Kuckuck, Professor, Brille, Knick, Flatter, Wupp, Glubsch, Schnabel, Plüsch, Knarz, Wölkchen, Murmel, Pompom, Knuff, Zwirbel, Quatsch, Knurps, Hermes, Arnold, Dougal, Bathilda, Ariana, Kendra, Hestia, Phineas, Arcturus, Ruppert, Walburga, Septimus, Septima, Aurora, Wilhelmina, Silvanus, Cuthbert, Galatea, Rolanda, Irma, Garrick, Ambrosius, Rosmerta, Dilys, Armando, Everard, Perenelle, Hepzibah, Merope, Wendelin, Gunhilda

Nur allgemein gebräuchliche, historische oder mythologische Vornamen; Namen, die eindeutig aus geschützten Werken stammen, kommen nicht in die Liste (14).

**Englische Liste (v0.4)** für Konten in Englisch, gleiche Länge und Reihenfolge (deutsche Wörter übersetzt, internationale Namen unverändert): Momo, Cookie, Pino, Fluffy, Nori, Tuft, Tofu, Crumble, Miso, Button, Snowdrop, Pips, Mochi, Scruffy, Kiki, Fluff, Bubu, Snuffles, Dotty, Tippy, Nyx, Rune, Mist, Echo, Onyx, Shadow, Moonlight, Nox, Salem, Merlin, Dusk, Mystic, Orion, Cosmo, Nova, Auri, Kismet, Lumi, Zora, Vesper, Moss, Flake, Maple, Cloud, Feather, Clover, Storm, Pebble, Frost, Spark, Dew, Ash, Rain, Autumn, Lilac, Fir, Breeze, Fern, Snow, Glimmer, Rio, Kim, Mika, Lou, Juno, Niko, Toni, Sam, Robin, Alex, Yuki, Nalu, Quinn, Sky, Ari, Neo, Jona, Remy, Eli, Lio, Hoot, Hooty, Cuckoo, Professor, Specs, Nibbles, Flutter, Whoosh, Goggles, Beaky, Plush, Creaky, Cloudlet, Marble, Pompom, Snuggles, Twirl, Fiddlesticks, Pipsqueak, Hermes, Arnold, Dougal, Bathilda, Ariana, Kendra, Hestia, Phineas, Arcturus, Ruppert, Walburga, Septimus, Septima, Aurora, Wilhelmina, Silvanus, Cuthbert, Galatea, Rolanda, Irma, Garrick, Ambrosius, Rosmerta, Dilys, Armando, Everard, Perenelle, Hepzibah, Merope, Wendelin, Gunhilda

---

## Anhang E – Namen für Bots

Entfällt seit v0.8: Die Namenslisten der früheren Verwandten-Bots sind mit ihnen entfernt (Anhang T). Bots des Kontrollzentrums bekommen ihren Namen im Kontrollzentrum (10.6).

---

## Anhang F – Änderungen in Version 0.2

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Briefe schreiben | Ohne einsatzbereite Eule bietet die Eulenwahl die Leiheulen des Tages an; geliehen und bezahlt wird erst beim Absenden | 8.4, 9.6 |
| Leiheulen | Die drei Leiheulen eines Tages haben je Nutzer verschiedene Namen; Start-Energie vorab per HMAC | 9.6 |
| Löschfrist | Alle Briefe und Systemnachrichten spätestens 365 Tage nach Zustellung gelöscht; eigene Frist 30/90/180 Tage wählbar | 8.4.1, 8.10 |
| Umzug | 3 Umzüge pro Kalendermonat statt „alle 21 Tage“ | 7.3 |
| Krankheit | Pflegebonus zählt nur Tage mit mindestens einer Stunde zu Hause | 9.3 |
| Menagerie | Einheitlich „Menagerie“ statt „Papeterie“ (Texte, Code, Datenbank); „papeterie“ bleibt als gesperrter Name | 8.7, 9.7, 7.1 |
| Statusleiste | Animiertes „Neue Post!“ bei ungelesener Post; Versionsnummer auf der Übersicht | 8.3 |
| Startseite | Versionsnummer als Link auf das GitHub-Repository | 8.1 |
| Chatverlauf | Briefe als Schriftrollen in zwei Handschriften; Druckschrift-Einstellung | 8.4, 14 |
| Karte | Größere Schrift und Symbole (Pixelgrößen), Städte über 200 000 bzw. 1 Mio. Einwohner, England/Schottland/Wales/Nordirland getrennt, automatischer Zoom auf alle bekannten Orte | 12 |
| Rechtstexte | Datenschutzerklärung ohne Entwurfshinweis und ohne Kapitel „Verantwortlich“ und „Deine Rechte“; Standardtexte, für die der Betreiber selbst verantwortlich ist | 8.11 |
| Dokumentation | `README.md` (Markdown) mit Teil für Laien und Teil für Selbst-Hoster ersetzt `readme.txt`; Hilfe und Erklärbär betonen die ernsthafte Kryptografie | 1, 8.11, 10.2, 16.4 |

---

## Anhang G – Änderungen in Version 0.3

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Briefe | Kleines Pergament bis 800, großes bis 15 000 Zeichen; Padding groß 64 KiB, alte große Briefe bleiben lesbar | 5.9, Anhang A |
| Chatverlauf | Briefbögen aus Büttenpapier mit ausgefranstem Rand und Wachssiegel; Handschriften Dancing Script (eigene, Sepia) und Playwrite DE Grund (Gegenüber, Blauschwarz) | 8.4, 14 |
| Design | Seitenhintergrund mit verblasster Aquarell-Weltkarte; jeder Text steht in einer Box | 14 |
| Ungelesen | Zähler und „Neue Post!“ gehen nach dem Lesen sofort zurück, ohne Neuladen | 8.4 |
| Systemnachrichten | Heimkehr einer Eule mit Tag-/Nacht-Bild und Push; Spendenbitte alle 5 Wochen (3 Texte reihum, ko-fi.com/posteulen); Update-Nachricht an alle Konten bei jeder neuen Version | 8.4, 11.2, Anhang C |
| Eulenübersicht | Leiheulen und eigene Eulen unter getrennten Überschriften (Leiheulen oben); Flugbild bei Tag/Nacht, leere Stange in der Menagerie; Freilassen nur mit eingetipptem Namen und zweiter Bestätigung | 8.5, 9.2.6, 9.2.8 |
| Menagerie | Leiheulen oben; Kaufeulen nach Preis sortiert, mit Beschreibung; lange Namen umbrechen sauber | 8.7 |
| Bots | Erklärbär erst auf der Karte, wenn man ihm geschrieben hat; weitere Bots erst mit ihrem ersten Brief; neuer Erklärbär-Brief zum Startbildschirm (Tag 1, Eulen-Brief an Tag 3); Hinweis zur Antwortzeit im Bot-Chat entfällt | 8.8, 10.2, 10.3, 12.1 |
| Karte | Bisherige Flugstrecke als dünne dunkelbraune Linie mit „Zzz“ an Übernachtungsorten; Aktualisierung alle 5 Minuten | 12.1 |
| Statusleiste | Hinweis auf nicht eingerichtete Benachrichtigungen bis zur nächsten Anmeldung ausblendbar | 8.3 |
| Startseite | Gruppenbild aller Eulen | 8.1 |
| Erklärtexte | Willkommensseite, Hilfe, Benachrichtigungs-Hinweise und Erklärbär für technische Laien neu geschrieben; Google-freies Android und UnifiedPush nur noch in Hilfe und README | 8.2, 8.10, 8.11, 10.2, 11.7, 16.4 |

---

## Anhang H – Änderungen in Version 0.3.1 und 0.3.2

| Version | Bereich | Änderung | Abschnitt |
|---|---|---|---|
| 0.3.1 | Startseite | Gruppenbild neben der Anmeldung statt des Waldkauzes | 8.1 |
| 0.3.2 | Leiheulen | Jede angebotene Art einmal pro Angebotstag, keine Grenze für gleichzeitig vorhandene Leiheulen | 9.6, Anhang A |
| 0.3.2 | Namen | 31 neue Namen für Leiheulen und Küken (allgemein gebräuchliche, historische und mythologische Vornamen) | Anhang D |
| 0.3.2 | Briefe schreiben | Mehrere Empfänger werden für die kürzeste Route vorsortiert; Reihenfolge bleibt änderbar | 8.4 |
| 0.3.2 | Chatverlauf | Pergament-Texturen: hell für Briefe an den Nutzer, dunkel für eigene; kein Siegel mehr | 8.4, 14 |
| 0.3.2 | Übersicht | Gruppenbild ab Desktopbreite neben den Kacheln | 8.3 |
| 0.3.2 | README, Hilfe | Hinweis, dass PostEulen sich eignet, Kinder an Messenger heranzuführen (langsames Tempo, keine Fremden) | 8.11, 16.4 |

---

## Anhang I – Änderungen in Version 0.4

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Startseite | Link „Spenden“ zu https://ko-fi.com/posteulen neben Hilfe, Datenschutz, Impressum | 8.1 |
| Leiheulen | Briefe an bis zu 5 Empfänger nacheinander (Gold weiter an 1), Angebot in der Eulenwahl auch bei mehreren Empfängern; Leihpreis pauschal 0,1 Gold; fällt ein Empfänger weg, fliegt die Leiheule zum nächsten | 8.4, 9.5, 9.6, Anhang A |
| Gold | Tägliches Gold 3,0 in den ersten 30 Tagen ab Registrierung, danach 2,0 (statt 1,0); bestehende Konten nach ihrem Registrierungstag | 9.1.1, Anhang A |
| Chatverlauf | Beim Öffnen eines Chats (auch Systemchat) springt die Seite zum neuesten Brief; nach dem Absenden zum neuen Brief | 8.4 |
| Übersicht | Gruppenbild und Kacheln am Desktop je halbe Breite, oben und unten bündig | 8.3 |
| Karte | Immer quadratisch, passt ins Fenster; Ausschnitt quadratisch und nie über den Kartenrand hinaus | 8.9, 12.1 |
| Sprache | Englische Ansicht mit Fähnchen oben rechts auf allen Seiten; Deutsch Standard; Wahl vor dem Login auf dem Gerät gespeichert, Kontosprache nach dem Login; Einstellung „Sprache“; Bots, Push, Systemnachrichten, Hilfe, Rechtstexte, Karte, Leiheulen- und Kükennamen in der Sprache (Migration 0010) | 1, 8.12, 8.10, 10.5, Anhang D |
| README, Hilfe, Erklärbär | Neue Abschnitte zu Sprache und Spenden; neue Goldregel und Leiheulen in Hilfe, Bot-Briefen und Wissensbasis; englische README `README.en.md` | 8.11, 10.2, 16.4 |

---

## Anhang J – Änderungen in Version 0.5

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Chatverlauf | Nicht prüfbare Briefe meldet der Empfänger als „nicht lesbar“; der Absender sieht das statt „gelesen“ | 8.4 |
| Leiheulen | 4 statt 3 Arten am Tag, alle 4 leihbar; Motivation 0,8–1,0 | 9.6, Anhang A |
| Menagerie | Neue Beschreibungen (Lieblingsleckerli statt Kekse), englisch übertragen; Werte in km/h und %/h | 8.7 |
| Flug | Schlaf unterwegs: Erholung wie zu Hause, nur so lange wie nötig bis zum nächsten Ziel | 9.4.2, Anhang A |
| Phönix | Neue Art: 100 Gold, 2 000 Energie, Faktor 4 / 2; nie Leiheule, keine Eier, kein Menagerie-Verleih, keine Bot-Eule, kein Kükenbild | 9.2.2, Anhang B |
| Pflege | Wasser (kostenlos, 1× am Tag) und Lieblingsleckerli (0,2 Gold, 1× am Tag, +20 % Energie) neben Streicheln und Eulenkeks; neue Bilder Trinken und Leckerli | 9.3, 9.2.6 |
| Krankheit | Gepflegter Tag = zwei verschiedene Pflege-Aktionen | 9.3, 9.8 |
| Motivation | Neuer Wert 0,8–1,2 je Eule mit Balken; −0,1 jede Nacht, +0,1 je Pflege-Art und Tag; wirkt ab Abflug auf Energie, Tempo und Erholung der Reise; Anzeige von km/h und %/h mit ±x % | 9.3a, 8.5 |
| PWA | Update-Hinweis bleibt nach dem Neuladen nicht mehr hängen (wartender Service Worker wird aktiviert; „Neu laden“ lädt notfalls direkt) | 15 |
| Daten | Migration 0011: `owls.motivation`, `owls.watered_on`, `owls.snacked_on`, `letters.unreadable` | 4.6 |

---

## Anhang K – Änderungen in Version 0.5.1

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Preise | Sumpfohreule 7 Gold (vorher 16), Bartkauz 12 Gold (vorher 19) | Anhang B |
| Eulenübersicht | Schlafbilder unterwegs: „Nachtpause“ bei Dunkelheit, „Tagschlaf unterwegs“ bei Helligkeit an der Position der Eule | 8.5, 9.2.6 |
| Eulenübersicht | „Tagschlaf zuhause“: gesunde Eulen zu Hause dösen bei Tag (50 % je Öffnen), nie nachts, nie 10 Minuten nach einer Pflege-Aktion | 8.5, 9.2.6 |
| Daten | Migration 0012: `owls.cared_at` (Zeitpunkt der letzten Pflege-Aktion) | 9.3 |


---

## Anhang L – Technische Umsetzung (Referenz)

Seit v0.6 Teil der Spezifikation (vorher `ARCHITECTURE.md` und die technischen Einträge von `DECISIONS.md`). Die Regeln stehen in den Abschnitten 1–17; dieser Anhang beschreibt, **wie** der aktuelle Stand sie umsetzt. Ein Neubau SOLL dieser Struktur folgen, damit vorhandene Datenbanken, Geheimnis-Dateien, Schlüsselpakete und Briefe kompatibel bleiben; maßgeblich für Einzelheiten des Schemas sind die Migrationen in `backend/migrations/`.

### L.1 Komponenten

| Komponente | Ordner | Aufgabe |
|---|---|---|
| Nutzer-PWA | `web/` | Svelte 5 + Vite (ohne SvelteKit), eigener History-Router; gesamte Client-Kryptografie, Kartenanzeige, Service Worker (`web/src/sw.ts`) |
| Adminpanel | `admin/` | Svelte 5 + Vite, Oberfläche der Admin-API (13); v0.8 gemeinsame Bausteine für beide Panels: Anmeldung (`lib/auth.ts`), API (`lib/api.ts`, einstellbarer Leerlauf), Sprache (`lib/i18n.svelte.ts`, `LanguageSwitch.svelte`), `PasswordForm.svelte` |
| Bots-Kontrollzentrum | `bots/` | v0.8: Svelte 5 + Vite, Oberfläche der Bots-API (10.12); nutzt die Bausteine aus `admin/src` und die Kartendaten aus `web/src/lib/map/world.json` |
| Backend | `backend/` | Fastify, ein Node-Prozess mit drei Listenern (Nutzer-API 127.0.0.1:3001, Admin-API 127.0.0.1:3002, v0.8 Bots-API 127.0.0.1:3003; getrennte Router, Cookies und Rate-Limits), `node:sqlite`, Migrationen, Ereignis-Warteschlange, Spielregeln, Bots, Push, CLI (`backend/src/cli.ts`: `setup`, `migrate`, `check`, `admin-init`, `admin-reset`, `bots-init`, `bots-reset`, `bots-export --out`, `bots-import --file [--apply]`, `caddyfile`, `backup`, `version`, `schema-version`); v0.8 Bots des Kontrollzentrums in `backend/src/central/` (Modell, Flüge, Läufer, Events, Admin-Funktionen, Bilder, ZIP, Export/Import, Routen), gemeinsame Panel-Anmeldung `backend/src/admin/panel-auth.ts`, Abbau der Verwandten-Bots `backend/src/bots/relatives.ts` |
| Shared | `shared/` | Konstanten (Anhang A), Arten (B), Namen (D, E), Texte je Sprache, Valibot-Schemas, Krypto-Formate, reine Spiellogik (`shared/src/game/`), Karte und Land/Wasser-Masken (v0.8 zusätzlich `shared/data/worldmask.bin`), Sicherheits-Header, Version |
| Betrieb | `deploy/` | `install.sh`, `posteulen-update` → `update.sh` + `update-steps.sh` (Schritte der neuen Version), `configure.sh`, `backup.sh`, `posteulen-cli`, systemd-Units, `allowed_signers`, VM-Test (`deploy/test/`) |
| Werkzeuge | `tools/map/`, `scripts/` | Kartendaten und Hintergrundbild aus Natural Earth (ohne Abhängigkeiten, nur Entwicklungsrechner); `npm start`, `npm run dev`, `npm test`, `npm run deps:report` |

- Das Backend läuft ohne Build-Schritt als TypeScript per Type-Stripping (`erasableSyntaxOnly`, Typprüfung `tsc --noEmit`); gebaut werden nur `web/`, `admin/` und (v0.8) `bots/`. Statische Dateien liefert Caddy direkt aus `current/web/dist`, `current/admin/dist` bzw. `current/bots/dist`; Caddy leitet `posteulen.de/api/*` an 3001, `admin.<domain>/api/*` an 3002 und `bots.<domain>/api/*` an 3003.
- Lokale Vorschau ohne Server (`npm start`, `backend/src/dev/preview.ts`): liefert die gebauten Seiten mit denselben Sicherheits-Headern, Admin-Erstpasswort in `data/admin-erstpasswort.txt`, v0.8 das des Kontrollzentrums in `data/bots-erstpasswort.txt` (Kontrollzentrum auf http://localhost:8082). Nur für automatische Tests gibt es gelockerte Rate-Limits (`POSTEULEN_PREVIEW_RELAXED_LIMITS`) und einen Zeitraffer für Flüge (`POSTEULEN_PREVIEW_FLIGHT_TIME_SCALE`); beides ist auf Servern nie gesetzt.

### L.2 Krypto-Formate

| Zweck | Verfahren | Bibliothek |
|---|---|---|
| Anmeldung | OPAQUE (RFC 9807), ristretto255, Argon2id m = 64 MiB, t = 3, p = 4 (`argon2id-custom`) | `@serenity-kit/opaque` 1.1.0 |
| Schlüsselableitung | HKDF-SHA256, leeres Salt, `info` = Kontext-String | WebCrypto |
| Symmetrisch | XChaCha20-Poly1305-IETF, 24-Byte-Zufallsnonce vorangestellt | `libsodium-wrappers-sumo` |
| Signatur | Ed25519 (detached) | libsodium |
| Brief-Schlüssel verteilen | HPKE Base, DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, ChaCha20-Poly1305 | `@hpke/core`, `@hpke/dhkem-x25519`, `@hpke/chacha20poly1305` |
| Padding | ISO/IEC 7816-4 | libsodium `pad` |
| Lokale Verpackung | AES-256-GCM mit nicht exportierbarem `CryptoKey` in IndexedDB | WebCrypto |
| Server: Hash, HMAC | SHA-256, HMAC-SHA256 | `node:crypto` |

**Kontext-Strings** (`shared/src/crypto/contexts.ts`; bestehende Werte werden nie geändert): `PostEulen/master-key-wrap/v1`, `PostEulen/identity-keys/v1`, `PostEulen/contact-vault/v1`, `PostEulen/letter/v1`, `PostEulen/letter-sig/v1`, `PostEulen/letter-ad/v1`, `PostEulen/letter-key/v1`, `PostEulen/safety-number/v1`, `PostEulen/ad/master-key/v1`, `PostEulen/ad/identity-keys/v1`, `PostEulen/ad/vault/v1`, `PostEulen/ad/request-label/v1`.

**Kanonische Kodierung** (`shared/src/crypto/encoding.ts`): Kontext-String, danach jedes Feld als `u32be(Länge) ‖ Bytes`; Zahlen `u64be`, Texte UTF-8 nach NFC. Damit sind Feldgrenzen eindeutig, ohne JSON-Kanonisierung.

**Formate:**
```
Schlüsselpaket (users.wrapped_master_key, users.private_keys, users.key_format):
  wrapped_master_key = nonce24 ‖ XChaCha20-Poly1305(MK, HKDF(export_key, "…/master-key-wrap/v1"),
                       ad = enc("PostEulen/ad/master-key/v1", userId, "master-key", fmtVersion))
  private_keys       = nonce24 ‖ XChaCha20-Poly1305(ed25519_sk ‖ x25519_sk, HKDF(MK, "…/identity-keys/v1"),
                       ad = enc("PostEulen/ad/identity-keys/v1", userId, "ed25519+x25519", fmtVersion))
  (Ed25519- und X25519-Paar unabhängig erzeugt, keine Umrechnung)
Brief:
  content    = enc("PostEulen/letter/v1", fmtVersion, letterId, senderId, recipientId, sentAt, kind, parchment, text)
  signature  = Ed25519(enc("PostEulen/letter-sig/v1", content))
  plaintext  = pad(content ‖ signature, 4096 | 65536)     (große Briefe vor v0.3: 16384)
  ad         = enc("PostEulen/letter-ad/v1", letterId, senderId, recipientId, kind, parchment)
  ciphertext = nonce24 ‖ XChaCha20-Poly1305(plaintext, letterKey, ad)  → 4 136 bzw. 65 576 Byte (alt: 16 424)
  wrap_r/s   = HPKE.seal(x25519_pub, info = enc("PostEulen/letter-key/v1", letterId, "recipient"|"sender"), letterKey)
  kind ∈ {letter, cover_gold, cover_owl, cover_chick}, parchment ∈ {small, large}
Tresor-Eintrag:
  blob = nonce24 ‖ XChaCha20-Poly1305(JSON{contactUserId, keySets[{ed25519Pub, x25519Pub, firstSeen}], compared, separated},
         HKDF(MK, "…/contact-vault/v1"), ad = enc("PostEulen/ad/vault/v1", ownUserId, contactUserId, entryVersion))
Sicherheitsnummer:
  SHA-512(enc("PostEulen/safety-number/v1", idA, edA, xA, idB, edB, xB)), A < B nach Nutzer-ID;
  60 der 64 Byte als 12 × 5 Byte, je mod 100 000 → 12 Fünfergruppen
```
- Offene Kontaktanfragen: Der Server speichert das Ziel nur als HMAC des Vergleichsschlüssels (`contact_requests.target_hmac`); den eingegebenen Namen sieht nur der Anfragende, verschlüsselt mit seinem Tresor-Schlüssel (`label`, AD `PostEulen/ad/request-label/v1`).

**Server-Geheimnisse** (`/etc/posteulen/secrets.json`, `root:posteulen` 0640, einmalig von `posteulen-cli setup`, nie überschrieben): `{ format: 1, opaqueServerSetup, vapid: { publicKey, privateKey }, rootSecret }`. Ableitungen per HKDF-SHA256(rootSecret, info) mit `PostEulen/server/<zweck>/v1` für `openai-key`, `name-lock`, `contact-request`, `loan-name`, `fake-credential`, `invite`, `altcha`, `backup-check` und (v0.7) `voucher` (Prüfsumme in `meta`, mit der Start, Update und Wiederherstellung erkennen, ob Geheimnis-Datei und Datenbank zusammengehören). Neue Schlüssel bekommen neue `info`-Strings; die Datei bleibt unverändert.

### L.3 Datenmodell (SQLite, Schema-Version 18)

`PRAGMA journal_mode = WAL; foreign_keys = ON; secure_delete = ON`; Schema-Version in `PRAGMA user_version`, Migrationen `backend/migrations/NNNN_*.sql` vorwärts, je in einer Transaktion. IDs nach außen: 128 Bit Zufall, base64url. Zeitpunkte: ms seit der Epoche (UTC); Tage: `TEXT 'YYYY-MM-DD'` (UTC); Gold: Zehntel; Koordinaten: Hundertstelgrad; Motivation: Zehntel.

| Bereich | Tabellen (wichtige Felder) |
|---|---|
| Konten | `users` (Name und Vergleichsschlüssel, `created_on`, `state` active/deletion_pending/deleting, OPAQUE-Datensatz, öffentliche Schlüssel, Schlüsselpaket **E2E**, Wohnort, Umzüge je Monat, `name_changed_year`, `gold`, `last_active_date`, `inactivity_warned_on`, Kontaktanfragen je Tag, `letter_retention_days`, `letters_print`, `donation_count`, `language`, `feedback_sent_on` seit v0.7.1, `bots_created` seit v0.7.2, `bots_disabled` seit v0.8, `links_clickable` seit v0.8.2) · `sessions` (nur SHA-256 des Tokens) · `push_subscriptions` · `notifications` (Push-ID = ID, `push_state`) · `name_locks` (HMAC) · `invite_codes` (HMAC + letzte 4 Zeichen) |
| Kontakte, Briefe | `contact_requests` (HMAC-Ziel, `label` **E2E**) · `contacts` (`user_lo`/`user_hi`, Schlüsselwarnung je Seite) · `vault_entries` (**E2E**, Version steigt nur) · `chats` (Ungelesen-Zähler, Bot-Zusammenfassung im Klartext) · `letters` (Chiffrat und Wraps **E2E**, Klartext nur bei Bot-Briefen, v0.8 `media` (Bild-IDs, JSON) und `bot_event_id` bei Briefen von Bots des Kontrollzentrums, `status` in_flight/delivered/returned, `read`, `unreadable`, `sender_has`/`recipient_has` als „eigene Kopien“, `arrival_seen`, Momentaufnahme `owl_name`/`owl_species`) · `system_messages` (Typ + Parameter, `arrival_image`, `seen`, `arrival_shown`; lange Texte stehen in `shared/src/texts/messages.ts`) · `homecomings` (v0.7.2: noch nicht eingeblendete Heimkehr eigener Eulen – Eulenname, Art, Zahl der Antwortbriefe, Zeitpunkt; gelöscht nach dem Einblenden, spätestens nach 60 Tagen) |
| Eulen, Flüge, Gold | `owls` (`kind` own/loan/bot, `state` home/flying/gift_flight/sick/self_care/vet/brooding/menagerie, Energie mit Zeitstempel, Küken- und Gelege-Felder, `owned_since`, Pflege-Tage je Art `fed_on`/`petted_on`/`watered_on`/`snacked_on`, `motivation`, `cared_at`, `pending_sickness`, `loan_expires_at`) · `owl_care_days`, `owl_away` (Pflegebonus, je 60 Tage) · `clutches` · `flights` (v0.8: `holder_kind` user/bot und `bot_peer_id` – Flüge der Bots des Kontrollzentrums, `holder_id` ohne Fremdschlüssel; Profil mit `ownUnits` seit v0.7, Route mit Status je Halt – `pending`/`resting`/`done`/`skipped`, Rast `rest` und `restUntil` je Halt seit v0.7 –, Segmentliste als JSON mit den Arten `fly`, `sleep`, `rest` (v0.7) und `stop`, Gold und `gold_state`) · `transactions` (letzte 20) · `menagerie_offers` · `loan_days` |
| Erklärbär | `bots` (je Konto, seit v0.8 nur Typ `explainer` – ein Trigger lehnt andere ab; Wohnort, `in_addressbook` = „bekannt“, letzter Nutzerbrief, gesendete feste Briefe) · `bot_shipments` (seine Lieferungen unterwegs) · `bot_jobs` (fällige KI-Antworten) · `ai_usage` (je UTC-Tag und Kontingent `explainer`/`bots`, v0.8) |
| Bots des Kontrollzentrums (v0.8) | `central_bots` (stabile ID, Name und `name_key` eindeutig, `state` draft/active/paused, `character`, Wohnort in Hundertstelgrad, `owl_mode` own/loan, `owl_species`, `owl_name`, `owl_sex`, `motivation` 5–200, `rest_hours` 0–168, `player_owls`) · `central_bot_media` (Bild als WebP-BLOB, SHA-256 eindeutig je Bot, Breite, Höhe) · `central_bot_events` (stabile ID, `due_at`, `state` planned/running/archived/skipped, Umzug, `has_letter`, Pergament, vier Texte `text_first_de/_en`, `text_follow_de/_en`, `context`, `owl_mode`, `gift_gold` oder `gift_species`, `media`, Start, Archiv, Zahlen `recipients`/`sent`/`delivered`/`read`/`replies`) · `central_bot_players` (je Bot und Spieler: `known`, `first_started`, `removed`, `last_letter_day`) · `central_bot_deliveries` (je Brief an einen Spieler: Event oder spontan, `state` pending/started/done/dropped, `not_before`, Versuche, Variante, Brief, Flug, `UNIQUE (event_id, user_id)`) · `central_bot_inbox` (Spielerbriefe: angekommen/beantwortet, Antwortbrief) · `central_bot_stats` (je Bot und UTC-Tag: abgeschickt, zugestellt, gelesen, Antworten) · `bots_admin`, `bots_admin_sessions` (Zugang des Kontrollzentrums) |
| Betrieb | `scheduled_events` (`due_at`, `logical_at`, Typ, Referenz, Versuche) · `daily_job_runs` · `admin`, `admin_sessions` · `settings` (Registrierungsmodus, Löschfrist, OpenAI-Modell, Tageslimit, verschlüsselter Key) · `feedback` (v0.7.1: ID, Text, Eingang; ohne Absender) · `banners` (v0.8.2: Text de/en, Beginn, Ende, Erstellung) · `vouchers` (v0.7: HMAC, letzte 4 Zeichen, Art `gold`/`owl`, Gold in Zehnteln bzw. Art oder `random`, Ablauf, `redeemed`; ohne Einlöser) · `broadcasts` · `error_log` (`count`, `last_at` seit v0.6.1: Zusammenfassen gleicher Meldungen) · `stats_counters`, `stats_daily` · `meta` (`secrets_fingerprint`, `notes_version`) |

Nur im Arbeitsspeicher (gewollt, ein Neustart verwirft sie): Registrierungs-Reservierungen, OPAQUE-Zustände, Re-Authentifizierungs- und Vorbereitungs-Tokens, Fehlversuche je Name und IP bzw. /64, Rate-Limit-Zähler (je Tabelle höchstens 100 000 Einträge; beim Überlauf nie alles auf einmal löschen, 5.10), benutzte und gerade geprüfte ALTCHA-Lösungen, SSE-Verbindungen, Push-Warteschlange (nicht gesendete Pushes werden aus `notifications` bis 24 h lang erneut versucht).

### L.4 API

Nur JSON; je Endpunkt ein strenges Valibot-Schema (`shared/src/schemas/`), ändernde Endpunkte ohne Nutzdaten nur mit `{}`; ändernde Anfragen brauchen `X-PostEulen: 1` und den exakt passenden `Origin`; Fehlerantworten `{ code }` (übersetzt im Browser); jede Antwort trägt die Server-Version, veraltete Clients erhalten `409 client_outdated`. Rate-Limit-Klassen: normal (je Sitzung und IP), teuer (Login, Registrierung, Vorbereitung/Flugvorschau, Kontaktanfragen, Briefversand), Push-Abo und Test-Push zusätzlich je Konto (10 je Stunde, v0.6.1), Admin streng. OPAQUE-Schritte des Servers laufen über `backend/src/auth/opaque-guard.ts` (`opaqueStep`: Fehler der Bibliothek → `400`; `checkRegistrationRecord`: ein Datensatz wird nur gespeichert, wenn ein Probe-Login damit gelingt; `checkPublicKeys`: Ed25519 gültiger Punkt, X25519 nicht von kleiner Ordnung, v0.6.1).

**Nutzer-API** (`/api/…`): `health`, `version`, `session`, `me`, `sync`, `events` (SSE) · `altcha/challenge`, `registration`, `register/start|finish`, `login/start|finish`, `logout`, `reauth/start|finish`, `password/start|finish` · `account/delete`, `account/name|home|letters|language` (PATCH) · `contacts` (GET; v0.7.2 zusätzlich `allBots`, die Zahl aller Bots des Kontos), `contacts/requests` (POST), `contacts/requests/:id` (DELETE), `contacts/:id` (DELETE, auch Bots), `bots/remove-all` (POST, v0.7.2), `contacts/:id/keys`, `contacts/:id/key-warning`, `vault` (GET), `vault/:contactId` (PUT) · `chats`, `chats/:peer/letters` (v0.7 je Brief `owl.carrier` own/loan/foreign und `owl.holderName`), `chats/:peer` (DELETE, „Alle Briefe verbrennen“), `letters/prepare|send|read|unreadable|arrival-seen` (v0.8.2: `unreadable` mit optionalem `reason`; v0.7: `rest` in Stunden; Eulen-Referenz `guest:<ID>` für Antworten mit einer rastenden Eule), `bot-letters/send`, `flights/preview` (v0.7: `rest`, `guests`) · `gold/prepare|send`, `finance`, `vouchers/redeem` (v0.7), `feedback` (POST, v0.7.1) · `owls` (GET; v0.7 zusätzlich `guests`), `guests/:id/send-on` (POST, v0.8.2), `banners` (GET, v0.8.2), `owls/buy`, `owls/:id/name|water|pet|feed|snack|treat|menagerie|release`, `owls/:id/gift/prepare|send`, `clutches/:id/gift/prepare|send`, `menagerie` (GET), `menagerie/loan` · `map` · `news`, `news/seen`, `system-messages`, `system-messages/seen|arrival-shown`, `homecomings` (GET, v0.7.2), `homecomings/seen` (POST, v0.7.2) · `push/key`, `push/status`, `push/subscription` (PUT/DELETE), `push/test`, `push/ack` (ohne Sitzung, nur Push-ID; Hintergrundanfrage, zählt nicht als Aktivität).

**Bots-API** (v0.8, `bots.<domain>/api/…`, Cookie `__Host-pe_bots`): `session`, `login/start|finish`, `logout`, `me`, `reauth/start|finish`, `password/start|finish` (wie beim Admin, gemeinsamer Code `panel-auth.ts`) · `bots` (GET Übersicht mit Statistik, POST anlegen), `bots/:id` (GET), `bots/:id/settings` (PUT), `bots/:id/state` (POST active/paused), `bots/:id/delete` (POST mit Namen) · `bots/:id/events` (GET geplant und vergangen, POST), `bots/:id/events/:event` (PUT, DELETE) · `bots/:id/media` (POST, Rohdaten `image/jpeg|png|webp`), `media/:id` (GET) · `bots/:id/ai-test` (POST) · `owls` (GET Karte) · `export` (POST, ZIP aller Bots), `bots/:id/export` (POST, optional `eventIds`), `import/preview` und `import` (POST, Rohdaten `application/zip`, optional `?target=<Bot-ID>`), `altcha/challenge`.

Neu in der Nutzer-API (v0.8): `bot-media/:id` (GET, nur mit einem zugestellten Brief, der das Bild enthält); `bot-letters/send` nimmt auch `guest:<Flug-ID>` (Antwort mit der rastenden Bot-Eule); `contacts` liefert `bots` mit `type` explainer/central, `playerOwls`, `writableFrom` und `botsDisabled`; `chats/:peer/letters` liefert `media`.

**Admin-API** (`admin.<domain>/api/…`, Cookie `__Host-pe_admin`): `session`, `login/start|finish`, `logout`, `password/start|finish` (Pflicht beim ersten Login), `stats`, `settings/registration`, `invites` (+ `invites/:id`), `settings/inactivity`, `openai` (+ `openai/key`, `openai/models`, `openai/settings` mit `botsDailyLimit` seit v0.8, `openai/test`), `broadcasts`, `errors` (+ `errors/:id`; Einträge mit `count` und `lastAt`, v0.6.1), `vouchers` (+ `vouchers/:id`, v0.7), `feedback` (+ `feedback/:id`, v0.7.1), `banners` (GET, POST, + `banners/:id` DELETE, v0.8.2), `altcha/challenge`.

Ein Test (`backend/test/routes.test.ts`) liest alle Routen aus dem Quelltext: Jede nicht ausdrücklich öffentliche Route liefert ohne Sitzung 401, und ändernde Routen ohne Nutzdaten lehnen jeden anderen Inhalt ab.

### L.5 Ereignis-Warteschlange

- Ein Worker im Serverprozess: nächstes `MIN(due_at)` lesen, höchstens 1 Stunde schlafen, fällige Ereignisse in Reihenfolge (`due_at`, `id`) je in `BEGIN IMMEDIATE … COMMIT` ausführen; Handler und Löschen des Ereignisses in derselben Transaktion, jeder Handler prüft zusätzlich den Zustand (Idempotenz). SSE-Hinweise und Push-Aufträge erst nach dem Commit (`tools.after`). Fehler: Rollback, Versuch +1, späterer Termin bei gleicher logischer Zeit, Eintrag im Fehlerprotokoll.
- Handler bekommen `logical_at` als Uhr (Nachholen nach Ausfällen). Neue frühere Ereignisse wecken den Worker.
- Ereignistypen: `flight_stop` (ein Ereignis je Halt eines Flugs), `flight_rest_end` (v0.7: Ende einer Rast beim Empfänger), `deliver`, `bot_deliver`, `bot_letter`, `bot_reply`, v0.8 `cbot_event` (Ausführung eines Events), `cbot_kick` (weckt den Läufer der Bots, z. B. wenn eine Bot-Eule zurück ist), `cbot_archive` (Archiv-Prüfung), `treatment_end`, `hatch`, `clutch_names`, `clutch_gift`, `clutch_reminder`, `chick_adult`, `menagerie_end`, `loan_expire`, `donation`, `account_delete`, `account_purge`. Tägliche Jobs über `registerDaily` mit `daily_job_runs (job, day)`: `menagerie_offer` und `motivation` (00:00, Motivation mit Nachholen je Tag), `sickness` (03:00), `inactivity` (04:00, inkl. Aufräumen und Löschfristen; v0.8 auch ungenutzte Bilder der Bots und abgelaufene Sitzungen des Kontrollzentrums), `daily_gold` (03:00 seit v0.7, mit Nachholen je Tag; danach SSE-Hinweis `profile` an alle verbundenen Konten). Ändert sich die Uhrzeit eines Tagesjobs, verlegt `ensureDailyJobs` beim Start den geplanten Lauf auf die neue Uhrzeit desselben Tages (v0.7).
- Kontinuierliche Werte (Energie, Position) werden beim Lesen berechnet; KI-Aufrufe laufen außerhalb der Transaktionen (`bot_jobs` + Hintergrund-Läufer des Erklärbärs; v0.8 `central_bot_deliveries` + `CentralRunner` in `backend/src/central/runner.ts`, der Zustellungen nacheinander abarbeitet: Bot-Eule frei? → Text (mit KI-Anpassung) → Start in einer Transaktion).
- **v0.8, Flüge der Bots:** Die Flug-Engine (`flights/service.ts`) kennt Bots nur über Hooks (`setCentralFlightHooks`): Zustellung beim Spieler, Rückkehr zum Bot (Antworten an Bord → `central_bot_inbox`), Briefe von Spielern beim Bot, Ende eines Bot-Flugs (Eule frei, Archiv). Beim Start (vor dem Worker) baut `removeRelatives` die Verwandten-Bots ab (Anhang T).

### L.6 Frontend

- Zustand des angemeldeten Kontos im Arbeitsspeicher (Kontakt-Tresor in `vault.svelte.ts`, Listen in `live.svelte.ts`) meldet sich mit `onSignOut` in `auth.svelte.ts` an und wird beim Abmelden und bei jedem 401 geleert; `accountGeneration()` zählt jede Abmeldung, und Antworten, die danach eintreffen, werden verworfen (v0.6.1).
- Links in Brief-, Bot- und Hilfetexten zerlegt `linkify` aus `shared/src/links.ts` (verkleidete Adressen in Punycode mit Warnhinweis, 6; v0.6.1), dargestellt von `LetterText.svelte`.
- Texte über den Proxy `t` aus `web/src/lib/i18n.svelte.ts` (Sprache vor dem Login aus `localStorage` `posteulen.language`, danach aus dem Konto); `App.svelte` rendert beim Sprachwechsel neu. Fehlertexte über `errorMessage()` aus den Fehlercodes des Servers.
- CSP-Verträglichkeit: Svelte setzt Styles über das CSSOM; statische `style`-Attribute und `{@html}` verbietet Lint. Trusted Types mit den Policies `svelte-trusted-html` und `posteulen-sw` (nur `/sw.js`). Dynamische Größen (Balken, Karte) per CSSOM bzw. SVG-Attributen.
- Service Worker selbst geschrieben: cacht die App-Hülle (versioniert), Navigation „network first“, verarbeitet Push (Nutzlast `{id, type, lang}`, sichtbare Texte beider Sprachen beim Build eingesetzt) und bestätigt jeden Push per `push/ack`.
- Bilder: `web/scripts/build-images.ts` (`sharp`) erzeugt WebP 160/480 px, für Einblendungen und Heimkehr zusätzlich 960 px, Szenen (leere Stange, Gruppenbild, Verbrennen) in eigenen Größen, mit Hash im Namen; fehlende Originale → Platzhalter und Warnung. Einblendungen ohne Art (Verbrennen, v0.7) über `showSceneImage`. Kartendaten (`world.json`, Land/Wasser-Maske) als eigener Chunk, geladen erst mit einer Karte; die Projektion (Equal Earth) steht in `shared/src/map/projection.ts`. `MapView` hat seit v0.7 die Bereiche `world` (Kartenseite) und `europe` (Registrierung, Umzug).
- Uhrzeiten (v0.7.1): `time()` und `dateTime()` in `web/src/lib/format.ts` formatieren mit der Zeitzone des Wohnorts (`zoneAt`), ohne Anmeldung mit der des Geräts; „heute“ gilt ebenfalls am Wohnort. Restzeiten (v0.7.2) über `duration()`: unter 60 Minuten in Minuten (mindestens 1, aufgerundet), sonst in Stunden (aufgerundet); Texte `duration.minutes`/`duration.hours`.
- Einblendungen (v0.7.2): `web/src/lib/overlay.svelte.ts` hat eine Warteschlange (`queueOwlImage`); schließt sich eine Einblendung, folgt die nächste. Heimkehr: `live.svelte.ts` holt bei jedem `refreshAll` (Start, Login, Rückkehr in den Vordergrund) und beim SSE-Thema `homecomings` die Liste `GET /api/homecomings`, stellt jede noch nicht gezeigte Heimkehr in die Warteschlange (Tag/Nacht erst beim Anzeigen) und meldet sie mit `POST /api/homecomings/seen`. Bots im Adressbuch gibt es nicht mehr; „Alle Bots entfernen“ steht in `BotSettings.svelte`, das Entfernen eines einzelnen Bots in `Chat.svelte`.
- Antwort mit der Gast-Eule (v0.7.1): `web/src/lib/reply.svelte.ts` merkt sich für den nächsten Chat die gewählte Gast-Eule (`Compose` mit `guestOwl`).
- Begrüßung (v0.7): `Greeting.svelte` mit `zoneAt`, `localTime` und `dayPart` aus `shared/src/map/timezone.ts` (Daten `timezones-data.ts`, vom Kartenwerkzeug erzeugt).
- Gast-Eulen und Rast (v0.7): `GuestOwl.svelte` in der Eulenübersicht; Rast-Auswahl und Gast-Eule in `Compose.svelte`/`OwlChoice.svelte`.
- **v0.8, Kontrollzentrum (`bots/`):** `App.svelte` (Anmeldung, Pflichtwechsel, 12 Stunden Leerlauf über `setIdleTime`), `Overview.svelte`, `BotMap.svelte` (Weltkarte aus `world.json`, Equal Earth; Antippen wählt einen Ort), `ImportExport.svelte`, `BotPage.svelte` mit `PlannedEvents.svelte`/`EventForm.svelte`/`LetterPreview.svelte`, `PastEvents.svelte`, `BotSettingsForm.svelte`. Texte in `de.centre`/`en.centre`, Admin-Texte englisch in `en.admin` (bis v0.7.2 deutsch auch im englischen Teil).
- **v0.8, Spieler-App:** Bilder unter Bot-Briefen (`/api/bot-media/:id`), `Compose` mit `guestOnly` (nur die rastende Bot-Eule), `GuestOwl` ohne Pflege bei Bot-Eulen, `BotSettings` mit `botsDisabled`, Systemnachrichten `bot_owl_gift` und `bot_deleted`.
- Hilfe, Datenschutz, Impressum als strukturierte Daten (`help.ts`, `help-en.ts`, `legal.ts`, `legal-en.ts`), dargestellt von `TextPage.svelte`; `helpAsText(language)` ist die Wissensbasis des Erklärbärs.

### L.7 Betrieb auf Debian 13

| Pfad | Inhalt | Von Updates |
|---|---|---|
| `/opt/posteulen/repo` | partieller Bare-Klon (`--filter=blob:none`) des Repositorys | `git fetch --tags` |
| `/opt/posteulen/releases/<version>` | per `git archive` ausgepackt und gebaut | neu; die letzten 3 bleiben |
| `/opt/posteulen/current` | Symlink auf das aktive Release | umgeschaltet |
| `/opt/posteulen/state` | Zustand der Skripte (z. B. vorige Version für `--rollback`) | aktualisiert |
| `/var/lib/posteulen/posteulen.sqlite` | Datenbank (0700, Dienstbenutzer `posteulen`) | nur Migrationen |
| `/var/lib/posteulen/snapshots` | unverschlüsselte Momentaufnahme vor Updates (für Rückfall), 7 Tage | neu je Update |
| `/var/backups/posteulen` | `*.sqlite.age` täglich und vor Updates, 7 Tage; v0.8 zusätzlich `posteulen-bots-*.zip` (Bot-Export, unverschlüsselt, 0600), 7 Tage | nie überschrieben |
| `/etc/posteulen/secrets.json`, `backup.pub` | Geheimnisse, öffentlicher age-Schlüssel | nie (Ausnahme 4.4) |
| `/etc/posteulen/posteulen.conf`, `service.env`, `local/` | Domain, Repository, Testmodus; lokale Anpassungen (z. B. Admin-Freigabeliste, `admin-*.caddy`, v0.8 `bots-*.caddy`) | nur ergänzt bzw. nie |
| `/etc/caddy/Caddyfile`, systemd-Units, `/usr/local/sbin/posteulen-update`, `posteulen-cli` | erzeugt aus dem Release | neu erzeugt |

- **v0.8:** `sharp` ist Laufzeitabhängigkeit des Backends (Bilder der Bots, 10.11) und bleibt nach `npm prune --omit=dev` erhalten. Update und Installation rufen nach den Migrationen `posteulen-cli bots-init` auf (legt den Zugang nur an, wenn keiner existiert). Die Funktionsprüfung prüft `bots.<domain>` nur mit einer Warnung, und nur wenn die laufende Caddyfile diese Seite kennt (nach einem Rückfall auf eine ältere Version keine irreführende DNS-Warnung, v0.8.1, D-262). `backup.sh` schreibt nach der Datenbanksicherung den Bot-Export (`bots-export`, leichter Kontext ohne Worker, darf parallel zum Dienst laufen); scheitert er, bleibt die Sicherung gültig.
- Paketquellen: NodeSource `node_26.x` und Caddy (Cloudsmith), beide `signed-by` mit geprüftem Fingerabdruck (`deploy/lib.sh`); `unattended-upgrades` auch für diese Quellen.
- Update (`posteulen-update` → `update.sh`): Tag holen → Signatur und eingetragenen Tag-Namen prüfen (`verify_release_tag` in `deploy/lib.sh`, gegen `deploy/allowed_signers` der installierten Version; seit v0.6.1 Standard, abschaltbar nur mit `--no-verify-tags`; Tags haben Vorrang vor gleichnamigen Branches, `release_commit`) → `deploy/update-steps.sh` der neuen Version → `npm ci --ignore-scripts` und Build, während der alte Stand läuft → Sicherung (`VACUUM INTO` → age) und Momentaufnahme → Dienst stoppen → Migrationen → `current` umschalten, Units und Caddyfile neu → Start und Funktionsprüfung → bei Fehler automatischer Rückfall. Neueste Version nach SemVer (Vorabversionen vor der Version).
- Der Server startet nicht mit einem neueren Schema als seinem eigenen und nicht, wenn die Prüfsumme der Geheimnis-Datei nicht zur Datenbank passt (`posteulen-cli check`).
- Installation (`install.sh`): prüft die Signatur des zu installierenden Tags gegen `deploy/allowed_signers` des Klons und zeigt den Fingerabdruck (v0.6.1); `openssh-client` (für `ssh-keygen`) gehört zu den installierten Paketen.
- Build auf dem Server (v0.7): `build_release` setzt `FONTCONFIG_FILE` auf die minimale Konfiguration `deploy/fontconfig/fonts.conf`. Die Bildbibliothek initialisiert beim Umrechnen des SVG-Logos fontconfig; auf einem frischen Debian 13 fehlt `/etc/fonts/fonts.conf`, was die harmlose Meldung „Fontconfig error: Cannot load default config file: File not found“ ausgab. Schriften braucht der Build nicht.
- VM-Test (`npm run test:vm`, `deploy/test/`): offizielles Debian-13-Cloud-Image mit QEMU/KVM (Images unter `~/.cache/posteulen-vm`, nicht im Repository); Installation des vorigen Tags mit Testkonto und Brief, Update, zweiter Lauf, kaputtes Update mit Rückfall, `--rollback`, Wiederherstellung auf demselben Server und nach Totalausfall. Seit v0.6.1 signiert der Test seine Test-Tags mit einem eigenen Schlüssel (`~/.cache/posteulen-vm/vm_sign_key`) und prüft, dass ein unsigniertes und ein umbenanntes signiertes Tag abgelehnt werden. Seit v0.8 prüft er außerdem, dass der Zugang zum Kontrollzentrum angelegt ist, `bots.<domain>` antwortet, sein Passwort beim Update unverändert bleibt und die tägliche Sicherung eine Bot-ZIP-Datei (0600) enthält.

### L.8 Tests

- `npm test`: Lint (ESLint, Prettier), Typen (`tsc`, `svelte-check`), Vitest mit Abdeckung (je Datei in `shared/src` ≥ 90 % Zeilen; Zeitlimit je Test 20 s, weil viele Tests Argon2id rechnen), `npm audit` (Laufzeit: 0 Funde; Entwicklung: ab „hoch“ blockierend), `shellcheck` (nur SC1111 abgeschaltet: deutsche Anführungszeichen in Meldungen), Build, Playwright. `npm test -- --quick` ohne Build und E2E.
- Playwright startet zwei Vorschau-Instanzen (offen und geschlossen registrierbar) und läuft in zwei Profilen (Chromium-Desktop, WebKit-Handy; v0.7.1). Jeder Test schlägt bei fremder Anfrage, Konsolenfehler oder CSP-Verstoß fehl; ignoriert werden nur zwei bekannte Browser-Meldungen über abgebrochene gleiche-Origin-Anfragen (WebKit „access control checks“, Firefox „ServiceWorker intercepted …“ für `/assets/`).
- Web Push ist automatisch nur gegen einen nachgebildeten Push-Dienst geprüft; echte Zustellung (Mozilla, Google, Apple, UnifiedPush) wird auf Geräten geprüft.

### L.9 Bedrohungen und Maßnahmen

| Bedrohung | Maßnahmen |
|---|---|
| Datenbankdiebstahl | Briefe nur als Chiffrat; Schlüsselpaket hängt am `export_key`, der ohne OPRF-Schlüssel nicht berechenbar ist; Sitzungen nur als Hash; Einladungen, Namenssperren und Kontaktanfragen als HMAC; OpenAI-Key verschlüsselt; Backups mit age, privater Schlüssel nicht auf dem Server |
| Neugieriger Admin | keine Nutzerliste, keine Briefe, keine Änderungsfunktionen; kein Login in Nutzerkonten; nur aggregierte Statistik |
| Missbrauch des Kontrollzentrums (v0.8) | getrennter Origin, Port, Cookie, Passwort (OPAQUE) und Sitzungen; 12 Stunden Leerlauf; Pflichtwechsel des Erstpassworts; Reset nur per Konsole; zeigt keine Briefe, Namen oder Wohnorte von Spielern, nur Summen und Positionen von Bot-Eulen; Bilder werden neu kodiert (keine Metadaten, Pixel- und Größenlimit), ZIP-Import nur „stored“/„deflate“, ohne Verschlüsselung, Pfade ohne „..“, Anzahl- und Größenlimits, strenge Schemas; ein Import überschreibt nie und versendet nie Vergangenes |
| Passwort-Raten, Konto-Aufzählung | OPAQUE + Argon2id auf dem Gerät; Wartezeiten und ALTCHA je Name und IP/64 im Arbeitsspeicher (Lösung genau einmal, auch bei gleichzeitigen Anfragen; Wartezeit nach der Captcha-Prüfung erneut geprüft; Zählertabellen beim Überlauf nie ganz geleert; Captcha-Zähler aus dem CSPRNG); deterministische Fake-Credential-IDs; gleiche Antworten bei Kontaktanfragen |
| Sitzungsdiebstahl, CSRF | `__Host-`-Cookies (HttpOnly, Secure, SameSite=Strict), Einzel-Sitzung, Pflicht-Header, exakte Origin-Prüfung, kein CORS, getrennte Listener; Passwortwechsel beendet auch Live-Verbindungen; abgelaufene Sitzungen werden täglich gelöscht |
| XSS, Injection | strikte CSP mit Trusted Types, kein `{@html}`, Text nur als Text, nur http(s)-Links; strenge Schemas, parametrisierte SQL-Anweisungen, Größenlimits |
| SSRF | ausgehend nur OpenAI (feste URL) und Push-Endpunkte (HTTPS:443, eigener Präfixvergleich gegen private/reservierte IPv4/IPv6-Bereiche inkl. IPv4-mapped, -kompatibel und -übersetzt, Dokumentation, SRv6, Verbindung an die geprüfte IP, keine Weiterleitungen, Timeout, Größenlimit, Test-Push je Konto begrenzt) |
| Spielmanipulation | Server autoritativ, Vorbereitungs-Tokens einmalig, Buchungen atomar mit Deckungsprüfung |
| Täuschung | Signatur über Absender, Empfänger, Brief-ID, Sendezeitpunkt, Art und Pergament (alle mit den Server-Angaben verglichen; Brief muss zum Briefwechsel gehören); Tresor-Bindung, Schlüsselvergleich vor dem Senden und beim Anzeigen, Sicherheitsnummer, Versandsperre bei Schlüsselwechsel; abschließender Zeichensatz, Verwechslungsregeln und reservierte Namen in beiden Sprachen; verkleidete Link-Adressen in Punycode mit Warnhinweis |
| Lieferkette | exakte Versionen im Lockfile, neue Versionen erst ab 14 Tagen Alter, `npm ci --ignore-scripts`, `npm audit`, signierte APT-Quellen und signierte Release-Tags (seit v0.6.1 bei Installation und Update immer geprüft, inkl. Tag-Name) |
| Missbrauch des Servers | strenge Schemas und Größenlimits; Fehler, die Clients auslösen können, sind `400` statt `500` und füllen das Fehlerprotokoll nicht; gleiche Fehlermeldungen werden zusammengefasst; Rate-Limits je IP, Sitzung und (Push) Konto; Registrierung und Passwortwechsel speichern nur brauchbare Datensätze und Schlüssel |

### L.10 Festlegungen für Entwicklung und Veröffentlichung

- Der Code-Agent hat Push-Zugang nur über einen Deploy-Key für genau dieses Repository; **Tags signiert ausschließlich der Auftraggeber** mit seinem SSH-Schlüssel (öffentlicher Schlüssel in `deploy/allowed_signers`). Der Agent bereitet die Befehle vor und signiert nie selbst.
- Das Repository liegt auf dem Entwicklungsrechner im Nextcloud-Ordner; große erzeugte Ordner (`node_modules`, `dist`, `coverage`, `test-results`, VM-Images) gehören nicht ins Repository (`.gitignore`) und VM-Images nicht in den synchronisierten Ordner.
- Node.js und shellcheck für die Entwicklung liegen unter `~/.cache/posteulen-tools` (aus signierten Quellen).

---

## Anhang M – Änderungen in Version 0.6.0

Wartungsversion ohne neue Funktionen: gründliche Prüfung der App gegen diese Spezifikation, Korrekturlesen aller Texte, Prüfung der Spielmechanik und des Layouts, Aufräumen des Repositorys.

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Statusleiste | Auf Handys bis 26 rem steht „Neue Post!“ in einer eigenen Zeile; vorher schoben ein dreistelliger Goldstand und „Neue Post!“ Goldanzeige und Fähnchen bei 320–390 px aus dem Fenster | 8.3 |
| Layout | Lange Überschriften (Zierschrift) brechen um; Beschriftungen der unteren Leiste passen auf 320 px; neuer E2E-Test für acht Breiten in beiden Sprachen | 14, 17.4 |
| Namen | Englische Bot-Namen reserviert (explainer bear, system messages, unknown; v0.8 ohne die Verwandten-Bots) | 7.1 |
| Systemnachricht | „Das Konto von [Name] wurde gelöscht.“ statt „[Name] hat sein Konto gelöscht.“ (gilt auch bei automatischer Löschung, geschlechtsneutral) | 7.7 |
| Texte | Wohnort mit N/S und O/W statt Minuszeichen; Karte nennt „alle 5 Minuten“ (vorher fälschlich 10); Fehlermeldung „alle vier Leiheulen“ (vorher „drei“); „wieder fit ab …“/„erwachsen ab …“; Leckerli-Knopf mit Großbuchstaben; Hilfe ohne veraltete 10-Stunden-Schlafpause, mit „nicht lesbar“, Sprache in den Einstellungen; Datenschutz nennt den ausgeblendeten Benachrichtigungs-Hinweis im lokalen Speicher; viele kleine Korrekturen de/en | 8, 8.11 |
| Karte | Schlug das Laden der Land/Wasser-Maske einmal fehl (offline oder Seitenwechsel), blieb der Fehler bis zum Neuladen gespeichert; jetzt wird beim nächsten Tippen neu geladen | 12.3, 12.4 |
| Technik | Request-Größen als Konstanten (`SECURITY.MAX_LETTER_REQUEST_BYTES` 512 KiB, `MAX_BOT_LETTER_REQUEST_BYTES` 128 KiB); SPEC-Text 6 korrigiert (stand dort noch 128 KiB) | 6, Anhang A |
| Repository | Entfernt: Stufen-Screenshots (`docs/screenshots/`), `PROGRESS.md`, `SECURITY-REVIEW.md`, `ARCHITECTURE.md`, `DECISIONS.md` (Inhalt in Anhang L und N), Messseite `/messung`; `PROMPT.md` ist jetzt der Bauauftrag für den aktuellen Stand | 4.2, Anhang L |

---

## Anhang O – Änderungen in Version 0.6.1

Wartungsversion ohne neue Funktionen: Sicherheitsprüfung der App mit Schwerpunkt auf Kryptografie, Schutz der Nutzer und Briefinhalte sowie Schutz des Servers vor Angriffen und Missbrauch. Alle gefundenen Lücken sind geschlossen; jede hat einen eigenen Test (17.3, 17.4, 17.6).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Passwort-Raten | Mehrere gleichzeitige Anmeldeversuche mit einer Captcha-Lösung kamen alle durch, und die Wartezeit wurde erst danach gezählt; jetzt gilt eine Lösung genau einmal und die Wartezeit wird nach der Captcha-Prüfung erneut geprüft | 5.10 |
| Passwort-Raten | Liefen die Zählertabellen im Arbeitsspeicher voll (100 000 Einträge, z. B. mit vielen IPv6-Präfixen), wurden sie ganz geleert – samt den Zählern eines angegriffenen Kontos; jetzt wird gezielt Platz gemacht | 5.10, L.3 |
| Captcha | Geheimer ALTCHA-Zähler aus dem kryptografisch sicheren Zufallsgenerator statt `Math.random` | 5.10 |
| Anmeldung | Erfolgreiche Anmeldungen zählten beim IP-Zähler als Fehlversuch (geteilte Adressen bekamen nach 10 Anmeldungen ein Captcha); jetzt nimmt ein Erfolg den eigenen Fehlversuch zurück | 5.3 |
| Server | Formal gültige, aber kryptografisch kaputte OPAQUE-Nachrichten (Login, Registrierung, Passwortwechsel, Admin) und nicht dekodierbare Base64-Längen führten zu `500` und einem Eintrag im Fehlerprotokoll – auslösbar ohne Konto; jetzt `400` ohne Eintrag | 5.3, 6 |
| Konten | Der Server speichert Registrierungsdatensätze nur, wenn eine Anmeldung damit möglich ist, und öffentliche Schlüssel nur, wenn sie gültig sind (Ed25519-Punkt, X25519 nicht von kleiner Ordnung); ein abgelehnter Datensatz verbraucht das Wechsel-Token nicht | 5.2, 5.6 |
| Sitzungen | Passwortwechsel beendet auch die Live-Verbindungen der beendeten Sitzungen; abgelaufene Sitzungen (Nutzer 30 Tage, Admin damals 8 Stunden, seit v0.7 10 Minuten) werden täglich gelöscht statt erst beim nächsten Login | 5.6, 4.5 |
| Browser | Nach dem Abmelden blieb der entschlüsselte Kontakt-Tresor im Arbeitsspeicher und wurde bei einer Anmeldung mit einem anderen Konto im selben Tab weiterbenutzt; jetzt werden Tresor und Listen geleert und verspätete Antworten verworfen | 5.5, L.6 |
| Schlüsselbindung | Schlüsselvergleich jetzt auch beim Anzeigen empfangener Briefe (beim Öffnen des Briefwechsels), wie 5.7 es verlangt; zusätzlich prüft der Browser den signierten Sendezeitpunkt und dass ein Brief zum geöffneten Briefwechsel gehört | 5.7, 5.8 |
| Täuschung | Links mit Nicht-ASCII-Zeichen oder Zugangsdaten im Host erscheinen in Punycode mit Warnhinweis | 6 |
| SSRF | Sperrliste ergänzt: IPv4-kompatible (`::/96`) und IPv4-übersetzte (`::ffff:0:0:0/96`) IPv6-Adressen, Dokumentation `3fff::/20`, SRv6 `5f00::/16` | 11.3 |
| Missbrauch | Push-Abo und Test-Push höchstens 10-mal pro Stunde und Konto; gleiche Meldungen im Fehlerprotokoll werden zusammengefasst (Zähler, letztes Auftreten; Migration `0013_v061.sql`) | 11.4, 13 |
| Lieferkette | Installation und Update prüfen die Tag-Signatur standardmäßig (auch den eingetragenen Tag-Namen), abschaltbar nur mit `--no-verify-tags`; der VM-Test signiert mit eigenem Testschlüssel und prüft die Ablehnung unsignierter Tags | 16.1–16.3, 17.6 |
| Lokale Vorschau | Pfadprüfung des Vorschau-Servers verschärft (Geschwisterordner wie `dist-x` galten als innerhalb), fehlerhafte URL-Kodierung ergibt `400` | L.1 |
| Tests | Neue Unit- und E2E-Tests für jede Lücke; Zeitlimit je Unit-Test 20 s | 17, L.8 |

---

## Anhang P – Änderungen in Version 0.7.0

Funktionsversion: Rast beim Empfänger mit Antwort, Motivation je Etappe, Weltkarte, Begrüßung, Gutscheine und viele kleine Verbesserungen. Migration `0014_v07.sql` (Tabelle `vouchers`).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Briefe | Rast bei jedem Empfänger wählbar (gar nicht, 1, 2, 24, 48 h; Standard 1 h); Erholung wie zu Hause; der Gastgeber sieht die Eule als Gast, darf sie pflegen und ihr eine Antwort an den Absender mitgeben (dann fliegt sie sofort los); Leiheulen mit Antwort bringen sie noch zum Absender; Heimkehr-Nachricht und Push nennen mitgebrachte Briefe | 8.4, 8.5, 9.4.2, 9.5, 11.2 |
| Motivation | wirkt nur auf die nächste Etappe, bei jedem Abflug von einem Empfänger neu; Anzeige in Prozent (80–120 %); Pläne in eigener Energie (`ownUnits`) | 9.3a, 8.5, L.3 |
| Karte | ganze Welt (Equal Earth, Mittelmeridian 10° O), außerhalb Westeuropas nur Grenzen und Hauptstädte; Registrierung und Umzug bleiben im Westeuropa-Ausschnitt; automatischer Zoom ohne Bots | 12 |
| Übersicht | Begrüßung nach der Tageszeit am fiktiven Wohnort (Zeitzone des Landes, mit Sommerzeit) | 8.3 |
| Gold | tägliches Gold um 03:00 UTC (vorher 15:00); der Goldstand der Statusleiste folgt sofort | 9.1.1, 4.5 |
| Gutscheine | Adminpanel erzeugt Gutscheine für Gold oder eine Eule (einmal einlösbar, 90 Tage); Einlösen in den Einstellungen; nicht in der Update-Nachricht | 13, 8.10 |
| Adminpanel | Anmeldung verfällt nach 10 Minuten ohne Aktivität (vorher 8 Stunden) | 13 |
| Briefwechsel | gesendete Briefe nennen die überbringende Eule (mit Leiheule bzw. Eule von …); „Alle Briefe verbrennen“ statt „Chat löschen“ mit Kaminbild; Chats öffnen beim ältesten ungelesenen Brief; Systemnachricht über wegen der Löschfrist gelöschte Briefe | 8.4, 8.4.1 |
| Bilder | Brüten-Bild je Art (17 neue Dateien), Bild „Verbrennen“; Heimkehr-Bild nur noch als Einblendung – vorher erschien es nur im Systemchat, nie bei „Neuigkeiten“ oder bei offener App (Fehler) | 9.2.6, Anhang B |
| Eulen | „Schläft auf dem Weg zu …“ bzw. „Schläft auf dem Heimweg“ statt „Fliegt gerade …“, solange die Eule schläft; Geschlecht schon im Namensdialog | 8.5, 9.2.3 |
| Menagerie | Arten und Namen der Leiheulen wiederholen sich an den zwei Folgetagen nicht | 9.6 |
| Einstellungen | aktueller Nutzername sichtbar; Gutschein einlösen | 8.10 |
| Startseite | Anmelde-Box und Gruppenbild gleich groß; alle Fußzeilen-Links in derselben Farbe | 8.1 |
| Betrieb | minimale fontconfig-Konfiguration beim Build (keine Meldung „Fontconfig error“ mehr) | 16, L.7 |
| Doku | README: Hinweis, dass man PostEulen mit `PROMPT.md`, `SPEC.md` und `images/` selbst neu bauen kann | 16.4 |
| Tests | neue Unit-Tests (Rast, Antworten, Motivation je Etappe, Gutscheine, Leiheulen-Sperre, Löschfrist-Nachricht, Zahltag 03:00, Zeitzonen, Projektion) und E2E-Tests (Begrüßung, Rast mit Antwort, Verbrennen, Weltkarte, Startseite, Gutschein im Adminpanel); VM-Test: die installierte Vorversion vertraut für das Update auf die Test-Tags dem Testschlüssel (seit 0.6.1 prüft schon sie Signaturen) | 17, 17.6, L.8 |

---

## Anhang Q – Änderungen in Version 0.7.1

Pflegeversion nach dem großen Update 0.7.0. Migration `0015_v071.sql` (Tabelle `feedback`, Spalte `users.feedback_sent_on`).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Uhrzeiten | alle Uhrzeiten der App in der Ortszeit des fiktiven Wohnorts (vorher Ortszeit des Geräts, z. B. „Rastet bei … bis 20:41“ in UTC auf einem Gerät mit UTC) | 0, L.6 |
| Rast | „Antwort … mitgeben“ öffnet den Chat mit genau dieser Gast-Eule, ohne andere Eulen und ohne Rast-Auswahl | 8.4 |
| Menagerie | Bestätigungsdialog vor jedem Kauf | 8.7 |
| Einstellungen | Nachricht an den Admin (300 Zeichen, eine pro UTC-Tag, unverschlüsselt, ohne Absender, 90 Tage); fehlender Abstand nach „Gutschein einlösen“ | 8.10 |
| Adminpanel | „Nachrichten der Nutzer“ als letzter Punkt; fehlender Abstand nach „Gutscheine“ | 13 |
| Karte | „Ansicht zurücksetzen“ statt „Ganze Karte“: zurück zur Ansicht beim Öffnen | 12.1 |
| Wohnort | Hinweis „Überlege sorgfältig, ob du deine echte Adresse wählen möchtest.“ | 7.3, 12.4 |
| Texte | FAQ „Kann ich einen Brief zurückholen?“ nennt „Alle Briefe verbrennen“ (stand noch „Chat löschen“); neue FAQ zur Nachricht an den Admin; Datenschutzerklärung nennt die Nachrichten | 8.11 |
| Tests | schlanker Ablauf: gezielt während der Entwicklung, `npm test` einmal am Ende; E2E in zwei statt vier Profilen; Layout in vier statt acht Breiten; Screenshot-Rundgang nur auf Anfrage; neue Tests für die Änderungen | 17, L.8 |

---

## Anhang R – Änderungen in Version 0.7.2

Pflegeversion. Migration `0016_v072.sql` (Spalte `users.bots_created`, Tabelle `homecomings`, Neuberechnung der Ungelesen-Zähler).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Briefwechsel | Fehler behoben: Nach „Alle Briefe verbrennen“ (oder dem Entfernen eines Bots und erneutem Schreiben) kamen Briefe, die gerade unterwegs waren, unsichtbar an und zählten trotzdem als ungelesen; jetzt bleiben unterwegs befindliche Briefe vom Verbrennen unberührt, Zähler werden einmalig neu berechnet | 8.4 |
| Bots | nicht mehr im Adressbuch, nur im Briefwechsel und auf der Karte; „[Name] entfernen“ im Chat des Bots; „Alle Bots entfernen“ in den Einstellungen (inkl. Erklärbär, unwiderruflich); Fehler behoben: Konten ohne Bots bekamen beim Neustart alle drei neu | 8.8, 8.10, 10.1 |
| Heimkehr | keine Systemnachricht mehr, nur noch Einblendung mit Bild (Tag/Nacht) – jedes Mal, sofort oder beim nächsten Öffnen bzw. Einloggen; mehrere Heimkehrer nacheinander | 8.4, 9.2.6, Anhang C |
| Zeiten | Rest- und Flugzeiten unter einer Stunde in Minuten („in 40 Min.“) statt „in 1 Std.“ | 8.5, 8.8, L.6 |
| Eulen | Geschlechterverteilung geprüft: gleich verteilt (49,99 % weiblich in 200 000 Würfen); Häufungen waren Zufall; neuer Test | 9.2.3 |

---

## Anhang S – Export- und Importformat der Bots (v0.8)

**Datei:** ZIP (Verfahren „stored“ oder „deflate“, UTF-8-Namen, ohne Verschlüsselung, ohne ZIP64) mit
- `bots.json` – die Beschreibung (UTF-8, JSON),
- `media/<Bild-ID>.webp` – die Bilder (normalisiertes WebP, 10.11).

Höchstens 64 MB und 2 000 Dateien; Pfade mit „..“, absolute Pfade und Backslashes werden abgelehnt. Geschrieben wird ohne Abhängigkeiten (`backend/src/central/zip.ts`, Deflate und CRC-32 aus `node:zlib`) mit festem Zeitstempel 1980-01-01, damit gleiche Inhalte gleiche Dateien ergeben.

**`bots.json`** (geprüft mit `ExportFile` in `shared/src/schemas/bots.ts`):

```json
{
  "format": "posteulen-bots",
  "version": 1,
  "exportedAt": "2026-11-09T12:00:00.000Z",
  "bots": [
    {
      "id": "<22 Zeichen base64url>",
      "name": "Kapitän Ahoi",
      "state": "draft | active | paused",
      "character": "Charakter und Hintergrund …",
      "home": { "lat": 48.86, "lon": 2.35 },
      "owl": {
        "mode": "own | loan",
        "species": "waldkauz",
        "name": "Möwe",
        "sex": "f | m",
        "motivation": 200,
        "restHours": 24,
        "playerOwls": false
      },
      "complete": true,
      "events": [
        {
          "id": "<22 Zeichen base64url>",
          "dueAt": "2026-12-01T18:00:00.000Z",
          "status": "planned | running | archived | skipped",
          "move": { "lat": 40.7, "lon": -74.0 },
          "letter": {
            "parchment": "small | large",
            "owlMode": "default | own | loan",
            "texts": {
              "de": { "first": "…", "follow": "…" },
              "en": { "first": "…", "follow": "…" }
            },
            "media": ["<Bild-ID>"]
          },
          "gift": { "gold": 25 },
          "context": "Hintergrund für die KI …",
          "archive": {
            "startedAt": "…", "archivedAt": "…",
            "recipients": 120, "sent": 118, "delivered": 117, "read": 80, "replies": 12
          }
        }
      ]
    }
  ],
  "media": [
    { "id": "<Bild-ID>", "bot": "<Bot-ID>", "file": "media/<Bild-ID>.webp",
      "sha256": "<64 Hex>", "width": 1600, "height": 1067 }
  ]
}
```

- Feldregeln wie im Kontrollzentrum: Name nach 7.1, Koordinaten in Grad, `motivation` in Zehnteln (5–200), `restHours` 0–168, `gift` entweder `{ "gold": <Zehntel 1–1000> }` oder `{ "species": "<Art>" }` oder `null`, `move`/`letter`/`gift` je `null`, wenn nicht vorhanden; `archive` ist `null` bei geplanten Events. Zeitpunkte als ISO-8601 in UTC.
- `complete: false` kennzeichnet einen Teil-Export (einzelne Events eines Bots); er enthält nur die Bilder dieser Events.
- **Nie enthalten:** Briefe, Namen, IDs oder Wohnorte von Spielern, Zusammenfassungen, Zustellungen, Tageszähler.
- **Import** (Vorschau zuerst, dann Übernahme in einer Transaktion):
  - Bot-ID vorhanden → **ergänzen**: nur neue Events, die Einstellungen des vorhandenen Bots bleiben unverändert.
  - Bot-ID neu, Name frei → neuer Bot als **Entwurf** (unabhängig vom `state` der Datei).
  - Bot-ID neu, Name vergeben (Bot oder Konto) oder ungültig → **Konflikt**: Bot samt Events wird übersprungen und in der Vorschau genannt.
  - Optional **Ziel-Bot**: alle Events der Datei werden diesem vorhandenen Bot hinzugefügt (z. B. einzelne Aktionen eines anderen Bots übernehmen); seine Einstellungen bleiben.
  - Event-ID schon vorhanden (bei irgendeinem Bot) oder doppelt in der Datei → übersprungen.
  - Geplantes Event mit Zeitpunkt in der Zukunft → wird geplant; vergangene oder schon gelaufene Events → ins **Archiv** (`archived` mit den Zahlen aus `archive`, sonst `skipped`), **nie versendet**.
  - Bilder: je Ziel-Bot einmal (gleicher SHA-256 → vorhandenes Bild), ihre IDs in den Events werden passend umgeschrieben; Prüfsummen werden geprüft.
- **Wiederherstellung** nach einem Totalausfall: Datenbank aus der verschlüsselten Sicherung zurückspielen (16.4) – darin sind auch die Bots samt Bildern; nur wenn die Bots auf einen anderen Server sollen oder die Datenbank verloren ist: die tägliche Bot-ZIP-Datei im Kontrollzentrum importieren oder `sudo -u posteulen posteulen-cli bots-import --file <zip> --apply` (ohne `--apply` nur Vorschau), danach die Bots prüfen und aktivieren.

---

## Anhang T – Abbau der Verwandten-Bots (v0.8)

Bis v0.7.2 hatte jedes Konto zusätzlich zum Erklärbär zwei Verwandten-Bots (Typen `aunt` und `uncle` in der Tabelle `bots`), mit festen Briefen und einmaligen Goldgeschenken. Seit v0.8 gibt es sie nicht mehr – im Programm, in der Datenbank, in den Aufträgen, in den Texten und in der gültigen Dokumentation; frühere Git-Versionen bleiben unangetastet, bestehende Sicherungen unterliegen ihrer bisherigen Aufbewahrung (7 Tage).

- **Bei jedem Start** (`removeRelatives`, `backend/src/bots/relatives.ts`, vor dem Worker, idempotent, in einer Transaktion) – damit die Bereinigung auch nach einem Rückfall auf eine ältere Version und einem erneuten Update wieder greift:
  - jeder solche Bot wird wie beim Entfernen durch den Spieler beseitigt (10.1): eigene Eulen des Spielers auf dem Weg zu ihm kehren mit dem Brief um; Briefe von und an ihn (auch unterwegs), Chats, Zusammenfassungen, Lieferungen, Antwortaufträge und geplante Briefe verschwinden;
  - ihre Buchungen (`aunt_gift`, `uncle_inheritance`) und die Systemnachrichten über ihr Gold werden gelöscht; aus Nachrichten über gelöschte alte Briefe verschwindet ihr Name;
  - geplante Goldsendungen (`bot_gold`) und erste Briefe (`…:first`) werden aus der Warteschlange gelöscht;
  - **das Gold**, das Spieler schon bekommen haben, **bleibt** (D-242);
  - eigene Eulen auf dem Weg zu ihnen kehren um, **ohne** die übliche Systemnachricht „nicht zugestellt – die Eule ist umgekehrt“ (sie würde den Bot nennen); Namen früherer Bot-Typen werden nirgends mehr gebildet (`displayName` liefert für sie keinen Namen, v0.8.1);
  - **scheitert** der Abbau, startet der Server trotzdem: Eintrag im Fehlerprotokoll, neuer Versuch beim nächsten Start (eine Transaktion, also nie halb, v0.8.1, D-261).
- Die Migration 0017 legt einen Trigger an, der neue Zeilen in `bots` außer `explainer` ablehnt, und setzt `users.bots_disabled` für Konten, die bis v0.7.2 alle Bots entfernt hatten.
- Code, Namenslisten (früher Anhang E), Texte, Hilfe, Erklärbär-Wissen und alte Update-Nachrichten nennen sie nicht mehr. Die Update-Nachricht zu 0.8 verabschiedet sie ohne Namen („Zwei langjährige Brieffreunde …“).

---

## Anhang U – Änderungen in Version 0.8.0

Große Version: zentrale Bots mit Bots-Kontrollzentrum. Migration `0017_v080.sql` (Schema 17).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Bots | zentrale Bots mit einer Identität, Persönlichkeit, Konfiguration und Eventplanung; je Spieler isolierter Briefwechsel, Gedächtnis und Zustellstatus; Zustände Entwurf/aktiv/pausiert | 10.1, 10.3, 10.4 |
| Kontrollzentrum | neue Website `bots.<domain>` mit eigenem Zugang (Passwort, Cookie, Sitzungen, 12 Stunden), Übersicht mit Statistik und Karte, Seite je Bot mit geplanten Events, Archiv und Einstellungen, Vorschau, KI-Test, Export/Import | 4.3, 10.12 |
| Events | Umzug, Brief (vier Fassungen, zwei Bilder), Gold- oder Eulengeschenk, Kontext; einmalig, stabile IDs, kein Brief doppelt, Archiv | 10.8 |
| Antworten | KI passt den nächsten geplanten Brief an (Original verbindlich); spontane Antwort nur ohne Brief-Event in 4 Wochen; Bearbeitungsstatus der Spielerbriefe; ohne KI geht der geplante Brief unverändert | 10.9 |
| Eulen | gleiche Flugmechanik wie Spielereulen, eine Instanz je Spieler, Motivation 0,5–20, Rast 0–168 h, nächster Brief wartet auf die eigene Bot-Eule, Antwort mit der rastenden Eule, keine Pflege | 10.7 |
| Karte | Bots wohnen weltweit auf Land; grobe Weltmaske 0,1° für Wohnorte und Schlaf außerhalb Europas | 12.3 |
| Bilder | JPEG/PNG/WebP bis 2 MB, normalisiert zu WebP ohne Metadaten, einmal gespeichert, nur verlinkt | 10.11 |
| Spieler | Bots erscheinen erst mit dem ersten Brief (Erklärbär ausgenommen); ein Brief pro Kalendertag an jeden Bot; „Alle Bots entfernen“ hält auch künftige Bots fern; Systemnachricht beim Löschen eines Bots an Spieler mit Kontakt | 10.1, 8.10 |
| KI | eigenes Kontingent für den Erklärbär (Standard 200) und eines für alle anderen Bots (Standard 500); Erklärbär höchstens 500 Zeichen, andere Bots ohne feste Grenze | 10.5, 13 |
| Abbau | Tante und Onkel restlos entfernt (bei jedem Start), Gold bleibt, Buchungen und Nachrichten weg | Anhang T |
| Adminpanel | Deutsch oder Englisch umschaltbar; zwei KI-Tageslimits | 13 |
| Betrieb | dritte API (Port 3003) und Caddy-Seite; `bots-init`/`bots-reset`, `bots-export`/`bots-import`; Erstpasswort einmalig bei Installation bzw. erstem Update; tägliche unverschlüsselte Bot-ZIP in `/var/backups/posteulen/`; `sharp` als Laufzeitabhängigkeit | 16, L.7 |
| Sicherheit | getrennter Zugang und Origin, strenge Schemas, Rohdaten nur mit Content-Type und Größenlimit, Bild-Neukodierung, strenger ZIP-Leser | 10.12, L.9 |
| Tests | `backend/test/v080.test.ts`, `shared/test/worldmask.test.ts`, `e2e/v080.spec.ts`, Barrierefreiheit des Kontrollzentrums, VM-Test mit Kontrollzentrum | 17, L.7 |

---

## Anhang V – Änderungen in Version 0.8.1

Korrektur nach dem ersten Update eines echten Servers auf 0.8.0, das automatisch zurückgerollt wurde. Keine Migration (Schema 17).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Start | Der Server stürzte beim Start ab, wenn eine eigene Eule eines Spielers gerade zu Tante oder Onkel unterwegs war: Beim Abbau (Anhang T) kehrte sie um, und die Umkehr-Nachricht wollte den Namen des Bots über die Titeltabelle bilden, in der es diese Typen nicht mehr gibt (`Cannot read properties of undefined (reading 'replace')`). Jetzt: Umkehr ohne Systemnachricht, Namensbildung robust, und ein Fehler beim Abbau verhindert den Start nie (Fehlerprotokoll, neuer Versuch beim nächsten Start) | Anhang T |
| Betrieb | Keine DNS-Warnung zu `bots.<domain>` mehr nach einem Rückfall auf eine Version ohne Kontrollzentrum | 16.2, L.7 |
| Tests | `backend/test/v080.test.ts` stellt die Lage nach (eigene Eule unterwegs zur Tante); der Brief-E2E-Test wartet auf die berechnete Sicherheitsnummer | 17 |

---

## Anhang W – Änderungen in Version 0.8.2

Pflegeversion. Migration `0018_v082.sql` (Schema 18: Spalte `users.links_clickable`, Tabelle `banners`).

| Bereich | Änderung | Abschnitt |
|---|---|---|
| Betrieb | Firewall bei jeder Installation und jedem Update für IPv4 und IPv6; Adressprüfung: jeder Hostname über jede eigene IPv4-/IPv6-Adresse mit gültigem Zertifikat, Abgleich mit A/AAAA, einmal Caddy neu laden, sonst Warnung (kein Rückfall) | 16.2, 16.3, L.7 |
| Briefwechsel | Sortierung nach Kenntniszeitpunkt des Betrachters (eigene nach Sendezeit, empfangene nach Ankunft); beim Öffnen alle Ankunftsbilder neuer Eulen nacheinander | 8.4, 9.2.6 |
| Briefwechsel | keine Lesebestätigung mehr (kein „gelesen“, kein ✔✔), nur „zugestellt“ | 8.4 |
| Briefwechsel | nicht lesbare Briefe: Absender „Die Eule hat den Brief unterwegs verloren.“, Empfänger „… so nass geworden …“; Grund an den Server, konkrete Ursache im Fehlerprotokoll | 5.8, 8.4, 13 |
| Rast | Systemnachricht und eigener Push, wenn eine fremde Eule beim Nutzer rastet (mit Ende der Rast); „Weiterfliegen lassen“ schickt sie ohne Brief vorzeitig weiter | 8.4, 8.5, 11.2, Anhang C |
| Kleinigkeiten | Kontaktname ohne Leerzeichen am Anfang/Ende; kein „Fliegt nicht zurück.“ bei Leiheulen in der Eulenwahl; Regler „Links in Briefen anklickbar“ | 8.4, 8.8, 8.10 |
| Adminpanel | zeitlich befristete Banner für alle Konten (de/en, ausblendbar) | 13 |
| Doku | eine gültige Sitzung je Konto als Sicherheitsmerkmal in Hilfe und README | 5.5 |
| Tests | `backend/test/v082.test.ts`; angepasste Brief-Tests ohne Lesebestätigung; VM-Test prüft IPv6-Firewall und Adressprüfung | 17, 17.6 |

---

## Anhang N – Entscheidungsprotokoll ab v0.6

Neue Entscheidungen, die diese Spezifikation offenlässt, stehen hier (Nummer, Datum, Entscheidung, Begründung, verworfene Alternativen). Die Einträge D-01 bis D-161 bis v0.5.1 sind in die Abschnitte und in Anhang L eingearbeitet; das vollständige alte Protokoll liegt in der Git-Historie (`DECISIONS.md` am Tag `v0.5.1`).

| Nr. | Datum | Entscheidung | Begründung | Verworfen |
|---|---|---|---|---|
| D-162 | 2026-11-07 | Doku im Repository auf `SPEC.md`, `PROMPT.md`, `README.md`/`README.en.md`, `CHANGELOG.md`, `DEPENDENCIES.md` beschränkt; Architektur und Entscheidungen in die SPEC (Anhang L, N) | Wunsch des Auftraggebers: nur Nötiges im öffentlichen Repository, eine Quelle der Wahrheit | Doku-Dateien behalten |
| D-163 | 2026-11-07 | Git-Historie nicht umgeschrieben; gelöschte Dateien bleiben in alten Commits | signierte Tags v0.1.0–v0.5.1 und Server-Klone bleiben gültig; Server klonen ohnehin partiell | Historie bereinigen (alle Tags neu signieren, Force-Push) |
| D-164 | 2026-11-07 | Eulenbilder bleiben als Originale (1 254 px PNG) in `images/` | Quelle für den Build; Verkleinern würde das Repository insgesamt vergrößern | auf 960 px verkleinern |
| D-165 | 2026-11-07 | Englische Bot-Namen reserviert, bestehende Konten mit solchen Namen bleiben unverändert | Schutz vor Täuschung in der englischen Ansicht (3, 7.1); Umbenennen fremder Konten wäre ein Eingriff | Bestandskonten umbenennen |
| D-166 | 2026-11-07 | „Neue Post!“ bis 26 rem in eigener Zeile statt kleinerer Schrift | einziger Weg, der bei 320 px mit dreistelligem Goldstand ohne Überlauf auskommt; Touch-Ziel bleibt 44 px | Version ausblenden, Schrift verkleinern |
| D-167 | 2026-11-07 | Transferprüfung (Rest > 10,0) ohne die Leihgebühr einer erst beim Absenden geliehenen Eule | 9.1.4 spricht von der Überweisung; die Leihgebühr ist eine eigene Buchung mit eigener Deckungsprüfung | Leihgebühr in die Restprüfung einrechnen |
| D-168 | 2026-11-07 | Der E2E-Wächter ignoriert in WebKit die Meldung „… due to access control checks“ jetzt auch für eigene `/assets/`-Dateien (vorher nur `/api/`) | gleiche Ursache wie bei der API: WebKit meldet beim Seitenwechsel abgebrochene gleiche-Origin-Downloads so; gleiche-Origin-Anfragen können CORS nicht verletzen | Test gezielt verlangsamen |
| D-169 | 2026-11-08 | Installation und Update prüfen Tag-Signaturen standardmäßig; `--no-verify-tags` schaltet das ausdrücklich ab; geprüft wird auch der im Tag eingetragene Name | Wunsch des Auftraggebers; schützt vor einem übernommenen Repository-Konto (Code läuft als root); ohne Namensprüfung ließe sich ein altes, echt signiertes Tag als neue Version unterschieben | weiterhin optional; optional mit Warnung |
| D-170 | 2026-11-08 | Das Update auf 0.6.1 selbst läuft noch mit dem Skript von 0.6.0 (dort `--verify-tags` von Hand); die neue Prüfung gilt ab dem Stand 0.6.1 | `posteulen-update` ist das Skript der installierten Version | Update-Skript von außen nachladen |
| D-171 | 2026-11-08 | Verkleidete Link-Adressen (Nicht-ASCII im Host oder Zugangsdaten vor dem Host) zeigen die technische Form der tatsächlichen Adresse mit Warnhinweis; auch echte internationale Domains | Wunsch des Auftraggebers (Punycode + Warnhinweis); Zugangsdaten vor dem Host sind dieselbe Täuschung | nur Punycode; unverändert; nur gemischte Schriften markieren |
| D-172 | 2026-11-08 | Gleiche Meldungen im Fehlerprotokoll innerhalb einer Stunde nach dem letzten Auftreten zählen einen Eintrag hoch (gleitend), der dann wieder ungelesen ist; Aufbewahrung ab dem letzten Auftreten | Wunsch des Auftraggebers (mit Zähler); ein dauerhaft wiederkehrender Fehler bleibt sichtbar, füllt aber die Datenbank nicht | nur einmal pro Stunde ohne Zähler; nur Grenzwerte |
| D-173 | 2026-11-08 | Beim IP-Zähler nimmt ein erfolgreicher Login genau den Fehlversuch zurück, den sein Start gezählt hat (kein Zurücksetzen) | geteilte Adressen werden nicht mehr bestraft; ein Angreifer mit eigenem Konto kann so keine Fehlversuche anderer Namen löschen | Zähler je IP bei Erfolg zurücksetzen; IP-Zähler nur bei Fehlschlag am Ende zählen (verriete unbekannte Namen) |
| D-174 | 2026-11-08 | Volle Zählertabellen: erst vergessene, dann Zähler unter der Captcha-Schwelle, zuletzt die am längsten nicht gezählten (10 % auf einmal) entfernen | wer nur frische Schlüssel flutet, verdrängt keine Zähler, die jemanden bremsen | ganz leeren (bisher); neue Schlüssel ablehnen (dann ungezählt) |
| D-175 | 2026-11-08 | Eine Captcha-Lösung gilt als „in Prüfung“, solange sie geprüft wird; gespeichert werden nur bestätigte Lösungen | gleichzeitige Wiederverwendung ausgeschlossen, gefälschte Signaturen können die Liste nicht füllen | jede eingereichte Signatur sofort speichern |
| D-176 | 2026-11-08 | Ungültige OPAQUE-Nachrichten zählen beim Login als Fehlversuch (Zählen vor dem Bibliotheksaufruf) | wer sie schickt, soll dafür nicht schneller raten dürfen; für bekannte und unbekannte Namen gleich | nicht zählen |
| D-177 | 2026-11-08 | Registrierungsdatensatz wird per Probe-Login (fester, gültiger Client-Request) geprüft; öffentliche Schlüssel mit libsodium (`crypto_core_ed25519_is_valid_point`, `crypto_scalarmult`) | die Bibliothek hat keine eigene Prüffunktion; libsodium ist schon im Server | ungeprüft speichern (bisher) |
| D-178 | 2026-11-08 | Messung: 60 000 ungültige `startLogin`-Aufrufe an `@serenity-kit/opaque` 1.1.0 lassen den Prozess um etwa 20 MB wachsen und brechen die Instanz nicht (das in `DEPENDENCIES.md` genannte Leck betrifft andere Eingaben) | Prüfung des Hinweises zu 1.1.1 | – |
| D-179 | 2026-11-08 | Schlüsselvergleich beim Anzeigen: beim Öffnen eines Briefwechsels mit einem gebundenen Kontakt einmal je Besuch der App | erfüllt 5.7 mit einer zusätzlichen Anfrage je Kontakt statt je Neuladen | bei jedem Laden des Chats; beim Abgleich aller Kontakte |
| D-180 | 2026-11-08 | Der signierte Sendezeitpunkt muss gleich dem des Servers sein | der Server vergibt ihn und der Absender signiert genau diesen; bestehende Briefe erfüllen das | nur Brief-ID, Absender, Art, Pergament (bisher) |
| D-181 | 2026-11-08 | Push-Abo und Test-Push zusammen 10-mal je Stunde und Konto | ein Test dauert 60 s; großzügig für Menschen, bremst Endpunkte, die dauerhaft ablehnen | je IP allein (bisher) |
| D-182 | 2026-11-08 | Unit-Tests mit 20 s Zeitlimit | viele Tests rechnen mehrfach Argon2id; unter voller Parallel-Last lagen einzelne knapp über 5 s | einzelne Tests verlangsamen |
| D-183 | 2026-11-08 | Die Logik der Link-Erkennung liegt in `shared/src/links.ts` (vorher `web/src/lib/format.ts`) | dort mit Vitest und Abdeckungsregel testbar | E2E allein |
| D-184 | 2026-11-08 | Rast: eine Dauer für alle Empfänger eines Briefs, vorgewählt 1 Stunde; nur bei Briefen an Menschen (nicht Bots, Gold, Geschenke, Küken) | Wunsch des Auftraggebers (Standard 1 h, damit die Funktion sichtbar ist); Gold- und Geschenkflüge haben keinen Grund zu rasten | Standard „Gar nicht“; Rast auch bei Gold; Dauer je Empfänger |
| D-185 | 2026-11-08 | Der Gastgeber darf alle vier Pflege-Aktionen, zahlt Keks und Leckerli selbst; sie zählen für Motivation und Pflegetage der Eule; der Halter kann währenddessen nicht pflegen | Wunsch des Auftraggebers (Anreiz, eine rastende Eule zu pflegen) | nur kostenlose Pflege; keine Pflege |
| D-186 | 2026-11-08 | Rast im Flugplan als Segmentart `rest`, Station `resting` mit `restUntil` und Ereignis `flight_rest_end`; die Eule bleibt im Zustand `flying` | kein Neuaufbau der Tabelle `owls` für eine neue CHECK-Liste; Karte, Energie und Neuplanung funktionieren ohne Sonderwege | neuer Eulenzustand `resting` |
| D-187 | 2026-11-08 | Motivation je Etappe durch Neuplanung bei jedem Abflug von einer Station; Pläne speichern die eigene Energie (`profile.ownUnits`); Flüge von vor v0.7 behalten die alte Regel; Vorschau rechnet alle Etappen mit der aktuellen Motivation | einfache, nachvollziehbare Umsetzung; Vorschauen sind ohnehin Schätzungen | nächtliche Abnahme vorhersagen; Motivationsfaktor je Segment speichern |
| D-188 | 2026-11-08 | Antworten laufen über den normalen Briefversand mit der Eulen-Referenz `guest:<Eulen-ID>`; die Gast-Eule steht in der Eulenwahl oben und ist vorausgewählt | gleiche Kryptografie, Tokens, Schemas und Prüfungen wie jeder Brief | eigener Antwort-Endpunkt |
| D-189 | 2026-11-08 | Die Erholung während einer Rast endet beim Maximum: zwei `rest`-Segmente (steigend, dann flach); `stateAt` verfolgt die Kette bis zum Ende der Rast | sonst würde die Energie linear über die ganze Rast verteilt (Fehler im ersten Entwurf, durch einen Test gefunden) | ein Segment mit gedeckelter Interpolation |
| D-190 | 2026-11-08 | Antworten, die die eigene Eule heimbringt, lösen kein zweites Ankunftsbild aus; bei Leiheulen schon | die Heimkehr-Einblendung zeigt die eigene Eule bereits | immer Ankunftsbild |
| D-191 | 2026-11-08 | Rastende Eulen erscheinen nicht auf der Karte des Gastgebers | 12.1 unverändert: fremde Flugpläne erhält der Browser nicht | Gast-Eule auf der Karte zeigen |
| D-192 | 2026-11-08 | Weltkarte in Equal Earth mit Mittelmeridian 10° O; ganz herausgezoomt die ganze Welt im Quadrat mit Pergamentrand; außerhalb Westeuropas 15 km Toleranz, Inseln unter 3 000 km² weg, ganze Kilometer | Wunsch des Auftraggebers; flächentreu, Europa kaum verzerrt; Datenmenge rund 300 KiB statt über 1 MiB | LAEA behalten (Ränder stark verzerrt); Quadrat gefüllt (halbe Welt) |
| D-193 | 2026-11-08 | Registrierung und Umzug nutzen den Bereich `europe` (bisheriger Ausschnitt); Zoomstufen (Städte, 1/12, 1/40) beziehen sich auf dessen Breite | Wohnorte nur in Westeuropa (Wunsch des Auftraggebers); gleiche Bedienung wie bisher | Zoomstufen relativ zur Weltbreite |
| D-194 | 2026-11-08 | Ortszeit für die Begrüßung aus der Zeitzone des Landes (0,1°-Raster des Ausschnitts, je Land eine IANA-Zone, Rückfall Gerätezeit); Grenzen 5/11/18/22 Uhr; nachts „Hallo [Name], du Nachteule!“ | Wunsch des Auftraggebers; nichts wird gespeichert, wenige KB Daten | Sonnenzeit aus dem Längengrad; Gerätezeit; Zeitzone am Konto speichern |
| D-195 | 2026-11-08 | Leiheulen-Sperre: Arten der beiden Vortage (aus `menagerie_offers`) werden ausgelassen; Namen rotieren in drei Gruppen nach Tagesnummer | Wunsch des Auftraggebers (Arten und Namen getrennt); ohne Speichern und ohne rekursive Ableitung; laufendes Angebot ändert sich beim Update einmalig | Namen je Nutzer und Tag speichern; nur Arten sperren |
| D-196 | 2026-11-08 | Gutscheine: 0,1–100 Gold oder eine Eule (Art wählbar inkl. Phönix, „zufällig“ ohne Phönix); HMAC mit eigenem Schlüssel `voucher`; Einlöser nicht gespeichert; Eulen aus Gutscheinen dürfen das Limit überschreiten; Update-Nachricht verschweigt sie, Hilfe und README nennen sie | Wunsch des Auftraggebers; Datensparsamkeit | Gold bis 20; Art immer zufällig; Einlöser speichern |
| D-197 | 2026-11-08 | Admin-Sitzung 10 Minuten: jede Anfrage an die Admin-API zählt als Aktivität; ein Zeitgeber im Panel und jede 401-Antwort führen zur Anmeldung zurück | Wunsch des Auftraggebers; nach Ablauf bleibt nichts sichtbar | nur serverseitiger Ablauf |
| D-198 | 2026-11-08 | Tägliches Gold 03:00 UTC mit SSE-Hinweis an alle verbundenen Konten; ein noch auf 15:00 geplanter Lauf wird beim Start auf 03:00 desselben Tages verlegt | Wunsch des Auftraggebers; `daily_job_runs` verhindert doppelte oder fehlende Zahlungen | Lauf erst am nächsten Tag um 03:00 |
| D-199 | 2026-11-08 | Heimkehr-Bild nur als Einblendung (wie Ankunftsbilder, Kennung `[Art]:home`), Tag oder Nacht im Moment der Einblendung | Wunsch des Auftraggebers; Ursache des Fehlers: Bild nur im Systemchat, Tag/Nacht beim Öffnen festgelegt, keine Einblendung bei „Neuigkeiten“ oder offener App | Bild im Systemchat behalten |
| D-200 | 2026-11-08 | Löschfrist-Nachricht zählt eigene Briefkopien (geschrieben und erhalten), keine Systemnachrichten; Namen aktuell, sonst „unbekannt“; auch beim sofortigen Löschen nach Wahl einer kürzeren Frist; ohne Push | Nutzer erfahren, was verschwunden ist; Systemnachrichten sind kein Briefwechsel | eigene Zeile für Systemnachrichten; Push |
| D-201 | 2026-11-08 | Die überbringende Eule eines Briefs (eigene, Leiheule, Eule von …) ergibt sich beim Abruf aus seinem Flug (`owl_kind`, `holder_id`) | Flüge bleiben erhalten; keine Migration nötig | neue Spalten in `letters` |
| D-202 | 2026-11-08 | Auch der Systemchat öffnet bei der ältesten ungesehenen Nachricht | einheitliches Verhalten | nur Briefchats |
| D-203 | 2026-11-08 | Gegen die Meldung „Fontconfig error“ beim Build: `FONTCONFIG_FILE` auf eine minimale `deploy/fontconfig/fonts.conf` | Wunsch des Auftraggebers; kein zusätzliches Paket | Paket `fontconfig-config`; ignorieren |
| D-204 | 2026-11-08 | Startseite: Anmelde-Box und Gruppenbild per Grid-Stretch gleich groß (das quadratische Bild gibt die Höhe vor); die Versionsnummer hat keine eigene Farbe mehr | gleiche Optik wie Kacheln und Bild auf der Übersicht (v0.4) | Bild verkleinern |
| D-205 | 2026-11-08 | Brüten-Bilder als Bildart `brooding` (`<Bildname>-Brueten.png`), ersetzt bei brütenden Eulen auch das Nickerchen; der Phönix hat keines | einheitliche Dateinamen nach Anhang B; der Phönix legt keine Eier | Nickerchen weiter zulassen |
| D-206 | 2026-11-08 | VM-Test: Vor dem Update von der vorigen Stufe trägt das Szenario den Test-Signaturschlüssel in die `allowed_signers` der installierten Vorversion ein | seit 0.6.1 prüft bereits die Vorversion jede Signatur gegen den Schlüssel des Auftraggebers, den der Test nicht hat; der Eintrag steht für dessen echte Signatur, alle Ablehnungsprüfungen bleiben | Vorversion mit `--no-verify-tags` aktualisieren (prüfte die Signaturprüfung nicht mehr) |
| D-207 | 2026-11-08 | Uhrzeiten in der Ortszeit des Wohnorts über die Zeitzonen-Karte (wie die Begrüßung); ohne Anmeldung die des Geräts; das Adminpanel bleibt bei der Gerätezeit | Wunsch des Auftraggebers; eine Stelle (`format.ts`) für alle Anzeigen | Gerätezeit (bisher) |
| D-208 | 2026-11-08 | Die Gast-Eule für eine Antwort wird über einen Zustand im Arbeitsspeicher an den Chat übergeben (nicht über die Adresse) | der Router kennt keine Parameter; nach dem Abmelden vergessen | Parameter in der URL |
| D-209 | 2026-11-08 | Kaufbestätigung als Bestätigungsdialog des Browsers, wie bei anderen Rückfragen der App | einheitlich, barrierefrei, ohne eigenen Dialog | eigener Dialog |
| D-210 | 2026-11-08 | Nachricht an den Admin: eine pro UTC-Tag (Wunsch des Auftraggebers), Textregeln wie Briefe, ohne Absender gespeichert, nur der Tag am Konto; Löschung nach 90 Tagen; Admin kann einzeln löschen; Rate-Limit „teuer“ | Datensparsamkeit; gleiche Tagesgrenze wie alle anderen Limits | Absender speichern; Mitternacht am Wohnort |
| D-211 | 2026-11-08 | Der Hinweis auf die Admin-Nachricht steht im Erklärbär-Brief von Tag 2 (dort war Platz im kleinen Pergament) | die anderen Briefe sind nahe an 800 Zeichen | eigener Brief |
| D-212 | 2026-11-08 | „Ansicht zurücksetzen“ kehrt zur Ansicht beim Öffnen zurück; die ganze Welt erreicht man durch Herauszoomen | Wunsch des Auftraggebers | weiterer Knopf „Ganze Welt“ |
| D-213 | 2026-11-08 | E2E in zwei Profilen (Chromium-Desktop, WebKit-Handy); Firefox und Chromium-Handy entfallen im normalen Lauf | Wunsch des Auftraggebers (schlanker Ablauf); WebKit deckt das iPhone ab, Chromium Android und Desktop weitgehend | vier Profile behalten |
| D-214 | 2026-11-08 | Layout in vier Breiten (320, 390, 768, 1440 px); Screenshot-Rundgang nur auf Anfrage, Barrierefreiheit aller Seiten bleibt im normalen Lauf (`stage6.spec.ts`) | die übrigen Breiten lagen zwischen diesen und zeigten nie eigene Fehler; der Rundgang wiederholte bereits getestete Abläufe | acht Breiten; Rundgang immer |
| D-215 | 2026-11-08 | Testablauf: gezielt während der Entwicklung, `npm test` einmal am Ende, VM-Test nur bei Skripten, Migrationen oder Abhängigkeiten | Wunsch des Auftraggebers; spart Zeit ohne Lücke in der Abnahme | alles nach jeder Änderung |
| D-216 | 2026-11-09 | Ursache der unsichtbaren Bot-Post: „Alle Briefe verbrennen“ und das Entfernen markierten auch noch fliegende Briefe als verbrannt; sie zählten bei der Ankunft als ungelesen, wurden aber nicht angezeigt. Verbrannt werden nur angekommene Briefe; die Migration berechnet die Zähler neu | ein Brief, der beim Verbrennen noch nicht da war, gehört nicht zum verbrannten Verlauf | fliegende Briefe beim Verbrennen ganz löschen (die Eule käme leer an) |
| D-217 | 2026-11-09 | Bots nur im Briefwechsel und auf der Karte; Entfernen einzeln im Bot-Chat und alle in den Einstellungen | Wunsch des Auftraggebers (Option „Nur im Briefwechsel + Knopf je Chat“) | nur „Alle Bots entfernen“; Bots auch in der Chatliste ausblenden |
| D-218 | 2026-11-09 | `users.bots_created` statt „hat keine Bots“ als Merkmal für das einmalige Anlegen; bestehende Konten bekommen 1 | entfernte Bots dürfen nie zurückkommen; der alte Start-Abgleich legte sie für Konten ganz ohne Bots neu an | Liste entfernter Bots speichern |
| D-219 | 2026-11-09 | „Alle Bots entfernen“ entfernt auch noch unbekannte Bots; die Zahl aller Bots kommt mit `GET /api/contacts` (`allBots`) | „sämtliche Bots … final“ (Wunsch des Auftraggebers); die Einstellungen zeigen danach „Alle Bots sind entfernt.“ | nur bekannte Bots |
| D-220 | 2026-11-09 | Heimkehr in eigener Tabelle `homecomings` statt Systemnachricht; Einträge werden nach dem Einblenden gelöscht, spätestens nach 60 Tagen; alte `owl_home`-Systemnachrichten werden ausgeblendet, nicht gelöscht | Wunsch des Auftraggebers (keine Systemnachricht, Bild jedes Mal); nichts bleibt gespeichert, was niemand mehr sieht; alte Nachrichten verschwinden mit ihrer Löschfrist | Systemnachricht ohne Anzeige; alte Nachrichten per Migration löschen |
| D-221 | 2026-11-09 | Mehrere Heimkehrer nacheinander je ein Bild (Warteschlange der Einblendungen), Tag oder Nacht beim Anzeigen jedes Bilds | Wunsch des Auftraggebers (Option „Nacheinander je ein Bild“) | ein Sammelbild; nur das letzte |
| D-222 | 2026-11-09 | Restzeiten unter 60 Minuten in Minuten (aufgerundet, mindestens 1), sonst wie bisher in aufgerundeten Stunden; das Geschlecht bleibt gleichverteilt (Messung 49,99 %), ein Test mit 20 000 Würfen prüft die Abweichung | Wunsch des Auftraggebers; die gefühlte Häufung weiblicher Eulen war Zufall | Minuten bis 90; Geschlecht ausgleichend würfeln (wäre nicht mehr zufällig) |
| D-223 | 2026-11-09 | Ein Brief pro Kalendertag (UTC-Mitternacht) an jeden Bot, auch an den Erklärbär; der Erklärbär hat ein eigenes KI-Kontingent, das gemeinsame Kontingent der anderen Bots gilt für ihn nicht | Wunsch des Auftraggebers (Optionen „Mitternacht UTC“ und „Eigenes KI-Kontingent“); gleiche Tagesgrenze wie die Nachricht an den Admin | Mitternacht am Wohnort; Erklärbär unbegrenzt anschreibbar |
| D-224 | 2026-11-09 | Die Erstbrief-Sichtbarkeit gilt nur für Bots des Kontrollzentrums; der Erklärbär bleibt im Briefwechsel von Anfang an und auf der Karte nach dem ersten eigenen Brief | ausdrücklicher Wunsch des Auftraggebers | gleiche Regel für alle |
| D-225 | 2026-11-09 | „Alle Bots entfernen“ bleibt endgültig und hält auch künftige Bots fern (`users.bots_disabled`); Konten ohne Bots aus v0.7.2 gelten als abgeschaltet | Wunsch des Auftraggebers (Option „Endgültig wie bisher“) | umkehrbarer Schalter |
| D-226 | 2026-11-09 | Anlegen und Aktivieren je mit Bestätigungsdialog des Browsers; Löschen mit eingetipptem Namen (Vergleich über den Namensschlüssel) | Wunsch des Auftraggebers; gleiche Dialogart wie im Rest der App (D-209) | eigene Dialoge |
| D-227 | 2026-11-09 | Ohne feste Längengrenze: ein Bot-Brief, der nicht aufs kleine Pergament passt, geht auf großem (höchstens 15 000 Zeichen, am Satzende gekürzt) | die Textregeln der Briefe gelten weiter; keine Kosten für Bots | Brief bei Überlänge abweisen |
| D-228 | 2026-11-09 | Ist die KI bei einem geplanten Brief nicht verfügbar (kein Key, Kontingent, Fehler, leere Antwort), geht der unveränderte Brief; die Spielerbriefe bleiben offen | Wunsch des Auftraggebers; ein Rundbrief darf nie ausfallen | Event verschieben |
| D-229 | 2026-11-09 | Bots dürfen jede Art des Spiels außer dem Phönix nutzen (Liste `SPECIES` ohne `mythical`), auch künftige, nicht käufliche Arten | Wunsch des Auftraggebers | nur käufliche Arten |
| D-230 | 2026-11-09 | Die Motivation des Bots gilt für eigene Eule und Leiheulen | Wunsch des Auftraggebers (Option „Gleiche Bot-Motivation“); ferne Bots auch mit Leiheulen erreichbar | Leiheulen 80–100 % |
| D-231 | 2026-11-09 | „Anschreiben mit eigenen Eulen erlaubt“ umfasst eigene Eulen und Leiheulen der Spieler | Wunsch des Auftraggebers (Option „Eigene und Leiheulen“) | nur eigene Eulen |
| D-232 | 2026-11-09 | Jede Instanz der eigenen Bot-Eule startet mit voller Energie; ihr Wohnort ist der des Bots | sie ruht zwischen den Flügen beim Bot; keine Energie je Instanz zu speichern | Energie je Spieler-Instanz führen |
| D-233 | 2026-11-09 | Rastende Bot-Eulen erscheinen als Gast ohne Pflege-Aktionen | Bot-Eulen kennen keine Krankheit und keinen Motivationsverlust; Pflege hätte keine Wirkung („soweit sinnvoll“) | Pflege wie bei Spielereulen |
| D-234 | 2026-11-09 | Geschenke wie Gutscheine: Gold 0,1–100 je Spieler, Eule jeder Art außer Phönix, Geschlecht zufällig, unbenannt, darf das Limit überschreiten; mit Brief als Begleitbrief | Wunsch des Auftraggebers (Option „Wie Gutscheine“) | Grenzen der Überweisungen |
| D-235 | 2026-11-09 | Vier Textfassungen je Brief-Event (Erstkontakt/Folgebrief × Deutsch/Englisch), alle Pflicht; fehlt eine Sprache doch (z. B. leerer Text aus einem alten Import), gilt die andere | Empfehlung im Auftrag | nur eine Sprache |
| D-236 | 2026-11-09 | Grobe Weltmaske 0,1° (810 KB, nur Server) zusätzlich zur feinen Maske des Ausschnitts | Wunsch des Auftraggebers (Option „Grobe Weltkarte“); Schlaf auf Land weltweit, Wohnorte prüfbar | außerhalb nur Länderflächen ohne Schlaf |
| D-237 | 2026-11-09 | Flüge der Bots in der normalen Tabelle `flights` (`holder_kind`, `bot_peer_id`, `holder_id` ohne Fremdschlüssel, Löschen beim Konto-Purge ausdrücklich) | dieselbe Mechanik wie im Spiel ohne zweite Flug-Engine; Rast, Gast-Antwort, Umzug, Umkehren funktionieren unverändert | eigene Tabelle `bot_flights` |
| D-238 | 2026-11-09 | Bilder als BLOB in der Datenbank (normalisiert, je Bot einmal), nicht als Dateien | sie sind klein; mit der verschlüsselten Datenbanksicherung, Rückfall und Löschen immer stimmig | Dateien in `/var/lib/posteulen/` |
| D-239 | 2026-11-09 | ZIP ohne neue Abhängigkeit (`node:zlib`) | Lieferkette klein halten; nur das nötige, streng geprüfte Teilformat | Paket wie `yazl`/`yauzl` |
| D-240 | 2026-11-09 | `sharp` (schon für den Bilder-Build da) wird Laufzeitabhängigkeit des Backends | sichere Neukodierung der Uploads ohne weiteres Paket | eigene Dekoder; Upload ohne Normalisierung |
| D-241 | 2026-11-09 | Abbau der Verwandten-Bots bei jedem Start statt nur in der Migration | Eulen müssen umkehren (Flugplanung in TypeScript); nach einem Rückfall greift die Bereinigung beim nächsten Update wieder | nur SQL in der Migration |
| D-242 | 2026-11-09 | Geschenktes Gold der Verwandten-Bots bleibt, ihre Buchungen und Nachrichten verschwinden | Wunsch des Auftraggebers (Option „Gold bleibt, Buchungen weg“) | Buchungen neutral; Gold abziehen |
| D-243 | 2026-11-09 | Ein Event, dessen Bot zum Zeitpunkt nicht aktiv ist (Entwurf, Pause), wird nicht ausgeführt („nicht ausgeführt“ im Archiv) | „Pausieren verhindert neue Sendungen“; einmalig zum Zeitpunkt | nach dem Fortsetzen nachholen |
| D-244 | 2026-11-09 | Kontrollzentrum als dritte API im selben Prozess (Port 3003) und eigene Svelte-App `bots/` | gleiche Sicherheitsgrundlagen wie das Adminpanel; kein zweiter Dienst | Teil des Adminpanels |
| D-245 | 2026-11-09 | Gemeinsamer Anmelde-Code für Adminpanel und Kontrollzentrum (`panel-auth.ts`), getrennt durch Tabelle, Cookie, Sitzungen, Leerlauf, Login-Bremse und Rate-Limit | ein geprüfter OPAQUE-Ablauf statt zweier | kopierter Code |
| D-246 | 2026-11-09 | Die Funktionsprüfung bei Installation und Update warnt nur, wenn `bots.<domain>` nicht antwortet | ohne DNS-Eintrag gibt es kein Zertifikat; das darf ein Update nicht zurückrollen | Fehler und Rückfall |
| D-247 | 2026-11-09 | Tägliche Bot-ZIP unverschlüsselt (Wunsch des Auftraggebers), Rechte 0600 root, 7 Tage, enthält keine Spielerdaten | auf neuem Server ohne Schlüssel importierbar | verschlüsselt wie die Datenbank |
| D-248 | 2026-11-09 | Importierte neue Bots immer als Entwurf; optionaler Ziel-Bot für einzelne Aktionen | nichts läuft ungeprüft los; Aktionen lassen sich in andere Bots übernehmen | Zustand aus der Datei übernehmen |
| D-249 | 2026-11-09 | Ein Läufer arbeitet alle Zustellungen nacheinander ab (älteste zuerst); dadurch keine gleichzeitige Bearbeitung derselben Spielerbriefe | einfache, robuste Nebenläufigkeit; Zustand liegt vollständig in der Datenbank | parallele Läufer mit Sperren |
| D-250 | 2026-11-09 | Zeitpunkte im Kontrollzentrum in der Ortszeit des Geräts mit UTC-Anzeige; gespeichert in UTC | eindeutig für Betreiber an verschiedenen Orten | Ortszeit des Bots |
| D-251 | 2026-11-09 | Rast der Bot-Eulen 0–168 Stunden (Standard 24) | eine Woche Antwortzeit genügt; 0 erlaubt Bots ohne Antwort per Eule | feste Auswahl wie bei Spielern |
| D-252 | 2026-11-09 | Systemnachricht beim Löschen eines Bots: „[Name] hat seine Feder für immer niedergelegt …“ | spielgerechte Wortwahl (Wunsch des Auftraggebers) | technische Meldung |
| D-253 | 2026-11-09 | Löschen, Verschieben eines Events und Fortsetzen eines Bots prüfen offene Spielerbriefe neu auf eine spontane Antwort | sonst könnte eine Antwort verloren gehen, wenn das Event wegfällt | nur bei Ankunft prüfen |
| D-254 | 2026-11-09 | Bild-IDs zufällig (fester Namensschema `media/<ID>.webp` im Export), gleicher Inhalt je Bot nur einmal (SHA-256) | „einmal ablegen, nur verlinken“; keine Rückschlüsse aus Dateinamen | Hash als Dateiname |
| D-255 | 2026-11-09 | Adminpanel und Kontrollzentrum auf Deutsch und Englisch (Knopf in der Kopfzeile, auf dem Gerät gemerkt) | Wunsch des Auftraggebers | Sprache am Server speichern |
| D-256 | 2026-11-09 | Ältere Update-Nachrichten nennen die Verwandten-Bots nicht mehr (sie werden aus dem aktuellen Text erzeugt) | „aus allen aktuellen Texten entfernt“ | alte Texte unverändert |
| D-257 | 2026-11-09 | `bots-export`/`bots-import` der CLI mit leichtem Kontext ohne Worker | laufen parallel zum Dienst (tägliche Sicherung) ohne doppelte Aufträge | ganze App starten |
| D-258 | 2026-11-09 | Geschlecht der eigenen Bot-Eule beim Anlegen gewürfelt; Leiheulen der Bots aus ihrer Flug-ID abgeleitet | Gast-Anzeige braucht ein Geschlecht, ohne Eulenzeile | ohne Geschlecht |
| D-259 | 2026-11-09 | Anpassungen, spontane Antworten, Zusammenfassungen und der KI-Test zählen zum Kontingent der Bots | Kostenkontrolle an einer Stelle | KI-Test ohne Limit |
| D-260 | 2026-11-09 | Die Namen „Tante“, „Onkel“, „Aunt“, „Uncle“ sind nicht mehr reserviert; Bot-Namen und Kontonamen schließen sich gegenseitig aus | die Verwandten-Bots gibt es nicht mehr; Täuschung verhindert jetzt die Eindeutigkeit | Reservierung behalten |
| D-261 | 2026-11-09 | Ein Fehler beim Abbau der Verwandten-Bots wird protokolliert und blockiert den Start nicht; Umkehr ihrer Eulen ohne Systemnachricht | ein Bereinigungsschritt darf eine Instanz nie lahmlegen (das Update auf 0.8.0 wurde deshalb zurückgerollt); die Nachricht hätte den Bot genannt | Start abbrechen (bisher) |
| D-262 | 2026-11-09 | Prüfung von `bots.<domain>` nur, wenn die Caddyfile die Seite enthält | nach einem Rückfall kennt die laufende Version das Kontrollzentrum nicht; die Warnung führte in die Irre | Warnung immer |
| D-263 | 2026-11-10 | Funktionsprüfung prüft jeden Hostnamen über jede eigene IPv4- und IPv6-Adresse; fehlende Zertifikate per einmaligem Caddy-Reload nachholen, sonst nur Warnung | eine später hinzugefügte IPv6-Adresse soll ohne Handarbeit funktionieren; DNS liegt außerhalb des Servers und darf kein Update zurückrollen | Rückfall bei Fehlern; nur Hauptadresse prüfen |
| D-264 | 2026-11-10 | Firewall-Regeln und `IPV6=yes` bei jedem Lauf von configure.sh | ältere Installationen bekommen IPv6 nachträglich; idempotent | nur bei der Installation |
| D-265 | 2026-11-10 | Briefe im Verlauf nach dem Kenntniszeitpunkt des Betrachters sortiert (eigene: Sendezeit, empfangene: Ankunft) | so liest sich der Verlauf, wie man ihn erlebt hat | Sortierung nach Sendezeit für beide |
| D-266 | 2026-11-10 | Im Chat erscheinen die Ankunftsbilder aller neuen Briefe nacheinander (Warteschlange, nach Ankunft) | Wunsch des Auftraggebers; jede Eule wird gewürdigt | nur das letzte Bild |
| D-267 | 2026-11-10 | Keine Lesebestätigung für Absender (auch nicht bei Bots); die Statistik des Kontrollzentrums zählt „gelesen“ weiter | Privatsphäre; die Statistik ist anonym und zusammengezählt | Lesestatus als Einstellung |
| D-268 | 2026-11-10 | Nicht lesbare Briefe: Absender „verloren“, Empfänger „nass“; konkreter Grund nur im Fehlerprotokoll | verständlich ohne Fachbegriffe, technisch auswertbar für den Admin | gleiche Meldung für beide; Fachbegriffe in der App |
| D-269 | 2026-11-10 | Der Grund kommt vom Gerät des Empfängers als feste Kennung (Auswahlliste), der Server übersetzt sie | nur das Gerät kennt den Grund; keine freien Texte vom Client im Protokoll | Freitext vom Client |
| D-270 | 2026-11-10 | Rast-Ankündigung als Systemnachricht und eigener Push `owl_resting` | Wunsch des Auftraggebers; ohne Push fiele die Rast oft erst nach ihrem Ende auf | nur Systemnachricht |
| D-271 | 2026-11-10 | „Weiterfliegen lassen“ mit Rückfrage, nur für den Gastgeber und nur während der Rast | versehentliches Wegschicken vermeiden; die Eule gehört dem Halter | ohne Rückfrage |
| D-272 | 2026-11-10 | Links standardmäßig anklickbar; Regler am Konto, wirkt auf Briefe und Banner | bisheriges Verhalten bleibt, wer vorsichtig sein will, schaltet ab | Standard aus |
| D-273 | 2026-11-10 | Banner: de Pflicht, en optional (Rückfall auf de), höchstens 90 Tage, Textregeln wie Briefe, ausblendbar je Gerät | einfache Pflege; keine Emojis und Steuerzeichen; Ausblenden ohne Serverzustand | Banner am Konto bestätigen; unbegrenzte Dauer |
| D-274 | 2026-11-10 | Ein Banner mit Beginn in der Vergangenheit beginnt jetzt; abgelaufene löscht der tägliche Lauf | einfache Prüfung, keine Altlasten | Ablehnen |
| D-275 | 2026-11-10 | Kontaktnamen werden in App und Server getrimmt | ein versehentliches Leerzeichen führte ins Leere (immer gleiche Antwort, 8.8) | nur in der App |
| D-276 | 2026-11-10 | Eine gültige Sitzung je Konto wird als Sicherheitsmerkmal dokumentiert | bestehendes Verhalten; Nutzer erkennen so Fremdnutzung | keins |
