/**
 * Privacy policy and imprint in English (v0.4): translation of the standard texts in
 * legal.ts, with the same section ids. Whoever runs an instance adapts both on their own.
 */
import { ACCOUNT, FEEDBACK, LETTER, OPERATIONS } from '../constants.ts';
import { en } from './en.ts';
import type { HelpSection } from './help.ts';

export const PRIVACY_INTRO_EN =
  'In short: PostEulen stores as little as possible. Only you can read letters between people, IP addresses are not stored, and there are neither adverts nor analytics tools.';

export const PRIVACY_SECTIONS_EN: readonly HelpSection[] = [
  {
    id: 'gespeichert',
    title: 'What is stored',
    blocks: [
      'PostEulen asks neither for an e-mail address nor for your real name or phone number. Only what the app needs to work is stored:',
      [
        'Account: user name, fictional home (rounded to about 1 km), day of registration, day of your last activity (only the day, no time, no history) and the language of the app you have chosen.',
        'Sign-in: an OPAQUE record. Your password cannot be derived from it; the password itself never leaves your device.',
        `Session: a check value of your session cookie and the time it was last used; deleted after ${ACCOUNT.USER_SESSION_IDLE_DAYS} days without use.`,
        'Keys: your public keys readably, your private keys and your contact vault only encrypted. Only your device knows the key for them while you are signed in.',
        'Contacts: who is connected with whom, open contact requests (at most 24 hours) and key warnings.',
        'Letters between people: only encrypted. The server can read sender, recipient, times, parchment size, delivery and read status (only yes/no).',
        'Game state: gold, the last 20 bookings, owls with their values and flights.',
        'Bot chats and system messages: in plain text (see below).',
        `Messages to the admin (voluntary, from the settings): in plain text and without the sender, for ${FEEDBACK.RETENTION_DAYS} days. The account only keeps the day of the last message (for the limit of one message a day).`,
        'Notifications: the address of your push subscription and notifications not yet confirmed (without content).',
        `Name locks: for deleted or old names only a non-reversible check value, for ${ACCOUNT.NAME_LOCK_DAYS} days.`,
      ],
      'The admin only sees totals (for example the number of accounts and letters per day) an error log without personal data and the messages users voluntarily send them (without the sender; what is in them is up to you). The admin has no list of users, no access to letters and cannot change anything in accounts. The database itself, however, necessarily contains the data listed above in readable form.',
    ],
  },
  {
    id: 'verschluesselung',
    title: 'End-to-end encryption and its limits',
    blocks: [
      'Letters between people, including cover letters for gold, owls and chicks, are encrypted and signed on your device. Neither the operator nor anyone with a copy of the database can read them.',
      'Limits: the server sees the metadata – who writes to whom and when, contact relations, parchment size, delivery and read status, fictional homes and game states. And anyone holding your unlocked device can read your letters.',
      'Decrypted letters are only kept in your device’s memory, never permanently. To keep you signed in, the browser additionally stores your keys encrypted in its database (IndexedDB); they are deleted when you sign out.',
    ],
  },
  {
    id: 'bots',
    title: 'Bots and OpenAI',
    blocks: [
      en.bots.notice,
      'To reply, the server sends the bot’s role text, a short summary of your letters, the last 6 letters and your new letter to OpenAI (OpenAI, L.L.C., USA or OpenAI Ireland Ltd.). Names, user IDs or other identifiers are not transmitted, and storage at OpenAI is switched off as far as the interface allows (store: false). OpenAI may still keep requests for a limited time to detect abuse. So do not write anything personal to bots.',
      'The summary is stored in plain text with the bot chat. It is deleted when you delete the chat, remove the bot or your account is deleted.',
      'Besides the Explainer Bear there are bots that the operator creates in the bots control centre. Their planned letters go to all accounts that have not removed bots; if you have written to such a bot, the AI adapts its next letter to you. In the control centre the operator only sees totals (letters sent, delivered, read, replies) and, on a map, where bot owls are flying or resting right now – without names, but a resting owl sits at your fictional home. The daily backup of the bots only contains their settings, planned letters and pictures, no letters of players.',
      'If you do not want this, simply do not write to the bots or remove them in their chat – or all of them, future ones included, in the settings.',
    ],
  },
  {
    id: 'push',
    title: 'Notifications',
    blocks: [
      'Notifications run via the push service of your browser or system: Apple, Google, Mozilla or a UnifiedPush server (for example ntfy or the server of your distributor app). The content is encrypted and never contains names or letter texts. The push service does see, however, when your device receives a notification.',
      'The push subscription is removed when you sign out, when you sign in on another device and when the account is deleted.',
    ],
  },
  {
    id: 'cookie',
    title: 'One single cookie',
    blocks: [
      'PostEulen sets exactly one cookie: the session cookie, without which signing in does not work. It is technically necessary, readable only by PostEulen and contains a random string; the server only stores a check value of it. There are no tracking cookies, no adverts, no analytics tools and no content from other servers.',
      'The language you choose before signing in, whether you have hidden the note about notifications and which notices of the operator (banners) you have closed are remembered only in your browser’s local storage, not on the server.',
    ],
  },
  {
    id: 'ip',
    title: 'No IP addresses, no logs',
    blocks: [
      'Your IP address is not stored. It is only kept briefly in memory to slow down attacks such as mass password guessing, and disappears by itself. The web server keeps no access log; error logs contain no IP addresses, names or content either. Browser identifiers (user agent) and fingerprints are not collected.',
    ],
  },
  {
    id: 'backups',
    title: 'Backups',
    blocks: [
      `The server backs up the database every day, encrypted. Backups are deleted after ${OPERATIONS.BACKUP_RETENTION_DAYS} days, including the copy outside the server. Deleted data therefore also disappears from the backups after ${OPERATIONS.BACKUP_RETENTION_DAYS} days at the latest.`,
    ],
  },
  {
    id: 'loeschung',
    title: 'Deletion',
    blocks: [
      `You can delete your account at any time in the settings. After ${ACCOUNT.SELF_DELETE_GRACE_HOURS} hours (if you do not sign in again) and after your last owls have delivered, all data of your account is deleted: profile, sign-in data, keys, vault, sessions, push subscription, notifications, your copies of letters, bots with their chats, owls, bookings and contacts. Whatever others have received from you stays with them.`,
      `Automatic deletion: accounts without activity are deleted after a period set by the operator (at least ${ACCOUNT.AUTO_DELETE_MIN_DAYS}, usually ${ACCOUNT.AUTO_DELETE_DEFAULT_DAYS} days). You get a warning ${ACCOUNT.AUTO_DELETE_WARNING_DAYS} days before.`,
      `Letters and system messages are deleted automatically and for good ${LETTER.RETENTION_MAX_DAYS} days after delivery at the latest, for everyone involved. In the settings you can have your own copies deleted after 30, 90 or 180 days.`,
      'You delete chats yourself; a letter disappears from the database as soon as neither sender nor recipient has it any more.',
    ],
  },
];

export const IMPRINT_INTRO_EN =
  'PostEulen is a technical experiment for personal use – put together out of curiosity, parchment and a healthy dose of love for owls. It is not a product, not a service with any promise of availability and certainly not a company.';

export const IMPRINT_SECTIONS_EN: readonly HelpSection[] = [
  {
    id: 'kontakt',
    title: 'Contact',
    blocks: [
      'The quickest way to reach the developer is Mastodon: @iak@23.social (https://23.social/@iak). Owls are sadly not accepted there.',
    ],
  },
  {
    id: 'haftung',
    title: 'Liability',
    blocks: [
      'Use is at your own risk. We accept no liability whatsoever – neither for owls arriving on time, complete or at all, nor for lost letters, lost gold, lost passwords, mislaid owls or data that disappears in an outage. There is no right to availability; the service may be discontinued at any time without notice.',
      'Users alone are responsible for the content they write to each other – we cannot read it anyway. The bots’ replies are generated by AI; they may be wrong and are not advice.',
      'The operators of linked external sites are solely responsible for their content.',
      'This English version is a translation for convenience; the German version applies.',
    ],
  },
];
