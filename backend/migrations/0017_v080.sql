-- v0.8.0: bots of the control centre (SPEC 10.6 ff., Anhang L.3). Aunt and uncle are removed
-- at every start-up (backend/src/bots/relatives.ts) – so also again after a rollback.

-- Only the Erklärbär is still a bot of its own per account (SPEC 10.2).
CREATE TRIGGER bots_explainer_only BEFORE INSERT ON bots
  WHEN NEW.type != 'explainer'
BEGIN
  SELECT RAISE(ABORT, 'only the Erklärbär is a per-account bot');
END;

-- "Alle Bots entfernen" is final and also keeps away bots created later (SPEC 8.10). Accounts
-- that had removed all their bots by v0.7.2 count as such.
ALTER TABLE users ADD COLUMN bots_disabled INTEGER NOT NULL DEFAULT 0 CHECK (bots_disabled IN (0, 1));
UPDATE users SET bots_disabled = 1
 WHERE bots_created = 1 AND NOT EXISTS (SELECT 1 FROM bots WHERE bots.owner_id = users.id);

-- Flights: the holder can be a bot of the control centre (its owls fly like every owl). No
-- foreign key on holder_id any more; flights of an account are deleted with it (accounts/lifecycle).
CREATE TABLE flights_new (
  id          TEXT    PRIMARY KEY,
  holder_id   TEXT    NOT NULL,
  holder_kind TEXT    NOT NULL DEFAULT 'user' CHECK (holder_kind IN ('user', 'bot')),
  -- For a flight of a bot: the player it flies to (one player per flight).
  bot_peer_id TEXT,
  owl_id      TEXT    REFERENCES owls (id) ON DELETE SET NULL,
  owl_kind    TEXT    NOT NULL CHECK (owl_kind IN ('own', 'loan', 'stand_in', 'bot')),
  owl_name    TEXT    NOT NULL,
  owl_species TEXT    NOT NULL,
  purpose     TEXT    NOT NULL CHECK (purpose IN ('letter', 'gold', 'gift')),
  gold        INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  gold_state  TEXT    NOT NULL DEFAULT 'none'
                      CHECK (gold_state IN ('none', 'carried', 'delivered', 'returning', 'refunded')),
  profile     TEXT    NOT NULL,
  route       TEXT    NOT NULL,
  plan        TEXT    NOT NULL,
  started_at  INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  state       TEXT    NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'done')),
  CHECK ((holder_kind = 'bot') = (bot_peer_id IS NOT NULL))
) STRICT;
INSERT INTO flights_new (id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, gold,
                         gold_state, profile, route, plan, started_at, ends_at, state)
SELECT id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, gold, gold_state, profile,
       route, plan, started_at, ends_at, state
  FROM flights;
DROP TABLE flights;
ALTER TABLE flights_new RENAME TO flights;
CREATE INDEX flights_holder ON flights (holder_id, state);
CREATE INDEX flights_owl ON flights (owl_id);
CREATE INDEX flights_bot_peer ON flights (bot_peer_id, state);

-- Letters of bots of the control centre: pictures (IDs of central_bot_media, JSON) and event.
ALTER TABLE letters ADD COLUMN media TEXT;
ALTER TABLE letters ADD COLUMN bot_event_id TEXT;

-- AI calls per UTC day and quota: the Erklärbär has its own (SPEC 10.5).
CREATE TABLE ai_usage_new (
  day   TEXT    NOT NULL,
  pool  TEXT    NOT NULL CHECK (pool IN ('explainer', 'bots')),
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, pool)
) STRICT;
INSERT INTO ai_usage_new (day, pool, calls) SELECT day, 'explainer', calls FROM ai_usage;
DROP TABLE ai_usage;
ALTER TABLE ai_usage_new RENAME TO ai_usage;

-- A bot of the control centre: one identity for all players (SPEC 10.6).
CREATE TABLE central_bots (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  name_key    TEXT    NOT NULL UNIQUE,
  state       TEXT    NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'active', 'paused')),
  character   TEXT    NOT NULL DEFAULT '',
  home_lat    INTEGER,
  home_lon    INTEGER,
  owl_mode    TEXT    NOT NULL DEFAULT 'own' CHECK (owl_mode IN ('own', 'loan')),
  owl_species TEXT,
  owl_name    TEXT,
  owl_sex     TEXT    NOT NULL CHECK (owl_sex IN ('f', 'm')),
  motivation  INTEGER NOT NULL DEFAULT 10 CHECK (motivation BETWEEN 5 AND 200),
  rest_hours  INTEGER NOT NULL DEFAULT 24 CHECK (rest_hours BETWEEN 0 AND 168),
  player_owls INTEGER NOT NULL DEFAULT 0 CHECK (player_owls IN (0, 1)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  CHECK ((home_lat IS NULL) = (home_lon IS NULL))
) STRICT;

-- Pictures: stored once (normalised WebP without metadata), linked from events and letters.
CREATE TABLE central_bot_media (
  id         TEXT    PRIMARY KEY,
  bot_id     TEXT    NOT NULL REFERENCES central_bots (id) ON DELETE CASCADE,
  sha256     TEXT    NOT NULL,
  data       BLOB    NOT NULL,
  width      INTEGER NOT NULL,
  height     INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (bot_id, sha256)
) STRICT;

