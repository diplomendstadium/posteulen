-- Version 0.3: Spendenbitte alle 5 Wochen (drei Texte reihum).

-- Wie viele Spendenbitten das Konto schon bekommen hat; bestimmt den nächsten Text.
ALTER TABLE users ADD COLUMN donation_count INTEGER NOT NULL DEFAULT 0
  CHECK (donation_count >= 0);
