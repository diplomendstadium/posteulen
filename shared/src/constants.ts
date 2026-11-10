/**
 * All numeric rules of the game, SPEC Anhang A. This is the only place where they are defined.
 * Gold is stored in tenths (1 gold = 10). Durations are milliseconds unless the name says otherwise.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TIME = { MINUTE, HOUR, DAY } as const;

export const GOLD = {
  START: 30,
  /** Daily wage in the first DAILY_HIGH_DAYS days after the account was created (v0.4). */
  DAILY: 30,
  /** Daily wage afterwards (v0.4). */
  DAILY_LATER: 20,
  DAILY_HIGH_DAYS: 30,
  /** v0.7: 03:00 UTC (before 15:00). */
  DAILY_HOUR_UTC: 3,
  LARGE_PARCHMENT_SURCHARGE: 1,
  LOAN_PRICE: 1,
  FEED_PRICE: 1,
  /** Favourite snack (v0.5), once a day. */
  SNACK_PRICE: 2,
  SELF_CARE_PRICE: 2,
  VET_PRICE: 10,
  TRANSFER_MIN: 1,
  TRANSFER_MAX: 200,
  /** Balance after a transfer must be strictly greater than this. */
  TRANSFER_MIN_REMAINING_EXCLUSIVE: 100,
  /** Menagerie wage as a share of the species price. */
  MENAGERIE_WAGE_SHARE: 0.1,
  TRANSACTIONS_KEPT: 20,
} as const;

export const LETTER = {
  SMALL_MAX_CHARS: 800,
  LARGE_MAX_CHARS: 15_000,
  /** 800 characters of up to 4 bytes plus the signed header fit (SPEC 5.9). */
  SMALL_PADDED_BYTES: 4096,
  /** 15,000 characters of up to 4 bytes plus header (v0.3). */
  LARGE_PADDED_BYTES: 65_536,
  /** Large letters written before v0.3 were padded to this size; they stay readable. */
  LEGACY_LARGE_PADDED_BYTES: 16_384,
  MAX_RECIPIENTS: 5,
  /** Every letter and system message is deleted at the latest this many days after delivery. */
  RETENTION_MAX_DAYS: 365,
  /** Shorter periods a user can choose for their own copies (settings, v0.2). */
  RETENTION_CHOICES: [30, 90, 180, 365],
  /**
   * v0.7: how long (hours) the owl rests at each recipient before flying on; the recipient may
   * hand it a reply to the sender meanwhile. 0 = no rest.
   */
  REST_HOURS_CHOICES: [0, 1, 2, 24, 48],
  /** v0.7: preselected when writing a letter. */
  REST_HOURS_DEFAULT: 1,
} as const;

export const FLIGHT = {
  BASE_SPEED_KMH: 25,
  ENERGY_PER_KM_NIGHT: 1,
  ENERGY_PER_KM_DAY: 1.5,
  /** Sun altitude in degrees above which it counts as day (twilight = day). */
  DAY_SUN_ALTITUDE_DEG: -6,
  EARTH_RADIUS_KM: 6371,
  MAX_STEP_KM: 2,
  MAX_STEP_MINUTES: 5,
  WAYPOINT_SPACING_KM: 25,
  CHICK_SPEED_KMH: 10,
  CHICK_FLY_HOURS: 1,
  CHICK_REST_HOURS: 1,
} as const;

export const OWL = {
  START_ENERGY_MIN_SHARE: 0.6,
  START_ENERGY_MAX_SHARE: 1.0,
  /** Regeneration per hour at home and (v0.5) while sleeping on a flight, × recovery factor. */
  REGEN_SHARE_PER_HOUR: 0.1,
  FEED_SHARE: 0.1,
  /** Favourite snack (v0.5): +20 % of the maximum × recovery factor. */
  SNACK_SHARE: 0.2,
  /** v0.5: a day counts as cared for with this many different interactions. */
  CARE_DAY_INTERACTIONS: 2,
  MAX_OWN_OWLS: 50,
  NAME_MIN_CHARS: 2,
  NAME_MAX_CHARS: 20,
  /** Care bonus (9.3): the last 14 days with at least one hour at home, 10 of them cared for. */
  CARE_BONUS_WINDOW_DAYS: 14,
  CARE_BONUS_MIN_DAYS: 10,
  CARE_BONUS_MIN_HOME_HOURS: 1,
  /** How far back the care bonus looks for such days; care days and absences are kept as long. */
  CARE_BONUS_LOOKBACK_DAYS: 60,
  CARE_BONUS_FACTOR: 0.3,
  SICKNESS_PROBABILITY: 1 / 30,
  SICKNESS_HOUR_UTC: 3,
  SICKNESS_GRACE_DAYS: 28,
  SELF_CARE_DAYS: 7,
  VET_HOURS: 24,
  MENAGERIE_DAYS: 7,
  EGG_PROBABILITY: 1 / 100,
  BROODING_DAYS: 7,
  CHICKS_MIN: 1,
  CHICKS_MAX: 3,
  CHICK_GIFT_FROM_COUNT: 2,
  CHICK_GIFT_DEADLINE_HOURS: 24,
  CHICK_NAME_DEADLINE_HOURS: 24,
  CHICK_ADULT_AT_MOTHER_DAYS: 14,
  CHICK_ADULT_AT_RECIPIENT_DAYS: 7,
} as const;

