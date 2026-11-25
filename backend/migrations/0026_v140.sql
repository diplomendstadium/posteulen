-- v1.4.0: holiday mode, bored owls, lending to the post office once per quarter, all chicks of
-- a clutch given away at the limit, the escape picture (SPEC 8.10, 9.2.3, 9.2.9, 9.7, 9.9, 9.12).

-- The owls table gets the new state 'vacation' (on holiday at the owl care station on
-- Inchlonaig). SQLite cannot change a CHECK constraint, so the table is rebuilt. With foreign
-- keys on, DROP TABLE first deletes every owl and with it all rows that refer to owls (ON DELETE
-- CASCADE, in flights SET NULL). Those rows are kept aside and put back afterwards.
CREATE TEMP TABLE keep_flight_owls AS SELECT id, owl_id FROM flights WHERE owl_id IS NOT NULL;
CREATE TEMP TABLE keep_owl_away AS SELECT owl_id, since_at, until_at FROM owl_away;
CREATE TEMP TABLE keep_owl_care_days AS SELECT owl_id, day FROM owl_care_days;
CREATE TEMP TABLE keep_owl_unready AS SELECT owl_id, since_at, until_at FROM owl_unready;
CREATE TEMP TABLE keep_rescue_cases AS
SELECT owl_id, needed, done, admitted_at, medicine_on, feed_on, snack_on, pet_on, water_on
  FROM rescue_cases;

CREATE TABLE owls_new (
  id               TEXT    PRIMARY KEY,
  owner_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind             TEXT    NOT NULL CHECK (kind IN ('own', 'loan', 'bot')),
  species          TEXT    NOT NULL,
  sex              TEXT    NOT NULL CHECK (sex IN ('f', 'm')),
  -- NULL until the owner has named it (mandatory dialog after buying, SPEC 9.2.3).
  name             TEXT,
  energy           REAL    NOT NULL CHECK (energy >= 0),
  energy_at        INTEGER NOT NULL,
  -- 'menagerie' means lent to the post office (the name is historical), 'vacation' on holiday.
  state            TEXT    NOT NULL DEFAULT 'home'
                           CHECK (state IN ('home', 'flying', 'gift_flight', 'sick', 'self_care',
                                            'vet', 'brooding', 'menagerie', 'vacation')),
  state_until      INTEGER,
  is_chick         INTEGER NOT NULL DEFAULT 0 CHECK (is_chick IN (0, 1)),
  adult_at         INTEGER,
  owned_since      TEXT    NOT NULL,
  renamed_year     INTEGER,
  fed_on           TEXT,
  petted_on        TEXT,
  pending_sickness INTEGER NOT NULL DEFAULT 0 CHECK (pending_sickness IN (0, 1)),
  loan_expires_at  INTEGER,
  created_at       INTEGER NOT NULL,
  clutch_id        TEXT    REFERENCES clutches (id) ON DELETE SET NULL,
  hatched_at       INTEGER,
  motivation       INTEGER NOT NULL DEFAULT 10 CHECK (motivation BETWEEN 8 AND 12),
  watered_on       TEXT,
  snacked_on       TEXT,
  cared_at         INTEGER,
  km_flown         REAL    NOT NULL DEFAULT 0 CHECK (km_flown >= 0),
  globe_announced  INTEGER NOT NULL DEFAULT 0 CHECK (globe_announced IN (0, 1)),
  mate_met         INTEGER NOT NULL DEFAULT 0 CHECK (mate_met IN (0, 1)),
  moon_announced   INTEGER NOT NULL DEFAULT 0 CHECK (moon_announced IN (0, 1)),
  crown_announced  INTEGER NOT NULL DEFAULT 0 CHECK (crown_announced IN (0, 1)),
  -- Bored owls (9.2.9): time without a return from people in ms, added up once a day from
  -- idle_at on (NULL: from the next daily count on), and when the boredom was announced.
  idle_ms          INTEGER NOT NULL DEFAULT 0 CHECK (idle_ms >= 0),
  idle_at          INTEGER,
  bored_at         INTEGER,
  -- Calendar quarter of the last loan to the post office, e.g. 2026-4 (9.7).
  lent_quarter     TEXT
) STRICT;

INSERT INTO owls_new (id, owner_id, kind, species, sex, name, energy, energy_at, state, state_until,
                      is_chick, adult_at, owned_since, renamed_year, fed_on, petted_on,
                      pending_sickness, loan_expires_at, created_at, clutch_id, hatched_at,
                      motivation, watered_on, snacked_on, cared_at, km_flown, globe_announced,
                      mate_met, moon_announced, crown_announced)
