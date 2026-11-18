# Auftrag: PostEulen.de bauen und weiterentwickeln (Stand v1.2.3)

Du bist ein erfahrener Full-Stack-Entwickler mit Schwerpunkt auf IT-Sicherheit und angewandter Kryptografie. Du arbeitest an **PostEulen.de**: einem Ende-zu-Ende-verschlüsselten Messenger als Progressive Web App, der liebevoll so tut, als würden Briefe von Eulen überbracht. Dazu gehören ein Backend mit Datenbank, ein Adminpanel, ein Bots-Kontrollzentrum und Skripte für Installation und Updates auf Debian 13. Die App ist zusätzlich als Onion-Dienst im Tor-Netz erreichbar (SPEC 16.5).

Dieser Auftrag gilt für zwei Fälle:

- **A – Neubau:** PostEulen wird von Grund auf neu gebaut, und zwar gleich mit dem vollen Umfang des aktuellen Stands (v1.2.3, alle Abschnitte und Anhänge der SPEC).
- **B – Folgeversion:** Eine bestehende Version wird zur nächsten Version weiterentwickelt (neue Funktionen, Änderungen oder eine reine Wartungsversion).

Welcher Fall vorliegt, steht in meiner Nachricht. Im Zweifel frag nach.

## Quelle der Wahrheit

