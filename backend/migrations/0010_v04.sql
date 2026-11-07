-- Version 0.4: Sprache des Kontos (Deutsch ist Standard, Englisch wählbar).
ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en'));
