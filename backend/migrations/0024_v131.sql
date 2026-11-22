-- v1.3.1: the pouch (SPEC 9.1.6): owl biscuits and treats a player got from a bot or a voucher.
-- While there are some left, feeding or giving a snack costs nothing and takes one from it.
ALTER TABLE users ADD COLUMN bag_biscuits INTEGER NOT NULL DEFAULT 0 CHECK (bag_biscuits >= 0);
ALTER TABLE users ADD COLUMN bag_treats INTEGER NOT NULL DEFAULT 0 CHECK (bag_treats >= 0);

-- v1.3.1: privileged players (SPEC 9.1.7, 13): endless gold and no limits on giving, set by the
-- admin for good (until_at NULL) or until a point in time. The balance underneath stays as it
-- was; it counts again once the privilege ends.
CREATE TABLE privileged_users (
  user_id    TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  since_at   INTEGER NOT NULL,
  until_at   INTEGER,
  CHECK (until_at IS NULL OR until_at > since_at)
) STRICT;

-- A gold transfer of a privileged player cost nothing: if the owl brings the gold back, it is
-- not refunded either.
ALTER TABLE flights ADD COLUMN gold_paid INTEGER NOT NULL DEFAULT 1 CHECK (gold_paid IN (0, 1));

-- The sex of the owl that carries the flight (for the AI reply to a letter, SPEC 10.5).
ALTER TABLE flights ADD COLUMN owl_sex TEXT CHECK (owl_sex IS NULL OR owl_sex IN ('f', 'm'));
UPDATE flights SET owl_sex = (SELECT sex FROM owls WHERE owls.id = flights.owl_id)
 WHERE owl_id IS NOT NULL;

-- v1.3.1: pairs (SPEC 9.9). Times an own owl was at home but not ready – sick (in the rescue
-- centre) or brooding; with the absences (owl_away) they give the hours an owl was ready at
-- home. Kept as long as the absences (cleanup 04:00).
CREATE TABLE owl_unready (
  owl_id   TEXT    NOT NULL REFERENCES owls (id) ON DELETE CASCADE,
  since_at INTEGER NOT NULL,
  until_at INTEGER,
  PRIMARY KEY (owl_id, since_at)
) STRICT, WITHOUT ROWID;
INSERT OR IGNORE INTO owl_unready (owl_id, since_at)
SELECT owl_id, admitted_at FROM rescue_cases;
INSERT OR IGNORE INTO owl_unready (owl_id, since_at)
SELECT id, state_until - 7 * 86400000 FROM owls WHERE state = 'brooding' AND state_until IS NOT NULL;

-- A female owl rested at least two hours at a recipient while a male of her species was ready
-- at home there; counts at her next return home.
ALTER TABLE owls ADD COLUMN mate_met INTEGER NOT NULL DEFAULT 0 CHECK (mate_met IN (0, 1));

-- Bots of the control centre can put owl biscuits or treats into a letter (1–10, SPEC 10.8).
ALTER TABLE central_bot_events ADD COLUMN gift_biscuits INTEGER
  CHECK (gift_biscuits IS NULL OR gift_biscuits BETWEEN 1 AND 10);
ALTER TABLE central_bot_events ADD COLUMN gift_treats INTEGER
  CHECK (gift_treats IS NULL OR gift_treats BETWEEN 1 AND 10);

-- Vouchers for owl biscuits or treats (1–50, SPEC 13).
CREATE TABLE vouchers_new (
  id          TEXT    PRIMARY KEY,
  hmac        BLOB    NOT NULL UNIQUE,
  hint        TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('gold', 'owl', 'biscuits', 'treats')),
  gold        INTEGER CHECK (gold IS NULL OR gold BETWEEN 1 AND 1000),
  species     TEXT,
  count       INTEGER CHECK (count IS NULL OR count BETWEEN 1 AND 50),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  redeemed    INTEGER NOT NULL DEFAULT 0 CHECK (redeemed IN (0, 1)),
  CHECK ((kind = 'gold') = (gold IS NOT NULL)),
  CHECK ((kind = 'owl') = (species IS NOT NULL)),
  CHECK ((kind IN ('biscuits', 'treats')) = (count IS NOT NULL))
) STRICT;
INSERT INTO vouchers_new (id, hmac, hint, kind, gold, species, created_at, expires_at, redeemed)
SELECT id, hmac, hint, kind, gold, species, created_at, expires_at, redeemed FROM vouchers;
DROP TABLE vouchers;
ALTER TABLE vouchers_new RENAME TO vouchers;
CREATE INDEX vouchers_expires ON vouchers (expires_at);
