/**
 * v1.4.2: the help of a Tor-only instance (SPEC 16.6, 8.11): the same text without anything about
 * notifications (there are none) and with a section on Tor that knows no normal address. It is
 * derived from the regular help, so both always say the same about everything else; each rule
 * below must still find its text (checked in shared/test/v142.test.ts). The same replacements
 * serve the welcome page and the text „Über PostEulen“ on the start page.
 */
import type { Help, HelpBlock, HelpSection } from './help.ts';

/** Sections and FAQ entries left out, by id resp. question. */
const DROPPED_SECTIONS = ['benachrichtigungen'];
const DROPPED_QUESTIONS = [
  'Ich bekomme keine Benachrichtigungen.',
  'I do not get any notifications.',
];

/** Text replacements – `''` removes a sentence, a paragraph or a list item. */
export const TOR_ONLY_REPLACEMENTS: readonly (readonly [string, string])[] = [
  // The start page (about.ts): getting it onto the phone.
  [
    ' Der einzige Unterschied: Benachrichtigungen („Eine Eule ist gelandet!“) gibt es nur in der App auf dem Startbildschirm von Android/Chrome und iPhone/Safari. Im Browser kommt die Post trotzdem an – man sieht sie beim nächsten Hineinschauen. Im echten Leben klingelt der Briefkasten ja auch nicht.',
    '',
  ],
  [
    ' The only difference: notifications (“An owl has landed!”) are only available in the app on the home screen of Android/Chrome and iPhone/Safari. In the browser your post arrives anyway – you see it the next time you look in. In real life the letterbox does not ring either.',
    '',
  ],
  // Getting it onto the phone: the last step on the iPhone.
  [' – nur dort gibt es auf dem iPhone Benachrichtigungen.', '.'],
  [' – only there does the iPhone show notifications.', '.'],
  // The overview.
  [
    ' Sind Benachrichtigungen nicht eingerichtet, erscheint darunter ein Hinweis, der dich zu den Einstellungen führt. Stört er dich, blende ihn mit „Ausblenden bis zur nächsten Anmeldung“ aus.',
    '',
  ],
  [
    'Unter „Neuigkeiten“ zeigt die Übersicht alles, was dich nicht per Benachrichtigung erreicht hat – zum Beispiel weil das Handy aus war.',
    'Unter „Neuigkeiten“ zeigt die Übersicht, was seit deinem letzten Besuch passiert ist – etwa gelandete Eulen, angekommenes Gold oder neue Kontakte.',
  ],
  [
    ' If notifications are not set up, a note below takes you to the settings. If it bothers you, hide it with “Hide until the next sign-in”.',
    '',
  ],
  [
    'Under “News” the overview shows everything that did not reach you by notification – for example because your phone was off.',
    'Under “News” the overview shows what has happened since your last visit – such as owls that landed, gold that arrived or new contacts.',
  ],
  // Language.
  ['Systemnachrichten, Benachrichtigungen und die Briefe', 'Systemnachrichten und die Briefe'],
  ['system messages, notifications and the letters', 'system messages and the letters'],
  // Letters, system messages, visiting owls.
  [
    ', und hat er Benachrichtigungen eingerichtet, bekommt er für Brief und Rast zusammen eine einzige: „Eine Eule hat Post gebracht und rastet bei dir.“',
    '.',
  ],
  [
    ', and if they have set up notifications, they get a single one for the letter and the rest together: “An owl has brought post and is resting with you.”',
    '.',
  ],
  [' Hast du Benachrichtigungen eingerichtet, bekommst du außerdem eine.', ''],
  [' If you have set up notifications, you get one of those too.', ''],
  [
    'Wenn sie bei dir ankommt, bekommst du (wenn eingerichtet) eine Benachrichtigung, und im Briefwechsel',
    'Solange sie bei dir ist,',
  ],
  [
    'steht ein kleines Eulensymbol hinter dem Namen ihres Halters, solange sie bleibt.',
    'steht im Briefwechsel ein kleines Eulensymbol hinter dem Namen ihres Halters.',
  ],
  [
    'When it arrives, you get a notification (if set up), and a little owl symbol stands behind its holder’s name in your conversations for as long as it stays.',
    'As long as it stays, a little owl symbol stands behind its holder’s name in your conversations.',
  ],
  // Settings.
  ['Benachrichtigungen (gleich unter „Abmelden“): Status ansehen und testen.', ''],
  ['Urlaubsmodus (unter den Benachrichtigungen)', 'Urlaubsmodus (gleich unter „Abmelden“)'],
  ['Notifications (right below “Sign out”): see the status and test them.', ''],
  ['Holiday mode (below the notifications)', 'Holiday mode (right below “Sign out”)'],
  // Signing in on another device.
  [' – das gilt auch beim Wechsel zwischen der normalen Adresse und dem Tor-Netz.', '.'],
  [' – this also applies when switching between the normal address and the Tor network.', '.'],
  // The Tor network – there is no normal address.
  [
    'PostEulen ist nicht nur unter seiner normalen Adresse erreichbar, sondern auch als Onion-Dienst im Tor-Netz. Den Link „Tor-Netz“ findest du auf der Startseite in der Linkleiste unter der Anmeldung; er öffnet sich im Tor Browser. Öffnest du die normale Adresse im Tor Browser, zeigt er dir in der Adresszeile von selbst „.onion verfügbar“ an.',
    'Diese PostEulen-Instanz gibt es nur im Tor-Netz, als Onion-Dienst – im übrigen Web ist sie nicht erreichbar. Du öffnest sie mit dem Tor Browser über ihre Onion-Adresse.',
  ],
  [
    'Es ist dieselbe App: dasselbe Konto, dieselben Briefe, Eulen und dasselbe Gold. Du kannst nach Belieben zwischen der normalen Adresse und dem Tor-Netz wechseln.',
    '',
  ],
  [
    'Angemeldet bist du aber immer nur an einer Stelle zugleich. Meldest du dich über Tor an, endet die Sitzung unter der normalen Adresse – und umgekehrt. Jede Adresse merkt sich deine Anmeldung für sich.',
    '',
  ],
  [' Benachrichtigungen gibt es im Tor Browser nicht.', ''],
  [
    'Der Betreiber kann den Zugang über das Tor-Netz vorübergehend abschalten. Dann verschwindet der Link auf der Startseite, und du nutzt einfach die normale Adresse.',
    '',
  ],
  [
    'Die Anleitung „Wie kommt PostEulen aufs Handy?“ auf der Startseite nennt auch über das Tor-Netz die normale Adresse – aufs Handy legst du PostEulen am besten von dort.',
    '',
  ],
  [
    'PostEulen can be reached not only at its normal address but also as an onion service in the Tor network. You will find the link “Tor network” on the start page in the bar of links below the sign-in box; it opens in the Tor Browser. If you open the normal address in the Tor Browser, it shows “.onion available” in the address bar by itself.',
    'This PostEulen instance exists only in the Tor network, as an onion service – it cannot be reached on the rest of the web. You open it with the Tor Browser at its onion address.',
  ],
  [
    'It is the same app: the same account, the same letters, owls and the same gold. You can switch between the normal address and the Tor network as you like.',
    '',
  ],
  [
    'But you are only ever signed in in one place at a time. Signing in over Tor ends the session at the normal address – and the other way round. Each address remembers your sign-in on its own.',
    '',
  ],
  [' There are no notifications in the Tor Browser.', ''],
  [
    'The operator can switch off access through the Tor network for a while. The link on the start page then disappears, and you simply use the normal address.',
    '',
  ],
  [
    'The guide “How does PostEulen get onto your phone?” on the start page names the normal address even through the Tor network – that is the best place to add PostEulen to your phone from.',
    '',
  ],
];

