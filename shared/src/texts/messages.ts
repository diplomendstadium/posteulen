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
    version: '0.9.0',
    title: 'Eulen auf verborgenen Pfaden: Version 0.9.0',
    paragraphs: [
      'Manche Eulen fliegen am liebsten dort, wo niemand ihnen folgen kann. Deshalb ist PostEulen ab sofort auch im Tor-Netz zu Hause – als sogenannter Onion-Dienst, eine Art verborgener Eulenturm mit eigenem Zugang.',
      'Das ist neu:',
      '• Auf der Startseite steht ganz unten der Link „Tor-Netz“. Im Tor Browser öffnet er PostEulen über das Tor-Netz. Öffnest du PostEulen ohnehin im Tor Browser, schlägt er dir die Onion-Adresse von selbst vor.',
      '• Dort ist alles wie gewohnt: dasselbe Konto, dieselben Briefe, dieselben Eulen. Du kannst zwischen beiden Wegen wechseln, wie du magst – angemeldet bist du aber immer nur an einer Stelle zugleich. Meldest du dich auf dem einen Weg an, endet die Sitzung auf dem anderen.',
      '• Damit es im verborgenen Turm nicht zu voll wird, achtet PostEulen dort besonders streng auf Andrang. Wird es einmal eng, hilft kurzes Warten.',
      '• Das kostenlose Pergament heißt jetzt „kurzes Pergament“, das große „langes Pergament“. An Länge und Preis ändert sich nichts.',
      '• Ein paar Eulen haben neue Porträts bekommen: Sie fliegen jetzt noch schöner los und kommen noch schöner heim.',
      'Gute Flüge auf allen Wegen!',
    ],
  },
  {
    version: '0.8.5',
    title: 'Post aus der Leserschaft: Version 0.8.5',
    paragraphs: [
      'Zuerst ein großes Dankeschön! Die meisten Neuerungen dieser Version stammen von euch: aus Nachrichten an den Admin, aus Gesprächen am Küchentisch und aus Beobachtungen, die ihr beim Schreiben, Pflegen und Ausleihen gemacht habt. Ihr habt gemerkt, wo eine Eule umständlich zu finden war, wo ein Hinweis fehlte und wo die Karte zu voll wurde. Jede dieser Anregungen hat den Eulenturm ein Stück wohnlicher gemacht – vielen, vielen Dank dafür.',
      'Das ist neu:',
      '• Jede einsatzbereite Eule hat in der Eulenübersicht den Knopf „Brief schreiben“: Empfänger wählen, und schon sitzt sie im Briefwechsel bereit. Beim Schreiben steht die Eulenwahl jetzt von Anfang an da und bleibt auch beim Tippen stehen. Die Leiheulen des Tages stehen immer mit zur Wahl.',
      '• Rast: Eigene Eulen bleiben zunächst 2 Stunden, Leiheulen 24 Stunden bei jedem Empfänger – wählst du selbst etwas anderes, bleibt es dabei.',
      '• In der Menagerie würfelt jetzt jede und jeder ein eigenes Tagesangebot. Ist eine Leihe vorbei, verschwindet ihr Angebot bis morgen.',
      '• Rastet eine Eule bei dir, zeigt dir eine kleine Eule im Briefwechsel, von wem sie kommt – statt einer Systemnachricht. Bringt sie noch Briefe zu anderen, verrät sie dir das, wenn du ihr eine Antwort mitgibst (aber nicht, zu wem).',
      '• Eine eigene Eule, die gerade woanders rastet, zeigt in der Übersicht ihre leere Stange. Bilder in Briefen von Bots lassen sich mit einem Tipp groß ansehen.',
      '• Küken: Für Namen und Geschenk habt ihr jetzt fünf Tage Zeit, bevor das Los entscheidet.',
      '• In die Freiheit entlassen kann man eine Eule nur noch, solange man mehr als 20 eigene hat.',
      '• Die Flugspuren und das „Zzz“ auf der Karte sind fort – sie machten sie schnell unübersichtlich.',
      '• Alte Briefe räumt PostEulen jetzt einmal in der Woche auf, montags früh. Verbrennen wirkt weiterhin sofort.',
      'Und bitte schreibt weiter! Ganz unten in den Einstellungen findet ihr „Nachricht an den Admin“ – jede Idee, jede Frage und jedes kleine Ärgernis ist dort willkommen. Die nächste Eulenpost wartet schon.',
    ],
  },
  {
    version: '0.8.4',
    title: 'Ein Gast aus Übersee: Version 0.8.4',
    paragraphs: [
      'In den Eulenturm ist eine neue Art eingezogen: der Virginiauhu, ein schneller und ausdauernder Uhu aus Amerika mit kecken Federohren. Kaufen kann man ihn in der Menagerie nicht – vielleicht bringt ihn dir aber eine Brieffigur oder ein Gutschein.',
      'Außerdem zeigt sich jede ankommende Eule beim Öffnen eines Briefwechsels jetzt nur noch einmal. Doppelt hält besser – aber nicht bei Eulen.',
      'Viel Freude!',
    ],
  },
  {
    version: '0.8.3',
    title: 'Glatt gestrichenes Pergament: Version 0.8.3',
    paragraphs: [
      'Ein paar Kleinigkeiten aus der Eulenschreibstube:',
      '• Sehr lange Briefe liegen jetzt gerade auf dem Tisch und rutschen nicht mehr aus dem Bild. Kurze Briefe dürfen weiter ein wenig schief liegen – so sieht ein Schreibtisch eben aus.',
      '• Rastet die Eule einer Brieffigur bei dir, darfst du sie jetzt auch tränken, streicheln und füttern – ganz umsonst, die Brieffiguren laden dich ein.',
      '• Die Brieffiguren erinnern sich besser an euren Briefwechsel und knüpfen in ihren Briefen an das an, was ihr euch zuletzt geschrieben habt.',
      'Viel Freude beim Lesen!',
    ],
  },
  {
    version: '0.8.2',
    title: 'Frisch geputztes Gefieder: Version 0.8.2',
    paragraphs: [
      'Die Eulen haben sich ordentlich geputzt und ein paar Gewohnheiten geändert:',
      '• Dein Briefwechsel ist jetzt so sortiert, wie du ihn erlebt hast: Deine Briefe stehen dort, wo du sie abgeschickt hast, empfangene dort, wo sie bei dir angekommen sind. Und kommen mehrere Briefe auf einmal, zeigt sich beim Öffnen jede Eule nacheinander.',
      '• Ob und wann jemand deinen Brief gelesen hat, verraten die Eulen nicht mehr – zu sehen ist nur noch, dass er zugestellt wurde. Ein bisschen Briefgeheimnis muss sein.',
      '• Rastet eine fremde Eule bei dir, sagt sie dir Bescheid und verrät, wie lange sie bleibt. Willst du sie früher ziehen lassen, schickst du sie unter „Eulen“ einfach weiter – auch ohne Brief.',
      '• In den Einstellungen gibt es einen Regler, mit dem du Links in Briefen anklickbar machen oder abschalten kannst. Und ab und zu hängt der Betreiber einen kleinen Aushang für alle auf – den kannst du mit einem Klick wegfalten.',
      'Viel Freude beim Schreiben!',
    ],
  },
  {
    version: '0.8.1',
    title: 'Ein Federstrich nachgebessert: Version 0.8.1',
    paragraphs: [
      'Beim Umzug in den neuen Eulenturm hatte sich eine Feder verhakt: Wer gerade eine Eule zu einem der verabschiedeten Brieffreunde geschickt hatte, brachte den Turm zum Stolpern. Das ist behoben – solche Eulen drehen einfach um und fliegen nach Hause.',
      'Die neuen Brieffreunde aus Version 0.8 sind damit auch auf deinem Eulenturm angekommen – wenn dein Betreiber schon welche eingeladen hat, flattern ihre Briefe bald herein.',
      'Viel Freude!',
    ],
  },
  {
    version: '0.8.0',
    title: 'Neue Federn im Eulenturm: Version 0.8',
    paragraphs: [
      'Im Eulenturm ist es lebhafter geworden:',
      '• Ab jetzt können neue Brieffiguren auftauchen. Sie schreiben allen Eulenfreunden zu besonderen Zeitpunkten, manchmal mit Bildern, manchmal mit einem kleinen Geschenk. Wer ihnen antwortet, bekommt im nächsten Brief eine ganz persönliche Antwort.',
      '• Diese Figuren wohnen überall auf der Welt – ihre Eulen fliegen also auch mal über Ozeane und warten dann eine Weile bei dir. Solange sie rastet, kannst du ihr eine Antwort mitgeben.',
      '• Zwei langjährige Brieffreunde haben sich in den wohlverdienten Ruhestand verabschiedet; ihre Briefe sind mit ihnen gegangen. Geschenktes Gold bleibt natürlich deins.',
      '• Jedem Bot, auch dem Erklärbär, kannst du einen Brief pro Kalendertag schreiben. Und wer in den Einstellungen alle Bots entfernt, bekommt auch von künftigen keine Post.',
      'Viel Freude mit den neuen Brieffreunden!',
    ],
  },
  {
    version: '0.7.2',
    title: 'Ordnung im Eulenturm: Version 0.7.2',
    paragraphs: [
      'Die Eulenmeister haben ein paar Ecken des Turms aufgeräumt:',
      '• Kehrt eine deiner Eulen heim, landet sie jetzt jedes Mal mit ihrem Bild auf dem Fensterbrett – sofort oder beim nächsten Öffnen der App. Eine Systemnachricht dazu gibt es nicht mehr.',
      '• Die Bots wohnen nicht mehr im Adressbuch. Du findest sie im Briefwechsel; dort lassen sie sich auch einzeln entfernen. In den Einstellungen kannst du alle Bots auf einmal verabschieden.',
      '• Wer alle Briefe eines Bots verbrannt hatte, bekam danach manchmal unsichtbare Post. Das ist behoben.',
      '• Kurze Zeiten unter einer Stunde stehen jetzt in Minuten.',
      'Fröhliches Weiterschreiben!',
    ],
  },
  {
    version: '0.7.1',
    title: 'Feinschliff im Eulenturm: Version 0.7.1',
    paragraphs: [
      'Nach dem großen Anbau haben die Eulenmeister die Späne zusammengefegt und ein paar Dinge geradegerückt:',
      '• Uhrzeiten stehen jetzt überall in der Ortszeit deines Wohnorts – auch die Rast einer Eule bei deinen Freunden.',
      '• Tippst du bei einer rastenden Gast-Eule auf „Antwort mitgeben“, ist sie gleich ausgewählt, und nichts anderes lenkt ab.',
      '• Bevor eine Eule gekauft wird, fragt die Menagerie noch einmal nach – damit kein Goldstück aus Versehen davonflattert.',
      '• Der Knopf unter Plus und Minus auf der Karte bringt dich zurück zur Ansicht vom Öffnen.',
      '• Neu ganz unten in den Einstellungen: eine kurze Nachricht an den Admin, wenn etwas klemmt oder du eine Idee hast. Sie ist nicht verschlüsselt und kommt ohne deinen Namen an.',
      'Weiterhin viel Freude mit deinen Eulen!',
    ],
  },
  {
    version: '0.7.0',
    title: 'Eulen, die zum Plausch bleiben: Version 0.7',
    paragraphs: [
      'Im Eulenturm wurde ordentlich angebaut. Das Wichtigste zuerst: Deine Eulen dürfen jetzt bei deinen Freunden Rast machen.',
      '• Beim Briefeschreiben wählst du, wie lange die Eule bei jedem Empfänger bleibt: gar nicht, 1, 2, 24 oder 48 Stunden. Dort ruht sie sich aus wie zu Hause, lässt sich gern verwöhnen – und nimmt eine Antwort an dich mit. Bekommt sie einen Brief, fliegt sie sofort los. Kommt sie mit Post zurück, sagt sie es dir.',
      '• Die Motivation einer Eule gilt jetzt nur noch für die nächste Strecke. Wer einer rastenden Eule Wasser oder ein Leckerli gibt, schickt sie also flinker weiter.',
      '• Die Karte zeigt jetzt die ganze Welt. Wohnen kann man weiterhin nur im vertrauten Westeuropa – aber wer weiß, wohin es die Eulen eines Tages verschlägt.',
      '• Auf der Übersicht begrüßt dich PostEulen nach der Tageszeit an deinem Wohnort, und der tägliche Goldsegen kommt jetzt schon um 3 Uhr morgens (UTC) – der Goldstand oben rechts zeigt ihn sofort an.',
      '• Gesendete Briefe verraten, welche Eule sie getragen hat. „Chat löschen“ heißt jetzt „Alle Briefe verbrennen“ – mit Kaminfeuer. Und werden alte Briefe wegen der Löschfrist entfernt, erfährst du, wie viele und aus welchen Briefwechseln.',
      '• Brütende Eulen sitzen jetzt sichtbar auf ihren Eiern, heimkehrende Eulen landen zuverlässig mit Bild auf dem Fensterbrett, und beim Kauf siehst du das Geschlecht, bevor du den Namen vergibst.',
      '• Dazu viele Kleinigkeiten: Die Motivation steht in Prozent, Leiheulen wiederholen sich nicht mehr an zwei Tagen hintereinander, Briefwechsel öffnen sich beim ältesten ungelesenen Brief, und in den Einstellungen steht dein aktueller Name.',
      'Viel Freude beim Schreiben – und beim Bewirten fremder Eulen!',
    ],
  },
  {
    version: '0.6.1',
    title: 'Neue Schlösser für den Eulenturm: Version 0.6.1',
    paragraphs: [
      'Diesmal waren die Schlossmeister zu Gast. Sie haben an jeder Tür und jedem Fenster des Turms gerüttelt und überall dort nachgebessert, wo ein Schloss nicht so fest saß, wie es sollte:',
      '• Wer an der Tür Passwörter rät, muss jetzt in jedem Fall die vorgeschriebene Wartezeit einhalten – auch wer es mit vielen Versuchen gleichzeitig probiert.',
      '• Viele Nachbarn, die sich über dieselbe Internetleitung anmelden, werden nicht mehr irrtümlich für Passwort-Rater gehalten.',
      '• Nach dem Abmelden vergisst die App jetzt auch die Schlüsselbindungen deiner Kontakte sofort. Meldet sich danach jemand anderes im selben Fenster an, sieht er nichts davon.',
      '• Beim Öffnen eines Briefwechsels prüft die App erneut, ob die Schlüssel deines Gegenübers noch dieselben sind.',
      '• Links in Briefen, deren Adresse ungewöhnliche Zeichen enthält – etwa ein Buchstabe aus einem fremden Alphabet, der wie ein bekannter aussieht –, zeigt die App jetzt in ihrer technischen Form und mit einem Warnhinweis. So fällt eine verkleidete Adresse sofort auf.',
      'Für deine Briefe ändert sich sonst nichts: Alles bleibt lesbar, und deine Eulen fliegen wie gewohnt.',
    ],
  },
  {
    version: '0.6.0',
    title: 'Großer Hausputz im Eulenturm: Version 0.6',
    paragraphs: [
      'Diesmal gibt es keine neuen Kunststücke. Dafür sind die Eulenmeister mit Staubwedel und Lupe durch jeden Winkel des Turms gezogen und haben einiges geradegerückt:',
      '• Auf sehr schmalen Handys rutschten Goldstand und Fähnchen manchmal aus dem Bild. Jetzt bekommt „Neue Post!“ dort eine eigene Zeile, und alles bleibt, wo es hingehört.',
      '• Lange Überschriften wie „Benachrichtigungen“ brechen sauber um, und die Leiste am unteren Rand passt auch aufs kleinste Display.',
      '• Die Hilfe ist wieder auf dem neuesten Stand. Dort stand zum Beispiel noch, dass müde Eulen stur zehn Stunden schlafen – das tun sie schon seit Version 0.5 nicht mehr.',
      '• Viele kleine Texte sind poliert, auf Deutsch wie auf Englisch. Wohnorte westlich von Greenwich heißen jetzt richtig „° W“.',
      '• Niemand kann sich mehr so nennen wie die Bots in der englischen Ansicht („Explainer Bear“). Verwechslungen ausgeschlossen.',
      'Viel Freude beim Schreiben – in einem frisch geputzten Turm!',
    ],
  },
  {
    version: '0.5.1',
    title: 'Pssst, hier wird geschlafen: Version 0.5.1',
    paragraphs: [
      'Eulen sind Nachtvögel – und das sieht man jetzt auch:',
      '• Macht eine Eule unterwegs eine Schlafpause, zeigt die Eulenübersicht sie schlafend, bei Tag oder unter dem Nachthimmel.',
      '• Ist es bei dir zu Hause hell, döst eine gesunde Eule manchmal auf ihrer Stange. Keine Sorge: Pflegen und losschicken kannst du sie trotzdem, und nach einer Streicheleinheit ist sie erst einmal hellwach.',
      '• Die Sumpfohreule kostet jetzt nur noch 7 Gold, der Bartkauz 12 Gold.',
      'Schlaf gut – und viel Freude beim Schreiben!',
    ],
  },
  {
    version: '0.5.0',
    title: 'Ein Phönix auf der Fensterbank: Version 0.5',
    paragraphs: [
      'In der Eulerei ist einiges passiert – und eines Morgens saß da plötzlich ein Phönix. Das ist neu:',
      '• Motivation: Jede Eule hat jetzt einen zweiten Balken. Er sinkt jede Nacht ein wenig und steigt, wenn du dich kümmerst. Eine motivierte Eule fliegt auf der nächsten Reise schneller und weiter und erholt sich unterwegs flotter; eine lustlose eben etwas langsamer.',
      '• Mehr Pflege: Neben Streicheln und Eulenkeks kannst du deiner Eule einmal am Tag Wasser geben (kostenlos) und ihr Lieblingsleckerli (0,2 Gold) – der Waldkauz schwärmt für Haselnüsse, der Riesenfischuhu für Räucherfisch. Zwei verschiedene Arten von Pflege an einem Tag halten sie gesund.',
      '• Klügere Nickerchen: Unterwegs schläft eine müde Eule nicht mehr stur zehn Stunden, sondern nur so lange, bis die Kraft fürs nächste Ziel reicht. Dabei erholt sie sich wie zu Hause.',
      '• Der Phönix: unglaublich schnell, ausdauernd und mit 100 Gold kein Schnäppchen. Er hilft nicht in der Menagerie aus, legt keine Eier und lässt sich nicht leihen.',
      '• Vier statt drei Leiheulen am Tag – und alle vier darfst du leihen.',
      '• Die Menagerie nennt Tempo und Erholung jetzt in km/h und Prozent pro Stunde, die Beschreibungen der Eulen sind aufgefrischt.',
      '• Kann jemand deinen Brief nicht entschlüsseln, siehst du das jetzt, statt „gelesen“.',
      '• Der Hinweis „Bitte neu laden“ bleibt nach dem Neuladen nicht mehr hängen.',
      'Viel Freude mit deinen motivierten Eulen!',
    ],
  },
  {
    version: '0.4.0',
    title: 'Ein Turm voller Neuigkeiten: Version 0.4',
    paragraphs: [
      'Die Eulenmeister haben einen langen Abend im Turm verbracht, und die Eulen haben eifrig Vokabeln gelernt. Das ist neu:',
      '• PostEulen spricht jetzt auch Englisch. Oben rechts sitzt ein kleines britisches Fähnchen: ein Tipp darauf, und alles erscheint auf Englisch – die Hilfe, die Systemnachrichten und sogar neue Briefe der Bots. Das deutsche Fähnchen bringt dich wieder zurück. In den Einstellungen unter „Sprache“ legst du fest, welche Sprache dein Konto bevorzugt.',
      '• Mehr Gold aus der Schatzkammer: In den ersten 30 Tagen nach der Kontoerstellung gibt es jeden Tag 3 Gold, danach 2 Gold – doppelt so viel wie bisher.',
      '• Leiheulen sind fleißiger geworden: Auch sie fliegen jetzt bis zu fünf Freunde nacheinander an, bevor sie sich verabschieden.',
      '• Öffnest du einen Briefwechsel, landest du gleich beim neuesten Brief – kein langes Blättern mehr durch alte Pergamente.',
      '• Die Karte ist jetzt immer quadratisch und passt ganz ins Fenster. Über den Rand der Welt lugt niemand mehr.',
      '• Am großen Bildschirm ist das Gruppenbild der Eulen auf der Übersicht jetzt genauso hoch wie die Kacheln daneben.',
      '• Unten auf der Startseite gibt es einen Link „Spenden“, für alle, die etwas in die Eulenkasse werfen möchten. Freiwillig, wie immer.',
      'Viel Freude beim Schreiben – in welcher Sprache auch immer!',
    ],
  },
  {
    version: '0.3.2',
    title: 'Frisch gefegte Stangen: Version 0.3.2',
    paragraphs: [
      'Die Eulenmeister haben wieder ein paar Kleinigkeiten verzaubert:',
      '• Leihen ohne Warten: Jeden Tag kannst du alle drei Leiheulen des Tages leihen – auch wenn von gestern noch welche bei dir sitzen. Um Mitternacht kommen neue.',
      '• Viele neue Namen für Leiheulen, von Hermes über Wilhelmina bis Gunhilda.',
      '• Schreibst du mehreren Freunden auf einmal, sortiert PostEulen sie so, dass deine Eule den kürzesten Weg fliegt. Wer es anders möchte, ändert die Reihenfolge einfach selbst.',
      '• Briefe stehen jetzt auf echtem Pergament: Briefe an dich auf hellem, deine eigenen auf dunklerem. Das rote Siegel hat Feierabend.',
      '• Am großen Bildschirm leistet dir auf der Übersicht jetzt die ganze Eulenschar Gesellschaft.',
      'Viel Freude beim Schreiben!',
    ],
  },
  {
    version: '0.3.1',
    title: 'Kleine Umräumaktion im Eulenturm: Version 0.3.1',
    paragraphs: [
      'Die Eulen haben sich beschwert: Ihr Gruppenbild hing so weit unten auf der Startseite, dass es kaum jemand gesehen hat.',
      '• Jetzt hängt es gleich neben der Anmeldung, wo vorher der Waldkauz allein auf seiner Stange saß. Der Waldkauz ist natürlich weiter mit auf dem Bild – er wollte ohnehin nicht allein posieren.',
      'Sonst hat sich nichts geändert. Viel Freude beim Schreiben!',
    ],
  },
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

