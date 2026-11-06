/**
 * Privacy policy (draft) and imprint (SPEC 8.11). Placeholders in square brackets are filled in
 * by the operator after legal advice; the texts are drafts and say so.
 */
import { ACCOUNT, OPERATIONS } from '../constants.ts';
import { de } from './de.ts';
import type { HelpSection } from './help.ts';

export const PRIVACY_INTRO =
  'Entwurf – noch nicht rechtlich geprüft. Kurz gesagt: PostEulen speichert so wenig wie möglich. Briefe zwischen Menschen kann nur ihr lesen, IP-Adressen werden nicht gespeichert, und es gibt weder Werbung noch Analyse-Werkzeuge.';

export const PRIVACY_SECTIONS: readonly HelpSection[] = [
  {
    id: 'verantwortlich',
    title: 'Wer ist verantwortlich?',
    blocks: [
      'Verantwortlich für die Datenverarbeitung: [Name und Anschrift des Verantwortlichen]. Kontakt: [Kontaktmöglichkeit].',
      'Der Server steht bei: [Name und Anschrift des Hosters]. Mit ihm besteht ein Vertrag zur Auftragsverarbeitung: [ja/nein].',
    ],
  },
  {
    id: 'gespeichert',
    title: 'Was gespeichert wird',
    blocks: [
      'PostEulen fragt weder nach E-Mail-Adresse noch nach Klarname oder Telefonnummer. Gespeichert wird nur, was die App zum Funktionieren braucht:',
      [
        'Konto: Nutzername, fiktiver Wohnort (auf etwa 1 km gerundet), Tag der Registrierung und Tag deiner letzten Aktivität (nur der Tag, keine Uhrzeit, kein Verlauf).',
        'Anmeldung: ein OPAQUE-Datensatz. Aus ihm lässt sich dein Passwort nicht ermitteln; das Passwort selbst verlässt nie dein Gerät.',
        'Sitzung: ein Prüfwert deines Sitzungs-Cookies und der Zeitpunkt der letzten Nutzung.',
        'Schlüssel: deine öffentlichen Schlüssel lesbar, deine privaten Schlüssel und dein Kontakt-Tresor nur verschlüsselt. Den Schlüssel dafür kennt nur dein Gerät, während du angemeldet bist.',
        'Kontakte: wer mit wem verbunden ist, offene Kontaktanfragen (höchstens 24 Stunden) und Schlüsselwarnungen.',
        'Briefe zwischen Menschen: nur verschlüsselt. Lesbar für den Server sind Absender, Empfänger, Zeitpunkte, Pergamentgröße, Zustell- und Lesestatus (nur ja/nein).',
        'Spielstand: Gold, die letzten 20 Buchungen, Eulen mit ihren Werten und Flügen.',
        'Bot-Chats und Systemnachrichten: im Klartext (siehe unten).',
        'Benachrichtigungen: die Adresse deines Push-Abos und noch nicht bestätigte Benachrichtigungen (ohne Inhalte).',
        `Namenssperren: für gelöschte oder alte Namen nur ein nicht umkehrbarer Prüfwert, ${ACCOUNT.NAME_LOCK_DAYS} Tage lang.`,
      ],
      'Der Admin sieht nur zusammengezählte Statistiken (zum Beispiel Anzahl der Konten und Briefe pro Tag) und ein Fehlerprotokoll ohne personenbezogene Daten. Er hat keine Nutzerliste, keinen Zugriff auf Briefe und kann nichts an Konten ändern. Die Datenbank selbst enthält die oben genannten Daten aber zwangsläufig lesbar.',
    ],
  },
  {
    id: 'verschluesselung',
    title: 'Ende-zu-Ende-Verschlüsselung und ihre Grenzen',
    blocks: [
      'Briefe zwischen Menschen, auch Begleitbriefe zu Gold, Eulen und Küken, werden auf deinem Gerät verschlüsselt und signiert. Weder der Betreiber noch jemand mit einer Kopie der Datenbank kann sie lesen.',
      'Grenzen: Der Server sieht die Metadaten – wer wem wann schreibt, Kontaktbeziehungen, Pergamentgröße, Zustell- und Lesestatus, fiktive Wohnorte und Spielstände. Und wer dein entsperrtes Gerät in der Hand hat, kann deine Briefe lesen.',
      'Entschlüsselte Briefe liegen nur im Arbeitsspeicher deines Geräts, nie dauerhaft. Für „angemeldet bleiben“ speichert der Browser deine Schlüssel zusätzlich verschlüsselt in seiner Datenbank (IndexedDB); beim Abmelden werden sie gelöscht.',
    ],
  },
  {
    id: 'bots',
    title: 'Bots und OpenAI',
    blocks: [
      de.bots.notice,
      'Zum Beantworten schickt der Server den Rollentext des Bots, eine kurze Zusammenfassung eures Briefwechsels, die letzten 6 Briefe und deinen neuen Brief an OpenAI (OpenAI, L.L.C., USA bzw. OpenAI Ireland Ltd.). Namen, Nutzer-IDs oder andere Kennungen werden nicht übermittelt, und die Speicherung bei OpenAI ist abgeschaltet, soweit die Schnittstelle das erlaubt (store: false). OpenAI kann Anfragen trotzdem für eine begrenzte Zeit zur Missbrauchserkennung aufbewahren. Schreib Bots deshalb nichts Persönliches.',
      'Die Zusammenfassung liegt im Klartext beim Bot-Chat. Sie wird gelöscht, wenn du den Chat löschst, den Bot entfernst oder dein Konto gelöscht wird.',
      'Möchtest du das nicht, schreib den Bots einfach nicht oder entferne sie im Adressbuch.',
    ],
  },
  {
    id: 'push',
    title: 'Benachrichtigungen',
    blocks: [
      'Benachrichtigungen laufen über den Push-Dienst deines Browsers oder Systems: Apple, Google, Mozilla oder einen UnifiedPush-Server (zum Beispiel ntfy oder den Server deiner Verteiler-App). Die Inhalte sind verschlüsselt und enthalten nie Namen oder Brieftexte. Der Push-Dienst sieht aber, wann dein Gerät eine Benachrichtigung bekommt.',
      'Das Push-Abo wird beim Abmelden, bei der Anmeldung auf einem anderen Gerät und beim Löschen des Kontos entfernt.',
    ],
  },
  {
    id: 'cookie',
    title: 'Ein einziges Cookie',
    blocks: [
      'PostEulen setzt genau ein Cookie: das Sitzungs-Cookie, ohne das die Anmeldung nicht funktioniert. Es ist technisch notwendig, nur für PostEulen lesbar und enthält eine zufällige Zeichenfolge; der Server speichert davon nur einen Prüfwert. Es gibt keine Tracking-Cookies, keine Werbung, keine Analyse-Werkzeuge und keine Inhalte von fremden Servern.',
    ],
  },
  {
    id: 'ip',
    title: 'Keine IP-Adressen, keine Protokolle',
    blocks: [
      'Deine IP-Adresse wird nicht gespeichert. Sie liegt nur kurz im Arbeitsspeicher, um Angriffe wie massenhaftes Passwortraten zu bremsen, und verschwindet von selbst. Der Webserver führt kein Zugriffsprotokoll; auch Fehlerprotokolle enthalten keine IP-Adressen, Namen oder Inhalte. Browser-Kennungen (User-Agent) und Fingerabdrücke werden nicht erfasst.',
    ],
  },
  {
    id: 'backups',
    title: 'Backups',
    blocks: [
      `Der Server sichert die Datenbank täglich verschlüsselt. Sicherungen werden nach ${OPERATIONS.BACKUP_RETENTION_DAYS} Tagen gelöscht, auch die Kopie außerhalb des Servers. Gelöschte Daten verschwinden deshalb spätestens nach ${OPERATIONS.BACKUP_RETENTION_DAYS} Tagen auch aus den Backups.`,
    ],
  },
  {
    id: 'loeschung',
    title: 'Löschung',
    blocks: [
      `Du kannst dein Konto jederzeit in den Einstellungen löschen. Nach ${ACCOUNT.SELF_DELETE_GRACE_HOURS} Stunden (falls du dich nicht wieder anmeldest) und nachdem deine letzten Eulen zugestellt haben, werden alle Daten deines Kontos gelöscht: Profil, Anmeldedaten, Schlüssel, Tresor, Sitzungen, Push-Abo, Benachrichtigungen, deine Briefkopien, Bots samt Chats, Eulen, Buchungen und Kontakte. Was andere von dir empfangen haben, bleibt bei ihnen.`,
      `Automatische Löschung: Konten ohne Aktivität werden nach einer vom Betreiber festgelegten Frist gelöscht (mindestens ${ACCOUNT.AUTO_DELETE_MIN_DAYS}, üblich ${ACCOUNT.AUTO_DELETE_DEFAULT_DAYS} Tage). ${ACCOUNT.AUTO_DELETE_WARNING_DAYS} Tage vorher bekommst du eine Warnung.`,
      'Chats löschst du selbst; ein Brief verschwindet aus der Datenbank, sobald ihn weder Absender noch Empfänger mehr haben.',
    ],
  },
  {
    id: 'rechte',
    title: 'Deine Rechte',
    blocks: [
      'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Weil PostEulen keine Kontaktdaten kennt, musst du bei einer Anfrage deinen Nutzernamen nennen. Briefinhalte kann der Betreiber nicht herausgeben – er kann sie nicht lesen.',
      'Rechtsgrundlagen: die Bereitstellung der App, die du nutzen möchtest (Art. 6 Abs. 1 lit. b DSGVO), und der Schutz vor Missbrauch (Art. 6 Abs. 1 lit. f DSGVO). [Nach rechtlicher Beratung ergänzen.]',
    ],
  },
];

