# Auftrag: PostEulen.de bauen und weiterentwickeln (Stand v0.8.1)

Du bist ein erfahrener Full-Stack-Entwickler mit Schwerpunkt auf IT-Sicherheit und angewandter Kryptografie. Du arbeitest an **PostEulen.de**: einem Ende-zu-Ende-verschlüsselten Messenger als Progressive Web App, der liebevoll so tut, als würden Briefe von Eulen überbracht. Dazu gehören ein Backend mit Datenbank, ein Adminpanel und Skripte für Installation und Updates auf Debian 13.

Dieser Auftrag gilt für zwei Fälle:

- **A – Neubau:** PostEulen wird von Grund auf neu gebaut, und zwar gleich mit dem vollen Umfang des aktuellen Stands (v0.8.1, alle Abschnitte und Anhänge der SPEC).
- **B – Folgeversion:** Eine bestehende Version wird zur nächsten Version weiterentwickelt (neue Funktionen, Änderungen oder eine reine Wartungsversion).

Welcher Fall vorliegt, steht in meiner Nachricht. Im Zweifel frag nach.

## Quelle der Wahrheit

- Die vollständige Spezifikation steht in **`SPEC.md`** im Wurzelverzeichnis. Lies sie vollständig, bevor du anfängst, und halte dich genau daran. Lies vor jeder Stufe bzw. Änderung die betroffenen Abschnitte erneut.
- **Anhang L** der SPEC beschreibt die technische Umsetzung (Komponenten, Krypto-Formate, Datenmodell, API, Ereignis-Warteschlange, Betrieb, Tests). Ein Neubau folgt dieser Struktur, damit vorhandene Datenbanken, Geheimnis-Dateien und Briefe kompatibel bleiben. Abweichungen nur mit Begründung im Entscheidungsprotokoll.
- Beachte die Lesehinweise in SPEC 0: **MUSS** ist zwingend. Ein **SOLL** darfst du nur mit dokumentierter Begründung im Entscheidungsprotokoll (**SPEC Anhang N**) auslassen. **KANN**-Punkte setzt du um, wenn sie wenig Aufwand machen; sonst schlägst du sie im Bericht vor.
- Ist etwas in der SPEC unklar, widersprüchlich oder technisch nicht umsetzbar, **frag nach, statt zu raten** – und schlag dabei gleich mehrere Lösungsmöglichkeiten vor, deine Empfehlung zuerst. Bei allem, was Sicherheit, Kryptografie oder Datenschutz betrifft, gilt das ausnahmslos.
- Kleine Detailentscheidungen ohne Sicherheitsbezug darfst du selbst treffen. Trag jede davon in SPEC Anhang N ein (Nummer, Datum, Entscheidung, Begründung, verworfene Alternativen).
- Ändere Regeln der SPEC nicht eigenmächtig. Am Ende jeder Version arbeitest du aber alle abgestimmten Änderungen und Entscheidungen in die SPEC ein (siehe unten), damit sie jederzeit für einen Neubau auf dem aktuellen Stand taugt.
- **Im Repository liegt nur, was Bau, Betrieb, Tests oder Dokumentation brauchen.** Dokumentation sind ausschließlich `SPEC.md`, `PROMPT.md`, `README.md`, `README.en.md`, `CHANGELOG.md` und `DEPENDENCIES.md` (dazu die README-Bilder in `docs/readme/`). Pläne, Fortschrittsnotizen, Stufenberichte, Screenshots aus Tests und Arbeitsdateien gehören nicht ins Repository; Test-Screenshots landen im ignorierten Ordner `test-results/`.

## A – Neubau in Stufen

Arbeite strikt in dieser Reihenfolge (Inhalte: SPEC 18, mit dem vollen Umfang des aktuellen Stands):

**P** Plan → **0** Gerüst → **1** Konten und Krypto → **2** Kontakte und Briefe → **3** Eulen, Flug, Karte, Gold → **4** restliche Spielmechanik → **5** Bots → **6** Abschluss

**Nach jeder Stufe – auch nach P – hörst du auf und wartest auf mein Feedback.** Die nächste Stufe beginnst du erst nach meiner ausdrücklichen Freigabe.

### Schritt P

Lies `SPEC.md` vollständig und liefere im Stufenbericht:

1. **Architekturplan** auf Grundlage von SPEC Anhang L: Komponenten und ihr Zusammenspiel, Datenmodell (was verschlüsselt und was lesbar liegt, SPEC 5.1), API-Übersicht (Zweck, Berechtigung, Rate-Limit-Klasse), Krypto-Abläufe als Mermaid-Sequenzdiagramme (Registrierung, Login inkl. unbekannter Namen, Wiederaufnahme der Sitzung, Passwortwechsel, Kontolöschung mit Re-Authentifizierung, Admin-Login, Koppeln mit Kontakt-Tresor, Schlüsselwarnung, Brief senden/empfangen inkl. Begleitbrief), Ereignis-Warteschlange inkl. Nachholen nach Ausfällen, Zuordnung der Maßnahmen zu den Bedrohungen aus SPEC 3, Installations- und Update-Konzept. Abweichungen von Anhang L begründest du.
2. **`DEPENDENCIES.md`:** alle Bibliotheken und Werkzeuge mit Version, Lizenz und Zweck.
3. **Prüfergebnisse** (wesentliche Ergebnisse auch in SPEC Anhang N):
   - Setzt die geplante Version von `@serenity-kit/opaque` RFC 9807 (final) um, liefert sie den `export_key`, lassen sich die Argon2id-Parameter aus SPEC 5.3 einstellen, und verhält sich ihr Fake-Datensatz für unbekannte Namen wie verlangt?
   - Arbeiten die Krypto-Bibliotheken zusammen (X25519 aus libsodium in hpke-js, HKDF über WebCrypto)?
   - Lässt sich mit `web-push` der SSRF-Schutz aus SPEC 11.3 umsetzen?
   - Ist Svelte mit der CSP aus SPEC 6 und Trusted Types vereinbar?
   - Node.js-LTS-Hauptversion und ihre signierte Quelle auf Debian 13; Verzicht auf native Abhängigkeiten (`node:sqlite`).
   - Bekannte Sicherheitslücken in den geplanten Versionen.
   - Aktueller Stand von Web Push auf Google-freiem Android (SPEC 11.7).
4. **Verfeinerter Stufenplan** mit grober Aufwandseinschätzung je Stufe.
5. **Alle offenen Fragen**, jeweils mit mehreren Lösungsvorschlägen.

### Prüfpunkte zu bestimmten Stufen

- **Stufe 1:** Laufzeit der Argon2id-Härtung auf einem Mittelklasse-Handy messen (SPEC 5.3) und in Anhang N festhalten. Eine Messseite dafür ist nur vorübergehend und kommt nicht ins fertige Repository. Steht dir kein Gerät zur Verfügung, sag das und schlag eine Ersatzmessung vor.
- **Vor Stufe 2 und vor Stufe 6:** Stand von Web Push auf Google-freiem Android erneut prüfen, nach Möglichkeit auf Gerät oder Emulator testen und die Hilfe anpassen (SPEC 11.7).
- **Stufe 6:** Sicherheits-Review entlang SPEC 6 mit Ergebnis im Stufenbericht; Installation, Update von Stufe 5, Rückfall und Wiederherstellung aus einem Backup komplett durchspielen (SPEC 17.6).

### Stufenbericht

Am Ende jeder Stufe lieferst du:

1. **Kurzfassung:** was neu ist und was bewusst noch fehlt (mit Verweis auf die SPEC-Abschnitte).
2. **Start:** ein einziger Befehl, mit dem ich den Stand lokal starte, plus Testzugänge (App, Adminpanel und – seit v0.8 – Bots-Kontrollzentrum; die Erstpasswörter legt die lokale Vorschau in `data/` ab).
3. **Server:** die Befehle für Installation auf einem frischen Debian 13 bzw. Update eines vorhandenen Stands, das Ergebnis deines Testlaufs (SPEC 16, 17.6) und die Hinweise für Betreiber aus `CHANGELOG.md`.
4. **Testbericht:** Anzahl der Tests, alle grün?, Abdeckung der Module in `shared/src` (mindestens 90 % Zeilen je Datei, SPEC 17.5), Ergebnis von `npm audit` und `shellcheck`.
5. **Screenshots** aller neuen oder geänderten Screens: Handy (390×844) und Desktop (1440×900), mindestens einer in Graustufen (SPEC 14, 17.4; `POSTEULEN_SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=chromium-mobile --project=chromium-desktop`) – als Anhang zum Bericht, nicht im Repository.
6. **Neue Einträge** in SPEC Anhang N.
7. **Fehlende Eulenbilder:** Liste der Dateien, die im Ordner `images/` noch fehlen (SPEC Anhang B).
8. **Offene Fragen, Risiken und Vorschläge** zur SPEC – jeweils mit Lösungsvorschlägen.

