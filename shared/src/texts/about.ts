/**
 * The info text "Über PostEulen" at the bottom of the start page (SPEC 8.1), in German and
 * English. Written in the small Markdown subset of `shared/src/markdown.ts`:
 *
 * - `# Heading` – a heading of the box,
 * - paragraphs separated by a blank line, inside them `**bold**`, `*italic*`, links to pages
 *   of the app (`[Hilfe](/hilfe)`) and the one link to the donation page (`[Spende](donate)`),
 * - `![picture](left|right)` on a line of its own – a picture floating at half the width of the
 *   text, the following text flows around it. Pictures: `desk`, `menagerie`, `post` (they
 *   follow day, night, season and Christmas at home like everywhere in the app), `homecoming`
 *   (a southern white-faced owl coming home, by day or by night) and `feeding` (an elf owl at
 *   its meal).
 *
 * `{host}` is replaced by the address the page was opened with.
 */

export const ABOUT_DE = `# Über PostEulen

![desk](right)

Weißt du noch, wie schön es war, einen richtigen Brief im Briefkasten zu finden? PostEulen holt dieses Gefühl zurück. Deine Nachrichten flitzen nicht in Millisekunden durchs Netz, sondern werden von einer Eule gebracht – und die hat, ganz Eule, ihren eigenen Kopf: Je nach Entfernung, Tageszeit und Kondition ist sie ein paar Stunden unterwegs. Nachts fliegt sie lieber (weniger anstrengend), über dem Meer hält sie tapfer durch, und wenn sie gar nicht mehr kann, macht sie ein Nickerchen – genau so lange, bis die Kraft bis zum nächsten Ziel reicht. Auf der Karte kannst du ihr dabei zusehen.

![homecoming](left)

Du kannst dir Eulen in der Menagerie kaufen oder leihst sie dir im Eulenpostamt. Du kannst ihnen Namen geben, Wasser hinstellen, sie streicheln und sie mit Eulenkeksen oder ihrem Lieblingsleckerli verwöhnen. Zwanzig Eulenarten wohnen derzeit in der Menagerie, vom winzigen Elfenkauz über die rostrote Ostkreischeule und die Zypern-Zwergohreule bis zum mächtigen Virginiauhu. Nicht jede trägt alles: Kleine Eulen schaffen nur ein kurzes Pergament, mittlere auch ein langes, und nur die kräftigen Eulen tragen außerdem Gold. Gepflegte Eulen sind motivierter und fliegen die nächste Strecke schneller und weiter – vernachlässigte schauen grummelig drein. Gut umsorgte Eulen werden außerdem seltener krank, und mit etwas Glück legt eine eines Tages Eier – noch eher, wenn ein Eulenmann ihrer Art mit ihr zu Hause wohnt. Die Küken päppelst du mit Streicheleinheiten und Mehlwürmern auf. Kranke und verletzte Eulen pflegst du in der Eulenrettungsstation gesund; manche wilde Eule bleibt danach sogar als Posteule bei dir.

![menagerie](right)

Gold gibt es jeden Tag automatisch, und ein paar optionale Brieffreunde sind auch mit von der Partie: ein geduldiger Erklärbär, der dir PostEulen erklärt, ein Eulenforscher, der von seinen Reisen berichtet, und eine entfernte Tante, die ab und zu etwas Gold schickt. Sie wohnen irgendwo auf der Welt, schreiben allen zu besonderen Momenten, legen manchmal Bilder oder ein kleines Geschenk bei und gehen in ihrem nächsten Brief persönlich auf deine Antwort ein.

![post](left)

# Ein guter erster Messenger für Kinder

PostEulen eignet sich auch prima, um Kinder behutsam an Messenger heranzuführen: Es gibt keinen Sog, keine Dauerbereitschaft. Briefe sind Stunden unterwegs. Niemand wartet auf eine Sofortantwort, und es gibt nichts, das zum ständigen Nachsehen verleitet – die Eule kommt, wann sie kommt. Es ist kein eigenes Handy nötig. PostEulen läuft ganz normal im Webbrowser – auch auf dem Handy, Tablet oder Computer der Eltern. Das Kind meldet sich dort mit seinem eigenen Konto an und danach wieder ab; ein eigenes Smartphone braucht es dafür nicht. Es gibt keine Kontaktmöglichkeiten für Fremde. Schreiben kann nur, wer sich gegenseitig mit dem genauen Namen im Adressbuch eingetragen hat. Eine Suche nach anderen gibt es nicht, und Anfragen Unbekannter sind unsichtbar. Eltern behalten so den Überblick, wer ihrem Kind schreiben kann. Und weil PostEulen auch im Graustufenmodus des Geräts tadellos funktioniert, lässt sich die bunte Reizüberflutung ganz einfach abschalten.

Stehen Ferien, Urlaub oder eine Prüfungsphase an, gibt es den Urlaubsmodus: Bis zu dreimal im Jahr erholen sich die Eulen bis zu sechs Wochen lang in einer Eulenpflegestation auf einer kleinen schottischen Insel. In dieser Zeit muss sich niemand anmelden, und es entstehen keinerlei Nachteile – die Eulen sind bestens versorgt und pünktlich zum Ende wieder zu Hause.

**Selbstverständlich gibt es auch keine In-App-Käufe.**

Die Brieffreunde – der Erklärbär und andere Bots – antworten per KI. Wer das nicht möchte, entfernt sie in ihrem Briefwechsel – oder alle auf einmal, endgültig und auch für künftige Bots, in den Einstellungen („Alle Bots entfernen“). Ins Adressbuch kommen sie gar nicht erst; dort stehen nur echte Menschen.

# Spiel? Messenger? Beides – und zwar ernsthaft sicher.

![feeding](right)

PostEulen bewegt sich bewusst im Grenzbereich zwischen Spiel und Messenger. Die Eulen sind Spiel. Die Verschlüsselung ist es nicht. Unter der Pergamentoberfläche arbeitet harte, seriöse Kryptografie auf dem Stand der Zeit: Briefe zwischen Menschen werden auf deinem Gerät verschlüsselt. Den Schlüssel bekommen nur Absender und Empfänger. Dein Passwort verlässt nie dein Gerät – schon beim Erstellen achtet PostEulen darauf, dass es nicht dein Nutzername und kein bekanntes Allerwelts-Passwort ist. Der Server kann dein Passwort weder sehen noch aus einer gestohlenen Datenbank erraten. Eine Sicherheitsnummer zeigt euch, dass niemand dazwischensitzt. Dein Gerät vergleicht die Schlüssel deiner Kontakte außerdem vor jedem Brief und beim Öffnen eines Briefwechsels und schlägt Alarm, wenn etwas nicht stimmt. Verkleidete Links fallen auf. Sieht eine Adresse nur so aus wie eine bekannte – etwa mit einem kyrillischen „а“ statt „a“ –, zeigt PostEulen sie in ihrer technischen Form und mit einem Warnhinweis. Es gibt nur eine gültige Sitzung. Dein Konto ist immer nur auf einem Gerät angemeldet. Meldet sich jemand mit deinem Passwort an, fliegst du raus. Wirst du ständig ausgeloggt, obwohl du dich nirgendwo sonst anmeldest, benutzt vermutlich jemand dein Passwort. Dann sofort ändern. Wer mag, schaltet ein zweites Schloss ein: Mit der Zwei-Faktor-Anmeldung braucht es zum Anmelden außer dem Passwort einen Code aus einer App wie KeePassXC, Aegis oder FreeOTP.

Es gibt bewusst keine Lesebestätigungen. Dein Gegenüber sieht nur, dass sein Brief zugestellt wurde – ob und wann du ihn gelesen hast, bleibt dein Geheimnis. Es gibt keine Werbung, kein Tracking, keine gespeicherten IP-Adressen, keine Inhalte von fremden Servern. Du brauchst weder einen Klarnamen noch eine E-Mail-Adresse oder Telefonnummer, um dich anzumelden. Du kannst unter einem Pseudonym spielen und einen fiktiven Wohnort wählen. Auch eine Nutzung über VPN, das Tor-Netz oder den Tor-Browser ist möglich.

# Wie kommt PostEulen aufs Handy? Ganz ohne App-Store!

Apps holt man sich im App-Store, oder? Meistens schon. PostEulen gibt es dort aber absichtlich nicht – und trotzdem wird es eine richtige App mit eigenem Eulen-Symbol. Der Trick: Manche Webseiten können sich in eine App verwandeln (Fachleute sagen „Progressive Web App“, das Wort darf man aber sofort wieder vergessen). Man legt sie einfach auf den Startbildschirm. Es wird nichts heimlich installiert, die App will weder Fotos noch Telefonbuch, und Updates kommen von selbst.

**Android mit Chrome:** {host} öffnen → oben rechts auf die drei Punkte ⋮ → „Zum Startbildschirm hinzufügen“ → „Installieren“ (manchmal heißt es direkt „App installieren“).

**iPhone oder iPad mit Safari:** {host} öffnen → Teilen-Symbol (Quadrat mit Pfeil; bei neueren iPhones hinter den drei Punkten ••• unten rechts) → „Zum Home-Bildschirm“ → „Hinzufügen“. Danach PostEulen immer über das neue Symbol öffnen.

**Alle anderen Handys, Firefox und der Computer:** einfach als Lesezeichen auf den Startbildschirm legen oder ganz normal im Browser benutzen. Alles funktioniert genauso. Der einzige Unterschied: Benachrichtigungen („Eine Eule ist gelandet!“) gibt es nur in der App auf dem Startbildschirm von Android/Chrome und iPhone/Safari. Im Browser kommt die Post trotzdem an – man sieht sie beim nächsten Hineinschauen. Im echten Leben klingelt der Briefkasten ja auch nicht.

# Wer bezahlt das eigentlich?

PostEulen ist ein Hobbyprojekt, das aber leider echtes Geld kostet. Derzeit belaufen sich die Kosten für Entwicklung und Betrieb auf ungefähr 25 € pro Monat. Mit jedem weiteren aktiven Konto steigen die Kosten ein bisschen. Wenn es dir auch wichtig ist, dass wir PostEulen auch zukünftig anbieten können, kannst du uns [hier](donate) mit einer Spende unterstützen. Jede Spende hilft, PostEulen weiterhin online und für alle frei zugänglich zu halten. Danke!

# Hilfe

Die [Hilfe](/hilfe) in der App erklärt alles Weitere, und der Erklärbär beantwortet noch offene Fragen gerne per Brief.
`;

