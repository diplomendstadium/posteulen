-- v0.8.3: arrival of each bot delivery at its player (planned on take-off, real on arrival) for
-- "first and last player" of an event (SPEC 10.12), and the daily care of a visiting bot owl,
-- which has no owl row (SPEC 10.7).
ALTER TABLE central_bot_deliveries ADD COLUMN arrives_at INTEGER;

-- Existing deliveries: from the letter, else from the first stop of the flight.
UPDATE central_bot_deliveries
   SET arrives_at = COALESCE(
         (SELECT l.arrives_at FROM letters l WHERE l.id = central_bot_deliveries.letter_id),
         (SELECT CAST(json_extract(f.route, '$[0].arrivesAt') AS INTEGER) FROM flights f
           WHERE f.id = central_bot_deliveries.flight_id))
 WHERE state IN ('started', 'done');

CREATE TABLE bot_owl_care (
  flight_id TEXT NOT NULL REFERENCES flights (id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('water', 'pet', 'feed', 'snack')),
  day       TEXT NOT NULL,
  PRIMARY KEY (flight_id, kind)
) STRICT;
