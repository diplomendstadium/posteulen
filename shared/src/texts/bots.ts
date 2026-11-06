/**
 * Fixed letters of the bots (SPEC 10.2–10.4): small parchment (at most 500 characters), short,
 * friendly, simple. They contain no names of the user on purpose – the bot chats are sent to
 * OpenAI as context, and requests must not carry names (SPEC 10.5).
 * Placeholders: {aunt}, {uncle} (first names of the bots).
 */
export const BOT_TITLES = {
  explainer: 'Erklärbär',
  aunt: 'Tante {name}',
  uncle: 'Onkel {name}',
} as const;

export const EXPLAINER_LETTERS = {
  day0: `Hallo und willkommen bei PostEulen!

Ich bin der Erklärbär und schreibe dir in den nächsten Tagen ein paar kurze Briefe.

Unten findest du die wichtigsten Bereiche: Briefwechsel, Eulen, Adressbuch und Karte. Du startest mit 3 Gold. Eine eigene Eule kostet ab 6 Gold, aber jeden Tag gibt es 1 Gold dazu. Bis dahin leihst du dir in der Menagerie für 0,1 Gold eine Leiheule.

Fragen zu PostEulen? Schreib mir einfach!`,
  day1: `Hallo, heute geht es um Eulen!

Jede Eule hat Energie. Nachts braucht sie 1 Punkt pro Kilometer, tagsüber 1,5. Ist sie leer, schläft sie 10 Stunden und fliegt dann ausgeruht weiter. Über Wasser fliegt sie weiter, bis sie Land findet.

Zu Hause erholt sie sich von selbst. Auf der Karte siehst du, wo deine Eulen gerade sind und wo es Nacht ist.

Bis bald, dein Erklärbär`,
  day2: `Hallo, heute geht es ums Gold!

In der Finanzübersicht siehst du deinen Goldstand und die letzten Buchungen. Gold kannst du per Eule an Kontakte schicken.

In der Menagerie kaufst du eigene Eulen oder leihst dir eine. Hast du eine Eule übrig, kannst du sie für 7 Tage an die Papeterie verleihen und bekommst danach 10 % ihres Preises.

Viel Spaß beim Sparen, dein Erklärbär`,
  day4: `Hallo, heute geht es um Kontakte!

Füge Freunde im Adressbuch hinzu, indem ihr euch gegenseitig mit dem genauen Namen eintragt. Erst dann könnt ihr euch schreiben.

Deine Briefe an Menschen sind Ende-zu-Ende-verschlüsselt: Nur ihr beide könnt sie lesen. Vergleicht am besten einmal die Sicherheitsnummer, zum Beispiel beim nächsten Treffen.

Briefe an Bots wie mich sind übrigens nicht verschlüsselt.

Dein Erklärbär`,
  day7: `Hallo, heute geht es um Pflege!

Streichle und füttere deine Eulen ab und zu. Gut gepflegte Eulen werden seltener krank. Ist eine Eule krank, pflegst du sie selbst gesund oder bringst sie zum Eulenarzt.

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
