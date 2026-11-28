/**
 * Fixed letters of the Erklärbär (SPEC 10.2): small parchment (at most 800 characters), short,
 * friendly, simple. They contain no names of the user on purpose – the bot chats are sent to
 * OpenAI as context, and requests must not carry names (SPEC 10.5).
 * v0.4: the English letters live in bots-en.ts; `botLetters()` picks by language.
 */
import { BOT_LETTERS_EN } from './bots-en.ts';

export const BOT_TITLES = {
  explainer: 'Erklärbär',
} as const;

export const EXPLAINER_LETTERS = {
  day0: `Hallo und willkommen bei PostEulen!

Ich bin der Erklärbär und schreibe dir in den nächsten Tagen ein paar kurze Briefe.

Unten findest du die wichtigsten Bereiche: Briefwechsel, Eulen, Adressbuch und Karte. Du startest mit 3 Gold. Eine eigene Eule kostet ab 6 Gold, aber in deinen ersten 30 Tagen gibt es jeden Tag 3 Gold dazu, danach 2 Gold. Bis dahin leihst du dir eine Leiheule – im Postamt oder direkt beim Briefschreiben.

Wichtig: Deine Briefe werden 180 Tage nach der Zustellung automatisch und unwiderruflich gelöscht, auch dieser hier. In den Einstellungen wählst du 30, 90, 180 Tage oder ein Jahr.

Fragen zu PostEulen? Schreib mir einfach – du findest mich im Briefwechsel! Sobald du mir geschrieben hast, findest du mich auch auf deiner Karte.`,
  day1: `Hallo, heute verrate ich dir einen kleinen Zaubertrick!

PostEulen gibt es in keinem App-Store – und trotzdem kannst du es wie eine App auf dein Handy holen. Du legst es einfach auf deinen Startbildschirm:

Android mit Chrome: oben rechts auf die drei Punkte tippen, dann „Zum Startbildschirm hinzufügen“ oder „App installieren“.

iPhone mit Safari: auf das Teilen-Symbol tippen (Quadrat mit Pfeil, bei neueren iPhones hinter den drei Punkten unten rechts), dann „Zum Home-Bildschirm“.

Danach wohnt eine Eule auf deinem Startbildschirm, und Benachrichtigungen klappen auch. Mit anderen Browsern geht es als Lesezeichen, nur ohne Benachrichtigungen. Ein echter Briefkasten klingelt ja auch nicht.

Dein Erklärbär`,
  day3: `Hallo, heute geht es um Eulen!

Jede Eule hat Energie. Nachts braucht sie 1 Punkt pro Kilometer, tagsüber 1,5. Ist sie leer, schläft sie und erholt sich dabei wie zu Hause – aber nur so lange, bis die Kraft fürs nächste Ziel reicht. Über Wasser fliegt sie weiter, bis sie Land findet.

Zu Hause erholt sie sich von selbst. Beim Schreiben wählst du, wie lange sie bei jedem Empfänger rastet – dann kann sie dir gleich eine Antwort mitbringen. Ist eine Eule bereit, schickst du sie in der Eulenübersicht auch direkt mit „Brief schreiben“ los. Unterwegs verrät dir jede Eule ihren nächsten Halt mit Uhrzeit, und auf der Karte – sie sieht aus wie ein alter Atlas – siehst du, wo sie gerade ist.

Bis bald, dein Erklärbär`,
  day2: `Hallo, heute geht es ums Gold!

Dein Gold siehst du oben rechts, die Buchungen in den Einstellungen. Eulen, die Gold tragen können, haben in der Eulenübersicht den Knopf „Gold verschicken“.

In der Menagerie kaufst du Eulen, im Postamt hat jeden Tag eines von vier Eulenteams Dienst, eigens für dich ausgelost – tritt ein und leih dir seine Eulen. Kleine Eulen tragen nur kurzes Pergament, nur kräftige auch Gold. Eine Eule, die du übrig hast, kannst du für 7 Tage an das Postamt verleihen und bekommst danach 10 % ihres Preises.

Übrigens: Mit dem kleinen Fähnchen oben rechts schaltest du PostEulen auf Englisch um und wieder zurück. Klemmt etwas, oder hast du eine Idee? Ganz unten in den Einstellungen schickst du dem Admin eine kurze Nachricht.

Viel Spaß beim Sparen, dein Erklärbär`,
  day4: `Hallo, heute geht es um Kontakte!

Füge Freunde im Adressbuch hinzu, indem ihr euch gegenseitig mit dem genauen Namen eintragt. Erst dann könnt ihr euch schreiben.

Deine Briefe an Menschen sind Ende-zu-Ende-verschlüsselt: Nur ihr beide könnt sie lesen. Das ist kein Spiel, sondern echte, moderne Kryptografie – PostEulen taugt also auch für Vertrauliches. Vergleicht am besten einmal die Sicherheitsnummer, zum Beispiel beim nächsten Treffen.

Steht neben einem Link „Ungewöhnliche Zeichen in der Adresse“, schau genau hin: Manche Buchstaben aus fremden Alphabeten sehen aus wie unsere.

Briefe an Bots wie mich sind übrigens nicht verschlüsselt. Im Advent und an Weihnachten schreibst du auf Weihnachtspergament. Und nach spätestens einem Jahr verschwinden alle Briefe von selbst.

Dein Erklärbär`,
  day7: `Hallo, heute geht es um Pflege!

Gib deinen Eulen Wasser, streichle sie, gönn ihnen einen Eulenkeks oder ihr Lieblingsleckerli. Das hebt ihre Motivation, und motiviert fliegen sie schneller und weiter – auch fremde Eulen, die bei dir rasten. Bekommt eine Eule an 10 der letzten 14 Tage zu Hause zwei verschiedene Arten von Pflege, wird sie viel seltener krank. Wird eine Eule krank, pflegst du sie in der Rettungsstation wieder gesund.

Manchmal legt eine Eule Eier. Küken bekommen einmal am Tag einen Mehlwurm. Bei zwei oder drei Küken musst du eines an einen Kontakt verschenken – sonst entscheidet nach fünf Tagen das Los.

Schick deine Eulen oft zu Menschen, sonst langweilen sie sich.

Das war mein letzter Brief der Reihe. Fragen beantworte ich gern!

Dein Erklärbär`,
} as const;

