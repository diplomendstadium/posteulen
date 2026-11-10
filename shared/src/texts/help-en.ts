/**
 * The help in English (v0.4): the same sections (and section ids, so links keep working) as
 * help.ts, for the English view and as the knowledge base of the Explainer Bear for accounts
 * in English. All numbers come from the constants.
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
import { en } from './en.ts';
import type { Help, HelpQuestion, HelpSection } from './help.ts';

const gold = (tenths: number): string => `${formatGold(tenths, '.')} gold`;
const percent = (share: number): string => `${Math.round(share * 100)} %`;
/** One decimal, rounded half up (v0.5). */
const decimalEn = (value: number): string => (Math.round(value * 10 + 1e-9) / 10).toFixed(1);
const hh = (hour: number): string => String(hour).padStart(2, '0');
const dailyGoldTime = `${hh(GOLD.DAILY_HOUR_UTC)}:00 UTC (${hh(GOLD.DAILY_HOUR_UTC)}:00 in the UK in winter, ${hh(GOLD.DAILY_HOUR_UTC + 1)}:00 in summer)`;

const INTRO =
  'Here you can find out at leisure how PostEulen works – no prior knowledge needed. Right at the top you can read how PostEulen gets onto your phone; after that every part of the app has its own section, and at the end there are frequently asked questions. Anything still unclear? Write a letter to the Explainer Bear – he knows this help by heart.';