/** English donation requests (v0.4), in the same order as DONATION_TEXTS. */
export const DONATION_TEXTS_EN: readonly LongMessage[] = [
  {
    title: 'A small request from the owlery',
    paragraphs: [
      'PostEulen does not cost you a single penny. For those of us who build PostEulen it is sadly not quite so free: servers, electricity and a great deal of coffee have to be paid for – and lately the owls insist on fresh hazelnut biscuits.',
      'Nobody has to give anything, and PostEulen stays free for everyone. Promise. But if you would like to and can afford it, we would be delighted about a small donation: {link}',
      'Thank you for writing letters here!',
    ],
  },
  {
    title: 'Psst … the owls have done the sums',
    paragraphs: [
      'PostEulen is only free on your side of the window sill. On our side the bills for servers and owl food are piling up – and the Snowy Owl has already started nibbling at them.',
      'Donating is entirely voluntary. There are no adverts and no paywall here, and it will stay that way. Anyone who can and would like to is welcome to drop a few coins into the owl fund: {link}',
      'Many thanks – also for simply being here.',
    ],
  },
  {
    title: 'A letter on our own behalf',
    paragraphs: [
      'Every five weeks we send you this little message, and then we leave you in peace again. Word of honour. PostEulen is free and is meant to stay that way. But behind it are people who code in the evenings instead of petting owls.',
      'Nobody is obliged to give anything. If you like PostEulen and have a few pounds or euros to spare, every donation helps to keep the owlery running: {link}',
      'Thank you! The owls send their regards.',
    ],
  },
];

