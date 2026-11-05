-- Stufe 4: Leiheulen, Küken, Rundnachrichten.

-- Gelege: Küken einer Brut, Benenn- und Verschenkfrist (SPEC 9.9).
CREATE TABLE clutches (
  id            TEXT    PRIMARY KEY,
  owner_id      TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  species       TEXT    NOT NULL,
  hatched_at    INTEGER NOT NULL,
  -- open: one chick must still be given away; sent: done (by the holder or by lot);
  -- none: only one chick; kept: no active human contacts, all chicks stay.
  gift_state    TEXT    NOT NULL CHECK (gift_state IN ('open', 'sent', 'none', 'kept'))
) STRICT;
CREATE INDEX clutches_owner ON clutches (owner_id);

ALTER TABLE owls ADD COLUMN clutch_id TEXT REFERENCES clutches (id) ON DELETE SET NULL;
ALTER TABLE owls ADD COLUMN hatched_at INTEGER;

-- Tagesangebot der Menagerie (SPEC 9.6): drei Arten je UTC-Tag.
CREATE TABLE menagerie_offers (
  day     TEXT PRIMARY KEY,
  species TEXT NOT NULL
) STRICT;

-- Rundnachrichten des Admins (SPEC 13 Punkt 6).
CREATE TABLE broadcasts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  text       TEXT    NOT NULL
) STRICT;
