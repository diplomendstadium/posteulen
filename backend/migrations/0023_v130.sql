-- v1.3.0: the owl rescue centre (SPEC 8.13, 9.8). A sick own owl is in the rescue centre until
-- it has had the interactions it needs (5 to 20, rolled on admission). Each kind of interaction
-- counts once a day – the day of the last time is kept per kind.
CREATE TABLE rescue_cases (
  owl_id      TEXT    PRIMARY KEY REFERENCES owls (id) ON DELETE CASCADE,
  needed      INTEGER NOT NULL CHECK (needed >= 1),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done >= 0),
  admitted_at INTEGER NOT NULL,
  medicine_on TEXT,
  feed_on     TEXT,
  snack_on    TEXT,
  pet_on      TEXT,
  water_on    TEXT
) STRICT;

-- Three wild sick owls per account (species, sex and name rolled). A healed one keeps its
-- slot until the player finds out where it flies (stays: 1 joins as a post owl, 0 flies off).
CREATE TABLE rescue_wild (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL CHECK (slot >= 0),
  species     TEXT    NOT NULL,
  sex         TEXT    NOT NULL CHECK (sex IN ('f', 'm')),
  name        TEXT    NOT NULL,
  needed      INTEGER NOT NULL CHECK (needed >= 1),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done >= 0),
  created_at  INTEGER NOT NULL,
  medicine_on TEXT,
  feed_on     TEXT,
  snack_on    TEXT,
  pet_on      TEXT,
  water_on    TEXT,
  healed_at   INTEGER,
  stays       INTEGER CHECK (stays IN (0, 1)),
  UNIQUE (user_id, slot)
) STRICT;

-- Owls being nursed or at the vet when the update comes: healthy at once (they were paid for).
UPDATE owl_away SET until_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
 WHERE until_at IS NULL AND owl_id IN (SELECT id FROM owls WHERE state = 'vet');
UPDATE owls SET state = 'home', state_until = NULL,
       energy_at = CASE WHEN state = 'vet' THEN CAST(unixepoch('subsec') * 1000 AS INTEGER) ELSE energy_at END
 WHERE state IN ('self_care', 'vet');

-- The phoenix never falls ill.
UPDATE owls SET state = 'home' WHERE species = 'phoenix' AND state = 'sick';
UPDATE owls SET pending_sickness = 0 WHERE species = 'phoenix';

-- Untreated sick owls go to the rescue centre with 0 per cent.
INSERT INTO rescue_cases (owl_id, needed, admitted_at)
SELECT id, 5 + (abs(random()) % 16), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  FROM owls WHERE state = 'sick';

-- v1.3.0: statistics of an account (SPEC 8.10). Counted from the update on – stored letters
-- and flights are counted once at the next start (backend/src/accounts/stats.ts, meta key
-- stats_backfill). Interactions by kind, kilometres of own and loan owls between people.
CREATE TABLE user_stats (
  user_id          TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  since            TEXT    NOT NULL,
  letters_sent     INTEGER NOT NULL DEFAULT 0,
  letters_received INTEGER NOT NULL DEFAULT 0,
  active_days      INTEGER NOT NULL DEFAULT 0,
  km_human         REAL    NOT NULL DEFAULT 0,
  water            INTEGER NOT NULL DEFAULT 0,
  pet              INTEGER NOT NULL DEFAULT 0,
  feed             INTEGER NOT NULL DEFAULT 0,
  snack            INTEGER NOT NULL DEFAULT 0,
  medicine         INTEGER NOT NULL DEFAULT 0
) STRICT;

-- The last days of an account for the rule on giving gold and owls (SPEC 9.1.5): active, a
-- letter to a person sent, a letter from a person received. Only the days, never with whom;
-- older than 15 days deleted at 04:00.
CREATE TABLE activity_days (
  user_id        TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day            TEXT    NOT NULL,
  active         INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  sent_human     INTEGER NOT NULL DEFAULT 0 CHECK (sent_human IN (0, 1)),
  received_human INTEGER NOT NULL DEFAULT 0 CHECK (received_human IN (0, 1)),
  PRIMARY KEY (user_id, day)
) STRICT;

-- UTC day of the last gift of gold or an owl (chicks that must be given away do not count).
ALTER TABLE users ADD COLUMN last_gift_day TEXT;

-- ASCII mode (SPEC 8.10): the letter editor offers a plain monospaced font for one letter.
ALTER TABLE users ADD COLUMN ascii_mode INTEGER NOT NULL DEFAULT 0 CHECK (ascii_mode IN (0, 1));

-- The system message about the 🌍 badge (more than 40 030 km) was sent for this owl.
ALTER TABLE owls ADD COLUMN globe_announced INTEGER NOT NULL DEFAULT 0 CHECK (globe_announced IN (0, 1));

-- Existing accounts count from the day of the update.
INSERT INTO user_stats (user_id, since) SELECT id, date('now') FROM users;

-- Counting by triggers, so every way a letter is written or delivered counts alike (people,
-- bots, cover letters). Letters of bots have no users row as sender or recipient.
CREATE TRIGGER stats_user_created AFTER INSERT ON users
BEGIN
  INSERT OR IGNORE INTO user_stats (user_id, since, active_days) VALUES (NEW.id, NEW.last_active_date, 1);
  INSERT OR IGNORE INTO activity_days (user_id, day, active) VALUES (NEW.id, NEW.last_active_date, 1);
END;

CREATE TRIGGER stats_active_day AFTER UPDATE OF last_active_date ON users
WHEN NEW.last_active_date <> OLD.last_active_date
BEGIN
  UPDATE user_stats SET active_days = active_days + 1 WHERE user_id = NEW.id;
  INSERT INTO activity_days (user_id, day, active) VALUES (NEW.id, NEW.last_active_date, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET active = 1;
END;

CREATE TRIGGER stats_letter_written AFTER INSERT ON letters
BEGIN
  UPDATE user_stats SET letters_sent = letters_sent + 1 WHERE user_id = NEW.sender_id;
  INSERT INTO activity_days (user_id, day, sent_human)
  SELECT NEW.sender_id, strftime('%Y-%m-%d', NEW.sent_at / 1000, 'unixepoch'), 1
   WHERE NEW.kind = 'letter'
     AND EXISTS (SELECT 1 FROM users WHERE id = NEW.sender_id)
     AND EXISTS (SELECT 1 FROM users WHERE id = NEW.recipient_id)
  ON CONFLICT (user_id, day) DO UPDATE SET sent_human = 1;
END;

CREATE TRIGGER stats_letter_delivered_at_once AFTER INSERT ON letters
WHEN NEW.status = 'delivered'
BEGIN
  UPDATE user_stats SET letters_received = letters_received + 1 WHERE user_id = NEW.recipient_id;
END;

CREATE TRIGGER stats_letter_delivered AFTER UPDATE OF status ON letters
WHEN NEW.status = 'delivered' AND OLD.status <> 'delivered'
BEGIN
  UPDATE user_stats SET letters_received = letters_received + 1 WHERE user_id = NEW.recipient_id;
  INSERT INTO activity_days (user_id, day, received_human)
  SELECT NEW.recipient_id, strftime('%Y-%m-%d', NEW.arrives_at / 1000, 'unixepoch'), 1
   WHERE NEW.kind = 'letter'
     AND EXISTS (SELECT 1 FROM users WHERE id = NEW.recipient_id)
     AND EXISTS (SELECT 1 FROM users WHERE id = NEW.sender_id)
  ON CONFLICT (user_id, day) DO UPDATE SET received_human = 1;
END;
