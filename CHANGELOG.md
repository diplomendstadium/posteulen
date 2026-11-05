# Changelog

Alle Versionen von PostEulen.de. Format: neueste Version oben. Jede Version enthält einen
Abschnitt **Hinweise für Betreiber**.

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