export const ABOUT_EN = `# About PostEulen

![desk](right)

Remember how lovely it was to find a real letter in the letterbox? PostEulen brings that feeling back. Your messages do not dash through the net in milliseconds; they are brought by an owl – and the owl, being an owl, has a mind of its own: depending on distance, time of day and fitness, it is on its way for a few hours. It prefers flying at night (less tiring), it bravely keeps going over the sea, and when it really cannot go on, it takes a nap – just long enough to have the strength for its next destination. You can watch it on the map.

![homecoming](left)

You can buy owls in the Menagerie or borrow them at the owl post office. You can give them names, put out water for them, pet them and spoil them with owl biscuits or their favourite snack. Twenty owl species currently live in the Menagerie, from the tiny Elf Owl via the rust-red Eastern Screech Owl and the Cyprus Scops Owl to the mighty Great Horned Owl. Not every owl carries everything: small owls only manage a short parchment, medium ones a long one as well, and only the strong owls also carry gold. Cared-for owls are more motivated and fly their next leg faster and further – neglected ones look grumpy. Well looked-after owls also fall ill less often, and with a bit of luck one of them lays eggs one day – all the more if a male of her species lives at home with her. You feed the chicks up with cuddles and mealworms. Ill and injured owls get nursed back to health in the owl rescue centre; some wild owls even stay with you as a post owl afterwards.

![menagerie](right)

You get gold every day automatically, and a few optional pen friends join in, too: a patient Explainer Bear who explains PostEulen to you, an owl researcher who tells you about his travels, and a distant aunt who sends a little gold now and then. They live somewhere in the world, write to everyone at special moments, sometimes add pictures or a small gift and take up your reply personally in their next letter.

![post](left)

# A good first messenger for children

PostEulen is also a great way to introduce children gently to messengers: there is no pull and no constant availability. Letters take hours to arrive. Nobody waits for an instant reply, and there is nothing that tempts you to keep checking – the owl arrives when it arrives. No phone of their own is needed. PostEulen runs in an ordinary web browser – also on a parent’s phone, tablet or computer. The child signs in there with their own account and signs out again afterwards; they do not need a smartphone of their own. Strangers have no way of getting in touch. Only people who have entered each other with the exact name in the address book can write. There is no search for other users, and requests from strangers are invisible. This way parents keep track of who can write to their child. And because PostEulen works perfectly in the device’s greyscale mode, the colourful overload can simply be switched off.

When holidays, a trip away or exams come up, there is holiday mode: up to three times a year the owls relax for up to six weeks at an owl care station on a little Scottish island. Nobody has to sign in during that time, and there are no drawbacks at all – the owls are well looked after and home again exactly when it ends.

**Of course there are no in-app purchases either.**

The pen friends – the Explainer Bear and other bots – reply using AI. If you do not want that, remove them in their correspondence – or all at once, for good and for future bots too, in the settings (“Remove all bots”). They never appear in the address book; only real people are listed there.

# Game? Messenger? Both – and seriously secure.

![feeding](right)

PostEulen deliberately sits on the border between game and messenger. The owls are the game. The encryption is not. Beneath the parchment surface, hard, serious, up-to-date cryptography is at work: letters between people are encrypted on your device. Only sender and recipient get the key. Your password never leaves your device – and when you choose it, PostEulen makes sure it is not your user name or a well-known everyday password. The server can neither see your password nor guess it from a stolen database. A safety number shows you that nobody is sitting in between. Your device also compares your contacts’ keys before every letter and when you open a conversation, and raises the alarm if something is wrong. Disguised links stand out. If an address only looks like a familiar one – say, with a Cyrillic “а” instead of an “a” – PostEulen shows it in its technical form, with a warning. There is only one valid session. Your account is only ever signed in on one device. If someone signs in with your password, you are thrown out. If you keep getting signed out although you do not sign in anywhere else, someone is probably using your password. Change it at once. If you like, switch on a second lock: with two-factor sign-in, signing in needs a code from an app such as KeePassXC, Aegis or FreeOTP besides the password.

There are deliberately no read receipts. The other person only sees that their letter was delivered – whether and when you read it stays your secret. There are no adverts, no tracking, no stored IP addresses and no content from other servers. You need neither your real name nor an email address or phone number to sign up. You can play under a pseudonym and choose a fictional home. Using PostEulen via a VPN, the Tor network or Tor Browser works too.

# How does PostEulen get onto your phone? Without an app store!

You get apps from the app store, right? Usually, yes. PostEulen is deliberately not there – and still it becomes a real app with its own owl icon. The trick: some websites can turn into an app (experts say “Progressive Web App”, but you may forget the term straight away). You simply put it on your home screen. Nothing is installed secretly, the app wants neither your photos nor your contacts, and updates arrive by themselves.

**Android with Chrome:** open {host} → tap the three dots ⋮ in the top right corner → “Add to Home screen” → “Install” (sometimes it is simply called “Install app”).

**iPhone or iPad with Safari:** open {host} → share icon (square with an arrow; on newer iPhones behind the three dots ••• at the bottom right) → “Add to Home Screen” → “Add”. After that, always open PostEulen with the new icon.

**All other phones, Firefox and computers:** simply add a bookmark to your home screen or use it in the browser as usual. Everything works the same. The only difference: notifications (“An owl has landed!”) are only available in the app on the home screen of Android/Chrome and iPhone/Safari. In the browser your post arrives anyway – you see it the next time you look in. In real life the letterbox does not ring either.

# Who pays for all this?

PostEulen is a hobby project that, sadly, costs real money. At the moment development and running it cost about €25 a month. Every additional active account adds a little to that. If it matters to you, too, that we can keep offering PostEulen in the future, you can support us [here](donate) with a donation. Every donation helps to keep PostEulen online and freely accessible to everyone. Thank you!

# Help

The [help](/hilfe) in the app explains everything else, and the Explainer Bear is happy to answer any questions left by letter.
`;
