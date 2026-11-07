/**
 * Fixed letters of the bots (SPEC 10.2–10.4): small parchment (at most 800 characters), short,
 * friendly, simple. They contain no names of the user on purpose – the bot chats are sent to
 * OpenAI as context, and requests must not carry names (SPEC 10.5).
 * Placeholders: {aunt}, {uncle} (first names of the bots).
 * v0.4: the English letters live in bots-en.ts; `botLetters()` picks by language.
 */
import { BOT_LETTERS_EN } from './bots-en.ts';

export const BOT_TITLES = {
  explainer: 'Erklärbär',
  aunt: 'Tante {name}',
  uncle: 'Onkel {name}',
} as const;

export const EXPLAINER_LETTERS = {
  day0: `Hallo und willkommen bei PostEulen!

Ich bin der Erklärbär und schreibe dir in den nächsten Tagen ein paar kurze Briefe.

Unten findest du die wichtigsten Bereiche: Briefwechsel, Eulen, Adressbuch und Karte. Du startest mit 3 Gold. Eine eigene Eule kostet ab 6 Gold, aber in deinen ersten 30 Tagen gibt es jeden Tag 3 Gold dazu, danach 2 Gold. Bis dahin leihst du dir für 0,1 Gold eine Leiheule – in der Menagerie oder direkt beim Briefschreiben.

Wichtig: Alle Briefe werden spätestens ein Jahr nach der Zustellung automatisch und unwiderruflich gelöscht, auch dieser hier. In den Einstellungen kannst du deine Briefe auch schon früher löschen lassen.

Fragen zu PostEulen? Schreib mir einfach! Sobald du mir geschrieben hast, findest du mich auch auf deiner Karte.`,
  day1: `Hallo, heute verrate ich dir einen kleinen Zaubertrick!

PostEulen gibt es in keinem App-Store – und trotzdem kannst du es wie eine App auf dein Handy holen. Du legst es einfach auf deinen Startbildschirm:

Android mit Chrome: oben rechts auf die drei Punkte tippen, dann „Zum Startbildschirm hinzufügen“ oder „App installieren“.

iPhone mit Safari: auf das Teilen-Symbol tippen (Quadrat mit Pfeil, bei neueren iPhones hinter den drei Punkten unten rechts), dann „Zum Home-Bildschirm“.

Danach wohnt eine Eule auf deinem Startbildschirm, und Benachrichtigungen klappen auch. Mit anderen Browsern geht es als Lesezeichen, nur ohne Benachrichtigungen. Ein echter Briefkasten klingelt ja auch nicht.

Dein Erklärbär`,
  day3: `Hallo, heute geht es um Eulen!

Jede Eule hat Energie. Nachts braucht sie 1 Punkt pro Kilometer, tagsüber 1,5. Ist sie leer, schläft sie 10 Stunden und fliegt dann ausgeruht weiter. Über Wasser fliegt sie weiter, bis sie Land findet.

Zu Hause erholt sie sich von selbst. Auf der Karte siehst du, wo deine Eulen gerade sind, welchen Weg sie schon geflogen sind und wo es Nacht ist. Ein „Zzz“ zeigt, wo eine Eule übernachtet hat.

Bis bald, dein Erklärbär`,
  day2: `Hallo, heute geht es ums Gold!

In der Finanzübersicht siehst du deinen Goldstand und die letzten Buchungen. Gold kannst du per Eule an Kontakte schicken.

In der Menagerie kaufst du eigene Eulen oder leihst dir eine. Jeden Tag gibt es dort drei neue Leiheulen, und jede davon kannst du an diesem Tag einmal leihen. Hast du eine Eule übrig, kannst du sie für 7 Tage an die Menagerie verleihen und bekommst danach 10 % ihres Preises.

Übrigens: Mit dem kleinen Fähnchen oben rechts schaltest du PostEulen auf Englisch um und wieder zurück.

Viel Spaß beim Sparen, dein Erklärbär`,
  day4: `Hallo, heute geht es um Kontakte!

Füge Freunde im Adressbuch hinzu, indem ihr euch gegenseitig mit dem genauen Namen eintragt. Erst dann könnt ihr euch schreiben.

Deine Briefe an Menschen sind Ende-zu-Ende-verschlüsselt: Nur ihr beide könnt sie lesen. Das ist kein Spiel, sondern echte, moderne Kryptografie – PostEulen taugt also auch für Vertrauliches. Vergleicht am besten einmal die Sicherheitsnummer, zum Beispiel beim nächsten Treffen.

Briefe an Bots wie mich sind übrigens nicht verschlüsselt. Und denk daran: Nach spätestens einem Jahr verschwinden alle Briefe von selbst.

Dein Erklärbär`,
  day7: `Hallo, heute geht es um Pflege!

Streichle und füttere deine Eulen ab und zu. Wurde eine Eule an 10 der letzten 14 Tage, an denen sie zu Hause war, umsorgt, wird sie viel seltener krank. Reisetage zählen dabei nicht. Ist eine Eule krank, pflegst du sie selbst gesund oder bringst sie zum Eulenarzt.

Manchmal legt eine Eule Eier. Bei zwei oder drei Küken verschenkst du eines an einen Kontakt.

Das war mein letzter Brief der Reihe. Fragen beantworte ich gern!

Dein Erklärbär`,
} as const;

