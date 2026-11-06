PostEulen.de
============

Weißt du noch, wie schön es war, einen richtigen Brief zu bekommen? PostEulen ist ein kleiner
Messenger, bei dem Nachrichten nicht in Sekunden ankommen, sondern von einer Eule gebracht
werden – und die braucht je nach Entfernung, Tageszeit und Kondition ein paar Stunden. Du
kaufst oder leihst dir Eulen, fütterst und streichelst sie, und ein freundlicher Erklärbär,
eine plauderfreudige Tante und ein etwas verrückter Onkel schreiben dir zurück. Was du deinen
Freunden schreibst, bleibt unter euch: Die Briefe sind so verschlüsselt, dass nicht einmal der
Server sie lesen kann. PostEulen ist ein Hobbyprojekt und läuft unter https://posteulen.de –
schau gern vorbei!


Installationsanleitung
======================

Stand: Version 0.1.0.

PostEulen ist ein Ende-zu-Ende-verschlüsselter Messenger, bei dem Eulen die Briefe bringen.
Diese Anleitung erklärt Schritt für Schritt, wie PostEulen auf einem eigenen Server (VPS) mit
Debian 13 per HTTPS läuft. Sie ist für Einsteiger geschrieben. Jeder Schritt der Skripte ist
erklärt, damit man ihn notfalls auch von Hand ausführen kann.

Kurzfassung:
  1. Server und Domain vorbereiten (Abschnitt 1).
  2. Ein Befehl installiert alles (Abschnitt 2).
  3. Geheimnis-Datei und Backup-Schlüssel außerhalb des Servers sichern (Abschnitte 2 und 5).
  4. Im Adminpanel Passwort ändern, Registrierung öffnen, OpenAI-Key eintragen (Abschnitt 3).
  5. Vor dem öffentlichen Betrieb Datenschutzerklärung ausfüllen, Impressum prüfen (Abschnitt 9).


1. Voraussetzungen
------------------

* Ein VPS mit frisch installiertem Debian 13 (amd64 oder arm64).
  Mindestens 1 GB Arbeitsspeicher (2 GB empfohlen), 1 CPU-Kern, 10 GB Speicher.
  Bei weniger als 2 GB Arbeitsspeicher legt das Skript nach Rückfrage eine Swap-Datei an,
  damit der Build nicht abbricht.
* Eine eigene Domain, z. B. posteulen.de.
* Zwei DNS-Einträge (A für IPv4, zusätzlich AAAA für IPv6, falls vorhanden), die auf die
  Adresse des Servers zeigen:
      posteulen.de        →  IP des Servers
      admin.posteulen.de  →  IP des Servers
  Ohne diese Einträge kann Caddy keine HTTPS-Zertifikate von Let's Encrypt bekommen.
* SSH-Zugang zum Server, am besten mit einem SSH-Schlüssel statt Passwort. Den Schlüssel
  hinterlegt man auf dem eigenen Rechner mit „ssh-copy-id benutzer@server“. Erst dann bietet
  das Installations-Skript an, die Anmeldung per Passwort abzuschalten.
