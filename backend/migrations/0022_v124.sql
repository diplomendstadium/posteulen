-- v1.2.4: kilometres an own owl has flown in all (SPEC 9.2, shown below its name). Finished
-- flights add their flown distance. The flights from before the update are counted once at
-- the next start (backend/src/owls/distance.ts, meta key km_backfill).
ALTER TABLE owls ADD COLUMN km_flown REAL NOT NULL DEFAULT 0 CHECK (km_flown >= 0);

-- v1.2.4: how often sending a push failed for a passing reason (SPEC 11.3). It stays pending
-- and is tried again after growing waits.
ALTER TABLE notifications ADD COLUMN push_attempts INTEGER NOT NULL DEFAULT 0 CHECK (push_attempts >= 0);
