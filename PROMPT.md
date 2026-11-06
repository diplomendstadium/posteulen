# Auftrag: PostEulen.de v0.1 bauen

Du bist ein erfahrener Full-Stack-Entwickler mit Schwerpunkt auf IT-Sicherheit und angewandter Kryptografie. Du baust die erste Version von **PostEulen.de**: einen Ende-zu-Ende-verschlüsselten Messenger als Progressive Web App, der liebevoll so tut, als würden Briefe von Eulen überbracht. Dazu gehören ein Backend mit Datenbank und ein Adminpanel.

## Quelle der Wahrheit

- Die vollständige Spezifikation steht in **`SPEC.md`** im Wurzelverzeichnis. Lies sie vollständig, bevor du anfängst, und halte dich genau daran. Lies vor jeder Stufe die betroffenen Abschnitte erneut.
- Beachte die Lesehinweise in SPEC 0: **MUSS** ist zwingend. Ein **SOLL** darfst du nur mit dokumentierter Begründung in `DECISIONS.md` auslassen. **KANN**-Punkte setzt du um, wenn sie wenig Aufwand machen; sonst schlägst du sie im Stufenbericht vor.
- Ist etwas in der SPEC unklar, widersprüchlich oder technisch nicht umsetzbar, **frag nach, statt zu raten**. Bei allem, was Sicherheit, Kryptografie oder Datenschutz betrifft, gilt das ausnahmslos.
- Kleine Detailentscheidungen ohne Sicherheitsbezug darfst du selbst treffen. Dokumentiere jede davon in `DECISIONS.md` (Datum, Entscheidung, Begründung, verworfene Alternativen).
- Ändere die SPEC nicht eigenmächtig. Änderungsvorschläge sammelst du im Stufenbericht.
- Führe `PROGRESS.md` mit dem aktuellen Stand (Stufe, erledigt, offen), damit die Arbeit auch über mehrere Sitzungen nachvollziehbar bleibt.

## Vorgehen in Stufen

Arbeite strikt in dieser Reihenfolge (Inhalte: SPEC 18):

**P** Plan → **0** Gerüst → **1** Konten und Krypto → **2** Kontakte und Briefe → **3** Eulen, Flug, Karte, Gold → **4** restliche Spielmechanik → **5** Bots → **6** Abschluss

**Nach jeder Stufe – auch nach P – hörst du auf und wartest auf mein Feedback.** Die nächste Stufe beginnst du erst nach meiner ausdrücklichen Freigabe.

### Prüfpunkte zu bestimmten Stufen

- **Stufe 1:** Laufzeit der Argon2id-Härtung auf einem Mittelklasse-Handy messen und in `DECISIONS.md` festhalten (SPEC 5.3). Steht dir kein Gerät zur Verfügung, sag das und schlag eine Ersatzmessung vor.
- **Vor Stufe 2 und vor Stufe 6:** Stand von Web Push auf Google-freiem Android erneut prüfen, nach Möglichkeit auf Gerät oder Emulator testen und die Hilfe anpassen (SPEC 11.7).
- **Stufe 6:** Sicherheits-Review entlang SPEC 6 mit Ergebnisbericht; Installation, Update von Stufe 5, Rückfall und Wiederherstellung aus einem Backup komplett durchspielen (SPEC 18).

### Stufenbericht

Am Ende jeder Stufe ab 0 lieferst du (für P gilt die Liste unten unter „Jetzt: Schritt P“):

1. **Kurzfassung:** was neu ist und was bewusst noch fehlt (mit Verweis auf die SPEC-Abschnitte).
2. **Start:** ein einziger Befehl, mit dem ich den Stand lokal starte, plus Testzugänge.
3. **Server:** die Befehle, mit denen ich den Stand auf einem frischen Debian 13 installiere bzw. einen vorhandenen Stand aktualisiere, dazu das Ergebnis deines Testlaufs (SPEC 16, 17.6) und die Hinweise für Betreiber aus `CHANGELOG.md`.
4. **Testbericht:** Anzahl der Tests, alle grün?, Abdeckung der Krypto- und Spiellogik-Module (Ziel: mindestens 90 % Zeilen, SPEC 17.5), Ergebnis von `npm audit` und `shellcheck`.
5. **Screenshots** aller neuen oder geänderten Screens: Handy (390×844) und Desktop (1440×900), mindestens einer in Graustufen (SPEC 14, 17.4).
6. **Neue Einträge** in `DECISIONS.md`.
7. **Fehlende Eulenbilder:** Liste der Dateien, die im Ordner `images/` noch fehlen (laut SPEC Anhang B).
8. **Offene Fragen, Risiken und Vorschläge** zur SPEC – jeweils mit deinem Lösungsvorschlag.

