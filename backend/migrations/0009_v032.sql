-- Version 0.3.2: Leiheulen pro Angebotstag statt insgesamt.
-- Welche Arten ein Konto an welchem Tag (UTC, wie das Angebot) schon geliehen hat. Jede
-- angebotene Art einmal pro Tag; ältere Tage werden beim nächsten Leihen gelöscht.
CREATE TABLE loan_days (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  species TEXT NOT NULL,
  PRIMARY KEY (user_id, day, species)
) STRICT;

-- Heute schon geliehene Eulen zählen mit (sonst ginge eine Art heute ein zweites Mal).
INSERT OR IGNORE INTO loan_days (user_id, day, species)
  SELECT owner_id, strftime('%Y-%m-%d', created_at / 1000, 'unixepoch'), species
    FROM owls WHERE kind = 'loan';
