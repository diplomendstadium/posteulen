# PostEulen.de – Fortschritt

**Aktuelle Stufe:** P – Plan (abgeschlossen, wartet auf Feedback)
**Stand:** 2026-11-05

## Erledigt (Stufe P)
- SPEC vollständig gelesen.
- `ARCHITECTURE.md`: Komponenten, Krypto-Formate, Datenmodell, API, 11 Sequenzdiagramme, Ereignis-Warteschlange, Bedrohungen und Maßnahmen, Installations- und Update-Konzept.
- `DEPENDENCIES.md`: geplante Versionen und Lizenzen, Audit-Ergebnis.
- `DECISIONS.md`: Prüfergebnisse P-1 bis P-7, Entscheidungen D-01 bis D-25.
- Prüfskripte (OPAQUE, libsodium, HPKE, HKDF, `node:sqlite`) im Scratchpad ausgeführt; sie werden in Stufe 0/1 als Tests ins Repository übernommen.

- Antworten F-01 bis F-11 erhalten und eingetragen (`DECISIONS.md`, Teil C); SPEC 4.1 und 11.7 nach Absprache angepasst.
- Lokales Git-Repository angelegt (`main`, Remote `git@github.com:diplomendstadium/posteulen.git`), `deploy/allowed_signers` mit dem Signierschlüssel des Auftraggebers. Noch kein Commit.

## Offen
- Deploy-Key `~/.ssh/posteulen-github-deploy.pub` muss auf GitHub mit Schreibrecht eingetragen werden.
- Commit-Identität (Name und E-Mail; das Repository ist öffentlich).
- Umgang mit den Originalbildern im Repository (ca. 2,3 MB je Bild, bei 175 Bildern ca. 400 MB).
- Freigabe für Stufe 0.
- Eulenbilder: 48 von 175 Dateien vorhanden (8 Arten ohne Küken-Bild; 17 Arten fehlen ganz).

## Nächste Stufe: 0 – Gerüst
Siehe verfeinerten Stufenplan im Stufenbericht P.
