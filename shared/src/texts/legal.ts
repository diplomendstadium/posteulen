/**
 * Privacy policy and imprint (SPEC 8.11): standard texts of the project. Whoever runs an
 * instance is responsible for adapting them on their own (SPEC 8.11, PROMPT).
 */
import { ACCOUNT, FEEDBACK, LETTER, OPERATIONS } from '../constants.ts';
import { de } from './de.ts';
import type { HelpSection } from './help.ts';
import {
  IMPRINT_INTRO_EN,
  IMPRINT_SECTIONS_EN,
  PRIVACY_INTRO_EN,
  PRIVACY_SECTIONS_EN,
} from './legal-en.ts';

export const PRIVACY_INTRO =
  'Kurz gesagt: PostEulen speichert so wenig wie möglich. Briefe zwischen Menschen kann nur ihr lesen, IP-Adressen werden nicht gespeichert, und es gibt weder Werbung noch Analyse-Werkzeuge.';

export const PRIVACY_SECTIONS: readonly HelpSection[] = [
  {
    id: 'gespeichert',
    title: 'Was gespeichert wird',
    blocks: [
      'PostEulen fragt weder nach E-Mail-Adresse noch nach Klarname oder Telefonnummer. Gespeichert wird nur, was die App zum Funktionieren braucht:',
      [
        'Konto: Nutzername, fiktiver Wohnort (auf etwa 1 km gerundet), Tag der Registrierung, Tag deiner letzten Aktivität (nur der Tag, keine Uhrzeit, kein Verlauf) und die gewählte Sprache der App.',
        'Anmeldung: ein OPAQUE-Datensatz. Aus ihm lässt sich dein Passwort nicht ermitteln; das Passwort selbst verlässt nie dein Gerät.',
        `Sitzung: ein Prüfwert deines Sitzungs-Cookies und der Zeitpunkt der letzten Nutzung; nach ${ACCOUNT.USER_SESSION_IDLE_DAYS} Tagen ohne Nutzung gelöscht.`,
        'Schlüssel: deine öffentlichen Schlüssel lesbar, deine privaten Schlüssel und dein Kontakt-Tresor nur verschlüsselt. Den Schlüssel dafür kennt nur dein Gerät, während du angemeldet bist.',
        'Kontakte: wer mit wem verbunden ist, offene Kontaktanfragen (höchstens 24 Stunden) und Schlüsselwarnungen.',
        'Briefe zwischen Menschen: nur verschlüsselt. Lesbar für den Server sind Absender, Empfänger, Zeitpunkte, Pergamentgröße, Zustell- und Lesestatus (nur ja/nein).',
        'Spielstand: Gold, die letzten 20 Buchungen, Eulen mit ihren Werten und Flügen.',
        'Bot-Chats und Systemnachrichten: im Klartext (siehe unten).',
        `Nachrichten an den Admin (freiwillig, aus den Einstellungen): im Klartext und ohne Absender, ${FEEDBACK.RETENTION_DAYS} Tage lang. Am Konto steht nur der Tag der letzten Nachricht (für die Grenze von einer Nachricht pro Tag).`,
        'Benachrichtigungen: die Adresse deines Push-Abos und noch nicht bestätigte Benachrichtigungen (ohne Inhalte).',
        `Namenssperren: für gelöschte oder alte Namen nur ein nicht umkehrbarer Prüfwert, ${ACCOUNT.NAME_LOCK_DAYS} Tage lang.`,
      ],
      'Der Admin sieht nur zusammengezählte Statistiken (zum Beispiel Anzahl der Konten und Briefe pro Tag) ein Fehlerprotokoll ohne personenbezogene Daten und die Nachrichten, die Nutzer ihm freiwillig schicken (ohne Absender; was darin steht, entscheidest du). Er hat keine Nutzerliste, keinen Zugriff auf Briefe und kann nichts an Konten ändern. Die Datenbank selbst enthält die oben genannten Daten aber zwangsläufig lesbar.',
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
      'Neben dem Erklärbär gibt es Bots, die der Betreiber im Bots-Kontrollzentrum anlegt. Ihre geplanten Briefe gehen an alle Konten, die Bots nicht entfernt haben; hast du einem solchen Bot geschrieben, passt die KI seinen nächsten Brief an dich an. Im Kontrollzentrum sieht der Betreiber nur zusammengezählte Zahlen (Briefe abgeschickt, zugestellt, gelesen, Antworten) und auf einer Karte, wo Bot-Eulen gerade fliegen oder rasten – ohne Namen, aber eine rastende Eule steht an deinem fiktiven Wohnort. Die tägliche Sicherung der Bots enthält nur ihre Einstellungen, geplanten Briefe und Bilder, keine Briefe von Spielern. Verschickte Events eines Bots werden 36 Monate nach dem Versand samt ihren Zustellungen an die Spieler endgültig gelöscht.',
      'Möchtest du das nicht, schreib den Bots einfach nicht oder entferne sie in ihrem Chat – oder alle, auch künftige, in den Einstellungen.',
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
      'Die Sprache, die du vor der Anmeldung wählst, ob du den Hinweis zu Benachrichtigungen ausgeblendet hast und welche Hinweise des Betreibers (Banner) du weggeklickt hast, merkt sich nur dein Browser in seinem lokalen Speicher, nicht der Server.',
    ],
  },
  {
    id: 'ip',
    title: 'Keine IP-Adressen, keine Protokolle',
    blocks: [
      'Deine IP-Adresse wird nicht gespeichert. Sie liegt nur kurz im Arbeitsspeicher, um Angriffe wie massenhaftes Passwortraten zu bremsen, und verschwindet von selbst. Der Webserver führt kein Zugriffsprotokoll; auch Fehlerprotokolle enthalten keine IP-Adressen, Namen oder Inhalte. Browser-Kennungen (User-Agent) und Fingerabdrücke werden nicht erfasst.',
      'Zugang über das Tor-Netz: PostEulen ist zusätzlich als Onion-Dienst erreichbar. Dabei sieht der Server deine IP-Adresse gar nicht; alle Besucher über Tor erscheinen ihm gleich. Für diesen Zugang hält der Server Verbindungen ins Tor-Netz; es werden dabei keine Daten über dich an Dritte übermittelt.',
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
      `Du kannst dein Konto jederzeit in den Einstellungen löschen. Nach ${ACCOUNT.SELF_DELETE_GRACE_HOURS} Stunden (falls du dich nicht wieder anmeldest) und sobald deine letzten Eulen alles zugestellt haben, werden alle Daten deines Kontos gelöscht: Profil, Anmeldedaten, Schlüssel, Tresor, Sitzungen, Push-Abo, Benachrichtigungen, deine Briefkopien, Bots samt Chats, Eulen, Buchungen und Kontakte. Was andere von dir empfangen haben, bleibt bei ihnen.`,
      `Automatische Löschung: Konten ohne Aktivität werden nach einer vom Betreiber festgelegten Frist gelöscht (mindestens ${ACCOUNT.AUTO_DELETE_MIN_DAYS}, üblich ${ACCOUNT.AUTO_DELETE_DEFAULT_DAYS} Tage). ${ACCOUNT.AUTO_DELETE_WARNING_DAYS} Tage vorher bekommst du eine Warnung.`,
      `Briefe und Systemnachrichten werden ${LETTER.RETENTION_MAX_DAYS} Tage nach ihrer Zustellung automatisch und unwiderruflich gelöscht, bei allen Beteiligten. In den Einstellungen kannst du deine eigenen Kopien schon nach 30, 90 oder 180 Tagen löschen lassen. Gelöscht wird einmal pro Woche (montags, 04:00 UTC); ein Brief kann deshalb bis zu sieben Tage länger gespeichert bleiben als seine Frist, nach einem ausgefallenen Lauf bis zum nächsten Montag. Selbst verbrannte Briefe sind sofort gelöscht.`,
      'Chats löschst du selbst; ein Brief verschwindet aus der Datenbank, sobald ihn weder Absender noch Empfänger mehr haben.',
    ],
  },
];

export const IMPRINT_INTRO =
  'PostEulen ist ein technisches Experiment für den Eigengebrauch – gebastelt aus Neugier, Pergament und einer gesunden Portion Eulenliebe. Es ist kein Produkt, kein Dienst mit Erreichbarkeitsversprechen und erst recht kein Unternehmen.';

export const IMPRINT_SECTIONS: readonly HelpSection[] = [
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
];

export interface LegalTexts {
  readonly privacyIntro: string;
  readonly privacy: readonly HelpSection[];
  readonly imprintIntro: string;
  readonly imprint: readonly HelpSection[];
}

/** Privacy policy and imprint in a language (v0.4). */
export function legalOf(language: 'de' | 'en'): LegalTexts {
  return language === 'en'
    ? {
        privacyIntro: PRIVACY_INTRO_EN,
        privacy: PRIVACY_SECTIONS_EN,
        imprintIntro: IMPRINT_INTRO_EN,
        imprint: IMPRINT_SECTIONS_EN,
      }
    : {
        privacyIntro: PRIVACY_INTRO,
        privacy: PRIVACY_SECTIONS,
        imprintIntro: IMPRINT_INTRO,
        imprint: IMPRINT_SECTIONS,
      };
}