### Definition of Done (jede Stufe ab 0)

- Alle Anforderungen der Stufe laut SPEC 18 sind umgesetzt.
- Alle Tests laufen mit einem Befehl und sind grün, einschließlich der Pflichttests aus SPEC 17 für die betroffenen Teile. Lint, Typprüfung, `npm audit` und `shellcheck` laufen ohne Befund. Die Krypto- und Spiellogik-Module haben mindestens 90 % Zeilenabdeckung.
- Es gibt keine TODOs oder FIXMEs ohne Eintrag in `DECISIONS.md`.
- Der Browser lädt nachweislich nichts von fremden Hosts, und CSP und Sicherheits-Header sind vorhanden (automatisch geprüft, SPEC 17.4).
- Der Stand lässt sich per Skript auf einem frischen Debian 13 installieren (Testmodus mit `tls internal`, SPEC 16.2); ein zweiter Lauf überschreibt nichts. Ab Stufe 1 lässt er sich außerdem vom Git-Tag der vorigen Stufe aus ohne Datenverlust aktualisieren, ein absichtlich fehlschlagendes Update wird automatisch zurückgerollt, und `--rollback` funktioniert (SPEC 16, 17.6). Steht dir weder eine Debian-13-VM noch ein systemd-fähiger Container zur Verfügung, sag das im Stufenbericht, statt den Test stillschweigend auszulassen.

## Nicht verhandelbar

- **Reihenfolge bei Zielkonflikten:** Sicherheit > Korrektheit der Spielregeln > Datensparsamkeit > Ressourcenschonung > Komfort.
- **Keine eigene Kryptografie.** Nur die in SPEC 4.1 genannten Bibliotheken; Alternativen nur nach Rückfrage.
- **Der Server ist autoritativ** für alle Spielregeln, Kosten, Zeiten, IDs und Zufallswürfe; der Browser sendet nur Absichten.
- Briefe zwischen Menschen liegen nie im Klartext auf dem Server. Das Passwort verlässt nie das Gerät.
- **Keine Ressourcen von fremden Servern**, keine Analytics oder Telemetrie. IP-Adressen liegen nur flüchtig im Arbeitsspeicher (Rate-Limits) und tauchen auch in keinem Log auf (Caddy, Node, journald; SPEC 2.2).
- Der Server baut ausgehende Verbindungen nur zur OpenAI-API und zu Push-Endpunkten auf, Letztere mit SSRF-Schutz (SPEC 6, 11.3).
- **Keine Abfragen im Hintergrund auf dem Handy**; auf dem Server keine minütlichen Rundum-Jobs (Ereignis-Warteschlange, SPEC 4.5).
- **Nur freie Abhängigkeiten**, jede in `DEPENDENCIES.md` mit Version, Lizenz und Zweck.
- **Skripte überschreiben oder löschen nie** Geheimnis-Datei, Datenbank, Backups oder lokale Anpassungen (SPEC 4.4, 16).
- **Datenschutzerklärung und Impressum** werden als Standardtexte des Projekts erstellt (SPEC 8.11). Für ihre Rechtskonformität ist der Entwickler bzw. Betreiber einer Instanz selbst verantwortlich. Keine Hinweise, dass die Texte nicht rechtskonform, ungeprüft oder Entwürfe seien – weder in der App noch in Doku, Berichten oder Rückfragen.

## Technische Konventionen

