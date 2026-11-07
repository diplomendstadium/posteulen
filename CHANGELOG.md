# Changelog

Alle Versionen von PostEulen.de. Format: neueste Version oben. Jede Version enthält einen
Abschnitt **Hinweise für Betreiber**.

## v0.6.1 – Neue Schlösser

Wartungsversion ohne neue Funktionen: Sicherheitsprüfung mit Schwerpunkt auf Kryptografie, Schutz
der Nutzer und Briefinhalte sowie Schutz des Servers vor Angriffen und Missbrauch. Jede gefundene
Lücke ist geschlossen und hat einen eigenen Test (SPEC Anhang O).

- **Passwort-Raten:** Mehrere gleichzeitige Anmeldeversuche mit derselben Captcha-Lösung kamen alle
  durch, und die Wartezeit wurde erst danach gezählt. Jetzt gilt eine Lösung genau einmal, und die
  Wartezeit wird nach der Captcha-Prüfung erneut geprüft.
- **Zählertabellen:** Liefen die Fehlversuchs- und Rate-Limit-Tabellen im Arbeitsspeicher voll (z. B.
  mit vielen IPv6-Präfixen), wurden sie komplett geleert – samt den Zählern eines angegriffenen Kontos.
  Jetzt wird gezielt Platz gemacht. Der geheime Captcha-Zähler kommt aus dem sicheren Zufall statt aus
  `Math.random`.
- **Geteilte Adressen:** Erfolgreiche Anmeldungen zählten beim IP-Zähler als Fehlversuch (nach etwa
  zehn Anmeldungen pro Tag bekam eine geteilte Adresse ein Captcha). Ein Erfolg nimmt jetzt seinen
  eigenen Fehlversuch zurück.
- **Serverfehler von außen:** Formal gültige, aber kryptografisch kaputte OPAQUE-Nachrichten und nicht
  dekodierbare Base64-Längen führten zu einem 500-Fehler mit Eintrag im Fehlerprotokoll – auslösbar ohne
  Konto. Jetzt `400` ohne Eintrag.
- **Konten:** Registrierung und Passwortwechsel speichern nur Datensätze, mit denen eine Anmeldung möglich
  ist, und nur gültige öffentliche Schlüssel. Ein abgelehnter Datensatz verbraucht das Wechsel-Token nicht.
- **Sitzungen:** Ein Passwortwechsel beendet auch die Live-Verbindungen der alten Sitzungen. Abgelaufene
  Sitzungen werden täglich gelöscht statt erst beim nächsten Login.
- **Browser:** Nach dem Abmelden blieb der entschlüsselte Kontakt-Tresor im Arbeitsspeicher; meldete
  sich danach ein anderes Konto im selben Tab an, nutzte es ihn weiter (z. B. „Sicherheitsnummer
  verglichen“ des vorigen Kontos). Jetzt werden Tresor und Listen geleert und verspätete Antworten
  verworfen.
- **Schlüsselbindung:** Der Browser vergleicht die Schlüssel eines Kontakts jetzt auch beim Öffnen des
  Briefwechsels (SPEC 5.7) und prüft bei jedem Brief zusätzlich den signierten Sendezeitpunkt und dass
  der Brief zu diesem Briefwechsel gehört.
- **Verkleidete Links:** Links mit Nicht-ASCII-Zeichen oder Zugangsdaten im Host erscheinen in Punycode
  mit dem Hinweis „Ungewöhnliche Zeichen in der Adresse“.
- **SSRF:** Sperrliste für Push-Endpunkte um IPv4-kompatible und -übersetzte IPv6-Adressen, `3fff::/20`
  und `5f00::/16` ergänzt.
- **Missbrauch:** Push-Abo und Test-Push höchstens 10-mal pro Stunde und Konto. Gleiche Meldungen im
  Fehlerprotokoll werden innerhalb einer Stunde zusammengefasst (Zähler und letztes Auftreten im
  Adminpanel).
- **Signaturen:** `install.sh` und `posteulen-update` prüfen die Tag-Signatur jetzt immer (auch den im
  Tag eingetragenen Namen); abschalten nur mit `--no-verify-tags`. `install.sh` zeigt den Fingerabdruck
  des Signaturschlüssels. Der VM-Test signiert seine Test-Tags mit einem eigenen Schlüssel und prüft,
  dass unsignierte und umbenannte Tags abgelehnt werden.
