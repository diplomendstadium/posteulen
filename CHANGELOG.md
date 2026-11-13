# Changelog

Alle Versionen von PostEulen.de. Format: neueste Version oben. Jede Version enthält einen
Abschnitt **Hinweise für Betreiber**.

## v0.8.5 – Post aus der Leserschaft

Version mit vielen Anregungen der Nutzerinnen und Nutzer (SPEC Anhang Z, D-291 bis D-308).

- **Briefe schreiben:** Die Eulenwahl steht von Anfang an im Editor und bleibt beim Tippen; die
  Leiheulen des Tages stehen immer mit zur Wahl. Jede einsatzbereite Eule hat in der Eulenübersicht
  „Brief schreiben“ (Dialog mit bis zu 5 Kontakten oder einem Bot).
- **Rast:** vorgewählt 2 Stunden mit eigener Eule, 24 Stunden mit Leiheule; eine eigene Wahl bleibt beim
  Wechsel, bei einer Gast-Eule entfällt das Feld. Die Vorschau rechnet mit derselben Rast wie der Versand.
- **Gast-Eulen:** Die Antwort erklärt den tatsächlichen Weg (zuerst die übrigen Briefe), ohne Namen.
  Statt einer Systemnachricht zeigt die Chatliste ein Eulensymbol hinter dem Namen; der Push bleibt.
- **Menagerie:** Angebot je Konto und Tag (Sperre der Vortage je Konto); abgeschlossene Leihen werden bis
  zum Tageswechsel ausgeblendet und zählen weiter. Am Update-Tag gilt noch das gemeinsame Angebot.
- **Eulen:** leere Stange bei Rast; Infoblock am Seitenende; Neuladen alle 5 Minuten bei fliegenden Eulen;
  „21 Minuten“ statt „21 Min..“. Freilassen nur bei mehr als 20 eigenen Eulen (Server prüft).
- **Küken:** 5 Tage für Namen und Geschenk (Erinnerung einen Tag vorher); wartende Gelege werden verlängert.
- **Karte:** Flugspuren und „Zzz“ entfernt; „Deine Eulen unterwegs“ nennt die Rast mit Datum und Uhrzeit.
- **Briefwechsel:** Bilder von Bots fensterfüllend; Abstand unter dem Verlauf; Textfelder nur in der Höhe ziehbar.
- **Löschfrist:** Altersbereinigung nur noch montags 04:00 UTC (auch nach Wahl einer kürzeren Frist);
  Verbrennen wirkt sofort.
- **Kontrollzentrum:** Karte passt ins Fenster, Mausrad scrollt die Seite am Zoom-Ende, Legende und Formen je
  Zustand. Events werden 36 Monate nach dem Versand mit Zustellungen und ungenutzten Bildern gelöscht.
- **Sonstiges:** Startseite verlinkt „Quelltext“ statt der Versionsnummer; neues quadratisches Abflugbild der
  Maskeneule; README und Hilfe zur Datensparsamkeit (Pseudonym, VPN/Tor, Adminpanel ohne Einblick);
  Datenschutzerklärung zur wöchentlichen Löschung und zu Bot-Events; Update-Nachricht mit Dank an alle.

### Hinweise für Betreiber

- Migration `0020_v085.sql` (Tabelle `menagerie_user_offers`, Küken-Fristen offener Gelege auf 5 Tage, Entfernen
  des alten Tagesjobs `menagerie_offer`), läuft automatisch.
- Briefe nach Ablauf ihrer Frist werden nur noch montags um 04:00 UTC gelöscht – sie bleiben also bis zu knapp
  sieben Tage länger in der Datenbank (Datenschutzerklärung angepasst; wer eigene Rechtstexte pflegt, bitte
  nachziehen). Bot-Events älter als 36 Monate verschwinden beim ersten 04:00-Lauf nach dem Update.
- Neues Bild `images/Maskeneule-Abflug.png` (wird beim Build umgerechnet). Keine neuen Pakete.
- Update wie immer mit `sudo posteulen-update`.