export type BotLetters = {
  readonly titles: Readonly<Record<'explainer', string>>;
  readonly explainer: Readonly<Record<keyof typeof EXPLAINER_LETTERS, string>>;
};

const GERMAN: BotLetters = {
  titles: BOT_TITLES,
  explainer: EXPLAINER_LETTERS,
};

/** Fixed letters and titles in the language of the account (v0.4). */
export function botLetters(language: 'de' | 'en', torOnly = false): BotLetters {
  const letters = language === 'en' ? BOT_LETTERS_EN : GERMAN;
  return torOnly ? withoutNotifications(letters) : letters;
}

/** v1.4.2: the sentences about notifications in the Erklärbär's letters (SPEC 16.6). */
export const NOTIFICATION_SENTENCES: readonly (readonly [string, string])[] = [
  [
    'Danach wohnt eine Eule auf deinem Startbildschirm, und Benachrichtigungen klappen auch. Mit anderen Browsern geht es als Lesezeichen, nur ohne Benachrichtigungen. Ein echter Briefkasten klingelt ja auch nicht.',
    'Danach wohnt eine Eule auf deinem Startbildschirm. Mit anderen Browsern geht es als Lesezeichen.',
  ],
  [
    'After that an owl lives on your home screen, and notifications work too. With other browsers it works as a bookmark, just without notifications. A real letterbox does not ring either.',
    'After that an owl lives on your home screen. With other browsers it works as a bookmark.',
  ],
];

/** The letters of a Tor-only instance: there are no notifications there. */
function withoutNotifications(letters: BotLetters): BotLetters {
  const strip = (text: string): string =>
    NOTIFICATION_SENTENCES.reduce((result, [from, to]) => result.split(from).join(to), text);
  return {
    ...letters,
    explainer: Object.fromEntries(
      Object.entries(letters.explainer).map(([key, text]) => [key, strip(text)]),
    ) as BotLetters['explainer'],
  };
}
