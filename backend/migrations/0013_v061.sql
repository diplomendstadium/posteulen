-- Version 0.6.1: Gleiche Meldungen im Fehlerprotokoll werden zusammengefasst. Tritt dieselbe
-- Meldung (Bereich, Schwere, Was, Ursache) innerhalb einer Stunde nach ihrem letzten Auftreten
-- erneut auf, zählt der vorhandene Eintrag hoch, statt einen neuen anzulegen.
ALTER TABLE error_log ADD COLUMN count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1);
-- Zeitpunkt des letzten Auftretens (bei count = 1 gleich at).
ALTER TABLE error_log ADD COLUMN last_at INTEGER;
UPDATE error_log SET last_at = at;
CREATE INDEX error_log_last_at ON error_log (last_at);