## v0.8.4 – Ein Gast aus Übersee

Kleine Version (SPEC Anhang Y, D-288 bis D-290).

- Neue Eulenart **Virginiauhu**: nicht käuflich, nur als Bot-Eule, Bot-Geschenk oder per Gutschein.
- Das Ankunftsbild einer Eule erscheint beim Öffnen eines Chats nur noch einmal.
- README: Kinder brauchen kein eigenes Handy.

### Hinweise für Betreiber

- Keine Migration, keine neuen Pakete. Update wie immer mit `sudo posteulen-update`.

## v0.8.3 – Glatt gestrichenes Pergament

Pflegeversion (SPEC Anhang X, D-277 bis D-287).

- **Kontrollzentrum:** Bilder bis 5 MB, Bot-Namen bis 30 Zeichen. Die Karte ist jetzt die des Spiels
  (ziehen, Mausrad, zwei Finger, Tastatur, Knöpfe) und lädt alle 5 Minuten neu. Zu jedem Event steht die
  erste und letzte Ankunft bei einem Spieler (vorher geschätzt, danach echt).
- **Uhrzeiten:** Adminpanel und Kontrollzentrum zeigen alle Zeiten in der Zeitzone des Geräts (mit Hinweis).
- **Bot-Eulen:** rastende Bot-Eulen lassen sich kostenlos pflegen; ihre Motivation ist ausgeblendet und
  steigt höchstens bis 1,2 (höhere bleibt).
- **Briefe:** sehr lange Briefe stehen gerade und laufen nicht mehr aus dem Bild; kurze bleiben leicht schräg.
- **KI der Bots:** wer geschrieben hat, bekommt immer den angepassten Folgebrief; die KI kennt die letzten
  15 Briefe (ältere als Zusammenfassung). Der KI-Test im Kontrollzentrum arbeitet wie der echte Betrieb
  (Folgebrief, voriger Brief als Verlauf).
- Typfehler in einem Test aus 0.8.2 behoben.

### Hinweise für Betreiber

- Migration `0019_v083.sql` (Ankunftszeit je Bot-Zustellung, Pflege von Bot-Eulen), läuft automatisch.
- Keine neuen Pakete. Update wie immer mit `sudo posteulen-update`.

## v0.8.2 – Frisch geputztes Gefieder

Pflegeversion (SPEC Anhang W, D-263 bis D-276).

- **IPv4 und IPv6:** Installation und jedes Update gleichen die Firewall für IPv4 und IPv6 ab und prüfen
  jeden Hostnamen (`<domain>`, `admin.`, `bots.`) über jede eigene Adresse mit gültigem Zertifikat
  (Abgleich mit A/AAAA; fehlende Zertifikate per Caddy-Reload nachgeholt, sonst Warnung, kein Rückfall).
- **Briefwechsel:** eigene Briefe nach Sendezeit, empfangene nach Ankunft sortiert; beim Öffnen erscheinen
  die Ankunftsbilder aller neuen Eulen nacheinander; **keine Lesebestätigung** mehr (nur „zugestellt“).
- **Nicht lesbare Briefe:** Absender sieht „Die Eule hat den Brief unterwegs verloren.“, Empfänger „… so
  nass geworden …“; der Admin bekommt die konkrete technische Ursache im Fehlerprotokoll.
- **Rast:** Systemnachricht und Push, wenn eine fremde Eule beim Nutzer rastet (mit Ende der Rast);
  neuer Knopf „Weiterfliegen lassen“ schickt sie ohne Brief vorzeitig weiter.
- **Adminpanel:** zeitlich befristete Banner für alle Konten (Deutsch, optional Englisch, ausblendbar).
- **Einstellungen:** Regler „Links in Briefen anklickbar“ (Standard an).
- Kleinigkeiten: Kontaktnamen ohne Leerzeichen am Anfang/Ende; kein „Fliegt nicht zurück.“ bei Leiheulen;
  Hilfe und README nennen die eine gültige Sitzung je Konto als Sicherheitsmerkmal.