* Für die Bots ein OpenAI-API-Key (https://platform.openai.com). Ohne Key läuft alles andere,
  nur antworten die Bots nicht.


2. Installation mit einem Befehl
--------------------------------

Auf dem Server als normaler Benutzer mit sudo-Rechten (oder als root):

    sudo apt update && sudo apt install -y git
    git clone https://github.com/diplomendstadium/posteulen.git posteulen
    sudo ./posteulen/deploy/install.sh --domain posteulen.de

Das Skript fragt nur das Nötigste. Alle Fragen lassen sich auch per Parameter beantworten
(Übersicht: sudo ./posteulen/deploy/install.sh --help). Es macht Folgendes:

  1. Es prüft das System: Debian 13, root-Rechte, Architektur, Arbeitsspeicher, freien
     Speicher, ob die Ports 80 und 443 frei sind und ob die DNS-Einträge auf diesen Server
     zeigen (bei Abweichung nur eine Warnung).
  2. Es richtet zwei Paketquellen mit geprüften Signaturschlüsseln ein: Node.js 26 (NodeSource)
     und Caddy (offizielle Caddy-Quelle). So kommen auch deren Sicherheitsupdates über apt.
     Die Fingerabdrücke der Schlüssel stehen fest im Skript (deploy/lib.sh); passt einer nicht,
     bricht das Skript ab.
  3. Grundabsicherung:
     - Firewall (ufw): nur 22/tcp (SSH), 80/tcp, 443/tcp und 443/udp (HTTP/3) sind offen.
     - Automatische Sicherheitsupdates (unattended-upgrades), auch für Node.js und Caddy;
       betroffene Dienste werden danach automatisch neu gestartet (needrestart).
     - SSH nur noch mit Schlüssel: nur nach Rückfrage und nur, wenn für den angemeldeten
       Benutzer bereits ein Schlüssel hinterlegt ist (Schutz vor Aussperren).
  4. Es legt den Systembenutzer „posteulen“ und diese Verzeichnisse an:
       /opt/posteulen/repo          Kopie des Git-Repositorys (für Updates)
       /opt/posteulen/releases/…    gebaute Versionen (die letzten 3 bleiben erhalten)
       /opt/posteulen/current       Verweis auf die laufende Version
       /var/lib/posteulen           Datenbank (nur für den Dienst lesbar)
       /var/backups/posteulen       verschlüsselte Sicherungen
       /etc/posteulen               Konfiguration und Geheimnis-Datei
       /etc/posteulen/local         eigene Anpassungen (werden nie überschrieben)
     Dann baut es die Software, erzeugt einmalig die Geheimnis-Datei
     /etc/posteulen/secrets.json, legt die Datenbank an und schreibt die Caddyfile, den
     gehärteten systemd-Dienst „posteulen“ und den Sicherungs-Timer.
  5. Es startet alles und prüft über HTTPS, dass Website, Adminpanel, Health-Endpunkt und
     Sicherheits-Header funktionieren.
  6. Am Ende zeigt es eine Zusammenfassung und einen großen Hinweis zur Sicherung.

  !!! WICHTIG !!!
  Die Datei /etc/posteulen/secrets.json sofort außerhalb des Servers sichern (z. B. per scp
  auf den eigenen Rechner und dort verschlüsselt aufbewahren):

      scp root@posteulen.de:/etc/posteulen/secrets.json ./posteulen-secrets.json

  OHNE DIESE DATEI KANN SICH NACH EINEM SERVERAUSFALL NIEMAND MEHR ANMELDEN.
  Sie enthält unter anderem den geheimen Schlüssel für die Anmeldung (OPAQUE). Die Datenbank
  allein nützt ohne sie nichts – das ist Absicht: Wer nur die Datenbank stiehlt, kann damit
  keine Passwörter durchprobieren.

Das Skript darf beliebig oft erneut ausgeführt werden. Es repariert oder ergänzt dann, ändert
aber nie Geheimnis-Datei, Datenbank, Sicherungen oder Dateien in /etc/posteulen/local.

Testmodus (z. B. in einer VM ohne öffentliche Domain): --test-mode verwendet lokale
Zertifikate von Caddy statt Let's Encrypt und überspringt die DNS-Prüfung.


3. Erster Login im Adminpanel
-----------------------------

* Am Ende der Installation (bzw. des Updates, mit dem das Adminpanel dazukam) steht einmalig das
  Admin-Erstpasswort. Damit unter https://admin.posteulen.de anmelden.
* Beim ersten Login muss es geändert werden (mindestens 15 Zeichen); vorher geht nichts anderes.
* Registrierungsmodus wählen: „geschlossen“ (Standard), „nur mit Einladungscode“ oder „offen für
  alle“. Einladungscodes sind 48 Stunden gültig, einmal verwendbar und werden nur beim Erzeugen
  angezeigt.
* Das Fehlerprotokoll zeigt verständliche Einträge (ohne persönliche Daten), 30 Tage lang.
* Statistik: erstellte, vorhandene und aktive Konten sowie Briefe (nur Tageszähler).
* Löschfrist bei Inaktivität: Standard 180 Tage, mindestens 60. Betroffene werden 30 Tage vorher
  gewarnt; auch eine Verkürzung löscht niemanden ohne diese Warnung.
* Rundnachricht: erscheint im Systemchat aller Konten, mit Benachrichtigung.
* OpenAI (Bots): API-Key eintragen (wird verschlüsselt gespeichert und nie wieder angezeigt),
  Modell wählen (Standard „gpt-6-luna“; „Modelle von OpenAI laden“ oder von Hand),
  Tageslimit (Standard 200 Aufrufe),
  „Verbindung testen“. Ohne Key schreiben die Bots ihre festen Briefe, beantworten aber nichts;
  wartende Antworten werden nach dem Eintragen sofort nachgeholt. Der Server braucht dafür
  ausgehende Verbindungen zu api.openai.com (Port 443).
* Adminpasswort vergessen? Auf dem Server:
      sudo posteulen-cli admin-reset
  erzeugt ein neues Erstpasswort und meldet alle Admin-Sitzungen ab. Nutzerdaten bleiben
  unberührt.


4. Funktionstest
----------------

Im Browser https://posteulen.de öffnen, ein Konto anlegen (vorher im Adminpanel die
Registrierung öffnen oder einen Einladungscode erzeugen), abmelden und wieder anmelden.
Mit einem zweiten Konto koppeln (beide fügen sich im Adressbuch hinzu), in der Menagerie eine
Leiheule leihen (0,1 Gold) und einen Brief schicken. Die Eule fliegt in Echtzeit (25 km/h mal
Artfaktor): Wohnen beide nah beieinander, ist sie nach Minuten da, sonst nach Stunden.
Auf dem Server zeigt „sudo posteulen-cli check“, ob Datenbank und Geheimnis-Datei
zusammenpassen.