/** A text of the app without what it says about notifications (Tor-only instance). */
export function withoutNotifications(text: string): string {
  return replace(text);
}

function replace(text: string): string {
  let result = text;
  for (const [from, to] of TOR_ONLY_REPLACEMENTS) result = result.split(from).join(to);
  return result.trim();
}

function block(value: HelpBlock): HelpBlock | null {
  if (typeof value === 'string') {
    const text = replace(value);
    return text === '' ? null : text;
  }
  const items = value.map(replace).filter((item) => item !== '');
  return items.length === 0 ? null : items;
}

function section(value: HelpSection): HelpSection {
  return {
    ...value,
    blocks: value.blocks.map(block).filter((entry): entry is HelpBlock => entry !== null),
  };
}

/** The help without notifications and without a normal address (Tor-only instance). */
export function torOnlyHelp(help: Help, pushBlocks: readonly string[]): Help {
  const drop = new Set(pushBlocks);
  return {
    ...help,
    intro: replace(help.intro),
    sections: help.sections
      .filter((entry) => !DROPPED_SECTIONS.includes(entry.id))
      .map((entry) => ({
        ...entry,
        blocks: entry.blocks.filter((value) => typeof value !== 'string' || !drop.has(value)),
      }))
      .map(section),
    faq: help.faq
      .filter((entry) => !DROPPED_QUESTIONS.includes(entry.question))
      .map((entry) => ({ ...entry, answer: replace(entry.answer) })),
  };
}