### Hinweise für Betreiber

- Migration `0018_v082.sql` (Spalte `users.links_clickable`, Tabelle `banners`), läuft automatisch.
- Die Firewall wird beim Update für IPv6 freigegeben (`IPV6=yes` in `/etc/default/ufw`, Regeln für
  22/80/443 tcp und 443/udp). Hat der Server eine IPv6-Adresse, sollten `<domain>`, `admin.<domain>` und
  `bots.<domain>` auch AAAA-Einträge haben – die Funktionsprüfung warnt sonst bzw. bei fremden Adressen.
- Keine neuen Pakete. Update wie immer mit `sudo posteulen-update`.

## v0.8.1 – Korrektur für das Update auf 0.8

Korrektur (SPEC Anhang V, D-261, D-262).

- **Fehler behoben:** PostEulen 0.8.0 startete nicht, wenn auf dem Server gerade eine eigene Eule zu
  Tante oder Onkel unterwegs war („Cannot read properties of undefined (reading 'replace')“ im Journal);
  das Update rollte dann automatisch auf 0.7.2 zurück. Solche Eulen kehren jetzt einfach um. Ein Fehler beim
  Abbau verhindert den Start nicht mehr (Eintrag im Fehlerprotokoll, neuer Versuch beim nächsten Start).
- Nach einem Rückfall auf eine Version ohne Kontrollzentrum erscheint keine irreführende DNS-Warnung zu
  `bots.<domain>` mehr.
- Test für die Lage auf dem Server ergänzt; der Brief-E2E-Test wartet auf die Sicherheitsnummer.

### Hinweise für Betreiber

- Wer beim Update auf 0.8.0 zurückgerollt wurde: einfach `sudo posteulen-update` – es spielt 0.8.1 ein.
  Alle Hinweise zu 0.8.0 (DNS-Eintrag `bots.<domain>`, Erstpasswort des Kontrollzentrums, Migration 0017)
  gelten weiter.
- Keine neue Migration, keine neuen Pakete.

## v0.8.0 – Das Bots-Kontrollzentrum

Große Version (SPEC Anhang U, S, T; Entscheidungen D-223 bis D-260).

- **Bots-Kontrollzentrum** unter `bots.<domain>`: eigener Zugang (Passwort, Cookie, Sitzungen, Abmeldung
  nach 12 Stunden), Übersicht mit Statistik (abgeschickt, zugestellt, gelesen, Antworten; insgesamt und
  30 Tage) und Weltkarte der Bot-Eulen unterwegs, je Bot geplante Events, Archiv und Einstellungen, Vorschau
  und KI-Test, Export und Import als ZIP (versioniertes JSON mit stabilen IDs, Bilder dabei). Deutsch und
  Englisch.
- **Zentrale Bots:** eine Identität, Persönlichkeit, Konfiguration und Eventplanung für alle; je Spieler
  eigener Briefwechsel, eigenes Gedächtnis, eigene Zustellung. Zustände Entwurf, aktiv, pausiert; Löschen
  atomar mit Namensbestätigung und Systemnachricht an Spieler mit Kontakt.
- **Events:** Umzug, Brief an alle (Erstkontakt- und Folgefassung, Deutsch und Englisch, bis zu zwei
  Bilder), Gold- oder Eulengeschenk, Kontext für die KI; einmalig, kein Brief doppelt (eindeutig je Event
  und Spieler), Archiv mit Zahlen.
- **Antworten:** Die KI passt den nächsten geplanten Brief an (der geplante Inhalt bleibt verbindlich);
  spontane Antwort nur, wenn vier Wochen nichts geplant ist; ohne KI geht der geplante Brief unverändert.
  Spielerbriefe gelten erst als beantwortet, wenn die Antwort losgeflogen ist.
