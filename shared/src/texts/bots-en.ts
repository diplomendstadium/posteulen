/**
 * Fixed letters of the bots in English (v0.4) – the same letters as in bots.ts, for accounts
 * using the English view. Small parchment (at most 800 characters), no names of the user.
 * Placeholders: {aunt}, {uncle} (first names of the bots), {name} in the titles.
 */
import type { BotLetters } from './bots.ts';

export const BOT_LETTERS_EN: BotLetters = {
  titles: {
    explainer: 'Explainer Bear',
    aunt: 'Aunt {name}',
    uncle: 'Uncle {name}',
  },
  explainer: {
    day0: `Hello and welcome to PostEulen!

I am the Explainer Bear, and over the next few days I will send you a few short letters.

At the bottom you will find the most important places: Letters, Owls, Address book and Map. You start with 3 gold. Your own owl costs 6 gold or more, but during your first 30 days you get 3 gold every day, and 2 gold after that. Until then, borrow a loan owl for 0.1 gold – in the Menagerie or right when you write a letter.

Important: all letters are deleted automatically and for good one year after delivery at the latest, this one too. In the settings you can have them deleted even sooner.

Questions about PostEulen? Just write to me! Once you have, you will find me on your map as well.`,
    day1: `Hello, today I will tell you a little magic trick!

PostEulen is not in any app store – and yet you can put it on your phone like an app. Simply add it to your home screen:

Android with Chrome: tap the three dots in the top right corner, then "Add to Home screen" or "Install app".

iPhone with Safari: tap the share icon (a square with an arrow; on newer iPhones it hides behind the three dots at the bottom right), then "Add to Home Screen".

After that an owl lives on your home screen, and notifications work too. With other browsers it works as a bookmark, just without notifications. A real letterbox does not ring either.

Your Explainer Bear`,
    day2: `Hello, today is all about gold!

Your finances show how much gold you have and your latest bookings. You can send gold to your contacts by owl.

In the Menagerie you buy your own owls or borrow one. Every day there are four new loan owls, and you can borrow each of them once that day. If you have an owl to spare, you can lend it to the Menagerie for 7 days and get 10 % of its price afterwards.

By the way: the little flag in the top right corner switches PostEulen to German and back. Something not working, or an idea? At the very bottom of the settings you can send the admin a short message.

Happy saving, your Explainer Bear`,
    day3: `Hello, today is all about owls!

Every owl has energy. At night it needs 1 point per kilometre, by day 1.5. When it is empty, it sleeps and recovers just as at home – but only until it has the strength for its next destination. Over water it keeps flying until it finds land.

At home it recovers by itself. When writing, you choose how long it rests with each recipient – then it can bring you a reply straight away. The map shows where your owls are right now, the way they have already flown and where it is night. A "Zzz" marks where an owl spent the night.

See you soon, your Explainer Bear`,
    day4: `Hello, today is all about contacts!

Add friends in the address book: you both enter each other's exact name. Only then can you write to each other.

Your letters to people are end-to-end encrypted: only the two of you can read them. That is no game but real, modern cryptography – so PostEulen is fine for confidential things too. Ideally, compare your safety number once, for example the next time you meet.

If a link says “Unusual characters in the address” next to it, look closely: some letters from other alphabets look just like ours.

By the way, letters to bots like me are not encrypted. And remember: after one year at the latest, all letters vanish by themselves.

Your Explainer Bear`,
    day7: `Hello, today is all about care!

Give your owls water, pet them, treat them to an owl biscuit or their favourite snack. That raises their motivation, and motivated owls fly their next leg faster and further – other people's owls resting with you, too. If an owl gets two different kinds of care on 10 of the last 14 days at home, it falls ill much less often. Travel days do not count. If an owl is ill, nurse it back to health yourself or take it to the owl vet.

Sometimes an owl lays eggs. With two or three chicks, you give one of them to a contact.

That was the last letter of my series. I am happy to answer your questions!

Your Explainer Bear`,
  },
  aunt: {
    welcome: `Hello, my dear!

This is your Aunt {aunt} writing. We are distantly related, through a few branches of the family tree and an old cauldron.

My little cottage is often quiet, and to be honest I am a little bored. If you are looking for someone to chat with: write to me! I am happy to reply.

Warmly, your Aunt {aunt}`,
    gold: `Hello, my dear!

I hear you would like to buy your very first owl soon. So I am putting 4 gold in this letter. I hope it helps a little.

Take good care of your owl, and tell me what it is called!

Your Aunt {aunt}`,
  },
  uncle: {
    first: `Well, hello there!

This is your Uncle {uncle}. Yes, that one! We haven't seen each other for ages, which is probably my fault.

I have a lot of time right now and even more ideas. If you like, write to me. I promise to reply most of the time.

Your Uncle {uncle}`,
    gold: `Well, hello there!

Imagine: a great-uncle three times removed left me something. Sadly it was not a castle but a sack of gold and a very offended goat.

I am keeping the goat. The whole family gets some of the gold, so you get 10 gold. Spend it wisely. Or foolishly, as long as it makes you happy!

Your Uncle {uncle}`,
  },
};
