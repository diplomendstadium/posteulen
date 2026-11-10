/**
 * Help text (SPEC 8.11): one section per function, FAQ and push on Google-free Android.
 * v0.3: written for people who have never heard of web apps – how PostEulen gets onto the
 * home screen comes right after the introduction. Phones without Google services and
 * UnifiedPush are explained only here (and in the README), not in onboarding or bot letters.
 * The same text is the knowledge base of the Erklärbär (SPEC 10.2, D-88) – `helpAsText()`
 * turns it into plain text for his system prompt. All numbers come from the constants.
 * v0.4: the English help lives in help-en.ts with the same section ids; `helpOf()` picks
 * by language.
 */
import {
  ACCOUNT,
  BOTS,
  DONATION,
  FLIGHT,
  GOLD,
  LETTER,
  MAP,
  MENAGERIE,
  OWL,
  FEEDBACK,
  SECURITY,
  VOUCHER,
} from '../constants.ts';
import { formatGold } from '../game/gold.ts';
import { CHEAPEST_SPECIES as CHEAPEST, SPECIES } from '../species.ts';
import { de } from './de.ts';
import { HELP_EN } from './help-en.ts';

/** A paragraph (string) or a bullet list (array of strings). */
export type HelpBlock = string | readonly string[];

export interface HelpSection {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly HelpBlock[];
}

export interface HelpQuestion {
  readonly question: string;
  readonly answer: string;
}

const gold = (tenths: number): string => `${formatGold(tenths)} Gold`;
const percent = (share: number): string => `${Math.round(share * 100)} %`;
/** One decimal with a comma, rounded half up (v0.5). */
const decimalDe = (value: number): string =>
  (Math.round(value * 10 + 1e-9) / 10).toFixed(1).replace('.', ',');
const hh = (hour: number): string => String(hour).padStart(2, '0');
const dailyGoldTime = `${hh(GOLD.DAILY_HOUR_UTC)}:00 Uhr UTC (in Deutschland ${hh(GOLD.DAILY_HOUR_UTC + 1)}:00 Uhr, im Sommer ${hh(GOLD.DAILY_HOUR_UTC + 2)}:00 Uhr)`;