5. Sicherungen (Backups) und Wiederherstellung
----------------------------------------------

* Jeden Tag um 02:30 UTC sichert ein systemd-Timer die Datenbank: konsistent (auch während
  des Betriebs) und mit „age“ verschlüsselt. Auf dem Server liegt dafür nur der öffentliche
  Schlüssel (/etc/posteulen/backup.pub). Sicherungen werden nach 7 Tagen gelöscht – so
  verschwinden gelöschte Daten spätestens nach 7 Tagen auch aus den Sicherungen.
  Sofort sichern: sudo systemctl start posteulen-backup.service
* Privater Backup-Schlüssel: Wer bei der Installation „--backup-pubkey age1…“ angegeben hat,
  besitzt ihn bereits. Sonst hat das Skript ihn in /root/posteulen-backup-schluessel.txt
  abgelegt: diese Datei außerhalb des Servers sichern und danach auf dem Server löschen.
* Eine Kopie der Sicherungen gehört außerhalb des Servers, z. B. täglich von einem anderen
  Rechner abgeholt:
      rsync -a --delete root@posteulen.de:/var/backups/posteulen/ ./posteulen-backups/
  Auch dort höchstens 7 Tage aufbewahren (rsync --delete erledigt das).
* Geheimnis-Datei und privaten Backup-Schlüssel einmalig separat und sicher aufbewahren.

Wiederherstellung A – auf demselben Server (z. B. nach einem Bedienfehler):

  Weiter mit Schritt 2 unten. Die Geheimnis-Datei ist ja noch da.

