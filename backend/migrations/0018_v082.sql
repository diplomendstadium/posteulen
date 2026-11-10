-- v0.8.2: links in letters clickable or not (setting of the account, SPEC 8.10) and timed
-- banners of the admin for all accounts (SPEC 13).
ALTER TABLE users ADD COLUMN links_clickable INTEGER NOT NULL DEFAULT 1 CHECK (links_clickable IN (0, 1));

CREATE TABLE banners (
  id         TEXT    PRIMARY KEY,
  text_de    TEXT    NOT NULL,
  text_en    TEXT    NOT NULL DEFAULT '',
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
) STRICT;
CREATE INDEX banners_end ON banners (ends_at);