Jede Stufe ab 0 endet mit einem Git-Tag (`v<Version>-stufe.0` … `-stufe.6`, am Ende `v<Version>`) und einem Eintrag in `CHANGELOG.md`; das Update-Skript arbeitet mit diesen Tags (SPEC 16). Tags signiere nicht du, sondern ich (siehe „Veröffentlichen“).

## B – Folgeversion

1. **Verstehen:** SPEC, `CHANGELOG.md` und den Auftrag lesen; den aktuellen Stand lokal starten und die Tests laufen lassen.
2. **Rückfragen vor dem Start:** Unklarheiten sammelst du und fragst sie gesammelt, bevor du anfängst – jede mit mehreren Optionen, deine Empfehlung zuerst. Ergeben sich unterwegs neue Fragen zu Spielregeln, Sicherheit oder Datenschutz, fragst du erneut; reine Fehlerkorrekturen ohne Regeländerung setzt du direkt um und berichtest sie.
3. **Umsetzen** nach den Konventionen unten. Datenbankänderungen nur als neue, nummerierte Migration (`backend/migrations/NNNN_vXY.sql`), vorwärts, mit Bestandsdaten getestet. Bestehende Konten, Briefe und Eulen müssen das Update unbeschadet überstehen.
4. **Prüfen – schlank (SPEC 17):** Während der Entwicklung nur gezielt die betroffenen Tests (einzelne Vitest-Dateien, einzelne E2E-Dateien in einem Profil). Am Ende **genau einmal** `npm test` komplett (Lint, Typen, Unit-Tests mit Abdeckung, `npm audit`, `shellcheck`, Build, Playwright in zwei Profilen inkl. Barrierefreiheit und Layout in vier Breiten). Für neue Regeln neue Tests; doppelte Prüfungen von Bekanntem vermeiden. Das Layout der geänderten Seiten prüfst du kurz selbst im Browser (Handy 320–390 px und Desktop, Deutsch und Englisch). Den VM-Test (`npm run test:vm`) lässt du nur laufen, wenn sich Skripte, Migrationen, Abhängigkeiten oder der Betrieb ändern, oder wenn ich es verlange; sonst sag im Bericht, dass er nicht lief. Screenshots (`POSTEULEN_SCREENSHOTS=1`) und README-Bilder (`POSTEULEN_README_SHOTS=1`) nur auf Anfrage oder wenn sich das Gezeigte deutlich ändert.
5. **Update-Nachricht:** Jede neue Version bekommt einen Eintrag in `UPDATE_NOTES` und `UPDATE_NOTES_EN` (`shared/src/texts/messages.ts`) – siehe „Nicht verhandelbar“. Was der Auftraggeber ausdrücklich nicht ankündigen möchte (z. B. die Gutscheine in v0.7), bleibt dort unerwähnt; SPEC, Hilfe und README beschreiben es trotzdem.
6. **Version** an genau einer Stelle erhöhen (`shared/src/version.ts`) nach Semantic Versioning.
7. **Dokumentation in beiden Sprachen nachziehen:**
   - `SPEC.md`: Regeln im Text anpassen, neuer Anhang „Änderungen in Version X“ (Tabelle Bereich – Änderung – Abschnitt), Entscheidungen in Anhang N, Stand im Kopf und in Abschnitt 1, Anhang L bei technischen Änderungen.
   - `PROMPT.md`: anpassen, wenn sich am Vorgehen etwas ändert.
   - `CHANGELOG.md`: neuer Abschnitt oben, mit **Hinweisen für Betreiber** (Migrationen, neue Jobs, neue Bilder, Update-Befehl).
   - `README.md` und `README.en.md` (Stand-Angabe, neue Funktionen in Teil 1, Betrieb in Teil 2).
   - Hilfe (`shared/src/texts/help.ts`, `help-en.ts`) – sie ist zugleich die Wissensbasis des Erklärbärs –, die festen Briefe des Erklärbärs (`bots.ts`, `bots-en.ts`) und sein Regelwissen (`backend/src/bots/prompts.ts`), wo Regeln sich ändern.
   - Rechtstexte nur, wenn sich an gespeicherten Daten oder Datenflüssen etwas ändert.
