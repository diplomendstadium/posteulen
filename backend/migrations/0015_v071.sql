-- Version 0.7.1: kurze, unverschlüsselte Nachrichten der Nutzer an den Admin (Einstellungen,
-- SPEC 8.10, 13). Gespeichert ohne Absender; gelöscht 90 Tage nach dem Eingang. Am Konto steht
-- nur der UTC-Tag der letzten Nachricht (eine Nachricht pro Kalendertag).
CREATE TABLE feedback (
  id         TEXT    PRIMARY KEY,
  text       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX feedback_created ON feedback (created_at);
ALTER TABLE users ADD COLUMN feedback_sent_on TEXT;