/**
 * Motivation of an owl (v0.5), stored in tenths: 0.8–1.2. It sinks by 0.1 every night at 00:00
 * UTC and rises by 0.1 for each kind of interaction once a day. At departure it multiplies
 * energy, speed and recovery for the whole trip.
 */
export const MOTIVATION = {
  MIN: 8,
  MAX: 12,
  START: 10,
  STEP: 1,
  /** Loan owls come with 0.8, 0.9 or 1.0 (derived per user, day and species). */
  LOAN_MIN: 8,
  LOAN_MAX: 10,
  DECAY_HOUR_UTC: 0,
} as const;

/** v0.5.1: share of healthy owls at home that nap by day (rolled at each opening of the list). */
export const OWL_NAP_SHARE = 0.5;
/** v0.5.1: no nap picture within ten minutes after the last interaction. */
export const OWL_NAP_AFTER_CARE_MS = 10 * TIME.MINUTE;

export const MENAGERIE = {
  OFFER_SPECIES_COUNT: 4,
  OFFER_HOUR_UTC: 0,
  /** Loan owls per offer day (00:00 UTC), one per offered species (v0.3.2; 4 since v0.5). */
  LOANS_PER_DAY: 4,
  MAX_LOANS_PER_SPECIES: 1,
  LOAN_EXPIRY_HOURS: 24,
} as const;

export const ACCOUNT = {
  USER_NAME_MIN_CHARS: 3,
  USER_NAME_MAX_CHARS: 20,
  PASSWORD_MIN_CHARS: 15,
  PASSWORD_MAX_CHARS: 256,
  NAME_LOCK_DAYS: 90,
  /** Moves per calendar month (UTC), however close together (7.3). */
  HOME_CHANGES_PER_MONTH: 3,
  /** Coordinates are rounded to this many decimal places (0.01°). */
  HOME_DECIMALS: 2,
  CONTACT_REQUESTS_PER_DAY: 20,
  CONTACT_REQUEST_EXPIRY_HOURS: 24,
  INACTIVE_AFTER_DAYS: 21,
  ADMIN_ACTIVE_WINDOW_DAYS: 30,
  AUTO_DELETE_DEFAULT_DAYS: 180,
  AUTO_DELETE_MIN_DAYS: 60,
  AUTO_DELETE_WARNING_DAYS: 30,
  INACTIVITY_HOUR_UTC: 4,
  SELF_DELETE_GRACE_HOURS: 24,
  USER_SESSION_IDLE_DAYS: 30,
  /** v0.7: an admin login expires after 10 minutes without activity (was 8 hours). */
  ADMIN_SESSION_IDLE_MINUTES: 10,
  /** v0.8: a login to the bots control centre expires after 12 hours without activity. */
  BOTS_SESSION_IDLE_HOURS: 12,
  REGISTRATION_RESERVATION_MINUTES: 10,
  INVITE_CODE_VALID_HOURS: 48,
  REAUTH_TOKEN_MINUTES: 5,
} as const;

export const SECURITY = {
  LOGIN_BACKOFF_FROM_FAILURE: 5,
  LOGIN_BACKOFF_MAX_MINUTES: 15,
  LOGIN_CAPTCHA_FROM_FAILURE: 3,
  /** Argon2id parameters for OPAQUE key stretching (SPEC 5.3, D-03). */
  ARGON2_MEMORY_KIB: 65_536,
  ARGON2_ITERATIONS: 3,
  ARGON2_PARALLELISM: 4,
  MAX_REQUEST_BYTES: 64 * 1024,
  /** Sending letters: 5 large letters (64 KiB padded each) as Base64 need about 440 KB. */
  MAX_LETTER_REQUEST_BYTES: 512 * 1024,
  /** Letters to bots: plain text, one recipient. */
  MAX_BOT_LETTER_REQUEST_BYTES: 128 * 1024,
  PUSH_VERIFY_SECONDS: 60,
  /** Push subscription changes and test pushes per account and hour (v0.6.1). */
  PUSH_CHANGES_PER_HOUR: 10,
  /** Identical error log entries within this time count up one entry (v0.6.1). */
  ERROR_LOG_MERGE_MINUTES: 60,
} as const;