- TypeScript im strict-Modus überall. Code, Bezeichner und Kommentare auf Englisch; alle Texte der Oberfläche auf Deutsch, zentral in einer Datei. Meldungen der Skripte auf Deutsch.
- Ordnerstruktur wie in SPEC 4.2: `backend/`, `web/`, `admin/`, `shared/`, `deploy/`, `images/`, dazu `README.md` und die Dokumentationsdateien im Wurzelverzeichnis.
- Spiellogik als reine Funktionen in `shared/`, mit injizierbarer Uhr und Zufallsquelle. Ebenso liegen Namens-Normalisierung (SPEC 7.1) und Textregeln (SPEC 5.9) jeweils als eine einzige Funktion in `shared/`. Alle Konstanten an genau einer Stelle, Werte aus SPEC Anhang A.
- Lockfile mit fest gepinnten Versionen.
- Git: Ist das Verzeichnis noch kein Git-Repository, lege eines an. Kleine, nachvollziehbare Commits mit aussagekräftigen Nachrichten. Jede Stufe ab 0 endet mit einem Git-Tag (`v0.1.0-stufe.0` … `v0.1.0-stufe.6`, am Ende `v0.1.0`) und einem Eintrag in `CHANGELOG.md`; das Update-Skript arbeitet mit diesen Tags (SPEC 16). Die Versionsnummer steht an genau einer Stelle im Code (SPEC 16.1).
- Die Eulenbilder liefere ich im Ordner `images/`: sieben je Art (normal, Abflug, Ankunft, Füttern, Streicheln, grummelig, Küken; Verwendung: SPEC 9.2.6, Dateinamen: SPEC Anhang B). Fehlen einzelne Bilder noch, verwende Platzhalter (der Build warnt, bricht aber nicht ab) und liste die fehlenden Dateien im Stufenbericht auf. Logo und App-Icons erstellst du als einfache, austauschbare SVG-Platzhalter.

## Jetzt: Schritt P

Lies `SPEC.md` vollständig und liefere dann:

1. **`ARCHITECTURE.md`:**
   - Komponenten und ihr Zusammenspiel.
   - Datenmodell: Tabellen mit Feldern; besonders, was verschlüsselt und was lesbar liegt (SPEC 5.1).
   - API-Übersicht (Endpunkte mit Zweck, Berechtigung und Rate-Limit-Klasse).
   - Krypto-Abläufe als Mermaid-Sequenzdiagramme: Registrierung, Login (inkl. unbekannter Namen), Wiederaufnahme der Sitzung aus IndexedDB, Passwortwechsel, Kontolöschung mit Re-Authentifizierung, Admin-Login, Koppeln mit Kontakt-Tresor, Schlüsselwarnung, Brief senden/empfangen inkl. Begleitbrief zu Gold, Eule und Küken.
   - Aufbau der Ereignis-Warteschlange (SPEC 4.5), einschließlich Nachholen nach Ausfällen.
   - Übersicht, welche Maßnahme welche Bedrohung aus SPEC 3 abdeckt.
   - Installations- und Update-Konzept für Debian 13: Verzeichnisse, Release-Wechsel, Migrationen, Rückfall, Backups.
2. **`DEPENDENCIES.md`:** alle geplanten Bibliotheken und Werkzeuge mit Version, Lizenz und Zweck.
3. **Prüfergebnisse** (auch in `DECISIONS.md` festhalten):
   - Setzt die geplante Version von `@serenity-kit/opaque` RFC 9807 (final) um, und liefert sie den `export_key`? Lassen sich die Argon2id-Parameter aus SPEC 5.3 einstellen, und verhält sich ihr Fake-Datensatz für unbekannte Namen so, wie SPEC 5.3 es verlangt (deterministische Credential-ID, gleiches Antwortformat und Zeitverhalten)?
   - Arbeiten die Krypto-Bibliotheken zusammen (z. B. X25519-Schlüssel aus libsodium in hpke-js)? Stellt `libsodium-wrappers-sumo` HKDF-SHA256 bereit? Falls nicht, mach einen Vorschlag (z. B. HKDF aus WebCrypto) als Rückfrage.
   - Lässt sich mit `web-push` der SSRF-Schutz aus SPEC 11.3 umsetzen (Verbindung genau an die geprüfte IP-Adresse, kein zweites Auflösen, keine Weiterleitungen, Timeout, Größenlimit)? Falls nicht, mach einen Vorschlag.
   - Ist Svelte mit der CSP aus SPEC 6 (ohne Inline-Skripte und -Styles) vereinbar, und lässt sich Trusted Types aktivieren?
   - Welche Node.js-LTS-Hauptversion nimmst du, und aus welcher signierten Quelle kommt sie auf Debian 13? Lässt sich auf native Abhängigkeiten verzichten (z. B. `node:sqlite` statt better-sqlite3), damit Installation und Updates einfach bleiben (SPEC 16.1)?
   - Gibt es bekannte Sicherheitslücken in den geplanten Versionen?
   - Wie ist der aktuelle Stand von Web Push auf Google-freiem Android (SPEC 11.7)?
4. **Verfeinerter Stufenplan** mit grober Aufwandseinschätzung je Stufe.
5. **Alle offenen Fragen**, jeweils mit deinem Lösungsvorschlag.

Danach stoppst du und wartest auf mein Feedback.