- **Lokale Vorschau:** strengere Pfadprüfung im Vorschau-Server.
- **Tests:** neue Unit-Tests (`backend/test/v061.test.ts`, `shared/test/links.test.ts`) und E2E-Tests
  (`e2e/v061.spec.ts`); Zeitlimit je Unit-Test 20 s.
- SPEC (Stand 0.6.1, Anhang O, Entscheidungen D-169 bis D-183), PROMPT, README, Hilfe und Erklärbär
  de/en angepasst.

### Hinweise für Betreiber

- **Datenbank-Migration `0013_v061.sql`** (Schema 13): zwei neue Spalten im Fehlerprotokoll (`count`,
  `last_at`). Läuft beim Update automatisch.
- **Dieses Update einmal mit Signaturprüfung von Hand starten** – der Update-Befehl von 0.6.0 prüft
  nur auf Wunsch: `sudo posteulen-update --verify-tags`. Ab 0.6.1 ist die Prüfung Standard; eigene,
  unsignierte Stände brauchen künftig `--no-verify-tags`.
- `install.sh` installiert zusätzlich `openssh-client` (für `ssh-keygen`, das die Signatur prüft; auf
  Debian-Servern meist schon vorhanden).
- Keine neuen Bilder, keine neuen npm-Pakete.
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.6.1.

## v0.6.0 – Großer Hausputz

Wartungsversion ohne neue Funktionen: Die App wurde gründlich gegen die Spezifikation geprüft, alle
Texte (de/en) korrekturgelesen, Spielmechanik und Layout getestet und das Repository aufgeräumt.

- **Schmale Handys:** Bei 320–390 px schoben ein dreistelliger Goldstand und „Neue Post!“ Goldanzeige
  und Fähnchen aus dem Fenster. „Neue Post!“ steht dort jetzt in einer eigenen Zeile.
- **Layout:** Lange Überschriften (z. B. „Benachrichtigungen“) brechen bei 320 px um, die Beschriftungen
  der unteren Leiste passen. Neuer Test prüft alle Seiten in acht Breiten (320–1920 px), Deutsch und
  Englisch, in Chromium, Firefox und WebKit.
- **Namen:** Die englischen Bot-Namen sind reserviert („Explainer Bear“, „Aunt …“, „Uncle …“,
  „System messages“, „Unknown“), damit sich niemand als Bot ausgeben kann.
- **Texte:** Wohnort mit N/S und O/W statt Minuszeichen; Karte nennt richtig „alle 5 Minuten“;
  Fehlermeldung nennt vier Leiheulen; „Das Konto von … wurde gelöscht“ (passt auch zur automatischen
  Löschung); Hilfe ohne die veraltete 10-Stunden-Schlafpause, mit „nicht lesbar“ und dem Onkel nach
  14 Tagen; Datenschutz nennt den lokal gespeicherten ausgeblendeten Benachrichtigungs-Hinweis; viele
  kleine Korrekturen in beiden Sprachen.
- **Karte:** Schlug das Laden der Land/Wasser-Maske einmal fehl (offline oder beim Seitenwechsel),
  merkte sich die App den Fehler bis zum Neuladen; jetzt lädt sie beim nächsten Tippen neu.
- **Technik:** Grenzen für die Request-Größe als Konstanten (Briefversand 512 KiB, Briefe an Bots
  128 KiB).
- **Repository:** Stufen-Screenshots, `PROGRESS.md`, `SECURITY-REVIEW.md`, die Messseite `/messung`
  sowie `ARCHITECTURE.md` und `DECISIONS.md` entfernt; ihr wesentlicher Inhalt steht jetzt in der SPEC
  (Anhang L: technische Umsetzung, Anhang N: Entscheidungsprotokoll). `PROMPT.md` ist der Bauauftrag
  für den aktuellen Stand und beschreibt den Ablauf für Folgeversionen. `DEPENDENCIES.md` auf den
  tatsächlichen Stand gebracht.
- SPEC (Stand 0.6.0, Anhang M), README, Hilfe de/en angepasst.

### Hinweise für Betreiber

- **Keine Datenbank-Migration**, keine neuen Bilder, keine neuen Pakete.
- Konten, deren Name mit „Aunt“ oder „Uncle“ beginnt oder „Explainer Bear“ lautet, bleiben unverändert;
  neu vergeben werden solche Namen nicht mehr.
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.6.
- Update: `sudo posteulen-update`.

## v0.5.1 – Schlafende Eulen

