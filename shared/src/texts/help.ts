/**
 * Help text (SPEC 8.11): one section per function, FAQ and push on Google-free Android.
 * The same text is the knowledge base of the Erklärbär (SPEC 10.2, D-88) – `helpAsText()`
 * turns it into plain text for his system prompt. All numbers come from the constants.
 */
import { ACCOUNT, BOTS, FLIGHT, GOLD, LETTER, MENAGERIE, OWL } from '../constants.ts';
import { formatGold } from '../game/gold.ts';
import { SPECIES } from '../species.ts';
import { de } from './de.ts';

/** A paragraph (string) or a bullet list (array of strings). */
export type HelpBlock = string | readonly string[];

export interface HelpSection {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly HelpBlock[];
}

export interface HelpQuestion {
  readonly question: string;
  readonly answer: string;
}

const gold = (tenths: number): string => `${formatGold(tenths)} Gold`;
const percent = (share: number): string => `${Math.round(share * 100)} %`;
const dailyGoldTime = `${GOLD.DAILY_HOUR_UTC}:00 Uhr UTC (in Deutschland ${GOLD.DAILY_HOUR_UTC + 1}:00 Uhr, im Sommer ${GOLD.DAILY_HOUR_UTC + 2}:00 Uhr)`;

export const HELP_INTRO =
  'Hier erfährst du kurz und einfach, wie PostEulen funktioniert. Jeder Bereich der App hat einen eigenen Abschnitt; am Ende stehen häufige Fragen. Noch etwas unklar? Schreib dem Erklärbären einen Brief – er kennt diese Hilfe auswendig.';

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: 'idee',
    title: 'Was ist PostEulen?',
    blocks: [
      'PostEulen ist ein Messenger, der so tut, als würdest du Briefe per Eule verschicken. Deine Briefe an andere Menschen sind Ende-zu-Ende-verschlüsselt: Nur du und dein Gegenüber können sie lesen – auch der Betreiber des Servers nicht.',
      'Statt sofort anzukommen, fliegt eine Eule los. Wie lange sie braucht, hängt von der Entfernung, ihrer Art, ihrer Energie und von Tag und Nacht ab. Du kaufst, leihst und pflegst Eulen, verdienst täglich Gold und kannst Freunden Gold oder sogar Eulen schicken.',
      'PostEulen läuft im Browser und lässt sich wie eine App installieren. Zeit und Geduld gehören dazu.',
    ],
  },
  {
    id: 'sicher',
    title: 'Spiel und sicherer Briefkasten zugleich',
    blocks: [
      'PostEulen bewegt sich im Grenzbereich zwischen Spiel und Messenger. Die Eulen, das Gold und die Flugzeiten sind Spiel – die Verschlüsselung ist es nicht. Unter der Pergamentoberfläche arbeitet harte, seriöse Kryptografie auf dem Stand der Zeit. Deshalb eignet sich PostEulen durchaus auch als sicherer Kommunikationsweg, wenn es nicht auf Minuten ankommt.',
      [
        'Briefe zwischen Menschen werden auf deinem Gerät mit XChaCha20-Poly1305 verschlüsselt und mit Ed25519 unterschrieben. Den Schlüssel für jeden Brief bekommen nur Absender und Empfänger, verpackt nach dem Standard HPKE (RFC 9180).',
        'Dein Passwort verlässt nie dein Gerät. Die Anmeldung läuft über OPAQUE (RFC 9807): Der Server kann dein Passwort weder sehen noch aus seiner Datenbank erraten.',
        'Mit der Sicherheitsnummer prüft ihr, dass wirklich niemand dazwischensitzt.',
        'Verwendet werden nur bewährte, offen geprüfte Bibliotheken (libsodium, hpke-js, OPAQUE von Serenity) – keine selbst gebastelte Kryptografie. Der Quelltext ist offen.',
      ],
      'Was PostEulen nicht verbergen kann: wer wem wann schreibt (Metadaten). Und wer dein entsperrtes Gerät in der Hand hat, kann deine Briefe lesen. Briefe an Bots und Systemnachrichten sind nicht verschlüsselt.',
    ],
  },
  {
    id: 'konto',
    title: 'Konto, Passwort und Anmeldung',
    blocks: [
      `Dein Nutzername hat ${ACCOUNT.USER_NAME_MIN_CHARS} bis ${ACCOUNT.USER_NAME_MAX_CHARS} Zeichen: lateinische Buchstaben, Umlaute, ß, gängige Akzentbuchstaben, Ziffern und einzelne Leerzeichen. Groß- und Kleinschreibung und leicht verwechselbare Zeichen (0 und O, 1, l und I) zählen als gleich – so kann sich niemand als jemand anderes ausgeben.`,
      `Dein Passwort hat mindestens ${ACCOUNT.PASSWORD_MIN_CHARS} Zeichen. Ein Satz, den du dir gut merken kannst, ist ideal. Das Passwort verlässt nie dein Gerät und liegt nirgends auf dem Server. Deshalb gilt: Wenn du es vergisst, sind alle deine Daten unwiderruflich verloren. Niemand kann es zurücksetzen, auch der Admin nicht.`,
      'Beim Erstellen setzt du einen fiktiven Wohnort per Pin auf die Karte – bitte nicht deine echte Adresse. Dort wohnen deine Eulen; von dort fliegen sie los.',
      'Du kannst immer nur auf einem Gerät angemeldet sein. Meldest du dich auf einem anderen Gerät an, endet die Sitzung auf dem alten. Nach mehrfach falschem Passwort musst du etwas warten und ein kleines Rechenrätsel lösen lassen (das macht dein Gerät automatisch).',
      `Ohne Nutzung endet die Anmeldung nach ${ACCOUNT.USER_SESSION_IDLE_DAYS} Tagen. Beim Abmelden löscht PostEulen alle Schlüssel von deinem Gerät; beim nächsten Anmelden holt es sie verschlüsselt vom Server zurück.`,
    ],
  },
  {
    id: 'ueberblick',
    title: 'Die App im Überblick',
    blocks: [
      'Nach der Anmeldung siehst du die Übersicht mit Kacheln für alle Bereiche: Briefwechsel, Eulen, Finanzen, Menagerie, Adressbuch, Karte, Einstellungen und Hilfe. Auf dem Handy erreichst du die wichtigsten Bereiche auch über die Leiste am unteren Rand.',
      'Oben in der braunen Leiste siehst du deinen Goldstand. Ist neue Post da, hüpft dort „Neue Post!“ – ein Tipp darauf führt dich zum Briefwechsel. Auf der Übersicht steht neben dem Schriftzug klein die Version der App. Sind Benachrichtigungen nicht bestätigt, erscheint darunter ein Hinweis, der dich zu den Einstellungen führt.',
      'Unter „Neuigkeiten“ zeigt die Übersicht alles, was dich nicht per Benachrichtigung erreicht hat – zum Beispiel weil das Handy aus war.',
    ],
  },
  {
    id: 'adressbuch',
    title: 'Adressbuch und Kontakte',
    blocks: [
      'Schreiben kannst du nur Menschen, mit denen du verbunden bist. Dazu tragt ihr euch gegenseitig im Adressbuch ein, jeweils mit dem genau geschriebenen Namen. Sprecht euch vorher außerhalb der App ab: Anfragen anderer siehst du nicht, und die Antwort ist immer gleich – egal, ob es den Namen gibt.',
      `Eine Anfrage wartet ${ACCOUNT.CONTACT_REQUEST_EXPIRY_HOURS} Stunden auf die Gegenseite und verfällt dann. Du kannst höchstens ${ACCOUNT.CONTACT_REQUESTS_PER_DAY} Anfragen pro Tag stellen. Sobald ihr euch beide eingetragen habt, seid ihr verbunden, und beide bekommen eine Systemnachricht.`,
      [
        '„unbestätigt“: deine Anfrage wartet noch (mit Restzeit).',
        `„inaktiv“: der Kontakt war über ${ACCOUNT.INACTIVE_AFTER_DAYS} Tage nicht da. Bis er wiederkommt, kannst du ihm nichts schicken.`,
        '„Sicherheitsnummer verglichen“: ihr habt eure Nummer geprüft (siehe Verschlüsselung).',
        '„Schlüsselwarnung“: etwas stimmt mit den Schlüsseln nicht – nichts mehr senden, siehe Verschlüsselung.',
      ],
      'Entfernst du einen Kontakt, müsst ihr euch neu koppeln. Eulen, die zwischen euch unterwegs sind, kehren sofort um. Der Chat bleibt erhalten, zeigt aber „unbekannt“ als Namen, bis ihr euch wieder verbindet.',
      'Erklärbär und Tante stehen von Anfang an im Adressbuch, der Onkel kommt später dazu (siehe Bots).',
    ],
  },
  {
    id: 'verschluesselung',
    title: 'Verschlüsselung und Sicherheitsnummer',
    blocks: [
      'Briefe zwischen Menschen werden auf deinem Gerät verschlüsselt und unterschrieben. Der Server sieht nur Kauderwelsch. Er sieht aber, wer wem wann schreibt, wie groß das Pergament ist und ob ein Brief gelesen wurde.',
      'Jeder Kontakt hat mit dir eine gemeinsame Sicherheitsnummer aus 60 Ziffern. Vergleicht sie außerhalb der App, etwa beim Treffen oder am Telefon. Stimmt sie überein, markiere sie im Adressbuch als verglichen. So weißt du sicher, dass niemand dazwischensitzt.',
      'Bemerkt dein Gerät, dass sich die Schlüssel eines Kontakts geändert haben, warnt es deutlich und sperrt den Versand an ihn. Das sollte nie passieren, denn Schlüssel ändern sich in PostEulen nie. Klärt es außerhalb der App; danach entfernt ihr euch und koppelt euch neu.',
      'Kann ein Brief nicht geprüft werden, zeigt PostEulen statt des Inhalts „Echtheit nicht prüfbar“.',
      'Grenzen: Wer dein entsperrtes Gerät in der Hand hat, kann deine Briefe lesen. Briefe an Bots und Systemnachrichten sind nicht verschlüsselt.',
    ],
  },
  {
    id: 'briefe',
    title: 'Briefe schreiben und lesen',
    blocks: [
      'Im Briefwechsel siehst du für jedes Gegenüber einen Chat, sortiert nach der letzten Aktivität und mit Zähler für ungelesene Briefe. Oben angeheftet sind die Systemnachrichten.',
      [
        `Kleines Pergament: bis ${LETTER.SMALL_MAX_CHARS} Zeichen, kostenlos.`,
        `Großes Pergament: bis ${LETTER.LARGE_MAX_CHARS} Zeichen, ${gold(GOLD.LARGE_PARCHMENT_SURCHARGE)} Aufpreis pro Versand.`,
      ],
      `So geht’s: Pergament wählen, Text schreiben, bei Bedarf weitere Empfänger hinzufügen (insgesamt höchstens ${LETTER.MAX_RECIPIENTS}, die Reihenfolge legst du fest), Eule wählen und absenden. Bei der Eulenwahl zeigt PostEulen dir für jede Eule, wann sie bei jedem Empfänger ankommt und wann sie wieder zu Hause ist.`,
      `Keine Eule zu Hause? Dann bietet dir die Eulenwahl direkt die Leiheulen des Tages an. Geliehen und bezahlt (${gold(GOLD.LOAN_PRICE)}) wird erst, wenn du wirklich abschickst – dein Brief bleibt dabei, wie er ist.`,
      'Bei mehreren Empfängern fliegt die Eule von einem zum nächsten. Jeder sieht nur seinen eigenen Brief und kann nur dir antworten. Leiheulen tragen nur einen Brief an einen Empfänger; Bots sind nie bei mehreren Empfängern dabei.',
      'Briefe sind reiner Text. Smileys und Emojis kennt Pergament nicht – sie werden entfernt. Links mit http:// oder https:// sind anklickbar und öffnen sich im Browser; prüfe die angezeigte Adresse, bevor du tippst.',
      [
        '„Eule unterwegs – Ankunft ca. …“: der Brief ist auf dem Weg.',
        '„zugestellt“: die Eule ist angekommen.',
        '„gelesen“: dein Gegenüber hat den Brief auf dem Bildschirm gesehen.',
        '„nicht zugestellt – die Eule ist umgekehrt“: zum Beispiel, weil die Verbindung gekappt wurde.',
      ],
      'Kommt eine Eule bei dir an, siehst du beim ersten Anzeigen ihr Ankunftsbild. Es schließt sich nach ein paar Sekunden von selbst, per Tippen oder mit der Escape-Taste.',
      'Im Chat erscheinen Briefe als Schriftrollen, deine eigenen und die deines Gegenübers in zwei verschiedenen Handschriften. Links und Namen stehen immer in Druckschrift, damit du sie sicher lesen kannst. Ist dir Handschrift zu mühsam, stell in den Einstellungen auf Druckschrift um.',
      'Chat löschen entfernt deine Kopien aller Briefe dieses Chats endgültig. Dein Gegenüber behält seine.',
    ],
  },
  {
    id: 'aufbewahrung',
    title: 'Alte Briefe werden gelöscht',
    blocks: [
      `Wichtig: Alle Briefe und Systemnachrichten werden spätestens ${LETTER.RETENTION_MAX_DAYS} Tage – also ein Jahr – nach ihrer Zustellung automatisch und unwiderruflich gelöscht. Das gilt für alle Konten und auch für die Briefe der Bots. Wiederherstellen kann sie niemand.`,
      'In den Einstellungen unter „Briefe“ kannst du deine eigenen Kopien schon nach 30, 90 oder 180 Tagen löschen lassen – geschriebene und erhaltene. Wählst du eine kürzere Frist, wird alles, was älter ist, sofort gelöscht. Dein Gegenüber behält seine Kopie, bis seine eigene Frist abläuft.',
      'Briefe, die noch unterwegs sind, werden nie gelöscht. Möchtest du etwas aufheben, schreib es dir außerhalb von PostEulen auf.',
    ],
  },
  {
    id: 'systemnachrichten',
    title: 'Systemnachrichten',
    blocks: [
      'Im Chat „Systemnachrichten“ meldet PostEulen sofort alles Wichtige: neue Kontakte, angekommenes Gold oder Eulen, Krankheiten, Eier, Küken, Namensänderungen deiner Kontakte, Rundnachrichten des Admins und mehr. Antworten kannst du dort nicht.',
    ],
  },
  {
    id: 'eulen',
    title: 'Deine Eulen',
    blocks: [
      'Unter „Eulen“ siehst du alle deine Eulen, Küken und Leiheulen mit Bild, Name, Art, Geschlecht, Energie und Zustand. Ist eine Eule nicht da, steht dabei, warum und bis wann – etwa „Fliegt gerade einen Brief zu Peter“ oder „In der Menagerie bis Fr., 14:00“.',
      'Jede Art hat einen Preis, eine maximale Energie, einen Geschwindigkeitsfaktor und einen Erholungsfaktor. Eulen werden nicht alt und sterben nicht.',
      [
        `Umbenennen: einmal pro Kalenderjahr je Eule (${OWL.NAME_MIN_CHARS}–${OWL.NAME_MAX_CHARS} Zeichen). Die erste Benennung nach Kauf oder Schlupf zählt nicht.`,
        'Verschenken: eine einsatzbereite erwachsene Eule fliegt zu einem Kontakt und gehört ab der Ankunft ihm. Du kannst einen kurzen Begleitbrief mitgeben. Kehrt sie um, gehört sie wieder dir.',
        'In die Freiheit entlassen: die Eule ist endgültig weg.',
        `Höchstens ${OWL.MAX_OWN_OWLS} eigene Eulen (Küken zählen mit, Leiheulen nicht). Geschenke und Küken dürfen darüber hinausgehen, dann kannst du nur nichts mehr kaufen.`,
      ],
      'Eine Eule kann nur losfliegen, wenn sie zu Hause, gesund und erwachsen ist und weder brütet noch in der Menagerie ist.',
    ],
  },
  {
    id: 'energie',
    title: 'Energie, Füttern und Streicheln',
    blocks: [
      `Zu Hause erholt sich eine Eule: pro Stunde ${percent(OWL.REGEN_SHARE_PER_HOUR)} ihrer maximalen Energie mal Erholungsfaktor. Mit Faktor 2 ist sie also in 5 Stunden wieder voll.`,
      `Füttern kostet ${gold(GOLD.FEED_PRICE)}, geht einmal pro Tag je Eule und gibt sofort ${percent(OWL.FEED_SHARE)} Energie mal Erholungsfaktor.`,
      'Streicheln ist kostenlos und so oft möglich, wie du magst. Es zählt aber nur einmal pro Tag für die Pflege.',
      `Pflegebonus: Gezählt werden die letzten ${OWL.CARE_BONUS_WINDOW_DAYS} Tage, an denen die Eule mindestens ${OWL.CARE_BONUS_MIN_HOME_HOURS} Stunde zu Hause war. Wurde sie an mindestens ${OWL.CARE_BONUS_MIN_DAYS} davon gestreichelt oder gefüttert, wird sie viel seltener krank. Ganze Reisetage zählen also nicht – eine fleißige Brief-Eule verliert ihren Bonus nicht, nur weil sie unterwegs war.`,
    ],
  },
  {
    id: 'flug',
    title: 'So fliegt eine Eule',
    blocks: [
      `Grundgeschwindigkeit ${FLIGHT.BASE_SPEED_KMH} km/h mal Geschwindigkeitsfaktor der Art – bei Tag und Nacht gleich schnell.`,
      `Energie: nachts ${FLIGHT.ENERGY_PER_KM_NIGHT} Punkt pro Kilometer, tagsüber ${String(FLIGHT.ENERGY_PER_KM_DAY).replace('.', ',')} Punkte. Die Dämmerung zählt als Tag. Eulen sind eben Nachtvögel.`,
      `Ist die Energie leer, schläft die Eule ${FLIGHT.SLEEP_HOURS} Stunden an Ort und Stelle und fliegt dann mit voller Energie weiter. Über Wasser schläft sie nicht: Sie gleitet ohne Energie weiter bis zur nächsten Küste und ruht dort. Du kannst auch fast leere Eulen losschicken; dann beginnt der Flug eben mit einem Schläfchen.`,
      'Nach der letzten Zustellung fliegt die Eule nach denselben Regeln heim. Leiheulen fliegen nicht zurück, geschenkte Eulen und Küken bleiben beim Empfänger.',
      'Zieht ein Empfänger oder du selbst um, passt die Eule ihren Kurs sofort an. Wird die Verbindung gekappt oder löscht der Empfänger sein Konto, kehrt sie um; bei mehreren Empfängern lässt sie den Betroffenen aus.',
    ],
  },
  {
    id: 'karte',
    title: 'Die Karte',
    blocks: [
      'Die Karte zeigt Westeuropa mit deinem Wohnort, den Wohnorten deiner Kontakte und Bots und deinen Eulen, die gerade für dich unterwegs sind. Eulen anderer Leute siehst du nie – auch nicht, wenn sie zu dir fliegen.',
      'Beim Öffnen zoomt die Karte so weit hinein, dass gerade noch alle deine Orte und Eulen zu sehen sind. Zur Orientierung zeigt sie Städte: weit herausgezoomt die mit über einer Million Einwohnern, näher herangezoomt alle mit über 200 000. Ist kein Platz für einen Städtenamen oder läge er auf deinen Orten oder Eulen, bleibt er ausgeblendet, bis du näher heranzoomst. England, Schottland, Wales und Nordirland sind als eigene Länder eingezeichnet.',
      'Die dunkle Fläche ist die Nacht. Positionen und Nachtgrenze rechnet dein Gerät alle 10 Minuten neu aus, ohne den Server zu fragen.',
      'Du kannst mit zwei Fingern oder dem Mausrad zoomen, verschieben und mit der Tastatur steuern (Pfeiltasten, Plus und Minus).',
    ],
  },
  {
    id: 'gold',
    title: 'Gold und Finanzen',
    blocks: [
      `Du startest mit ${gold(GOLD.START)}. Jeden Tag um ${dailyGoldTime} bekommt jedes aktive Konto ${gold(GOLD.DAILY)}. Die Tante schenkt dir nach ${GOLD.AUNT_GIFT_AFTER_DAYS} Tagen ${gold(GOLD.AUNT_GIFT)}, der Onkel nach ${GOLD.UNCLE_INHERITANCE_AFTER_DAYS} Tagen ${gold(GOLD.UNCLE_INHERITANCE)}.`,
      `Kosten: Eulen je nach Art, Leiheule ${gold(GOLD.LOAN_PRICE)}, Füttern ${gold(GOLD.FEED_PRICE)}, großes Pergament ${gold(GOLD.LARGE_PARCHMENT_SURCHARGE)}, Krankenpflege ${gold(GOLD.SELF_CARE_PRICE)} oder Eulenarzt ${gold(GOLD.VET_PRICE)}. Alles muss voll gedeckt sein; Schulden gibt es nicht.`,
      `Die Finanzübersicht zeigt deinen Goldstand und die letzten ${GOLD.TRANSACTIONS_KEPT} Buchungen.`,
      `Gold verschicken: ${gold(GOLD.TRANSFER_MIN)} bis ${gold(GOLD.TRANSFER_MAX)} per Eule an einen Kontakt, gern mit kurzem Begleitbrief. Danach müssen dir mehr als ${gold(GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE)} bleiben. Das Gold wird beim Abflug abgebucht und kommt mit der Eule an. Kehrt sie um, bekommst du es zurück, sobald sie wieder zu Hause ist. Bots kannst du kein Gold schicken.`,
    ],
  },
  {
    id: 'menagerie',
    title: 'Menagerie: Eulen kaufen und leihen',
    blocks: [
      `Kaufen: Alle ${SPECIES.length} Arten sind immer zu haben. Nach dem Kauf gibst du deiner Eule einen Namen. Ihr Geschlecht ist zufällig, ihre Energie liegt zu Beginn zwischen ${percent(OWL.START_ENERGY_MIN_SHARE)} und ${percent(OWL.START_ENERGY_MAX_SHARE)}.`,
      `Leihen: Jeden Tag um Mitternacht (UTC) gibt es ${MENAGERIE.OFFER_SPECIES_COUNT} Arten zum Leihen, für ${gold(GOLD.LOAN_PRICE)} je Eule – jede mit einem anderen Namen. Du kannst höchstens ${MENAGERIE.MAX_CONCURRENT_LOANS} Leiheulen gleichzeitig haben, eine je Art. Du kannst hier leihen oder direkt beim Briefschreiben, wenn keine eigene Eule da ist.`,
      `Eine Leiheule trägt genau einen Brief oder Gold an einen Empfänger und ist danach weg. Schickst du sie nicht binnen ${MENAGERIE.LOAN_EXPIRY_HOURS} Stunden los, verschwindet sie wieder, und das Gold ist verbraucht. Sie lässt sich füttern und streicheln, aber nicht umbenennen oder verschenken.`,
      `Tipp für den Anfang: Mit ${gold(GOLD.START)} Startgold leihst du eine Eule für deinen ersten Brief. Für die günstigste eigene Eule (Waldkauz, 6 Gold) reicht es nach ein paar Tagen – oder sobald das Geschenk der Tante da ist.`,
    ],
  },
  {
    id: 'arten',
    title: 'Eulenarten im Überblick',
    blocks: [
      'Preis in Gold, maximale Energie, Geschwindigkeitsfaktor (mal 25 km/h) und Erholungsfaktor:',
      SPECIES.map(
        (species) =>
          `${species.name}: ${species.price} Gold, ${species.maxEnergy} Energie, Tempo ${String(species.speedFactor).replace('.', ',')}, Erholung ${String(species.recoveryFactor).replace('.', ',')}`,
      ),
    ],
  },
  {
    id: 'verleih',
    title: 'Eulen an die Menagerie verleihen',
    blocks: [
      `Gesunde erwachsene Eulen, die zu Hause sind, kannst du für ${OWL.MENAGERIE_DAYS} Tage an die Menagerie verleihen. Danach bekommst du ${percent(GOLD.MENAGERIE_WAGE_SHARE)} des Artpreises als Lohn, und die Eule kommt mit voller Energie zurück. Währenddessen ist sie nicht verfügbar und wird nicht krank.`,
    ],
  },
  {
    id: 'krankheit',
    title: 'Krankheiten',
    blocks: [
      `Jede Nacht kann eine erwachsene Eule mit einer Wahrscheinlichkeit von 1 zu 30 krank werden – mit Pflegebonus (siehe Energie, Füttern und Streicheln) deutlich seltener. In den ersten ${OWL.SICKNESS_GRACE_DAYS} Tagen bei dir wird sie nie krank. Leiheulen, Küken und Bot-Eulen werden nie krank, Eulen inaktiver Konten auch nicht.`,
      'Eine kranke Eule schaut grummelig und kann nicht fliegen, bis sie geheilt ist. Streicheln und füttern geht weiter.',
      [
        `Selbst gesund pflegen: ${gold(GOLD.SELF_CARE_PRICE)} für spezielles Futter, nach ${OWL.SELF_CARE_DAYS} Tagen ist sie gesund.`,
        `Eulenarzt: ${gold(GOLD.VET_PRICE)}, nach ${OWL.VET_HOURS} Stunden ist sie gesund.`,
      ],
      'Wird eine Eule unterwegs krank, merkst du es, wenn sie heimkommt.',
    ],
  },
  {
    id: 'kueken',
    title: 'Eier und Küken',
    blocks: [
      `Weibliche Eulen legen nach einer Heimkehr manchmal Eier (etwa jedes hundertste Mal). Sie brüten dann ${OWL.BROODING_DAYS} Tage; danach schlüpfen ${OWL.CHICKS_MIN} bis ${OWL.CHICKS_MAX} Küken.`,
      `Du benennst die Küken binnen ${OWL.CHICK_NAME_DEADLINE_HOURS} Stunden, sonst bekommen sie Zufallsnamen. Bei ${OWL.CHICK_GIFT_FROM_COUNT} oder mehr Küken musst du binnen ${OWL.CHICK_GIFT_DEADLINE_HOURS} Stunden genau eines an einen Kontakt verschenken, gern mit Begleitbrief. Sonst entscheidet das Los unter deinen aktiven Kontakten. Hast du keine, darfst du alle behalten.`,
      `Küken fliegen gemütlich mit ${FLIGHT.CHICK_SPEED_KMH} km/h, eine Stunde Flug, eine Stunde Pause. Sie können gestreichelt und gefüttert werden, tragen aber keine Briefe. Erwachsen werden sie bei dir nach ${OWL.CHICK_ADULT_AT_MOTHER_DAYS} Tagen, beim Beschenkten ${OWL.CHICK_ADULT_AT_RECIPIENT_DAYS} Tage nach der Ankunft.`,
    ],
  },
  {
    id: 'bots',
    title: 'Erklärbär, Tante und Onkel',
    blocks: [
      'Jedes Konto hat drei eigene Bots. Sie sind in Chatliste und Adressbuch mit „Bot“ gekennzeichnet und antworten per KI.',
      [
        `Erklärbär: wohnt in Berlin und schickt dir in der ersten Woche kurze Anleitungen. Er beantwortet Fragen zu PostEulen – aber nur die. Seine Eulen fliegen ${BOTS.EXPLAINER_SPEED_KMH} km/h.`,
        `Tante: eine entfernt verwandte Hexe, die gern plaudert. Sie schickt dir nach ${GOLD.AUNT_GIFT_AFTER_DAYS} Tagen ${gold(GOLD.AUNT_GIFT)} für deine erste Eule.`,
        `Onkel: ein etwas verrückter, launischer Verwandter. Er meldet sich nach ${BOTS.UNCLE_FIRST_LETTER_AFTER_DAYS} Tagen und teilt nach ${GOLD.UNCLE_INHERITANCE_AFTER_DAYS} Tagen ein Erbe von ${gold(GOLD.UNCLE_INHERITANCE)} mit dir.`,
      ],
      `Einem Bot kannst du einen Brief in ${BOTS.WRITE_LOCK_HOURS} Stunden schreiben; die App zeigt, ab wann wieder. Etwa ${BOTS.REPLY_AFTER_HOURS} Stunden nach der Ankunft deines Briefs schreibt er zurück (höchstens ${BOTS.REPLY_MAX_CHARS} Zeichen). Ist das Tageslimit des Servers erreicht, antwortet er am nächsten Tag.`,
      de.bots.notice,
      'An OpenAI gehen nur die Texte, keine Namen und keine Kennungen. Bots merken sich eine kurze Zusammenfassung eures Briefwechsels; sie verschwindet, wenn du den Chat löschst.',
      'Du kannst Bots im Adressbuch entfernen. Das ist endgültig: Chat, Zusammenfassung und noch ausstehende Briefe und Goldsendungen sind dann weg.',
    ],
  },
  {
    id: 'benachrichtigungen',
    title: 'Benachrichtigungen',
    blocks: [
      'PostEulen fragt nie im Hintergrund nach neuen Briefen – das schont den Akku. Stattdessen schickt der Server eine Benachrichtigung, wenn eine Eule landet, Gold ankommt, ein Geschenk eintrifft, Eier gelegt werden, Küken schlüpfen, die automatische Löschung droht oder der Admin allen schreibt. Benachrichtigungen enthalten nie Namen oder Inhalte.',
      'Einrichten kannst du sie in den Einstellungen. PostEulen schickt dann sofort eine Test-Benachrichtigung. Kommt sie an, steht dort „aktiv und bestätigt“. Mit „Test-Benachrichtigung senden“ kannst du das jederzeit wiederholen.',
      de.push.iosHint,
      de.push.degoogled1,
      de.push.degoogled2,
      de.push.degoogled3,
      de.push.degoogled4,
    ],
  },
  {
    id: 'installieren',
    title: 'PostEulen als App installieren',
    blocks: [
      [
        `${de.welcome.android}: ${de.welcome.androidSteps}`,
        `${de.welcome.ios}: ${de.welcome.iosSteps}`,
        'Desktop (Chrome, Edge): Symbol „Installieren“ in der Adressleiste. Safari am Mac: Ablage → „Zum Dock hinzufügen“. In Firefox nutzt du PostEulen als normale Webseite.',
      ],
      'Die App aktualisiert sich selbst: Gibt es eine neue Version, lädt sie neu.',
    ],
  },
  {
    id: 'einstellungen',
    title: 'Einstellungen und Konto',
    blocks: [
      [
        `Nutzername ändern: einmal pro Kalenderjahr. Deine Kontakte erfahren es per Systemnachricht; der alte Name ist ${ACCOUNT.NAME_LOCK_DAYS} Tage gesperrt.`,
        `Wohnort ändern: bis zu ${ACCOUNT.HOME_CHANGES_PER_MONTH}-mal pro Kalendermonat, egal wie kurz hintereinander. Eulen unterwegs passen ihren Kurs an.`,
        'Passwort ändern: altes Passwort einmal, neues zweimal. Alle Briefe bleiben lesbar.',
        'Briefe: eigene Briefe und Systemnachrichten schon nach 30, 90 oder 180 Tagen löschen lassen statt nach einem Jahr; Briefe in Druckschrift statt Handschrift anzeigen.',
        'Benachrichtigungen: Status ansehen und testen.',
        `Konto löschen: mit Passwort bestätigen. Meldest du dich binnen ${ACCOUNT.SELF_DELETE_GRACE_HOURS} Stunden wieder an, wird die Löschung abgebrochen. Danach wird alles endgültig gelöscht; was andere schon von dir bekommen haben, bleibt bei ihnen.`,
        'Abmelden: entfernt alle Schlüssel von diesem Gerät.',
      ],
    ],
  },
  {
    id: 'inaktiv',
    title: 'Inaktivität und automatische Löschung',
    blocks: [
      `Warst du über ${ACCOUNT.INACTIVE_AFTER_DAYS} Tage nicht in der App, gilt dein Konto als inaktiv: Kontakte sehen „inaktiv“ und können dir nichts schicken, du bekommst kein tägliches Gold, und deine Eulen werden nicht krank. Briefe der Bots und Lieferungen, die schon unterwegs sind, kommen trotzdem an. Sobald du die App öffnest, bist du wieder aktiv.`,
      `Nach längerer Inaktivität wird das Konto automatisch gelöscht. Die Frist legt der Betreiber fest (mindestens ${ACCOUNT.AUTO_DELETE_MIN_DAYS}, üblich ${ACCOUNT.AUTO_DELETE_DEFAULT_DAYS} Tage). ${ACCOUNT.AUTO_DELETE_WARNING_DAYS} Tage vorher bekommst du eine Warnung.`,
    ],
  },
  {
    id: 'offline',
    title: 'Ohne Netz',
    blocks: [
      'Ohne Verbindung zeigt PostEulen „Keine Verbindung – Eulen brauchen Netz“ und sperrt alle Aktionen. Sobald das Netz zurück ist, geht es weiter. Briefe liegen nie unverschlüsselt auf deinem Gerät.',
    ],
  },
  {
    id: 'krise',
    title: 'Wenn es dir nicht gut geht',
    blocks: [de.bots.crisis],
  },
];