const SECTIONS: readonly HelpSection[] = [
  {
    id: 'idee',
    title: 'What is PostEulen?',
    blocks: [
      'PostEulen is a letterbox with owls. You write letters to friends, and an owl carries them there – not in seconds like a text message, but as long as an owl takes to fly. The further away the other person lives, the longer it takes. Looking forward to it is part of the fun.',
      'On the side, you look after your owls: you buy or borrow them, feed and pet them, earn a little gold every day and can send friends gold or even an owl.',
      'Your letters to other people are encrypted: only you and the other person can read them – not even the people running PostEulen can.',
      'PostEulen is a website that behaves like an app. You can put it on your home screen without any app store – the next section explains how.',
      'The name PostEulen is German for “post owls”. You can use the whole app in English: tap the little British flag in the top right corner.',
    ],
  },
  {
    id: 'installieren',
    title: 'Getting PostEulen onto your phone – without an app store',
    blocks: [
      'You get apps from the app store, right? Usually, yes. But there is a second way that many people do not know: some websites can turn into an app. Experts call this a “web app” – but you do not need to remember the word. You simply put PostEulen on your home screen, and from then on it has its own owl icon there, opens without an address bar and looks like any other app.',
      'Do not worry: this is no witchcraft and not dangerous. Nothing is installed secretly, PostEulen does not want your photos or your contacts, and you can delete the icon at any time. New versions arrive by themselves.',
      `This is how it works on an ${en.welcome.android}:`,
      en.welcome.androidSteps,
      `This is how it works on an ${en.welcome.ios}:`,
      en.welcome.iosSteps,
      `${en.welcome.other}: ${en.welcome.otherSteps}`,
      'On a computer you can also set up PostEulen as an app in Chrome or Edge with the small install icon in the address bar, and in Safari on the Mac with File → “Add to Dock”. But you do not have to.',
      `${en.welcome.push1} ${en.welcome.push2}`,
    ],
  },
  {
    id: 'sicher',
    title: 'Game and secure letterbox at the same time',
    blocks: [
      'PostEulen sits on the border between game and messenger. The owls, the gold and the flight times are the game – the encryption is not. Beneath the parchment surface, hard, serious, up-to-date cryptography is at work. That is why PostEulen is quite suitable as a secure way of communicating when minutes do not matter.',
      [
        'Letters between people are encrypted on your device with XChaCha20-Poly1305 and signed with Ed25519. Only sender and recipient get the key for each letter, wrapped according to the HPKE standard (RFC 9180).',
        'Your password never leaves your device. Signing in uses OPAQUE (RFC 9807): the server can neither see your password nor guess it from its database.',
        'With the safety number you check that really nobody is sitting in between.',
        'Only proven, openly reviewed libraries are used (libsodium, hpke-js, OPAQUE by Serenity) – no home-made cryptography. The source code is open.',
      ],
      'What PostEulen cannot hide: who writes to whom and when (metadata). And anyone holding your unlocked device can read your letters. Letters to bots and system messages are not encrypted.',
    ],
  },
  {
    id: 'konto',
    title: 'Account, password and signing in',
    blocks: [
      `Your user name has ${ACCOUNT.USER_NAME_MIN_CHARS} to ${ACCOUNT.USER_NAME_MAX_CHARS} characters: Latin letters, umlauts, ß, common accented letters, digits and single spaces. Upper and lower case and easily confused characters (0 and O, 1, l and I) count as the same – so nobody can pretend to be somebody else.`,
      `Your password has at least ${ACCOUNT.PASSWORD_MIN_CHARS} characters. A sentence you can remember easily is ideal. The password never leaves your device and is not stored anywhere on the server. So remember: if you forget it, all your data is lost for good. Nobody can reset it, not even the admin.`,
      'When creating your account you set a fictional home on the map with a pin – think carefully about whether you want to choose your real address. That is where your owls live and where they take off from.',
      'You can only be signed in on one device at a time. If you sign in on another device, the session on the old one ends. This is also a safeguard: if someone else is using your password, you keep getting signed out and notice at once – then change your password straight away. After several wrong passwords you have to wait a little and let a small sum be solved (your device does that automatically).',
      `Without use, you are signed out after ${ACCOUNT.USER_SESSION_IDLE_DAYS} days. When you sign out, PostEulen deletes all keys from your device and also forgets everything it remembered about your contacts – if someone else then signs in in the same window, they see nothing of it. The next time you sign in, PostEulen fetches your keys back from the server, encrypted.`,
    ],
  },
  {
    id: 'ueberblick',
    title: 'The app at a glance',
    blocks: [
      'After signing in you see the overview with tiles for all parts: Letters, Owls, Finances, Menagerie, Address book, Map, Settings and Help. On the phone you also reach the most important parts with the bar at the bottom.',
      'In the brown bar at the top you see how much gold you have. When new post is there, “New post!” hops up and down there – tapping it takes you to your letters. On the overview, the version of the app is shown in small print next to the lettering. If notifications are not set up, a note below takes you to the settings. If it bothers you, hide it with “Hide until the next sign-in”.',
      'Whatever you have read counts as read straight away – the counters on the overview and in the bar go down without reloading.',
      'Under “News” the overview shows everything that did not reach you by notification – for example because your phone was off.',
      'Below, PostEulen greets you by name – to suit the time of day at your fictional home, that is, by the time that applies there right now (with summer time). If you drop by late in the evening or at night, you are greeted as a night owl. All other times in the app – arrivals, homecomings, rests, deadlines – are shown in this local time at your home, too.',
      'In the top right corner of every page sits a little flag. Tapping the German flag switches PostEulen back to German, the British flag switches it to English (see Language).',
    ],
  },
  {
    id: 'sprache',
    title: 'Language: German or English',
    blocks: [
      'PostEulen is available in German and in English. German is always the default. With the flag in the top right corner you can switch at any time: the British flag for English, the German flag for German.',
      'When you are not signed in, your device remembers your choice. If you create an account in the English view, English applies to your account too. After every sign-in PostEulen then shows the language of your account, on every device.',
      'When you are signed in, the flag saves the language in your account right away. You can also find it in the settings under “Language”.',
      'The language applies to everything PostEulen writes itself: menus, help, system messages, notifications and the letters of the bots. Loan owls and chicks then get English names. Letters from people of course stay as they were written, and so do bot letters that have already arrived.',
    ],
  },
  {
    id: 'adressbuch',
    title: 'Address book and contacts',
    blocks: [
      'You can only write to people you are connected with. To connect, you both enter each other in the address book, each with the exactly spelled name. Talk to each other outside the app first: you do not see other people’s requests, and the answer is always the same – whether the name exists or not. PostEulen removes an accidental space at the start or end of the name by itself.',
      `A request waits ${ACCOUNT.CONTACT_REQUEST_EXPIRY_HOURS} hours for the other side and then expires. You can make at most ${ACCOUNT.CONTACT_REQUESTS_PER_DAY} requests per day. As soon as you have both entered each other, you are connected and both get a system message.`,
      [
        '“unconfirmed”: your request is still waiting (with the time left).',
        `“inactive”: the contact has not been around for more than ${ACCOUNT.INACTIVE_AFTER_DAYS} days. Until they come back, you cannot send them anything.`,
        '“Safety number compared”: you have checked your number (see Encryption).',
        '“Key warning”: something is wrong with the keys – do not send anything any more, see Encryption.',
      ],
      'If you remove a contact, you have to pair again. Owls on their way between you turn back immediately. The chat stays, but shows “unknown” as the name until you connect again.',
      'Only real people are in the address book. You find the Explainer Bear and other bots in your correspondence; that is also where you write to them (see Bots).',
    ],
  },
  {
    id: 'verschluesselung',
    title: 'Encryption and safety number',
    blocks: [
      'Letters between people are encrypted and signed on your device. The server only sees gibberish. But it does see who writes to whom and when, how large the parchment is and whether a letter has been read – PostEulen does not tell the other person.',
      'Each contact shares a safety number of 60 digits with you. Compare it outside the app, for example when you meet or on the phone. If it matches, mark it as compared in the address book. Then you know for sure that nobody is sitting in between.',
      'Your device compares your contacts’ keys before every letter and when you open a conversation. If it notices that a contact’s keys have changed, it warns you clearly and blocks sending to them. That should never happen, because keys never change in PostEulen. Sort it out outside the app; then remove each other and pair again.',
      'If your device cannot decrypt a letter or cannot confirm it as genuine, PostEulen does not show its content. Instead it says: “The letter got so wet on its way that it can no longer be read.” The other person sees: “The owl lost the letter on its way.” Only the admin gets the technical reason in the error log, without names.',
      'Limits: anyone holding your unlocked device can read your letters. Letters to bots and system messages are not encrypted.',
    ],
  },
  {
    id: 'briefe',
    title: 'Writing and reading letters',
    blocks: [
      'Under Letters you see a chat for every person, sorted by latest activity and with a counter for unread letters. The system messages are pinned at the top.',
      [
        `Small parchment: up to ${LETTER.SMALL_MAX_CHARS} characters, free.`,
        `Large parchment: up to ${LETTER.LARGE_MAX_CHARS.toLocaleString('en-GB')} characters, ${gold(GOLD.LARGE_PARCHMENT_SURCHARGE)} extra each time you send.`,
      ],
      `How it works: choose the parchment, write the text, add more recipients if you like (at most ${LETTER.MAX_RECIPIENTS} in total), choose an owl and send. With several recipients, PostEulen sorts them so that the owl flies the shortest way – from you to all of them and back home. You can still change the order with the arrows. When you choose an owl, PostEulen shows you for every owl when it arrives at each recipient and when it is back home.`,
      `No owl at home? Then the owl choice offers you the loan owls of the day right away. They are only borrowed and paid for (${gold(GOLD.LOAN_PRICE)}) when you really send – your letter stays as it is.`,
      'With several recipients, the owl flies from one to the next. Everyone only sees their own letter and can only reply to you. This works with your own owls and with loan owls; a loan owl vanishes after the last recipient. Bots are never among several recipients.',
      `A rest with the recipient: when writing, you choose how long the owl stays with each recipient before flying on – not at all, 1, 2, 24 or ${LETTER.REST_HOURS_CHOICES[LETTER.REST_HOURS_CHOICES.length - 1]} hours (preselected: ${LETTER.REST_HOURS_DEFAULT} hour). During the rest it recovers as at home, and the recipient sees it under “Owls” with the clear note “Only here for a rest!”. They get a system message and a notification that it is resting with them and until when. They may look after it and hand it a reply to you – then it takes off at once. They can also let it fly on earlier without a letter. If the time runs out unused, it flies on by itself. With several recipients, each of them can give it a reply; the owl then comes home with several letters, and the picture of its homecoming tells you how many. A loan owl without a reply vanishes after the last recipient; if it has replies on board, it brings them to you first and only then flies back to the Menagerie.`,
      'When a contact’s owl is resting with you, you write your reply as usual in your chat: in the owl choice the visiting owl is at the top and already selected. It takes your letter straight to its holder – there is no rest on the way back.',
      'Letters are plain text. Parchment knows no smileys and emojis – they are removed. Links starting with http:// or https:// can be clicked and open in the browser; check the address shown before you tap. If you would rather not tap anything by accident, turn off the switch “Links in letters clickable” in the settings – links are then shown as text only.',
      `Beware of disguised addresses: some letters from other alphabets look just like ours (a Cyrillic “а” looks like an “a”). If the address of a link contains such characters, or a name with “@” in front of the actual address, PostEulen shows it in its technical form, such as “xn--pypal-4ve.com” instead of “pаypal.com”, and writes next to it: “${en.letters.linkWarning}” That way you see where the link really leads. Genuine addresses with accented letters (such as café.fr) look like that too.`,
      [
        '“Owl on its way – arrives around …”: the letter is on its way.',
        '“delivered”: the owl has arrived. Whether and when the other person read the letter, PostEulen does not tell – just like a real letterbox.',
        '“not delivered – the owl turned back”: for example because the connection was cut.',
        '“The owl lost the letter on its way.”: the other person’s device could not open the letter (see Encryption). Best write it again.',
      ],
      'When an owl arrives at your place, you see its arrival picture the first time. If several new letters have arrived in a chat, all the owls show themselves one after another. Each picture closes by itself after a few seconds, with a tap or with the Escape key.',
      'Below every letter it says which owl brought it – for your own letters too (“On its way with …” while it is still flying). If it was not your own owl, the brackets say that it was a loan owl or whose owl it was.',
      'Short letters lie slightly askew as on a desk; very long letters stand straight so nothing slides out of view.',
      'Letters are in the order in which you learned of them: your own where you sent them, received ones where they reached you. So a letter that was on its way for a long time stands down among the new ones.',
      'In the chat, letters appear as sheets of parchment with frayed edges: letters to you on light parchment, in German school handwriting and blue-black ink, your own on darker parchment, in flowing quill handwriting and sepia. Links and names are always in print so you can read them safely. If handwriting is too much effort, switch to print in the settings.',
      'When you open a chat, it starts at the oldest letter you have not read yet. If everything is read, it jumps to the latest letter. Older letters are above it.',
      '“Burn all letters” asks first and then removes your copies of all letters of this chat for good – they go up in flames in the fireplace. The other person keeps theirs. A letter that is still on its way to you is not burnt: it arrives and then shows up in the chat.',
    ],
  },
  {
    id: 'aufbewahrung',
    title: 'Old letters are deleted',
    blocks: [
      `Important: all letters and system messages are deleted automatically and for good ${LETTER.RETENTION_MAX_DAYS} days – that is, one year – after delivery at the latest. This applies to all accounts and to the bots’ letters too. Nobody can restore them.`,
      'In the settings under “Letters” you can have your own copies deleted after 30, 90 or 180 days – letters written and received. If you choose a shorter period, everything older is deleted immediately. The other person keeps their copy until their own period runs out.',
      'Letters still on their way are never deleted. If you want to keep something, write it down outside PostEulen.',
      'If letters were removed because of the deletion period, a system message with a picture of the fire tells you how many there were and from which chats.',
    ],
  },
  {
    id: 'systemnachrichten',
    title: 'System messages',
    blocks: [
      'In the chat “System messages” PostEulen reports everything important right away: new contacts, gold or owls that have arrived, illnesses, eggs, chicks, name changes of your contacts, messages from the admin to everyone, owls resting with you and more. You cannot reply there.',
      'Now and then the admin pins a short notice for everyone at the top of the app, for example about maintenance. It disappears by itself when its time is up; with ✕ you can hide it on this device earlier.',
      'When one of your owls comes home from a flight, there is no message here for it. Instead PostEulen shows you a picture: the owl sits on the window sill – in daylight or by candlelight, depending on whether it is light or dark at your home at that moment. If it has replies on board, the caption says how many. The picture appears at once if the app is open when the owl lands, otherwise the next time you open the app or sign in. If several owls have come home, you see the pictures one after another. If you have set up notifications, you get one of those too.',
      'After every update a message tells you what has changed. And every five weeks a small request for a voluntary donation arrives (see Frequently asked questions).',
    ],
  },
  {
    id: 'eulen',
    title: 'Your owls',
    blocks: [
      'Under “Owls” you see all your owls, chicks and loan owls with picture, name, species, sex, energy, motivation and state – the loan owls at the top, your own below. If an owl is not there, it says why and until when, for example “Is flying a letter to Peter. Expected back in 5 h”, “Is asleep on the way home”, “Resting with Peter until 20:00” or “In the Menagerie until Fri, 14:00”. If it takes less than an hour, the time is given in minutes, for example “back in 40 min”.',
      'The picture shows what the owl is doing right now: if it is on its way, you see it flying – in sunshine or under the stars, depending on whether it is light or dark where it is right now. If it is taking a rest on the way, you see it asleep, by day or at night. If it is brooding, it sits on its eggs in the nest. If it is helping out in the Menagerie, you see its empty perch.',
      'If a contact’s owl is resting with you, it is right at the top under “Visiting you” – with the note that it is only here for a rest and until when. You can give it water, pet it and feed it (you pay for the biscuit and the snack) – that raises its motivation, and it flies on refreshed. “Give it a reply …” takes you straight to your chat. When it arrives, a system message (and, if set up, a notification) tells you how long it will stay. If you would like it to leave sooner, tap “Send on its way” – after a question it flies on without a letter.',
      'Owls are night birds: when it is light at your home, a healthy owl sometimes dozes – whether it is asleep is decided anew each time you open the owl overview, about every other time. At night and for ten minutes after you last looked after it, it is always awake. You can still care for it and send it off at any time.',
      'Each species has a price, a maximum energy, a speed factor and a recovery factor. Owls do not grow old and do not die.',
      [
        `Renaming: once per calendar year per owl (${OWL.NAME_MIN_CHARS}–${OWL.NAME_MAX_CHARS} characters). The first name after buying or hatching does not count.`,
        'Giving away: a ready adult owl flies to a contact and belongs to them from its arrival. You can add a short cover letter. If it turns back, it belongs to you again.',
        'Setting free: the owl is gone for good. So that this never happens by accident, you type its name exactly and then confirm a second time.',
        `At most ${OWL.MAX_OWN_OWLS} owls of your own (chicks count, loan owls do not). Gifts and chicks may go beyond that; you just cannot buy any more then.`,
      ],
      'An owl can only take off if it is at home, healthy and grown up, and neither brooding nor in the Menagerie.',
    ],
  },
  {
    id: 'energie',
    title: 'Energy and care: water, petting, owl biscuit, favourite snack',
    blocks: [
      `At home an owl recovers: per hour ${percent(OWL.REGEN_SHARE_PER_HOUR)} of its maximum energy times its recovery factor. With factor 2 it is full again in 5 hours. On the way it recovers in the same way while it sleeps (see How an owl flies).`,
      'There are four ways to look after your owl – as long as it is at home, also while it is ill or brooding:',
      [
        'Give water: free, once a day.',
        'Petting: free and as often as you like.',
        `Owl biscuit: ${gold(GOLD.FEED_PRICE)}, once a day, gives ${percent(OWL.FEED_SHARE)} energy times the recovery factor at once.`,
        `Favourite snack: ${gold(GOLD.SNACK_PRICE)}, once a day, gives ${percent(OWL.SNACK_SHARE)} energy times the recovery factor at once. Every species has its own – the Tawny Owl loves hazelnuts, Blakiston’s Fish Owl smoked fish; the Menagerie description tells you which.`,
      ],
      `Each of these four kinds of care raises the motivation once a day (see Motivation). Care bonus against illness: a day counts as cared for if the owl got ${OWL.CARE_DAY_INTERACTIONS} different kinds of care that day – for example water and petting. The last ${OWL.CARE_BONUS_WINDOW_DAYS} days on which it was at home for at least ${OWL.CARE_BONUS_MIN_HOME_HOURS} hour are counted. If it was cared for on at least ${OWL.CARE_BONUS_MIN_DAYS} of them, it falls ill much less often. Whole travel days do not count – a busy letter owl does not lose its bonus just because it was away.`,
    ],
  },
  {
    id: 'motivation',
    title: 'Motivation',
    blocks: [
      'Besides its energy, each of your owls has a second bar: motivation. It is always between 80% and 120%. Owls you buy come to you with 100%, loan owls with 80% to 100%.',
      'Every night at midnight (UTC) it drops by 10 percentage points – even while the owl is on its way or helping out in the Menagerie. Water, petting, an owl biscuit and the favourite snack each raise it by 10 percentage points once a day. So if you care a little every day, you will soon have a highly motivated owl.',
      'The motivation always counts for the next leg: from home to the first recipient when it takes off, and from each recipient to its next destination when it flies on. With 120% the owl has 20% more energy on that leg, is 20% faster and recovers 20% faster while sleeping; with 80% it has 20% less. At home and while resting with a recipient the normal values of the species apply. So whoever looks after a resting owl sends it on more briskly.',
      'In the owl overview, the speed in km/h and the recovery in percent per hour of the species are shown below the bars. If the motivation is not 100%, a green “+10 %” or a red “−20 %” follows – that is how much changes on the next leg.',
    ],
  },
  {
    id: 'flug',
    title: 'How an owl flies',
    blocks: [
      `Base speed ${FLIGHT.BASE_SPEED_KMH} km/h times the speed factor of the species – just as fast by day and by night.`,
      `Energy: at night ${FLIGHT.ENERGY_PER_KM_NIGHT} point per kilometre, by day ${FLIGHT.ENERGY_PER_KM_DAY} points. Twilight counts as day. Owls are night birds, after all.`,
      `When its energy is empty, the owl sleeps on the spot. It recovers just as at home: ${percent(OWL.REGEN_SHARE_PER_HOUR)} of its maximum energy times its recovery factor per hour. But it only sleeps until it has enough energy for the way to its next destination – the next recipient or its home – at most until it is full. Over water it does not sleep: it glides on without energy to the next coast and rests there. You can send off nearly empty owls too; the flight then simply starts with a nap.`,
      'If you chose a rest when writing, the owl stays that long with the recipient after the delivery and recovers there as at home (see Letters). After the last delivery the owl flies home by the same rules. Loan owls do not fly back – unless they have a reply for you on board; owls and chicks given as gifts stay with the recipient.',
      'If a recipient or you yourself move, the owl changes course at once. If the connection is cut or the recipient deletes their account, it turns back; with several recipients it leaves out the one affected.',
    ],
  },
  {
    id: 'karte',
    title: 'The map',
    blocks: [
      'The map shows the whole world. Western Europe, where everyone lives, is drawn in detail, with cities; outside it you see borders and capitals. Shown are your home, the homes of your contacts and bots, and your owls that are currently on their way for you. You never see other people’s owls – not even when they are flying to you. You find the Explainer Bear on the map as soon as you have written to him for the first time; other bots as soon as their first letter has reached you – they can live anywhere in the world.',
      'Behind each of your owls runs a thin dark brown line: the way it has already flown. Where it spent the night there is a small “Zzz”. The map does not show the way still ahead – owls do not like people looking at their maps.',
      'When you open it, the map zooms in just far enough that your home, your contacts and your owls are visible (the bots do not count for this). For orientation it shows cities: zoomed far out those with more than a million inhabitants, zoomed in closer all with more than 200,000. If there is no room for a city name, or it would cover your places or owls, it stays hidden until you zoom in closer. England, Scotland, Wales and Northern Ireland are drawn as countries of their own.',
      `The dark area is the night. Your device recalculates positions, flight tracks and the night boundary every ${MAP.CLIENT_REFRESH_MINUTES} minutes without asking the server.`,
      'The map is always square and as large as fits into the window. You can zoom with two fingers or the mouse wheel, move it and control it with the keyboard (arrow keys, plus and minus). Zoomed all the way out, the whole world fits into the square. The button below plus and minus (“Reset view”) goes back to the view the map opened with.',
      'You can only live in Western Europe: when you sign up and when you move, the map therefore stays within the familiar Western Europe section.',
    ],
  },
  {
    id: 'gold',
    title: 'Gold and finances',
    blocks: [
      `You start with ${gold(GOLD.START)}. Every day at ${dailyGoldTime} every active account gets gold: ${gold(GOLD.DAILY)} a day during the first ${GOLD.DAILY_HIGH_DAYS} days after creating the account, then ${gold(GOLD.DAILY_LATER)}. Sometimes a bot sends you gold or even an owl, too.`,
      `Costs: owls depending on the species, loan owl ${gold(GOLD.LOAN_PRICE)}, owl biscuit ${gold(GOLD.FEED_PRICE)}, favourite snack ${gold(GOLD.SNACK_PRICE)}, large parchment ${gold(GOLD.LARGE_PARCHMENT_SURCHARGE)}, nursing ${gold(GOLD.SELF_CARE_PRICE)} or the owl vet ${gold(GOLD.VET_PRICE)}. Everything must be fully covered; there are no debts.`,
      `The finances show how much gold you have and the last ${GOLD.TRANSACTIONS_KEPT} bookings.`,
      `Sending gold: ${gold(GOLD.TRANSFER_MIN)} to ${gold(GOLD.TRANSFER_MAX)} by owl to a contact, with a short cover letter if you like. Afterwards you must have more than ${gold(GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE)} left. The gold is debited when the owl takes off and arrives with the owl. If it turns back, you get it back as soon as it is home again. You cannot send gold to bots.`,
    ],
  },
  {
    id: 'menagerie',
    title: 'Menagerie: buying and borrowing owls',
    blocks: [
      'At the top are the loan owls of the day, below them all owls for sale – sorted by price, the cheapest first. A short description of every owl for sale tells you where it comes from and what kind of character it is.',
      `Buying: all ${SPECIES.length} species are always available. After buying, you give your owl a name – its randomly rolled sex is already shown then; its energy starts between ${percent(OWL.START_ENERGY_MIN_SHARE)} and ${percent(OWL.START_ENERGY_MAX_SHARE)}.`,
      `Borrowing: every day at midnight (UTC) there are ${MENAGERIE.OFFER_SPECIES_COUNT} species to borrow, for ${gold(GOLD.LOAN_PRICE)} per owl – each with a different name. Species and names do not repeat on the two following days – so you never meet the same loan owl two days in a row. You can borrow each owl on offer once a day, so up to ${MENAGERIE.LOANS_PER_DAY} a day – even if loan owls from yesterday are still waiting with you. As soon as new owls are offered at midnight, you can borrow all of them. You can borrow here or right when writing a letter if none of your own owls is there. The phoenix is never offered.`,
      `A loan owl carries a letter to up to ${LETTER.MAX_RECIPIENTS} recipients one after another, or gold to one recipient, and is gone after the last one – it only comes back if someone hands it a reply. If you do not send it off within ${MENAGERIE.LOAN_EXPIRY_HOURS} hours, it vanishes again and the gold is spent. If you chose a rest and a recipient hands it a reply, it brings that to you first. It can be cared for like any owl, but not renamed or given away. Its motivation is between 80% and 100%.`,
      `Tip for the start: with ${gold(GOLD.START)} starting gold you borrow an owl for your first letter. For the cheapest owl of your own (${CHEAPEST.nameEn}, ${CHEAPEST.price} gold) you will have enough after a day or two.`,
    ],
  },
  {
    id: 'arten',
    title: 'Owl species at a glance',
    blocks: [
      'Price in gold, maximum energy, speed and recovery per hour (with motivation 100%):',
      SPECIES.map(
        (species) =>
          `${species.nameEn}: ${species.price} gold, ${species.maxEnergy} energy, ${decimalEn(FLIGHT.BASE_SPEED_KMH * species.speedFactor)} km/h, recovery ${decimalEn(OWL.REGEN_SHARE_PER_HOUR * 100 * species.recoveryFactor)} % per hour`,
      ),
      `The phoenix is no ordinary owl: it costs ${SPECIES.find((species) => species.id === 'phoenix')?.price ?? 100} gold, flies four times as fast as an owl with factor 1, is never lent out, does not help out in the Menagerie and lays no eggs.`,
      'The Great Horned Owl (1,300 energy, 85 km/h, 20 % recovery per hour) is not for sale in the Menagerie: it only comes as the owl of a pen friend, as a gift from a bot or with a voucher. Like the phoenix it is never lent out, does not help in the Menagerie and lays no eggs.',
    ],
  },
  {
    id: 'verleih',
    title: 'Lending owls to the Menagerie',
    blocks: [
      `Healthy adult owls that are at home can be lent to the Menagerie for ${OWL.MENAGERIE_DAYS} days (not the phoenix). Afterwards you get ${percent(GOLD.MENAGERIE_WAGE_SHARE)} of the species price as a wage, and the owl comes back with full energy. Meanwhile it is not available and does not fall ill.`,
    ],
  },
  {
    id: 'krankheit',
    title: 'Illnesses',
    blocks: [
      `Every night an adult owl can fall ill with a probability of 1 in 30 – with the care bonus (see Energy and care) much less often. During its first ${OWL.SICKNESS_GRACE_DAYS} days with you it never falls ill. Loan owls, chicks and bot owls never fall ill, and neither do the owls of inactive accounts.`,
      'An ill owl looks grumpy and cannot fly until it has been cured. Care still works.',
      [
        `Nurse it yourself: ${gold(GOLD.SELF_CARE_PRICE)} for special food, after ${OWL.SELF_CARE_DAYS} days it is healthy.`,
        `Owl vet: ${gold(GOLD.VET_PRICE)}, after ${OWL.VET_HOURS} hours it is healthy.`,
      ],
      'If an owl falls ill on its way, you notice when it comes home.',
    ],
  },
  {
    id: 'kueken',
    title: 'Eggs and chicks',
    blocks: [
      `Female owls sometimes lay eggs after coming home (about one time in a hundred; the phoenix never does). They then brood for ${OWL.BROODING_DAYS} days; afterwards ${OWL.CHICKS_MIN} to ${OWL.CHICKS_MAX} chicks hatch.`,
      `You name the chicks within ${OWL.CHICK_NAME_DEADLINE_HOURS} hours, otherwise they get random names. With ${OWL.CHICK_GIFT_FROM_COUNT} or more chicks you have to give exactly one to a contact within ${OWL.CHICK_GIFT_DEADLINE_HOURS} hours, with a cover letter if you like. Otherwise lots are drawn among your active contacts. If you have none, you may keep them all.`,
      `Chicks fly at a leisurely ${FLIGHT.CHICK_SPEED_KMH} km/h, one hour of flying, one hour of rest. They can be cared for like any owl but do not carry letters. They grow up with you after ${OWL.CHICK_ADULT_AT_MOTHER_DAYS} days, with the recipient of a gift ${OWL.CHICK_ADULT_AT_RECIPIENT_DAYS} days after arriving.`,
    ],
  },
  {
    id: 'bots',
    title: 'Bots: the Explainer Bear and other pen friends',
    blocks: [
      'Bots are pen friends who write using AI. You find them in your correspondence, clearly marked “Bot”, and as a diamond on the map – they are never in the address book. You write to them in their chat.',
      [
        `Explainer Bear: your own bot from the start. He lives in Berlin, sends you short guides during the first week and answers questions about PostEulen – but only those. His owls fly at ${BOTS.EXPLAINER_SPEED_KMH} km/h. About ${BOTS.REPLY_AFTER_HOURS} hours after your letter arrives, he writes back, at most ${BOTS.EXPLAINER_REPLY_MAX_CHARS} characters. He appears on the map as soon as you write to him for the first time.`,
        'Other bots: characters created by the operator of your PostEulen instance in the bots control centre. They can live anywhere in the world and even move house. Such a bot only appears for you once its first letter has reached you. It writes its letters to all players at set times; sometimes up to two pictures come with them, sometimes it brings gold or an owl.',
      ],
      'You can write one letter a calendar day to every bot (the day changes at midnight UTC); the app shows from when again. That also applies to the Explainer Bear.',
      `How other bots reply: usually they take up your lines in their next planned letter – the letter stays the same but gets a personal part for you. If they have nothing planned for the next four weeks, they reply to you directly after about ${BOTS.REPLY_AFTER_HOURS} hours.`,
      'Bots have owls of their own or send loan owls. A bot’s owl often waits with you for a while (“Visiting you” under “Owls”). While it is there, you can hand it a reply – then it takes off at once. Whether you can also write to a bot with your own owls or loan owls is up to the bot; the chat tells you. You can give a bot owl water, pet it and feed it like every visiting owl – for a bot owl it costs nothing, not even the owl biscuit and the snack. That gives it energy for the way home and perks it up, up to 120 % motivation at most; you do not see the motivation of bot owls.',
      'The bots write to you in the language of your account. Letters that have already arrived stay in the language they were written in.',
      en.bots.notice,
      'Only the texts go to OpenAI, no names and no identifiers. Every bot remembers a short summary of your letters – only yours; it disappears when you delete the chat.',
      'You remove a bot in its chat (“Remove …”). All of them at once – the Explainer Bear and every bot there will ever be, too – you remove in the settings with “Remove all bots”. Both are final: chat, summary and any letters and gifts still outstanding are gone then, and the bots never write to you again. If the operator deletes a bot, you get a system message if you had contact with it.',
    ],
  },
  {
    id: 'benachrichtigungen',
    title: 'Notifications',
    blocks: [
      'Notifications are the small notes that pop up at the top of your phone screen. PostEulen can use them to let you know when an owl lands with a letter, one of your owls comes home, gold arrives, a gift turns up, eggs are laid, chicks hatch, a contact’s owl rests with you, automatic deletion is near or the admin writes to everyone. Notifications never contain names or content – anyone looking over your shoulder learns nothing.',
      'It works best if you have put PostEulen on your home screen (see “Getting PostEulen onto your phone”): on Android with Chrome and on the iPhone with Safari. In a normal browser or as a bookmark there are no notifications – your post reaches you anyway, you see it the next time you look in. A real letterbox does not ring either.',
      `You can set them up in the settings under “Notifications”. Tap “Set up notifications” and allow them when your phone asks. PostEulen then sends a test message straight away. If it arrives, it says “active and confirmed”. With “Send a test notification” you can repeat that – together with setting up, up to ${SECURITY.PUSH_CHANGES_PER_HOUR} times an hour.`,
      'By the way, PostEulen never asks for new letters in the background – that saves your battery. The message comes from the server as soon as something happens.',
      'Notifications are shown in the language of your account.',
      en.push.iosHint,
      `For advanced users – ${en.push.degoogledTitle}:`,
      en.push.degoogled1,
      en.push.degoogled2,
      en.push.degoogled3,
      en.push.degoogled4,
    ],
  },
  {
    id: 'einstellungen',
    title: 'Settings and account',
    blocks: [
      [
        `Change user name: once per calendar year. Your current name is shown right there. Your contacts are told by system message; the old name is locked for ${ACCOUNT.NAME_LOCK_DAYS} days.`,
        `Change home: up to ${ACCOUNT.HOME_CHANGES_PER_MONTH} times per calendar month, however close together. Owls on their way change course.`,
        'Change password: old password once, new one twice. All letters stay readable.',
        'Letters: have your own letters and system messages deleted after 30, 90 or 180 days instead of after one year; show letters in print instead of handwriting; the switch “Links in letters clickable” decides whether links in letters can be tapped (default: on).',
        'Language: German or English, for this account on every device.',
        'Notifications: see the status and test them.',
        'Bots: “Remove all bots” takes the Explainer Bear and all other bots out of your game for good – with their chats, also bots that only come later. This cannot be undone.',
        `Message to the admin (at the very bottom): for technical problems or suggestions, send the admin of your PostEulen instance a short message – at most ${FEEDBACK.MAX_CHARS} characters, one a day (the day changes at midnight UTC). It is not encrypted, lies readable on the server without your name and is deleted after ${FEEDBACK.RETENTION_DAYS} days. So do not write anything confidential in it.`,
        `Redeem a voucher: if the operator of your PostEulen instance has given you a voucher, type its code here. A voucher brings gold or a new owl, is valid for ${VOUCHER.VALID_DAYS} days and can be redeemed once.`,
        `Delete account: confirm with your password. If you sign in again within ${ACCOUNT.SELF_DELETE_GRACE_HOURS} hours, the deletion is cancelled. After that everything is deleted for good; whatever others have already received from you stays with them.`,
        'Sign out: removes all keys from this device, and PostEulen forgets everything about your account that it remembered in this window.',
      ],
    ],
  },
  {
    id: 'inaktiv',
    title: 'Inactivity and automatic deletion',
    blocks: [
      `If you have not been in the app for more than ${ACCOUNT.INACTIVE_AFTER_DAYS} days, your account counts as inactive: contacts see “inactive” and cannot send you anything, you get no daily gold, and your owls do not fall ill. Letters from the bots and deliveries already on their way still arrive. As soon as you open the app, you are active again.`,
      `After a longer period of inactivity the account is deleted automatically. The operator sets the period (at least ${ACCOUNT.AUTO_DELETE_MIN_DAYS}, usually ${ACCOUNT.AUTO_DELETE_DEFAULT_DAYS} days). You get a warning ${ACCOUNT.AUTO_DELETE_WARNING_DAYS} days before.`,
    ],
  },
  {
    id: 'offline',
    title: 'Without a network',
    blocks: [
      'Without a connection PostEulen shows “No connection – owls need a network” and blocks all actions. As soon as the network is back, everything carries on. Letters are never stored unencrypted on your device.',
    ],
  },
  {
    id: 'krise',
    title: 'If you are not feeling well',
    blocks: [en.bots.crisis],
  },
];

