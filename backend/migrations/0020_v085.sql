-- v0.8.5: the loan offer is rolled per account and offer day (SPEC 9.6). Rolled on the first
-- request of the day and kept until the next change of day, the species of the account's two
-- days before are left out. The shared offer of the update day (menagerie_offers) still counts
-- for that day, with the loans already made. Afterwards the table is no longer written.
CREATE TABLE menagerie_user_offers (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  species TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
) STRICT;

-- v0.8.5: chicks get five days for names and the gift (SPEC 9.9, before 24 hours). Clutches
-- that are still waiting keep their hatching time. Their deadlines move to five days after it,
-- the gift reminder to one day before (pending events only – handled ones are gone).
UPDATE scheduled_events
   SET due_at = (SELECT c.hatched_at + 5 * 86400000 FROM clutches c WHERE c.id = scheduled_events.ref),
       logical_at = (SELECT c.hatched_at + 5 * 86400000 FROM clutches c WHERE c.id = scheduled_events.ref)
 WHERE type = 'clutch_names'
   AND EXISTS (SELECT 1 FROM clutches c WHERE c.id = scheduled_events.ref);
UPDATE scheduled_events
   SET due_at = (SELECT c.hatched_at + 5 * 86400000 FROM clutches c WHERE c.id = scheduled_events.ref),
       logical_at = (SELECT c.hatched_at + 5 * 86400000 FROM clutches c WHERE c.id = scheduled_events.ref)
 WHERE type = 'clutch_gift'
   AND EXISTS (SELECT 1 FROM clutches c WHERE c.id = scheduled_events.ref AND c.gift_state = 'open');
UPDATE scheduled_events
   SET due_at = (SELECT c.hatched_at + 4 * 86400000 FROM clutches c WHERE c.id = scheduled_events.ref),
       logical_at = (SELECT c.hatched_at + 4 * 86400000 FROM clutches c WHERE c.id = scheduled_events.ref)
 WHERE type = 'clutch_reminder'
   AND EXISTS (SELECT 1 FROM clutches c WHERE c.id = scheduled_events.ref AND c.gift_state = 'open');

-- v0.8.5: the shared offer is no longer rolled at 00:00 (its daily job is gone).
DELETE FROM scheduled_events WHERE type = 'daily:menagerie_offer';