export const HELP_FAQ: readonly HelpQuestion[] = [
  {
    question: 'Ich habe mein Passwort vergessen. Was nun?',
    answer:
      'Leider lässt es sich nicht zurücksetzen, weil es nirgends gespeichert ist – das ist der Preis für echte Verschlüsselung. Erstelle ein neues Konto und koppelt euch neu.',
  },
  {
    question: 'Warum kommt mein Brief nicht sofort an?',
    answer:
      'Eulen brauchen Zeit. Die Flugzeit hängt von Entfernung, Art und Energie ab, nachts sparen Eulen Energie, und leere Eulen schlafen 10 Stunden. Die Ankunftszeit siehst du am Brief.',
  },
  {
    question: 'Ich finde meinen Freund nicht.',
    answer:
      'Ihr müsst euch beide mit dem genauen Namen eintragen. PostEulen sagt aus Datenschutzgründen nie, ob ein Name existiert. Prüft die Schreibweise und tragt euch innerhalb von 24 Stunden gegenseitig ein.',
  },
  {
    question: 'Kann ich PostEulen auf mehreren Geräten nutzen?',
    answer:
      'Nur nacheinander: Wer sich auf einem neuen Gerät anmeldet, wird auf dem alten abgemeldet. Alle Briefe und Schlüssel sind danach auch auf dem neuen Gerät da.',
  },
  {
    question: 'Warum sind meine Smileys verschwunden?',
    answer: 'Pergament kennt keine Smileys. Emojis und unsichtbare Sonderzeichen werden entfernt.',
  },
  {
    question: 'Ich bekomme keine Benachrichtigungen.',
    answer:
      'Öffne die Einstellungen und sende eine Test-Benachrichtigung. Auf dem iPhone geht das nur in der installierten App; auf Android ohne Google-Dienste brauchst du IronFox oder Fennec mit einer UnifiedPush-App (siehe Benachrichtigungen). Briefe kommen auch ohne Benachrichtigung an – du siehst sie beim Öffnen.',
  },
  {
    question: 'Mir ist das Gold ausgegangen.',
    answer: `Jeden Tag gibt es ${gold(GOLD.DAILY)}, solange du aktiv bist. Kleine Briefe sind kostenlos; nur Eulen, Leihen, Füttern, großes Pergament und Behandlungen kosten Gold.`,
  },
  {
    question: 'Kann der Betreiber meine Briefe lesen?',
    answer:
      'Briefe zwischen Menschen nicht – sie sind Ende-zu-Ende-verschlüsselt. Briefe an Bots und Systemnachrichten schon. Der Server sieht außerdem, wer wem wann schreibt.',
  },
  {
    question: 'Wo sind meine alten Briefe hin?',
    answer: `Briefe und Systemnachrichten werden spätestens ein Jahr nach der Zustellung automatisch gelöscht – oder früher, wenn du das in den Einstellungen so eingestellt hast. Wiederherstellen lassen sie sich nicht.`,
  },
  {
    question: 'Ist PostEulen nur ein Spiel, oder kann ich damit wirklich vertraulich schreiben?',
    answer:
      'Beides. Die Eulen sind Spiel, die Verschlüsselung ist ernst gemeint und auf dem Stand der Technik. Briefe zwischen Menschen kann außer euch niemand lesen, auch der Betreiber nicht. Vergleicht die Sicherheitsnummer, dann seid ihr auf der sicheren Seite.',
  },
  {
    question: 'Kann ich einen Brief zurückholen oder bearbeiten?',
    answer:
      'Nein, abgeschickt ist abgeschickt. Du kannst aber deinen Chat löschen – dein Gegenüber behält dann seine Kopie.',
  },
];

function blockText(block: HelpBlock): string {
  return typeof block === 'string' ? block : block.map((item) => `- ${item}`).join('\n');
}

/** The help text as plain text, e.g. as the Erklärbär's knowledge base. */
export function helpAsText(): string {
  const sections = HELP_SECTIONS.map(
    (section) => `${section.title}\n${section.blocks.map(blockText).join('\n')}`,
  );
  const faq = HELP_FAQ.map((item) => `Frage: ${item.question}\nAntwort: ${item.answer}`);
  return [HELP_INTRO, ...sections, `Häufige Fragen\n${faq.join('\n')}`].join('\n\n');
}
