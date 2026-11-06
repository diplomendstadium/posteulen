/**
 * Longer system messages of PostEulen itself (v0.3): the request for donations every five
 * weeks and the notes after an update. Paragraphs are separate strings; a paragraph starting
 * with "• " is a list item. "{link}" marks where the donation link goes.
 *
 * Rule for every new version (PROMPT.md): add an entry to UPDATE_NOTES – written for people
 * without any technical knowledge, with a wink and a touch of wizardry and owl keeping, but
 * accurate and not over the top. No technical details.
 */

export interface LongMessage {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

/** Three requests, sent in turn (DONATION.TEXTS). */
export const DONATION_TEXTS: readonly LongMessage[] = [
  {
    title: 'Eine kleine Bitte aus der Eulerei',
    paragraphs: [
      'PostEulen kostet dich keinen einzigen Cent. Für uns, die PostEulen bauen, ist es leider nicht ganz so umsonst: Server, Strom und sehr viel Kaffee wollen bezahlt werden – und die Eulen bestehen neuerdings auf frischen Haselnusstalern.',
      'Niemand muss etwas geben, und PostEulen bleibt für alle kostenlos. Versprochen. Wenn du aber magst und es dir leisten kannst, freuen wir uns riesig über eine kleine Spende: {link}',
      'Danke, dass du hier Briefe schreibst!',
    ],
  },
  {
    title: 'Psst … die Eulen haben nachgerechnet',
    paragraphs: [
      'Kostenlos ist PostEulen nur auf deiner Seite des Fensterbretts. Auf unserer Seite stapeln sich die Rechnungen für Server und Futter – und die Schneeeule hat schon angefangen, daran zu knabbern.',
      'Spenden ist völlig freiwillig. Hier gibt es keine Werbung und keine Bezahlschranke, und dabei bleibt es auch. Wer kann und möchte, wirft gern ein paar Münzen in die Eulenkasse: {link}',
      'Herzlichen Dank – auch fürs einfach Dabeisein.',
    ],
  },
  {
    title: 'Ein Brief in eigener Sache',
    paragraphs: [
      'Alle fünf Wochen schicken wir dir diese kleine Nachricht, danach lassen wir dich wieder in Ruhe. Ehrenwort. PostEulen ist kostenlos und soll es bleiben. Dahinter stecken aber Menschen, die abends programmieren, statt Eulen zu streicheln.',
      'Niemand ist verpflichtet, etwas zu geben. Wenn du PostEulen magst und ein paar Euro übrig hast, hilft jede Spende, den Eulenschlag am Laufen zu halten: {link}',
      'Danke! Die Eulen lassen grüßen.',
    ],
  },
];

export interface UpdateNote extends LongMessage {
  /** Release the note belongs to, without pre-release suffix (e.g. "0.3.0"). */
  readonly version: string;
}

export const UPDATE_NOTES: readonly UpdateNote[] = [
  {
    version: '0.3.0',
    title: 'Neues aus dem Eulenturm: Version 0.3',
    paragraphs: [
      'Hört, hört! Über Nacht haben die Eulenmeister den Turm entstaubt, die Stangen geölt und ein paar Zauber neu gesprochen. Das ist neu:',
      '• Längere Briefe: Ein kostenloser Brief fasst jetzt bis zu 800 Zeichen, ein großes Pergament sogar 15.000 – genug für ein ganzes Kapitel Zauberkunde.',
      '• Briefe sehen jetzt aus wie echte Briefbögen, mit ausgefranstem Rand und rotem Siegel. Und hinter allem schimmert eine alte Weltkarte, wie mit verblasster Tinte gemalt.',
      '• Ist eine Eule unterwegs, zeigt dir die Eulenübersicht sie im Flug – im Sonnenschein oder unter Sternen, je nachdem, wo sie gerade ist. Auf der Karte zieht sie eine feine braune Spur hinter sich her, und ein „Zzz“ verrät, wo sie übernachtet hat. Die Karte schaut jetzt alle fünf Minuten nach dem Rechten.',
      '• Kommt eine Eule heim, bekommst du eine Nachricht mit Bild: Sie wartet auf dem Fensterbrett, bei Tageslicht oder bei Kerzenschein. Hast du Benachrichtigungen eingeschaltet, klopft sie auch dort an.',
      '• In der Eulenübersicht stehen Leiheulen und eigene Eulen jetzt getrennt. Hilft eine deiner Eulen in der Menagerie aus, siehst du dort ihre leere Stange.',
      '• In der Menagerie stehen die Leiheulen ganz oben. Die Eulen zum Kaufen sind nach Preis sortiert, und jede erzählt jetzt ein bisschen über sich.',
      '• Eine Eule freilassen geht nur noch, wenn du ihren Namen eintippst und zweimal bestätigst. Kein Abschied mehr aus Versehen.',
      '• Gelesene Briefe gelten sofort als gelesen – ganz ohne Neuladen.',
      '• Den Hinweis auf nicht bestätigte Benachrichtigungen kannst du bis zur nächsten Anmeldung ausblenden.',
      '• Die Hilfe erklärt jetzt ausführlich und in Ruhe, wie du PostEulen auf dein Handy holst – ganz ohne App-Store.',
      'Viel Freude beim Schreiben – und vergiss die Haselnusstaler nicht!',
    ],
  },
];

function release(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = (version.split('-')[0] ?? '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  return [major, minor, patch];
}

function compare(a: string, b: string): number {
  const x = release(a);
  const y = release(b);
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Notes of all versions after `previous` up to and including `current`, oldest first. */
export function notesSince(previous: string, current: string): UpdateNote[] {
  return UPDATE_NOTES.filter(
    (note) => compare(note.version, previous) > 0 && compare(note.version, current) <= 0,
  ).sort((a, b) => compare(a.version, b.version));
}

export function updateNote(version: string): UpdateNote | undefined {
  return UPDATE_NOTES.find((note) => compare(note.version, version) === 0);
}
