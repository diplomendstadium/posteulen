-- v1.1: letters written in the Christmas season (first Sunday of Advent to 26 December, local
-- time at the sender's home) keep their Christmas parchment for good (SPEC 8.4, 9.11).
ALTER TABLE letters ADD COLUMN christmas INTEGER NOT NULL DEFAULT 0 CHECK (christmas IN (0, 1));

-- v1.1: the loan offer of a day is one of four teams (SPEC 9.6); the team of the day before is
-- left out. Offers from before the update have no team.
ALTER TABLE menagerie_user_offers ADD COLUMN team TEXT;

-- v1.1: accounts created through the onion service (admin statistics, SPEC 13, 16.5). Accounts
-- from before the update count as created on the normal domain.
ALTER TABLE users ADD COLUMN via_onion INTEGER NOT NULL DEFAULT 0 CHECK (via_onion IN (0, 1));