- **Schlafbilder:** Macht eine Eule unterwegs eine Schlafpause, zeigt die Eulenübersicht sie schlafend
  – bei Tag oder bei Nacht, je nach ihrer Position.
- **Nickerchen zu Hause:** Ist es am Wohnort hell, döst eine gesunde Eule bei jedem Öffnen der
  Eulenübersicht mit 50 % Wahrscheinlichkeit; nachts und in den 10 Minuten nach einer Pflege nie.
- **Preise:** Sumpfohreule 7 Gold (vorher 16), Bartkauz 12 Gold (vorher 19).
- Hilfe, Erklärbär, README und SPEC (Anhang K) de/en angepasst.

### Hinweise für Betreiber

- **Datenbank-Migration 0012** (läuft beim Update automatisch): neue Spalte `owls.cared_at`.
- 54 neue Bilder in `images/` (drei Schlafbilder je Art, zusammen 289).
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.5.1.
- Update: `sudo posteulen-update`.

## v0.5.0 – Motivation und ein Phönix

- **Motivation:** Jede Eule hat neben der Energie einen Motivationsbalken (0,8–1,2). Er sinkt jede
  Nacht um 0,1 und steigt durch Pflege. Beim Abflug gilt er für die ganze Reise: Energie,
  Geschwindigkeit und Erholung unterwegs ändern sich entsprechend (1,2 = +20 %). Die
  Eulenübersicht zeigt Geschwindigkeit (km/h) und Erholung (%/h) mit ±x %.
- **Mehr Pflege:** Wasser geben (kostenlos, einmal am Tag) und Lieblingsleckerli der Art (0,2 Gold,
  einmal am Tag, +20 % Energie), neben Streicheln und Eulenkeks; neue Bilder dazu. Gegen
  Krankheit zählt ein Tag mit zwei verschiedenen Pflege-Aktionen.
- **Schlaf unterwegs:** Eine leere Eule schläft nur so lange, wie sie bis zum nächsten Ziel braucht,
  und erholt sich dabei wie zu Hause (statt immer 10 Stunden).
- **Phönix:** neue Art für 100 Gold (2 000 Energie, 100 km/h, 20 %/h); nie Leiheule, keine Eier,
  kein Verleih an die Menagerie.
- **4 Leiheulen** am Tag, alle leihbar.
- **Menagerie:** neue Beschreibungen, Werte in km/h und %/h.
- **Nicht lesbare Briefe:** Der Absender sieht „nicht lesbar“ statt „gelesen“, wenn der Empfänger
  einen Brief nicht prüfen konnte.
- **Update-Hinweis** bleibt nach dem Neuladen nicht mehr hängen (installierte App auf Android).
- Hilfe, Erklärbär, README (de/en) und SPEC (Abschnitt 9.3a, Anhang J) auf Stand v0.5.

### Hinweise für Betreiber

- **Datenbank-Migration 0011** (läuft beim Update automatisch): neue Spalten `owls.motivation`
  (alle vorhandenen Eulen starten mit 1,0), `owls.watered_on`, `owls.snacked_on`,
  `letters.unreadable`.
- Neuer täglicher Job um 00:00 UTC (Motivation −0,1).
- Neue Bilder in `images/` (Trinken und Leckerli je Art, 12 Phönix-Bilder, zusammen 235); der
  Build dauert beim ersten Mal etwas länger.
- Eulen, die beim Update unterwegs sind, schlafen nach ihrem alten Plan; neue Flüge nutzen die
  neue Schlafregel.
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.5.
- Update: `sudo posteulen-update`.

## v0.4.0 – PostEulen spricht Englisch

- **Englische Ansicht:** Oben rechts auf jeder Seite ein kleines britisches Fähnchen; ein Tipp stellt
  die ganze App auf Englisch um, das deutsche Fähnchen wieder zurück. Deutsch bleibt Standard. Vor
  der Anmeldung merkt sich das Gerät die Wahl; ein Konto, das in der englischen Ansicht erstellt
  wird, ist englisch, und nach der Anmeldung gilt immer die Sprache des Kontos. Neue Einstellung
  „Sprache“. Übersetzt sind Oberfläche, Hilfe, Datenschutz, Impressum, Systemnachrichten,
  Benachrichtigungen, Karte (Länder und Städte), Eulenarten und ihre Beschreibungen; Erklärbär
  („Explainer Bear“), Tante und Onkel schreiben und antworten in der Kontosprache, Leiheulen und
  Küken bekommen englische Namen.