export const HELP_INTRO =
  'Hier erfährst du in Ruhe, wie PostEulen funktioniert – ganz ohne Vorwissen. Ganz oben steht, wie PostEulen auf dein Handy kommt; danach hat jeder Bereich der App seinen eigenen Abschnitt, und am Ende stehen häufige Fragen. Noch etwas unklar? Schreib dem Erklärbären einen Brief – er kennt diese Hilfe auswendig.';

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: 'idee',
    title: 'Was ist PostEulen?',
    blocks: [
      'PostEulen ist ein Briefkasten mit Eulen. Du schreibst Freunden Briefe, und eine Eule trägt sie hin – nicht in Sekunden wie bei einer Kurznachricht, sondern so lange, wie eine Eule eben fliegt. Je weiter weg dein Gegenüber wohnt, desto länger dauert es. Vorfreude gehört dazu.',
      'Nebenbei kümmerst du dich um deine Eulen: Du kaufst oder leihst sie, fütterst und streichelst sie, verdienst jeden Tag ein bisschen Gold und kannst Freunden Gold oder sogar eine Eule schicken.',
      'Deine Briefe an andere Menschen sind verschlüsselt: Nur du und dein Gegenüber können sie lesen – auch die Betreiber von PostEulen nicht.',
      'PostEulen ist eine Webseite, die sich wie eine App benimmt. Du kannst sie ganz ohne App-Store auf deinen Startbildschirm legen – wie das geht, steht gleich im nächsten Abschnitt.',
    ],
  },
  {
    id: 'installieren',
    title: 'PostEulen aufs Handy holen – ganz ohne App-Store',
    blocks: [
      'Apps holt man sich im App-Store, oder? Meistens schon. Es gibt aber noch einen zweiten Weg, den viele gar nicht kennen: Manche Webseiten können sich in eine App verwandeln. Fachleute nennen das „Web-App“ – du musst dir das Wort aber nicht merken. Du legst PostEulen einfach auf deinen Startbildschirm, und ab dann hat es dort ein eigenes Eulen-Symbol, öffnet sich ohne Adresszeile und sieht aus wie jede andere App.',
      'Keine Sorge: Das ist kein Hexenwerk und nicht gefährlich. Es wird nichts heimlich installiert, PostEulen will nicht an deine Fotos oder dein Telefonbuch, und du kannst das Symbol jederzeit wieder löschen. Neue Versionen kommen von selbst.',
      `So geht es auf einem ${de.welcome.android}:`,
      de.welcome.androidSteps,
      `So geht es auf einem ${de.welcome.ios}:`,
      de.welcome.iosSteps,
      `${de.welcome.other}: ${de.welcome.otherSteps}`,
      'Am Computer kannst du PostEulen in Chrome oder Edge über das kleine Installieren-Symbol in der Adresszeile ebenfalls als App einrichten, in Safari am Mac über Ablage → „Zum Dock hinzufügen“. Nötig ist das aber nicht.',
      `${de.welcome.push1} ${de.welcome.push2}`,
    ],
  },
  {
    id: 'sicher',
    title: 'Spiel und sicherer Briefkasten zugleich',
    blocks: [
      'PostEulen bewegt sich im Grenzbereich zwischen Spiel und Messenger. Die Eulen, das Gold und die Flugzeiten sind Spiel – die Verschlüsselung ist es nicht. Unter der Pergamentoberfläche arbeitet harte, seriöse Kryptografie auf dem Stand der Zeit. Deshalb eignet sich PostEulen durchaus auch als sicherer Kommunikationsweg, wenn es nicht auf Minuten ankommt.',
      [
        'Briefe zwischen Menschen werden auf deinem Gerät mit XChaCha20-Poly1305 verschlüsselt und mit Ed25519 unterschrieben. Den Schlüssel für jeden Brief bekommen nur Absender und Empfänger, verpackt nach dem Standard HPKE (RFC 9180).',
        'Dein Passwort verlässt nie dein Gerät. Die Anmeldung läuft über OPAQUE (RFC 9807): Der Server kann dein Passwort weder sehen noch aus seiner Datenbank erraten.',
        'Mit der Sicherheitsnummer prüft ihr, dass wirklich niemand dazwischensitzt.',
        'Verwendet werden nur bewährte, offen geprüfte Bibliotheken (libsodium, hpke-js, OPAQUE von Serenity) – keine selbst gebastelte Kryptografie. Der Quelltext ist offen.',
      ],
      'Was PostEulen nicht verbergen kann: wer wem wann schreibt (Metadaten). Und wer dein entsperrtes Gerät in der Hand hat, kann deine Briefe lesen. Briefe an Bots und Systemnachrichten sind nicht verschlüsselt.',
    ],
  },
  {
    id: 'konto',
    title: 'Konto, Passwort und Anmeldung',
    blocks: [
      `Dein Nutzername hat ${ACCOUNT.USER_NAME_MIN_CHARS} bis ${ACCOUNT.USER_NAME_MAX_CHARS} Zeichen: lateinische Buchstaben, Umlaute, ß, gängige Akzentbuchstaben, Ziffern und einzelne Leerzeichen. Groß- und Kleinschreibung und leicht verwechselbare Zeichen (0 und O, 1, l und I) zählen als gleich – so kann sich niemand als jemand anderes ausgeben.`,
      `Dein Passwort hat mindestens ${ACCOUNT.PASSWORD_MIN_CHARS} Zeichen. Ein Satz, den du dir gut merken kannst, ist ideal. Das Passwort verlässt nie dein Gerät und liegt nirgends auf dem Server. Deshalb gilt: Wenn du es vergisst, sind alle deine Daten unwiderruflich verloren. Niemand kann es zurücksetzen, auch der Admin nicht.`,
      'Beim Erstellen setzt du einen fiktiven Wohnort per Pin auf die Karte – überlege sorgfältig, ob du deine echte Adresse wählen möchtest. Dort wohnen deine Eulen; von dort fliegen sie los.',
      'Du kannst immer nur auf einem Gerät angemeldet sein. Meldest du dich auf einem anderen Gerät an, endet die Sitzung auf dem alten. Das ist auch ein Schutz: Benutzt jemand anderes dein Passwort, wirst du selbst ständig abgemeldet und merkst es sofort – ändere dann gleich dein Passwort. Nach mehrfach falschem Passwort musst du etwas warten und ein kleines Rechenrätsel lösen lassen (das macht dein Gerät automatisch).',
      `Ohne Nutzung endet die Anmeldung nach ${ACCOUNT.USER_SESSION_IDLE_DAYS} Tagen. Beim Abmelden löscht PostEulen alle Schlüssel von deinem Gerät und vergisst auch alles, was es sich über deine Kontakte gemerkt hat – meldet sich danach jemand anderes im selben Fenster an, sieht er nichts davon. Beim nächsten Anmelden holt PostEulen deine Schlüssel verschlüsselt vom Server zurück.`,
    ],
  },
  {
    id: 'ueberblick',
    title: 'Die App im Überblick',
    blocks: [
      'Nach der Anmeldung siehst du die Übersicht mit Kacheln für alle Bereiche: Briefwechsel, Eulen, Finanzen, Menagerie, Adressbuch, Karte, Einstellungen und Hilfe. Auf dem Handy erreichst du die wichtigsten Bereiche auch über die Leiste am unteren Rand.',
      'Oben in der braunen Leiste siehst du deinen Goldstand. Ist neue Post da, hüpft dort „Neue Post!“ – ein Tipp darauf führt dich zum Briefwechsel. Auf der Übersicht steht neben dem Schriftzug klein die Version der App. Sind Benachrichtigungen nicht eingerichtet, erscheint darunter ein Hinweis, der dich zu den Einstellungen führt. Stört er dich, blende ihn mit „Ausblenden bis zur nächsten Anmeldung“ aus.',
      'Was du schon gelesen hast, gilt sofort als gelesen – die Zähler in der Übersicht und in der Leiste gehen ohne Neuladen zurück.',
      'Unter „Neuigkeiten“ zeigt die Übersicht alles, was dich nicht per Benachrichtigung erreicht hat – zum Beispiel weil das Handy aus war.',
      'Darunter begrüßt dich PostEulen mit deinem Namen – passend zur Tageszeit an deinem fiktiven Wohnort, also nach der Uhrzeit, die dort gerade gilt (mit Sommerzeit). Wer spät abends oder nachts vorbeischaut, wird als Nachteule begrüßt. Auch alle anderen Uhrzeiten in der App – Ankunft, Heimkehr, Rast, Fristen – stehen in dieser Ortszeit deines Wohnorts.',
      'Oben rechts sitzt auf jeder Seite ein kleines Fähnchen. Ein Tipp auf die britische Flagge stellt PostEulen auf Englisch um, die deutsche Flagge stellt wieder zurück (siehe Sprache).',
    ],
  },
  {
    id: 'sprache',
    title: 'Sprache: Deutsch oder Englisch',
    blocks: [
      'PostEulen gibt es auf Deutsch und auf Englisch. Deutsch ist immer der Standard. Mit dem Fähnchen oben rechts schaltest du jederzeit um: die britische Flagge für Englisch, die deutsche für Deutsch.',
      'Bist du nicht angemeldet, merkt sich dein Gerät deine Wahl. Erstellst du ein Konto in der englischen Ansicht, gilt Englisch auch für dein Konto. Nach jeder Anmeldung zeigt PostEulen dann die Sprache deines Kontos, auf jedem Gerät.',
      'Angemeldet speichert das Fähnchen die Sprache gleich im Konto. Du findest sie auch in den Einstellungen unter „Sprache“.',
      'Die Sprache gilt für alles, was PostEulen selbst schreibt: Menüs, Hilfe, Systemnachrichten, Benachrichtigungen und die Briefe der Bots. Leiheulen und Küken bekommen dann englische Namen. Briefe von Menschen bleiben natürlich, wie sie geschrieben wurden, und Bot-Briefe, die schon angekommen sind, ebenfalls.',
    ],
  },
  {
    id: 'adressbuch',
    title: 'Adressbuch und Kontakte',
    blocks: [
      'Schreiben kannst du nur Menschen, mit denen du verbunden bist. Dazu tragt ihr euch gegenseitig im Adressbuch ein, jeweils mit dem genau geschriebenen Namen. Sprecht euch vorher außerhalb der App ab: Anfragen anderer siehst du nicht, und die Antwort ist immer gleich – egal, ob es den Namen gibt. Ein versehentliches Leerzeichen am Anfang oder Ende des Namens entfernt PostEulen von selbst.',
      `Eine Anfrage wartet ${ACCOUNT.CONTACT_REQUEST_EXPIRY_HOURS} Stunden auf die Gegenseite und verfällt dann. Du kannst höchstens ${ACCOUNT.CONTACT_REQUESTS_PER_DAY} Anfragen pro Tag stellen. Sobald ihr euch beide eingetragen habt, seid ihr verbunden, und beide bekommen eine Systemnachricht.`,
      [
        '„unbestätigt“: deine Anfrage wartet noch (mit Restzeit).',
        `„inaktiv“: der Kontakt war über ${ACCOUNT.INACTIVE_AFTER_DAYS} Tage nicht da. Bis er wiederkommt, kannst du ihm nichts schicken.`,
        '„Sicherheitsnummer verglichen“: ihr habt eure Nummer geprüft (siehe Verschlüsselung).',
        '„Schlüsselwarnung“: etwas stimmt mit den Schlüsseln nicht – nichts mehr senden, siehe Verschlüsselung.',
      ],
      'Entfernst du einen Kontakt, müsst ihr euch neu koppeln. Eulen, die zwischen euch unterwegs sind, kehren sofort um. Der Chat bleibt erhalten, zeigt aber „unbekannt“ als Namen, bis ihr euch wieder verbindet.',
      'Im Adressbuch stehen nur echte Menschen. Den Erklärbär und andere Bots findest du im Briefwechsel; dort schreibst du ihnen auch (siehe Bots).',
    ],
  },
  {
    id: 'verschluesselung',
    title: 'Verschlüsselung und Sicherheitsnummer',
    blocks: [
      'Briefe zwischen Menschen werden auf deinem Gerät verschlüsselt und unterschrieben. Der Server sieht nur Kauderwelsch. Er sieht aber, wer wem wann schreibt, wie groß das Pergament ist und ob ein Brief gelesen wurde – deinem Gegenüber verrät PostEulen das nicht.',
      'Jeder Kontakt hat mit dir eine gemeinsame Sicherheitsnummer aus 60 Ziffern. Vergleicht sie außerhalb der App, etwa beim Treffen oder am Telefon. Stimmt sie überein, markiere sie im Adressbuch als verglichen. So weißt du sicher, dass niemand dazwischensitzt.',
      'Dein Gerät vergleicht die Schlüssel deiner Kontakte vor jedem Brief und beim Öffnen eines Briefwechsels. Bemerkt es, dass sich die Schlüssel eines Kontakts geändert haben, warnt es deutlich und sperrt den Versand an ihn. Das sollte nie passieren, denn Schlüssel ändern sich in PostEulen nie. Klärt es außerhalb der App; danach entfernt ihr euch und koppelt euch neu.',
      'Kann dein Gerät einen Brief nicht entschlüsseln oder nicht als echt bestätigen, zeigt PostEulen den Inhalt nicht an. Dann steht dort: „Der Brief ist unterwegs so nass geworden, dass man ihn nicht mehr lesen kann.“ Dein Gegenüber sieht: „Die Eule hat den Brief unterwegs verloren.“ Den technischen Grund bekommt nur der Admin im Fehlerprotokoll, ohne Namen.',
      'Grenzen: Wer dein entsperrtes Gerät in der Hand hat, kann deine Briefe lesen. Briefe an Bots und Systemnachrichten sind nicht verschlüsselt.',
    ],
  },
  {
    id: 'briefe',
    title: 'Briefe schreiben und lesen',
    blocks: [
      'Im Briefwechsel siehst du für jedes Gegenüber einen Chat, sortiert nach der letzten Aktivität und mit Zähler für ungelesene Briefe. Oben angeheftet sind die Systemnachrichten.',
      [
        `Kleines Pergament: bis ${LETTER.SMALL_MAX_CHARS} Zeichen, kostenlos.`,
        `Großes Pergament: bis ${LETTER.LARGE_MAX_CHARS} Zeichen, ${gold(GOLD.LARGE_PARCHMENT_SURCHARGE)} Aufpreis pro Versand.`,
      ],
      `So geht’s: Pergament wählen, Text schreiben, bei Bedarf weitere Empfänger hinzufügen (insgesamt höchstens ${LETTER.MAX_RECIPIENTS}), Eule wählen und absenden. Bei mehreren Empfängern sortiert PostEulen sie so, dass die Eule den kürzesten Weg fliegt – von dir zu allen und wieder nach Hause. Mit den Pfeilen kannst du die Reihenfolge trotzdem ändern. Bei der Eulenwahl zeigt PostEulen dir für jede Eule, wann sie bei jedem Empfänger ankommt und wann sie wieder zu Hause ist.`,
      `Keine Eule zu Hause? Dann bietet dir die Eulenwahl direkt die Leiheulen des Tages an. Geliehen und bezahlt (${gold(GOLD.LOAN_PRICE)}) wird erst, wenn du wirklich abschickst – dein Brief bleibt dabei, wie er ist.`,
      'Bei mehreren Empfängern fliegt die Eule von einem zum nächsten. Jeder sieht nur seinen eigenen Brief und kann nur dir antworten. Das geht mit eigenen Eulen und mit Leiheulen; eine Leiheule verschwindet nach dem letzten Empfänger. Bots sind nie bei mehreren Empfängern dabei.',
      `Rast beim Empfänger: Beim Schreiben wählst du, wie lange die Eule bei jedem Empfänger bleibt, bevor sie weiterfliegt – gar nicht, 1, 2, 24 oder ${LETTER.REST_HOURS_CHOICES[LETTER.REST_HOURS_CHOICES.length - 1]} Stunden (vorgewählt: ${LETTER.REST_HOURS_DEFAULT} Stunde). Während der Rast erholt sie sich wie zu Hause, und der Empfänger sieht sie unter „Eulen“ mit dem deutlichen Hinweis „Nur zur Rast hier!“. Er bekommt eine Systemnachricht und eine Benachrichtigung, dass sie bei ihm rastet und bis wann. Er darf sie pflegen und ihr eine Antwort an dich mitgeben – dann fliegt sie sofort los. Er kann sie auch ohne Brief früher weiterfliegen lassen. Läuft die Zeit ungenutzt ab, fliegt sie von selbst weiter. Bei mehreren Empfängern kann dir jeder eine Antwort mitgeben; die Eule kommt dann mit mehreren Briefen nach Hause, und das Bild ihrer Heimkehr sagt dir, wie viele es sind. Eine Leiheule ohne Antwort verschwindet nach dem letzten Empfänger; hat sie Antworten dabei, bringt sie die noch zu dir und fliegt erst dann zurück in die Menagerie.`,
      'Rastet die Eule eines Kontakts bei dir, schreibst du die Antwort ganz normal in eurem Chat: In der Eulenwahl steht die Gast-Eule ganz oben und ist schon ausgewählt. Sie bringt deinen Brief direkt zu ihrem Halter – eine Rast gibt es auf dem Rückweg nicht.',
      'Briefe sind reiner Text. Smileys und Emojis kennt Pergament nicht – sie werden entfernt. Links mit http:// oder https:// sind anklickbar und öffnen sich im Browser; prüfe die angezeigte Adresse, bevor du tippst. Möchtest du lieber nichts versehentlich antippen, schalte in den Einstellungen den Regler „Links in Briefen anklickbar“ aus – dann stehen Links nur als Text da.',
      `Vorsicht vor verkleideten Adressen: Manche Buchstaben aus fremden Alphabeten sehen aus wie unsere (ein kyrillisches „а“ wie ein „a“). Enthält die Adresse eines Links solche Zeichen oder einen Namen mit „@“ vor der eigentlichen Adresse, zeigt PostEulen sie in ihrer technischen Form, etwa „xn--pypal-4ve.com“ statt „pаypal.com“, und schreibt daneben: „${de.letters.linkWarning}“ So siehst du, wohin der Link wirklich führt. Auch echte Adressen mit Umlauten (z. B. müller.de) sehen dann so aus.`,
      [
        '„Eule unterwegs – Ankunft ca. …“: der Brief ist auf dem Weg.',
        '„zugestellt“: die Eule ist angekommen. Ob und wann dein Gegenüber den Brief gelesen hat, verrät PostEulen nicht – genau wie beim echten Briefkasten.',
        '„nicht zugestellt – die Eule ist umgekehrt“: zum Beispiel, weil die Verbindung gekappt wurde.',
        '„Die Eule hat den Brief unterwegs verloren.“: das Gerät deines Gegenübers konnte den Brief nicht öffnen (siehe Verschlüsselung). Schreib ihn am besten noch einmal.',
      ],
      'Kommt eine Eule bei dir an, siehst du beim ersten Anzeigen ihr Ankunftsbild. Sind in einem Chat mehrere neue Briefe angekommen, zeigen sich alle Eulen nacheinander. Jedes Bild schließt sich nach ein paar Sekunden von selbst, per Tippen oder mit der Escape-Taste.',
      'Unter jedem Brief steht, welche Eule ihn gebracht hat – bei deinen eigenen Briefen auch („Unterwegs mit …“, solange er noch fliegt). War es nicht deine eigene Eule, steht in Klammern dabei, dass es eine Leiheule war oder wessen Eule es war.',
      'Kurze Briefe liegen leicht schräg wie auf einem Schreibtisch; sehr lange Briefe stehen gerade, damit nichts aus dem Bild rutscht.',
      'Die Briefe stehen in der Reihenfolge, in der du von ihnen erfahren hast: deine eigenen dort, wo du sie abgeschickt hast, empfangene dort, wo sie bei dir angekommen sind. Ein Brief, der lange unterwegs war, steht also unten bei den neuen.',
      'Im Chat erscheinen Briefe als Pergamentbögen mit ausgefranstem Rand: Briefe an dich auf hellem Pergament, in deutscher Schulschrift und blauschwarzer Tinte, deine eigenen auf dunklerem Pergament, in geschwungener Federschrift und Sepia. Links und Namen stehen immer in Druckschrift, damit du sie sicher lesen kannst. Ist dir Handschrift zu mühsam, stell in den Einstellungen auf Druckschrift um.',
      'Öffnest du einen Chat, beginnt er beim ältesten Brief, den du noch nicht gelesen hast. Ist alles gelesen, springt er zum neuesten Brief. Ältere Briefe findest du darüber.',
      '„Alle Briefe verbrennen“ entfernt nach einer Rückfrage deine Kopien aller Briefe dieses Chats endgültig – sie gehen im Kamin in Flammen auf. Dein Gegenüber behält seine. Ein Brief, der gerade noch zu dir unterwegs ist, verbrennt nicht mit: Er kommt an und steht dann im Chat.',
    ],
  },
  {
    id: 'aufbewahrung',
    title: 'Alte Briefe werden gelöscht',
    blocks: [
      `Wichtig: Alle Briefe und Systemnachrichten werden spätestens ${LETTER.RETENTION_MAX_DAYS} Tage – also ein Jahr – nach ihrer Zustellung automatisch und unwiderruflich gelöscht. Das gilt für alle Konten und auch für die Briefe der Bots. Wiederherstellen kann sie niemand.`,
      'In den Einstellungen unter „Briefe“ kannst du deine eigenen Kopien schon nach 30, 90 oder 180 Tagen löschen lassen – geschriebene und erhaltene. Wählst du eine kürzere Frist, wird alles, was älter ist, sofort gelöscht. Dein Gegenüber behält seine Kopie, bis seine eigene Frist abläuft.',
      'Briefe, die noch unterwegs sind, werden nie gelöscht. Möchtest du etwas aufheben, schreib es dir außerhalb von PostEulen auf.',
      'Wurden Briefe wegen der Löschfrist entfernt, sagt dir eine Systemnachricht mit einem Bild vom Kaminfeuer, wie viele es waren und aus welchen Chats.',
    ],
  },
  {
    id: 'systemnachrichten',
    title: 'Systemnachrichten',
    blocks: [
      'Im Chat „Systemnachrichten“ meldet PostEulen sofort alles Wichtige: neue Kontakte, angekommenes Gold oder Eulen, Krankheiten, Eier, Küken, Namensänderungen deiner Kontakte, Rundnachrichten des Admins, Eulen, die bei dir rasten, und mehr. Antworten kannst du dort nicht.',
      'Manchmal hängt der Admin oben in der App einen kurzen Hinweis für alle auf, etwa zu einer Wartung. Er verschwindet von selbst, wenn seine Zeit abgelaufen ist; mit ✕ blendest du ihn auf diesem Gerät schon vorher aus.',
      'Kommt eine deiner Eulen von einem Flug heim, steht dafür keine Nachricht hier. Stattdessen zeigt dir PostEulen ein Bild: Die Eule sitzt auf dem Fensterbrett – bei Tageslicht oder bei Kerzenschein, je nachdem, ob es an deinem Wohnort in diesem Moment hell oder dunkel ist. Hat sie Antwortbriefe dabei, steht unter dem Bild, wie viele. Das Bild kommt sofort, wenn die App bei der Landung offen ist, sonst beim nächsten Öffnen oder Anmelden. Sind mehrere Eulen heimgekehrt, siehst du die Bilder nacheinander. Hast du Benachrichtigungen eingerichtet, bekommst du außerdem eine.',
      'Nach jedem Update erzählt dir eine Nachricht, was sich geändert hat. Und alle fünf Wochen kommt eine kleine Bitte um eine freiwillige Spende (siehe Häufige Fragen).',
    ],
  },
  {
    id: 'eulen',
    title: 'Deine Eulen',
    blocks: [
      'Unter „Eulen“ siehst du alle deine Eulen, Küken und Leiheulen mit Bild, Name, Art, Geschlecht, Energie, Motivation und Zustand – oben die Leiheulen, darunter deine eigenen. Ist eine Eule nicht da, steht dabei, warum und bis wann, etwa „Fliegt gerade einen Brief zu Peter. Voraussichtlich zurück in 5 Std.“, „Schläft auf dem Heimweg“, „Rastet bei Peter bis 20:00“ oder „In der Menagerie bis Fr., 14:00“. Dauert es weniger als eine Stunde, steht die Zeit in Minuten da, etwa „zurück in 40 Min.“',
      'Das Bild zeigt, was die Eule gerade tut: Ist sie unterwegs, siehst du sie fliegen – im Sonnenschein oder unter Sternen, je nachdem, ob es dort, wo sie gerade ist, hell oder dunkel ist. Macht sie unterwegs eine Schlafpause, siehst du sie schlafen, bei Tag oder bei Nacht. Brütet sie, sitzt sie im Nest auf ihren Eiern. Hilft sie in der Menagerie aus, siehst du ihre leere Stange.',
      'Rastet die Eule eines Kontakts bei dir, steht sie ganz oben unter „Zu Gast bei dir“ – mit dem Hinweis, dass sie nur zur Rast hier ist und bis wann. Du kannst sie tränken, streicheln und füttern (Eulenkeks und Leckerli bezahlst du) – das hebt ihre Motivation, und sie fliegt gestärkt weiter. Über „Antwort … mitgeben“ kommst du direkt in euren Chat. Wenn sie bei dir ankommt, sagt dir eine Systemnachricht (und, wenn eingerichtet, eine Benachrichtigung) Bescheid, wie lange sie bleibt. Möchtest du sie früher ziehen lassen, tippe auf „Weiterfliegen lassen“ – nach einer Rückfrage fliegt sie ohne Brief weiter.',
      'Eulen sind nachtaktiv: Ist es bei dir zu Hause hell, döst eine gesunde Eule manchmal vor sich hin – ob sie gerade schläft, entscheidet sich bei jedem Öffnen der Eulenübersicht neu, etwa jedes zweite Mal. Nachts und in den zehn Minuten nach deiner letzten Pflege ist sie immer wach. Pflegen und losschicken kannst du sie trotzdem jederzeit.',
      'Jede Art hat einen Preis, eine maximale Energie, einen Geschwindigkeitsfaktor und einen Erholungsfaktor. Eulen werden nicht alt und sterben nicht.',
      [
        `Umbenennen: einmal pro Kalenderjahr je Eule (${OWL.NAME_MIN_CHARS}–${OWL.NAME_MAX_CHARS} Zeichen). Die erste Benennung nach Kauf oder Schlupf zählt nicht.`,
        'Verschenken: eine einsatzbereite erwachsene Eule fliegt zu einem Kontakt und gehört ab der Ankunft ihm. Du kannst einen kurzen Begleitbrief mitgeben. Kehrt sie um, gehört sie wieder dir.',
        'In die Freiheit entlassen: die Eule ist endgültig weg. Damit das nie aus Versehen passiert, tippst du dafür ihren Namen genau ein und bestätigst danach ein zweites Mal.',
        `Höchstens ${OWL.MAX_OWN_OWLS} eigene Eulen (Küken zählen mit, Leiheulen nicht). Geschenke und Küken dürfen darüber hinausgehen, dann kannst du nur nichts mehr kaufen.`,
      ],
      'Eine Eule kann nur losfliegen, wenn sie zu Hause, gesund und erwachsen ist und weder brütet noch in der Menagerie ist.',
    ],
  },
  {
    id: 'energie',
    title: 'Energie und Pflege: Wasser, Streicheln, Eulenkeks, Lieblingsleckerli',
    blocks: [
      `Zu Hause erholt sich eine Eule: pro Stunde ${percent(OWL.REGEN_SHARE_PER_HOUR)} ihrer maximalen Energie mal Erholungsfaktor. Mit Faktor 2 ist sie also in 5 Stunden wieder voll. Unterwegs erholt sie sich beim Schlafen genauso (siehe So fliegt eine Eule).`,
      'Es gibt vier Arten, dich um deine Eule zu kümmern – solange sie zu Hause ist, auch wenn sie krank ist oder brütet:',
      [
        'Wasser geben: kostenlos, einmal am Tag.',
        'Streicheln: kostenlos und so oft du magst.',
        `Eulenkeks: ${gold(GOLD.FEED_PRICE)}, einmal am Tag, gibt sofort ${percent(OWL.FEED_SHARE)} Energie mal Erholungsfaktor.`,
        `Lieblingsleckerli: ${gold(GOLD.SNACK_PRICE)}, einmal am Tag, gibt sofort ${percent(OWL.SNACK_SHARE)} Energie mal Erholungsfaktor. Jede Art hat ihr eigenes – der Waldkauz liebt Haselnüsse, der Riesenfischuhu Räucherfisch; was genau, steht in der Menagerie bei der Beschreibung.`,
      ],
      `Jede dieser vier Arten der Pflege hebt einmal am Tag die Motivation (siehe Motivation). Pflegebonus gegen Krankheit: Ein Tag zählt als gepflegt, wenn die Eule an diesem Tag ${OWL.CARE_DAY_INTERACTIONS} verschiedene Arten von Pflege bekommen hat – zum Beispiel Wasser und Streicheln. Gezählt werden die letzten ${OWL.CARE_BONUS_WINDOW_DAYS} Tage, an denen sie mindestens ${OWL.CARE_BONUS_MIN_HOME_HOURS} Stunde zu Hause war. War sie an mindestens ${OWL.CARE_BONUS_MIN_DAYS} davon gepflegt, wird sie viel seltener krank. Ganze Reisetage zählen also nicht – eine fleißige Brief-Eule verliert ihren Bonus nicht, nur weil sie unterwegs war.`,
    ],
  },
  {
    id: 'motivation',
    title: 'Motivation',
    blocks: [
      'Jede deiner Eulen hat neben der Energie einen zweiten Balken: die Motivation. Sie liegt immer zwischen 80 % und 120 %. Gekaufte Eulen kommen mit 100 % zu dir, Leiheulen mit 80 % bis 100 %.',
      'Jede Nacht um Mitternacht (UTC) sinkt sie um 10 Prozentpunkte – auch wenn die Eule gerade unterwegs ist oder in der Menagerie aushilft. Wasser, Streicheln, Eulenkeks und Lieblingsleckerli heben sie jeweils einmal am Tag um 10 Prozentpunkte. Wer sich jeden Tag ein bisschen kümmert, hat also bald eine hoch motivierte Eule.',
      'Die Motivation zählt immer für die nächste Strecke: beim Abflug von zu Hause bis zum ersten Empfänger, beim Weiterflug von jedem Empfänger bis zum nächsten Ziel. Mit 120 % hat die Eule auf dieser Strecke 20 % mehr Energie, ist 20 % schneller und erholt sich im Schlaf 20 % schneller; mit 80 % entsprechend 20 % weniger. Zu Hause und während einer Rast beim Empfänger gelten die normalen Werte der Art. Wer eine rastende Eule pflegt, schickt sie also flinker weiter.',
      'In der Eulenübersicht stehen unter den Balken die Geschwindigkeit in km/h und die Erholung in Prozent pro Stunde für die Art. Ist die Motivation nicht 100 %, steht dahinter grün „+10 %“ oder rot „−20 %“ – so viel ändert sich auf der nächsten Strecke.',
    ],
  },
  {
    id: 'flug',
    title: 'So fliegt eine Eule',
    blocks: [
      `Grundgeschwindigkeit ${FLIGHT.BASE_SPEED_KMH} km/h mal Geschwindigkeitsfaktor der Art – bei Tag und Nacht gleich schnell.`,
      `Energie: nachts ${FLIGHT.ENERGY_PER_KM_NIGHT} Punkt pro Kilometer, tagsüber ${String(FLIGHT.ENERGY_PER_KM_DAY).replace('.', ',')} Punkte. Die Dämmerung zählt als Tag. Eulen sind eben Nachtvögel.`,
      `Ist die Energie leer, schläft die Eule an Ort und Stelle. Dabei erholt sie sich wie zu Hause: pro Stunde ${percent(OWL.REGEN_SHARE_PER_HOUR)} ihrer maximalen Energie mal Erholungsfaktor. Sie schläft aber nur so lange, bis die Energie für den Weg zum nächsten Ziel reicht – dem nächsten Empfänger oder ihrem Zuhause –, höchstens bis sie voll ist. Über Wasser schläft sie nicht: Sie gleitet ohne Energie weiter bis zur nächsten Küste und ruht dort. Du kannst auch fast leere Eulen losschicken; dann beginnt der Flug eben mit einem Schläfchen.`,
      'Hast du beim Schreiben eine Rast gewählt, bleibt die Eule nach der Zustellung so lange beim Empfänger und erholt sich dort wie zu Hause (siehe Briefe). Nach der letzten Zustellung fliegt die Eule nach denselben Regeln heim. Leiheulen fliegen nicht zurück – außer sie haben eine Antwort für dich dabei; geschenkte Eulen und Küken bleiben beim Empfänger.',
      'Zieht ein Empfänger oder du selbst um, passt die Eule ihren Kurs sofort an. Wird die Verbindung gekappt oder löscht der Empfänger sein Konto, kehrt sie um; bei mehreren Empfängern lässt sie den Betroffenen aus.',
    ],
  },
  {
    id: 'karte',
    title: 'Die Karte',
    blocks: [
      'Die Karte zeigt die ganze Welt. Westeuropa, wo alle wohnen, ist genau gezeichnet, mit Städten; außerhalb davon siehst du Ländergrenzen und Hauptstädte. Eingezeichnet sind dein Wohnort, die Wohnorte deiner Kontakte und Bots und deine Eulen, die gerade für dich unterwegs sind. Eulen anderer Leute siehst du nie – auch nicht, wenn sie zu dir fliegen. Den Erklärbären findest du auf der Karte, sobald du ihm zum ersten Mal geschrieben hast; andere Bots, sobald ihr erster Brief bei dir ist – sie können überall auf der Welt wohnen.',
      'Hinter jeder deiner Eulen zieht sich eine dünne dunkelbraune Linie: der Weg, den sie schon geflogen ist. Wo sie übernachtet hat, steht ein kleines „Zzz“. Den Weg, der noch vor ihr liegt, zeigt die Karte nicht – Eulen lassen sich nicht gern in die Karten schauen.',
      'Beim Öffnen zoomt die Karte so weit hinein, dass gerade noch dein Wohnort, deine Kontakte und deine Eulen zu sehen sind (die Bots zählen dafür nicht). Zur Orientierung zeigt sie Städte: weit herausgezoomt die mit über einer Million Einwohnern, näher herangezoomt alle mit über 200 000. Ist kein Platz für einen Städtenamen oder läge er auf deinen Orten oder Eulen, bleibt er ausgeblendet, bis du näher heranzoomst. England, Schottland, Wales und Nordirland sind als eigene Länder eingezeichnet.',
      `Die dunkle Fläche ist die Nacht. Positionen, Flugspuren und Nachtgrenze rechnet dein Gerät alle ${MAP.CLIENT_REFRESH_MINUTES} Minuten neu aus, ohne den Server zu fragen.`,
      'Die Karte ist immer quadratisch und so groß, dass sie ganz ins Fenster passt. Du kannst mit zwei Fingern oder dem Mausrad zoomen, verschieben und mit der Tastatur steuern (Pfeiltasten, Plus und Minus). Ganz herausgezoomt passt die ganze Welt ins Quadrat. Der Knopf unter Plus und Minus („Ansicht zurücksetzen“) springt zurück zur Ansicht beim Öffnen der Karte.',
      'Wohnen kannst du nur in Westeuropa: Bei der Anmeldung und beim Umzug bleibt die Karte deshalb im bisherigen Westeuropa-Ausschnitt.',
    ],
  },
  {
    id: 'gold',
    title: 'Gold und Finanzen',
    blocks: [
      `Du startest mit ${gold(GOLD.START)}. Jeden Tag um ${dailyGoldTime} bekommt jedes aktive Konto Gold: in den ersten ${GOLD.DAILY_HIGH_DAYS} Tagen nach der Kontoerstellung ${gold(GOLD.DAILY)} am Tag, danach ${gold(GOLD.DAILY_LATER)}. Manchmal schickt dir auch ein Bot Gold oder sogar eine Eule.`,
      `Kosten: Eulen je nach Art, Leiheule ${gold(GOLD.LOAN_PRICE)}, Eulenkeks ${gold(GOLD.FEED_PRICE)}, Lieblingsleckerli ${gold(GOLD.SNACK_PRICE)}, großes Pergament ${gold(GOLD.LARGE_PARCHMENT_SURCHARGE)}, Krankenpflege ${gold(GOLD.SELF_CARE_PRICE)} oder Eulenarzt ${gold(GOLD.VET_PRICE)}. Alles muss voll gedeckt sein; Schulden gibt es nicht.`,
      `Die Finanzübersicht zeigt deinen Goldstand und die letzten ${GOLD.TRANSACTIONS_KEPT} Buchungen.`,
      `Gold verschicken: ${gold(GOLD.TRANSFER_MIN)} bis ${gold(GOLD.TRANSFER_MAX)} per Eule an einen Kontakt, gern mit kurzem Begleitbrief. Danach müssen dir mehr als ${gold(GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE)} bleiben. Das Gold wird beim Abflug abgebucht und kommt mit der Eule an. Kehrt sie um, bekommst du es zurück, sobald sie wieder zu Hause ist. Bots kannst du kein Gold schicken.`,
    ],
  },
  {
    id: 'menagerie',
    title: 'Menagerie: Eulen kaufen und leihen',
    blocks: [
      'Oben stehen die Leiheulen des Tages, darunter alle Eulen zum Kaufen – nach Preis sortiert, die günstigste zuerst. Zu jeder Kaufeule erzählt eine kleine Beschreibung, woher sie stammt und was für ein Charakter sie ist.',
      `Kaufen: Alle ${SPECIES.length} Arten sind immer zu haben. Nach dem Kauf gibst du deiner Eule einen Namen – ihr zufällig gewürfeltes Geschlecht steht dabei schon da. Ihre Energie liegt zu Beginn zwischen ${percent(OWL.START_ENERGY_MIN_SHARE)} und ${percent(OWL.START_ENERGY_MAX_SHARE)}.`,
      `Leihen: Jeden Tag um Mitternacht (UTC) gibt es ${MENAGERIE.OFFER_SPECIES_COUNT} Arten zum Leihen, für ${gold(GOLD.LOAN_PRICE)} je Eule – jede mit einem anderen Namen. Arten und Namen wiederholen sich an den beiden Folgetagen nicht – dieselbe Leiheule triffst du also nicht zwei Tage hintereinander. Jede angebotene Eule kannst du einmal pro Tag leihen, also bis zu ${MENAGERIE.LOANS_PER_DAY} am Tag – auch wenn von gestern noch Leiheulen bei dir warten. Sobald um Mitternacht neue Eulen angeboten werden, kannst du sie alle leihen. Du kannst hier leihen oder direkt beim Briefschreiben, wenn keine eigene Eule da ist. Den Phönix gibt es nie zum Leihen.`,
      `Eine Leiheule trägt einen Brief an bis zu ${LETTER.MAX_RECIPIENTS} Empfänger nacheinander oder Gold an einen Empfänger und ist nach dem letzten weg – zurück kommt sie nur, wenn ihr jemand eine Antwort mitgibt. Schickst du sie nicht binnen ${MENAGERIE.LOAN_EXPIRY_HOURS} Stunden los, verschwindet sie wieder, und das Gold ist verbraucht. Hast du beim Schreiben eine Rast gewählt und gibt ihr ein Empfänger eine Antwort mit, bringt sie diese noch zu dir. Sie lässt sich pflegen wie jede Eule, aber nicht umbenennen oder verschenken. Ihre Motivation liegt zwischen 80 % und 100 %.`,
      `Tipp für den Anfang: Mit ${gold(GOLD.START)} Startgold leihst du eine Eule für deinen ersten Brief. Für die günstigste eigene Eule (${CHEAPEST.name}, ${CHEAPEST.price} Gold) reicht es schon nach ein, zwei Tagen.`,
    ],
  },
  {
    id: 'arten',
    title: 'Eulenarten im Überblick',
    blocks: [
      'Preis in Gold, maximale Energie, Geschwindigkeit und Erholung pro Stunde (bei Motivation 100 %):',
      SPECIES.map(
        (species) =>
          `${species.name}: ${species.price} Gold, ${species.maxEnergy} Energie, ${decimalDe(FLIGHT.BASE_SPEED_KMH * species.speedFactor)} km/h, Erholung ${decimalDe(OWL.REGEN_SHARE_PER_HOUR * 100 * species.recoveryFactor)} % pro Stunde`,
      ),
      `Der Phönix ist keine gewöhnliche Eule: Er kostet ${SPECIES.find((species) => species.id === 'phoenix')?.price ?? 100} Gold, fliegt viermal so schnell wie eine Eule mit Faktor 1, wird nie verliehen, hilft nicht in der Menagerie aus und legt keine Eier.`,
      'Der Virginiauhu (1 300 Energie, 85 km/h, 20 % Erholung pro Stunde) ist in der Menagerie nicht zu kaufen: Er kommt nur als Eule einer Brieffigur, als Geschenk eines Bots oder per Gutschein. Wie der Phönix wird er nie verliehen, hilft nicht in der Menagerie aus und legt keine Eier.',
    ],
  },
  {
    id: 'verleih',
    title: 'Eulen an die Menagerie verleihen',
    blocks: [
      `Gesunde erwachsene Eulen, die zu Hause sind, kannst du für ${OWL.MENAGERIE_DAYS} Tage an die Menagerie verleihen (den Phönix nicht). Danach bekommst du ${percent(GOLD.MENAGERIE_WAGE_SHARE)} des Artpreises als Lohn, und die Eule kommt mit voller Energie zurück. Währenddessen ist sie nicht verfügbar und wird nicht krank.`,
    ],
  },
  {
    id: 'krankheit',
    title: 'Krankheiten',
    blocks: [
      `Jede Nacht kann eine erwachsene Eule mit einer Wahrscheinlichkeit von 1 zu 30 krank werden – mit Pflegebonus (siehe Energie und Pflege) deutlich seltener. In den ersten ${OWL.SICKNESS_GRACE_DAYS} Tagen bei dir wird sie nie krank. Leiheulen, Küken und Bot-Eulen werden nie krank, Eulen inaktiver Konten auch nicht.`,
      'Eine kranke Eule schaut grummelig und kann nicht fliegen, bis sie geheilt ist. Pflegen geht weiter.',
      [
        `Selbst gesund pflegen: ${gold(GOLD.SELF_CARE_PRICE)} für spezielles Futter, nach ${OWL.SELF_CARE_DAYS} Tagen ist sie gesund.`,
        `Eulenarzt: ${gold(GOLD.VET_PRICE)}, nach ${OWL.VET_HOURS} Stunden ist sie gesund.`,
      ],
      'Wird eine Eule unterwegs krank, merkst du es, wenn sie heimkommt.',
    ],
  },
  {
    id: 'kueken',
    title: 'Eier und Küken',
    blocks: [
      `Weibliche Eulen legen nach einer Heimkehr manchmal Eier (etwa jedes hundertste Mal; der Phönix nie). Sie brüten dann ${OWL.BROODING_DAYS} Tage; danach schlüpfen ${OWL.CHICKS_MIN} bis ${OWL.CHICKS_MAX} Küken.`,
      `Du benennst die Küken binnen ${OWL.CHICK_NAME_DEADLINE_HOURS} Stunden, sonst bekommen sie Zufallsnamen. Bei ${OWL.CHICK_GIFT_FROM_COUNT} oder mehr Küken musst du binnen ${OWL.CHICK_GIFT_DEADLINE_HOURS} Stunden genau eines an einen Kontakt verschenken, gern mit Begleitbrief. Sonst entscheidet das Los unter deinen aktiven Kontakten. Hast du keine, darfst du alle behalten.`,
      `Küken fliegen gemütlich mit ${FLIGHT.CHICK_SPEED_KMH} km/h, eine Stunde Flug, eine Stunde Pause. Sie lassen sich pflegen wie jede Eule, tragen aber keine Briefe. Erwachsen werden sie bei dir nach ${OWL.CHICK_ADULT_AT_MOTHER_DAYS} Tagen, beim Beschenkten ${OWL.CHICK_ADULT_AT_RECIPIENT_DAYS} Tage nach der Ankunft.`,
    ],
  },
  {
    id: 'bots',
    title: 'Bots: der Erklärbär und andere Brieffiguren',
    blocks: [
      'Bots sind Brieffiguren, die per KI schreiben. Du findest sie im Briefwechsel, deutlich mit „Bot“ gekennzeichnet, und als Raute auf der Karte – im Adressbuch stehen sie nie. Schreiben kannst du ihnen in ihrem Chat.',
      [
        `Erklärbär: dein eigener Bot von Anfang an. Er wohnt in Berlin, schickt dir in der ersten Woche kurze Anleitungen und beantwortet Fragen zu PostEulen – aber nur die. Seine Eulen fliegen ${BOTS.EXPLAINER_SPEED_KMH} km/h. Etwa ${BOTS.REPLY_AFTER_HOURS} Stunden nach der Ankunft deines Briefs schreibt er zurück, höchstens ${BOTS.EXPLAINER_REPLY_MAX_CHARS} Zeichen. Auf der Karte erscheint er, sobald du ihm zum ersten Mal schreibst.`,
        'Andere Bots: Figuren, die die Betreiberin oder der Betreiber deiner PostEulen-Instanz im Bots-Kontrollzentrum anlegt. Sie können überall auf der Welt wohnen und auch umziehen. Ein solcher Bot taucht bei dir erst auf, wenn sein erster Brief bei dir angekommen ist. Seine Briefe schreibt er zu festen Zeitpunkten an alle Spielerinnen und Spieler; manchmal hängen bis zu zwei Bilder daran, manchmal bringt er Gold oder eine Eule mit.',
      ],
      'Jedem Bot kannst du einen Brief pro Kalendertag schreiben (der Tag wechselt um Mitternacht UTC); die App zeigt, ab wann wieder. Das gilt auch für den Erklärbär.',
      `Wie andere Bots antworten: Meist gehen sie in ihrem nächsten geplanten Brief auf deine Zeilen ein – der Brief bleibt derselbe, bekommt aber einen persönlichen Teil für dich. Haben sie in den nächsten vier Wochen nichts geplant, antworten sie dir nach etwa ${BOTS.REPLY_AFTER_HOURS} Stunden direkt.`,
      'Bots haben eigene Eulen oder schicken Leiheulen. Die Eule eines Bots wartet oft eine Weile bei dir („Zu Gast bei dir“ unter „Eulen“). Solange sie da ist, kannst du ihr eine Antwort mitgeben – dann fliegt sie sofort los. Ob du einem Bot auch mit deinen eigenen Eulen oder Leiheulen schreiben kannst, legt der Bot fest; der Chat sagt es dir. Du kannst eine Bot-Eule tränken, streicheln und füttern wie jede Gast-Eule – bei ihr kostet das nichts, auch Eulenkeks und Leckerli nicht. Das gibt ihr Energie für den Heimweg und macht sie munterer, höchstens bis 120 % Motivation; ihre Motivation siehst du bei Bot-Eulen nicht.',
      de.bots.notice,
      'An OpenAI gehen nur die Texte, keine Namen und keine Kennungen. Jeder Bot merkt sich eine kurze Zusammenfassung eures Briefwechsels – nur deines; sie verschwindet, wenn du den Chat löschst.',
      'Einen Bot entfernst du in seinem Chat („… entfernen“). Alle auf einmal – auch den Erklärbär und alle Bots, die es künftig geben wird – entfernst du in den Einstellungen mit „Alle Bots entfernen“. Beides ist endgültig: Chat, Zusammenfassung und noch ausstehende Briefe und Geschenke sind dann weg, und die Bots schreiben dir nie wieder. Löscht die Betreiberin oder der Betreiber einen Bot, bekommst du eine Systemnachricht, falls du mit ihm Kontakt hattest.',
    ],
  },
  {
    id: 'benachrichtigungen',
    title: 'Benachrichtigungen',
    blocks: [
      'Benachrichtigungen sind die kleinen Hinweise, die oben auf dem Handy-Bildschirm auftauchen. PostEulen kann dir so Bescheid sagen, wenn eine Eule mit einem Brief landet, eine deiner Eulen heimkommt, Gold ankommt, ein Geschenk eintrifft, Eier gelegt werden, Küken schlüpfen, die Eule eines Kontakts bei dir rastet, die automatische Löschung droht oder der Admin allen schreibt. Benachrichtigungen enthalten nie Namen oder Inhalte – wer dir über die Schulter schaut, erfährt nichts.',
      'Am besten klappt das, wenn du PostEulen auf den Startbildschirm gelegt hast (siehe „PostEulen aufs Handy holen“): auf Android mit Chrome und auf dem iPhone mit Safari. Im normalen Browser oder als Lesezeichen kommen keine Benachrichtigungen – deine Post erreicht dich trotzdem, du siehst sie beim nächsten Hineinschauen. Ein echter Briefkasten klingelt ja auch nicht.',
      `Einrichten kannst du sie in den Einstellungen unter „Benachrichtigungen“. Tippe auf „Benachrichtigungen einrichten“ und erlaube sie, wenn dein Handy fragt. PostEulen schickt dann sofort eine Probe-Nachricht. Kommt sie an, steht dort „aktiv und bestätigt“. Mit „Test-Benachrichtigung senden“ kannst du das wiederholen – zusammen mit dem Einrichten bis zu ${SECURITY.PUSH_CHANGES_PER_HOUR}-mal pro Stunde.`,
      'PostEulen fragt übrigens nie im Hintergrund nach neuen Briefen – das schont den Akku. Die Nachricht kommt vom Server, sobald etwas passiert.',
      de.push.iosHint,
      `Für Fortgeschrittene – ${de.push.degoogledTitle}:`,
      de.push.degoogled1,
      de.push.degoogled2,
      de.push.degoogled3,
      de.push.degoogled4,
    ],
  },
  {
    id: 'einstellungen',
    title: 'Einstellungen und Konto',
    blocks: [
      [
        `Nutzername ändern: einmal pro Kalenderjahr. Dein aktueller Name steht gleich dabei. Deine Kontakte erfahren es per Systemnachricht; der alte Name ist ${ACCOUNT.NAME_LOCK_DAYS} Tage gesperrt.`,
        `Wohnort ändern: bis zu ${ACCOUNT.HOME_CHANGES_PER_MONTH}-mal pro Kalendermonat, egal wie kurz hintereinander. Eulen unterwegs passen ihren Kurs an.`,
        'Passwort ändern: altes Passwort einmal, neues zweimal. Alle Briefe bleiben lesbar.',
        'Sprache: Deutsch oder Englisch, für dieses Konto auf jedem Gerät.',
        'Briefe: eigene Briefe und Systemnachrichten schon nach 30, 90 oder 180 Tagen löschen lassen statt nach einem Jahr; Briefe in Druckschrift statt Handschrift anzeigen; mit dem Regler „Links in Briefen anklickbar“ bestimmst du, ob Links in Briefen angetippt werden können (Standard: an).',
        'Benachrichtigungen: Status ansehen und testen.',
        'Bots: „Alle Bots entfernen“ nimmt den Erklärbär und alle anderen Bots endgültig aus deinem Spiel – mit ihren Chats, auch Bots, die es erst später gibt. Das lässt sich nicht rückgängig machen.',
        `Nachricht an den Admin (ganz unten): Bei technischen Problemen oder Verbesserungsvorschlägen schickst du dem Admin deiner PostEulen-Instanz eine kurze Nachricht – höchstens ${FEEDBACK.MAX_CHARS} Zeichen, eine pro Tag (der Tag wechselt um Mitternacht UTC). Sie ist nicht verschlüsselt, liegt ohne deinen Namen lesbar auf dem Server und wird nach ${FEEDBACK.RETENTION_DAYS} Tagen gelöscht. Schreib also nichts Vertrauliches hinein.`,
        `Gutschein einlösen: Hast du von der Betreiberin oder dem Betreiber deiner PostEulen-Instanz einen Gutschein bekommen, tippst du hier den Code ein. Ein Gutschein bringt Gold oder eine neue Eule, gilt ${VOUCHER.VALID_DAYS} Tage und lässt sich einmal einlösen.`,
        `Konto löschen: mit Passwort bestätigen. Meldest du dich binnen ${ACCOUNT.SELF_DELETE_GRACE_HOURS} Stunden wieder an, wird die Löschung abgebrochen. Danach wird alles endgültig gelöscht; was andere schon von dir bekommen haben, bleibt bei ihnen.`,
        'Abmelden: entfernt alle Schlüssel von diesem Gerät, und PostEulen vergisst alles über dein Konto, was es sich in diesem Fenster gemerkt hat.',
      ],
    ],
  },
  {
    id: 'inaktiv',
    title: 'Inaktivität und automatische Löschung',
    blocks: [
      `Warst du über ${ACCOUNT.INACTIVE_AFTER_DAYS} Tage nicht in der App, gilt dein Konto als inaktiv: Kontakte sehen „inaktiv“ und können dir nichts schicken, du bekommst kein tägliches Gold, und deine Eulen werden nicht krank. Briefe der Bots und Lieferungen, die schon unterwegs sind, kommen trotzdem an. Sobald du die App öffnest, bist du wieder aktiv.`,
      `Nach längerer Inaktivität wird das Konto automatisch gelöscht. Die Frist legt der Betreiber fest (mindestens ${ACCOUNT.AUTO_DELETE_MIN_DAYS}, üblich ${ACCOUNT.AUTO_DELETE_DEFAULT_DAYS} Tage). ${ACCOUNT.AUTO_DELETE_WARNING_DAYS} Tage vorher bekommst du eine Warnung.`,
    ],
  },
  {
    id: 'offline',
    title: 'Ohne Netz',
    blocks: [
      'Ohne Verbindung zeigt PostEulen „Keine Verbindung – Eulen brauchen Netz“ und sperrt alle Aktionen. Sobald das Netz zurück ist, geht es weiter. Briefe liegen nie unverschlüsselt auf deinem Gerät.',
    ],
  },
  {
    id: 'krise',
    title: 'Wenn es dir nicht gut geht',
    blocks: [de.bots.crisis],
  },
];