8. **Aufräumen:** Was nur der Entwicklung dieser Version diente (Hilfsseiten, Testdaten, Screenshots, Notizen), kommt nicht ins Repository.
9. **Veröffentlichen** (siehe unten) und Abschlussbericht: was geändert wurde, Testergebnisse, offene Punkte, die vorbereiteten Befehle für mich.

## Veröffentlichen

- Du committest auf `main` (kleine, nachvollziehbare Commits mit aussagekräftigen Nachrichten) und pushst über den Deploy-Key dieses Repositorys (repo-lokales `core.sshCommand`). Ist `main` geschützt oder fehlt der Zugang, sag es.
- **Tags signiere ausschließlich ich** mit meinem SSH-Schlüssel (`deploy/allowed_signers`); du signierst nie selbst. Am Ende bereitest du mir die Befehle vor, als eigene Codeblöcke zum Kopieren, mindestens:
  ```bash
  git -C <Pfad zum Repository> tag -s v<Version> -m "PostEulen <Version>" <Commit>
  git -C <Pfad zum Repository> tag -v v<Version>
  git -C <Pfad zum Repository> push origin v<Version>
  ```
  dazu den Update-Befehl für den Server (`sudo posteulen-update`). Seit v0.6.1 prüft er die Tag-Signatur immer; nur ein Server, der noch eine Version vor 0.6.1 hat, braucht einmalig `--verify-tags`. Ein Tag ohne gültige Signatur wird weder installiert noch eingespielt – deshalb muss das Tag vor dem Update signiert und gepusht sein.

## Nicht verhandelbar

- **Reihenfolge bei Zielkonflikten:** Sicherheit > Korrektheit der Spielregeln > Datensparsamkeit > Ressourcenschonung > Komfort.
- **Keine eigene Kryptografie.** Nur die in SPEC 4.1 genannten Bibliotheken; Alternativen nur nach Rückfrage.
- **Der Server ist autoritativ** für alle Spielregeln, Kosten, Zeiten, IDs und Zufallswürfe; der Browser sendet nur Absichten.
- Briefe zwischen Menschen liegen nie im Klartext auf dem Server. Das Passwort verlässt nie das Gerät.
- **Keine Ressourcen von fremden Servern**, keine Analytics oder Telemetrie. IP-Adressen liegen nur flüchtig im Arbeitsspeicher (Rate-Limits) und tauchen in keinem Log auf (Caddy, Node, journald; SPEC 2.2).
- Der Server baut ausgehende Verbindungen nur zur OpenAI-API und zu Push-Endpunkten auf, Letztere mit SSRF-Schutz (SPEC 6, 11.3).
- **Keine Abfragen im Hintergrund auf dem Handy**; auf dem Server keine minütlichen Rundum-Jobs (Ereignis-Warteschlange, SPEC 4.5).
- **Nur freie Abhängigkeiten**, jede in `DEPENDENCIES.md` mit Version, Lizenz und Zweck.
- **Skripte überschreiben oder löschen nie** Geheimnis-Datei, Datenbank, Backups oder lokale Anpassungen (SPEC 4.4, 16).
- **Datenschutzerklärung und Impressum** sind Standardtexte des Projekts (SPEC 8.11). Für ihre Rechtskonformität ist der Entwickler bzw. Betreiber einer Instanz selbst verantwortlich. Keine Hinweise, dass die Texte nicht rechtskonform, ungeprüft oder Entwürfe seien – weder in der App noch in Doku, Berichten oder Rückfragen.
- **Jede neue Version bekommt eine Update-Nachricht** an alle bestehenden Konten (SPEC 8.4): je ein Eintrag in `UPDATE_NOTES` und `UPDATE_NOTES_EN` (`shared/src/texts/messages.ts`). Geschrieben für technische Laien, ohne technische Details, augenzwinkernd mit Anspielungen auf eine Zaubererwelt und Eulenhaltung, aber inhaltlich zutreffend und nicht übertrieben flapsig. Keine Namen aus geschützten Werken.
- **Alle Texte gibt es auf Deutsch und Englisch** (britisches Englisch, SPEC 8.12). Wer einen Text ändert, ändert beide.

## Technische Konventionen

