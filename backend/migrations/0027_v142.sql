-- v1.4.2: owls only get bored once their player has had a contact with another person, and the
-- second look of owls of the same species (SPEC 9.2.6, 9.2.9).

-- When the player first had a confirmed contact with another person (NULL: never). Until then
-- the owls of the account never get bored. Existing accounts: from their contacts and letters.
ALTER TABLE users ADD COLUMN human_contact_at INTEGER;
UPDATE users
   SET human_contact_at = (SELECT MIN(since) FROM contacts
                            WHERE contacts.user_lo = users.id OR contacts.user_hi = users.id);
UPDATE users
   SET human_contact_at = (SELECT MIN(l.sent_at) FROM letters l JOIN users o ON o.id = l.recipient_id
                            WHERE l.sender_id = users.id)
 WHERE human_contact_at IS NULL;
UPDATE users
   SET human_contact_at = (SELECT MIN(l.sent_at) FROM letters l JOIN users o ON o.id = l.sender_id
                            WHERE l.recipient_id = users.id)
 WHERE human_contact_at IS NULL;

-- Owls of accounts without any human contact start again from nothing and are not bored.
UPDATE owls SET idle_ms = 0, idle_at = NULL, bored_at = NULL
 WHERE kind = 'own' AND owner_id IN (SELECT id FROM users WHERE human_contact_at IS NULL);

-- The look of an own owl: 0 the standard pictures of its species, 1 the second pictures. Every
-- second owl of a species in the order of ownership gets the second look (the phoenix has none).
ALTER TABLE owls ADD COLUMN look INTEGER NOT NULL DEFAULT 0 CHECK (look IN (0, 1));
UPDATE owls SET look = 1
 WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, species
                                                            ORDER BY owned_since, created_at, id) AS n
                                FROM owls
                               WHERE kind = 'own' AND state != 'gift_flight' AND species != 'phoenix')
               WHERE n % 2 = 0);
