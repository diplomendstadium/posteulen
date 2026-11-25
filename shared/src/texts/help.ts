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
  CHAT,
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
  BOREDOM,
  VACATION,
  VOUCHER,
} from '../constants.ts';
import { formatGold } from '../game/gold.ts';
import { CHEAPEST_SPECIES as CHEAPEST, SPECIES } from '../species.ts';
import { de } from './de.ts';
import { HELP_EN } from './help-en.ts';
import { teamList } from './help-team.ts';

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
      'Sparsam mit Daten: Du brauchst weder deinen echten Namen noch eine E-Mail-Adresse oder Telefonnummer. Du kannst unter einem Pseudonym spielen und einen ausgedachten Wohnort wählen. Auch über ein VPN oder das Tor-Netz kannst du PostEulen nutzen – im Tor-Netz sogar über eine eigene Onion-Adresse (siehe „PostEulen im Tor-Netz“).',
      'Auch der Admin schaut nicht hinein: Das Adminpanel, mit dem der Spieleserver verwaltet wird, hat keine Ansichten für Spielernamen, Kontakte oder Briefinhalte. Im Klartext zeigt es nur die Nachrichten, die du freiwillig über „Nachricht an den Admin“ in den Einstellungen schickst. Ein paar Zahlen seiner Statistik stehen für alle ganz unten auf der Startseite unter „Über diese Instanz“: Konten insgesamt und vorhanden, aktive Konten der letzten 30 Tage, Briefe zwischen Menschen und die Zahl der Eulen in Spielerbesitz – nur Zählerstände, keine Namen.',
    ],
  },
  {
    id: 'tor',
    title: 'PostEulen im Tor-Netz',
    blocks: [
      'PostEulen ist nicht nur unter seiner normalen Adresse erreichbar, sondern auch als Onion-Dienst im Tor-Netz. Den Link „Tor-Netz“ findest du auf der Startseite in der Linkleiste unter der Anmeldung; er öffnet sich im Tor Browser. Öffnest du die normale Adresse im Tor Browser, zeigt er dir in der Adresszeile von selbst „.onion verfügbar“ an.',
      [
        'Über Tor erfährt der Server nicht, von wo du kommst – nicht einmal deine IP-Adresse. Die Verbindung verschlüsselt das Tor-Netz selbst von deinem Gerät bis zum Server; deshalb beginnt die Onion-Adresse mit „http://“ und nicht mit „https://“. Das ist bei Onion-Diensten so richtig.',
        'Es ist dieselbe App: dasselbe Konto, dieselben Briefe, Eulen und dasselbe Gold. Du kannst nach Belieben zwischen der normalen Adresse und dem Tor-Netz wechseln.',
        'Angemeldet bist du aber immer nur an einer Stelle zugleich. Meldest du dich über Tor an, endet die Sitzung unter der normalen Adresse – und umgekehrt. Jede Adresse merkt sich deine Anmeldung für sich.',
        'Nutze den Tor Browser auf der Sicherheitsstufe „Standard“: Auf den strengeren Stufen fehlt eine Technik, die die Anmeldung braucht. Benachrichtigungen gibt es im Tor Browser nicht.',
        'Über Tor sieht der Server keine einzelnen Besucher. Zum Schutz vor Überlastung löst dein Gerät deshalb bei jeder Anmeldung über Tor ein kleines Rechenrätsel (ganz von selbst), und beim Erstellen neuer Konten zählen alle Tor-Nutzer zusammen wie ein einziger Besucher. Kommt die Meldung, dass die Eulen nicht hinterherkommen, warte kurz und versuch es noch einmal.',
        'Der Betreiber kann den Zugang über das Tor-Netz vorübergehend abschalten. Dann verschwindet der Link auf der Startseite, und du nutzt einfach die normale Adresse.',
        'Die Anleitung „Wie kommt PostEulen aufs Handy?“ auf der Startseite nennt auch über das Tor-Netz die normale Adresse – aufs Handy legst du PostEulen am besten von dort.',
      ],
    ],
  },
  {
    id: 'konto',
    title: 'Konto, Passwort und Anmeldung',
    blocks: [
      `Dein Nutzername hat ${ACCOUNT.USER_NAME_MIN_CHARS} bis ${ACCOUNT.USER_NAME_MAX_CHARS} Zeichen: lateinische Buchstaben, Umlaute, ß, gängige Akzentbuchstaben, Ziffern und einzelne Leerzeichen. Groß- und Kleinschreibung und leicht verwechselbare Zeichen (0 und O, 1, l und I) zählen als gleich – so kann sich niemand als jemand anderes ausgeben.`,
      `Dein Passwort hat mindestens ${ACCOUNT.PASSWORD_MIN_CHARS} Zeichen. Ein Satz, den du dir gut merken kannst, ist ideal. Es darf deinen Nutzernamen nicht enthalten und kein bekanntes Allerwelts-Passwort sein – also nichts, was auf öffentlichen Listen oft benutzter Passwörter steht, und keine einfachen Folgen wie „123456789012345“, „qwertzuiopasdfg“ oder Wiederholungen wie „hallo123hallo123“. Das prüft die App beim Erstellen des Kontos und beim Passwortwechsel; ein älteres Passwort bleibt gültig. Das Passwort verlässt nie dein Gerät und liegt nirgends auf dem Server. Deshalb gilt: Wenn du es vergisst, sind alle deine Daten unwiderruflich verloren. Niemand kann es zurücksetzen, auch der Admin nicht.`,
      'Beim Erstellen setzt du einen fiktiven Wohnort per Pin auf die Karte – überlege sorgfältig, ob du deine echte Adresse wählen möchtest. Dort wohnen deine Eulen; von dort fliegen sie los.',
      'Du kannst immer nur auf einem Gerät angemeldet sein. Meldest du dich auf einem anderen Gerät an, endet die Sitzung auf dem alten – das gilt auch beim Wechsel zwischen der normalen Adresse und dem Tor-Netz. Das ist auch ein Schutz: Benutzt jemand anderes dein Passwort, wirst du selbst ständig abgemeldet und merkst es sofort – ändere dann gleich dein Passwort. Nach mehrfach falschem Passwort musst du etwas warten und ein kleines Rechenrätsel lösen lassen (das macht dein Gerät automatisch).',
      `Ohne Nutzung endet die Anmeldung nach ${ACCOUNT.USER_SESSION_IDLE_DAYS} Tagen. Beim Abmelden löscht PostEulen alle Schlüssel von deinem Gerät und vergisst auch alles, was es sich über deine Kontakte gemerkt hat – meldet sich danach jemand anderes im selben Fenster an, sieht er nichts davon. Beim nächsten Anmelden holt PostEulen deine Schlüssel verschlüsselt vom Server zurück.`,
    ],
  },
  {
    id: 'ueberblick',
    title: 'Die App im Überblick',
    blocks: [
      'Nach der Anmeldung siehst du die Übersicht mit Kacheln für alle Bereiche: Briefwechsel, Meine Eulen, Postamt, Menagerie, Adressbuch, Karte, Einstellungen und Rettungsstation. Deinen Goldstand siehst du immer oben rechts als Zahl hinter der Münze ⛀; Buchungen und das tägliche Gold stehen in den Einstellungen. Auf dem Handy erreichst du die wichtigsten Bereiche auch über die Leiste am unteren Rand.',
      'Ist ein neuer Brief da, hüpft oben in der braunen Leiste „Neue Post!“ – ein Tipp darauf führt dich zum Briefwechsel. Neue Systemnachrichten zeigen dort nur ihren Zähler. Auf der Übersicht steht neben dem Schriftzug klein die Version der App. Auf großen Bildschirmen sitzen daneben alle Eulen auf ihren Stangen – bei Nacht hellwach im Dunkeln, in der Weihnachtszeit festlich geschmückt. Sind Benachrichtigungen nicht eingerichtet, erscheint darunter ein Hinweis, der dich zu den Einstellungen führt. Stört er dich, blende ihn mit „Ausblenden bis zur nächsten Anmeldung“ aus.',
      'Was du schon gelesen hast, gilt sofort als gelesen – die Zähler in der Übersicht und in der Leiste gehen ohne Neuladen zurück.',
      'Unter „Neuigkeiten“ zeigt die Übersicht alles, was dich nicht per Benachrichtigung erreicht hat – zum Beispiel weil das Handy aus war.',
      'Darunter begrüßt dich PostEulen mit deinem Namen – passend zur Tageszeit an deinem fiktiven Wohnort, also nach der Uhrzeit, die dort gerade gilt (mit Sommerzeit). Wer spät abends oder nachts vorbeischaut, wird als Nachteule begrüßt. Auch alle anderen Uhrzeiten in der App – Ankunft, Heimkehr, Rast, Fristen – stehen in dieser Ortszeit deines Wohnorts.',
      'Oben rechts sitzt auf jeder Seite ein kleines Fähnchen. Ein Tipp auf die britische Flagge stellt PostEulen auf Englisch um, die deutsche Flagge stellt wieder zurück (siehe Sprache). Gleich daneben führt das Fragezeichen zu dieser Hilfe (auf der Hilfeseite selbst fehlt es); du findest sie außerdem ganz unten in den Einstellungen und im Briefwechsel mit dem Erklärbären direkt über dem Schreibfeld. Ganz rechts, hinter dem Fragezeichen, sitzt der Ein-/Aus-Knopf: Damit meldest du dich ab – vorher fragt PostEulen noch einmal nach.',
      'Große Zahlen stehen überall mit Tausenderpunkt da, etwa 12.345 km.',
      'PostEulen ist so gestaltet, dass es auch im Graustufenmodus deines Geräts vollständig bedienbar ist – nichts erkennt man nur an der Farbe. Wer weniger bunte Reizüberflutung möchte (gerade für Kinder angenehm), schaltet die Graustufen einfach in den Bedienungshilfen des Geräts ein.',
    ],
  },
  {
    id: 'sprache',
    title: 'Sprache: Deutsch oder Englisch',
    blocks: [
      'PostEulen gibt es auf Deutsch und auf Englisch. Deutsch ist immer der Standard. Mit dem Fähnchen oben rechts schaltest du jederzeit um: die britische Flagge für Englisch, die deutsche für Deutsch.',
      'Bist du nicht angemeldet, merkt sich dein Gerät deine Wahl. Erstellst du ein Konto in der englischen Ansicht, gilt Englisch auch für dein Konto. Nach jeder Anmeldung zeigt PostEulen dann die Sprache deines Kontos, auf jedem Gerät.',
      'Angemeldet speichert das Fähnchen die Sprache gleich im Konto. Du findest sie auch in den Einstellungen unter „Sprache“.',
      'Die Sprache gilt für alles, was PostEulen selbst schreibt: Menüs, Hilfe, Systemnachrichten, Benachrichtigungen und die Briefe der Bots. Neue Namen werden dann in dieser Sprache gewürfelt: die Leiheulen des nächsten Tages, Küken und wilde Eulen der Rettungsstation. Eulen, die schon einen Namen haben, behalten ihn – auch die Leiheulen, die heute schon im Postamt warten, und eine Leiheule, die zu jemandem fliegt, der eine andere Sprache eingestellt hat. Briefe von Menschen bleiben natürlich, wie sie geschrieben wurden, und Bot-Briefe, die schon angekommen sind, ebenfalls.',
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
      'Briefe zwischen Menschen werden auf deinem Gerät verschlüsselt und unterschrieben. Der Server sieht nur Kauderwelsch. Er sieht aber, wer wem wann schreibt, wie lang das Pergament ist und ob ein Brief gelesen wurde – deinem Gegenüber verrät PostEulen das nicht.',
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
      'Oben im Briefwechsel siehst du einen Schreibtisch voller Briefe vor hohen Fenstern. Draußen wechseln die Jahreszeiten mit dem Kalender an deinem Wohnort: Winter bis Ende Februar, Frühling ab März, Sommer ab Juni, Herbst ab September, ab November kahle Bäume und vom ersten Advent bis zum zweiten Weihnachtsfeiertag Schnee und Mistelzweig – bei Tag im Tageslicht, bei Nacht mit Kerzenschein. Darunter siehst du für jedes Gegenüber einen Chat, sortiert nach der letzten Aktivität und mit Zähler für ungelesene Briefe. Oben angeheftet sind die Systemnachrichten.',
      [
        `Kurzes Pergament: bis ${LETTER.SMALL_MAX_CHARS} Zeichen, kostenlos.`,
        `Langes Pergament: bis ${LETTER.LARGE_MAX_CHARS.toLocaleString('de-DE')} Zeichen, ebenfalls kostenlos – sofern deine Eule es tragen kann.`,
      ],
      `So geht’s: Pergament wählen, Text schreiben, bei Bedarf weitere Empfänger hinzufügen (insgesamt höchstens ${LETTER.MAX_RECIPIENTS}), Eule wählen und absenden. Die Eulenwahl steht schon da, bevor du das erste Wort schreibst, und bleibt beim Tippen stehen. Bei mehreren Empfängern sortiert PostEulen sie so, dass die Eule den kürzesten Weg fliegt – von dir zu allen und wieder nach Hause. Mit den Pfeilen kannst du die Reihenfolge trotzdem ändern. Bei der Eulenwahl zeigt PostEulen dir für jede Eule, wann sie bei jedem Empfänger ankommt und wann sie wieder zu Hause ist.`,
      'Du kannst auch bei der Eule anfangen: In der Eulenübersicht hat jede einsatzbereite eigene Eule und jede Leiheule den Knopf „Brief schreiben“. Du wählst bis zu fünf Kontakte – oder einen Bot –, und der Briefwechsel öffnet sich mit genau dieser Eule.',
      `Hast du gerade keine Eule, die den Brief tragen kann – keine eigene, keine schon geliehene und keine Gast-Eule –, bietet dir die Eulenwahl die Leiheulen des Tages an. Keine davon ist vorausgewählt; geliehen und bezahlt (${gold(GOLD.LOAN_PRICE)}, Eulen, die auch Gold tragen, ${gold(GOLD.LOAN_PRICE_GOLD)}) wird erst, wenn du wirklich abschickst – dein Brief bleibt dabei, wie er ist. Sonst leihst du im Postamt.`,
      'Bei mehreren Empfängern fliegt die Eule von einem zum nächsten. Jeder sieht nur seinen eigenen Brief und kann nur dir antworten. Das geht mit eigenen Eulen und mit Leiheulen; eine Leiheule verschwindet nach dem letzten Empfänger. Bots sind nie bei mehreren Empfängern dabei.',
      `Rast beim Empfänger: Beim Schreiben wählst du, wie lange die Eule bei jedem Empfänger bleibt, bevor sie weiterfliegt – gar nicht, 1, 2, 6, 12, 24 oder ${LETTER.REST_HOURS_CHOICES[LETTER.REST_HOURS_CHOICES.length - 1]} Stunden (vorgewählt: ${LETTER.REST_HOURS_DEFAULT_OWN} Stunden mit einer eigenen Eule, ${LETTER.REST_HOURS_DEFAULT_LOAN} Stunden mit einer Leiheule; hast du selbst etwas gewählt, bleibt es dabei, auch wenn du eine andere Eule nimmst). Die Ankunftszeiten in der Eulenwahl rechnen schon mit dieser Rast. Während der Rast erholt sie sich wie zu Hause, und der Empfänger sieht sie unter „Eulen“ mit dem deutlichen Hinweis „Nur zur Rast hier!“ und bis wann. Im Briefwechsel steht dann hinter deinem Namen ein kleines Eulensymbol (rasten mehrere deiner Eulen bei ihm, eines für jede), und hat er Benachrichtigungen eingerichtet, bekommt er für Brief und Rast zusammen eine einzige: „Eine Eule hat Post gebracht und rastet bei dir.“ Er darf sie pflegen und ihr eine Antwort an dich mitgeben – dann fliegt sie sofort los. Hat sie noch Briefe für andere dabei, stellt sie zuerst diese zu und bringt dir seine Antwort danach (wer die anderen sind, erfährt er nicht). Er kann sie auch ohne Brief früher weiterfliegen lassen. Läuft die Zeit ungenutzt ab, fliegt sie von selbst weiter. Bei mehreren Empfängern kann dir jeder eine Antwort mitgeben; die Eule kommt dann mit mehreren Briefen nach Hause, und das Bild ihrer Heimkehr sagt dir, wie viele es sind. Eine Leiheule ohne Antwort verschwindet nach dem letzten Empfänger; hat sie Antworten dabei, bringt sie die noch zu dir und fliegt erst dann zurück ins Postamt.`,
      'Rastet die Eule eines Kontakts bei dir, steht im Briefwechsel ein kleines Eulensymbol hinter seinem Namen – für jede Eule, die gerade bei dir rastet, eines. Die Antwort schreibst du ganz normal in eurem Chat: In der Eulenwahl steht die Gast-Eule ganz oben und ist schon ausgewählt; eine Rast-Auswahl gibt es dann nicht. Die Eulenwahl sagt dir auch, welchen Weg sie nimmt: Hat sie keine weiteren Briefe dabei, bringt sie deinen direkt zu ihrem Halter. Hat sie noch Briefe für andere, stellt sie zuerst diese zu und bringt deine Antwort danach – an wen die übrigen Briefe gehen, verrät sie nicht.',
      'Briefe sind reiner Text. Smileys und Emojis kennt Pergament nicht – sie werden entfernt. Links mit http:// oder https:// sind anklickbar und öffnen sich im Browser; prüfe die angezeigte Adresse, bevor du tippst. Möchtest du lieber nichts versehentlich antippen, schalte in den Einstellungen den Regler „Links in Briefen anklickbar“ aus – dann stehen Links nur als Text da.',
      `Vorsicht vor verkleideten Adressen: Manche Buchstaben aus fremden Alphabeten sehen aus wie unsere (ein kyrillisches „а“ wie ein „a“). Enthält die Adresse eines Links solche Zeichen oder einen Namen mit „@“ vor der eigentlichen Adresse, zeigt PostEulen sie in ihrer technischen Form, etwa „xn--pypal-4ve.com“ statt „pаypal.com“, und schreibt daneben: „${de.letters.linkWarning}“ So siehst du, wohin der Link wirklich führt. Auch echte Adressen mit Umlauten (z. B. müller.de) sehen dann so aus.`,
      [
        '„Eule unterwegs – Ankunft ca. …“: der Brief ist auf dem Weg.',
        '„zugestellt“: die Eule ist angekommen. Ob und wann dein Gegenüber den Brief gelesen hat, verrät PostEulen nicht – genau wie beim echten Briefkasten.',
        '„nicht zugestellt – die Eule ist umgekehrt“: zum Beispiel, weil die Verbindung gekappt wurde.',
        '„Die Eule hat den Brief unterwegs verloren.“: das Gerät deines Gegenübers konnte den Brief nicht öffnen (siehe Verschlüsselung). Schreib ihn am besten noch einmal.',
      ],
      'Landet eine Eule mit Post bei dir, siehst du sie gleich bei der nächsten Gelegenheit: sofort, wenn PostEulen offen ist, sonst beim Öffnen der App oder nach dem Anmelden – du musst dafür nicht erst den Briefwechsel öffnen. Unter dem Bild steht, wer dir schreibt. Sind mehrere Eulen gelandet, zeigen sie sich nacheinander. Jedes Bild schließt sich nach ein paar Sekunden von selbst, per Tippen oder mit der Escape-Taste.',
      'Unter jedem Brief steht, welche Eule ihn gebracht hat – bei deinen eigenen Briefen auch („Unterwegs mit …“, solange er noch fliegt). War es nicht deine eigene Eule, steht in Klammern dabei, dass es eine Leiheule war oder wessen Eule es war.',
      'Kurze Briefe liegen leicht schräg wie auf einem Schreibtisch; sehr lange Briefe stehen gerade, damit nichts aus dem Bild rutscht.',
      `Lange Briefwechsel öffnen sich schneller: Ab ${CHAT.WINDOW_FROM} Briefen siehst du zuerst nur die letzten ${CHAT.RECENT} (und alle, die du noch nicht gelesen hast). Ganz oben steht dann der Knopf „Ältere Briefe im Keller suchen“ – ein Tipp, und der ganze Briefwechsel ist da. Das gilt genauso für die Systemnachrichten und die Briefe der Bots.`,
      'Die Briefe stehen in der Reihenfolge, in der du von ihnen erfahren hast: deine eigenen dort, wo du sie abgeschickt hast, empfangene dort, wo sie bei dir angekommen sind. Ein Brief, der lange unterwegs war, steht also unten bei den neuen.',
      'Im Chat erscheinen Briefe als Pergamentbögen mit ausgefranstem Rand: Briefe an dich auf hellem Pergament, in verbundener Schreibschrift und blauschwarzer Tinte, deine eigenen auf dunklerem Pergament, in geschwungener Federschrift und Sepia. Das Schreibfeld sieht schon so aus, wie dein Brief später bei dir aussieht. Briefe, die vom ersten Advent bis zum Ende des zweiten Weihnachtsfeiertags geschrieben werden (nach der Uhrzeit am Wohnort des Absenders), liegen für immer auf Weihnachtspergament – eines von vier Briefpapier-Paaren, für jeden Briefwechsel fest ausgelost und für euch beide gleich, je eines für deine Briefe und eines für die deines Gegenübers. Links und Namen stehen immer in Druckschrift, damit du sie sicher lesen kannst. Unter jedem Brief steht auf einem kleinen Schild, wann er bei dir angekommen ist („Empfangen am 15.11.2026 um 14:03“) bzw. wann du ihn abgeschickt hast („Abgeschickt am …“), auf welchem Pergament er steht und welche Eule ihn gebracht hat; bei deinen eigenen Briefen auch, ob er schon zugestellt ist. Auf dem Pergament selbst steht nur der Brief. Wann dein Gegenüber einen Brief geschrieben hat, siehst du nicht. Ist dir Handschrift zu mühsam, stell in den Einstellungen auf Druckschrift um.',
      'Öffnest du einen Chat, beginnt er beim ältesten Brief, den du noch nicht gelesen hast. Ist alles gelesen, springt er zum neuesten Brief. Ältere Briefe findest du darüber.',
      '„Alle Briefe verbrennen“ entfernt nach einer Rückfrage deine Kopien aller Briefe dieses Chats endgültig – sie gehen im Kamin in Flammen auf. Dein Gegenüber behält seine. Ein Brief, der gerade noch zu dir unterwegs ist, verbrennt nicht mit: Er kommt an und steht dann im Chat.',
    ],
  },
  {
    id: 'aufbewahrung',
    title: 'Alte Briefe werden gelöscht',
    blocks: [
      `Wichtig: Alle Briefe und Systemnachrichten werden ${LETTER.RETENTION_MAX_DAYS} Tage – also ein Jahr – nach ihrer Zustellung automatisch und unwiderruflich gelöscht. Das gilt für alle Konten und auch für die Briefe der Bots. Wiederherstellen kann sie niemand.`,
      'Aufgeräumt wird einmal in der Woche, montags früh (04:00 UTC). Ein Brief kann also bis zu sieben Tage länger liegen bleiben als seine Frist; fällt ein Aufräumtag einmal aus, wird am nächsten Montag nachgeholt.',
      'Neue Konten löschen eigene Briefe nach 180 Tagen. In den Einstellungen unter „Briefe“ wählst du selbst 30, 90, 180 Tage oder ein Jahr – für geschriebene und erhaltene Kopien; Konten von vor Version 1.3.1 behalten ihre bisherige Frist (meist ein Jahr). Wählst du eine kürzere Frist, wird alles, was älter ist, beim nächsten wöchentlichen Aufräumen gelöscht. Sofort weg sind Briefe nur, wenn du sie selbst verbrennst. Dein Gegenüber behält seine Kopie, bis seine eigene Frist abläuft.',
      'Briefe, die noch unterwegs sind, werden nie gelöscht. Möchtest du etwas aufheben, schreib es dir außerhalb von PostEulen auf.',
      'Wurden Briefe wegen der Löschfrist entfernt, sagt dir eine Systemnachricht mit einem Bild vom Kaminfeuer, wie viele es waren und aus welchen Chats.',
    ],
  },
  {
    id: 'systemnachrichten',
    title: 'Systemnachrichten',
    blocks: [
      'Im Chat „Systemnachrichten“ meldet PostEulen sofort alles Wichtige: neue Kontakte, angekommenes Gold oder Eulen, Krankheiten, Eier, Küken, gelangweilte Eulen, Beginn und Ende des Urlaubsmodus, Namensänderungen deiner Kontakte, Rundnachrichten des Admins und mehr. Dass eine Eule bei dir rastet, zeigt dir stattdessen ein kleines Eulensymbol hinter dem Namen im Briefwechsel – eines für jede rastende Eule. Antworten kannst du dort nicht.',
      'Manchmal hängt der Admin oben in der App einen kurzen Hinweis für alle auf, etwa zu einer Wartung. Er verschwindet von selbst, wenn seine Zeit abgelaufen ist; mit ✕ blendest du ihn auf diesem Gerät schon vorher aus.',
      'Kommt eine deiner Eulen von einem Flug heim, steht dafür keine Nachricht hier. Stattdessen zeigt dir PostEulen ein Bild: Die Eule sitzt auf dem Fensterbrett – bei Tageslicht oder bei Kerzenschein, je nachdem, ob es an deinem Wohnort in diesem Moment hell oder dunkel ist. Hat sie Antwortbriefe dabei, steht unter dem Bild, wie viele. Das Bild kommt sofort, wenn die App bei der Landung offen ist, sonst beim nächsten Öffnen oder Anmelden. Sind mehrere Eulen heimgekehrt – etwa alle zusammen am Ende des Urlaubsmodus –, siehst du die Bilder nacheinander. Ist eine gelangweilte Eule davongeflogen, siehst du genauso einmal, wie sie ohne Brief in die Freiheit fliegt. Hast du Benachrichtigungen eingerichtet, bekommst du außerdem eine.',
      'Nach jedem Update erzählt dir eine Nachricht, was sich geändert hat. Und alle fünf Wochen kommt eine kleine Bitte um eine freiwillige Spende (siehe Häufige Fragen).',
    ],
  },
  {
    id: 'eulen',
    title: 'Deine Eulen',
    blocks: [
      'Unter „Meine Eulen“ (in der Leiste unten kurz „Eulen“) siehst du alle deine Eulen, Küken und Leiheulen mit Bild, Name, Art, Geschlecht, Energie, Motivation und Zustand; hinter dem Namen einer Leiheule steht „(Leiheule)“. Ganz oben unter „Bereit für Post“ stehen alle Eulen, die gerade losfliegen können – eigene und Leiheulen gemischt, die Eule, die du schon am längsten hast, zuerst. Darunter unter „Unterwegs und beschäftigt“ alle übrigen: Eulen auf Reisen oder in Rast, kranke Eulen in der Rettungsstation, brütende, im Eulenpostamt aushelfende Eulen, Eulen im Urlaub und Küken – die, die schon am längsten fort oder beschäftigt ist, zuerst. Ist eine Eule nicht da, steht dabei, warum und bis wann, etwa „Fliegt gerade einen Brief zu Peter. Voraussichtlich zurück in 5 Stunden.“, „Schläft auf dem Heimweg“, „Rastet bei Peter bis 20:00“ oder „Hilft im Eulenpostamt aus bis Fr., 14:00“. Dauert es weniger als eine Stunde, steht die Zeit in Minuten da, etwa „zurück in 40 Minuten“. Bei deinen eigenen Eulen steht hinter Art und Geschlecht außerdem, wie viele Kilometer sie schon geflogen sind, etwa „Sperbereule · weiblich · 1.234 km“ – jeder beendete Flug zählt mit allen Halten und Umwegen, auch die Flüge von früher. Ist eine Eule weiter geflogen als einmal um die Erde (mehr als 40.030 km), trägt sie ab dann überall eine kleine Weltkugel hinter ihrem Namen. Ab 384.400 km – so weit ist es von der Erde bis zum Mond – trägt sie stattdessen eine Mondsichel, ab 1.000.000 km eine Krone. Jedes neue Abzeichen wird mit einer Systemnachricht gefeiert. Bei jeder Eule, die gerade zu Hause ist, steht auch, was sie tragen kann (siehe „Was eine Eule tragen kann“). Kann sie Gold tragen und hast du genug Gold, hat sie den Knopf „Gold verschicken“. Die Erklärung zu Motivation, Pflege und Krankheit steht ganz unten auf der Seite.',
      'Das Bild zeigt, was die Eule gerade tut: Ist sie unterwegs, siehst du sie fliegen – im Sonnenschein oder unter Sternen, je nachdem, ob es dort, wo sie gerade ist, hell oder dunkel ist. Macht sie unterwegs eine Schlafpause, siehst du sie schlafen, bei Tag oder bei Nacht. Brütet sie, sitzt sie im Nest auf ihren Eiern – ist es bei dir dunkel, hält sie im nächtlichen Nest Wache. Ist ihre Motivation ganz unten (80 %), schaut sie zu Hause grummelig drein – ist es bei dir dunkel, grummelt sie im Dunkeln. Hilft sie im Eulenpostamt aus, wird sie in der Rettungsstation gepflegt, rastet sie gerade bei einem Empfänger oder erholt sie sich im Urlaub auf der Insel Inchlonaig, siehst du ihre leere Stange; auf dem Weg dorthin und zurück siehst du sie fliegen. Langweilt sich eine Eule, sitzt sie gelangweilt am Fenster (siehe „Gelangweilte Eulen“) – dieses Bild bleibt, bis sie wieder mit einem Brief unterwegs ist. Zu Hause siehst du sie bei Tag im Tageslicht und, wenn es an deinem Wohnort dunkel ist, hellwach bei Nacht – Eulen schlafen nachts ja nicht. Im Advent bis zum zweiten Weihnachtsfeiertag tragen sie Weihnachtsschmuck. Ist sie unterwegs, steht unter ihr, wohin sie fliegt, ihr nächster Halt mit Uhrzeit und wann sie ungefähr zurück ist. Bleibt die Übersicht offen, während Eulen unterwegs sind, schaut PostEulen alle fünf Minuten nach, ob eine inzwischen schläft oder wieder fliegt.',
      'Jede einsatzbereite eigene Eule und jede Leiheule hat den Knopf „Brief schreiben“: Kontakte wählen, und die Eule wartet im Briefwechsel schon auf deinen Brief.',
      'Unter jeder Eule stehen nur die Knöpfe, die gerade gehen – so bleiben die Karten klein und übersichtlich. Hat sie heute schon getrunken, fehlt „Wasser geben“; ist sie satt, fehlen Eulenkeks und Lieblingsleckerli; Umbenennen, Verschenken, Gold verschicken, An das Postamt verleihen und In die Freiheit entlassen erscheinen nur, wenn es gerade erlaubt ist. Darfst du gerade nichts verschenken, steht einmal oben über den Eulen, warum.',
      'Rastet die Eule eines Kontakts bei dir, steht sie ganz oben unter „Zu Gast bei dir“ – mit dem Hinweis, dass sie nur zur Rast hier ist und bis wann. Du kannst sie tränken, streicheln und füttern (Eulenkeks und Leckerli bezahlst du, wie bei deinen eigenen Eulen auch mehrmals, solange sie nicht satt ist) – das hebt ihre Motivation, und sie fliegt gestärkt weiter. Über „Antwort … mitgeben“ kommst du direkt in euren Chat; hat sie noch Briefe für andere dabei, steht dort, dass sie diese zuerst zustellt. Wenn sie bei dir ankommt, bekommst du (wenn eingerichtet) eine Benachrichtigung, und im Briefwechsel steht ein kleines Eulensymbol hinter dem Namen ihres Halters, solange sie bleibt. Möchtest du sie früher ziehen lassen, tippe auf „Weiterfliegen lassen“ – nach einer Rückfrage fliegt sie ohne Brief davon, und du siehst sie frei und ohne Brief losfliegen.',
      'Eulen sind nachtaktiv: Ist es bei dir zu Hause hell, döst eine gesunde Eule manchmal vor sich hin – ob sie gerade schläft, entscheidet sich bei jedem Öffnen der Eulenübersicht neu, etwa jedes zweite Mal. Nachts und in den zehn Minuten nach deiner letzten Pflege ist sie immer wach. Pflegen und losschicken kannst du sie trotzdem jederzeit.',
      'Jede Art hat einen Preis, eine maximale Energie, einen Geschwindigkeitsfaktor und einen Erholungsfaktor. Eulen werden nicht alt und sterben nicht.',
      [
        `Umbenennen: einmal pro Kalenderjahr je Eule (${OWL.NAME_MIN_CHARS}–${OWL.NAME_MAX_CHARS} Zeichen). Die erste Benennung nach Kauf oder Schlupf zählt nicht.`,
        'Verschenken: eine einsatzbereite erwachsene Eule fliegt zu einem Kontakt und gehört ab der Ankunft ihm. Du kannst einen kurzen Begleitbrief mitgeben. Kehrt sie um, gehört sie wieder dir. Nur aktive Spieler können alle zwei Wochen Gold oder eine Eule verschenken.',
        `In die Freiheit entlassen: die Eule ist endgültig weg. Das geht nur, solange du mehr als ${OWL.RELEASE_ABOVE_OWN_OWLS} eigene Eulen hast (Küken zählen mit, Leiheulen nicht) – bei ${OWL.RELEASE_ABOVE_OWN_OWLS + 1} kannst du also eine freilassen. Damit es nie aus Versehen passiert, tippst du dafür ihren Namen genau ein und bestätigst danach ein zweites Mal.`,
        `Höchstens so viele eigene Eulen, wie es Eulenarten gibt – derzeit ${SPECIES.length} (Küken zählen mit, Leiheulen nicht). Hast du so viele, kannst du keine Eule mehr kaufen, geschenkt bekommen oder per Gutschein einlösen, geheilte wilde Eulen der Rettungsstation fliegen in die Freiheit, und schlüpfen Küken, musst du alle verschenken. Solange das so bleibt, erinnert dich einmal pro Woche eine Systemnachricht daran. Wer schon vorher mehr Eulen hatte, behält sie.`,
      ],
      'Eine Eule kann nur losfliegen, wenn sie zu Hause, gesund und erwachsen ist und weder brütet, noch im Eulenpostamt aushilft, noch im Urlaub ist.',
    ],
  },
  {
    id: 'langeweile',
    title: 'Gelangweilte Eulen',
    blocks: [
      `Eulen wollen Briefe tragen. Ist eine deiner erwachsenen Eulen ${BOREDOM.BORED_AFTER_DAYS} Tage lang nicht von einem Flug zu einem Menschen heimgekommen, wird ihr langweilig: Eine Systemnachricht sagt dir, dass sie unzufrieden und gelangweilt wirkt, und unter „Meine Eulen“ sitzt sie gelangweilt am Fenster – bei Tag oder bei Nacht.`,
      `Schick sie in den nächsten ${BOREDOM.ESCAPE_AFTER_DAYS} Tagen mit einem Brief oder mit Gold zu einem deiner Kontakte, dann ist alles wieder gut. Flüge zu Bots zählen dafür nicht. Tust du es nicht, fliegt sie davon und kommt nie wieder zurück; beim nächsten Öffnen der App siehst du sie ein letztes Mal, wie sie in die Freiheit fliegt, und eine Systemnachricht erzählt davon. Deine letzte erwachsene Eule haut nie ab – sie langweilt sich nur.`,
      'Die Zeit läuft ab dem Tag, an dem die Eule zu dir gekommen (oder erwachsen geworden) ist, und beginnt mit jeder Heimkehr von einem Menschen von vorn. Nicht mitgezählt werden die Tage, an denen sie krank in der Rettungsstation ist, brütet, im Eulenpostamt aushilft oder du im Urlaubsmodus bist.',
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
        `Eulenkeks: ${gold(GOLD.FEED_PRICE)}, gibt sofort ${percent(OWL.FEED_SHARE)} Energie mal Erholungsfaktor. Einmal am Tag geht immer, auch wenn die Energie schon voll ist; danach so oft du magst, solange die Energie gerade nicht voll ist – jeder Keks kostet. Ist sie voll, ist die Eule satt.`,
        `Lieblingsleckerli: ${gold(GOLD.SNACK_PRICE)}, gibt sofort ${percent(OWL.SNACK_SHARE)} Energie mal Erholungsfaktor – genauso: einmal am Tag immer, danach, solange die Energie nicht voll ist. Jede Art hat ihr eigenes – der Waldkauz liebt Haselnüsse, der Riesenfischuhu Räucherfisch; was genau, steht in der Menagerie bei der Beschreibung.`,
      ],
      'Dein Beutel: Manchmal legt dir ein Bot Eulenkekse oder Leckerlis in einen Brief, oder du löst einen Gutschein dafür ein. Sie landen in deinem Beutel. Solange darin Eulenkekse sind, kostet Füttern nichts; solange Leckerlis darin sind, kostet das Lieblingsleckerli nichts – Leckerlis schmecken jeder Eule. Jedes Mal wird eins aus dem Beutel genommen, auch in der Rettungsstation und bei Gast-Eulen. Was noch im Beutel ist, steht oben im Postamt, bei „Meine Eulen“ und in der Rettungsstation; auf den Knöpfen steht dann „aus dem Beutel“ statt des Preises.',
      'Was du heute schon getan hast – etwa Wasser geben oder eine satte Eule füttern –, verschwindet als Knopf, bis es wieder geht.',
      `Jede dieser vier Arten der Pflege hebt einmal am Tag die Motivation (siehe Motivation). Pflegebonus gegen Krankheit: Ein Tag zählt als gepflegt, wenn die Eule an diesem Tag ${OWL.CARE_DAY_INTERACTIONS} verschiedene Arten von Pflege bekommen hat – zum Beispiel Wasser und Streicheln. Gezählt werden die letzten ${OWL.CARE_BONUS_WINDOW_DAYS} Tage, an denen sie mindestens ${OWL.CARE_BONUS_MIN_HOME_HOURS} Stunde zu Hause war. War sie an mindestens ${OWL.CARE_BONUS_MIN_DAYS} davon gepflegt, wird sie viel seltener krank. Ganze Reisetage zählen also nicht – eine fleißige Brief-Eule verliert ihren Bonus nicht, nur weil sie unterwegs war.`,
    ],
  },
  {
    id: 'motivation',
    title: 'Motivation',
    blocks: [
      'Jede deiner Eulen hat neben der Energie einen zweiten Balken: die Motivation. Sie liegt immer zwischen 80 % und 120 %. Gekaufte Eulen kommen mit 100 % zu dir, Leiheulen mit 80 % bis 100 %.',
      'Jede Nacht um Mitternacht (UTC) sinkt sie um 10 Prozentpunkte – auch wenn die Eule gerade unterwegs ist oder im Eulenpostamt aushilft; nur im Urlaubsmodus bleibt sie, wie sie ist. Wasser, Streicheln, Eulenkeks und Lieblingsleckerli heben sie jeweils einmal am Tag um 10 Prozentpunkte – mehrmals füttern hebt sie nicht weiter. Bei 80 % schaut die Eule grummelig drein. Wer sich jeden Tag ein bisschen kümmert, hat also bald eine hoch motivierte Eule.',
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
      'Die Karte sieht aus wie aus einem handgezeichneten alten Atlas: warmes Pergament, feine Küsten mit Wellenlinien, gestrichelte Grenzen, Flüsse und Seen, schraffierte Gebirge, kleine Hügel für die Mittelgebirge, olivgrüne Baumgruppen für Wälder – Bäume, Berge und Hügel stehen dabei immer an Land, nie auf Meeren, Seen oder Stauseen. Je näher du heranzoomst, desto mehr Namen erscheinen – ganz weit draußen die Ozeane, dann Meere, Gebirge und große Landschaften, schließlich Flüsse, Seen, Wälder und kleinere Landschaften. Rund um Westeuropa ist die Karte viel genauer als im Rest der Welt, bis hin zu Lüneburger Heide, Harz, Eifel oder Schwäbischer Alb. Ein Name erscheint nur, wo er Platz hat; Städte, deine Orte und deine Eulen gehen vor.',
      'Deine Eulen siehst du dort, wo sie gerade sind. Den Weg, der noch vor ihnen liegt, zeigt die Karte nicht – Eulen lassen sich nicht gern in die Karten schauen. Unter der Karte stehen alle deine Eulen unterwegs mit ihrem nächsten Halt; rastet eine gerade, steht dort, bei wem und bis wann.',
      'Beim Öffnen zoomt die Karte so weit hinein, dass gerade noch dein Wohnort, deine Kontakte und deine Eulen zu sehen sind (die Bots zählen dafür nicht). Zur Orientierung zeigt sie Städte: weit herausgezoomt die mit über einer Million Einwohnern, näher herangezoomt alle mit über 200.000. Ist kein Platz für einen Städtenamen oder läge er auf deinen Orten oder Eulen, bleibt er ausgeblendet, bis du näher heranzoomst. England, Schottland, Wales und Nordirland sind als eigene Länder eingezeichnet.',
      `Die dunkle Fläche ist die Nacht. Positionen und Nachtgrenze rechnet dein Gerät alle ${MAP.CLIENT_REFRESH_MINUTES} Minuten neu aus, ohne den Server zu fragen.`,
      'Die Karte ist immer quadratisch und so groß, dass sie ganz ins Fenster passt. Du kannst mit zwei Fingern oder dem Mausrad zoomen, verschieben und mit der Tastatur steuern (Pfeiltasten, Plus und Minus). Ganz herausgezoomt passt die ganze Welt ins Quadrat. Der Knopf unter Plus und Minus („Ansicht zurücksetzen“) springt zurück zur Ansicht beim Öffnen der Karte.',
      'Wohnen kannst du nur in Westeuropa: Beim Erstellen deines Kontos und beim Umzug zeigt die Karte deshalb nur den Westeuropa-Ausschnitt.',
    ],
  },
  {
    id: 'gold',
    title: 'Gold',
    blocks: [
      `Du startest mit ${gold(GOLD.START)}. Jeden Tag um ${dailyGoldTime} bekommt jedes aktive Konto Gold: in den ersten ${GOLD.DAILY_HIGH_DAYS} Tagen nach der Kontoerstellung ${gold(GOLD.DAILY)} am Tag, danach ${gold(GOLD.DAILY_LATER)}. Manchmal schickt dir auch ein Bot Gold oder sogar eine Eule – kommt ein Brief dazu, steht über ihm „Begleitbrief zu …“ mit dem Betrag bzw. der Eule.`,
      `Kosten: Eulen je nach Art, Leiheule ${gold(GOLD.LOAN_PRICE)} (Eulen, die auch Gold tragen: ${gold(GOLD.LOAN_PRICE_GOLD)}), Eulenkeks ${gold(GOLD.FEED_PRICE)}, Lieblingsleckerli ${gold(GOLD.SNACK_PRICE)}. Medizin, Wasser und Streicheln in der Rettungsstation kosten nichts. Eulenkekse und Leckerlis aus deinem Beutel kosten auch nichts. Alles muss voll gedeckt sein; Schulden gibt es nicht.`,
      'Sonderstatus: Der Admin deiner PostEulen-Instanz kann einzelnen Spielern einen Sonderstatus geben – für immer oder bis zu einem Zeitpunkt. Dann steht oben „∞ Gold“: Alles, was Gold kostet, ist kostenlos, und Gold und Eulen lassen sich ohne die üblichen Grenzen verschenken (eine Eule trägt aber weiterhin höchstens 200 Gold). Dein gewohnter Kontostand bleibt dabei unberührt und gilt wieder, sobald der Sonderstatus endet. Beginn und Ende meldet dir eine Systemnachricht.',
      `Deinen Goldstand siehst du oben rechts. In den Einstellungen unter „Gold und Buchungen“ stehen das tägliche Gold und die letzten ${GOLD.TRANSACTIONS_KEPT} Buchungen.`,
      `Gold verschicken: Jede einsatzbereite eigene oder geliehene Eule, die Gold tragen kann, hat unter „Eulen“ (Leiheulen auch im Postamt) den Knopf „Gold verschicken“ – sobald du genug Gold hast. ${gold(GOLD.TRANSFER_MIN)} bis ${gold(GOLD.TRANSFER_MAX)} an einen Kontakt, gern mit kurzem Begleitbrief; vor dem Losschicken siehst du, wann sie ankommt. Danach müssen dir mehr als ${gold(GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE)} bleiben. Das Gold wird beim Abflug abgebucht und kommt mit der Eule an. Kehrt sie um, bekommst du es zurück, sobald sie wieder zu Hause ist. Bots kannst du kein Gold schicken. Nur aktive Spieler können alle zwei Wochen Gold oder eine Eule verschenken.`,
    ],
  },
  {
    id: 'menagerie',
    title: 'Menagerie: Eulen kaufen',
    blocks: [
      'Zuerst stehst du vor der Menagerie in ihrem alten Gemäuer – bei Tag oder bei Nacht, je nachdem, wie es gerade an deinem Wohnort ist, und in der Weihnachtszeit verschneit und geschmückt. Mit dem großen Knopf „Menagerie betreten“ gleich unter dem Bild gehst du hinein: Drinnen sitzen die Eulen in Mauernischen, auf Ästen und an der Wendeltreppe, und die Pflegerin fegt neben der Ladentheke (auch drinnen bei Tag, bei Nacht und weihnachtlich geschmückt). Darunter stehen alle Eulen zum Kaufen, nach Preis sortiert, die günstigste zuerst. Zu jeder erzählt eine kleine Beschreibung, woher sie stammt und was für ein Charakter sie ist; bei den Werten steht auch, was sie tragen kann. Leiheulen gibt es im Eulenpostamt.',
      `Kaufen: Alle ${SPECIES.length} Arten sind immer zu haben. Nach dem Kauf gibst du deiner Eule einen Namen – ihr zufällig gewürfeltes Geschlecht steht dabei schon da. Ihre Energie liegt zu Beginn zwischen ${percent(OWL.START_ENERGY_MIN_SHARE)} und ${percent(OWL.START_ENERGY_MAX_SHARE)}. Hast du schon so viele eigene Eulen, wie es Arten gibt (${SPECIES.length}), kannst du keine mehr kaufen.`,
    ],
  },
  {
    id: 'postamt',
    title: 'Eulenpostamt: Eulen leihen',
    blocks: [
      'Im Eulenpostamt leihst du Eulen. Zuerst stehst du davor: Oben siehst du das Postamt bei Tag oder bei Nacht, je nachdem, wie es gerade an deinem Wohnort ist, und in der Weihnachtszeit verschneit und geschmückt, darunter den großen Knopf „Eulenpostamt betreten“ und eine kurze Einleitung. Drinnen siehst du das Eulenteam des Tages bei der Arbeit – auch das bei Tag, bei Nacht und im Advent festlich geschmückt. Hast du schon Eulen geliehen, stehen sie gleich darunter, und du kannst sie genauso versorgen und losschicken wie unter „Eulen“. Darunter begrüßt dich der Schalter und sagt dir, welche Eulen gerade reisebereit sind; dann folgen die Leiheulen des Tages mit Geschlecht, ihren Werten, was sie tragen können, ihrer Leihgebühr und ein paar Worten dazu, was sie besonders gut können. Mit „Zurück“ stehst du wieder vor der Tür.',
      `Leihen: Im Postamt hat jeden Tag eines von vier Teams Dienst (der Tag wechselt um Mitternacht UTC), und du kannst alle Eulen dieses Teams leihen – für ${gold(GOLD.LOAN_PRICE)} je Eule, Eulen, die auch Gold tragen, für ${gold(GOLD.LOAN_PRICE_GOLD)}, jede mit einem eigenen Namen, der zu ihr passt. Welches Team bei dir Dienst hat, wird für jedes Konto eigens ausgelost; deine Freunde sehen also oft ein anderes. Es bleibt bis zum nächsten Tageswechsel gleich, und am nächsten Tag kommt immer ein anderes Team. Die Namen wiederholen sich an den beiden Folgetagen nicht – dieselbe Leiheule triffst du also nicht zwei Tage hintereinander. Die Teams: ${teamList('de')}. Jede Eule des Teams kannst du einmal pro Tag leihen – auch wenn von gestern noch Leiheulen bei dir warten. Solange eine Leihe läuft, steht ihr Angebot mit „Schon geliehen“ da; ist sie vorbei – die Leiheule ist nach dem letzten Halt verschwunden, mit Antworten zu dir zurückgekehrt oder ungenutzt abgelaufen –, verschwindet ihr Angebot bis morgen und zählt trotzdem mit. Du kannst hier leihen oder direkt beim Briefschreiben. Den Phönix gibt es nie zum Leihen.`,
      `Eine Leiheule trägt einen Brief an bis zu ${LETTER.MAX_RECIPIENTS} Empfänger nacheinander oder Gold an einen Empfänger und ist nach dem letzten weg – zurück kommt sie nur, wenn ihr jemand eine Antwort mitgibt. Schickst du sie nicht binnen ${MENAGERIE.LOAN_EXPIRY_HOURS} Stunden los, verschwindet sie wieder, und das Gold ist verbraucht. Hast du beim Schreiben eine Rast gewählt und gibt ihr ein Empfänger eine Antwort mit, bringt sie diese noch zu dir. Sie lässt sich pflegen wie jede Eule, aber nicht umbenennen oder verschenken. Ihre Motivation liegt zwischen 80 % und 100 %, ihre Energie zu Beginn zwischen ${percent(MENAGERIE.LOAN_START_ENERGY_MIN_SHARE)} und ${percent(MENAGERIE.LOAN_START_ENERGY_MAX_SHARE)}.`,
      `Tipp für den Anfang: Mit ${gold(GOLD.START)} Startgold leihst du eine Eule für deinen ersten Brief. Für die günstigste eigene Eule (${CHEAPEST.name}, ${CHEAPEST.price} Gold) reicht es schon nach ein, zwei Tagen.`,
    ],
  },
  {
    id: 'arten',
    title: 'Eulenarten im Überblick',
    blocks: [
      'Preis in Gold, maximale Energie, Geschwindigkeit, Erholung pro Stunde (bei Motivation 100 %) und was die Eule tragen kann:',
      SPECIES.map(
        (species) =>
          `${species.name}: ${species.price} Gold, ${species.maxEnergy.toLocaleString('de-DE')} Energie, ${decimalDe(FLIGHT.BASE_SPEED_KMH * species.speedFactor)} km/h, Erholung ${decimalDe(OWL.REGEN_SHARE_PER_HOUR * 100 * species.recoveryFactor)} % pro Stunde – ${de.owls[`cargo_${species.cargo}`]}`,
      ),
      `Der Phönix ist keine gewöhnliche Eule: Er kostet ${SPECIES.find((species) => species.id === 'phoenix')?.price ?? 150} Gold, fliegt viermal so schnell wie eine Eule mit Faktor 1, wird nie verliehen, hilft nicht im Eulenpostamt aus und legt keine Eier.`,
      `Der Virginiauhu (${SPECIES.find((species) => species.id === 'virginiauhu')?.price ?? 60} Gold, 1.300 Energie, 65 km/h, 20 % Erholung pro Stunde) ist eine ganz normale Art: Du kannst ihn kaufen, leihen und an das Postamt verleihen, und er legt Eier.`,
    ],
  },
  {
    id: 'tragen',
    title: 'Was eine Eule tragen kann',
    blocks: [
      'Nicht jede Eule trägt alles. Kleine Eulen schaffen nur ein kurzes Pergament, mittlere auch ein langes, und nur die kräftigen tragen außerdem Gold. Das gilt für deine eigenen Eulen, für Leiheulen und für Gast-Eulen, denen du eine Antwort mitgibst; die Eulen der Bots tragen alles.',
      [
        `Nur kurzes Pergament: ${SPECIES.filter((species) => species.cargo === 'short')
          .map((species) => species.name)
          .join(', ')}.`,
        `Kurzes und langes Pergament: ${SPECIES.filter((species) => species.cargo === 'long')
          .map((species) => species.name)
          .join(', ')}.`,
        `Kurzes und langes Pergament sowie Gold: ${SPECIES.filter(
          (species) => species.cargo === 'gold',
        )
          .map((species) => species.name)
          .join(', ')}.`,
      ],
      'Beim Briefschreiben kannst du eine Eule, die das gewählte Pergament nicht tragen kann, nicht auswählen – sie steht mit „Trägt kein langes Pergament“ in der Eulenwahl. Ein Begleitbrief ist immer ein kurzes Pergament. Eine Eule, die du verschenkst, trägt sich selbst – dafür gibt es keine Grenze.',
    ],
  },
  {
    id: 'verleih',
    title: 'Eulen an das Postamt verleihen',
    blocks: [
      `Im Eulenpostamt gibt es immer viel zu tun, und Aushilfen sind dort gern gesehen: Gesunde erwachsene Eulen, die zu Hause sind, kannst du mit dem Knopf „An das Postamt verleihen“ für ${OWL.MENAGERIE_DAYS} Tage dorthin schicken (nur den Phönix nicht). Danach bekommst du ${percent(GOLD.MENAGERIE_WAGE_SHARE)} des Artpreises als Lohn, und die Eule kommt mit voller Energie zurück. Währenddessen ist sie nicht verfügbar und wird nicht krank.`,
      'Jede Eule kann nur einmal im Kalenderquartal aushelfen (Januar bis März, April bis Juni, Juli bis September, Oktober bis Dezember). Danach erscheint der Knopf bei ihr erst im nächsten Quartal wieder.',
    ],
  },
  {
    id: 'krankheit',
    title: 'Krankheiten',
    blocks: [
      `Jede Nacht kann eine erwachsene Eule mit einer Wahrscheinlichkeit von 1 zu 30 krank werden – mit Pflegebonus (siehe Energie und Pflege) deutlich seltener. In den ersten ${OWL.SICKNESS_GRACE_DAYS} Tagen bei dir wird sie nie krank. Leiheulen, Küken, Bot-Eulen und der Phönix werden nie krank, Eulen inaktiver Konten und im Urlaubsmodus auch nicht.`,
      'Eine kranke Eule kommt sofort in die Rettungsstation (in der Übersicht mit dem Äskulapstab). Unter „Meine Eulen“ siehst du an ihrer Stelle eine leere Stange mit dem Hinweis, dass sie in der Rettungsstation ist. Fliegen kann sie erst wieder, wenn sie gesund ist.',
      'Wird eine Eule unterwegs krank, merkst du es, wenn sie heimkommt.',
    ],
  },
  {
    id: 'rettungsstation',
    title: 'Die Eulenrettungsstation',
    blocks: [
      'In der Übersicht findest du die Rettungsstation mit dem Äskulapstab. Zuerst stehst du vor dem Holztor – das Bild wechselt mit den Jahreszeiten an deinem Wohnort (Weihnachtszeit, Winter, Vorfrühling, Frühling, Sommer, Herbst und November) und mit Tag und Nacht. Mit „Eintreten“ gehst du hinein.',
      'Drinnen stehen oben deine eigenen kranken Eulen, darunter eine wilde kranke Eule, die jemanden braucht. Jede Eule hat einen Balken, der zeigt, wie weit sie schon wieder gesund ist – von 0 % bis 100 %. Jede Hilfe bewegt ihn sofort.',
      [
        'Wasser geben, Streicheln, Medizin geben, Füttern (Eulenkeks) und Lieblingsleckerli – jede dieser Hilfen geht einmal am Tag und zählt einmal am Tag. Was heute schon erledigt ist, verschwindet bis morgen aus den Knöpfen.',
        'Streicheln darfst du so oft du magst; es zählt trotzdem nur einmal am Tag.',
        `Wasser, Streicheln und Medizin kosten nichts; Eulenkeks (${gold(GOLD.FEED_PRICE)}) und Lieblingsleckerli (${gold(GOLD.SNACK_PRICE)}) kosten so viel wie immer – oder nichts, solange dein Beutel welche hat.`,
        'Wie viel Pflege eine Eule braucht, siehst du nur am Balken. Eigene Eulen sind meist nach einigen Tagen wieder fit, wilde brauchen länger – je größer und wertvoller die Art, desto mehr Pflege.',
      ],
      'Wird eine Eule gesund, während es bei dir dunkel ist, zeigt das Bild sie unter dem Nachthimmel. Ist deine eigene Eule wieder gesund, darf sie nach Hause und ist sofort wieder einsatzbereit. Pflegst du sie, wirken Wasser, Futter, Leckerli und Streicheln auch wie gewohnt auf Energie und Motivation.',
      'Ist eine wilde Eule gesund, findest du mit dem Knopf „Herausfinden, wohin … fliegt“ heraus, was sie tut: Manche fliegen dankbar zurück in die Freiheit, manche wollen sich nicht mehr von dir trennen und bleiben als Posteule bei dir. Hast du schon so viele Eulen, wie es Arten gibt, fliegt sie aber immer in die Freiheit. Danach rückt eine neue kranke Eule nach. Hast du aus der Zeit vor Version 1.3.1 noch mehrere wilde Eulen in Pflege, kommt eine neue erst, wenn alle versorgt sind. Den Phönix und den Virginiauhu triffst du hier nie als wilde Eule.',
    ],
  },
  {
    id: 'kueken',
    title: 'Eier und Küken',
    blocks: [
      `Weibliche Eulen legen nach einer Heimkehr manchmal Eier (etwa jedes hundertste Mal; der Phönix nie). Sie brüten dann ${OWL.BROODING_DAYS} Tage; danach schlüpfen ${OWL.CHICKS_MIN} bis ${OWL.CHICKS_MAX} Küken.`,
      [
        `Mit einem Partner zu Hause doppelt so oft: Wohnt bei dir auch ein Eulenmann derselben Art und waren beide an mindestens ${OWL.PAIR_MIN_DAYS} der letzten ${OWL.PAIR_WINDOW_DAYS} Tage mehr als ${OWL.PAIR_MIN_HOURS} Stunden gemeinsam einsatzbereit zu Hause (also nicht unterwegs, krank oder brütend).`,
        `Mit einem Besuch doppelt so oft: Hat sie auf ihrer Reise bei einem Empfänger mindestens ${OWL.VISIT_MIN_HOURS} Stunden gerastet, während dort ein Eulenmann ihrer Art einsatzbereit zu Hause war.`,
        'Gilt beides, ist es dreimal so wahrscheinlich wie sonst. Leiheulen, Küken und Bot-Eulen zählen nicht als Partner.',
      ],
      `Lass dir Zeit: Du benennst die Küken binnen ${OWL.CHICK_NAME_DEADLINE_HOURS / 24} Tagen, sonst bekommen sie Zufallsnamen. Bei ${OWL.CHICK_GIFT_FROM_COUNT} oder mehr Küken verschenkst du binnen ${OWL.CHICK_GIFT_DEADLINE_HOURS / 24} Tagen genau eines an einen Kontakt, gern mit Begleitbrief; einen Tag vorher erinnert dich eine Systemnachricht. Erst danach entscheidet das Los unter deinen aktiven Kontakten, die noch Platz für eine Eule haben. Hast du keine, darfst du alle behalten.`,
      `Hättest du mit den Küken mehr Eulen, als es Eulenarten gibt (${SPECIES.length}), musst du alle Küken dieses Geleges verschenken – eines nach dem anderen und nur an Kontakte, die selbst noch Platz haben. Was nach ${OWL.CHICK_GIFT_DEADLINE_HOURS / 24} Tagen noch nicht verschenkt ist, verteilt das Los; hat keiner deiner aktiven Kontakte Platz, bleiben die übrigen Küken bei dir.`,
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
        'Andere Bots: Figuren, die die Betreiberin oder der Betreiber deiner PostEulen-Instanz im Bots-Kontrollzentrum anlegt. Sie können überall auf der Welt wohnen und auch umziehen. Ein solcher Bot taucht bei dir erst auf, wenn sein erster Brief bei dir angekommen ist. Seine Briefe schreibt er zu festen Zeitpunkten an alle Spielerinnen und Spieler; manchmal hängen bis zu zwei Bilder daran – ein Tipp zeigt ein Bild fensterfüllend, ein weiterer Tipp, ein Klick oder die Escape-Taste schließt es –, manchmal bringt er Gold oder eine Eule mit.',
      ],
      'Jedem Bot kannst du einen Brief pro Kalendertag schreiben (der Tag wechselt um Mitternacht UTC); die App zeigt, ab wann wieder. Das gilt auch für den Erklärbär.',
      `Wie andere Bots antworten: Meist gehen sie in ihrem nächsten geplanten Brief auf deine Zeilen ein – der Brief bleibt derselbe, bekommt aber einen persönlichen Teil für dich. Haben sie in den nächsten vier Wochen nichts geplant, antworten sie dir nach etwa ${BOTS.REPLY_AFTER_HOURS} Stunden direkt.`,
      'Bots haben eigene Eulen oder schicken Leiheulen. Die Eule eines Bots wartet oft eine Weile bei dir („Zu Gast bei dir“ unter „Eulen“). Solange sie da ist, kannst du ihr eine Antwort mitgeben – dann fliegt sie sofort los. Ob du einem Bot auch mit deinen eigenen Eulen oder Leiheulen schreiben kannst, legt der Bot fest; der Chat sagt es dir. Manche Bots legen dir Eulenkekse oder Leckerlis in den Brief – sie kommen in deinen Beutel (siehe Energie und Pflege). Du kannst eine Bot-Eule tränken, streicheln und füttern wie jede Gast-Eule – bei ihr kostet das nichts, auch Eulenkeks und Leckerli nicht. Das gibt ihr Energie für den Heimweg und macht sie munterer, höchstens bis 120 % Motivation; ihre Motivation siehst du bei Bot-Eulen nicht.',
      de.bots.notice,
      'An OpenAI gehen nur die Texte, keine Namen und keine Kennungen. Jeder Bot merkt sich eine kurze Zusammenfassung eures Briefwechsels – nur deines; sie verschwindet, wenn du den Chat löschst.',
      'Einen Bot entfernst du in seinem Chat („… entfernen“). Alle auf einmal – auch den Erklärbär und alle Bots, die es künftig geben wird – entfernst du in den Einstellungen mit „Alle Bots entfernen“. Beides ist endgültig: Chat, Zusammenfassung und noch ausstehende Briefe und Geschenke sind dann weg, und die Bots schreiben dir nie wieder. Löscht die Betreiberin oder der Betreiber einen Bot, bekommst du eine Systemnachricht, falls du mit ihm Kontakt hattest.',
    ],
  },
  {
    id: 'benachrichtigungen',
    title: 'Benachrichtigungen',
    blocks: [
      'Benachrichtigungen sind die kleinen Hinweise, die oben auf dem Handy-Bildschirm auftauchen. PostEulen kann dir so Bescheid sagen, wenn eine Eule mit einem Brief landet (rastet sie danach bei dir, sagt eine einzige Nachricht beides), eine deiner Eulen heimkommt, Gold ankommt, ein Geschenk eintrifft, Eier gelegt werden, Küken schlüpfen, eine deiner Eulen krank wird, ein neuer Kontakt mit dir verbunden ist, die automatische Löschung droht, der Admin allen schreibt oder die Eulen alle fünf Wochen um eine kleine Spende bitten. Andere Systemnachrichten kommen ohne Benachrichtigung. Benachrichtigungen enthalten nie Namen oder Inhalte – wer dir über die Schulter schaut, erfährt nichts.',
      'Tippst du auf eine Benachrichtigung, öffnet PostEulen gleich die passende Seite: bei Briefen den Briefwechsel, bei Eulen-Neuigkeiten deine Eulen, bei einem neuen Kontakt das Adressbuch und sonst die Systemnachrichten. Kommt eine Benachrichtigung einmal nicht durch, weil der Benachrichtigungsdienst deines Handys gerade nicht erreichbar ist, versucht PostEulen es mit wachsenden Abständen noch ein paarmal – höchstens einen Tag lang.',
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
        'Abmelden (ganz oben, oder mit dem Ein-/Aus-Knopf ganz rechts in der Leiste oben – mit Rückfrage): entfernt alle Schlüssel von diesem Gerät, und PostEulen vergisst alles über dein Konto, was es sich in diesem Fenster gemerkt hat.',
        `Gold und Buchungen: dein Goldstand, wann und wie viel tägliches Gold du bekommst, und die letzten ${GOLD.TRANSACTIONS_KEPT} Buchungen.`,
        `Nutzername ändern: einmal pro Kalenderjahr. Dein aktueller Name steht gleich dabei. Deine Kontakte erfahren es per Systemnachricht; der alte Name ist ${ACCOUNT.NAME_LOCK_DAYS} Tage gesperrt.`,
        `Wohnort ändern: bis zu ${ACCOUNT.HOME_CHANGES_PER_MONTH}-mal pro Kalendermonat, egal wie kurz hintereinander. Eulen unterwegs passen ihren Kurs an.`,
        'Passwort ändern: altes Passwort einmal, neues zweimal. Alle Briefe bleiben lesbar.',
        'Sprache: Deutsch oder Englisch, für dieses Konto auf jedem Gerät.',
        'Briefe: eigene Briefe und Systemnachrichten nach 30, 90, 180 Tagen oder einem Jahr löschen lassen (neue Konten: 180 Tage; gelöscht wird beim nächsten wöchentlichen Aufräumen am Montag); Briefe in Druckschrift statt Handschrift anzeigen; mit dem Regler „Links in Briefen anklickbar“ bestimmst du, ob Links in Briefen angetippt werden können (Standard: an). Mit dem Regler „ASCII-Modus“ bekommst du beim Schreiben an einen Menschen eine zusätzliche Möglichkeit: Dieser eine Brief erscheint dann für euch beide dauerhaft in schlichter Schreibmaschinenschrift – ideal für Bilder aus Buchstaben und Zeichen (ASCII-Art). Du wählst das bei jedem Brief neu; sonst bleibt es bei der Handschrift, und am Briefpapier ändert sich nichts.',
        'Benachrichtigungen (gleich unter „Abmelden“): Status ansehen und testen.',
        'Urlaubsmodus (unter den Benachrichtigungen): bis zu dreimal im Jahr eine Pause von bis zu sechs Wochen, in der deine Eulen bestens versorgt sind – siehe „Urlaubsmodus“.',
        'Statistik (unter dem Urlaubsmodus): wie viele Briefe du verschickt und bekommen hast, seit wie vielen Tagen es dein Konto gibt, an wie vielen Tagen du aktiv warst (auch in Prozent), wie viele Kilometer deine Eulen und Leiheulen zwischen Menschen geflogen sind und wie oft du Eulen Wasser, Streicheleinheiten, Kekse, Leckerli und Medizin gegeben hast. Einige Werte zählen erst seit Version 1.3; Älteres ist enthalten, soweit es noch gespeichert war.',
        'Bots: „Alle Bots entfernen“ nimmt den Erklärbär und alle anderen Bots endgültig aus deinem Spiel – mit ihren Chats, auch Bots, die es erst später gibt. Das lässt sich nicht rückgängig machen.',
        `Nachricht an den Admin (ganz unten): Bei technischen Problemen oder Verbesserungsvorschlägen schickst du dem Admin deiner PostEulen-Instanz eine kurze Nachricht – höchstens ${FEEDBACK.MAX_CHARS} Zeichen, eine pro Tag (der Tag wechselt um Mitternacht UTC). Sie ist nicht verschlüsselt, liegt ohne deinen Namen lesbar auf dem Server und wird nach ${FEEDBACK.RETENTION_DAYS} Tagen gelöscht. Schreib also nichts Vertrauliches hinein. Sie ist übrigens das Einzige, was das Adminpanel im Klartext zeigt. Darunter, ganz am Ende, geht es zu dieser Hilfe.`,
        `Gutschein einlösen: Hast du von der Betreiberin oder dem Betreiber deiner PostEulen-Instanz einen Gutschein bekommen, tippst du hier den Code ein. Ein Gutschein bringt Gold, eine neue Eule oder Eulenkekse bzw. Leckerlis für deinen Beutel, gilt ${VOUCHER.VALID_DAYS} Tage und lässt sich einmal einlösen.`,
        `Konto löschen: mit Passwort bestätigen. Meldest du dich binnen ${ACCOUNT.SELF_DELETE_GRACE_HOURS} Stunden wieder an, wird die Löschung abgebrochen. Danach wird alles endgültig gelöscht; was andere schon von dir bekommen haben, bleibt bei ihnen.`,
      ],
    ],
  },
  {
    id: 'urlaub',
    title: 'Urlaubsmodus: Pause ohne Nachteile',
    blocks: [
      'Du fährst in den Urlaub, hast Ferien oder steckst mitten in einer Prüfungsphase und möchtest dich eine Weile nicht anmelden? Dann schalte in den Einstellungen den Urlaubsmodus ein. Deine Eulen fliegen in die Eulenpflegestation auf der kleinen Insel Inchlonaig im Loch Lomond in Schottland und werden dort bestens versorgt – du musst dich um nichts kümmern und hast keinerlei Nachteile.',
      [
        `Bis zu ${VACATION.PER_YEAR}-mal im Kalenderjahr, jeweils mindestens einen Tag und höchstens ${VACATION.MAX_DAYS / 7} Wochen.`,
        'Du beginnst den Urlaub sofort oder legst Beginn und Ende bis zu drei Monate im Voraus fest. Einen geplanten Urlaub kannst du absagen, bevor er beginnt – dann zählt er nicht mit.',
        'Alle deine Eulen fliegen mit, auch die Küken. Eulen, die gerade unterwegs, krank, brütend oder im Postamt sind, kommen nach, sobald sie zu Hause und frei sind. Auf der Karte siehst du sie hinfliegen, auf der Insel rasten und heimfliegen.',
        'Sie fliegen auf direktem Weg und machen sich so rechtzeitig auf den Rückweg, dass alle genau zum Urlaubsende zu Hause sind – ausgeruht und mit voller Energie. Ist die Insel für einen kurzen Urlaub zu weit weg, kehren sie unterwegs rechtzeitig um.',
        'Während des Urlaubs wirst du nicht inaktiv, deine Eulen werden nicht krank, langweilen sich nicht und verlieren keine Motivation, und das tägliche Gold bekommst du weiter.',
        'Du kannst trotzdem alles machen, wofür du keine eigene Eule brauchst – zum Beispiel Briefe lesen, im Postamt Eulen leihen und mit ihnen schreiben.',
        'Vorzeitig beenden geht jederzeit in den Einstellungen; deine Eulen machen sich dann sofort auf den Heimweg. Der Urlaub zählt trotzdem mit.',
      ],
      'Solange der Urlaubsmodus läuft, erinnert dich oben in der App ein Hinweis daran, bis wann.',
    ],
  },
  {
    id: 'inaktiv',
    title: 'Inaktivität und automatische Löschung',
    blocks: [
      `Warst du über ${ACCOUNT.INACTIVE_AFTER_DAYS} Tage nicht in der App, gilt dein Konto als inaktiv: Kontakte sehen „inaktiv“ und können dir nichts schicken, du bekommst kein tägliches Gold, und deine Eulen werden nicht krank. Briefe der Bots und Lieferungen, die schon unterwegs sind, kommen trotzdem an. Sobald du die App öffnest, bist du wieder aktiv. Im Urlaubsmodus zählen die Tage nicht mit (siehe „Urlaubsmodus“).`,
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
    question:
      'Ich fahre in den Urlaub oder habe Prüfungen. Muss ich mich trotzdem um meine Eulen kümmern?',
    answer:
      'Nein. Schalte in den Einstellungen den Urlaubsmodus ein – bis zu dreimal im Jahr für bis zu sechs Wochen. Deine Eulen erholen sich dann in der Eulenpflegestation auf der Insel Inchlonaig und sind pünktlich zum Ende wieder zu Hause. Du wirst nicht inaktiv, und deine Eulen werden weder krank noch gelangweilt. Du musst dich in der Zeit nicht anmelden.',
  },
  {
    question: 'Was kostet PostEulen?',
    answer: `Nichts. PostEulen ist kostenlos, ohne Werbung und ohne Bezahlschranke – und das bleibt so. Es gibt keine In-App-Käufe und auch sonst keine Möglichkeit, in PostEulen echtes Geld auszugeben: Gold, die Spielwährung, bekommt jeder jeden Tag automatisch. Server und Entwicklung kosten trotzdem Geld. PostEulen ist ein Hobbyprojekt: Derzeit kosten Domain und Server etwa 10 € im Monat und die KI-Dienste, die bei der Entwicklung und im Betrieb helfen, rund 30 € im Monat – dazu kommt die Zeit für die Weiterentwicklung, und mit vielen Nutzern steigen die Kosten deutlich. Deshalb bitten wir alle fünf Wochen freundlich um eine freiwillige Spende über ${DONATION.URL.replace('https://', '')}; den Link findest du auch auf der Startseite in der Linkleiste unter „Spenden“ – im Spiel bringt eine Spende nichts. Niemand muss etwas geben, aber jede Spende hilft, PostEulen online und für alle frei zugänglich zu halten. Reichen die Spenden irgendwann nicht mehr, schalten wir die Registrierung neuer Konten ab; ein neues Konto gibt es dann nur noch mit Einladungscode. Bestehende Konten sind davon nicht betroffen.`,
  },
  {
    question: 'Kann ich PostEulen über Tor benutzen?',
    answer:
      'Ja. Unten auf der Startseite führt der Link „Tor-Netz“ zur Onion-Adresse von PostEulen; öffne ihn im Tor Browser (Sicherheitsstufe „Standard“). Dort meldest du dich mit deinem gewohnten Konto an. Fehlt der Link, ist der Tor-Zugang gerade abgeschaltet.',
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
    answer: `Jeden Tag gibt es Gold, solange du aktiv bist: in den ersten ${GOLD.DAILY_HIGH_DAYS} Tagen ${gold(GOLD.DAILY)}, danach ${gold(GOLD.DAILY_LATER)}. Briefe sind kostenlos; nur Eulen, Leihen, Eulenkeks und Lieblingsleckerli kosten Gold – Kekse und Leckerlis aus deinem Beutel nicht.`,
  },
  {
    question: 'Warum ist meine Eule diesmal langsamer (oder schneller) als sonst?',
    answer:
      'Das macht die Motivation: Sie sinkt jede Nacht ein wenig und steigt, wenn du deiner Eule Wasser gibst, sie streichelst, ihr einen Eulenkeks oder ihr Lieblingsleckerli gibst – jede Art einmal am Tag (öfter füttern gibt Energie, aber keine Motivation mehr). Sie gilt für die nächste Strecke: beim Abflug von zu Hause und jedes Mal neu, wenn die Eule bei einem Empfänger weiterfliegt. Mit 120 % fliegt die Eule 20 % schneller und weiter, mit 80 % entsprechend langsamer.',
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
    answer: `Dem Admin deiner PostEulen-Instanz: Ganz unten in den Einstellungen steht „Nachricht an den Admin“. Dort schreibst du bis zu ${FEEDBACK.MAX_CHARS} Zeichen, eine Nachricht pro Tag. Sie ist nicht verschlüsselt und kommt ohne deinen Namen an – möchtest du eine Antwort, sag in der Nachricht, wie man dich erreicht. Für Fragen zur Bedienung hilft dir auch der Erklärbär.`,
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
