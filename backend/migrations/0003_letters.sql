-- Stufe 2: Kontakte, Tresor, Briefe, Systemnachrichten, Benachrichtigungen, Push, Warteschlange.

ALTER TABLE users ADD COLUMN contact_requests_day TEXT;
ALTER TABLE users ADD COLUMN contact_requests_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE contact_requests (
  id          TEXT    PRIMARY KEY,
  from_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_hmac BLOB    NOT NULL,
  label       TEXT    NOT NULL,
  expires_at  INTEGER NOT NULL,
  UNIQUE (from_id, target_hmac)
) STRICT;
CREATE INDEX contact_requests_target ON contact_requests (target_hmac);

CREATE TABLE contacts (
  user_lo TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_hi TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  since   INTEGER NOT NULL,
  warn_lo INTEGER NOT NULL DEFAULT 0 CHECK (warn_lo IN (0, 1)),
  warn_hi INTEGER NOT NULL DEFAULT 0 CHECK (warn_hi IN (0, 1)),
  PRIMARY KEY (user_lo, user_hi),
  CHECK (user_lo < user_hi)
) STRICT;
CREATE INDEX contacts_hi ON contacts (user_hi);

CREATE TABLE vault_entries (
  owner_id   TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  contact_id TEXT    NOT NULL,
  version    INTEGER NOT NULL CHECK (version >= 1),
  blob       TEXT    NOT NULL,
  PRIMARY KEY (owner_id, contact_id)
) STRICT;

CREATE TABLE chats (
  owner_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  peer_id          TEXT    NOT NULL,
  peer_kind        TEXT    NOT NULL CHECK (peer_kind IN ('user', 'bot')),
  last_activity_at INTEGER NOT NULL,
  unread           INTEGER NOT NULL DEFAULT 0,
  bot_summary      TEXT,
  PRIMARY KEY (owner_id, peer_id)
) STRICT;

CREATE TABLE letters (
  id             TEXT    PRIMARY KEY,
  sender_id      TEXT    NOT NULL,
  recipient_id   TEXT    NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('letter', 'cover_gold', 'cover_owl', 'cover_chick')),
  parchment      TEXT    NOT NULL CHECK (parchment IN ('small', 'large')),
  sent_at        INTEGER NOT NULL,
  arrives_at     INTEGER NOT NULL,
  ciphertext     BLOB,
  wrap_recipient BLOB,
  wrap_sender    BLOB,
  plaintext      TEXT,
  status         TEXT    NOT NULL CHECK (status IN ('in_flight', 'delivered', 'returned')),
  read           INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  arrival_seen   INTEGER NOT NULL DEFAULT 0 CHECK (arrival_seen IN (0, 1)),
  sender_has     INTEGER NOT NULL DEFAULT 1 CHECK (sender_has IN (0, 1)),
  recipient_has  INTEGER NOT NULL DEFAULT 1 CHECK (recipient_has IN (0, 1)),
  owl_name       TEXT    NOT NULL,
  owl_species    TEXT    NOT NULL,
  CHECK ((ciphertext IS NULL) != (plaintext IS NULL))
) STRICT;
CREATE INDEX letters_pair ON letters (sender_id, recipient_id);
CREATE INDEX letters_recipient ON letters (recipient_id, sender_id);

CREATE TABLE system_messages (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          TEXT    NOT NULL,
  params        TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  arrival_image TEXT,
  seen          INTEGER NOT NULL DEFAULT 0 CHECK (seen IN (0, 1))
) STRICT;
CREATE INDEX system_messages_user ON system_messages (user_id, created_at);

CREATE TABLE notifications (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  ref        TEXT,
  created_at INTEGER NOT NULL,
  push_state TEXT    NOT NULL CHECK (push_state IN ('none', 'pending', 'sent', 'failed'))
) STRICT;
CREATE INDEX notifications_user ON notifications (user_id, created_at);

CREATE TABLE push_subscriptions (
  user_id           TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  endpoint          TEXT    NOT NULL,
  p256dh            TEXT    NOT NULL,
  auth              TEXT    NOT NULL,
  created_at        INTEGER NOT NULL,
  last_confirmed_at INTEGER
) STRICT;

CREATE TABLE scheduled_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  due_at     INTEGER NOT NULL,
  logical_at INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  ref        TEXT    NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX scheduled_events_due ON scheduled_events (due_at, id);
CREATE INDEX scheduled_events_ref ON scheduled_events (type, ref);

CREATE TABLE daily_job_runs (
  job TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (job, day)
) STRICT;

CREATE TABLE stats_daily (
  day           TEXT    PRIMARY KEY,
  human_letters INTEGER NOT NULL DEFAULT 0
) STRICT;
