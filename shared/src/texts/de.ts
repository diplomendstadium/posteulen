/**
 * All user-facing German texts (SPEC 1: one central file, translatable later).
 * Keys are English; values are German. Placeholders use {name}.
 */
export const de = {
  app: {
    name: 'PostEulen',
    tagline: 'Briefe, die eine Eule bringt.',
    offline: 'Keine Verbindung – Eulen brauchen Netz.',
    updateAvailable: 'Eine neue Version ist da. Bitte neu laden.',
    reload: 'Neu laden',
    comingSoon: 'Dieser Bereich wird gerade gebaut.',
    back: 'Zurück',
    skipToContent: 'Zum Inhalt springen',
  },
  start: {
    title: 'Willkommen bei PostEulen',
    intro:
      'Hier schreibst du Briefe, die von Eulen überbracht werden – sicher verschlüsselt und mit etwas Geduld.',
    loginHeading: 'Anmelden',
    userName: 'Nutzername',
    password: 'Passwort',
    login: 'Anmelden',
    createAccount: 'Konto erstellen',
    notYet: 'Anmelden und Registrieren sind noch nicht verfügbar.',
  },
  nav: {
    main: 'Hauptnavigation',
    letters: 'Briefwechsel',
    owls: 'Eulen',
    finance: 'Finanzen',
    menagerie: 'Menagerie',
    addressBook: 'Adressbuch',
    map: 'Karte',
    settings: 'Einstellungen',
    help: 'Hilfe',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    home: 'Übersicht',
  },
  header: {
    gold: 'Gold',
    goldAmount: '{amount} Gold',
  },
  pages: {
    helpTitle: 'Hilfe',
    privacyTitle: 'Datenschutz',
    privacyDraft: 'Entwurf',
    imprintTitle: 'Impressum',
  },
  admin: {
    title: 'PostEulen – Verwaltung',
    loginHeading: 'Anmeldung für die Verwaltung',
    password: 'Passwort',
    login: 'Anmelden',
    notYet: 'Die Anmeldung für die Verwaltung ist noch nicht verfügbar.',
  },
  errors: {
    internal: 'Da ist etwas schiefgegangen. Bitte versuche es später noch einmal.',
    not_found: 'Das gibt es hier nicht.',
    bad_request: 'Die Anfrage war ungültig.',
    forbidden_origin: 'Diese Anfrage ist von hier aus nicht erlaubt.',
    unsupported_media_type: 'Bitte nur JSON senden.',
    payload_too_large: 'Die Anfrage ist zu groß.',
    client_outdated: 'Die App ist veraltet. Bitte neu laden.',
    rate_limited: 'Langsam, die Eulen kommen nicht hinterher. Bitte warte kurz.',
  },
  images: {
    placeholderAlt: 'Platzhalter: Bild folgt',
  },
} as const;

export type Texts = typeof de;

/** Replaces `{key}` placeholders. Unknown keys stay visible to make mistakes obvious. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
