-- Stufe 5: Bots (Erklärbär, Tante, Onkel) und KI-Anbindung.

CREATE TABLE bots (
  id                  TEXT    PRIMARY KEY,
  owner_id            TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                TEXT    NOT NULL CHECK (type IN ('explainer', 'aunt', 'uncle')),
  first_name          TEXT,
  home_lat            INTEGER NOT NULL,
  home_lon            INTEGER NOT NULL,
  -- The uncle appears only after his first letter has arrived (SPEC 10.1).
  in_addressbook      INTEGER NOT NULL CHECK (in_addressbook IN (0, 1)),
  last_user_letter_at INTEGER,
  -- Fixed letters and gold already sent (comma-separated keys; idempotent events, SPEC 17.2).
  fixed_sent          TEXT    NOT NULL DEFAULT '',
  UNIQUE (owner_id, type)
) STRICT;

-- Letters and gold of a bot on the way to its user (bot owls are not shown on the map).
CREATE TABLE bot_shipments (
  id         TEXT    PRIMARY KEY,
  bot_id     TEXT    NOT NULL REFERENCES bots (id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  letter_id  TEXT,
  gold       INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  arrives_at INTEGER NOT NULL
) STRICT;

-- A reply that is due (2 hours after arrival) or postponed (daily limit, error).
CREATE TABLE bot_jobs (
  letter_id TEXT    PRIMARY KEY,
  bot_id    TEXT    NOT NULL REFERENCES bots (id) ON DELETE CASCADE,
  due_at    INTEGER NOT NULL,
  attempts  INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX bot_jobs_due ON bot_jobs (due_at);

-- KI-Aufrufe je UTC-Tag (Antworten und Zusammenfassungen, SPEC 10.5).
CREATE TABLE ai_usage (
  day   TEXT    PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
) STRICT;

-- Up to which letter (sent_at) the bot summary covers the conversation.
ALTER TABLE chats ADD COLUMN bot_summarized_until INTEGER;