- **Mehr Gold:** In den ersten 30 Tagen nach der Kontoerstellung gibt es täglich 3,0 Gold, danach
  2,0 Gold (bisher 1,0).
- **Leiheulen** fliegen jetzt auch zu bis zu 5 Empfängern nacheinander (Leihpreis weiter 0,1 Gold).
- **Chats** öffnen sich beim neuesten Brief statt beim ältesten.
- **Übersicht am Desktop:** Gruppenbild und Kacheln gleich hoch, je halbe Breite.
- **Karte** immer quadratisch, passt ins Fenster, kein Blick mehr über den Kartenrand.
- Link „Spenden“ (ko-fi.com/posteulen) unten auf der Startseite.
- README auch auf Englisch (`README.en.md`); SPEC auf Stand v0.4 (Abschnitt 8.12, Anhang I).

### Hinweise für Betreiber

- **Datenbank-Migration 0010** (läuft beim Update automatisch): neue Spalte `users.language`
  (Standard Deutsch). Bestehende Konten bleiben deutsch, bis ihre Nutzer umstellen.
- Das tägliche Gold ändert sich ab dem ersten Lauf nach dem Update (15:00 UTC): Konten, die jünger
  als 30 Tage sind, bekommen 3,0, alle anderen 2,0 Gold.
- Benachrichtigungen enthalten jetzt zusätzlich die Sprache des Kontos (`lang`), weiterhin ohne
  Namen oder Inhalte.
- Wer eigene Rechtstexte pflegt: Die englischen Fassungen liegen in `shared/src/texts/legal-en.ts`.
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.4.
- Update: `sudo posteulen-update`.

## v0.3.2 – Pergament und kurze Wege

- **Leihen pro Tag:** Jede angebotene Leiheule kann einmal am Tag geliehen werden – sobald um
  Mitternacht (UTC) neue angeboten werden, sind alle sofort leihbar, auch wenn noch Leiheulen vom
  Vortag warten.
- 31 neue Namen für Leiheulen und Küken.
- **Kürzeste Route:** Mehrere Empfänger werden so vorsortiert, dass die Eule den kürzesten Weg
  fliegt; die Reihenfolge bleibt änderbar.
- **Briefe auf Pergament:** helles Pergament für Briefe an dich, dunkleres für deine eigenen;
  das Siegel entfällt.
- Gruppenbild der Eulen auf der Übersicht neben den Kacheln (am Desktop).
- README und Hilfe: PostEulen als erster Messenger für Kinder.
- SPEC auf Stand v0.3.2 (Anhang H).

### Hinweise für Betreiber

- **Datenbank-Migration 0009** (läuft beim Update automatisch): neue Tabelle `loan_days`.
- Nach dem Update bekommt jedes Konto die kurze Update-Nachricht zu 0.3.2.
- Update: `sudo posteulen-update`.

## v0.3.1 – Gruppenbild neben dem Login

- Auf der Startseite steht das Gruppenbild der Eulen jetzt neben der Anmeldung, an der Stelle des
  Waldkauzes, statt weit unten.

### Hinweise für Betreiber

- Keine Migration. Update von v0.3.0: `sudo posteulen-update`.

## v0.3.0 – Briefbögen, Weltkarte und Eulen im Flug

- **Längere Briefe:** Ein kostenloser Brief fasst jetzt 800 Zeichen, ein großes Pergament
  15 000. Große Briefe von früher bleiben lesbar.
- **Briefbögen mit Wachssiegel:** geripptes Büttenpapier mit ausgefranstem Rand, rotes Siegel,
  Briefe an dich in deutscher Schulschrift (Blauschwarz), deine eigenen in Federschrift (Sepia).
- **Neuer Seitenhintergrund:** eine verblasste Weltkarte wie mit Tinte als Aquarell auf grobem
  Papier gemalt. Alle Texte stehen in Boxen.
- **Eulen im Flug:** Die Eulenübersicht zeigt fliegende Eulen bei Tag oder unter Sternen, je nach
  Ort; eine an die Menagerie verliehene Eule zeigt ihre leere Stange. Leiheulen und eigene Eulen
  stehen unter getrennten Überschriften.
- **Flugspur auf der Karte:** dünne dunkelbraune Linie für den bisherigen Weg, „Zzz“ an
  Übernachtungsorten, die kommende Route bleibt geheim. Aktualisierung alle 5 Minuten.