export const AUNT_LETTERS = {
  welcome: `Hallo, mein Herzchen!

Hier schreibt dir deine Tante {aunt}. Wir sind entfernt verwandt, über ein paar Ecken und einen alten Zauberkessel.

In meinem Häuschen ist es oft still, und ehrlich gesagt langweile ich mich ein wenig. Wenn du jemanden zum Plaudern suchst: Schreib mir! Ich antworte gern.

Herzlich, deine Tante {aunt}`,
  gold: `Hallo, mein Herzchen!

Ich habe gehört, dass du bald deine erste eigene Eule kaufen möchtest. Dafür lege ich dir 4 Gold bei. Ich hoffe, es hilft dir ein bisschen.

Pass gut auf deine Eule auf, und erzähl mir, wie sie heißt!

Deine Tante {aunt}`,
} as const;

export const UNCLE_LETTERS = {
  first: `Na, du!

Hier ist dein Onkel {uncle}. Ja, genau der! Wir haben uns ewig nicht gesehen, was vermutlich an mir liegt.

Ich habe gerade sehr viel Zeit und noch mehr Ideen. Wenn du Lust hast, schreib mir. Ich verspreche, meistens zu antworten.

Dein Onkel {uncle}`,
  gold: `Na, du!

Stell dir vor: Ein Großonkel dritten Grades hat mir etwas vererbt. Leider war es kein Schloss, sondern ein Sack Gold und eine sehr beleidigte Ziege.

Die Ziege behalte ich. Vom Gold bekommt die ganze Familie etwas ab, du also 10 Gold. Gib es weise aus. Oder unvernünftig, Hauptsache mit Freude!

Dein Onkel {uncle}`,
} as const;

export type BotLetters = {
  readonly titles: Readonly<Record<'explainer' | 'aunt' | 'uncle', string>>;
  readonly explainer: Readonly<Record<keyof typeof EXPLAINER_LETTERS, string>>;
  readonly aunt: Readonly<Record<keyof typeof AUNT_LETTERS, string>>;
  readonly uncle: Readonly<Record<keyof typeof UNCLE_LETTERS, string>>;
};

const GERMAN: BotLetters = {
  titles: BOT_TITLES,
  explainer: EXPLAINER_LETTERS,
  aunt: AUNT_LETTERS,
  uncle: UNCLE_LETTERS,
};

/** Fixed letters and titles in the language of the account (v0.4). */
export function botLetters(language: 'de' | 'en'): BotLetters {
  return language === 'en' ? BOT_LETTERS_EN : GERMAN;
}