- **Eulen der Bots** fliegen wie alle Eulen (Schlaf, Wasser, Rast, Antwort mitgeben, Rückflug, Umzug), je
  Spieler eine eigene Instanz; Motivation 0,5–20, Rast 0–168 Stunden; der nächste Brief wartet auf die
  eigene Bot-Eule. Bots wohnen weltweit auf Land (neue grobe Weltmaske 0,1°).
- **Bilder:** JPEG, PNG, WebP bis 2 MB, auf dem Server zu WebP ohne Metadaten umgewandelt, einmal
  gespeichert und nur verlinkt.
- **Tante und Onkel** sind restlos entfernt (Programm, Datenbank, Aufträge, Texte, Dokumentation); ihr
  geschenktes Gold bleibt. Der Abbau läuft bei jedem Start, also auch nach einem Rückfall erneut.
- **Spieler:** Bots erscheinen erst mit ihrem ersten Brief (der Erklärbär ausgenommen); ein Brief pro
  Kalendertag an jeden Bot; „Alle Bots entfernen“ hält auch künftige Bots fern; Bilder unter Bot-Briefen;
  rastende Bot-Eulen als Gast (Antwort mitgeben, keine Pflege).
- **KI:** eigenes Tageslimit für den Erklärbär (200) und eines für alle anderen Bots (500); der Erklärbär
  antwortet weiter mit höchstens 500 Zeichen, die anderen Bots ohne feste Grenze.
- **Adminpanel** auf Englisch umschaltbar.
- Tests: `backend/test/v080.test.ts`, `shared/test/worldmask.test.ts`, `e2e/v080.spec.ts`, VM-Test mit
  Kontrollzentrum. SPEC, PROMPT, README, Hilfe, Erklärbär-Wissen und Datenschutzerklärung de/en angepasst.

### Hinweise für Betreiber

- **Neuer DNS-Eintrag:** `bots.<domain>` (A/AAAA) auf den Server. Ohne ihn läuft alles andere; das Update
  warnt nur, dass `bots.<domain>` (noch) nicht antwortet.
- **Erstpasswort des Kontrollzentrums** wird beim Update einmalig angezeigt – notieren! Spätere Updates
  ändern es nicht; neu erzeugen mit `sudo posteulen-cli bots-reset`.
- **Datenbank-Migration `0017_v080.sql`** (Schema 17): neue Tabellen der Bots, Neuaufbau von `flights`
  und `ai_usage`, neue Spalten. Läuft beim Update automatisch. Beim ersten Start werden Tante und Onkel aus
  allen Konten entfernt.
- **Neue Abhängigkeit zur Laufzeit:** `sharp` (war schon für den Build da).
- **Sicherungen:** täglich zusätzlich `posteulen-bots-*.zip` in `/var/backups/posteulen/` (unverschlüsselt,
  0600, 7 Tage). Wer die Sicherungen abholt, bekommt sie mit.
- Neues Kontingent für die KI der Bots im Adminpanel (Standard 500 Aufrufe am Tag).
- Datenschutzerklärung: neuer Absatz zu den Bots des Kontrollzentrums – wer eigene Rechtstexte pflegt,
  sollte ihn übernehmen.
- Update wie gewohnt: `sudo posteulen-update`. Danach bekommt jedes Konto die Update-Nachricht zu 0.8.0.

## v0.7.2 – Heimkehr ans Fensterbrett

Pflegeversion (SPEC Anhang R, Entscheidungen D-216 bis D-222).

- **Fehler behoben – unsichtbare Post:** Wer „Alle Briefe verbrennen“ wählte (oder einen Bot entfernte),
  während noch ein Brief zu ihm unterwegs war, bekam diesen Brief unsichtbar zugestellt – „Neue Post!“
  ohne sichtbaren Brief, vor allem bei Bots. Unterwegs befindliche Briefe verbrennen jetzt nicht mehr mit;
  die Ungelesen-Zähler werden beim Update neu berechnet.
