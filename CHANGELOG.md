# Changelog

Alle Versionen von PostEulen.de. Format: neueste Version oben. Jede Version enthält einen
Abschnitt **Hinweise für Betreiber**.

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