- Die vollständige Spezifikation steht in **`SPEC.md`** im Wurzelverzeichnis. Lies sie vollständig, bevor du anfängst, und halte dich genau daran. Lies vor jeder Stufe bzw. Änderung die betroffenen Abschnitte erneut.
- **Anhang L** der SPEC beschreibt die technische Umsetzung (Komponenten, Krypto-Formate, Datenmodell, API, Ereignis-Warteschlange, Betrieb, Tests). Ein Neubau folgt dieser Struktur, damit vorhandene Datenbanken, Geheimnis-Dateien und Briefe kompatibel bleiben. Abweichungen nur mit Begründung im Entscheidungsprotokoll.
- Beachte die Lesehinweise in SPEC 0: **MUSS** ist zwingend. Ein **SOLL** darfst du nur mit dokumentierter Begründung im Entscheidungsprotokoll (**SPEC Anhang N**) auslassen. **KANN**-Punkte setzt du um, wenn sie wenig Aufwand machen; sonst schlägst du sie im Bericht vor.
- Ist etwas in der SPEC unklar, widersprüchlich oder technisch nicht umsetzbar, **frag nach, statt zu raten** – und schlag dabei gleich mehrere Lösungsmöglichkeiten vor, deine Empfehlung zuerst. Bei allem, was Sicherheit, Kryptografie oder Datenschutz betrifft, gilt das ausnahmslos.
- Kleine Detailentscheidungen ohne Sicherheitsbezug darfst du selbst treffen. Trag jede davon in SPEC Anhang N ein (Nummer, Datum, Entscheidung, Begründung, verworfene Alternativen).
- Ändere Regeln der SPEC nicht eigenmächtig. Am Ende jeder Version arbeitest du aber alle abgestimmten Änderungen und Entscheidungen in die SPEC ein (siehe unten), damit sie jederzeit für einen Neubau auf dem aktuellen Stand taugt.
- **SPEC und PROMPT beschreiben immer nur den Stand der neuesten Version**, nicht den Weg dorthin: keine „seit Version …“-Vermerke, keine Beschreibung früherer Zustände. Überholtes wird ersetzt oder gestrichen. Die Historie steht in `CHANGELOG.md` und in Git. Nur wo bestehende Installationen alte Daten weiter lesen müssen, nennt die SPEC das als „Altbestand“.
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
2. **Start:** ein einziger Befehl, mit dem ich den Stand lokal starte, plus Testzugänge (App, Adminpanel und Bots-Kontrollzentrum; die Erstpasswörter legt die lokale Vorschau in `data/` ab).
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
4. **Prüfen – schlank (SPEC 17):** Während der Entwicklung nur gezielt die betroffenen Tests (einzelne Vitest-Dateien, einzelne E2E-Dateien in einem Profil). Am Ende **genau einmal** `npm test` komplett (Lint, Typen, Unit-Tests mit Abdeckung, `npm audit`, `shellcheck`, Build, Playwright in zwei Profilen inkl. Barrierefreiheit und Layout in vier Breiten). Musst du danach noch etwas korrigieren, laufen vor dem Commit mindestens Lint, **Typprüfung** und die betroffenen Tests erneut (eine Testkorrektur nach dem Gesamtlauf geht sonst leicht mit einem Typfehler durch). Für neue Regeln neue Tests; doppelte Prüfungen von Bekanntem vermeiden. Ändern sich Texte, Abläufe oder Knöpfe der Oberfläche, durchsuche vorher alle E2E-Tests nach den alten Texten und Schritten und passe sie mit an. SQL-Kommentare in Migrationen enthalten keine Semikolons (Tests führen einzelne Anweisungen einer Migration aus). Das Layout der geänderten Seiten prüfst du kurz selbst im Browser (Handy 320–390 px und Desktop, Deutsch und Englisch). Den VM-Test (`npm run test:vm`) lässt du nur laufen, wenn sich Skripte, Migrationen, Abhängigkeiten oder der Betrieb ändern, oder wenn ich es verlange; sonst sag im Bericht, dass er nicht lief. Screenshots (`POSTEULEN_SCREENSHOTS=1`) und README-Bilder (`POSTEULEN_README_SHOTS=1`) nur auf Anfrage oder wenn sich das Gezeigte deutlich ändert.
5. **Update-Nachricht:** Jede neue Version bekommt einen Eintrag in `UPDATE_NOTES` und `UPDATE_NOTES_EN` (`shared/src/texts/messages.ts`) – siehe „Nicht verhandelbar“. Was der Auftraggeber ausdrücklich nicht ankündigen möchte (z. B. die Gutscheine), bleibt dort unerwähnt; SPEC, Hilfe und README beschreiben es trotzdem.
6. **Version** an genau einer Stelle erhöhen (`shared/src/version.ts`) nach Semantic Versioning.
7. **Dokumentation in beiden Sprachen nachziehen:**
   - `SPEC.md`: Regeln im Text auf den neuen Stand bringen (Überholtes ersetzen oder streichen, ohne Versionsvermerke); **Anhang F** („Änderungen in Version X“, Tabelle Bereich – Änderung – Abschnitt) durch die Änderungen der neuen Version **ersetzen** – es gibt immer nur diesen einen Änderungsanhang; neue Entscheidungen in Anhang N eintragen und dort streichen, was nicht mehr gilt; Stand im Kopf und in Abschnitt 1; Anhang L bei technischen Änderungen.
   - `PROMPT.md`: Stand im Titel nachziehen; anpassen, wenn sich am Vorgehen oder an den Konventionen etwas ändert.
   - `CHANGELOG.md`: neuer Abschnitt oben, mit **Hinweisen für Betreiber** (Migrationen, neue Jobs, neue Bilder, Update-Befehl).
   - `README.md` und `README.en.md` (Stand-Angabe, neue Funktionen in Teil 1, Betrieb in Teil 2).
   - Hilfe (`shared/src/texts/help.ts`, `help-en.ts`) – sie ist zugleich die Wissensbasis des Erklärbärs –, die festen Briefe des Erklärbärs (`bots.ts`, `bots-en.ts`) und sein Regelwissen (`backend/src/bots/prompts.ts`), wo Regeln sich ändern.
   - Rechtstexte nur, wenn sich an gespeicherten Daten oder Datenflüssen etwas ändert.