const FAQ: readonly HelpQuestion[] = [
  {
    question: 'I cannot find PostEulen in the app store. Have I done something wrong?',
    answer:
      'No, all is well! PostEulen is not in the app store on purpose. You put it on your home screen straight from the browser and still get a real app with an owl icon – “Getting PostEulen onto your phone” explains how.',
  },
  {
    question: 'Is PostEulen suitable for children?',
    answer:
      'Quite possibly – PostEulen is a great way to introduce children gently to messengers. Because letters take hours to arrive, there is no constant typing and no pull to keep checking. And only people who have entered each other with the exact name in the address book can write: strangers cannot contact your child. The pen friends – the Explainer Bear and other bots – reply using AI; if you do not want that, remove them in the settings with “Remove all bots”.',
  },
  {
    question: 'What does PostEulen cost?',
    answer: `Nothing. PostEulen is free, without adverts and without a paywall – and it will stay that way. Servers and development still cost money, though. That is why every five weeks we kindly ask for a voluntary donation via ${DONATION.URL.replace('https://', '')}; you also find the link at the bottom of the start page under “Donate”. Nobody has to give anything.`,
  },
  {
    question: 'I have forgotten my password. What now?',
    answer:
      'Sadly it cannot be reset because it is not stored anywhere – that is the price of real encryption. Create a new account and pair again.',
  },
  {
    question: 'Why does my letter not arrive immediately?',
    answer:
      'Owls need time. The flight time depends on distance, species and energy: at night owls save energy, and an owl that runs out of energy takes a nap on the way. You see the arrival time on the letter.',
  },
  {
    question: 'I cannot find my friend.',
    answer:
      'You both have to enter each other with the exact name. For privacy reasons PostEulen never says whether a name exists. Check the spelling and enter each other within 24 hours.',
  },
  {
    question: 'Can I use PostEulen on several devices?',
    answer:
      'Only one after another: signing in on a new device signs you out on the old one. All letters and keys are then on the new device too.',
  },
  {
    question: 'Why have my smileys disappeared?',
    answer: 'Parchment knows no smileys. Emojis and invisible special characters are removed.',
  },
  {
    question: 'I do not get any notifications.',
    answer:
      'Open the settings and send a test notification. Notifications only work if PostEulen is on your home screen as an app – on Android with Chrome, on the iPhone with Safari. For phones without Google services there is a separate way under “Notifications”. Letters arrive without notifications too – you see them when you open the app.',
  },
  {
    question: 'I have run out of gold.',
    answer: `You get gold every day as long as you are active: ${gold(GOLD.DAILY)} during the first ${GOLD.DAILY_HIGH_DAYS} days, then ${gold(GOLD.DAILY_LATER)}. Small letters are free; only owls, borrowing, owl biscuits, favourite snacks, large parchment and treatments cost gold.`,
  },
  {
    question: 'Why is my owl slower (or faster) than usual this time?',
    answer:
      'That is its motivation: it drops a little every night and rises when you give your owl water, pet it, give it an owl biscuit or its favourite snack – each kind once a day. It counts for the next leg: at take-off from home and again whenever the owl flies on from a recipient. With 120% the owl flies 20% faster and further, with 80% correspondingly slower.',
  },
  {
    question: 'Can the operator read my letters?',
    answer:
      'Letters between people, no – they are end-to-end encrypted. Letters to bots and system messages, yes. The server also sees who writes to whom and when.',
  },
  {
    question: 'Where have my old letters gone?',
    answer:
      'Letters and system messages are deleted automatically one year after delivery at the latest – or sooner if you have set that in the settings. They cannot be restored.',
  },
  {
    question: 'Is PostEulen just a game, or can I really write confidentially with it?',
    answer:
      'Both. The owls are a game; the encryption is serious and state of the art. Nobody but the two of you can read letters between people, not even the operator. Compare your safety number, and you are on the safe side.',
  },
  {
    question: 'Can I recall or edit a letter?',
    answer:
      'No, sent is sent. But with “Burn all letters” you can delete your copies of a chat – the other person keeps theirs.',
  },
  {
    question: 'Something does not work, or I have an idea. Whom do I tell?',
    answer: `The admin of your PostEulen instance: at the very bottom of the settings there is “Message to the admin”. There you write up to ${FEEDBACK.MAX_CHARS} characters, one message a day. It is not encrypted and arrives without your name – if you would like an answer, say in the message how to reach you (or better not). For questions about using the app, the Explainer Bear helps too.`,
  },
  {
    question: 'Why does the app have a German name?',
    answer:
      'PostEulen was made in Germany; the name means “post owls”. Everything in the app is available in English – just tap the British flag in the top right corner.',
  },
];

export const HELP_EN: Help = {
  intro: INTRO,
  sections: SECTIONS,
  faq: FAQ,
  words: { faq: 'Frequently asked questions', question: 'Question', answer: 'Answer' },
};
