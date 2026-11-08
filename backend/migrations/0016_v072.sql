-- Version 0.7.2
-- 1. Bots werden nur einmal je Konto angelegt. Bisher legte der Start Bots für jedes Konto ohne
--    Bots neu an – auch für Konten, die alle Bots entfernt hatten. Alle bestehenden Konten haben
--    ihre Bots schon bekommen.
ALTER TABLE users ADD COLUMN bots_created INTEGER NOT NULL DEFAULT 0 CHECK (bots_created IN (0, 1));
UPDATE users SET bots_created = 1;
-- 2. „Alle Briefe verbrennen“ entfernte bisher auch Briefe, die noch unterwegs waren; kamen sie an,
--    zählten sie als ungelesen, waren aber unsichtbar. Zähler aus den sichtbaren Briefen neu berechnen.
UPDATE chats SET unread = (SELECT COUNT(*) FROM letters
                            WHERE recipient_id = chats.owner_id AND sender_id = chats.peer_id
                              AND status = 'delivered' AND read = 0 AND recipient_has = 1);
-- 3. Heimkehr eigener Eulen nur noch als Einblendung (nicht mehr im Systemchat): offene Heimkehren,
--    bis die App sie gezeigt hat.
CREATE TABLE homecomings (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  owl_name   TEXT    NOT NULL,
  species    TEXT    NOT NULL,
  letters    INTEGER NOT NULL DEFAULT 0 CHECK (letters >= 0),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX homecomings_user ON homecomings (user_id, created_at);