- **Heimkehr:** Kommt eine Eule heim, gibt es eine Systemnachricht mit Bild (Fensterbrett bei Tag
  oder Kerzenschein) und eine Benachrichtigung.
- **Menagerie:** Leiheulen oben, Kaufeulen nach Preis sortiert und mit Beschreibung; lange Namen
  passen jetzt in ihre Karte.
- **Freilassen** nur noch mit eingetipptem Namen und zweiter Bestätigung.
- **Gelesen ist gelesen:** Ungelesen-Zähler und „Neue Post!“ gehen sofort zurück, ohne Neuladen.
- **Hinweis auf Benachrichtigungen** lässt sich bis zur nächsten Anmeldung ausblenden.
- **Bots:** Die Tante schreibt 5 Minuten nach der Anmeldung und erscheint erst dann; der
  Erklärbär erscheint auf der Karte, sobald man ihm schreibt, und erklärt in einem neuen Brief,
  wie PostEulen ohne App-Store aufs Handy kommt. Der Hinweis zur Antwortzeit im Bot-Chat entfällt.
- **Spendenbitte:** alle fünf Wochen eine freundliche, freiwillige Bitte (ko-fi.com/posteulen),
  drei Texte reihum.
- **Update-Nachricht:** Nach jedem Update erzählt eine Systemnachricht, was neu ist.
- Willkommensseite, Hilfe und Benachrichtigungs-Hinweise für technische Laien neu geschrieben;
  Gruppenbild auf der Startseite und im README.
- SPEC auf den Stand v0.3 gebracht (Anhang G).

### Hinweise für Betreiber

- **Datenbank-Migration 0008** (läuft beim Update automatisch): neue Spalte für die Spendenbitten.
- **Nach dem ersten Start** bekommt jedes bestehende Konto einmal die Update-Nachricht zu v0.3
  (ohne Push). Spendenbitten starten für bestehende Konten zum nächsten 5-Wochen-Termin ab dem
  Registrierungstag.
- Neue Bilder in `images/` (vier je Art, leere Stange, Gruppenbild); der Build dauert dadurch
  etwas länger. Neuer Seitenhintergrund `web/assets/world-map.webp`.
- Schriften: Dancing Script und Playwrite DE Grund statt Kalam und Caveat (OFL).
- Briefversand nimmt jetzt bis 512 KiB an (große Briefe an bis zu 5 Empfänger).
- Update von v0.2.0: `sudo posteulen-update`.

## v0.2.0 – Briefe wie Briefe

- **Leiheule direkt beim Briefschreiben:** Ist keine eigene Eule da, bietet die Eulenwahl die
  Leiheulen des Tages an. Geliehen und bezahlt wird erst beim Abschicken – kein Umweg über die
  Menagerie, kein Neutippen. Gilt auch für Goldsendungen und Briefe an Bots.
- Die drei Leiheulen eines Tages haben immer verschiedene Namen.
- **Alte Briefe werden gelöscht:** Alle Briefe und Systemnachrichten verschwinden spätestens ein
  Jahr nach der Zustellung unwiderruflich. In den Einstellungen lässt sich die eigene Frist auf
  30, 90 oder 180 Tage verkürzen.
- **Briefe sehen aus wie Briefe:** Schriftrollen statt Sprechblasen, eigene Briefe und die des
  Gegenübers in zwei Handschriften. Links und Namen bleiben in Druckschrift; wer mag, stellt
  ganz auf Druckschrift um.
- **„Neue Post!“** hüpft in der Statusleiste, sobald ungelesene Post da ist.
- **Karte:** größere Schrift und Symbole (vor allem auf dem Handy), Städte zur Orientierung
  (über 1 Mio. Einwohner, beim Hineinzoomen über 200 000), England, Schottland, Wales und
  Nordirland getrennt, und beim Öffnen zoomt die Karte auf alle bekannten Orte und Eulen.
- **Umzüge:** bis zu 3-mal pro Kalendermonat statt alle 21 Tage.
- **Krankheit:** Für den Pflegebonus zählen nur Tage, an denen die Eule mindestens eine Stunde
  zu Hause war – Reisetage kosten den Bonus nicht mehr.
- Einheitlich „Menagerie“ statt „Papeterie“.
- Versionsnummer auf der Startseite (Link zum Quelltext) und auf der Übersicht.
- Datenschutzerklärung ohne Entwurfshinweis und ohne die Kapitel „Verantwortlich“ und
  „Deine Rechte“.
