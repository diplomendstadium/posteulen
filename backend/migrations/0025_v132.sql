-- v1.3.2: the moon (from 384400 km) and the crown (from 1000000 km) after the names of own owls
-- (SPEC 9.2.1), each announced once with a system message like the globe.
ALTER TABLE owls ADD COLUMN moon_announced INTEGER NOT NULL DEFAULT 0 CHECK (moon_announced IN (0, 1));
ALTER TABLE owls ADD COLUMN crown_announced INTEGER NOT NULL DEFAULT 0 CHECK (crown_announced IN (0, 1));

-- v1.3.2: the names of a day's loan offer keep the language they were first rolled in (SPEC 9.6).
-- Offers from before get the language of the account on their next request.
ALTER TABLE menagerie_user_offers ADD COLUMN language TEXT CHECK (language IS NULL OR language IN ('de', 'en'));