Wiederherstellung B – nach einem Totalausfall auf einem neuen Server:

  Gebraucht werden die drei Dinge, die außerhalb des Servers gesichert sein sollten:
  posteulen-secrets.json, posteulen-backup-schluessel.txt und eine Sicherung
  (posteulen-…-taeglich.sqlite.age). Alle drei per scp auf den neuen Server kopieren, z. B.
  nach /root.

  1. VOR der Installation die Geheimnis-Datei zurücklegen. Das Skript übernimmt sie dann
     (es überschreibt sie nie) und setzt die richtigen Rechte:
         sudo install -d -m 0700 /etc/posteulen
         sudo install -m 0600 posteulen-secrets.json /etc/posteulen/secrets.json
     Dann wie in Abschnitt 2 installieren, aber mit dem bisherigen öffentlichen
     Backup-Schlüssel. Er steht in der Schlüsseldatei in der Zeile „# public key: age1…“:
         grep 'public key' posteulen-backup-schluessel.txt
         sudo ./posteulen/deploy/install.sh --domain posteulen.de --backup-pubkey age1…
     So bleiben auch alle künftigen Sicherungen mit dem bisherigen Schlüssel lesbar.
  2. Sicherung entschlüsseln und einspielen:
         sudo systemctl stop posteulen
         sudo age --decrypt --identity posteulen-backup-schluessel.txt \
              --output /tmp/restore.sqlite posteulen-JJJJMMTTTHHMMSSZ-taeglich.sqlite.age
         sudo rm -f /var/lib/posteulen/posteulen.sqlite-wal /var/lib/posteulen/posteulen.sqlite-shm
         sudo install -m 0600 -o posteulen -g posteulen /tmp/restore.sqlite /var/lib/posteulen/posteulen.sqlite
         sudo rm /tmp/restore.sqlite
  3. Prüfen und starten:
         sudo posteulen-cli migrate      (nur nötig, wenn die Sicherung älter als die Version ist)
         sudo posteulen-cli check
         sudo systemctl start posteulen
     „check“ meldet einen Fehler, wenn Geheimnis-Datei und Datenbank nicht zusammengehören.
  4. Bei B: die Schlüsseldatei und die Sicherung vom neuen Server wieder löschen
     (sudo rm /root/posteulen-backup-schluessel.txt /root/posteulen-*.sqlite.age).
     Danach mit einem Konto anmelden und einen alten Brief öffnen.

Alles, was nach der verwendeten Sicherung geschah, ist verloren. Nutzer müssen sich neu
anmelden, wenn ihre Sitzung nach der Sicherung entstanden ist. Eulen, die laut Sicherung
unterwegs waren, landen nach dem Start sofort, wenn ihre Ankunftszeit schon vorbei ist.

Beide Wege (A und B) werden bei jeder Version automatisch in einer Debian-13-VM durchgespielt
(npm run test:vm).


6. Updates
----------

    sudo posteulen-update --check     zeigt installierte und verfügbare Version
    sudo posteulen-update             spielt die neueste Version ein
    sudo posteulen-update v0.1.0      spielt eine bestimmte Version ein

Ablauf: neue Version holen → deren Update-Schritte ausführen → bauen (die alte Version läuft
währenddessen weiter) → verschlüsselte Sicherung → Dienst stoppen → Datenbank-Migrationen →
umschalten → starten → Funktionsprüfung. Die Ausfallzeit beträgt höchstens wenige Minuten.
Versionen dürfen übersprungen werden.

Optional prüft „--verify-tags“ die Signatur der Version gegen die Schlüssel in
deploy/allowed_signers (Versionen werden vom Projektverantwortlichen signiert).

Wenn ein Update schiefgeht: Das Skript kehrt automatisch zur vorherigen Version zurück und
spielt die unmittelbar davor gemachte Momentaufnahme der Datenbank ein. Es erklärt, was
passiert ist. Den Fehler bitte mit der Ausgabe von
    journalctl -u posteulen -n 100
melden.

Nachträglich zurück zur vorigen Version (alles, was seit dem Update entstanden ist, geht
verloren!):
    sudo posteulen-update --rollback

Für den automatischen Rückfall bleibt vor jedem Update zusätzlich eine unverschlüsselte
Momentaufnahme in /var/lib/posteulen/snapshots (gleich geschützt wie die Datenbank selbst);
auch sie wird nach 7 Tagen gelöscht.


7. Logs und häufige Fehler
--------------------------

    journalctl -u posteulen -n 100    Backend
    journalctl -u caddy -n 100        Webserver/HTTPS
    systemctl status posteulen

Die Logs enthalten bewusst keine IP-Adressen, keine Namen und keine Inhalte.

* „Geheimnis-Datei fehlt“: die gesicherte secrets.json zurückspielen (Abschnitt 5).
* „Die Geheimnis-Datei passt nicht zu dieser Datenbank“: falsche secrets.json – die zur
  Datenbank gehörende Datei zurückspielen.