-- Planned and past events with a stable ID (import keeps it, SPEC Anhang S).
CREATE TABLE central_bot_events (
  id             TEXT    PRIMARY KEY,
  bot_id         TEXT    NOT NULL REFERENCES central_bots (id) ON DELETE CASCADE,
  due_at         INTEGER NOT NULL,
  -- planned → running (letters on their way) → archived; skipped: imported in the past, never sent.
  state          TEXT    NOT NULL DEFAULT 'planned'
                         CHECK (state IN ('planned', 'running', 'archived', 'skipped')),
  move_lat       INTEGER,
  move_lon       INTEGER,
  has_letter     INTEGER NOT NULL DEFAULT 0 CHECK (has_letter IN (0, 1)),
  parchment      TEXT    NOT NULL DEFAULT 'small' CHECK (parchment IN ('small', 'large')),
  text_first_de  TEXT    NOT NULL DEFAULT '',
  text_first_en  TEXT    NOT NULL DEFAULT '',
  text_follow_de TEXT    NOT NULL DEFAULT '',
  text_follow_en TEXT    NOT NULL DEFAULT '',
  context        TEXT    NOT NULL DEFAULT '',
  owl_mode       TEXT    NOT NULL DEFAULT 'default' CHECK (owl_mode IN ('default', 'own', 'loan')),
  gift_gold      INTEGER CHECK (gift_gold IS NULL OR gift_gold BETWEEN 1 AND 1000),
  gift_species   TEXT,
  media          TEXT    NOT NULL DEFAULT '[]',
  started_at     INTEGER,
  archived_at    INTEGER,
  -- Aggregated numbers only (no personal statistics).
  recipients     INTEGER NOT NULL DEFAULT 0,
  sent           INTEGER NOT NULL DEFAULT 0,
  delivered      INTEGER NOT NULL DEFAULT 0,
  read           INTEGER NOT NULL DEFAULT 0,
  replies        INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  CHECK ((move_lat IS NULL) = (move_lon IS NULL)),
  CHECK (gift_gold IS NULL OR gift_species IS NULL)
) STRICT;
CREATE INDEX central_bot_events_bot ON central_bot_events (bot_id, state, due_at);

-- Per player: isolated conversation state (SPEC 10.7).
CREATE TABLE central_bot_players (
  bot_id          TEXT    NOT NULL REFERENCES central_bots (id) ON DELETE CASCADE,
  user_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- The first letter of the bot has arrived: chat list and map.
  known           INTEGER NOT NULL DEFAULT 0 CHECK (known IN (0, 1)),
  -- A letter of the bot has been started for this player: from now on the follow-up variant.
  first_started   INTEGER NOT NULL DEFAULT 0 CHECK (first_started IN (0, 1)),
  removed         INTEGER NOT NULL DEFAULT 0 CHECK (removed IN (0, 1)),
  -- UTC day of the player's last letter to the bot (one per calendar day).
  last_letter_day TEXT,
  PRIMARY KEY (bot_id, user_id)
) STRICT;
CREATE INDEX central_bot_players_user ON central_bot_players (user_id);

-- A letter of a bot to one player: from an event or a spontaneous reply. UNIQUE (event, player)
-- makes sure an event never sends twice to the same player (restarts, errors, imports).
CREATE TABLE central_bot_deliveries (
  id           TEXT    PRIMARY KEY,
  bot_id       TEXT    NOT NULL REFERENCES central_bots (id) ON DELETE CASCADE,
  event_id     TEXT    REFERENCES central_bot_events (id) ON DELETE CASCADE,
  user_id      TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  state        TEXT    NOT NULL CHECK (state IN ('pending', 'started', 'done', 'dropped')),
  not_before   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  variant      TEXT    CHECK (variant IN ('first', 'follow')),
  letter_id    TEXT,
  flight_id    TEXT,
  personalized INTEGER NOT NULL DEFAULT 0 CHECK (personalized IN (0, 1)),
  created_at   INTEGER NOT NULL,
  started_at   INTEGER,
  UNIQUE (event_id, user_id)
) STRICT;
CREATE INDEX central_bot_deliveries_due ON central_bot_deliveries (state, not_before);
CREATE INDEX central_bot_deliveries_player ON central_bot_deliveries (bot_id, user_id, state);

-- Letters of players to a bot and their processing state (SPEC 10.9): answered only once the
-- reply has been generated and has really taken off.
CREATE TABLE central_bot_inbox (
  letter_id   TEXT    PRIMARY KEY,
  bot_id      TEXT    NOT NULL REFERENCES central_bots (id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  state       TEXT    NOT NULL CHECK (state IN ('in_flight', 'arrived', 'answered')),
  arrived_at  INTEGER,
  answered_by TEXT
) STRICT;
CREATE INDEX central_bot_inbox_open ON central_bot_inbox (bot_id, user_id, state);

-- Aggregated counters per bot and UTC day (overview: all time and last 30 days).
CREATE TABLE central_bot_stats (
  bot_id    TEXT    NOT NULL REFERENCES central_bots (id) ON DELETE CASCADE,
  day       TEXT    NOT NULL,
  sent      INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  read      INTEGER NOT NULL DEFAULT 0,
  replies   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bot_id, day)
) STRICT;

-- Access to the control centre: independent of the admin panel (own password, own sessions).
CREATE TABLE bots_admin (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  credential_id        TEXT    NOT NULL,
  opaque_record        TEXT    NOT NULL,
  must_change_password INTEGER NOT NULL CHECK (must_change_password IN (0, 1))
) STRICT;

CREATE TABLE bots_admin_sessions (
  token_hash   BLOB    PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
) STRICT;
