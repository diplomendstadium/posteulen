-- Version 0.5.1: Zeitpunkt der letzten Pflege-Aktion. Innerhalb von zehn Minuten danach zeigt
-- die Eulenübersicht immer das normale Bild (kein Tagschlaf).
ALTER TABLE owls ADD COLUMN cared_at INTEGER;