export const BOTS = {
  /** The Erklärbär (SPEC 10.2): hard-coded, one per account. */
  EXPLAINER_SPEED_KMH: 200,
  EXPLAINER_HOME: { lat: 52.52, lon: 13.405 },
  REPLY_AFTER_HOURS: 2,
  /** v0.8: replies of the Erklärbär have at most 500 characters; other bots have no limit. */
  EXPLAINER_REPLY_MAX_CHARS: 500,
  AI_RETRY_HOURS: 24,
  /** Daily AI calls of the Erklärbär (own quota since v0.8, SPEC 10.5). */
  AI_DAILY_LIMIT_DEFAULT: 200,
  /** v0.8: daily AI calls of all control-centre bots together. */
  CENTRAL_AI_DAILY_LIMIT_DEFAULT: 500,
  SUMMARY_MAX_WORDS: 250,
  CONTEXT_LETTERS: 6,
  /** v0.8.3: the control-centre bots get the last 15 letters word for word (older: summary). */
  CENTRAL_CONTEXT_LETTERS: 15,
  EXPLAINER_LETTER_DAYS: [0, 1, 2, 3, 4, 7],
} as const;

/** v0.8: bots of the control centre (SPEC 10.6 ff.). */
export const CENTRAL_BOTS = {
  NAME_MIN_CHARS: 3,
  /** v0.8.3: up to 30 characters (players: 20, so a bot name never collides with a new one). */
  NAME_MAX_CHARS: 30,
  CHARACTER_MAX_CHARS: 8000,
  CONTEXT_MAX_CHARS: 8000,
  /** Permanent motivation of bot owls in tenths: 0.5 to 20.0. */
  MOTIVATION_MIN: 5,
  MOTIVATION_MAX: 200,
  MOTIVATION_DEFAULT: 10,
  /** How long a bot owl waits at the player before it flies back (hours). */
  REST_HOURS_MAX: 168,
  REST_HOURS_DEFAULT: 24,
  /** Spontaneous AI reply only if no letter event is planned within this many days. */
  SPONTANEOUS_WINDOW_DAYS: 28,
  REPLY_AFTER_HOURS: 2,
  /** Up to two pictures per letter, uploads of at most 5 MB each (JPEG, PNG, WebP; v0.8.3, before 2 MB). */
  MEDIA_PER_LETTER: 2,
  MEDIA_MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
  MEDIA_MAX_INPUT_PIXELS: 40_000_000,
  MEDIA_MAX_EDGE_PX: 1600,
  /** Gifts in events: like vouchers, 0.1 to 100 gold per player (tenths). */
  GIFT_GOLD_MIN: 1,
  GIFT_GOLD_MAX: 1000,
  /** Export/import (SPEC Anhang S). */
  EXPORT_FORMAT: 'posteulen-bots',
  EXPORT_VERSION: 1,
  IMPORT_MAX_BYTES: 64 * 1024 * 1024,
  IMPORT_MAX_FILES: 2000,
  /** The archive and the list of letters shown per event. */
  STATS_RECENT_DAYS: 30,
} as const;

/** Friendly request for donations as a system message (v0.3), on every server. */
export const DONATION = {
  INTERVAL_DAYS: 35,
  URL: 'https://ko-fi.com/posteulen',
  /** Number of different texts, shown in turn. */
  TEXTS: 3,
} as const;

/** v0.7.1: short, unencrypted messages from users to the admin (SPEC 8.10, 13). */
export const FEEDBACK = {
  MAX_CHARS: 300,
  /** Deleted this many days after they arrived. */
  RETENTION_DAYS: 90,
} as const;

/** v0.7: vouchers for gold or an owl, created in the admin panel (SPEC 13). */
export const VOUCHER = {
  VALID_DAYS: 90,
  /** Gold in tenths: 0.1 to 100.0. */
  GOLD_MIN: 1,
  GOLD_MAX: 1000,
} as const;

export const MAP = {
  WEST_LON: -10.7,
  EAST_LON: 24.0,
  SOUTH_LAT: 35.8,
  NORTH_LAT: 60.6,
  LAND_MASK_RESOLUTION_DEG: 0.02,
  /** v0.8: coarse land/water mask of the whole world (bots live anywhere on land). */
  WORLD_MASK_RESOLUTION_DEG: 0.1,
  CLIENT_REFRESH_MINUTES: 5,
  /** Cities on the map (v0.2): from this population when zoomed in, … */
  CITY_MIN_POPULATION: 200_000,
  /** … only from this population when zoomed out. */
  CITY_BIG_POPULATION: 1_000_000,
  /** Zoom factor (full width / visible width) from which the smaller cities appear. */
  CITY_SMALL_FROM_ZOOM: 2.5,
} as const;

export const OPERATIONS = {
  ERROR_LOG_RETENTION_DAYS: 30,
  BACKUP_RETENTION_DAYS: 7,
  RELEASES_KEPT: 3,
  FOREGROUND_POLL_SECONDS: 60,
  /** The event worker never sleeps longer than this (SPEC 4.5). */
  WORKER_MAX_SLEEP_MS: HOUR,
} as const;
