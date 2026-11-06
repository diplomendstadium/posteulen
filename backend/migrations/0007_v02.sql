-- Version 0.2: Umzüge pro Kalendermonat, Löschfrist für Briefe, neue Pflegeregel,
-- „Papeterie“ heißt jetzt überall „Menagerie“.

-- Umzüge (7.3): höchstens 3 pro Kalendermonat (UTC). Gezählt wird nur im laufenden Monat.
ALTER TABLE users ADD COLUMN home_moves_month TEXT;
ALTER TABLE users ADD COLUMN home_moves_count INTEGER NOT NULL DEFAULT 0
  CHECK (home_moves_count >= 0);

-- Löschfrist (8.4): eigene Briefkopien und Systemnachrichten nach so vielen Tagen löschen.
ALTER TABLE users ADD COLUMN letter_retention_days INTEGER NOT NULL DEFAULT 365
  CHECK (letter_retention_days IN (30, 90, 180, 365));
-- Briefe in Druckschrift statt Handschrift anzeigen (reine Anzeige-Einstellung).
ALTER TABLE users ADD COLUMN letters_print INTEGER NOT NULL DEFAULT 0
  CHECK (letters_print IN (0, 1));

-- Neuaufbau der Eulentabelle: Zustand 'papeterie' heißt 'menagerie', die 14-Tage-Bitmaske
-- entfällt. DROP TABLE löst bei aktiven Fremdschlüsseln ON DELETE SET NULL in `flights` aus;
-- die Zuordnung Flug → Eule wird deshalb vorher gesichert und danach wiederhergestellt.
CREATE TEMP TABLE flight_owls AS SELECT id, owl_id FROM flights WHERE owl_id IS NOT NULL;

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
  state            TEXT    NOT NULL DEFAULT 'home'
                           CHECK (state IN ('home', 'flying', 'gift_flight', 'sick', 'self_care',
                                            'vet', 'brooding', 'menagerie')),
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
  hatched_at       INTEGER
) STRICT;

INSERT INTO owls_new (id, owner_id, kind, species, sex, name, energy, energy_at, state, state_until,
                      is_chick, adult_at, owned_since, renamed_year, fed_on, petted_on,
                      pending_sickness, loan_expires_at, created_at, clutch_id, hatched_at)
SELECT id, owner_id, kind, species, sex, name, energy, energy_at,
       CASE state WHEN 'papeterie' THEN 'menagerie' ELSE state END, state_until,
       is_chick, adult_at, owned_since, renamed_year, fed_on, petted_on,
       pending_sickness, loan_expires_at, created_at, clutch_id, hatched_at
  FROM owls;

-- Pflegetage (9.3): je Eule die Tage, an denen sie gestreichelt oder gefüttert wurde. Übernommen
-- aus der alten Bitmaske (Bit n = n Tage vor care_mask_day).
CREATE TEMP TABLE care_days_old AS
WITH RECURSIVE bit (n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM bit WHERE n < 13)
SELECT owls.id AS owl_id, date(owls.care_mask_day, '-' || bit.n || ' days') AS day
  FROM owls JOIN bit ON (owls.care_mask >> bit.n) & 1 = 1
 WHERE owls.care_mask_day IS NOT NULL;

DROP TABLE owls;
ALTER TABLE owls_new RENAME TO owls;
CREATE INDEX owls_owner ON owls (owner_id);

UPDATE flights SET owl_id = (SELECT owl_id FROM flight_owls WHERE flight_owls.id = flights.id)
 WHERE id IN (SELECT id FROM flight_owls);
DROP TABLE flight_owls;

CREATE TABLE owl_care_days (
  owl_id TEXT NOT NULL REFERENCES owls (id) ON DELETE CASCADE,
  day    TEXT NOT NULL,
  PRIMARY KEY (owl_id, day)
) STRICT, WITHOUT ROWID;
INSERT INTO owl_care_days (owl_id, day) SELECT owl_id, day FROM care_days_old;
DROP TABLE care_days_old;

-- Zeiten, in denen die Eule nicht zu Hause war (Flug, Eulenarzt, Menagerie), für die Regel
-- „Tage mit mindestens einer Stunde zu Hause“ (9.3). `until_at` ist NULL, solange sie fort ist.
-- Gespeichert werden nur die letzten Wochen (Aufräumen 04:00).
CREATE TABLE owl_away (
  owl_id   TEXT    NOT NULL REFERENCES owls (id) ON DELETE CASCADE,
  since_at INTEGER NOT NULL,
  until_at INTEGER,
  PRIMARY KEY (owl_id, since_at)
) STRICT, WITHOUT ROWID;
-- Eulen, die gerade fort sind: Beginn ist der Zeitpunkt des Abflugs bzw. der Abgabe, an dem
-- die Energie zuletzt festgehalten wurde.
INSERT INTO owl_away (owl_id, since_at)
SELECT id, energy_at FROM owls WHERE state IN ('flying', 'gift_flight', 'vet', 'menagerie');

-- Neue Namen für gespeicherte Typen.
UPDATE transactions SET type = 'menagerie_wage' WHERE type = 'papeterie_wage';
UPDATE system_messages SET type = 'menagerie_done' WHERE type = 'papeterie_done';
UPDATE scheduled_events SET type = 'menagerie_end' WHERE type = 'papeterie_end';
