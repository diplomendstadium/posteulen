/**
 * All user-facing German texts (SPEC 1: one central file). Keys are English; values are
 * German. Placeholders use {name}. v0.4: the English view has the same keys in en.ts, typed
 * against `Texts`, so no text can be missing there.
 */
import { formatGold } from '../game/gold.ts';

export const de = {
  app: {
    name: 'PostEulen',
    tagline: 'Briefe, die eine Eule bringt.',
    offline: 'Keine Verbindung – Eulen brauchen Netz.',
    updateAvailable: 'Eine neue Version ist da. Bitte neu laden.',
    reload: 'Neu laden',
    back: 'Zurück',
    newPost: 'Neue Post!',
    newPostCount: '{count} ungelesen',
    version: 'v{version}',
    /** v0.8.5: the footer link to the repository (before: the version number). */
    sourceCode: 'Quelltext',
    versionLink: ' auf GitHub (öffnet in einem neuen Tab)',
    skipToContent: 'Zum Inhalt springen',
    /** v1.3.2: the power button at the right end of the top bar. */
    logout: 'Abmelden',
    logoutConfirm:
      'Möchtest du dich wirklich abmelden? Dabei werden alle Schlüssel auf diesem Gerät gelöscht.',
    /** v1.3.2: the balance in the top bar shows only the amount; for screen readers. */
    goldLabel: 'Gold',
  },
  language: {
    /** Flag in the top right corner (v0.4): label in the language it switches to. */
    switchLabel: 'Switch to English',
    switchTo: 'en',
    title: 'Sprache',
    intro:
      'In welcher Sprache möchtest du PostEulen sehen? Deine Wahl gilt für dieses Konto und auf jedem Gerät, auf dem du dich anmeldest. Auch die Bots schreiben dir dann in dieser Sprache. Umschalten kannst du jederzeit auch mit dem Fähnchen oben rechts.',
    legend: 'Sprache der App',
    de: 'Deutsch',
    en: 'English (Englisch)',
    saved: 'Gespeichert.',
  },
  start: {
    title: 'Willkommen bei PostEulen',
    intro:
      'Hier schreibst du Briefe, die von Eulen überbracht werden – sicher verschlüsselt und mit etwas Geduld.',
    groupAlt:
      'Siebzehn Posteulen verschiedener Arten sitzen nebeneinander auf drei Holzstangen vor einer Steinwand.',
    /** v1.1: the group picture by night and in the Christmas season. */
    groupAltNight:
      'Siebzehn Posteulen verschiedener Arten sitzen nachts hellwach nebeneinander auf drei Holzstangen vor einer Steinwand.',
    groupAltChristmasDay:
      'Siebzehn Posteulen verschiedener Arten sitzen auf drei weihnachtlich geschmückten Holzstangen vor einer Steinwand.',
    groupAltChristmasNight:
      'Siebzehn Posteulen verschiedener Arten sitzen nachts hellwach auf drei weihnachtlich geschmückten Holzstangen vor einer Steinwand.',
    loginHeading: 'Anmelden',
    userName: 'Nutzername',
    password: 'Passwort',
    login: 'Anmelden',
    createAccount: 'Konto erstellen',
    loggingIn: 'Anmeldung läuft …',
    stepCaptcha: 'Kurze Rechenaufgabe gegen Missbrauch …',
    stepPassword: 'Passwort wird geprüft …',
    wrong: 'Name oder Passwort stimmen nicht.',
    wait: 'Zu viele Versuche. Bitte warte {seconds} Sekunden.',
    deletionCancelled: 'Willkommen zurück! Die Löschung deines Kontos wurde abgebrochen.',
    /** v1.2.3: name of the info text box at the bottom of the start page (shared/texts/about.ts). */
    about: 'Über PostEulen',
    /** v1.3.2: figures of this instance below "Über PostEulen" (SPEC 8.1). */
    instance: 'Über diese Instanz',
    instanceCreated: 'Konten insgesamt erstellt',
    instanceCurrent: 'Konten vorhanden',
    instanceActive: 'In den letzten 30 Tagen aktiv',
    instanceLetters: 'Briefe zwischen Menschen',
    instanceLettersValue: '{total} insgesamt, {last7} in den letzten 7 Tagen',
    instanceOwls: 'Eulen im Besitz der Spieler',
  },
  register: {
    title: 'Konto erstellen',
    closed: 'Neue Konten können gerade nicht erstellt werden.',
    inviteOnly: 'Ein Konto kann nur mit Einladungscode erstellt werden.',
    userName: 'Nutzername',
    userNameHint: '3–20 Zeichen: Buchstaben (auch Umlaute und Akzente), Ziffern, Leerzeichen.',
    password: 'Passwort',
    passwordHint:
      'Mindestens 15 Zeichen. Am besten ein Satz, den nur du kennst – nicht dein Nutzername und keine bekannte Zeichenfolge.',
    passwordRepeat: 'Passwort wiederholen',
    inviteCode: 'Einladungscode',
    home: 'Fiktiver Wohnort',
    homeHint:
      'Tippe auf die Karte. Überlege sorgfältig, ob du deine echte Adresse wählen möchtest.',
    homeChosen: 'Gewählt: {lat}° {ns}, {lon}° {ew}',
    north: 'N',
    south: 'S',
    east: 'O',
    west: 'W',
    homeWater: 'Dort ist Wasser. Eulen wohnen lieber an Land.',
    homeMissing: 'Bitte wähle einen Wohnort auf der Karte.',
    warning:
      'Ich habe verstanden: Wenn ich mein Passwort verliere, sind alle meine Daten unwiderruflich verloren. Das Passwort wird nicht auf dem Server gespeichert, und auch der Admin kann es nicht zurücksetzen.',
    submit: 'Konto erstellen',
    stepCaptcha: 'Kurze Rechenaufgabe gegen Missbrauch …',
    stepKeys: 'Schlüssel werden erzeugt …',
    mismatch: 'Die beiden Passwörter sind nicht gleich.',
    tooShort: 'Das Passwort ist zu kurz (mindestens 15 Zeichen).',
    tooLong: 'Das Passwort ist zu lang (höchstens 256 Zeichen).',
    /** v1.3.1: too easy to guess (SPEC 7.2). */
    containsName: 'Dein Passwort darf deinen Nutzernamen nicht enthalten.',
    common:
      'Dieses Passwort steht auf öffentlichen Listen oft benutzter Passwörter und ist deshalb leicht zu erraten. Bitte wähle ein anderes.',
    pattern:
      'Dieses Passwort ist zu leicht zu erraten (zum Beispiel 123456…, qwertz…, abcdef… oder Wiederholungen). Bitte wähle ein anderes – am besten einen Satz, den nur du kennst.',
    confirmRequired: 'Bitte bestätige den Hinweis zum Passwort.',
  },
  welcome: {
    title: 'Willkommen bei PostEulen!',
    intro:
      'Dein Konto ist fertig – herzlichen Glückwunsch, du bist jetzt offiziell Eulenhalterin oder Eulenhalter! Bevor die erste Eule abhebt, verraten wir dir noch einen kleinen Zaubertrick: wie PostEulen auf deinen Startbildschirm kommt, ganz wie eine richtige App.',
    appTitle: 'Eine App ganz ohne App-Store',
    app1: 'Apps holt man sich im App-Store, oder? Meistens schon. Es gibt aber noch einen zweiten, ziemlich praktischen Weg: Manche Webseiten können sich in eine App verwandeln. Du legst PostEulen einfach auf deinen Startbildschirm – und ab dann hat es dort ein eigenes Eulen-Symbol, öffnet sich ohne Adresszeile und sieht aus wie jede andere App.',
    app2: 'Das ist kein Hexenwerk und auch nicht gefährlich. Es wird nichts heimlich installiert, PostEulen will nicht an deine Fotos oder dein Telefonbuch, und du kannst das Symbol jederzeit wieder löschen wie jede andere App auch. Updates kommen von selbst, ganz ohne Store.',
    android: 'Android-Handy mit Chrome',
    androidSteps: [
      'Öffne PostEulen in Chrome – das tust du vermutlich gerade.',
      'Tippe oben rechts auf die drei Punkte ⋮.',
      'Wähle „Zum Startbildschirm hinzufügen“ und dann „Installieren“. Auf manchen Handys heißt der Eintrag gleich „App installieren“.',
      'Fertig! Auf deinem Startbildschirm sitzt jetzt eine Eule. Öffne PostEulen ab sofort am besten über dieses Symbol.',
    ],
    ios: 'iPhone oder iPad mit Safari',
    iosSteps: [
      'Öffne PostEulen in Safari. Mit anderen Browsern klappt es auf dem iPhone leider nicht richtig.',
      'Tippe auf das Teilen-Symbol: das Quadrat mit dem Pfeil nach oben. Bei neueren iPhones versteckt es sich hinter den drei Punkten ••• unten rechts.',
      'Schiebe die Liste etwas nach oben und tippe auf „Zum Home-Bildschirm“, dann auf „Hinzufügen“.',
      'Fertig! Öffne PostEulen ab jetzt über das neue Symbol auf deinem Home-Bildschirm – nur dort gibt es auf dem iPhone Benachrichtigungen.',
    ],
    other: 'Alle anderen Handys und der Computer',
    otherSteps:
      'Du nutzt einen anderen Browser, zum Beispiel Firefox, oder sitzt am Computer? Kein Problem: Leg dir PostEulen als Lesezeichen auf den Startbildschirm oder in die Lesezeichenleiste – oder benutze es einfach ganz normal im Browser. Alles funktioniert genauso: Briefe schreiben, Eulen füttern, Gold verdienen.',
    pushTitle: 'Und die Benachrichtigungen?',
    push1:
      'Der einzige Unterschied: Als App auf dem Startbildschirm (Android mit Chrome oder iPhone mit Safari) kann PostEulen dir Bescheid sagen, wenn eine Eule bei dir landet. Im normalen Browser kommt die Post genauso an – du siehst sie eben, wenn du das nächste Mal hineinschaust.',
    push2: 'Im echten Leben klingelt der Briefkasten ja auch nicht, wenn Post kommt. ;-)',
    push3:
      'Möchtest du Benachrichtigungen? Dann tippe unten auf „Benachrichtigungen einrichten“ und erlaube sie, wenn dein Handy fragt. PostEulen schickt dir sofort eine Probe-Nachricht, damit du siehst, dass alles klappt. Auf dem iPhone geht das erst, wenn du PostEulen über das neue Symbol auf dem Home-Bildschirm geöffnet hast.',
    helpLink: 'Noch Fragen? Die Hilfe erklärt alles in Ruhe',
    continue: 'Weiter zur Übersicht',
  },
  settings: {
    title: 'Einstellungen',
    passwordTitle: 'Passwort ändern',
    oldPassword: 'Bisheriges Passwort',
    newPassword: 'Neues Passwort',
    newPasswordRepeat: 'Neues Passwort wiederholen',
    change: 'Passwort ändern',
    stepOld: 'Bisheriges Passwort wird geprüft …',
    stepNew: 'Neues Passwort wird eingerichtet …',
    changed: 'Dein Passwort wurde geändert. Andere Geräte sind abgemeldet.',
    wrongOld: 'Das bisherige Passwort stimmt nicht.',
    logoutTitle: 'Abmelden',
    logout: 'Abmelden',
    logoutHint: 'Beim Abmelden werden alle Schlüssel auf diesem Gerät gelöscht.',
    nameTitle: 'Nutzernamen ändern',
    currentName: 'Dein aktueller Nutzername:',
    voucherTitle: 'Gutschein einlösen',
    voucherIntro:
      'Hast du einen Gutschein bekommen? Tippe den Code hier ein. Jeder Gutschein lässt sich einmal einlösen.',
    voucherCode: 'Gutscheincode',
    voucherRedeem: 'Einlösen',
    voucherGold: 'Eingelöst: {amount} sind deinem Konto gutgeschrieben.',
    voucherOwl:
      'Eingelöst: Eine neue Eule ({species}) ist bei dir eingezogen und wartet auf ihren Namen.',
    voucherToOwls: 'Zu den Eulen',
    /** v1.3.1: owl biscuits or treats for the pouch. */
    voucherBiscuits: 'Eingelöst: {count} liegen jetzt in deinem Beutel.',
    nameIntro: 'Einmal pro Kalenderjahr. Deine Kontakte erfahren es per Systemnachricht.',
    nameBlocked: 'Du kannst deinen Namen erst im nächsten Kalenderjahr wieder ändern.',
    newName: 'Neuer Name',
    nameSave: 'Namen ändern',
    nameChanged: 'Du heißt jetzt {name}.',
    lettersTitle: 'Briefe',
    retentionIntro:
      'Alle Briefe und Systemnachrichten werden spätestens ein Jahr nach ihrer Zustellung unwiderruflich gelöscht – bei dir und bei allen anderen. Für deine eigenen Kopien (geschriebene und erhaltene Briefe) wählst du hier die Frist; neue Konten beginnen mit 180 Tagen. Dein Gegenüber behält seine Kopie, bis seine eigene Frist abläuft. Aufgeräumt wird einmal in der Woche, montags früh – ein Brief kann also bis zu sieben Tage länger liegen bleiben als seine Frist.',
    retentionLegend: 'Meine Briefe löschen nach',
    retention30: '30 Tagen',
    retention90: '90 Tagen',
    retention180: '180 Tagen (Standard)',
    retention365: 'einem Jahr',
    retentionConfirm:
      'Alle deine Briefe und Systemnachrichten, die älter als {days} Tage sind, werden beim nächsten wöchentlichen Aufräumen (montags früh) unwiderruflich gelöscht. Fortfahren?',
    printLabel: 'Briefe in Druckschrift statt Handschrift anzeigen',
    /** v0.8.2 */
    linksLabel: 'Links in Briefen anklickbar',
    asciiLabel: 'ASCII-Modus',
    asciiHint:
      'Beim Schreiben eines Briefs an einen Menschen kannst du dann für diesen einen Brief eine schlichte Schreibmaschinenschrift wählen – praktisch für Bilder aus Buchstaben und Zeichen (ASCII-Art). Beide sehen den Brief dauerhaft in dieser Schrift. Du wählst sie bei jedem Brief neu; sonst bleibt es bei der Handschrift.',
    helpHint:
      'Alles über Eulen, Briefe, Gold und Sicherheit – und der Erklärbär beantwortet deine Fragen.',
    helpLink: 'Zur Hilfe',
    linksHint:
      'Ausgeschaltet stehen Internetadressen nur als Text im Brief – nichts öffnet sich aus Versehen. Verkleidete Adressen werden weiter markiert.',
    printHint: 'Leichter zu lesen, zum Beispiel auf kleinen Bildschirmen.',
    lettersSave: 'Speichern',
    lettersSaved: 'Gespeichert.',
    homeTitle: 'Wohnort ändern',
    homeIntro:
      'Bis zu 3-mal pro Kalendermonat möglich. Tippe auf die Karte (nur Land). Überlege sorgfältig, ob du deine echte Adresse wählen möchtest. Eulen, die gerade zu dir unterwegs sind, ändern ihren Kurs.',
    homeLeft: 'Diesen Monat noch {count}-mal möglich.',
    homeBlocked: 'Diesen Monat bist du schon 3-mal umgezogen. Wieder möglich ab {date}.',
    homeSave: 'Wohnort übernehmen',
    homeChanged: 'Dein neuer Wohnort ist gespeichert.',
    deleteTitle: 'Konto löschen',
    deleteIntro:
      'Du wirst sofort abgemeldet. Meldest du dich innerhalb von 24 Stunden wieder an, wird die Löschung abgebrochen. Danach werden alle deine Daten endgültig gelöscht; was andere von dir bekommen haben, bleibt bei ihnen.',
    deletePassword: 'Passwort zur Bestätigung',
    deleteButton: 'Konto löschen',
    deleteConfirm:
      'Dein Konto wirklich löschen? Nach 24 Stunden ist das nicht mehr rückgängig zu machen.',
  },
  contacts: {
    title: 'Adressbuch',
    addTitle: 'Kontakt hinzufügen',
    addIntro:
      'Gib den Namen genau so ein, wie ihn die andere Person verwendet. Ihr seid verbunden, sobald sie dich ebenfalls hinzufügt.',
    name: 'Name',
    add: 'Hinzufügen',
    requestSaved:
      'Anfrage gespeichert. Sobald {name} dich ebenfalls hinzufügt, seid ihr verbunden.',
    limit: 'Heute sind keine weiteren Anfragen möglich (höchstens 20 pro Tag).',
    none: 'Noch keine Kontakte.',
    pending: 'unbestätigt – noch {duration}',
    cancel: 'Zurückziehen',
    inactive: 'inaktiv',
    compared: 'Sicherheitsnummer verglichen',
    notCompared: 'Sicherheitsnummer nicht verglichen',
    keyWarning: 'Schlüsselwarnung',
    keyWarningLong:
      'Die Schlüssel von {name} haben sich geändert. Aus Sicherheitsgründen kannst du {name} nichts mehr schicken. Entferne den Kontakt und koppelt euch neu, nachdem ihr euch außerhalb der App abgesprochen habt.',
    keysChanged:
      'Achtung: {name} hat beim erneuten Koppeln andere Schlüssel als früher. Bitte vergleicht die Sicherheitsnummer außerhalb der App.',
    safetyTitle: 'Sicherheitsnummer mit {name}',
    safetyIntro:
      'Vergleicht diese Nummer außerhalb der App, zum Beispiel am Telefon oder persönlich. Stimmt sie überein, liest niemand dazwischen mit.',
    safetyConfirm: 'Ich habe die Nummer mit {name} außerhalb der App verglichen',
    safetyNote:
      'Diese Bestätigung speichert nur deine Angabe. Die App selbst kann die Identität nicht prüfen.',
    show: 'Sicherheitsnummer anzeigen',
    hide: 'Ausblenden',
    write: 'Brief schreiben',
    remove: 'Kontakt entfernen',
    removeConfirm:
      'Kontakt {name} wirklich entfernen? Ihr müsst euch danach neu koppeln. Eulen, die zwischen euch unterwegs sind, kehren um.',
  },
  letters: {
    title: 'Briefwechsel',
    /**
     * v1.2.1: the picture on top of the letters page – the desk of the season at home, by day or
     * by night; `view` is one of the desk_… texts below.
     */
    picture:
      'Ein Schreibtisch voller Briefe mit Federkiel und Tintenfass vor hohen Bogenfenstern, draußen {view}',
    desk_christmas_day: 'ein verschneites Dorf im Tageslicht, am Fenster hängt ein Mistelzweig',
    desk_christmas_night:
      'ein verschneites Dorf bei Nacht, im Zimmer Kerzenschein und ein geschmücktes Bäumchen',
    desk_winter_day: 'ein verschneites Dorf im Tageslicht',
    desk_winter_night: 'ein verschneites Dorf bei Nacht, auf dem Tisch brennen Kerzen',
    desk_spring_day: 'blühende Bäume im Frühlingslicht, auf dem Tisch ein Blumenstrauß',
    desk_spring_night: 'blühende Bäume in einer Frühlingsnacht, auf dem Tisch brennen Kerzen',
    desk_summer_day: 'sattgrüne Bäume im Sommerlicht',
    desk_summer_night: 'sattgrüne Bäume in einer Sommernacht, auf dem Tisch brennen Kerzen',
    desk_autumn_day: 'buntes Herbstlaub im Tageslicht',
    desk_autumn_night: 'buntes Herbstlaub in einer Herbstnacht, auf dem Tisch brennen Kerzen',
    desk_november_day: 'kahle Bäume an einem grauen Novembertag',
    desk_november_night: 'kahle Bäume in einer Novembernacht, auf dem Tisch brennen Kerzen',
    none: 'Noch keine Briefe. Füge im Adressbuch einen Kontakt hinzu und schreib den ersten Brief.',
    system: 'Systemnachrichten',
    /** v0.8.5: behind the name in the chat list. */
    owlRestingHere: 'Eine Eule von {name} rastet gerade bei dir',
    unread: '{count} ungelesen',
    unknown: 'unbekannt',
    from: 'Gebracht von {owl} ({species})',
    carriedBy: 'Unterwegs mit {owl} ({species})',
    carrierLoan: '{species}, Leiheule',
    carrierYours: '{species}, deine Eule',
    carrierOf: '{species}, Eule von {name}',
    /** v0.10.1: head of a letter – when it arrived or when it was sent off. */
    receivedAt: 'Empfangen am {date} um {time}',
    sentOffAt: 'Abgeschickt am {date} um {time}',
    small: 'kurzes Pergament',
    large: 'langes Pergament',
    inFlight: 'Eule unterwegs – Ankunft ca. {time}',
    delivered: 'zugestellt',
    returned: 'nicht zugestellt – die Eule ist umgekehrt',
    /** v0.8.2: the recipient could not show the letter (sender's view). */
    unreadable: 'Die Eule hat den Brief unterwegs verloren.',
    /** v0.8.2: decryption or authenticity check failed (recipient's view). */
    monoOption: 'Schreibmaschinenschrift für diesen Brief (für ASCII-Art)',
    keysLoading: 'Der Brief wird gerade entsiegelt – einen Moment bitte …',
    invalid: 'Der Brief ist unterwegs so nass geworden, dass man ihn nicht mehr lesen kann.',
    /** v0.6.1: a link whose address contains unusual characters (shown in technical form). */
    linkWarning: 'Ungewöhnliche Zeichen in der Adresse – genau prüfen, wohin der Link führt.',
    compose: 'Neuen Brief schreiben',
    parchment: 'Pergament',
    smallOption: 'Kurz – bis 800 Zeichen',
    largeOption: 'Lang – bis 15.000 Zeichen',
    text: 'Text',
    counter: '{count} von {max} Zeichen',
    noSmileys: 'Pergament kennt keine Smileys.',
    recipients: 'Empfänger (höchstens 5, in dieser Reihenfolge)',
    restLabel: 'Rast bei jedem Empfänger',
    restNone: 'Gar nicht',
    restHours: '{hours} Std.',
    restHint:
      'So lange bleibt die Eule bei jedem Empfänger, erholt sich dort wie zu Hause und nimmt eine Antwort an dich mit. Bekommt sie eine Antwort, fliegt sie sofort weiter.',
    guestGone: 'Die Gast-Eule ist inzwischen weitergeflogen. Wähle eine andere Eule.',
    /** v0.8.5: the preselected rest depends on the kind of owl. */
    restDefaultOwn: 'Vorgewählt für eigene Eulen: 2 Std.',
    restDefaultLoan: 'Vorgewählt für Leiheulen: 24 Std.',
    choicesLoading: 'Die Eulen werden gerufen …',
    guestHint: 'Rastet gerade bei dir (bis {time}) und bringt deine Antwort direkt zu {name}.',
    /** v0.8.5: the visiting owl still has letters for others (their names stay private). */
    guestHintOnward:
      'Rastet gerade bei dir (bis {time}). Sie stellt zuerst ihre übrigen Briefe zu und bringt deine Antwort danach zu {name}.',
    routeHint:
      'PostEulen hat die Empfänger so sortiert, dass die Eule den kürzesten Weg fliegt. Mit ↑ und ↓ kannst du die Reihenfolge trotzdem ändern.',
    addRecipient: 'Weiteren Empfänger hinzufügen',
    choose: 'Kontakt wählen …',
    up: 'Nach oben',
    down: 'Nach unten',
    removeRecipient: 'Entfernen',
    preview: 'Eule wählen',
    chooseOwl: 'Welche Eule soll fliegen?',
    owl: 'Eule: {owl} ({species})',
    owlOption: '{owl} ({species}) – Energie {energy} von {max}, Geschwindigkeit {speed} km/h',
    loanHint:
      'Leiheule: trägt einen Brief an bis zu 5 Empfänger (Gold an einen); zurück kommt sie nur mit einer Antwort.',
    retentionHint:
      'Briefe werden {period} nach der Zustellung beim wöchentlichen Aufräumen (montags früh) automatisch und unwiderruflich gelöscht (Einstellungen).',
    retentionYear: 'ein Jahr',
    retentionDays: '{days} Tage',
    /** v1.3.2: long conversations first show only the latest letters (SPEC 8.4). */
    older: 'Ältere Briefe im Keller suchen',
    olderLoading: 'Die Eulen stöbern im Keller …',
    loanOffers:
      'Gerade ist keine deiner Eulen einsatzbereit, die diesen Brief tragen kann. Du kannst eine Leiheule des Tages nehmen: Sie wird erst beim Abschicken geliehen (0,1 Gold, Eulen, die auch Gold tragen, 0,2 Gold).',
    loanOfferHint: 'Leiheule des Tages: {price}, erst beim Abschicken.',
    /** v0.10: the owl cannot carry the chosen parchment. */
    cannotCarryLong: 'Trägt kein langes Pergament.',
    arrival: 'Ankunft bei {name}: ca. {time}',
    returnsAt: 'Wieder zu Hause: ca. {time}',
    noOwl:
      'Gerade ist keine Eule einsatzbereit, und heute kannst du keine Leiheule mehr leihen (oder dir fehlen 0,1 Gold). Schau in die Menagerie oder warte, bis eine deiner Eulen zurück ist.',
    coverGold: 'Begleitbrief zu {amount}',
    coverOwl: 'Begleitbrief zur Eule {owl}',
    coverChick: 'Begleitbrief zum Küken {owl}',
    send: 'Absenden',
    sent: 'Die Eule ist losgeflogen.',
    tooLong: 'Der Text ist zu lang.',
    empty: 'Bitte schreib etwas.',
    burnAll: 'Alle Briefe verbrennen',
    deleteConfirm:
      'Alle deine Briefe in diesem Chat unwiderruflich verbrennen? Dein Gegenüber behält seine Kopien.',
    burnCaption: 'Die Briefe gehen im Kamin in Flammen auf.',
    burnAlt: 'Briefe brennen im Kamin',
    noReply: 'Auf Systemnachrichten kann man nicht antworten.',
    notContact: 'Ihr seid nicht mehr verbunden. Alte Briefe bleiben lesbar.',
  },
  system: {
    contact_confirmed: '{name} und du seid jetzt verbunden.',
    contact_removed: '{name} hat die Verbindung gekappt.',
    contact_renamed: '{old} heißt jetzt {name}.',
    contact_deleted: 'Das Konto von {name} wurde gelöscht.',
    key_warning: 'Schlüsselwarnung für {name}: Briefe an diesen Kontakt sind gesperrt.',
    letter_returned: 'Ein Brief an {name} wurde nicht zugestellt – die Eule ist umgekehrt.',
    letter_returned_gold: 'Gold an {name} wurde nicht zugestellt – die Eule ist umgekehrt.',
    letter_returned_gift:
      'Das Eulengeschenk an {name} wurde nicht zugestellt – die Eule ist umgekehrt und fliegt zu dir zurück.',
    letter_returned_chick:
      'Das Küken für {name} wurde nicht zugestellt – es ist umgekehrt und fliegt zu dir zurück.',
    password_changed: 'Dein Passwort wurde geändert.',
    letters_purged:
      '{count} Briefe aus folgenden Chats wurden gelöscht, weil sie älter als deine Löschfrist waren: {chats}.',
    letters_purged_one:
      '1 Brief aus folgendem Chat wurde gelöscht, weil er älter als deine Löschfrist war: {chats}.',
    letters_purged_alt: 'Alte Briefe brennen im Kamin',
    owl_home: '{owl} ist wieder zu Hause und sitzt schon auf dem Fensterbrett.',
    owl_home_letter:
      '{owl} ist wieder zu Hause, sitzt schon auf dem Fensterbrett und hat einen Antwortbrief dabei.',
    owl_home_letters:
      '{owl} ist wieder zu Hause, sitzt schon auf dem Fensterbrett und hat {count} Antwortbriefe dabei.',
    loan_back_one:
      'Die Leiheule {owl} hat dir einen Antwortbrief gebracht und fliegt jetzt zurück ins Eulenpostamt.',
    loan_back:
      'Die Leiheule {owl} hat dir {count} Antwortbriefe gebracht und fliegt jetzt zurück ins Eulenpostamt.',
    gold_arrived: '{name} hat dir {amount} geschickt – die Eule ist gelandet.',
    owl_gift_received: '{name} hat dir die Eule {owl} geschenkt. Sie wohnt ab jetzt bei dir.',
    /** v0.8: gifts and deletion of control-centre bots. */
    bot_owl_gift:
      '{name} hat dir eine Eule geschenkt ({species}). Sie wohnt ab jetzt bei dir und wartet in der Eulenübersicht auf ihren Namen.',
    /** v0.8.2 */
    owl_resting:
      '{owl} ({species}), die Eule von {name}, ist zu Besuch und rastet bei dir bis {until}. Unter „Eulen“ kannst du sie pflegen, ihr eine Antwort mitgeben oder sie weiterfliegen lassen.',
    bot_deleted:
      '{name} hat seine Feder für immer niedergelegt und schreibt keine Briefe mehr. Euer Briefwechsel ist mit ihm verschwunden.',
    chick_gift_received: '{name} hat dir das Küken {owl} geschenkt. In 7 Tagen ist es erwachsen.',
    owl_sick:
      '{owl} ist krank geworden und wird jetzt in der Rettungsstation gepflegt. Schau dort vorbei – mit Medizin, Futter, Wasser und Streicheleinheiten ist {owl} bald wieder gesund.',
    owl_healthy: '{owl} ist wieder gesund und darf wieder nach Hause.',
    /** v1.3: a healed wild owl of the rescue centre stays as a post owl. */
    rescue_joined:
      '{owl} möchte sich nicht von dir trennen und bleibt als Posteule bei dir. Du findest {owl} unter „Meine Eulen“.',
    /** v1.3: more than the Earth's circumference flown. */
    owl_globe:
      '🌍 Was für eine Reise! {owl} ist schon {km} km geflogen – weiter als einmal rund um die Erde. Zur Feier trägt {owl} ab heute die Weltkugel hinter dem Namen: {owl} 🌍',
    /** v1.3.2: the distance from the Earth to the Moon and a million kilometres (SPEC 9.2.1). */
    owl_moon:
      '🌙 Wirklich beeindruckend! {owl} ist inzwischen {km} km geflogen – so weit wie von der Erde bis zum Mond. Zur Feier trägt {owl} ab heute statt der Weltkugel den Mond hinter dem Namen: {owl} 🌙',
    owl_crown:
      '👑 Eine Million Kilometer! {owl} ist schon {km} km geflogen. Selbst die alten Eulen im Postamt rücken jetzt auf der Stange ehrfürchtig zur Seite, wenn {owl} landet. Statt des Mondes trägt {owl} ab heute eine Krone hinter dem Namen: {owl} 👑',
    eggs_laid: '{owl} hat Eier gelegt und brütet jetzt 7 Tage.',
    chicks_hatched:
      'Bei {owl} ist ein Küken geschlüpft. Gib ihm in den nächsten 5 Tagen einen Namen – sonst sucht das Los einen aus.',
    chicks_hatched_gift:
      'Bei {owl} sind {count} Küken geschlüpft. Lass dir ruhig Zeit: Gib ihnen Namen und verschenke eines davon innerhalb von 5 Tagen. Erst danach entscheidet das Los.',
    clutch_reminder:
      'Erinnerung: Ein Küken muss bis morgen um diese Zeit verschenkt sein, sonst wird gelost.',
    clutch_lot: 'Das Los hat entschieden: Das Küken {owl} fliegt zu {name}.',
    clutch_kept: 'Du hast keine aktiven Kontakte – alle Küken bleiben bei dir.',
    chick_adult: '{owl} ist erwachsen.',
    loan_expired: 'Die Leiheule {owl} ist nicht losgeflogen und ins Eulenpostamt zurückgekehrt.',
    menagerie_done: '{owl} ist aus der Menagerie zurück. Lohn: {amount}.',
    deletion_warning:
      'Dein Konto wird in 30 Tagen gelöscht, wenn du dich nicht anmeldest. Jede Nutzung der App verhindert das.',
    deletion_cancelled: 'Die Löschung deines Kontos wurde abgebrochen.',
    broadcast: '{text}',
    /** v1.3.1: owl biscuits or treats of a bot (in the pouch). */
    bag_gift_biscuits:
      '{name} hat dir {count} Eulenkekse in den Brief gelegt. Sie liegen jetzt in deinem Beutel – solange welche darin sind, kostet Füttern nichts.',
    bag_gift_biscuits_one:
      '{name} hat dir einen Eulenkeks in den Brief gelegt. Er liegt jetzt in deinem Beutel – einmal Füttern kostet dich nichts.',
    bag_gift_treats:
      '{name} hat dir {count} Leckerlis in den Brief gelegt. Sie liegen jetzt in deinem Beutel und schmecken jeder Eule – solange welche darin sind, kosten Leckerlis nichts.',
    bag_gift_treats_one:
      '{name} hat dir ein Leckerli in den Brief gelegt. Es liegt jetzt in deinem Beutel und schmeckt jeder Eule – einmal Naschen kostet dich nichts.',
    /** v1.3.1: the privilege set by the admin (SPEC 9.1.7). */
    privilege_granted:
      'Der Admin hat dir einen Sonderstatus gegeben: Ab sofort hast du unbegrenzt Gold und darfst so viel Gold und so viele Eulen verschenken, wie du möchtest.',
    privilege_granted_until:
      'Der Admin hat dir bis {until} einen Sonderstatus gegeben: Bis dahin hast du unbegrenzt Gold und darfst so viel Gold und so viele Eulen verschenken, wie du möchtest.',
    privilege_ended:
      'Dein Sonderstatus ist beendet. Ab jetzt gilt wieder dein gewohnter Kontostand, und fürs Verschenken gelten wieder die üblichen Regeln.',
  },
  /** v1.3.1: the pouch with owl biscuits and treats (Postamt, Meine Eulen, Rettungsstation). */
  bag: {
    text: 'In deinem Beutel befinden sich noch {items}.',
    and: ' und ',
    biscuits: '{count} Eulenkekse',
    biscuitsOne: '1 Eulenkeks',
    treats: '{count} Leckerlis',
    treatsOne: '1 Leckerli',
  },
  /** v0.7.2: remaining times – under an hour in minutes; v0.8.5 written out (no "Min.."). */
  duration: {
    minute: '1 Minute',
    minutes: '{n} Minuten',
    hour: '1 Stunde',
    hours: '{n} Stunden',
  },
  /** v0.7.1: a short message to the admin (settings). */
  feedback: {
    title: 'Nachricht an den Admin',
    intro:
      'Klemmt etwas, oder hast du eine Idee, wie PostEulen schöner wird? Schreib dem Admin dieser PostEulen-Instanz eine kurze Nachricht – höchstens 300 Zeichen, eine pro Tag.',
    notEncrypted:
      'Diese Nachricht ist nicht verschlüsselt: Sie liegt lesbar auf dem Server (ohne deinen Namen) und wird nach 90 Tagen gelöscht. Schreib nichts Vertrauliches hinein.',
    label: 'Deine Nachricht',
    counter: '{count} von {max} Zeichen',
    send: 'An den Admin schicken',
    sent: 'Danke! Deine Nachricht ist beim Admin angekommen.',
    blocked: 'Heute hast du schon eine Nachricht geschickt. Die nächste geht ab {time}.',
    empty: 'Bitte schreib etwas.',
    tooLong: 'Die Nachricht ist zu lang (höchstens 300 Zeichen).',
  },
  /** v0.7: greeting on the overview by the time of day at the (fictional) home. */
  greeting: {
    morning: 'Guten Morgen, {name}!',
    day: 'Guten Tag, {name}!',
    evening: 'Guten Abend, {name}!',
    night: 'Hallo {name}, du Nachteule!',
    localTime: 'Bei dir zu Hause ist es gerade {time} Uhr.',
  },
  news: {
    title: 'Neuigkeiten',
    letter_arrived: 'Eine Eule ist mit einem Brief gelandet.',
    gold_arrived: 'Eine Eule hat dir Gold gebracht.',
    owl_gift: 'Dir wurde eine Eule geschenkt.',
    chick_gift: 'Dir wurde ein Küken geschenkt.',
    eggs_laid: 'Eine deiner Eulen hat Eier gelegt.',
    chicks_hatched: 'Küken sind geschlüpft.',
    deletion_warning: 'Dein Konto wird bald wegen Inaktivität gelöscht.',
    broadcast: 'Es gibt eine Nachricht für alle.',
    owl_home: 'Eine deiner Eulen ist wieder zu Hause.',
    owl_home_letters: 'Eine deiner Eulen ist mit Post wieder zu Hause.',
    owl_resting: 'Eine Eule rastet bei dir.',
    letter_resting: 'Eine Eule hat Post gebracht und rastet bei dir.',
    contact_confirmed: 'Ein neuer Kontakt ist jetzt mit dir verbunden.',
    donation: 'Die Eulen haben eine kleine Bitte an dich.',
    owl_sick: 'Eine deiner Eulen ist krank geworden.',
  },
  push: {
    title: 'Benachrichtigungen',
    stateConfirmed: 'aktiv und bestätigt',
    stateUnconfirmed: 'nicht bestätigt',
    stateTesting: 'wird geprüft …',
    stateUnavailable: 'nicht verfügbar',
    stateOff: 'nicht eingerichtet',
    enable: 'Benachrichtigungen einrichten',
    test: 'Test-Benachrichtigung senden',
    testBody: 'Benachrichtigungen sind aktiv.',
    letterBody: 'Eine Eule ist mit einem Brief gelandet.',
    goldBody: 'Eine Eule hat dir Gold gebracht.',
    giftBody: 'Eine Eule ist bei dir eingezogen.',
    chickBody: 'Ein Küken ist bei dir eingezogen.',
    eggsBody: 'Eine deiner Eulen hat Eier gelegt.',
    hatchedBody: 'Küken sind geschlüpft.',
    deletionBody: 'Dein Konto wird bald wegen Inaktivität gelöscht.',
    broadcastBody: 'Es gibt eine Nachricht für alle.',
    homeBody: 'Eine deiner Eulen ist wieder zu Hause.',
    homeLettersBody: 'Eine deiner Eulen ist mit Post wieder zu Hause.',
    restingBody: 'Eine Eule rastet bei dir.',
    /** v1.2.4 */
    letterRestingBody: 'Eine Eule hat Post gebracht und rastet bei dir.',
    contactBody: 'Ein neuer Kontakt ist jetzt mit dir verbunden.',
    donationBody: 'Die Eulen haben eine kleine Bitte an dich.',
    sickBody: 'Eine deiner Eulen ist krank geworden.',
    newsBody: 'Es gibt Neuigkeiten bei PostEulen.',
    headerHint: 'Benachrichtigungen sind noch nicht eingerichtet – so geht’s',
    headerHide: 'Ausblenden bis zur nächsten Anmeldung',
    iosHint:
      'Auf iPhone und iPad gibt es Benachrichtigungen nur, wenn PostEulen über „Zum Home-Bildschirm“ installiert ist.',
    denied:
      'Benachrichtigungen wurden im Browser abgelehnt. Du kannst sie in den Website-Einstellungen wieder erlauben.',
    failedTitle: 'Die Test-Benachrichtigung ist nicht angekommen.',
    intro:
      'Auf Wunsch sagt dir PostEulen Bescheid, wenn eine Eule bei dir landet. Das klappt in der App auf dem Startbildschirm – auf Android mit Chrome und auf dem iPhone mit Safari. Ohne Benachrichtigungen kommt deine Post trotzdem an; du siehst sie, sobald du hineinschaust.',
    failedHint:
      'Versuch es später noch einmal. Klappt es dann immer noch nicht, findest du in der Hilfe ausführliche Tipps – auch für besondere Handys.',
    helpLink: 'Hilfe zu Benachrichtigungen',
    degoogledTitle: 'Android ohne Google-Dienste (LineageOS, GrapheneOS)',
    degoogled1:
      'Chrome, Brave, Vanadium und Cromite liefern Benachrichtigungen nur über Google-Dienste. Ohne diese kommt nichts an – auch beim normalen Firefox nicht.',
    degoogled2:
      'Weg 1: IronFox oder Fennec (F-Droid) plus eine UnifiedPush-App wie Sunup oder ntfy. In IronFox: Einstellungen → IronFox-Einstellungen → Verschiedenes → „Use UnifiedPush“ einschalten und den Browser neu starten. Benachrichtigungen für PostEulen erlauben (IronFox blockiert sie zunächst: Datenschutz und Sicherheit → Website-Einstellungen → Berechtigungen → Benachrichtigungen → „Erlauben erfragen“). Unter GrapheneOS eventuell für IronFox den Exploit-Schutz „Dynamic code loading via storage“ erlauben.',
    degoogled3:
      'Weg 2: GrapheneOS mit „Sandboxed Google Play“ und Chrome (die Play-Dienste brauchen eine Akku-Ausnahme).',
    degoogled4: 'Ohne beides kommen Briefe trotzdem an – du siehst sie beim Öffnen der App.',
  },
  bots: {
    helpHint: 'Lieber selbst nachlesen?',
    helpLink: 'Zur Hilfe',
    label: 'Bot',
    notice:
      'Briefe an Bots sind nicht Ende-zu-Ende-verschlüsselt. Sie liegen lesbar auf dem Server und werden zum Beantworten an OpenAI übermittelt.',
    crisis:
      'Geht es dir nicht gut? Hilfe gibt es sofort und anonym: TelefonSeelsorge Deutschland 0800 111 0 111, Österreich 142, Schweiz 143. Im Notfall: 112.',
    writableFrom: 'Diesem Bot kannst du wieder ab {time} schreiben (ein Brief pro Kalendertag).',
    type_explainer: 'erklärt dir PostEulen',
    /** v0.8: bots of the control centre. */
    type_central: 'Brieffigur',
    botOwlOnly:
      'Diesem Bot kannst du nur antworten, solange seine Eule bei dir rastet (unter „Eulen“: „Antwort … mitgeben“).',
    pictureAlt: 'Bild {n} zum Brief von {name}',
    /** v0.8.5: pictures open full screen. */
    pictureOpen: 'Bild vergrößern',
    pictureClose: 'Tippen, klicken oder Escape schließt das Bild.',
    title: 'Bots',
    remove: '{name} entfernen',
    removeAllTitle: 'Bots',
    removeAllIntro:
      'Der Erklärbär und andere Brieffiguren antworten per KI. Brauchst du sie nicht, kannst du alle auf einmal entfernen – dann schreiben dir auch künftige Bots nie. Einzelne entfernst du in ihrem Chat.',
    removeAll: 'Alle Bots entfernen',
    removeAllConfirm:
      'Wirklich alle Bots entfernen, auch den Erklärbären und alle künftigen Bots? Das ist endgültig: Ihre Chats, ihr Gedächtnis und noch geplante Briefe und Geschenke verschwinden, und kein Bot schreibt dir je wieder.',
    removedAll: 'Alle Bots sind entfernt.',
    noneLeft: 'Du hast keine Bots mehr.',
    removeConfirm:
      '{name} wirklich entfernen? Das ist endgültig: Chat, Gedächtnis und noch geplante Briefe und Goldsendungen verschwinden.',
  },
  owls: {
    none: 'Du hast noch keine Eulen. In der Menagerie kannst du eine kaufen.',
    toMenagerie: 'Zur Menagerie',
    unnamed: 'Neue Eule',
    female: 'weiblich',
    /** v1.2.4: kilometres an own owl has flown in all (line below its name). */
    kmFlown: '{km} km',
    male: 'männlich',
    energy: 'Energie {energy} von {max}',
    motivation: 'Motivation {value} %',
    speed: 'Geschwindigkeit {speed} km/h',
    recovery: 'Erholung {recovery} %/h',
    motivationHint:
      'Motivation (80 % bis 120 %) sinkt jede Nacht um 10 Prozentpunkte. Wasser, Streicheln, Eulenkeks und Lieblingsleckerli heben sie jeweils einmal am Tag um 10 Prozentpunkte. Sie zählt für die nächste Strecke – beim Abflug von zu Hause und neu bei jedem Weiterflug von einem Empfänger: Energie, Geschwindigkeit und Erholung unterwegs verändern sich um den angezeigten Anteil. Zwei verschiedene Pflege-Aktionen an einem Tag schützen außerdem vor Krankheit.',
    stateHome: 'zu Hause',
    stateFlying: 'unterwegs',
    flyingLetter: 'Fliegt gerade einen Brief zu {names}.',
    flyingGold: 'Bringt gerade Gold zu {names}.',
    flyingHome: 'Fliegt nach Hause.',
    flyingGift: 'Fliegt als Geschenk zu {names}.',
    sleepingTo: 'Schläft auf dem Weg zu {names}.',
    sleepingHome: 'Schläft auf dem Heimweg.',
    /** v1.3: a sick owl is nursed in the rescue centre (SPEC 8.13). */
    stateRescue: 'Krank – wird in der Rettungsstation gepflegt (Genesung {progress} %).',
    toRescue: 'Zur Rettungsstation',
    perchRescueAlt: 'Leere Stange – {name} wird gerade in der Rettungsstation gepflegt',
    /** v1.3: the rule on gifts, as the players learn it (SPEC 9.1.5). */
    giftRule: 'Nur aktive Spieler können alle zwei Wochen Gold oder eine Eule verschenken.',
    stateBrooding: 'Brütet bis {until}.',
    stateMenagerie: 'In der Menagerie bis {until}.',
    loanUntil: 'Leiheule – muss bis {until} losfliegen.',
    chick: 'Küken – erwachsen ab {until}.',
    menagerie: 'An die Menagerie verleihen (7 Tage)',
    menagerieConfirm: '{name} für 7 Tage an die Menagerie verleihen? Danach gibt es {amount}.',
    chickNameTitle: 'Wie soll dein Küken heißen?',
    clutchTitle: 'Ein Küken verschenken',
    clutchIntro:
      'Bei zwei oder drei Küken musst du eines an einen Kontakt verschenken. Entscheidest du dich nicht bis {until}, wird gelost (dann ohne Begleitbrief). Küken fliegen langsam: 10 km/h, nach jeder Flugstunde eine Stunde Pause.',
    clutchChick: 'Welches Küken?',
    clutchNameFirst: 'Bitte gib dem Küken zuerst einen Namen.',
    /** v1.1: with the times of the journey, as on the map. */
    nextStop: 'Nächster Halt: {name} um ca. {time}.',
    backAt: 'Voraussichtlich zurück in {duration} (ca. {time}).',
    and: ' und ',
    pet: 'Streicheln',
    water: 'Wasser geben',
    /**
     * v1.3.1: a care button already used today keeps its text, crossed out and greyed; the
     * reason is only read out (`doneAria`).
     */
    wateredToday: 'heute schon getrunken',
    feed: 'Eulenkeks ({price})',
    fedToday: 'satt, heute schon gefüttert',
    snack: '{snack} geben ({price})',
    snackedToday: 'satt, heute schon genascht',
    doneAria: '{action} – {why}',
    /** v1.3.1: instead of the price – from the pouch, or free (bot owls, privileged players). */
    fromBag: 'aus dem Beutel',
    free: 'kostenlos',
    /** v0.10: send gold with this owl (only owls that carry gold). */
    sendGold: 'Gold verschicken',
    /** v0.10: carrying capacity of the species (purchase, loan offers, owl cards). */
    cargo_short: 'Trägt kurzes Pergament',
    cargo_long: 'Trägt kurzes und langes Pergament',
    cargo_gold: 'Trägt kurzes und langes Pergament sowie Gold',
    rename: 'Umbenennen',
    renameBlocked: 'Umbenennen erst wieder im nächsten Kalenderjahr.',
    gift: 'Verschenken',
    release: 'In die Freiheit entlassen',
    releaseTitle: '{name} in die Freiheit entlassen',
    releaseIntro:
      'Eine freigelassene Eule kommt nie wieder zurück – sie ist danach unwiderruflich fort, samt Namen und Energie.',
    releaseNameLabel: 'Tippe zur Bestätigung den Namen der Eule ein: {name}',
    releaseNext: 'Weiter',
    releaseSure:
      'Bist du ganz sicher? {name} fliegt für immer davon. Das lässt sich nicht rückgängig machen.',
    releaseFinal: 'Ja, {name} endgültig freilassen',
    releaseDone: '{name} ist in die Freiheit geflogen.',
    /** v1.2.1: owls ready for post on top (by energy), then the others (by return). */
    readyGroup: 'Bereit für Post',
    busyGroup: 'Unterwegs und beschäftigt',
    /** v1.2.1: behind the name of a loan owl in the owl overview. */
    loanMark: '(Leiheule)',
    guestGroup: 'Zu Gast bei dir',
    guestBanner: 'Nur zur Rast hier!',
    guestUntil: 'Fliegt spätestens {time} weiter.',
    guestOf: 'Eule von {name}',
    guestLoanOf: 'Leiheule von {name}',
    guestHint:
      'Du kannst sie pflegen, damit sie gestärkt weiterfliegt, und ihr eine Antwort an {name} mitgeben – dann fliegt sie sofort los.',
    /** v0.8.5: the owl still has letters for others (their names stay private). */
    guestHintOnward:
      'Du kannst sie pflegen, damit sie gestärkt weiterfliegt, und ihr eine Antwort an {name} mitgeben. Dann fliegt sie sofort weiter: Zuerst stellt sie ihre übrigen Briefe zu, danach bringt sie deine Antwort zu {name}.',
    guestReply: 'Antwort an {name} mitgeben',
    /** v0.8.2 */
    guestSendOn: 'Weiterfliegen lassen',
    guestSendOnConfirm: '{name} jetzt ohne Antwort weiterfliegen lassen?',
    restingAt: 'Rastet bei {name} bis {until}.',
    flyingDayAlt: '{name} im Flug bei Tag',
    flyingNightAlt: '{name} im Flug bei Nacht',
    sleepDayAlt: '{name} schläft unterwegs bei Tag',
    sleepNightAlt: '{name} macht unterwegs eine Nachtpause',
    napAlt: '{name} hält zu Hause ein Nickerchen',
    /** v0.10: an owl at home with a motivation of 80 %. */
    grumpyAlt: '{name} schaut grummelig drein – die Motivation ist ganz unten',
    broodingAlt: '{name} brütet im Nest auf ihren Eiern',
    perchAlt: 'Leere Stange – {name} hilft gerade in der Menagerie aus',
    /** v0.8.5 */
    perchRestingAlt: 'Leere Stange – {name} rastet gerade bei {host}',
    write: 'Brief schreiben',
    writeTitle: 'Brief mit {name} schicken',
    writeIntro:
      'An wen soll der Brief gehen? Wähle bis zu 5 Kontakte – oder einen Bot, der bekommt seine Briefe nur einzeln. Danach öffnet sich der Briefwechsel mit dieser Eule.',
    writeContacts: 'Kontakte',
    writeBots: 'Bots',
    writeGo: 'Weiter zum Brief',
    writeNobody:
      'Gerade kannst du niemandem schreiben. Füge im Adressbuch einen Kontakt hinzu – ihr müsst euch beide eintragen.',
    homeDayAlt: '{name} sitzt bei Tag auf dem Fensterbrett',
    homeNightAlt: '{name} sitzt bei Nacht im Kerzenschein auf dem Fensterbrett',
    nameTitle: 'Wie soll dein Neuzugang heißen? ({species})',
    renameTitle: 'Neuer Name für {name}',
    nameLabel: 'Name (2–20 Zeichen)',
    nameSex: 'Geschlecht: {sex}',
    nameHint:
      'Die erste Benennung ist frei, danach kann eine Eule einmal pro Kalenderjahr umbenannt werden.',
    save: 'Speichern',
    cancel: 'Abbrechen',
    giftTitle: '{name} verschenken',
    giftIntro:
      'Die Eule fliegt selbst zu deinem Kontakt und gehört ihm ab der Ankunft. Geschenke können nicht abgelehnt werden.',
    giftTo: 'An',
    withCover: 'Begleitbrief mitgeben (kurzes Pergament, kostenlos)',
    coverText: 'Begleitbrief',
    giftArrival: 'Ankunft bei {name}: ca. {time}',
    giftSend: 'Verschenken',
    giftSent: '{name} fliegt jetzt zu {recipient}.',
    overlayClose: 'Bild schließen',
    departs: '{name} fliegt los',
    arrives: '{name} ist gelandet',
    /** v1.1: landing with a letter, shown at the first opportunity. */
    arrivesFrom: '{name} ist gelandet und bringt dir Post von {from}.',
    backHome: '{name} ist wieder zu Hause',
    backHomeLetter: '{name} ist wieder zu Hause – mit einem Antwortbrief',
    backHomeLetters: '{name} ist wieder zu Hause – mit {count} Antwortbriefen',
    feeding: '{name} lässt es sich schmecken',
    drinking: '{name} trinkt einen Schluck',
    snacking: '{name} genießt {snack}',
    petting: '{name} genießt das Streicheln',
    imageAlt: '{species}: {what}',
  },
  /** v1.3: the owl rescue centre (SPEC 8.13; texts of the client, lightly edited). */
  rescue: {
    intro:
      'Herzlich willkommen in der Eulenrettungsstation. Hier kannst du dabei helfen, kranke und verletzte Eulen gesund zu pflegen.',
    enter: 'Eintreten',
    inside:
      'Unsere kranken und verletzten Eulen freuen sich, wenn sich jemand um sie kümmert, bis es ihnen wieder besser geht. Medizin verabreichen, Streicheln, Füttern und Wasser geben hilft ihnen dabei, schneller wieder gesund zu werden. Während einige Eulen anschließend dankbar in die Freiheit zurückflattern, kommt es manchmal auch vor, dass sie sich dafür entscheiden, als Posteule bei den Menschen zu bleiben, die sie gepflegt haben. Wer weiß? Vielleicht ist dies der Beginn einer wunderbaren Freundschaft.',
    insideOwn:
      'Wenn du deine eigene kranke Eule hier pflegst, kommt sie anschließend selbstverständlich wieder mit dir nach Hause.',
    rules:
      'Jede Hilfe zählt einmal am Tag: Wasser, Streicheln, Medizin, Füttern und Leckerli. Gestreichelt werden möchten die Eulen so oft du magst. Wasser, Streicheln und Medizin kosten nichts.',
    ownTitle: 'Deine Eulen in Pflege',
    wildTitle: 'Kranke Eulen',
    progress: 'Wieder gesund: {progress} %',
    medicine: 'Medizin geben',
    feed: 'Füttern (Eulenkeks, {price})',
    snack: '{snack} geben ({price})',
    pet: 'Streicheln',
    water: 'Wasser geben',
    doneToday: 'heute schon erledigt',
    medicineCaption: '{name} bekommt Medizin.',
    healed: '{name} ist wieder gesund. Danke, dass du dich um {name} gekümmert hast.',
    goHome: '{name} darf wieder nach Hause.',
    findOut: 'Herausfinden, wohin {name} fliegt',
    freedom: '{name} macht sich dankbar auf den Weg zurück in die Freiheit.',
    stays: '{name} möchte sich nicht von dir trennen, sondern sich dir als Posteule anschließen.',
    healedHint: '{name} ist wieder gesund!',
    sickAlt: '{name} ist krank und wird gepflegt, {species}',
    pictureDay:
      'Die Eulenrettungsstation hinter einem Holztor, mit Volieren, Bach und Wasserfall, bei Tag',
    pictureNight:
      'Die Eulenrettungsstation hinter einem Holztor, mit Volieren und Laternen, bei Nacht',
    insideDay: 'In der Eulenrettungsstation bei Tag: Pflegeplätze für kranke Eulen',
    insideNight:
      'In der Eulenrettungsstation bei Nacht: Pflegeplätze für kranke Eulen im Lampenlicht',
  },
  menagerie: {
    intro:
      'Die Menagerie: Hier kannst du Eulen kaufen und eigene Eulen verleihen. Leiheulen gibt es im Eulenpostamt.',
    /** v0.10: picture of the place, by day or by night at the player's home. */
    pictureDay: 'Die Menagerie in einem alten Gemäuer, bei Tag',
    pictureNight: 'Die Menagerie in einem alten Gemäuer, bei Nacht',
    /** v1.1 */
    pictureChristmasDay: 'Die verschneite Menagerie mit Weihnachtsschmuck, bei Tag',
    pictureChristmasNight:
      'Die verschneite Menagerie mit Weihnachtsschmuck und Lichtern, bei Nacht',
    /** v1.2.1: the entrance leads inside, where the owls for sale are. */
    enter: 'Menagerie betreten',
    insideDay:
      'In der Menagerie bei Tag: Eulen in Mauernischen, auf Ästen und an einer Wendeltreppe, eine Pflegerin fegt neben der Ladentheke mit Kasse und dem Buch „Eulenpflege A–Z“',
    insideNight:
      'In der Menagerie bei Nacht: Eulen in Mauernischen, auf Ästen und an einer Wendeltreppe im Laternenlicht, eine Pflegerin fegt neben der Ladentheke',
    insideChristmasDay:
      'In der weihnachtlich geschmückten Menagerie bei Tag: Eulen zwischen Tannengrün, Kränzen und einem Christbaum, eine Pflegerin fegt neben der Ladentheke',
    insideChristmasNight:
      'In der weihnachtlich geschmückten Menagerie bei Nacht: Eulen im Lichterglanz zwischen Tannengrün, Kränzen und einem Christbaum, eine Pflegerin fegt neben der Ladentheke',
    buyTitle: 'Eulen kaufen',
    price: 'Preis: {price}',
    stats: 'Energie {energy} · Geschwindigkeit {speed} km/h · Erholung {recovery} %/h',
    mythical:
      'Ein Phönix wird nie verliehen, legt keine Eier und hilft nicht in der Menagerie aus.',
    buy: '{species} kaufen',
    buyConfirm: '{species} wirklich für {price} kaufen?',
    limit: 'Du hast schon 50 eigene Eulen – mehr gehen nicht.',
  },
  /** v0.10: the post office – loan owls (before in the Menagerie) and the borrowed ones. */
  post: {
    intro:
      'Das Eulenpostamt: Hier leihst du Eulen für einen Brief oder für Gold – jeden Tag andere. Deine geliehenen Eulen kannst du auch gleich hier versorgen und losschicken.',
    pictureDay: 'Das Eulenpostamt bei Tag',
    pictureNight: 'Das Eulenpostamt bei Nacht',
    /** v1.1 */
    pictureChristmasDay: 'Das verschneite Eulenpostamt mit Weihnachtsschmuck, bei Tag',
    pictureChristmasNight:
      'Das verschneite Eulenpostamt mit Weihnachtsschmuck und Lichtern, bei Nacht',
    /** v1.2: the entrance leads inside, where the loan owls of the day are. */
    enter: 'Eulenpostamt betreten',
    insideDay:
      'Im Eulenpostamt bei Tag: die Leiheulen von heute zwischen Schalter, Regalen und Paketen',
    insideNight:
      'Im Eulenpostamt bei Nacht: die Leiheulen von heute im Laternenlicht zwischen Schalter, Regalen und Paketen',
    insideChristmasDay:
      'Im weihnachtlich geschmückten Eulenpostamt bei Tag: die Leiheulen von heute zwischen Schalter, Regalen und Geschenken',
    insideChristmasNight:
      'Im weihnachtlich geschmückten Eulenpostamt bei Nacht: die Leiheulen von heute im Lichterglanz zwischen Schalter, Regalen und Geschenken',
    loanTitle: 'Eulen leihen',
    /** v1.2.4: followed by who is ready to travel right now (loanReady in texts/species.ts). */
    loanWelcome: 'Herzlich willkommen! Möchtest du eine Eule leihen?',
    loanIntro:
      'Eine Leiheule trägt einen Brief an bis zu 5 Empfänger nacheinander (Gold an einen) und verschwindet nach dem letzten. Gibt ihr unterwegs jemand eine Antwort mit, schaut sie sogar noch einmal bei dir vorbei – vorausgesetzt natürlich, du warst lieb zu ihr. Du musst sie innerhalb von 24 Stunden losschicken, sonst fliegt sie zurück (ohne Erstattung). Ist eine Leihe vorbei, verschwindet ihr Angebot bis morgen.',
    loanCount: 'Heute geliehen: {count} von {max}. Morgen gibt es neue Eulen zum Leihen.',
    loanPrice: 'Leihgebühr: {price}',
    loan: '{name} leihen ({species}, {sex})',
    loaned: 'Schon geliehen',
    /** v0.8.5: every offer of the day has been borrowed and its loan is over. */
    allDone: 'Alle Leiheulen von heute sind wieder zurück. Morgen gibt es neue.',
    loanDone: '{name} wartet jetzt hier und bei deinen Eulen.',
    borrowedTitle: 'Deine Leiheulen',
  },
  finance: {
    /** v0.10: in the settings (the overview „Finanzen“ is gone). */
    title: 'Gold und Buchungen',
    balance: 'Dein Gold: {amount}',
    /** v1.3.1: privileged players (SPEC 9.1.7). */
    endless: 'unbegrenzt',
    privileged:
      'Sonderstatus: Du hast unbegrenzt Gold und darfst Gold und Eulen ohne die üblichen Grenzen verschenken. Dein gewohnter Kontostand ({amount}) bleibt solange unberührt.',
    privilegedUntil:
      'Sonderstatus bis {until}: Bis dahin hast du unbegrenzt Gold und darfst Gold und Eulen ohne die üblichen Grenzen verschenken. Dein gewohnter Kontostand ({amount}) bleibt solange unberührt.',
    daily: 'Jeden Tag um {time} Uhr bekommst du {amount}, solange du aktiv bist.',
    dailyRule:
      'In den ersten 30 Tagen nach der Kontoerstellung gibt es 3,0 Gold am Tag, danach 2,0 Gold.',
    transactions: 'Letzte Buchungen',
    none: 'Noch keine Buchungen.',
    date: 'Datum',
    kind: 'Art',
    amount: 'Betrag',
    counterpart: 'Gegenüber',
    type_daily: 'Tägliches Gold',
    type_owl_purchase: 'Eulenkauf',
    type_feed: 'Futter',
    type_snack: 'Lieblingsleckerli',
    type_large_parchment: 'Langes Pergament',
    type_transfer_out: 'Überweisung',
    type_transfer_in: 'Überweisung erhalten',
    type_transfer_refund: 'Rückbuchung (Eule umgekehrt)',
    type_loan: 'Leiheule',
    type_treatment: 'Behandlung',
    type_menagerie_wage: 'Lohn der Menagerie',
    type_bot_gift: 'Geschenk von {name}',
    type_voucher: 'Gutschein eingelöst',
    sendTitle: '{owl} bringt Gold',
    /** v0.10: the arrival of exactly this owl before sending. */
    check: 'Ankunft berechnen',
    sendHint: '0,1 bis 20,0 Gold; danach müssen dir mehr als 10,0 Gold bleiben.',
    notPossible: 'Überweisen geht erst, wenn du mehr als 10,1 Gold hast.',
    maxNow: 'Gerade möglich: bis {amount}',
    recipient: 'An',
    amountLabel: 'Betrag in Gold (z. B. 1,5)',
    amountInvalid: 'Bitte einen Betrag wie 1,5 eingeben (eine Nachkommastelle).',
    send: 'Gold losschicken',
    sent: '{owl} bringt {amount} zu {name}. Ankunft ca. {time}.',
  },
  map: {
    title: 'Karte',
    legendHome: 'Dein Wohnort',
    legendContact: 'Kontakte',
    legendBot: 'Bots',
    legendOwl: 'Reisende Eulen',
    legendNight: 'Nacht',
    flightsTitle: 'Deine Eulen unterwegs',
    flightsNone: 'Gerade ist keine deiner Eulen unterwegs.',
    flightLine: '{owl}: {purpose} – {where}',
    purposeLetter: 'Brief',
    purposeGold: 'Gold',
    purposeGift: 'Geschenk',
    nextStop: 'nächster Halt {name} ca. {time}',
    /** v0.8.5 */
    restingAt: 'rastet bei {name} bis {time}',
    homeAt: 'zurück ca. {time}',
    sleeping: 'schläft gerade',
    updated: 'Stand {time} – wird alle {minutes} Minuten neu berechnet.',
    loading: 'Karte wird geladen …',
    label: 'Karte von Westeuropa',
    worldLabel: 'Weltkarte',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    reset: 'Ansicht zurücksetzen',
  },
  nav: {
    main: 'Hauptnavigation',
    letters: 'Briefwechsel',
    owls: 'Eulen',
    /** v1.3: tile and heading of the owl overview (the bottom bar keeps „Eulen“). */
    myOwls: 'Meine Eulen',
    /** v1.3: the row with the language flag and the help above the public pages. */
    tools: 'Sprache und Hilfe',
    /** v1.3: the owl rescue centre (SPEC 8.13). */
    rescue: 'Rettungsstation',
    post: 'Postamt',
    menagerie: 'Menagerie',
    addressBook: 'Adressbuch',
    map: 'Karte',
    settings: 'Einstellungen',
    help: 'Hilfe',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    donate: 'Spenden',
    donateLink: '(öffnet ko-fi.com in einem neuen Tab)',
    /** v0.9: footer link to the onion address (only once Tor is set up). */
    tor: 'Tor-Netz',
    torLink: '(PostEulen als Onion-Dienst – öffnet sich im Tor Browser)',
    home: 'Übersicht',
  },
  header: {
    gold: 'Gold',
    goldAmount: '{amount} Gold',
  },
  /** v1.3: statistics in the settings (SPEC 8.10). */
  stats: {
    title: 'Statistik',
    lettersSent: 'Verschickte Briefe',
    lettersReceived: 'Erhaltene Briefe',
    days: 'Tage seit Kontoerstellung',
    activeDays: 'Aktive Tage',
    activeValue: '{count} ({percent} %)',
    km: 'Geflogene Kilometer zwischen Menschen',
    kmValue: '{km} km',
    count: '{count}',
    interactionsTitle: 'Zuwendung für Eulen',
    water: 'Wasser gegeben',
    pet: 'Gestreichelt',
    feed: 'Eulenkekse',
    snack: 'Lieblingsleckerli',
    medicine: 'Medizin gegeben',
    countedSince:
      'Einige Werte werden erst seit dem {date} gezählt; ältere sind nur enthalten, soweit sie noch gespeichert waren.',
  },
  units: {
    // v1.3: thousands grouped ("1.234,5 Gold", SPEC 8.12).
    gold: (tenths: number): string => `${formatGold(tenths, ',')} Gold`,
  },
  pages: {
    helpTitle: 'Hilfe',
    privacyTitle: 'Datenschutz',
    imprintTitle: 'Impressum',
    contents: 'Inhalt',
    faqTitle: 'Häufige Fragen',
    toTop: 'Nach oben',
    notFound: 'Diese Seite gibt es nicht. Vielleicht hat eine Eule die Adresse verlegt.',
  },
  /** v0.8.2: timed banners of the admin. */
  banner: {
    hide: 'Hinweis ausblenden',
  },
  admin: {
    title: 'PostEulen – Verwaltung',
    /** v1.2.1: the server dashboard at the top of the panel (SPEC 13 item 13). */
    serverTitle: 'Server-Auslastung',
    serverIntro:
      'Grobe Werte des Servers: Prozessor (alle Kerne zusammen) und Arbeitsspeicher im Durchschnitt der letzten 7 Tage, dazu die Belegung der Festplatte mit den Spieldaten. Je voller der Ring, desto höher die Auslastung – von Grün bis Rot.',
    serverCpu: 'Prozessor',
    serverRam: 'Arbeits\u00ADspeicher',
    serverDisk: 'Festplatte',
    serverAverage: 'Ø 7 Tage',
    serverNow: 'jetzt',
    serverNone: 'noch keine Messwerte',
    serverMeasured: 'Letzte Messung: {time}.',
    serverSince: 'Gemessen wird erst seit {since}, der Durchschnitt umfasst nur diese Zeit.',
    serverMissing:
      'Für Prozessor und Arbeitsspeicher liegen noch keine Messwerte vor. Der Zeitgeber posteulen-stats misst alle 10 Minuten; den Prozessor zeigt der Ring ab der zweiten Messung.',
    /** v0.8.3: all times of the panels in the time zone of the device. */
    timeZoneNote: 'Alle Uhrzeiten in der Zeitzone dieses Geräts ({zone}).',
    loginHeading: 'Anmeldung für die Verwaltung',
    password: 'Passwort',
    login: 'Anmelden',
    wrong: 'Das Passwort stimmt nicht.',
    sessionExpired:
      'Nach 10 Minuten ohne Aktivität wurdest du abgemeldet. Bitte melde dich neu an.',
    logout: 'Abmelden',
    changeTitle: 'Erstpasswort ändern',
    changeIntro:
      'Bitte vergib jetzt ein eigenes Passwort (mindestens 15 Zeichen). Vorher ist nichts anderes möglich.',
    passwordTitle: 'Adminpasswort ändern',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    newPasswordRepeat: 'Neues Passwort wiederholen',
    save: 'Speichern',
    changed: 'Das Adminpasswort wurde geändert.',
    registrationTitle: 'Registrierung',
    modeClosed: 'geschlossen',
    modeInvite: 'nur mit Einladungscode',
    modeOpen: 'offen für alle',
    modeSaved: 'Gespeichert.',
    invitesTitle: 'Einladungscodes',
    invitesIntro: 'Einmal verwendbar, 48 Stunden gültig. Der Code wird nur jetzt angezeigt.',
    inviteCreate: 'Neuen Code erzeugen',
    inviteNew: 'Neuer Code: {code} (gültig bis {until})',
    inviteHint: 'Code …{hint}, gültig bis {until}',
    inviteRevoke: 'Widerrufen',
    invitesNone: 'Keine offenen Codes.',
    vouchersTitle: 'Gutscheine',
    vouchersIntro:
      'Ein Gutschein über Gold, eine Eule, Eulenkekse oder Leckerlis, einmal einlösbar (in den Einstellungen der App), 90 Tage gültig. Kekse und Leckerlis kommen in den Beutel des Spielers. Der Code wird nur jetzt angezeigt; wer ihn einlöst, bleibt unbekannt.',
    voucherKind: 'Art des Gutscheins',
    voucherGold: 'Gold',
    voucherOwl: 'Eule',
    /** v1.3.1 */
    voucherBiscuits: 'Eulenkekse',
    voucherTreats: 'Leckerlis',
    voucherCount: 'Anzahl (1 bis 50)',
    voucherCountRange: 'Bitte eine Anzahl von 1 bis 50 angeben.',
    voucherBiscuitsWhat: '{count} Eulenkekse',
    voucherTreatsWhat: '{count} Leckerlis',
    voucherAmount: 'Betrag in Gold (0,1 bis 100)',
    voucherGoldRange: 'Bitte einen Betrag von 0,1 bis 100 Gold angeben.',
    voucherSpecies: 'Art der Eule',
    voucherRandom: 'zufällige Art (ohne Phönix)',
    voucherCreate: 'Gutschein erzeugen',
    voucherNew: 'Neuer Gutschein: {code} (gültig bis {until})',
    voucherHint: 'Gutschein …{hint}: {what}, gültig bis {until}',
    voucherHintRedeemed: 'Gutschein …{hint}: {what} – eingelöst',
    vouchersNone: 'Keine Gutscheine.',
    /** v1.3.1: privileged players (SPEC 9.1.7, 13). */
    privilegedTitle: 'Sonderstatus für Spieler',
    privilegedIntro:
      'Spieler mit Sonderstatus haben unbegrenzt Gold und dürfen Gold und Eulen ohne die üblichen Grenzen verschenken (keine Zwei-Wochen-Regel, kein Mindestrest, mehr als 50 Eulen). Ihr gewohnter Kontostand bleibt unberührt und gilt nach dem Ende wieder. Der Spieler bekommt beim Erteilen und beim Ende eine Systemnachricht.',
    privilegedName: 'Nutzername',
    privilegedDuration: 'Dauer',
    privilegedForever: 'Dauerhaft',
    privilegedUntilOption: 'Befristet bis',
    privilegedUntil: 'Ende (Datum und Uhrzeit)',
    privilegedGrant: 'Sonderstatus erteilen',
    privilegedGranted: '{name} hat jetzt den Sonderstatus.',
    privilegedEntry: '{name} – seit {since}, {until}',
    privilegedEntryForever: 'dauerhaft',
    privilegedEntryUntil: 'bis {until}',
    privilegedRevoke: 'Widerrufen',
    privilegedRevokeConfirm: 'Sonderstatus von {name} jetzt widerrufen?',
    privilegedNone: 'Niemand hat gerade den Sonderstatus.',
    privilegedPast: 'Bitte ein Ende in der Zukunft wählen.',
    feedbackTitle: 'Nachrichten der Nutzer',
    feedbackIntro:
      'Kurze Nachrichten aus den Einstellungen der App (höchstens 300 Zeichen, eine pro Konto und Tag), ohne Absender. Sie werden nach 90 Tagen automatisch gelöscht.',
    feedbackNone: 'Keine Nachrichten.',
    feedbackDelete: 'Löschen',
    statsTitle: 'Statistik',
    statsCreated: 'Konten insgesamt erstellt: {count}',
    statsCurrent: 'Konten vorhanden: {count}',
    /** v1.1 */
    statsOnion: 'davon über die Onion-Adresse erstellt: {count} (gezählt seit Version 1.1.0)',
    statsActive: 'In den letzten 30 Tagen aktiv: {count}',
    statsLetters: 'Briefe zwischen Menschen: {total} insgesamt, {last7} in den letzten 7 Tagen',
    statsOwlsTitle: 'Eulen im Besitz der Spieler',
    statsOwlsIntro: 'Aktueller Bestand je Art – ohne Leiheulen und ohne Eulen der Bots.',
    statsOwlsSpecies: 'Art',
    statsOwlsCount: 'Eulen',
    statsOwlsChicks: 'davon Küken',
    statsOwlsTotal: 'Zusammen',
    torTitle: 'Tor-Netz (Onion-Dienst)',
    torIntro:
      'PostEulen ist parallel als Onion-Dienst im Tor-Netz erreichbar – dieselbe App mit denselben Konten, Briefen und Spielständen. Die Adresse ändert sich nie; ihre Schlüssel sind Teil jeder Sicherung. Über Tor sieht der Server keine IP-Adressen: Jede Anmeldung braucht dort die Rechenaufgabe, teure Aktionen zählen je Konto, und bei der Registrierung zählen alle Tor-Besucher zusammen wie eine einzige IP-Adresse.',
    torAddress: 'Onion-Adresse',
    torNoAddress: 'noch keine',
    torState: 'Zustand',
    torStateOk: 'läuft',
    torStateOff: 'abgeschaltet',
    torStateError: 'Fehler – Einzelheiten im Fehlerprotokoll',
    torStatePending: 'wird eingerichtet',
    torNotSetUp:
      'nicht eingerichtet – das Installations- bzw. Update-Skript richtet Tor ein („sudo posteulen-update“)',
    torStateSince: 'seit {time}',
    torSwitch: 'Zugang über das Tor-Netz eingeschaltet',
    torSwitchHint:
      'Abschalten stoppt den Tor-Dienst auf dem Server innerhalb weniger Sekunden, und der Link „Tor-Netz“ auf der Startseite verschwindet. Die normale Seite läuft weiter. Einschalten stellt alles mit derselben Adresse wieder her.',
    torOffConfirm:
      'Den Zugang über das Tor-Netz wirklich abschalten? Wer gerade über Tor angemeldet ist, kommt erst nach dem Einschalten wieder hinein.',
    torSavedOn: 'Tor wird eingeschaltet – das dauert auf dem Server einige Sekunden.',
    torSavedOff: 'Tor wird abgeschaltet.',
    inactivityTitle: 'Löschfrist bei Inaktivität',
    inactivityIntro:
      'Konten ohne Nutzung werden nach dieser Zahl von Tagen gelöscht (mindestens 60). 30 Tage vorher kommt eine Warnung; eine Verkürzung löscht niemanden ohne diese Warnung.',
    inactivityDays: 'Tage',
    inactivitySave: 'Speichern',
    broadcastTitle: 'Rundnachricht an alle',
    broadcastIntro:
      'Erscheint im Systemchat aller Konten, mit Benachrichtigung. Höchstens 3.000 Zeichen. Der Verlauf hier behält jede Rundnachricht 180 Tage.',
    broadcastText: 'Text',
    broadcastSend: 'An alle senden',
    broadcastConfirm: 'Diese Nachricht wirklich an alle Konten senden?',
    broadcastSent: 'Gesendet an {count} Konten.',
    broadcastsNone: 'Noch keine Rundnachrichten.',
    openaiTitle: 'OpenAI (Bots)',
    openaiIntro:
      'Der Key wird verschlüsselt gespeichert und nie wieder angezeigt. Bot-Briefe werden ohne Namen und Kennungen an OpenAI geschickt, mit „store: false“.',
    openaiKeySince: 'Key hinterlegt seit {date}.',
    openaiNoKey: 'Kein Key hinterlegt – Bots können nicht antworten.',
    openaiKey: 'Neuer API-Key',
    openaiSaveKey: 'Key speichern',
    openaiDeleteKey: 'Key löschen',
    openaiDeleteConfirm: 'Den OpenAI-Key wirklich löschen? Bots antworten dann nicht mehr.',
    openaiModel: 'Modell',
    openaiLoadModels: 'Modelle von OpenAI laden',
    openaiLimit: 'Tageslimit für KI-Aufrufe',
    openaiUsed: 'Heute verbraucht: {used} von {limit}',
    openaiSave: 'Einstellungen speichern',
    openaiTest: 'Verbindung testen',
    openaiTestOk: 'Verbindung in Ordnung.',
    errorsTitle: 'Fehlerprotokoll',
    errorsNone: 'Keine Einträge.',
    errorCause: 'Ursache',
    errorAction: 'Was tun',
    errorRead: 'Als gelesen markieren',
    errorDelete: 'Löschen',
    /** v0.6.1: merged entries („23× · zuletzt 7. Nov. 2026, 14:05“). */
    errorRepeated: '{count}× · zuletzt {time}',
    unread: 'neu',
    severity_info: 'Info',
    severity_warning: 'Warnung',
    severity_error: 'Fehler',
    /** v0.8 */
    switchLanguage: 'English',
    /** v0.8.2 */
    bannersTitle: 'Banner für alle',
    bannersIntro:
      'Ein Hinweis oben in der App für alle angemeldeten Konten – auch für Konten, die erst später entstehen –, vom Beginn bis zum Ende (höchstens 90 Tage). Jeder kann ihn für sich ausblenden. Ohne englischen Text sehen englische Konten den deutschen.',
    bannerTextDe: 'Text (Deutsch, bis 500 Zeichen)',
    bannerTextEn: 'Text (Englisch, optional)',
    bannerStart: 'Beginn',
    bannerEnd: 'Ende',
    bannerCreate: 'Banner einstellen',
    bannerSaved: 'Das Banner ist eingestellt.',
    bannerDelete: 'Löschen',
    bannersNone: 'Keine Banner.',
    bannerPeriod: '{start} bis {end}',
    openaiBotsLimit: 'Tageslimit der Bots aus dem Kontrollzentrum',
    openaiBotsUsed: 'Bots heute verbraucht: {used} von {limit}',
    openaiLimitExplainer: 'Tageslimit des Erklärbärs',
  },
  /** v0.8: the bots control centre (bots.<domain>, SPEC 10.12). */
  centre: {
    title: 'PostEulen – Bots-Kontrollzentrum',
    loginHeading: 'Anmeldung im Bots-Kontrollzentrum',
    sessionExpired:
      'Nach 12 Stunden ohne Aktivität wurdest du abgemeldet. Bitte melde dich neu an.',
    overviewTitle: 'Bots',
    overviewIntro:
      'Bots sind Brieffiguren für alle Spielerinnen und Spieler: eine Identität, ein Charakter, ein Plan. Briefwechsel, Gedächtnis und Zustellung hat jede und jeder für sich. Der Erklärbär ist fest eingebaut und erscheint hier nicht.',
    none: 'Noch keine Bots.',
    newName: 'Name des neuen Bots (3–30 Zeichen)',
    create: 'Bot anlegen',
    createConfirm:
      'Den Bot „{name}“ anlegen? Er ist zunächst ein leerer Entwurf: ohne Wohnort, für niemanden sichtbar, er tut nichts.',
    state_draft: 'Entwurf',
    state_active: 'aktiv',
    state_paused: 'pausiert',
    statsTotal: 'Insgesamt',
    statsRecent: 'Letzte 30 Tage',
    statsLine: '{sent} abgeschickt · {delivered} zugestellt · {read} gelesen · {replies} Antworten',
    plannedCount: '{count} geplante Events',
    open: 'Öffnen',
    back: '← Alle Bots',
    mapTitle: 'Bot-Eulen unterwegs',
    mapIntro:
      'Alle Eulen von Bots, die gerade hinfliegen, rasten oder zurückfliegen – ohne Namen der Spieler.',
    /** v0.8.5: legend of the map. */
    legendTitle: 'Legende',
    legendHome: 'Wohnort eines Bots (Raute)',
    legendFlying: 'Bot-Eule fliegt hin (blauer Kreis)',
    legendResting: 'Bot-Eule rastet beim Spieler (grünes Quadrat)',
    legendReturning: 'Bot-Eule fliegt zurück (orangefarbenes Dreieck)',
    legendPicked: 'Gewählter Wohnort (roter Ring)',
    mapNone: 'Gerade ist keine Bot-Eule unterwegs.',
    mapLabel: 'Weltkarte mit Bot-Eulen',
    owl_flying: 'fliegt hin',
    owl_resting: 'rastet',
    owl_returning: 'fliegt zurück',
    owlSleeping: 'schläft gerade',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    mapReset: 'Ganze Welt',
    tabPlanned: 'Geplante Events',
    tabPast: 'Vergangene Events',
    tabSettings: 'Einstellungen',
    name: 'Name (3–30 Zeichen, eindeutig, für alle Spieler)',
    character: 'Charakter und Hintergrund (geht an die KI)',
    characterHint:
      'Wer ist der Bot, wie schreibt er, was mag er? Das bekommt die KI bei jeder Antwort und jeder Anpassung mit.',
    home: 'Wohnort (überall auf Land)',
    homeHint: 'Auf die Karte tippen oder Koordinaten eingeben.',
    lat: 'Breite in Grad',
    lon: 'Länge in Grad',
    noHome: 'noch kein Wohnort',
    pickedPlace: 'Gewählt: {lat}, {lon}',
    owlMode: 'Eulen des Bots',
    owlOwn: 'eigene Eule (jede Spielerin und jeder Spieler bekommt eine eigene Ausgabe davon)',
    owlLoan: 'zufällige Leiheulen',
    owlSpecies: 'Art der eigenen Eule',
    owlName: 'Name der eigenen Eule',
    owlSexF: 'Geschlecht der Eule: weiblich',
    owlSexM: 'Geschlecht der Eule: männlich',
    motivation: 'Motivation der Bot-Eulen (0,5 bis 20; 1 = normal)',
    motivationHint:
      'Gilt dauerhaft für eigene Eule und Leiheulen: Geschwindigkeit, Energie und Erholung mal Motivation. Mit 20 gehen Briefe auch auf andere Kontinente. Bot-Eulen werden nie krank, legen keine Eier und verlieren keine Motivation.',
    restHours: 'Rast beim Spieler in Stunden (0 bis 168)',
    restHint: 'So lange wartet die Eule beim Spieler; so lange kann er ihr eine Antwort mitgeben.',
    playerOwls: 'Spieler dürfen dem Bot auch mit eigenen Eulen und Leiheulen schreiben',
    save: 'Speichern',
    saved: 'Gespeichert.',
    problems: 'Für die Aktivierung fehlt noch: {list}',
    problem_name: 'Name',
    problem_home: 'Wohnort an Land',
    problem_owl_species: 'Art der Eule',
    problem_owl_name: 'Name der Eule',
    problem_owl: 'gültige Eulen-Einstellungen',
    activate: 'Aktivieren',
    activateConfirm:
      'Den Bot „{name}“ wirklich aktivieren? Ab jetzt nimmt er an der Spielwelt teil und führt seine geplanten Events aus.',
    pause: 'Pausieren',
    pauseConfirm:
      '„{name}“ pausieren? Er verschickt nichts Neues; Eulen unterwegs fliegen normal weiter. Events, die während der Pause fällig werden, entfallen.',
    resume: 'Fortsetzen',
    exportBot: 'Bot exportieren (ZIP)',
    deleteTitle: 'Bot endgültig löschen',
    deleteIntro:
      'Atomar und unwiderruflich: geplante Events und Briefe unterwegs entfallen, Eulen der Spieler kehren mit nicht zugestellten Briefen um, alle Chatverläufe und Zusammenfassungen werden gelöscht. Wer Kontakt hatte, bekommt eine Systemnachricht.',
    deleteName: 'Zum Bestätigen den Namen des Bots eintippen',
    delete: 'Endgültig löschen',
    eventNew: 'Neues Event planen',
    eventEdit: 'Event bearbeiten',
    dueAt: 'Zeitpunkt (Ortszeit dieses Geräts)',
    withMove: 'Umzug',
    moveTo: 'Neuer Wohnort',
    withLetter: 'Brief an alle Spieler',
    parchment: 'Pergament',
    parchmentSmall: 'kurz (bis 800 Zeichen)',
    parchmentLarge: 'lang (bis 15.000 Zeichen)',
    eventOwl: 'Eule',
    owlDefault: 'wie in den Einstellungen',
    textFirstDe: 'Deutsch – Erstkontakt (für Spieler ohne früheren Brief dieses Bots)',
    textFollowDe: 'Deutsch – Folgebrief',
    textFirstEn: 'Englisch – Erstkontakt',
    textFollowEn: 'Englisch – Folgebrief',
    pictures: 'Bilder (höchstens 2; JPEG, PNG oder WebP, je bis 5 MB)',
    addPicture: 'Bild hinzufügen',
    removePicture: 'Bild entfernen',
    gift: 'Geschenk an jeden Spieler',
    giftNone: 'keins',
    giftGold: 'Gold',
    giftOwl: 'Eule',
    giftAmount: 'Gold pro Spieler (0,1 bis 100)',
    giftSpecies: 'Art der Eule (der Spieler gibt ihr einen Namen)',
    /** v1.3.1: owl biscuits or treats in the letter (pouch of the player). */
    giftBiscuits: 'Eulenkekse',
    giftTreats: 'Leckerlis',
    giftCount: 'Anzahl pro Spieler (1 bis 10)',
    giftNeedsLetter: 'Eulenkekse und Leckerlis liegen einem Brief bei – bitte einen Brief anlegen.',
    context: 'Zusätzlicher Kontext für die KI (Hintergrund für Antworten nach diesem Event)',
    preview: 'Vorschau',
    previewTitle: 'So sieht der Brief bei den Spielern aus',
    previewLanguage: 'Sprache',
    previewVariant: 'Fassung',
    variantFirst: 'Erstkontakt',
    variantFollow: 'Folgebrief',
    previewParchment: 'Pergament: {size}',
    previewGift: 'Dazu: {gift}',
    aiTest: 'KI-Personalisierung testen',
    aiTestIntro:
      'Ein ausgedachter Spielerbrief – die KI zeigt, wie sie den Folgebrief dieses Events daraufhin anpassen würde (wer dem Bot schreibt, kennt ihn schon). Als bisheriger Verlauf dient der Brief des vorigen Events. Im echten Betrieb bekommt die KI die letzten 15 Briefe mit dem Spieler und eine Zusammenfassung der älteren. Es wird nichts verschickt, gespeichert oder gezählt (außer im KI-Kontingent).',
    aiLetter: 'Ausgedachter Spielerbrief',
    aiRun: 'Testen',
    aiResult: 'So würde der Bot schreiben:',
    aiProblem_no_key: 'Es ist kein OpenAI-Key hinterlegt (Adminpanel).',
    aiProblem_limit: 'Das Tageslimit der Bots ist für heute erreicht.',
    aiProblem_error: 'OpenAI hat nicht geantwortet. Bitte später erneut versuchen.',
    saveEvent: 'Event speichern',
    cancel: 'Abbrechen',
    edit: 'Bearbeiten',
    deleteEvent: 'Löschen',
    deleteEventConfirm: 'Dieses Event wirklich löschen?',
    plannedTitle: 'Geplante Events (chronologisch)',
    plannedNone: 'Keine geplanten Events.',
    summaryMove: 'Umzug',
    summaryLetter: 'Brief',
    summaryGold: '{amount} Gold',
    summaryOwl: 'Eule ({species})',
    summaryBiscuits: '{count} Eulenkekse',
    summaryTreats: '{count} Leckerlis',
    select: 'Für den Export auswählen',
    exportSelected: 'Ausgewählte Events exportieren',
    pastTitle: 'Vergangene Events (Archiv)',
    pastNone: 'Noch keine vergangenen Events.',
    /** v0.8.5 */
    pastRetention:
      '36 Monate nach dem Versand wird ein Event endgültig gelöscht – mit Texten, Zahlen, Zustellungen und Bildern, die sonst nichts mehr nutzt. Die Statistik der Bots bleibt.',
    pastState_running: 'läuft (Briefe oder Antworten unterwegs)',
    pastState_archived: 'abgeschlossen',
    pastState_skipped: 'nicht ausgeführt',
    pastStarted: 'Versand: {time}',
    reachFirst: 'Erste Ankunft bei einem Spieler: {time}',
    reachLast: 'Letzte Ankunft bei einem Spieler: {time}',
    reachAbout: 'ca. {time}',
    reachHint:
      'ca. = geschätzt aus den Flügen zum nächsten und zum entferntesten Spieler mit den heutigen Einstellungen (ohne Wartezeit auf die eigene Bot-Eule).',
    pastArchived: 'Abgeschlossen: {time}',
    pastNumbers:
      '{recipients} Empfänger · {sent} abgeschickt · {delivered} zugestellt · {read} gelesen · {replies} Antworten',
    importTitle: 'Export und Import',
    importIntro:
      'Ein Import ergänzt nur: Einstellungen vorhandener Bots bleiben, vorhandene Event-IDs werden übersprungen, vergangene Events landen im Archiv und werden nie verschickt. Neue Bots kommen als Entwurf.',
    exportAll: 'Alle Bots exportieren (ZIP)',
    importFile: 'Export-Datei (ZIP)',
    importTarget: 'Events in diesen Bot übernehmen (optional)',
    importTargetNone: '– wie in der Datei –',
    importPreview: 'Vorschau anzeigen',
    importApply: 'Jetzt importieren',
    importDone: 'Import abgeschlossen.',
    importBot_new: '{name}: neu (als Entwurf)',
    importBot_merge: '{name}: wird ergänzt (Einstellungen bleiben)',
    importBot_conflict: '{name}: Konflikt – wird übersprungen ({reason})',
    conflict_name_taken: 'Name schon vergeben',
    conflict_name_invalid: 'Name ungültig',
    conflict_id_elsewhere: 'ID gehört zu einem anderen Bot',
    importEvents: '{planned} geplant · {past} ins Archiv · {skip} übersprungen (ID vorhanden)',
    loading: 'Lädt …',
  },
  errors: {
    gift_not_allowed: 'Nur aktive Spieler können alle zwei Wochen Gold oder eine Eule verschenken.',
    rescue_done_today: 'Das hat diese Eule heute schon bekommen. Morgen wieder!',
    rescue_healed: 'Diese Eule ist schon wieder gesund.',
    rescue_not_healed: 'Diese Eule ist noch nicht wieder gesund.',
    /** v1.3.1 */
    user_not_found: 'Ein Konto mit diesem Namen gibt es nicht.',
    privilege_until: 'Bitte ein Ende in der Zukunft wählen.',
    privilege_not_found: 'Dieser Spieler hat keinen Sonderstatus.',
    gift_needs_letter:
      'Eulenkekse und Leckerlis liegen einem Brief bei – bitte einen Brief anlegen.',
    stale: 'Inzwischen ist hier ein anderes Konto angemeldet. Bitte lade die Seite neu.',
    account_mismatch: 'Inzwischen ist hier ein anderes Konto angemeldet. Bitte lade die Seite neu.',
    banner_invalid:
      'Der Text des Banners enthält Zeichen, die nicht erlaubt sind (z. B. Emojis), oder fehlt.',
    banner_period: 'Bitte ein Ende in der Zukunft wählen, höchstens 90 Tage nach dem Beginn.',
    internal: 'Da ist etwas schiefgegangen. Bitte versuche es später noch einmal.',
    not_found: 'Das gibt es hier nicht.',
    bad_request: 'Die Anfrage war ungültig.',
    forbidden_origin: 'Diese Anfrage ist von hier aus nicht erlaubt.',
    unsupported_media_type: 'Bitte nur JSON senden.',
    payload_too_large: 'Die Anfrage ist zu groß.',
    client_outdated: 'Die App ist veraltet. Bitte neu laden.',
    rate_limited: 'Langsam, die Eulen kommen nicht hinterher. Bitte warte kurz.',
    tor_disabled:
      'Der Zugang über das Tor-Netz ist gerade abgeschaltet. Bitte versuch es später noch einmal oder nutze die normale Adresse.',
    offline: 'Keine Verbindung – Eulen brauchen Netz.',
    unauthorized: 'Bitte melde dich an.',
    login_failed: 'Name oder Passwort stimmen nicht.',
    registration_closed: 'Neue Konten können gerade nicht erstellt werden.',
    invite_invalid: 'Der Einladungscode ist ungültig oder abgelaufen.',
    captcha_invalid:
      'Die Prüfung gegen Missbrauch ist fehlgeschlagen. Bitte versuche es noch einmal.',
    name_unavailable: 'Diesen Namen gibt es schon (oder einen zum Verwechseln ähnlichen).',
    name_too_short: 'Der Name ist zu kurz (mindestens 3 Zeichen).',
    name_too_long: 'Der Name ist zu lang (höchstens 20 Zeichen).',
    bot_name_too_long: 'Der Name ist zu lang (höchstens 30 Zeichen).',
    name_invalid_characters: 'Der Name enthält Zeichen, die nicht erlaubt sind.',
    name_invalid_spaces: 'Keine Leerzeichen am Anfang oder Ende und keine doppelten Leerzeichen.',
    name_reserved: 'Dieser Name ist reserviert.',
    home_invalid: 'Dieser Wohnort geht nicht. Bitte wähle einen Ort an Land auf der Karte.',
    reservation_expired: 'Das hat zu lange gedauert. Bitte versuche es noch einmal.',
    reauth_required: 'Bitte gib dein Passwort noch einmal ein.',
    password_change_required: 'Bitte ändere zuerst das Erstpasswort.',
    admin_not_set_up: 'Die Verwaltung ist noch nicht eingerichtet (posteulen-cli admin-init).',
    contact_limit: 'Heute sind keine weiteren Anfragen möglich (höchstens 20 pro Tag).',
    recipient_invalid: 'An diesen Empfänger kann gerade kein Brief geschickt werden.',
    recipient_inactive: 'Dieser Kontakt ist inaktiv und kann keine Briefe empfangen.',
    key_warning: 'Wegen einer Schlüsselwarnung ist der Versand an diesen Kontakt gesperrt.',
    gold_insufficient: 'Dafür reicht dein Gold nicht.',
    letter_token_expired: 'Das hat zu lange gedauert. Bitte noch einmal auf „Absenden“ tippen.',
    vault_version: 'Das Adressbuch wurde inzwischen geändert. Bitte neu laden.',
    push_endpoint_invalid: 'Dieser Push-Dienst wird nicht unterstützt.',
    push_not_subscribed: 'Benachrichtigungen sind noch nicht eingerichtet.',
    owl_not_ready: 'Diese Eule ist gerade nicht einsatzbereit.',
    voucher_invalid: 'Dieser Gutschein ist ungültig, abgelaufen oder schon eingelöst.',
    feedback_daily: 'Heute hast du schon eine Nachricht an den Admin geschickt.',
    feedback_empty: 'Bitte schreib etwas.',
    feedback_too_long: 'Die Nachricht ist zu lang (höchstens 300 Zeichen).',
    feedback_invalid: 'Die Nachricht enthält Zeichen, die nicht erlaubt sind.',
    owl_recipients: 'So viele Empfänger kann diese Eule nicht anfliegen (höchstens 5).',
    owl_limit: 'Du hast schon 50 eigene Eulen – mehr gehen nicht.',
    owl_not_for_sale: 'Diese Eule ist in der Menagerie nicht zu kaufen.',
    owl_fed_today: 'Diese Eule hat heute schon gefressen und ist satt.',
    owl_watered_today: 'Diese Eule hat heute schon getrunken.',
    owl_snacked_today: 'Diese Eule hat heute schon ihr Lieblingsleckerli bekommen und ist satt.',
    owl_cannot_carry:
      'Diese Eule kann das nicht tragen. Wähle eine andere Eule oder ein kurzes Pergament.',
    owl_not_home: 'Das geht nur, wenn die Eule zu Hause ist.',
    owl_name_mismatch:
      'Der Name stimmt nicht. Bitte tippe den Namen der Eule genau so ein, wie er dasteht.',
    owl_release_limit:
      'Freilassen geht nur, solange du mehr als 20 eigene Eulen hast (Küken zählen mit).',
    owl_rename_blocked: 'Diese Eule kann erst im nächsten Kalenderjahr wieder umbenannt werden.',
    owl_name_too_short: 'Der Name ist zu kurz (mindestens 2 Zeichen).',
    owl_name_too_long: 'Der Name ist zu lang (höchstens 20 Zeichen).',
    owl_name_invalid_characters: 'Der Name enthält Zeichen, die nicht erlaubt sind.',
    owl_name_invalid_spaces:
      'Keine Leerzeichen am Anfang oder Ende und keine doppelten Leerzeichen.',
    transfer_amount: 'Bitte gib 0,1 bis 20,0 Gold ein.',
    loan_not_offered: 'Diese Eulenart gibt es heute nicht zu leihen.',
    loan_limit: 'Du hast heute schon alle vier Leiheulen geliehen. Morgen gibt es neue.',
    loan_species: 'Diese Leiheule hast du heute schon geliehen.',
    owl_not_sick: 'Diese Eule ist nicht krank.',
    owl_unnamed: 'Bitte gib dem Küken zuerst einen Namen.',
    clutch_done: 'Aus diesem Gelege wurde schon ein Küken verschenkt.',
    name_change_blocked: 'Du kannst deinen Namen erst im nächsten Kalenderjahr wieder ändern.',
    home_change_blocked: 'Den Wohnort kannst du höchstens 3-mal pro Kalendermonat ändern.',
    bot_write_lock: 'Diesem Bot hast du heute schon geschrieben. Morgen geht es wieder.',
    bot_owls_only:
      'Diesem Bot kannst du nur mit seiner eigenen Eule antworten, solange sie bei dir rastet.',
    bot_incomplete: 'Der Bot ist noch nicht vollständig: Name, Wohnort und Eule fehlen.',
    home_not_land: 'Dieser Ort liegt im Wasser. Bitte einen Ort an Land wählen.',
    event_empty: 'Ein Event braucht einen Umzug, einen Brief oder ein Geschenk.',
    event_in_past: 'Der Zeitpunkt liegt in der Vergangenheit.',
    event_started: 'Dieses Event läuft schon und lässt sich nicht mehr ändern.',
    event_texts: 'Bitte alle vier Fassungen des Briefs ausfüllen (ohne Emojis).',
    media_invalid: 'Das Bild lässt sich nicht lesen. Erlaubt sind JPEG, PNG und WebP.',
    media_too_large: 'Das Bild ist zu groß (höchstens 5 MB).',
    media_unknown: 'Ein Bild gehört nicht zu diesem Bot.',
    import_invalid: 'Die Datei ist kein gültiger PostEulen-Bot-Export.',
    name_mismatch: 'Der eingetippte Name stimmt nicht.',
    letter_too_long: 'Der Text ist zu lang.',
    letter_invalid: 'Der Text enthält Zeichen, die nicht erlaubt sind.',
    letter_empty: 'Bitte schreib etwas.',
    openai_no_key: 'Es ist kein OpenAI-Key hinterlegt.',
    openai_failed: 'OpenAI ist gerade nicht erreichbar.',
    openai_key_invalid: 'OpenAI lehnt den Key ab.',
    openai_model_unknown: 'Dieses Modell kennt OpenAI für diesen Key nicht.',
    transfer_remaining: 'Nach der Überweisung müssen dir mehr als 10,0 Gold bleiben.',
  },
  images: {
    placeholderAlt: 'Platzhalter: Bild folgt',
  },
} as const;

/** The shape of `de` with plain strings, so other languages can fill it (v0.4). */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { readonly [K in keyof T]: Widen<T[K]> };

export type Texts = Widen<typeof de>;

/** Replaces `{key}` placeholders. Unknown keys stay visible to make mistakes obvious. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