export const HELP_FAQ: readonly HelpQuestion[] = [
  {
    question: 'Ich finde PostEulen nicht im App-Store. Habe ich etwas falsch gemacht?',
    answer:
      'Nein, alles richtig! PostEulen gibt es absichtlich nicht im App-Store. Du legst es direkt aus dem Browser auf deinen Startbildschirm und hast dann trotzdem eine richtige App mit Eulen-Symbol – wie das geht, steht unter „PostEulen aufs Handy holen“.',
  },
  {
    question: 'Ist PostEulen etwas für Kinder?',
    answer:
      'Gut möglich – PostEulen eignet sich prima, um Kinder behutsam an Messenger heranzuführen. Weil Briefe Stunden unterwegs sind, gibt es kein Dauer-Tippen und keinen Sog, ständig nachzusehen. Und schreiben kann nur, wer sich gegenseitig mit dem genauen Namen im Adressbuch eingetragen hat: Fremde können dein Kind nicht anschreiben. Die Brieffreunde – Erklärbär und andere Bots – antworten per KI; wer das nicht möchte, entfernt sie in den Einstellungen mit „Alle Bots entfernen“.',
  },
  {
    question: 'Was kostet PostEulen?',
    answer: `Nichts. PostEulen ist kostenlos, ohne Werbung und ohne Bezahlschranke – und das bleibt so. Server und Entwicklung kosten trotzdem Geld. Deshalb bitten wir alle fünf Wochen freundlich um eine freiwillige Spende über ${DONATION.URL.replace('https://', '')}; den Link findest du auch unten auf der Startseite unter „Spenden“. Niemand muss etwas geben.`,
  },
  {
    question: 'Ich habe mein Passwort vergessen. Was nun?',
    answer:
      'Leider lässt es sich nicht zurücksetzen, weil es nirgends gespeichert ist – das ist der Preis für echte Verschlüsselung. Erstelle ein neues Konto und koppelt euch neu.',
  },
  {
    question: 'Warum kommt mein Brief nicht sofort an?',
    answer:
      'Eulen brauchen Zeit. Die Flugzeit hängt von Entfernung, Art und Energie ab: Nachts sparen Eulen Energie, und ist eine Eule leer, legt sie unterwegs eine Schlafpause ein. Die Ankunftszeit siehst du am Brief.',
  },
  {
    question: 'Ich finde meine Freundin oder meinen Freund nicht.',
    answer:
      'Ihr müsst euch beide mit dem genauen Namen eintragen. PostEulen sagt aus Datenschutzgründen nie, ob ein Name existiert. Prüft die Schreibweise und tragt euch innerhalb von 24 Stunden gegenseitig ein.',
  },
  {
    question: 'Kann ich PostEulen auf mehreren Geräten nutzen?',
    answer:
      'Nur nacheinander: Wer sich auf einem neuen Gerät anmeldet, wird auf dem alten abgemeldet. Alle Briefe und Schlüssel sind danach auch auf dem neuen Gerät da.',
  },
  {
    question: 'Warum sind meine Smileys verschwunden?',
    answer: 'Pergament kennt keine Smileys. Emojis und unsichtbare Sonderzeichen werden entfernt.',
  },
  {
    question: 'Ich bekomme keine Benachrichtigungen.',
    answer:
      'Öffne die Einstellungen und sende eine Test-Benachrichtigung. Benachrichtigungen gibt es nur, wenn PostEulen als App auf dem Startbildschirm liegt – auf Android mit Chrome, auf dem iPhone mit Safari. Für Handys ohne Google-Dienste steht unter „Benachrichtigungen“ ein eigener Weg. Briefe kommen auch ohne Benachrichtigung an – du siehst sie beim Öffnen.',
  },
  {
    question: 'Mir ist das Gold ausgegangen.',
    answer: `Jeden Tag gibt es Gold, solange du aktiv bist: in den ersten ${GOLD.DAILY_HIGH_DAYS} Tagen ${gold(GOLD.DAILY)}, danach ${gold(GOLD.DAILY_LATER)}. Kleine Briefe sind kostenlos; nur Eulen, Leihen, Eulenkeks, Lieblingsleckerli, großes Pergament und Behandlungen kosten Gold.`,
  },
  {
    question: 'Warum ist meine Eule diesmal langsamer (oder schneller) als sonst?',
    answer:
      'Das macht die Motivation: Sie sinkt jede Nacht ein wenig und steigt, wenn du deiner Eule Wasser gibst, sie streichelst, ihr einen Eulenkeks oder ihr Lieblingsleckerli gibst – jede Art einmal am Tag. Sie gilt für die nächste Strecke: beim Abflug von zu Hause und jedes Mal neu, wenn die Eule bei einem Empfänger weiterfliegt. Mit 120 % fliegt die Eule 20 % schneller und weiter, mit 80 % entsprechend langsamer.',
  },
  {
    question: 'Kann der Betreiber meine Briefe lesen?',
    answer:
      'Briefe zwischen Menschen nicht – sie sind Ende-zu-Ende-verschlüsselt. Briefe an Bots und Systemnachrichten schon. Der Server sieht außerdem, wer wem wann schreibt.',
  },
  {
    question: 'Wo sind meine alten Briefe hin?',
    answer: `Briefe und Systemnachrichten werden spätestens ein Jahr nach der Zustellung automatisch gelöscht – oder früher, wenn du das in den Einstellungen so eingestellt hast. Wiederherstellen lassen sie sich nicht.`,
  },
  {
    question: 'Ist PostEulen nur ein Spiel, oder kann ich damit wirklich vertraulich schreiben?',
    answer:
      'Beides. Die Eulen sind Spiel, die Verschlüsselung ist ernst gemeint und auf dem Stand der Technik. Briefe zwischen Menschen kann außer euch niemand lesen, auch der Betreiber nicht. Vergleicht die Sicherheitsnummer, dann seid ihr auf der sicheren Seite.',
  },
  {
    question: 'Kann ich einen Brief zurückholen oder bearbeiten?',
    answer:
      'Nein, abgeschickt ist abgeschickt. Du kannst aber mit „Alle Briefe verbrennen“ deine Kopien eines Chats löschen – dein Gegenüber behält dann seine.',
  },
  {
    question: 'Etwas funktioniert nicht, oder ich habe eine Idee. Wem sage ich das?',
    answer: `Dem Admin deiner PostEulen-Instanz: Ganz unten in den Einstellungen steht „Nachricht an den Admin“. Dort schreibst du bis zu ${FEEDBACK.MAX_CHARS} Zeichen, eine Nachricht pro Tag. Sie ist nicht verschlüsselt und kommt ohne deinen Namen an – möchtest du eine Antwort, sag in der Nachricht, wie man dich erreicht (oder lieber nicht). Für Fragen zur Bedienung hilft dir auch der Erklärbär.`,
  },
];

