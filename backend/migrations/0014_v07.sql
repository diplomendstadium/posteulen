-- Version 0.7: Gutscheine für Gold oder eine Eule (Adminpanel, SPEC 13). Einmal einlösbar,
-- 90 Tage gültig. Gespeichert wird der Code nur als HMAC mit Server-Geheimnis und die letzten
-- vier Zeichen zur Unterscheidung; wer einen Gutschein eingelöst hat, wird nicht gespeichert.
CREATE TABLE vouchers (
  id          TEXT    PRIMARY KEY,
  hmac        BLOB    NOT NULL UNIQUE,
  hint        TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('gold', 'owl')),
  -- Gold in Zehnteln (1–1000) bzw. die Art der Eule ('random' = zufällig).
  gold        INTEGER CHECK (gold IS NULL OR gold BETWEEN 1 AND 1000),
  species     TEXT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  redeemed    INTEGER NOT NULL DEFAULT 0 CHECK (redeemed IN (0, 1)),
  CHECK ((kind = 'gold') = (gold IS NOT NULL) AND (kind = 'owl') = (species IS NOT NULL))
) STRICT;
CREATE INDEX vouchers_expires ON vouchers (expires_at);