- **Fehler behoben – Bots kehrten zurück:** Konten, die alle Bots entfernt hatten, bekamen beim Neustart
  des Servers wieder alle drei. Entfernte Bots bleiben jetzt weg (`users.bots_created`).
- **Bots** stehen nicht mehr im Adressbuch, nur im Briefwechsel und auf der Karte. Entfernen: einzeln im
  Chat („[Name] entfernen“) oder alle auf einmal in den Einstellungen („Alle Bots entfernen“, inkl.
  Erklärbär, unwiderruflich).
- **Heimkehr:** keine Systemnachricht mehr, stattdessen jedes Mal das Heimkehr-Bild (Tag/Nacht) als
  Einblendung – sofort bei offener App, sonst beim nächsten Öffnen oder Einloggen; mehrere Heimkehrer
  nacheinander. Alte Heimkehr-Nachrichten werden ausgeblendet.
- **Restzeiten** unter einer Stunde in Minuten („zurück in 40 Min.“, offene Kontaktanfragen).
- **Geschlecht der Eulen** geprüft: gleich verteilt (49,99 % weiblich bei 200 000 Würfen); neuer Test.
- Tests: `backend/test/v072.test.ts`, Ergänzungen in `bots.test.ts`, `owls.test.ts`, `v03.test.ts`,
  `v07.test.ts`, `e2e/bots.spec.ts`, `e2e/v061.spec.ts`.
- SPEC (Stand 0.7.2, Anhang R), PROMPT, README, Hilfe und Erklärbär de/en angepasst.

### Hinweise für Betreiber

- **Datenbank-Migration `0016_v072.sql`** (Schema 16): Spalte `users.bots_created`, Tabelle
  `homecomings`, Neuberechnung der Ungelesen-Zähler. Läuft beim Update automatisch.
- Keine neuen Bilder, keine neuen npm-Pakete, keine Änderungen an den Rechtstexten.
- Update wie gewohnt: `sudo posteulen-update`.
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.7.2.

## v0.7.1 – Feinschliff

Pflegeversion nach 0.7.0 (SPEC Anhang Q, Entscheidungen D-207 bis D-215).

- **Uhrzeiten** stehen überall in der Ortszeit des fiktiven Wohnorts (z. B. „Rastet bei … bis …“ zeigte
  auf manchen Geräten UTC).
- **Antwort mit der Gast-Eule:** „Antwort … mitgeben“ öffnet den Chat mit genau dieser Eule – ohne
  andere Eulen und ohne Rast-Auswahl.
- **Kaufen** nur nach Rückfrage.
- **Nachricht an den Admin:** ganz unten in den Einstellungen, 300 Zeichen, eine pro UTC-Tag, nicht
  verschlüsselt, ohne Absender, nach 90 Tagen gelöscht; im Adminpanel als letzter Punkt
  („Nachrichten der Nutzer“). Hilfe, FAQ, Erklärbär und Datenschutzerklärung weisen darauf hin.
- **Karte:** „Ansicht zurücksetzen“ springt zur Ansicht beim Öffnen zurück (statt zur ganzen Welt).
- **Wohnort:** Hinweis „Überlege sorgfältig, ob du deine echte Adresse wählen möchtest.“
- **Abstände:** nach „Gutschein einlösen“ (Einstellungen) und „Gutscheine“ (Adminpanel).
- **Texte:** FAQ zum Zurückholen von Briefen nennt „Alle Briefe verbrennen“.
- **Tests:** schlanker Ablauf – gezielt während der Entwicklung, `npm test` einmal am Ende; E2E in zwei
  Profilen (Chromium-Desktop, WebKit-Handy) statt vier; Layout in vier statt acht Breiten;
  Screenshot-Rundgang nur auf Anfrage (`POSTEULEN_SCREENSHOTS=1`). Neue Tests für die Änderungen
  (`backend/test/v071.test.ts`, Ergänzungen in `admin.test.ts` und `e2e/v07.spec.ts`).