- `README.md` mit einem Teil für Neugierige und einem für Selbst-Hoster ersetzt `readme.txt`;
  Hilfe und Erklärbär betonen, dass hinter dem Spiel ernsthafte Kryptografie steckt.
- SPEC auf den Stand v0.2 gebracht (alle Entscheidungen eingearbeitet).

### Hinweise für Betreiber

- **Datenbank-Migration 0007** (läuft beim Update automatisch): neue Spalten für Umzüge,
  Löschfrist und Druckschrift, neue Tabellen für den Pflegeverlauf, Umbenennung „papeterie“ →
  „menagerie“ (die Eulentabelle wird dabei neu aufgebaut).
- **Beim ersten Aufräumlauf um 04:00 UTC nach dem Update** werden Briefe und Systemnachrichten
  gelöscht, die älter als ein Jahr sind.
- Neue Abhängigkeiten: Schriften Kalam und Caveat (OFL). Die Kartendaten enthalten jetzt Städte.
- Update von v0.1.0: `sudo posteulen-update`.
- Datenschutzerklärung und Impressum sind Standardtexte; wer eine eigene Instanz betreibt, passt
  sie selbst an (`shared/src/texts/legal.ts`, README Abschnitt 9).

## v0.1.0 – Erste Version

Die erste vollständige Version von PostEulen.de: Ende-zu-Ende-verschlüsselte Briefe per Eule,
Eulen kaufen, leihen und pflegen, Flüge mit Tag und Nacht auf der Karte, Gold, Küken,
Erklärbär, Tante und Onkel, Push-Benachrichtigungen, Adminpanel sowie Installation, Updates
und Backups mit je einem Befehl (Stufen 0 bis 6, siehe unten).

Seit v0.1.0-stufe.6:

- Impressum ohne die Abschnitte „Angaben“ und „Hinweis“.
- readme.txt beginnt mit einer kurzen Vorstellung des Projekts.
- Behoben: Ohne Versionsangabe wählten `posteulen-update` und `install.sh` eine Vorabversion
  (z. B. v0.1.0-stufe.6) statt der fertigen Version v0.1.0. Sie sortieren jetzt nach Semantic
  Versioning.
- Behoben: Ein durch Seitenwechsel abgebrochener Abruf (Benachrichtigungsstatus, Kartendaten,
  Neuigkeiten, Anfrage zurückziehen) konnte einen unbehandelten Fehler auslösen.

### Hinweise für Betreiber

- Keine Datenbank-Migration.
- **Von einer Stufe aus einmalig mit Versionsangabe aktualisieren:** `sudo posteulen-update v0.1.0`.
  Das Update-Programm der Stufen hält v0.1.0 sonst für älter. Ab v0.1.0 genügt wieder
  `sudo posteulen-update`.

## v0.1.0-stufe.6 – Abschluss

- Hilfe zu allen Funktionen mit Inhaltsverzeichnis, häufigen Fragen, Anleitung für Android ohne
  Google-Dienste und Krisenhilfe; erreichbar vor und nach dem Login. Sie ist zugleich das Wissen
  des Erklärbärs.
- Datenschutzerklärung (Entwurf) und Impressum.
- Barrierefreiheit: automatische Prüfung nach WCAG 2.2 AA auf allen Seiten. Behoben: Eulen- und
  Kontaktnamen erschienen an einigen Stellen in der Zierschrift.
- Karte: Beschriftungen überlappen nicht mehr; Bots haben eine eigene Markerform (auch in Graustufen erkennbar).
- Angemeldet bleiben hält jetzt auch über einen Neustart des Browsers (Sitzungs-Cookie mit 30 Tagen
  gleitender Laufzeit).
- Sicherheits-Review entlang SPEC 6 (SECURITY-REVIEW.md); Endpunkte ohne Nutzdaten lehnen
  unerwartete Inhalte ab.
- Bots: Standardmodell gpt-6-luna; das Token-Budget reicht jetzt auch für Reasoning-Modelle.
- readme.txt fertiggestellt, u. a. Wiederherstellung nach einem Totalausfall auf einem neuen Server.

### Hinweise für Betreiber

- Keine Datenbank-Migration. Das Update ist von jeder früheren Stufe aus möglich.
- Wer im Adminpanel nie ein Modell gespeichert hat, nutzt ab jetzt gpt-6-luna. Ein gespeichertes Modell bleibt.
- Vor dem öffentlichen Betrieb Datenschutzerklärung und Impressum ausfüllen (readme.txt, Abschnitt 9).