SELECT id, owner_id, kind, species, sex, name, energy, energy_at, state, state_until, is_chick,
       adult_at, owned_since, renamed_year, fed_on, petted_on, pending_sickness, loan_expires_at,
       created_at, clutch_id, hatched_at, motivation, watered_on, snacked_on, cared_at, km_flown,
       globe_announced, mate_met, moon_announced, crown_announced
  FROM owls;

DROP TABLE owls;
ALTER TABLE owls_new RENAME TO owls;
CREATE INDEX owls_owner ON owls (owner_id);

INSERT OR IGNORE INTO owl_away (owl_id, since_at, until_at)
SELECT owl_id, since_at, until_at FROM keep_owl_away;
INSERT OR IGNORE INTO owl_care_days (owl_id, day) SELECT owl_id, day FROM keep_owl_care_days;
INSERT OR IGNORE INTO owl_unready (owl_id, since_at, until_at)
SELECT owl_id, since_at, until_at FROM keep_owl_unready;
INSERT OR IGNORE INTO rescue_cases (owl_id, needed, done, admitted_at, medicine_on, feed_on,
                                    snack_on, pet_on, water_on)
SELECT owl_id, needed, done, admitted_at, medicine_on, feed_on, snack_on, pet_on, water_on
  FROM keep_rescue_cases;
UPDATE flights SET owl_id = (SELECT owl_id FROM keep_flight_owls WHERE keep_flight_owls.id = flights.id)
 WHERE id IN (SELECT id FROM keep_flight_owls);

DROP TABLE keep_flight_owls;
DROP TABLE keep_owl_away;
DROP TABLE keep_owl_care_days;
DROP TABLE keep_owl_unready;
DROP TABLE keep_rescue_cases;

-- Owls lent right now count for the quarter in which their loan began (9.7).
UPDATE owls
   SET lent_quarter = strftime('%Y', (state_until - 7 * 86400000) / 1000, 'unixepoch') || '-' ||
                      ((CAST(strftime('%m', (state_until - 7 * 86400000) / 1000, 'unixepoch') AS INTEGER) + 2) / 3)
 WHERE state = 'menagerie' AND state_until IS NOT NULL;

-- Holidays (8.10, 9.12): planned, running, over or cancelled before they began. Cancelled ones
-- do not count towards the three a year.
CREATE TABLE vacations (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  state      TEXT    NOT NULL CHECK (state IN ('planned', 'active', 'done', 'cancelled')),
  ended_at   INTEGER,
  -- The day inactivity counted from when the holiday began (last active day or an older
  -- holiday's reference), to work out the new reference at its end (9.10).
  active_ref TEXT,
  created_at INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
) STRICT;
CREATE INDEX vacations_user ON vacations (user_id, state);

-- The trip of an owl on holiday: straight from (from_lat, from_lon) at out_at towards the island,
-- from (back_lat, back_lon) at back_at straight home, at home at home_at (9.12).
CREATE TABLE owl_vacations (
  owl_id    TEXT    PRIMARY KEY REFERENCES owls (id) ON DELETE CASCADE,
  user_id   TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_lat  REAL    NOT NULL,
  from_lon  REAL    NOT NULL,
  out_at    INTEGER NOT NULL,
  speed_kmh REAL    NOT NULL CHECK (speed_kmh > 0),
  back_lat  REAL    NOT NULL,
  back_lon  REAL    NOT NULL,
  back_at   INTEGER NOT NULL,
  home_lat  REAL    NOT NULL,
  home_lon  REAL    NOT NULL,
  home_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX owl_vacations_user ON owl_vacations (user_id);

-- Inactivity (9.10) counts from the later of the last active day and this day: a holiday does
-- not count as days away. While a holiday runs it is its end.
ALTER TABLE users ADD COLUMN idle_ref TEXT;
-- The weekly system message while a player has the most owls (9.2.3).
ALTER TABLE users ADD COLUMN owl_limit_notice_at INTEGER;

-- At the limit all chicks of a clutch must be given away, not only one (9.9).
ALTER TABLE clutches ADD COLUMN gift_all INTEGER NOT NULL DEFAULT 0 CHECK (gift_all IN (0, 1));

-- An owl that flew off into freedom is shown once like a homecoming, with its freedom picture.
ALTER TABLE homecomings ADD COLUMN kind TEXT NOT NULL DEFAULT 'home' CHECK (kind IN ('home', 'freedom'));