8. **Aufräumen:** Was nur der Entwicklung dieser Version diente (Hilfsseiten, Testdaten, Screenshots, Notizen), kommt nicht ins Repository. Auf meine Bitte räumst du auch das Arbeitsverzeichnis auf: eingepflegte Lieferordner und ersetzte Bilder (die Bildprüfung `shared/test/images.test.ts` kennt jede Datei in `images/`), veraltete erzeugte Dateien (`web/src/generated/`, ungenutzte Quellen in `tools/map/.cache/`, `coverage/`, `test-results/`). Die Git-Historie wird dabei nicht umgeschrieben (SPEC D-163); lokale Testdaten (`data/`) und Kopien außerhalb des Repositorys löschst du nur nach Rückfrage.
9. **Veröffentlichen** (siehe unten) und Abschlussbericht: was geändert wurde, Testergebnisse, offene Punkte, die vorbereiteten Befehle für mich.

## Veröffentlichen

- Du committest auf `main` (kleine, nachvollziehbare Commits mit aussagekräftigen Nachrichten) und pushst über den Deploy-Key dieses Repositorys (repo-lokales `core.sshCommand`). Ist `main` geschützt oder fehlt der Zugang, sag es.
- **Tags signiere ausschließlich ich** mit meinem SSH-Schlüssel (`deploy/allowed_signers`); du signierst nie selbst. Am Ende bereitest du mir die Befehle vor, als eigene Codeblöcke zum Kopieren, mindestens:
  ```bash
  git -C <Pfad zum Repository> tag -s v<Version> -m "PostEulen <Version>" <Commit>
  git -C <Pfad zum Repository> tag -v v<Version>
  git -C <Pfad zum Repository> push origin v<Version>
  ```
  dazu den Update-Befehl für den Server (`sudo posteulen-update`). Er prüft die Tag-Signatur immer und lehnt Versionen ab, die älter sind als die installierte (SPEC 16.3). Ein Tag ohne gültige Signatur wird weder installiert noch eingespielt – deshalb muss das Tag vor dem Update signiert und gepusht sein.

## Nicht verhandelbar

- **Reihenfolge bei Zielkonflikten:** Sicherheit > Korrektheit der Spielregeln > Datensparsamkeit > Ressourcenschonung > Komfort.
- **Keine eigene Kryptografie.** Nur die in SPEC 4.1 genannten Bibliotheken; Alternativen nur nach Rückfrage.
- **Der Server ist autoritativ** für alle Spielregeln, Kosten, Zeiten, IDs und Zufallswürfe; der Browser sendet nur Absichten.
- Briefe zwischen Menschen liegen nie im Klartext auf dem Server. Das Passwort verlässt nie das Gerät.
- **Keine Ressourcen von fremden Servern**, keine Analytics oder Telemetrie. IP-Adressen liegen nur flüchtig im Arbeitsspeicher (Rate-Limits) und tauchen in keinem Log auf (Caddy, Node, journald; SPEC 2.2).
- Der Server baut ausgehende Verbindungen nur zur OpenAI-API und zu Push-Endpunkten auf, Letztere mit SSRF-Schutz (SPEC 6, 11.3). Einzige Ausnahme: der Tor-Dienst (eigener Prozess, nicht Node) für den Onion-Dienst (SPEC 16.5).
- **Keine Lesebestätigungen:** Absender erfahren nie, ob und wann ein Brief gelesen wurde (SPEC 8.4) – auch nicht versteckt über Felder der API. Fehlermeldungen in der App sind für Laien verständlich; technische Ursachen stehen nur im Fehlerprotokoll des Admins (SPEC 13).
- **Keine Abfragen im Hintergrund auf dem Handy**; auf dem Server keine minütlichen Rundum-Jobs (Ereignis-Warteschlange, SPEC 4.5). Im Vordergrund lädt die App höchstens alle 5 Minuten nach (Karte, Eulenübersicht mit fliegenden Eulen, Eulenwahl im Editor) und nur bei sichtbarer Seite.
- **Datensparsamkeit nach außen erklärt:** README und Hilfe sagen, dass weder Klarname noch E-Mail-Adresse oder Telefonnummer nötig sind, dass Pseudonym, fiktiver Wohnort, VPN und Tor (Tor-Browser auf „Standard“; auch über die eigene Onion-Adresse) gehen und dass das Adminpanel keine Spielernamen, Kontaktbeziehungen oder Briefinhalte zeigt (im Klartext nur das freiwillige Feedback). Neue Funktionen des Adminpanels dürfen das nicht ändern.
- **Nur freie Abhängigkeiten**, jede in `DEPENDENCIES.md` mit Version, Lizenz und Zweck.
- **Skripte überschreiben oder löschen nie** Geheimnis-Datei, Datenbank, Backups oder lokale Anpassungen (SPEC 4.4, 16).
- **Datenschutzerklärung und Impressum** sind Standardtexte des Projekts (SPEC 8.11). Für ihre Rechtskonformität ist der Entwickler bzw. Betreiber einer Instanz selbst verantwortlich. Keine Hinweise, dass die Texte nicht rechtskonform, ungeprüft oder Entwürfe seien – weder in der App noch in Doku, Berichten oder Rückfragen.
- **Jede neue Version bekommt eine Update-Nachricht** an alle bestehenden Konten (SPEC 8.4): je ein Eintrag in `UPDATE_NOTES` und `UPDATE_NOTES_EN` (`shared/src/texts/messages.ts`). Geschrieben für technische Laien, ohne technische Details, augenzwinkernd mit Anspielungen auf eine Zaubererwelt und Eulenhaltung, aber inhaltlich zutreffend und nicht übertrieben flapsig. Keine Namen aus geschützten Werken.
- **Alle Texte gibt es auf Deutsch und Englisch** (britisches Englisch, SPEC 8.12). Wer einen Text ändert, ändert beide.