## v0.1.0-stufe.5 – Bots

- Jedes Konto hat einen Erklärbären, eine Tante und einen Onkel (deutlich als Bot gekennzeichnet, auch auf der Karte).
- Feste Briefe: Erklärbär (Tag 0 sofort im Briefkasten, dann Tag 1, 2, 4, 7), Begrüßung der Tante,
  erster Brief des Onkels nach 14 Tagen; Goldsendungen: Tante 4,0 nach 2 Tagen, Onkel 10,0 nach 21 Tagen.
- Briefe an Bots (unverschlüsselt, mit dauerhaftem Hinweis und Hilfe-Nummern), höchstens einer in 24 Stunden;
  Antworten per OpenAI zwei Stunden nach Ankunft, mit Gedächtnis (Zusammenfassung + letzte 6 Briefe).
- Bots lassen sich endgültig entfernen.
- Adminpanel: OpenAI-Key (nur schreibbar, verschlüsselt gespeichert), Modell, Tageslimit, Verbindungstest.
- Behoben: Ein beim Seitenwechsel abgebrochener Abruf konnte eine Liste leeren und einen Fehler auslösen.

### Hinweise für Betreiber

- Die Datenbank wird beim Update migriert (Schema 6). Bestehende Konten bekommen einmalig ihre Bots.
- Damit Bots antworten, im Adminpanel einen OpenAI-API-Key hinterlegen und „Verbindung testen“.
  Ausgehende Verbindungen zu api.openai.com (Port 443) müssen erlaubt sein.

## v0.1.0-stufe.4 – Restliche Spielmechanik

- Menagerie: Tagesangebot mit drei Leiheulen (0,1 Gold, persönliche Namen, Verfall nach 24 Stunden);
  die Aushilfseule aus Stufe 3 entfällt.
- Papeterie: Eulen für 7 Tage verleihen, Lohn 10 % des Preises.
- Krankheiten mit täglichem Wurf, Schutzfrist (28 Tage), Pflegebonus, grummeligem Bild, Selbstpflege und Eulenarzt.
- Eier, Brüten, Schlupf von 1–3 Küken; Benennen, Verschenkpflicht mit Losentscheid, Kükenflug, Erwachsenwerden.
- Namens- und Wohnortwechsel (Eulen ändern unterwegs ihren Kurs); Konto löschen mit 24-Stunden-Frist;
  Warnung und automatische Löschung bei Inaktivität; tägliches Aufräumen.
- Adminpanel: Statistik, Löschfrist, Rundnachrichten.

### Hinweise für Betreiber

- Die Datenbank wird beim Update migriert (Schema 5). Keine weitere Handlung nötig.
- Die Löschfrist bei Inaktivität steht auf 180 Tagen und lässt sich im Adminpanel ändern (mindestens 60).

## v0.1.0-stufe.3 – Eulen, Flug, Karte, Gold

- Menagerie: alle 17 Eulenarten kaufen (Pflicht-Benennung), Eulenübersicht mit Energie, Zustand und
  Abwesenheit; Streicheln, Füttern (0,1 Gold, einmal am Tag), Umbenennen (einmal pro Kalenderjahr), Freilassen.
- Echte Eulenflüge: vollständige Vorausberechnung mit Tag/Nacht (Sonnenstand), Land/Wasser-Maske,
  10-Stunden-Schlafpausen, Gleitflug über Wasser, Mehrfachempfänger und Rückflug; Vorschau je Eule beim Versand.
- Umkehren bei Kontakttrennung (übersprungene Empfänger, Gold zurück, Geschenk zurück); Neuberechnung bei Umzug.
- Bildeinblendungen bei Abflug, Ankunft, Füttern und Streicheln (schließt per Tippen/Escape/von selbst).
- Karte mit Tag und Nacht, Wohnorten der Kontakte und eigenen Eulen unterwegs; Kartendaten werden erst bei Bedarf geladen.
- Finanzübersicht mit den letzten 20 Buchungen; tägliches Gold um 15:00 UTC; Gold per Eule (0,1–20,0, Rest > 10,0)
  und Eulengeschenke, jeweils optional mit Begleitbrief.
- Aushilfseule „Postkauz Paul“ trägt bis zur Einführung der Leiheulen kostenlos einzelne Briefe und Gold.
- Behoben: Web Push wurde nie zugestellt (Verbindungsaufbau zum Push-Dienst), und die Anzeige blieb bei
  „wird geprüft …“ stehen.

