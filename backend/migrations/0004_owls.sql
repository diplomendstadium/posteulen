-- Stufe 3: Eulen, Flüge, Transaktionen.

CREATE TABLE owls (
  id               TEXT    PRIMARY KEY,
  owner_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind             TEXT    NOT NULL CHECK (kind IN ('own', 'loan', 'bot')),
  species          TEXT    NOT NULL,
  sex              TEXT    NOT NULL CHECK (sex IN ('f', 'm')),
  -- NULL until the owner has named it (mandatory dialog after buying, SPEC 9.2.3).
  name             TEXT,
  energy           REAL    NOT NULL CHECK (energy >= 0),
  energy_at        INTEGER NOT NULL,
  state            TEXT    NOT NULL DEFAULT 'home'
                           CHECK (state IN ('home', 'flying', 'gift_flight', 'sick', 'self_care',
                                            'vet', 'brooding', 'papeterie')),
  state_until      INTEGER,
  is_chick         INTEGER NOT NULL DEFAULT 0 CHECK (is_chick IN (0, 1)),
  adult_at         INTEGER,
  owned_since      TEXT    NOT NULL,
  renamed_year     INTEGER,
  fed_on           TEXT,
  petted_on        TEXT,
  care_mask        INTEGER NOT NULL DEFAULT 0,
  care_mask_day    TEXT,
  pending_sickness INTEGER NOT NULL DEFAULT 0 CHECK (pending_sickness IN (0, 1)),
  loan_expires_at  INTEGER,
  created_at       INTEGER NOT NULL
) STRICT;
CREATE INDEX owls_owner ON owls (owner_id);

CREATE TABLE flights (
  id          TEXT    PRIMARY KEY,
  holder_id   TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- NULL for the stand-in owl of stage 3 (D-65), later for loan owls that have vanished.
  owl_id      TEXT    REFERENCES owls (id) ON DELETE SET NULL,
  owl_kind    TEXT    NOT NULL CHECK (owl_kind IN ('own', 'loan', 'stand_in', 'bot')),
  owl_name    TEXT    NOT NULL,
  owl_species TEXT    NOT NULL,
  purpose     TEXT    NOT NULL CHECK (purpose IN ('letter', 'gold', 'gift')),
  gold        INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  gold_state  TEXT    NOT NULL DEFAULT 'none'
                      CHECK (gold_state IN ('none', 'carried', 'delivered', 'returning', 'refunded')),
  -- JSON: speed, maximum energy, mode (shared/game/flight.ts FlightProfile).
  profile     TEXT    NOT NULL,
  -- JSON: stops with user, place, type (deliver/home), status and expected arrival.
  route       TEXT    NOT NULL,
  -- JSON: segment list (SPEC 9.4.3).
  plan        TEXT    NOT NULL,
  started_at  INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  state       TEXT    NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'done'))
) STRICT;
CREATE INDEX flights_holder ON flights (holder_id, state);
CREATE INDEX flights_owl ON flights (owl_id);

ALTER TABLE letters ADD COLUMN flight_id TEXT;
CREATE INDEX letters_flight ON letters (flight_id);

-- Arrival image of a delivery without a letter has been shown (SPEC 9.2.6).
ALTER TABLE system_messages ADD COLUMN arrival_shown INTEGER NOT NULL DEFAULT 0
  CHECK (arrival_shown IN (0, 1));

CREATE TABLE transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  at                INTEGER NOT NULL,
  type              TEXT    NOT NULL,
  amount            INTEGER NOT NULL,
  counterpart_id    TEXT,
  counterpart_label TEXT
) STRICT;
CREATE INDEX transactions_user ON transactions (user_id, at);
