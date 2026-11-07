-- Version 0.5: Motivation der Eulen (in Zehnteln, 0,8–1,2), Wasser und Lieblingsleckerli,
-- nicht lesbare Briefe.
ALTER TABLE owls ADD COLUMN motivation INTEGER NOT NULL DEFAULT 10 CHECK (motivation BETWEEN 8 AND 12);
-- Tag (UTC) der letzten Wassergabe bzw. des letzten Lieblingsleckerlis.
ALTER TABLE owls ADD COLUMN watered_on TEXT;
ALTER TABLE owls ADD COLUMN snacked_on TEXT;
-- Der Empfänger konnte den Brief nicht als echt bestätigen (statt „gelesen“ beim Absender).
ALTER TABLE letters ADD COLUMN unreadable INTEGER NOT NULL DEFAULT 0 CHECK (unreadable IN (0, 1));
