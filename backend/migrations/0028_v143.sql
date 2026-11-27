-- v1.4.3: the safety filter of the bots and the second factor (SPEC 10.5, 5.11).

-- The version of a letter to a bot the AI may see: without the sentences and paragraphs about
-- drugs, sexuality or violence (empty: nothing left, NULL: not filtered yet). Filtered once, when
-- the AI needs the letter for the first time.
ALTER TABLE letters ADD COLUMN ai_text TEXT;

-- The second factor of a player (subject user:<id>), of the admin panel (admin) or of the bots
-- control centre (bots). The TOTP secret is encrypted with a key from the secrets file, the
-- backup codes are a JSON list of HMACs (a used code is removed). last_step is the time step of
-- the last accepted code (each code only once).
CREATE TABLE two_factor (
  subject   TEXT    PRIMARY KEY,
  user_id   TEXT    REFERENCES users (id) ON DELETE CASCADE,
  secret    BLOB    NOT NULL,
  since     INTEGER NOT NULL,
  last_step INTEGER NOT NULL DEFAULT 0,
  backup    TEXT    NOT NULL DEFAULT '[]',
  CHECK (subject IN ('admin', 'bots') OR subject = 'user:' || user_id)
) STRICT;
