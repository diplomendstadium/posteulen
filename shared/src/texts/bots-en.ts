/**
 * Fixed letters of the bots in English (v0.4) – the same letters as in bots.ts, for accounts
 * using the English view. Small parchment (at most 800 characters), no names of the user.
 */
import type { BotLetters } from './bots.ts';

export const BOT_LETTERS_EN: BotLetters = {
  titles: {
    explainer: 'Explainer Bear',
  },
  explainer: {
    day0: `Hello and welcome to PostEulen!

I am the Explainer Bear, and over the next few days I will send you a few short letters.

At the bottom you will find the most important places: Letters, Owls, Address book and Map. You start with 3 gold. Your own owl costs 6 gold or more, but during your first 30 days you get 3 gold every day, and 2 gold after that. Until then, borrow a loan owl – at the post office or right when you write a letter.

Important: your letters are deleted automatically and for good 180 days after delivery, this one too. In the settings you choose 30, 90, 180 days or one year.

Questions about PostEulen? Just write to me – you will find me under Letters! Once you have, you will find me on your map as well.`,
    day1: `Hello, today I will tell you a little magic trick!

PostEulen is not in any app store – and yet you can put it on your phone like an app. Simply add it to your home screen:

Android with Chrome: tap the three dots in the top right corner, then “Add to Home screen” or “Install app”.

iPhone with Safari: tap the share icon (a square with an arrow; on newer iPhones it hides behind the three dots at the bottom right), then “Add to Home Screen”.

After that an owl lives on your home screen, and notifications work too. With other browsers it works as a bookmark, just without notifications. A real letterbox does not ring either.

Your Explainer Bear`,
    day2: `Hello, today is all about gold!

You see your gold at the top right and your bookings in the settings. Owls that can carry gold have the button “Send gold” in your owl overview.

In the Menagerie you buy owls; at the post office one of four owl teams is on duty every day, drawn just for you – step inside and borrow its owls. Small owls carry short parchment only, only strong ones also carry gold. An owl you have to spare can be lent to the Menagerie for 7 days, and you get 10% of its price afterwards.

By the way: the little flag in the top right corner switches PostEulen to German and back. Something not working, or an idea? At the very bottom of the settings you can send the admin a short message.

Happy saving, your Explainer Bear`,
    day3: `Hello, today is all about owls!

Every owl has energy. At night it needs 1 point per kilometre, by day 1.5. When it is empty, it sleeps and recovers just as at home – but only until it has the strength for its next destination. Over water it keeps flying until it finds land.

At home it recovers by itself. When writing, you choose how long it rests with each recipient – then it can bring you a reply straight away. Once an owl is ready, you can also send it off straight from the owl overview with “Write a letter”. On the way each owl tells you its next stop with the time, and the map – it looks like an old atlas – shows where it is right now.

See you soon, your Explainer Bear`,
    day4: `Hello, today is all about contacts!

Add friends in the address book: you both enter each other’s exact name. Only then can you write to each other.

Your letters to people are end-to-end encrypted: only the two of you can read them. That is no game but real, modern cryptography – so PostEulen is fine for confidential things too. Ideally, compare your safety number once, for example the next time you meet.

If a link says “Unusual characters in the address” next to it, look closely: some letters from other alphabets look just like ours.

By the way, letters to bots like me are not encrypted. From the first Sunday of Advent to Boxing Day you write on Christmas parchment. And after one year at the latest, all letters vanish by themselves.

Your Explainer Bear`,
    day7: `Hello, today is all about care!

Give your owls water, pet them, treat them to an owl biscuit or their favourite snack. That raises their motivation, and motivated owls fly their next leg faster and further – other people’s owls resting with you, too. If an owl gets two different kinds of care on 10 of the last 14 days at home, it falls ill much less often. Travel days do not count. If an owl falls ill, you nurse it back to health in the rescue centre.

Sometimes an owl lays eggs – more often if a male of her species lives with you. With two or three chicks, you give one of them to a contact – you have five days for that and for the names.

That was the last letter of my series. I am happy to answer your questions!

Your Explainer Bear`,
  },
};
