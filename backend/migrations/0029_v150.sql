-- v1.5.0: the look of chicks, the daily notice about a chick to give away and the milestones of
-- letters between people (SPEC 9.2.6, 9.9, 11.1).

-- The look of a chick: 0 the standard chick picture of its species, 1 the second, 2 the third.
-- Existing chicks of a player and species take the looks in turn in the order of ownership.
ALTER TABLE owls ADD COLUMN chick_look INTEGER NOT NULL DEFAULT 0 CHECK (chick_look IN (0, 1, 2));
UPDATE owls
   SET chick_look = (SELECT (n - 1) % 3 FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, species
                                                                         ORDER BY owned_since, created_at, id) AS n
                                                FROM owls
                                               WHERE kind = 'own' AND is_chick = 1 AND state != 'gift_flight') AS ranked
                      WHERE ranked.id = owls.id)
 WHERE kind = 'own' AND is_chick = 1 AND state != 'gift_flight';

-- UTC day on which the player last saw the big notice about a chick to give away (once a day).
ALTER TABLE clutches ADD COLUMN notice_on TEXT;