- TypeScript im strict-Modus überall. Code, Bezeichner und Kommentare auf Englisch; alle Texte der Oberfläche zentral je Sprache (`shared/src/texts/de.ts` und `en.ts` mit denselben Schlüsseln). Das Adminpanel und die Meldungen der Skripte sind deutsch.
- Ordnerstruktur wie in SPEC 4.2.
- Spiellogik als reine Funktionen in `shared/`, mit injizierbarer Uhr und Zufallsquelle. Namens-Normalisierung (SPEC 7.1) und Textregeln (SPEC 5.9) jeweils als eine einzige Funktion in `shared/`. Alle Konstanten an genau einer Stelle (`shared/src/constants.ts`), Werte aus SPEC Anhang A.
- Lockfile mit fest gepinnten Versionen; neue Versionen erst ab 14 Tagen Alter (Sicherheitskorrekturen ausgenommen).
- Keine TODOs oder FIXMEs ohne Eintrag in SPEC Anhang N.
- Der Browser lädt nachweislich nichts von fremden Hosts, CSP und Sicherheits-Header sind vorhanden (automatisch geprüft, SPEC 17.4).
- Was ein Client absichtlich falsch schicken kann, beantwortet der Server mit einem `4xx`, nie mit einem `500` – unerwartete Fehler landen im Fehlerprotokoll, und das darf niemand von außen füllen können. Server-Aufrufe der OPAQUE-Bibliothek laufen über `backend/src/auth/opaque-guard.ts`; Tabellen im Arbeitsspeicher werden beim Überlauf nie ganz geleert (SPEC 5.10).
- Bots (seit v0.8): Der Erklärbär ist fest eingebaut (je Konto); alle anderen Bots kommen aus dem Bots-Kontrollzentrum (SPEC 10). Für sie gilt: kein Brief doppelt (eindeutig je Event und Spieler), KI-Aufrufe nie innerhalb von Transaktionen, ein geplanter Brief geht auch ohne KI, Spielerbriefe gelten erst nach dem Start der Antwort als beantwortet. Flüge der Bots laufen über die normale Flug-Engine (Hooks, `holder_kind = 'bot'`).
- Adminpanel und Kontrollzentrum teilen Anmeldung, API-Baustein und Sprache (`admin/src/lib`, `backend/src/admin/panel-auth.ts`), bleiben aber in Zugang, Cookie, Sitzungen und Origin vollständig getrennt.
- Zustand des angemeldeten Kontos, den der Browser im Arbeitsspeicher hält, meldet sich mit `onSignOut` (`web/src/lib/auth.svelte.ts`) zum Leeren an und prüft `accountGeneration()`, bevor er eine Serverantwort speichert (SPEC 5.5).
- Wartungsversionen mit Schwerpunkt Sicherheit: jede gefundene Lücke bekommt einen Test, der ohne die Korrektur fehlschlägt (Gegenprobe), und einen Eintrag im Änderungsanhang der SPEC.
- Jeder Stand lässt sich per Skript auf einem frischen Debian 13 installieren (Testmodus mit `tls internal`), ein zweiter Lauf überschreibt nichts, und er lässt sich vom Tag der vorigen Version aus ohne Datenverlust aktualisieren; ein absichtlich fehlschlagendes Update wird automatisch zurückgerollt, und `--rollback` funktioniert (SPEC 16, 17.6). Der VM-Test signiert seine Test-Tags mit einem eigenen Testschlüssel und prüft, dass unsignierte Tags abgelehnt werden; er testet nur den committeten Stand (HEAD). Steht dir keine Debian-13-VM zur Verfügung, sag das im Bericht, statt den Test stillschweigend auszulassen.
- Die Eulenbilder liefere ich im Ordner `images/` (Dateinamen: SPEC Anhang B). Liefere ich neue Bilder mit anderen Namen (z. B. in einem eigenen Ordner), benennst du sie nach Anhang B um und verschiebst sie nach `images/`. Fehlen einzelne Bilder, verwende Platzhalter (der Build warnt, bricht aber nicht ab) und liste die fehlenden Dateien im Bericht auf. Logo und App-Icons sind einfache, austauschbare SVGs.
- Kartendaten, Land/Wasser-Maske und Zeitzonen-Karte erzeugt `node tools/map/build.ts` aus Natural Earth (SHA-256 in `tools/map/sources.json`); danach `npx prettier --write web/src/lib/map/world.json shared/src/map/timezones-data.ts`. Die Ergebnisse liegen im Repository.
- Das Repository liegt bei mir im Nextcloud-Ordner. Große erzeugte Ordner (`node_modules`, `dist`, `coverage`, `test-results`) sind in `.gitignore`; VM-Images liegen außerhalb des synchronisierten Ordners (z. B. `~/.cache/posteulen-vm`).