export interface Help {
  readonly intro: string;
  readonly sections: readonly HelpSection[];
  readonly faq: readonly HelpQuestion[];
  /** Words for the plain-text form: heading of the FAQ, "question", "answer". */
  readonly words: { readonly faq: string; readonly question: string; readonly answer: string };
}

const HELP_DE: Help = {
  intro: HELP_INTRO,
  sections: HELP_SECTIONS,
  faq: HELP_FAQ,
  words: { faq: 'Häufige Fragen', question: 'Frage', answer: 'Antwort' },
};

/** The help in a language (v0.4). */
export function helpOf(language: 'de' | 'en'): Help {
  return language === 'en' ? HELP_EN : HELP_DE;
}

function blockText(block: HelpBlock): string {
  return typeof block === 'string' ? block : block.map((item) => `- ${item}`).join('\n');
}

/** The help text as plain text, e.g. as the Erklärbär's knowledge base. */
export function helpAsText(language: 'de' | 'en' = 'de'): string {
  const help = helpOf(language);
  const sections = help.sections.map(
    (section) => `${section.title}\n${section.blocks.map(blockText).join('\n')}`,
  );
  const faq = help.faq.map(
    (item) => `${help.words.question}: ${item.question}\n${help.words.answer}: ${item.answer}`,
  );
  return [help.intro, ...sections, `${help.words.faq}\n${faq.join('\n')}`].join('\n\n');
}