- SPEC (Stand 0.7.1, Anhang Q), PROMPT (Testablauf), README, Hilfe, Erklärbär und Datenschutzerklärung
  de/en angepasst.

### Hinweise für Betreiber

- **Datenbank-Migration `0015_v071.sql`** (Schema 15): Tabelle `feedback` und Spalte
  `users.feedback_sent_on`. Läuft beim Update automatisch.
- Die Datenschutzerklärung nennt jetzt die Nachrichten an den Admin – wer eigene Rechtstexte pflegt,
  sollte das übernehmen.
- Keine neuen Bilder, keine neuen npm-Pakete.
- Update wie gewohnt: `sudo posteulen-update`.
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.7.1.

## v0.7.0 – Eulen, die zum Plausch bleiben

Funktionsversion (SPEC Anhang P, Entscheidungen D-184 bis D-206).

- **Rast beim Empfänger:** Beim Schreiben wählt man, wie lange die Eule bei jedem Empfänger bleibt
  (gar nicht, 1, 2, 24 oder 48 Stunden; vorgewählt 1 Stunde). Der Empfänger sieht sie als Gast in seiner
  Eulenübersicht („Nur zur Rast hier!“), darf sie pflegen und ihr eine Antwort an den Absender mitgeben –
  dann fliegt sie sofort los. Mehrere Empfänger können je eine Antwort mitgeben; die Eule bringt alle
  heim (Heimkehr-Nachricht und Push nennen die Briefe). Leiheulen mit Antwort fliegen noch zum Absender.
- **Motivation je Etappe:** Die Motivation zählt nur für die nächste Strecke und wird bei jedem Abflug von
  einem Empfänger neu angewendet. Anzeige jetzt in Prozent (80–120 %).
- **Weltkarte:** Die Karte zeigt die ganze Welt (Equal Earth), außerhalb Westeuropas mit Ländergrenzen und
  Hauptstädten. Wohnorte gibt es weiterhin nur im Westeuropa-Ausschnitt (Registrierung und Umzug bleiben
  darin). Der automatische Zoom berücksichtigt keine Bots mehr.
- **Begrüßung:** Die Übersicht begrüßt nach der Tageszeit am fiktiven Wohnort (Zeitzone des Landes).
- **Gutscheine:** Das Adminpanel erzeugt Gutscheine für Gold oder eine Eule (einmal einlösbar, 90 Tage);
  Nutzer lösen sie in den Einstellungen ein.
- **Adminpanel:** Die Anmeldung verfällt nach 10 Minuten ohne Aktivität (vorher 8 Stunden).
- **Gold:** Das tägliche Gold kommt um 03:00 UTC (vorher 15:00); der Goldstand oben rechts aktualisiert
  sich sofort.
- **Briefe:** Gesendete Briefe nennen die überbringende Eule; „Chat löschen“ heißt „Alle Briefe
  verbrennen“ (mit Rückfrage und Kaminbild); Chats öffnen beim ältesten ungelesenen Brief; nach dem
  Löschen alter Briefe wegen der Löschfrist kommt eine Systemnachricht mit Anzahl und Chats.
- **Bilder:** Brüten-Bilder für alle 17 Eulenarten; Bild „Verbrennen“. Das Heimkehr-Bild erscheint jetzt
  zuverlässig als Einblendung (vorher nur im Systemchat, nicht bei „Neuigkeiten“ oder offener App).
- **Kleinigkeiten:** „Schläft auf dem Weg zu …“/„Schläft auf dem Heimweg“ statt „Fliegt gerade …“, solange
  die Eule schläft; Geschlecht schon beim Benennen; Leiheulen-Arten und -Namen wiederholen sich an zwei
  Folgetagen nicht; aktueller Nutzername in den Einstellungen; Startseite mit gleich großer Anmelde-Box
  und Gruppenbild; alle Fußzeilen-Links in einer Farbe.
