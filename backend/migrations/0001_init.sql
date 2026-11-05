-- Stufe 0: Grundtabellen für Betrieb und Einstellungen.

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE error_log (
  id        INTEGER PRIMARY KEY,
  at        INTEGER NOT NULL,
  component TEXT    NOT NULL,
  severity  TEXT    NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  what      TEXT    NOT NULL,
  cause     TEXT    NOT NULL,
  action    TEXT    NOT NULL,
  read      INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1))
) STRICT;

CREATE INDEX error_log_at ON error_log (at);
