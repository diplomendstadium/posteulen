-- Stufe 1: Konten, Sitzungen, Namenssperren, Einladungscodes, Admin.

CREATE TABLE users (
  id                    TEXT    PRIMARY KEY,
  name_display          TEXT    NOT NULL,
  name_key              TEXT    NOT NULL UNIQUE,
  created_on            TEXT    NOT NULL,
  state                 TEXT    NOT NULL DEFAULT 'active'
                                CHECK (state IN ('active', 'deletion_pending', 'deleting')),
  deletion_requested_at INTEGER,
  opaque_record         TEXT    NOT NULL,
  ed25519_pub           BLOB    NOT NULL CHECK (length(ed25519_pub) = 32),
  x25519_pub            BLOB    NOT NULL CHECK (length(x25519_pub) = 32),
  key_format            INTEGER NOT NULL,
  wrapped_master_key    BLOB    NOT NULL,
  private_keys          BLOB    NOT NULL,
  home_lat              INTEGER NOT NULL,
  home_lon              INTEGER NOT NULL,
  home_changed_on       TEXT    NOT NULL,
  name_changed_year     INTEGER,
  gold                  INTEGER NOT NULL,
  last_active_date      TEXT    NOT NULL,
  inactivity_warned_on  TEXT
) STRICT;

CREATE TABLE sessions (
  token_hash   BLOB    PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE name_locks (
  hmac       BLOB PRIMARY KEY,
  expires_on TEXT NOT NULL
) STRICT;

CREATE TABLE invite_codes (
  id         TEXT    PRIMARY KEY,
  hmac       BLOB    NOT NULL UNIQUE,
  hint       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE TABLE admin (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  credential_id        TEXT    NOT NULL,
  opaque_record        TEXT    NOT NULL,
  must_change_password INTEGER NOT NULL CHECK (must_change_password IN (0, 1))
) STRICT;

CREATE TABLE admin_sessions (
  token_hash   BLOB    PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
) STRICT;

CREATE TABLE stats_counters (
  key   TEXT    PRIMARY KEY,
  value INTEGER NOT NULL
) STRICT;

INSERT INTO stats_counters (key, value) VALUES ('accounts_created_total', 0);
INSERT INTO settings (key, value) VALUES ('registration_mode', 'closed');