- **Betrieb:** Keine Meldung „Fontconfig error“ mehr beim Build (minimale fontconfig-Konfiguration).
- **README:** Hinweis für Paranoide, dass man PostEulen mit `PROMPT.md`, `SPEC.md` und `images/` selbst
  neu bauen kann.
- **Tests:** neue Unit-Tests (`backend/test/v07.test.ts`, `shared/test/timezone.test.ts`, Ergänzungen in
  Flug-, Karten-, Zufalls- und Admin-Tests) und E2E-Tests (`e2e/v07.spec.ts`, Gutschein im Adminpanel).
- **VM-Test:** Die installierte Vorversion (seit 0.6.1 mit Signaturprüfung) vertraut für das Update auf
  die Test-Tags dem Testschlüssel.
- SPEC (Stand 0.7.0, Anhang P), PROMPT, README, Hilfe und Erklärbär de/en angepasst.

### Hinweise für Betreiber

- **Datenbank-Migration `0014_v07.sql`** (Schema 14): neue Tabelle `vouchers`. Läuft beim Update
  automatisch.
- **Neue Bilder** im Ordner `images/` (kommen mit dem Release): `<Art>-Brueten.png` für 17 Arten und
  `Verbrennen.png` (zusammen 307 Bilddateien).
- **Tägliches Gold um 03:00 UTC:** Der beim Update schon geplante Lauf um 15:00 wird auf 03:00 desselben
  Tages verlegt; ist das schon vorbei, wird sofort gezahlt. Niemand bekommt einen Tag doppelt oder gar
  nicht.
- Flüge, die beim Update unterwegs sind, behalten bis zur Landung die alte Motivationsregel (ganze
  Reise).
- Admin-Sitzungen laufen jetzt nach 10 Minuten ohne Aktivität ab.
- Neuer Server-Schlüssel `voucher` wird aus dem vorhandenen Geheimnis abgeleitet – die Geheimnis-Datei
  bleibt unverändert.
- Keine neuen npm-Pakete.
- Update wie gewohnt: `sudo posteulen-update` (prüft die Tag-Signatur).
- Nach dem Update bekommt jedes Konto die Update-Nachricht zu 0.7.0 (ohne Erwähnung der Gutscheine).

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
- **Namen:** Die englischen Bot-Namen sind reserviert („Explainer Bear“,
  „System messages“, „Unknown“ und die Namen der damaligen Verwandten-Bots), damit sich niemand als Bot ausgeben kann.
- **Texte:** Wohnort mit N/S und O/W statt Minuszeichen; Karte nennt richtig „alle 5 Minuten“;
  Fehlermeldung nennt vier Leiheulen; „Das Konto von … wurde gelöscht“ (passt auch zur automatischen
  Löschung); Hilfe ohne die veraltete 10-Stunden-Schlafpause, mit „nicht lesbar“ und den Zeitpunkten der
  Bot-Briefe; Datenschutz nennt den lokal gespeicherten ausgeblendeten Benachrichtigungs-Hinweis; viele
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
- Konten, deren Name wie ein Bot in der englischen Ansicht lautet, bleiben unverändert;
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
  („Explainer Bear“) und die anderen Bots schreiben und antworten in der Kontosprache, Leiheulen und
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
- **Bots:** Bots erscheinen erst mit ihrem ersten Brief; der
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
Bots (Erklärbär und Verwandten-Bots, seit 0.8 entfernt), Push-Benachrichtigungen, Adminpanel sowie Installation, Updates
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

- Jedes Konto hat einen Erklärbären und zwei Verwandten-Bots (deutlich als Bot gekennzeichnet, auch auf der Karte; die Verwandten-Bots sind seit 0.8 entfernt).
- Feste Briefe: Erklärbär (Tag 0 sofort im Briefkasten, dann Tag 1, 2, 4, 7) und Briefe sowie einmalige
  Goldsendungen der Verwandten-Bots.
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