* „Migrationen stehen aus“: sudo posteulen-cli migrate
* Kein HTTPS-Zertifikat: DNS-Einträge prüfen (Abschnitt 1), dann sudo systemctl restart caddy.
* Bots antworten nicht: Im Adminpanel unter „OpenAI (Bots)“ Key, Modell und „Verbindung
  testen“ prüfen; das Fehlerprotokoll zeigt die Ursache. Antworten werden alle 24 Stunden
  erneut versucht, nach dem Speichern eines Keys sofort. Ist das Tageslimit erreicht, kommen
  die Antworten am nächsten Tag.
* Benachrichtigungen kommen nicht an: In der App unter Einstellungen eine Test-Benachrichtigung
  schicken. Die Hilfe der App erklärt iPhone und Android ohne Google-Dienste. Der Server muss
  Push-Dienste über Port 443 erreichen können.
* Nutzer sehen „Bitte neu laden“: Nach einem Update lädt die App selbst neu; ältere Tabs
  bekommen diese Aufforderung statt eines Fehlers.
* Die App zeigt „Keine Verbindung“: Ist der Dienst gestartet (systemctl status posteulen) und
  Caddy erreichbar (systemctl status caddy)?


8. Optional
-----------

* IP-Freigabeliste für das Adminpanel: bei der Installation
      --admin-allowlist 203.0.113.7/32,2001:db8::/64
  angeben oder die Datei /etc/posteulen/local/admin-allowlist.caddy anlegen:
      @nicht_erlaubt not remote_ip 203.0.113.7/32
      respond @nicht_erlaubt 403
  danach: sudo systemctl reload caddy
* Eigener ntfy-Server als UnifiedPush-Server: Wer Android ohne Google-Dienste nutzt und keinen
  fremden Push-Server möchte, kann ntfy selbst betreiben (https://docs.ntfy.sh/install/) und in
  der ntfy-App auf dem Handy als Server eintragen. PostEulen braucht dafür keine Einstellung: Es
  sendet an jede Push-Adresse, die der Browser meldet (nur HTTPS, keine privaten Adressen).
* Ausgehende Verbindungen: Der Server muss Push-Dienste per HTTPS (Port 443) erreichen können
  (Mozilla, Google, Apple, UnifiedPush-Server).


9. Datenschutzerklärung und Impressum
-------------------------------------

Die Datenschutzerklärung liegt als ENTWURF in der App (/datenschutz). Vor dem öffentlichen
Betrieb die Platzhalter in eckigen Klammern ausfüllen – Verantwortlicher, Kontakt, Hoster,
Auftragsverarbeitung. Das Impressum (/impressum) enthält Kontakt und Haftungsausschluss; ob
weitere Angaben nötig sind (z. B. Name und Anschrift), hängt vom Betrieb ab. Beide Texte
rechtlich prüfen lassen. Sie stehen in shared/src/texts/legal.ts. Im eigenen Repository ändern, committen, eine neue Version
taggen und mit „sudo posteulen-update“ einspielen. (Direkt auf dem Server geänderte Dateien
überschreibt das nächste Update.)

Wer die Bots nutzt, überträgt Briefe an Bots an OpenAI. Dafür ggf. die Datenverarbeitungs-
bedingungen von OpenAI (Data Processing Addendum) abschließen.


Anhang: Lokale Entwicklung
--------------------------

Voraussetzung: Node.js 26 (z. B. aus https://deb.nodesource.com oder https://nodejs.org).

    npm start          installiert Abhängigkeiten, baut und startet lokal:
                       App http://localhost:8080, Verwaltung http://localhost:8081
                       (Admin-Erstpasswort: data/admin-erstpasswort.txt; Registrierung öffnen
                       mit POSTEULEN_PREVIEW_REGISTRATION=open npm start)
    npm run dev        Entwicklungsmodus mit automatischem Neuladen (Port 5173/5174)
    npm test           alle Prüfungen und Tests
    npm run test:vm    Installations- und Update-Test in einer Debian-13-VM (QEMU/KVM)