/** English update notes (v0.4), same versions as UPDATE_NOTES. */
export const UPDATE_NOTES_EN: readonly UpdateNote[] = [
  {
    version: '0.9.0',
    title: 'Owls on hidden paths: version 0.9.0',
    paragraphs: [
      'Some owls like to fly where nobody can follow them. That is why PostEulen now also lives in the Tor network – as a so-called onion service, a kind of hidden owl tower with an entrance of its own.',
      'What is new:',
      '• At the very bottom of the start page there is the link “Tor network”. In the Tor Browser it opens PostEulen through the Tor network. If you open PostEulen in the Tor Browser anyway, it suggests the onion address by itself.',
      '• Everything there is as usual: the same account, the same letters, the same owls. You can switch between both ways as you like – but you are only ever signed in in one place at a time. Signing in on one way ends the session on the other.',
      '• To keep the hidden tower from getting too crowded, PostEulen watches the rush there particularly strictly. If it ever gets busy, a short wait helps.',
      '• The free parchment is now called “short parchment”, the large one “long parchment”. Length and price stay the same.',
      '• A few owls have new portraits: they now take off and come home even more beautifully.',
      'Happy flying on every path!',
    ],
  },
  {
    version: '0.8.5',
    title: 'Letters from our readers: version 0.8.5',
    paragraphs: [
      'First of all, a big thank you! Most of what is new in this version comes from you: from messages to the admin, from chats around the kitchen table and from things you noticed while writing, caring and borrowing. You spotted where an owl was awkward to find, where a hint was missing and where the map got too crowded. Every one of these suggestions has made the owl tower a little cosier – thank you so very much.',
      'What is new:',
      '• Every owl that is ready has a “Write a letter” button in the owl overview: pick the recipients and it is already waiting in the conversation. When writing, the owl choice is there from the start and stays while you type. The loan owls of the day are always among the choices.',
      '• Rest: your own owls first stay 2 hours, loan owls 24 hours with each recipient – if you choose something else, it sticks.',
      '• In the Menagerie everyone now rolls an offer of their own each day. Once a loan is over, its offer disappears until tomorrow.',
      '• If an owl is resting with you, a little owl in your conversations shows whose it is – instead of a system message. If it still carries letters for others, it tells you when you hand it a reply (but not for whom).',
      '• One of your own owls resting elsewhere shows its empty perch in the overview. Pictures in letters from bots can be viewed large with a tap.',
      '• Chicks: you now have five days for names and the gift before the lot decides.',
      '• You can only release an owl into the wild while you have more than 20 of your own.',
      '• The flight paths and the “Zzz” on the map are gone – they quickly made it cluttered.',
      '• PostEulen now tidies away old letters once a week, early on Mondays. Burning letters still works at once.',
      'And please keep writing! At the very bottom of the settings you will find “Message to the admin” – every idea, every question and every little annoyance is welcome there. The next owl post is already waiting.',
    ],
  },
  {
    version: '0.8.4',
    title: 'A guest from overseas: version 0.8.4',
    paragraphs: [
      'A new species has moved into the owlery: the Great Horned Owl, a fast and tireless eagle-owl from the Americas with jaunty ear tufts. You cannot buy it in the Menagerie – but perhaps a pen friend or a voucher will bring you one.',
      'Also, every arriving owl now shows itself only once when you open a conversation. Twice is nice – but not with owls.',
      'Enjoy!',
    ],
  },
  {
    version: '0.8.3',
    title: 'Smoothed-out parchment: version 0.8.3',
    paragraphs: [
      'A few little things from the owls’ writing room:',
      '• Very long letters now lie straight on the table and no longer slide out of view. Short letters may still lie a little askew – that is just what a desk looks like.',
      '• When the owl of a pen friend rests with you, you may now give it water, pet it and feed it too – entirely free, the pen friends treat you.',
      '• The pen friends remember your correspondence better and pick up in their letters on what you last wrote to each other.',
      'Enjoy reading!',
    ],
  },
  {
    version: '0.8.2',
    title: 'Freshly preened feathers: version 0.8.2',
    paragraphs: [
      'The owls have had a good preen and changed a few habits:',
      '• Your conversation is now sorted the way you experienced it: your letters stand where you sent them, received ones where they reached you. And when several letters arrive at once, each owl shows itself in turn as you open the chat.',
      '• The owls no longer tell whether or when someone read your letter – all you see is that it was delivered. A little secrecy of correspondence is a must.',
      '• When someone else\'s owl rests with you, it lets you know and tells you how long it will stay. If you would like it to leave sooner, just send it on its way under "Owls" – even without a letter.',
      '• The settings have a switch that makes links in letters clickable or turns that off. And now and then the operator pins a small notice up for everyone – you can fold it away with a click.',
      'Enjoy writing!',
    ],
  },
  {
    version: '0.8.1',
    title: 'A quill stroke touched up: version 0.8.1',
    paragraphs: [
      'While moving into the new owlery, a feather got caught: anyone who had just sent an owl to one of the retired pen friends made the tower stumble. That is fixed – such owls simply turn round and fly home.',
      'With this, the new pen friends of version 0.8 have arrived in your owlery too – if your operator has already invited some, their letters will flutter in soon.',
      'Enjoy!',
    ],
  },
  {
    version: '0.8.0',
    title: 'New feathers in the owlery: version 0.8',
    paragraphs: [
      'The owlery has become livelier:',
      '• From now on new pen friends may turn up. They write to all owl friends at special moments, sometimes with pictures, sometimes with a small gift. If you reply, their next letter has a very personal answer for you.',
      '• These characters live anywhere in the world – so their owls sometimes fly across oceans and then wait with you for a while. While one is resting, you can hand it a reply.',
      '• Two long-standing pen friends have gone into well-earned retirement; their letters have gone with them. Gold they gave you is of course still yours.',
      '• You can write one letter a calendar day to every bot, the Explainer Bear too. And if you remove all bots in the settings, future ones will not write to you either.',
      'Enjoy your new pen friends!',
    ],
  },
  {
    version: '0.7.2',
    title: 'Tidying the owlery: version 0.7.2',
    paragraphs: [
      'The owl masters have tidied up a few corners of the owlery:',
      '• When one of your owls comes home, it now lands on the window sill with its picture every time – at once or the next time you open the app. There is no system message about it any more.',
      '• The bots no longer live in the address book. You find them under Letters, where you can also remove them one by one. In the settings you can say goodbye to all bots at once.',
      '• Anyone who had burnt all letters of a bot sometimes got invisible post afterwards. That is fixed.',
      '• Short times under an hour are now shown in minutes.',
      'Happy writing!',
    ],
  },
  {
    version: '0.7.1',
    title: 'Polishing the owlery: version 0.7.1',
    paragraphs: [
      'After the big extension, the owl masters swept up the shavings and set a few things straight:',
      '• Times are now shown everywhere in the local time where you live – including an owl’s rest with your friends.',
      '• If you tap “Give it a reply” on a visiting owl, it is chosen straight away, and nothing else distracts you.',
      '• Before an owl is bought, the Menagerie asks once more – so that no gold flutters away by mistake.',
      '• The button below plus and minus on the map takes you back to the view it opened with.',
      '• New at the very bottom of the settings: a short message to the admin if something is not working or you have an idea. It is not encrypted and arrives without your name.',
      'Enjoy your owls!',
    ],
  },
  {
    version: '0.7.0',
    title: 'Owls that stay for a chat: version 0.7',
    paragraphs: [
      'There has been some building work at the owlery. The most important news first: your owls may now take a rest with your friends.',
      '• When writing a letter, you choose how long the owl stays with each recipient: not at all, 1, 2, 24 or 48 hours. There it rests as if at home, happily lets itself be pampered – and takes a reply back to you. Once it has a letter, it takes off at once. If it comes home with post, it tells you.',
      '• An owl’s motivation now only counts for the next leg. Whoever gives a resting owl water or a treat sends it on its way more briskly.',
      '• The map now shows the whole world. You can still only live in familiar Western Europe – but who knows where the owls will roam one day.',
      '• On the overview PostEulen greets you according to the time of day where you live, and the daily gold now arrives as early as 3 in the morning (UTC) – the gold in the top right shows it at once.',
      '• Sent letters tell you which owl carried them. “Delete chat” is now called “Burn all letters” – with a crackling fire. And when old letters are removed because of the deletion period, you learn how many and from which conversations.',
      '• Brooding owls can now be seen sitting on their eggs, owls coming home reliably land on the window sill with a picture, and when you buy an owl you see its sex before you name it.',
      '• Plus many small things: motivation is shown in per cent, loan owls no longer repeat on two days in a row, conversations open at the oldest unread letter, and the settings show your current name.',
      'Happy writing – and happy hosting of other people’s owls!',
    ],
  },
  {
    version: '0.6.1',
    title: 'New locks for the owl tower: version 0.6.1',
    paragraphs: [
      'This time the locksmiths came to visit. They rattled every door and window of the tower and tightened every lock that did not sit as firmly as it should:',
      '• Anyone guessing passwords at the door now always has to sit out the prescribed waiting time – even when trying many guesses at once.',
      '• Many neighbours signing in over the same internet connection are no longer mistaken for password guessers.',
      '• After you sign out, the app now forgets the key bindings of your contacts at once. If someone else then signs in in the same window, they see nothing of it.',
      '• When you open a conversation, the app checks again that the keys of the other person are still the same.',
      '• Links in letters whose address contains unusual characters – such as a letter from another alphabet that looks like a familiar one – are now shown in their technical form, with a warning. A disguised address stands out at once.',
      'Nothing else changes for your letters: everything stays readable, and your owls fly as usual.',
    ],
  },
  {
    version: '0.6.0',
    title: 'A big spring clean in the owl tower: version 0.6',
    paragraphs: [
      'No new tricks this time. Instead, the owl masters went through every corner of the tower with a feather duster and a magnifying glass and put quite a few things straight:',
      '• On very narrow phones, your gold and the little flag sometimes slipped off the screen. Now “New post!” gets a line of its own there, and everything stays where it belongs.',
      '• Long headings wrap neatly, and the bar at the bottom fits even the smallest display.',
      '• The help is up to date again. It still said, for example, that tired owls stubbornly sleep for ten hours – they have not done that since version 0.5.',
      '• Lots of small texts have been polished, in English and in German. Homes west of Greenwich are now shown properly with “° W”.',
      '• Nobody can call themselves like the bots any more (“Explainer Bear”). No more mix-ups.',
      'Enjoy writing – in a freshly cleaned tower!',
    ],
  },
  {
    version: '0.5.1',
    title: 'Shh, owls asleep: version 0.5.1',
    paragraphs: [
      'Owls are night birds – and now you can see it:',
      '• When an owl takes a rest on the way, the owl overview shows it asleep, by day or under the night sky.',
      '• When it is light at your home, a healthy owl sometimes dozes on its perch. Do not worry: you can still care for it and send it off, and after a cuddle it is wide awake for a while.',
      '• The Short-eared Owl now costs only 7 gold, the Great Grey Owl 12 gold.',
      'Sleep well – and enjoy writing!',
    ],
  },
  {
    version: '0.5.0',
    title: 'A phoenix on the window sill: version 0.5',
    paragraphs: [
      'Quite a lot has happened in the owlery – and one morning a phoenix was suddenly sitting there. Here is what is new:',
      '• Motivation: every owl now has a second bar. It drops a little every night and rises when you look after your owl. A motivated owl flies faster and further on its next trip and recovers more quickly on the way; a listless one is a bit slower.',
      '• More care: besides petting and the owl biscuit, you can give your owl water once a day (free) and its favourite snack (0.2 gold) – the Tawny Owl adores hazelnuts, Blakiston’s Fish Owl smoked fish. Two different kinds of care on one day keep it healthy.',
      '• Smarter naps: a tired owl on its way no longer sleeps a stubborn ten hours, but only until it has the strength for its next destination. It recovers just as at home.',
      '• The phoenix: incredibly fast, with great stamina – and at 100 gold no bargain. It does not help out in the Menagerie, lays no eggs and cannot be borrowed.',
      '• Four loan owls a day instead of three – and you may borrow all four.',
      '• The Menagerie now gives speed and recovery in km/h and percent per hour, and the owls’ descriptions have been refreshed.',
      '• If somebody cannot decrypt your letter, you now see that instead of “read”.',
      '• The “please reload” note no longer sticks around after reloading.',
      'Enjoy your motivated owls!',
    ],
  },
  {
    version: '0.4.0',
    title: 'A tower full of news: version 0.4',
    paragraphs: [
      'The owl masters have spent a long evening in the tower, and the owls have been busy learning vocabulary. Here is what is new:',
      '• PostEulen now speaks English too. A little British flag sits in the top right corner: one tap and everything appears in English – the help, the system messages and even new letters of the bots. The German flag takes you back. In the settings under “Language” you choose which language your account prefers.',
      '• More gold from the treasury: during the first 30 days after creating your account you get 3 gold every day, and 2 gold after that – twice as much as before.',
      '• Loan owls have become more hard-working: they too now fly to up to five friends one after another before they say goodbye.',
      '• When you open a conversation, you land right at the latest letter – no more leafing through old parchments.',
      '• The map is now always square and fits completely into the window. Nobody peeks over the edge of the world any more.',
      '• On large screens, the group picture of the owls on the overview is now exactly as tall as the tiles next to it.',
      '• At the bottom of the start page there is a “Donate” link for everyone who would like to drop something into the owl fund. Voluntary, as always.',
      'Enjoy writing – in whichever language you like!',
    ],
  },
  {
    version: '0.3.2',
    title: 'Freshly swept perches: version 0.3.2',
    paragraphs: [
      'The owl masters have enchanted a few little things again:',
      '• Borrowing without waiting: every day you can borrow all three loan owls of the day – even if some from yesterday are still sitting with you. New ones arrive at midnight.',
      '• Lots of new names for loan owls, from Hermes to Wilhelmina and Gunhilda.',
      '• If you write to several friends at once, PostEulen sorts them so that your owl flies the shortest way. If you want it differently, simply change the order yourself.',
      '• Letters now sit on real parchment: letters to you on light parchment, your own on darker parchment. The red seal has clocked off.',
      '• On large screens, the whole flock of owls now keeps you company on the overview.',
      'Enjoy writing!',
    ],
  },
  {
    version: '0.3.1',
    title: 'A little tidy-up in the owl tower: version 0.3.1',
    paragraphs: [
      'The owls complained: their group picture hung so far down the start page that hardly anyone saw it.',
      '• Now it hangs right next to the sign-in, where the Tawny Owl used to sit alone on its perch. The Tawny Owl is of course still in the picture – it did not want to pose alone anyway.',
      'Nothing else has changed. Enjoy writing!',
    ],
  },
  {
    version: '0.3.0',
    title: 'News from the owl tower: version 0.3',
    paragraphs: [
      'Hear, hear! Overnight the owl masters have dusted the tower, oiled the perches and spoken a few spells anew. Here is what is new:',
      '• Longer letters: a free letter now holds up to 800 characters, a large parchment even 15,000 – enough for a whole chapter of magical studies.',
      '• Letters now look like real sheets of writing paper, with frayed edges and a red seal. And behind everything shimmers an old world map, as if painted in faded ink.',
      '• When an owl is on its way, the owl overview shows it in flight – in sunshine or under the stars, depending on where it is. On the map it draws a fine brown trail behind it, and a “Zzz” reveals where it spent the night. The map now checks in every five minutes.',
      '• When an owl comes home, you get a message with a picture: it waits on the window sill, in daylight or by candlelight. If you have notifications switched on, it knocks there too.',
      '• In the owl overview, loan owls and your own owls are now shown separately. If one of your owls is helping out in the Menagerie, you see its empty perch there.',
      '• In the Menagerie the loan owls are at the very top. The owls for sale are sorted by price, and each now tells you a little about itself.',
      '• Setting an owl free now only works if you type its name and confirm twice. No more goodbyes by accident.',
      '• Letters you have read count as read straight away – without reloading.',
      '• You can hide the note about unconfirmed notifications until the next sign-in.',
      '• The help now explains in detail and at leisure how to get PostEulen onto your phone – without an app store.',
      'Enjoy writing – and do not forget the hazelnut biscuits!',
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

export function updateNote(version: string, language: 'de' | 'en' = 'de'): UpdateNote | undefined {
  const notes = language === 'en' ? UPDATE_NOTES_EN : UPDATE_NOTES;
  return notes.find((note) => compare(note.version, version) === 0);
}

/** One of the three donation requests in a language (v0.4). */
export function donationText(index: number, language: 'de' | 'en' = 'de'): LongMessage | undefined {
  return (language === 'en' ? DONATION_TEXTS_EN : DONATION_TEXTS)[index];
}
