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

Unten findest du die wichtigsten Bereiche: Briefwechsel, Eulen, Adressbuch und Karte. Du startest mit 3 Gold. Eine eigene Eule kostet ab 6 Gold, aber in deinen ersten 30 Tagen gibt es jeden Tag 3 Gold dazu, danach 2 Gold. Bis dahin leihst du dir für 0,1 Gold eine Leiheule – in der Menagerie oder direkt beim Briefschreiben.

Wichtig: Alle Briefe werden spätestens ein Jahr nach der Zustellung automatisch und unwiderruflich gelöscht, auch dieser hier. In den Einstellungen kannst du deine Briefe auch schon früher löschen lassen.

Fragen zu PostEulen? Schreib mir einfach – du findest mich im Briefwechsel! Sobald du mir geschrieben hast, findest du mich auch auf deiner Karte.`,
  day1: `Hallo, heute verrate ich dir einen kleinen Zaubertrick!

PostEulen gibt es in keinem App-Store – und trotzdem kannst du es wie eine App auf dein Handy holen. Du legst es einfach auf deinen Startbildschirm:

Android mit Chrome: oben rechts auf die drei Punkte tippen, dann „Zum Startbildschirm hinzufügen“ oder „App installieren“.

iPhone mit Safari: auf das Teilen-Symbol tippen (Quadrat mit Pfeil, bei neueren iPhones hinter den drei Punkten unten rechts), dann „Zum Home-Bildschirm“.

Danach wohnt eine Eule auf deinem Startbildschirm, und Benachrichtigungen klappen auch. Mit anderen Browsern geht es als Lesezeichen, nur ohne Benachrichtigungen. Ein echter Briefkasten klingelt ja auch nicht.

Dein Erklärbär`,
  day3: `Hallo, heute geht es um Eulen!

Jede Eule hat Energie. Nachts braucht sie 1 Punkt pro Kilometer, tagsüber 1,5. Ist sie leer, schläft sie und erholt sich dabei wie zu Hause – aber nur so lange, bis die Kraft fürs nächste Ziel reicht. Über Wasser fliegt sie weiter, bis sie Land findet.

Zu Hause erholt sie sich von selbst. Beim Schreiben wählst du, wie lange sie bei jedem Empfänger rastet – dann kann sie dir gleich eine Antwort mitbringen. Ist eine Eule bereit, schickst du sie in der Eulenübersicht auch direkt mit „Brief schreiben“ los. Auf der Karte siehst du, wo deine Eulen gerade sind und wo es Nacht ist.

Bis bald, dein Erklärbär`,
  day2: `Hallo, heute geht es ums Gold!

In der Finanzübersicht siehst du deinen Goldstand und die letzten Buchungen. Gold kannst du per Eule an Kontakte schicken.

In der Menagerie kaufst du eigene Eulen oder leihst dir eine. Jeden Tag gibt es dort vier neue Leiheulen, eigens für dich ausgewürfelt, und jede davon kannst du an diesem Tag einmal leihen. Hast du eine Eule übrig, kannst du sie für 7 Tage an die Menagerie verleihen und bekommst danach 10 % ihres Preises.

Übrigens: Mit dem kleinen Fähnchen oben rechts schaltest du PostEulen auf Englisch um und wieder zurück. Klemmt etwas, oder hast du eine Idee? Ganz unten in den Einstellungen schickst du dem Admin eine kurze Nachricht.

Viel Spaß beim Sparen, dein Erklärbär`,
  day4: `Hallo, heute geht es um Kontakte!

Füge Freunde im Adressbuch hinzu, indem ihr euch gegenseitig mit dem genauen Namen eintragt. Erst dann könnt ihr euch schreiben.

Deine Briefe an Menschen sind Ende-zu-Ende-verschlüsselt: Nur ihr beide könnt sie lesen. Das ist kein Spiel, sondern echte, moderne Kryptografie – PostEulen taugt also auch für Vertrauliches. Vergleicht am besten einmal die Sicherheitsnummer, zum Beispiel beim nächsten Treffen.

Steht neben einem Link „Ungewöhnliche Zeichen in der Adresse“, schau genau hin: Manche Buchstaben aus fremden Alphabeten sehen aus wie unsere.

Briefe an Bots wie mich sind übrigens nicht verschlüsselt. Und denk daran: Nach spätestens einem Jahr verschwinden alle Briefe von selbst.

Dein Erklärbär`,
  day7: `Hallo, heute geht es um Pflege!

Gib deinen Eulen Wasser, streichle sie, gönn ihnen einen Eulenkeks oder ihr Lieblingsleckerli. Das hebt ihre Motivation, und mit Motivation fliegen sie die nächste Strecke schneller und weiter – auch fremde Eulen, die bei dir rasten. Bekommt eine Eule an 10 der letzten 14 Tage zu Hause zwei verschiedene Arten von Pflege, wird sie viel seltener krank. Reisetage zählen dabei nicht. Ist eine Eule krank, pflegst du sie selbst gesund oder bringst sie zum Eulenarzt.

Manchmal legt eine Eule Eier. Bei zwei oder drei Küken verschenkst du eines an einen Kontakt – dafür und für die Namen hast du fünf Tage Zeit.

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
export function botLetters(language: 'de' | 'en'): BotLetters {
  return language === 'en' ? BOT_LETTERS_EN : GERMAN;
}