export const IMPRINT_INTRO =
  'PostEulen ist ein technisches Experiment für den Eigengebrauch – gebastelt aus Neugier, Pergament und einer gesunden Portion Eulenliebe. Es ist kein Produkt, kein Dienst mit Erreichbarkeitsversprechen und erst recht kein Unternehmen.';

export const IMPRINT_SECTIONS: readonly HelpSection[] = [
  {
    id: 'angaben',
    title: 'Angaben',
    blocks: ['[Name und Anschrift nach rechtlicher Beratung ergänzen.]'],
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    blocks: [
      'Zum Entwickler geht es am schnellsten über Mastodon: @iak@23.social (https://23.social/@iak). Eulen werden dort leider nicht angenommen.',
    ],
  },
  {
    id: 'haftung',
    title: 'Haftung',
    blocks: [
      'Die Nutzung erfolgt auf eigene Gefahr. Wir übernehmen keinerlei Haftung – weder dafür, dass Eulen pünktlich, vollständig oder überhaupt ankommen, noch für verlorene Briefe, verlorenes Gold, verlorene Passwörter, verlegte Eulen oder Daten, die bei einem Ausfall verschwinden. Ein Anspruch auf Verfügbarkeit besteht nicht; der Dienst kann jederzeit ohne Ankündigung eingestellt werden.',
      'Für Inhalte, die Nutzer einander schreiben, sind allein diese selbst verantwortlich – lesen können wir sie ohnehin nicht. Antworten der Bots erzeugt eine KI; sie können falsch sein und sind keine Beratung.',
      'Für Inhalte verlinkter fremder Seiten sind ausschließlich deren Betreiber verantwortlich.',
    ],
  },
  {
    id: 'entwurf',
    title: 'Hinweis',
    blocks: ['Dieses Impressum ist ein Entwurf und wird nach rechtlicher Beratung angepasst.'],
  },
];