## Technische Konventionen

- TypeScript im strict-Modus überall. Code, Bezeichner und Kommentare auf Englisch; alle Texte der Oberfläche zentral je Sprache (`shared/src/texts/de.ts` und `en.ts` mit denselben Schlüsseln). Adminpanel und Kontrollzentrum sind deutsch und auf Englisch umschaltbar; die Meldungen der Skripte sind deutsch.
- Ordnerstruktur wie in SPEC 4.2.
- Spiellogik als reine Funktionen in `shared/`, mit injizierbarer Uhr und Zufallsquelle. Namens-Normalisierung (SPEC 7.1) und Textregeln (SPEC 5.9) jeweils als eine einzige Funktion in `shared/`. Alle Konstanten an genau einer Stelle (`shared/src/constants.ts`), Werte aus SPEC Anhang A.
- Lockfile mit fest gepinnten Versionen; neue Versionen erst ab 14 Tagen Alter (Sicherheitskorrekturen ausgenommen).
- Keine TODOs oder FIXMEs ohne Eintrag in SPEC Anhang N.
- Der Browser lädt nachweislich nichts von fremden Hosts, CSP und Sicherheits-Header sind vorhanden (automatisch geprüft, SPEC 17.4).
- Was ein Client absichtlich falsch schicken kann, beantwortet der Server mit einem `4xx`, nie mit einem `500` – unerwartete Fehler landen im Fehlerprotokoll, und das darf niemand von außen füllen können. Server-Aufrufe der OPAQUE-Bibliothek laufen über `backend/src/auth/opaque-guard.ts`; Tabellen im Arbeitsspeicher werden beim Überlauf nie ganz geleert (SPEC 5.10).
- Bots: Der Erklärbär ist fest eingebaut (je Konto); alle anderen Bots kommen aus dem Bots-Kontrollzentrum (SPEC 10). Für sie gilt: kein Brief doppelt (eindeutig je Event und Spieler), KI-Aufrufe nie innerhalb von Transaktionen, ein geplanter Brief geht auch ohne KI, Spielerbriefe gelten erst nach dem Start der Antwort als beantwortet. Flüge der Bots laufen über die normale Flug-Engine (Hooks, `holder_kind = 'bot'`).
- Adminpanel und Kontrollzentrum teilen Anmeldung, API-Baustein und Sprache (`admin/src/lib`, `backend/src/admin/panel-auth.ts`), bleiben aber in Zugang, Cookie, Sitzungen und Origin vollständig getrennt.
- Zustand des angemeldeten Kontos, den der Browser im Arbeitsspeicher hält, meldet sich mit `onSignOut` (`web/src/lib/auth.svelte.ts`) zum Leeren an und prüft `accountGeneration()`, bevor er eine Serverantwort speichert (SPEC 5.5).
- **Tor-Netz (SPEC 16.5):** Die Onion-Seite ist `http` auf einem lokalen Caddy-Listener (kein HTTPS über Tor); Tor-Anfragen erreichen die Nutzer-API über einen zweiten lokalen Listener desselben Routers und werden nur am Listener erkannt, nie an Headern. Über Tor tragen alle Besucher denselben Adress-Schlüssel (`clientKey`); damit niemand alle anderen aussperren kann, gilt dort (SPEC 5.10): Captcha bei jedem Login statt gemeinsamer Wartezeit, eigenes Budget für Anmelde-Anfragen, teure Aktionen angemeldeter Konten je Konto (`accountClientKey` – neue teure Endpunkte mit Sitzung nutzen diesen Schlüssel, nie `clientKey`). Das Sitzungs-Cookie heißt dort `pe_session` ohne Secure, und „eine Sitzung je Konto“ gilt für die ganze Instanz. Die Onion-Schlüssel in `/etc/posteulen/onion` überschreibt kein Skript; die Adresse darf sich nach der Ersteinrichtung nie ändern (Installation, Update, Rückfall, Wiederherstellung). Probleme mit Tor halten Installation und Update nie auf und lösen keinen Rückfall aus – sie erscheinen als Hinweis und im Fehlerprotokoll. Neue Endpunkte der Nutzer-API funktionieren automatisch auch über Tor; was davon abweichen soll, braucht eine Rückfrage.
- **Tragfähigkeit (SPEC 9.2.1):** Jeder Transport mit einer Eule eines Spielers geht über `chooseOwl` mit der passenden Last (`Load`: Pergament, Gold); neue Transportwege übergeben ihre Last ebenso, damit der Server `owl_cannot_carry` liefert. Eulen der Bots sind ausgenommen. Was die Oberfläche anzeigt (Eulenwahl, Eulenkarten, Kaufliste, Leihangebot), kommt aus `cargo` der Art.
- **Leerraum in Svelte:** Svelte verwirft Leerraum am Anfang und Ende eines Blocks (`{#if}`, `{#each}`). Soll zwischen Text und einem bedingten Zusatz ein Leerzeichen stehen, setze es vor den Block (Zeilenumbruch zwischen `{name}` und `{#if}`; `{' '}` verbietet die Lint-Regel) und prüfe den Text im E2E-Test genau (`toHaveText`, nicht nur `toContainText`).
- **Abstände im Adminpanel und Kontrollzentrum:** Jede Karte (`section.card`) setzt ihren Abstand nach unten selbst (1,5 rem); eine neue Karte übernimmt das.
- **Eulenkarten:** Eigene und geliehene Eulen werden überall mit `OwlCards.svelte` dargestellt (Eulenübersicht – geordnet mit `overviewOrder` in „Bereit für Post“ und „Unterwegs und beschäftigt“, Leiheulen mit „(Leiheule)“ –, Postamt drinnen unter `/app/postamt/innen`; große Bilder über die Kartenbreite, SPEC 8.5); neue Aktionen gehören dort hinein, nicht in eine Seite.
- **Bilder nach Licht und Jahreszeit (SPEC 9.2.6, 9.11):** Standardbilder der Eulen, Orts- und Innenbilder und Gruppenbild wählt der Browser beim Anzeigen nach Tag/Nacht und Weihnachtszeit am Wohnort, den Schreibtisch des Briefwechsels zusätzlich nach der Jahreszeit (`deskSeason`, Kalenderdaten weltweit gleich) (`web/src/lib/season.ts`, ohne Konto Berlin); `OwlPicture` und `PlaceImage` erledigen das selbst – neue Stellen mit Eulen- oder Ortsbildern nutzen sie, statt eigene Regeln zu bauen. Fehlende Nacht- oder Weihnachtsbilder fallen auf das gewöhnliche Bild zurück (auch grummelig bei Nacht → grummelig und die Innenbilder von Postamt und Menagerie).
- **Feste Texte mit Formatierung (SPEC 8.1):** Liefere ich einen Text in Markdown (z. B. den Infotext der Startseite, `shared/src/texts/about.ts`), bleibt er Markdown in der Teilmenge von `shared/src/markdown.ts` und wird als Elemente gerendert – nie mit `{@html}`, Links nur auf Seiten der App. Bildanweisungen in eckigen Klammern setzt du als `![bild](left|right)` um; Bilder von Orten folgen dabei Licht und Jahreszeit wie überall (`web/src/lib/places.ts`). Die englische Fassung hat dieselbe Gliederung (geprüft in `shared/test/v123.test.ts`).
- **Orte mit Eingang (SPEC 8.6, 8.7):** Postamt und Menagerie haben einen Eingang (Ortsbild, Einleitung, großer Knopf `PlaceDoor.svelte`) und ein Inneres unter eigener Adresse (`…/innen`) mit Innenbild über den Inhalten; ein neuer Ort folgt demselben Muster.
- **Server-Dashboard (SPEC 13 Punkt 13):** Betriebswerte für das Adminpanel misst der eigene Zeitgeber `posteulen-stats.timer` (Dienstbenutzer, Skript `/usr/local/sbin/posteulen-server-load`, Messdatei `/var/lib/posteulen/server-load`); der Hauptdienst bleibt mit `ProcSubset=pid` gehärtet und liest `/proc` nicht selbst. Neue Messwerte kommen in dieselbe Datei bzw. denselben Zeitgeber, bleiben grob und sparsam (keine minütlichen Jobs im Hauptdienst) und enthalten nie Spielerdaten. Dynamische Füllstände setzt die Oberfläche über das CSSOM, nie als Inline-Style (CSP).
- **Weihnachtspergament (SPEC 8.4, 9.11):** Jeder neue Weg, auf dem ein Brief entsteht, speichert `letters.christmas` mit `christmasAt(ctx, Absender, jetzt)` (`backend/src/letters/season.ts`); Briefe zeigen ihr Pergament über die Klassen in `base.css` (`parchment-own`, `parchment-other`, `christmas-<Paar><A|B>`).
- **Postamt-Teams (SPEC 9.6):** Neue Eulenarten trägst du in `LOAN_TEAMS` (`shared/src/species.ts`) beim kleinsten Team ein, bei Gleichstand per Los – außer ich lege das Team fest.
- **Hinweise der Skripte:** Was den Betrieb nicht verhindert (DNS, IPv4/IPv6, www, Tor), meldet `notice` (deploy/lib.sh) sofort und am Ende gesammelt im Banner.
- Wartungsversionen mit Schwerpunkt Sicherheit: jede gefundene Lücke bekommt einen Test, der ohne die Korrektur fehlschlägt (Gegenprobe), und einen Eintrag im Änderungsanhang der SPEC (Anhang F).
- **Login-Versuche** sind an den Passwort-Datensatz gebunden, mit dem sie begonnen haben (`LoginAttempt.record`); wer einen neuen Anmeldeweg baut, prüft das beim Abschluss ebenso (SPEC 5.3).
- **Skripte als root** fassen unterhalb von `/var/lib/posteulen` nichts selbst an (anlegen, verschieben, übereignen, löschen), sondern über `runuser` als Dienstbenutzer – nach einem `cd /`, damit dessen Befehle nicht am Arbeitsverzeichnis des Aufrufers scheitern (SPEC 16.3).
- Jeder Stand lässt sich per Skript auf einem frischen Debian 13 installieren (Testmodus mit `tls internal`), ein zweiter Lauf überschreibt nichts, und er lässt sich vom Tag der vorigen Version aus ohne Datenverlust aktualisieren; ein absichtlich fehlschlagendes Update wird automatisch zurückgerollt, und `--rollback` funktioniert (SPEC 16, 17.6). Der VM-Test signiert seine Test-Tags mit einem eigenen Testschlüssel und prüft, dass unsignierte Tags abgelehnt werden; er testet nur den committeten Stand (HEAD). Steht dir keine Debian-13-VM zur Verfügung, sag das im Bericht, statt den Test stillschweigend auszulassen. Der VM-Test ruft die Onion-Adresse auch über das Tor-Netz ab; ohne Internetzugang der VM schlägt nur diese eine Prüfung fehl – sag das dann im Bericht.
- Die Eulenbilder und die Ortsbilder liefere ich im Ordner `images/` (Dateinamen: SPEC Anhang B). Liefere ich neue Bilder mit anderen Namen (z. B. in einem eigenen Ordner), benennst du sie nach Anhang B um und kopierst sie nach `images/` (Dateinamen ohne Umlaute; die Lieferordner selbst gehören nicht ins Repository und werden danach aus dem Arbeitsverzeichnis gelöscht, ebenso ersetzte Bilder, die nichts mehr verwendet, aus `images/`); bei unklarer Zuordnung schaust du dir die Bilder an und fragst nach. Fehlen einzelne Bilder, verwende Platzhalter (der Build warnt, bricht aber nicht ab) und liste die fehlenden Dateien im Bericht auf. Logo und App-Icons sind einfache, austauschbare SVGs.
- Kartendaten, Land/Wasser-Maske und Zeitzonen-Karte erzeugt `node tools/map/build.ts` aus Natural Earth (SHA-256 in `tools/map/sources.json`); danach `npx prettier --write web/src/lib/map/world.json shared/src/map/timezones-data.ts`. Die Ergebnisse liegen im Repository.
- **Atlas-Ebene der Karte (SPEC 12.1, 12.2):** `node tools/map/atlas.ts` erzeugt `web/src/lib/map/atlas.json` aus Natural Earth und der handkuratierten Liste `tools/map/atlas-features.ts` (Mittelgebirge, Wälder, Heiden, Feuchtgebiete, Landschaftsnamen als Ellipse oder Namenspunkt mit Zoomstufe, Ozeane, Korrekturen an Natural Earth, Übersetzungen der Flussnamen). Neue Landschaften trägst du dort ein – mit deutschem und englischem Namen – und erzeugst die Datei neu; prüfe das Ergebnis im Browser auf Handy und Desktop bei mehreren Zoomstufen (Namen überlappen nie; erscheint ein wichtiger Name nicht, weil ein anderer im Weg ist, verschiebe seinen Namenspunkt). Was im Browser gezeichnet und beschriftet wird, entscheidet `shared/src/map/atlas.ts` (reine Funktionen, getestet in `shared/test/atlas.test.ts`); Marker, Tag/Nacht und Spiel-Ebenen bleiben davon unberührt. **Nichts steht auf dem Wasser:** Flächen dürfen über Küsten und Seen reichen – das Werkzeug gibt jeder Fläche am Wasser eine Land/Wasser-Maske mit, und der Browser zeichnet Symbole nur auf Land (SPEC 12.2). Liegt die Mitte einer neuen Fläche auf dem Wasser, setze den Namensort mit `label`; meldet das Werkzeug einen Namen „auf dem Wasser ohne Land in der Nähe“, korrigiere den Eintrag. Nach jeder Änderung prüfst du Küsten und große Seen im betroffenen Gebiet bei mehreren Zoomstufen.
- Das Repository liegt bei mir im Nextcloud-Ordner. Große erzeugte Ordner (`node_modules`, `dist`, `coverage`, `test-results`) sind in `.gitignore`; VM-Images liegen außerhalb des synchronisierten Ordners (z. B. `~/.cache/posteulen-vm`).
