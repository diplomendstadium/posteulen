/**
 * Map data (SPEC 12.1): own home, homes of all contacts, and only the user's own flights –
 * the browser never receives flight plans of other people's owls.
 */
import type { FastifyInstance } from 'fastify';
import type { Context } from '../context.ts';
import { cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { displayName } from '../contacts/model.ts';
import { botTitle, type BotRow } from '../bots/service.ts';
import { homeOf, planOf, routeOf, type FlightRow } from './service.ts';

export function registerFlightRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, cookieSpec(ctx.config.userOrigin, 'pe_session'));

  app.get('/api/map', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const contacts = ctx.db.all<{ other: string }>(
      `SELECT CASE WHEN user_lo = ? THEN user_hi ELSE user_lo END AS other
         FROM contacts WHERE user_lo = ? OR user_hi = ?`,
      me,
      me,
      me,
    );
    const flights = ctx.db.all<FlightRow>(
      "SELECT * FROM flights WHERE holder_id = ? AND state = 'active' ORDER BY started_at",
      me,
    );
    return {
      home: homeOf(ctx, me),
      contacts: contacts
        .map(({ other }) => ({
          id: other,
          name: displayName(ctx.db, other),
          bot: false,
          ...homeOf(ctx, other),
        }))
        .concat(
          // Bots live on the map too (SPEC 10.1, 12.1); the Erklärbär only once the user has
          // written to him (v0.3).
          ctx.db
            .all<BotRow>(
              `SELECT * FROM bots WHERE owner_id = ? AND in_addressbook = 1
                 AND (type != 'explainer' OR last_user_letter_at IS NOT NULL)`,
              me,
            )
            .map((bot) => ({
              id: bot.id,
              name: botTitle(ctx, bot),
              bot: true,
              lat: bot.home_lat / 100,
              lon: bot.home_lon / 100,
            })),
        ),
      flights: flights.map((flight) => ({
        id: flight.id,
        owl: { name: flight.owl_name, species: flight.owl_species },
        purpose: flight.purpose,
        stops: routeOf(flight).map((stop) => ({
          name: stop.type === 'home' ? null : displayName(ctx.db, stop.userId),
          type: stop.type,
          status: stop.status,
          arrivesAt: stop.arrivesAt,
          lat: stop.lat,
          lon: stop.lon,
        })),
        segments: planOf(flight),
      })),
    };
  });
}