### Hinweise für Betreiber

- Die Datenbank wird beim Update migriert (Schema 4: Eulen, Flüge, Buchungen). Briefe, die noch mit der
  vorläufigen Eule aus Stufe 2 unterwegs sind, werden wie geplant zugestellt.
- Nach dem Update in den Einstellungen „Benachrichtigungen einrichten“ erneut auslösen.

## v0.1.0-stufe.2 – Kontakte und Briefe

- Koppeln per Namen (gleiche Antwort, ob es den Namen gibt), 24 h gültige Anfragen, höchstens 20 pro Tag.
- Kontakt-Tresor mit gebundenen Schlüsseln, Sicherheitsnummer (60 Ziffern), Schlüsselwarnung mit Versandsperre.
- Ende-zu-Ende-verschlüsselte, signierte Briefe (kleines/großes Pergament, feste Länge), bis zu 5 Empfänger,
  Lesebestätigungen, Chat löschen; Textregeln auch beim Empfänger.
- Systemchat, „Neuigkeiten“, Web Push mit Bestätigung durch den Service Worker, Live-Aktualisierung (SSE).
- Ereignis-Warteschlange mit Nachholen nach Ausfällen; vorläufige Eule mit fester Flugzeit (echte Flüge in Stufe 3).

### Hinweise für Betreiber

- Ausgehende Verbindungen zu Push-Diensten (Port 443) müssen erlaubt sein; private Adressen werden nie angefragt.
- Keine Handlung nötig; die Datenbank wird beim Update migriert.

## v0.1.0-stufe.1 – Konten und Krypto

- Registrierung mit Proof-of-Work-Captcha (ALTCHA, selbst gehostet), Registrierungsmodi und
  Einmal-Einladungscodes; Namensregeln aus SPEC 7.1; fiktiver Wohnort per Pin auf der Karte mit
  Land/Wasser-Prüfung (Natural Earth).
- Anmeldung per OPAQUE (RFC 9807) mit Argon2id; unbekannte Namen sind von bekannten nicht zu
  unterscheiden; Wartezeiten und Captcha nach Fehlversuchen; nur eine Sitzung je Konto.
- Hauptschlüssel und Identitätsschlüssel (Ed25519, X25519) entstehen im Browser und liegen auf dem
  Server nur verschlüsselt; „angemeldet bleiben“ über IndexedDB mit nicht exportierbarem Schlüssel.
- Passwortwechsel ohne neue Schlüssel; Abmelden löscht alle lokalen Schlüssel.
- Adminpanel: Anmeldung per OPAQUE, Erstpasswort mit Pflichtwechsel, Registrierungsmodus,
  Einladungscodes, Fehlerprotokoll; `posteulen-cli admin-reset`.
- 17 Eulenarten (alle mit Bildern).

### Hinweise für Betreiber

- Beim Update von Stufe 0 wird der Adminzugang angelegt; das **Erstpasswort erscheint einmalig**
  am Ende des Updates. Danach unter `https://admin.<domain>` anmelden und ändern.
- Die Registrierung ist zunächst **geschlossen**; im Adminpanel auf „nur mit Einladungscode“
  oder „offen“ stellen.

## v0.1.0-stufe.0 – Gerüst

- Ordnerstruktur `backend/`, `web/`, `admin/`, `shared/`, `deploy/`, `images/`.
- Build, Lint, Formatierung, Typprüfung, Unit- und Ende-zu-Ende-Tests; `npm test` prüft alles.
- Backend: zwei getrennte API-Listener (Nutzer und Verwaltung), Sicherheits-Header,
  Origin-Prüfung, nur JSON, Größenlimit, Health-Endpunkt; SQLite mit Migrationen.
- Setup-Befehl für die Geheimnis-Datei (`posteulen-cli setup`, überschreibt nie).
- Nutzer-PWA und Adminpanel als leere Hüllen im Grund-Design; Service Worker, Offline-Hinweis.
- Bilder-Pipeline: WebP in drei Größen, Platzhalter für fehlende Eulenbilder.
- Installations- und Update-Skript für Debian 13 mit automatischem Rückfall, tägliche
  verschlüsselte Sicherung.

### Hinweise für Betreiber

- Erste Installation: `sudo ./posteulen/deploy/install.sh --domain <domain>` (siehe readme.txt).
- **Geheimnis-Datei `/etc/posteulen/secrets.json` sofort extern sichern.**
- Noch keine Anmeldung möglich (folgt in Stufe 1).
