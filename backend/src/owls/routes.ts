/**
 * Owls (SPEC 8.5, 8.7, 9.2, 9.3): list, buy, name, feed, pet, release, give away – and the
 * flight preview for choosing an owl (8.4 step 4).
 */
import type { FastifyInstance } from 'fastify';
import { GOLD } from '@posteulen/shared/constants.ts';
import { energyAfterFeeding, markCare, startEnergy } from '@posteulen/shared/game/energy.ts';
import { priceTenths } from '@posteulen/shared/game/gold.ts';
import {
  canBuyMore,
  canCare,
  canGift,
  canRelease,
  canRenameInYear,
  randomSex,
  speciesById,
} from '@posteulen/shared/game/owls.ts';
import { checkOwlName } from '@posteulen/shared/names.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import { CoverSend, FlightPreview, GiftPrepare, OwlBuy, OwlName } from '@posteulen/shared/schemas/owls.ts';
import type { Context } from '../context.ts';
import { HttpError, parse } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { ipKey } from '../security/ip.ts';
import { cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { debit } from '../gold/ledger.ts';
import { planFlight, STAND_IN_OWL } from '../flights/service.ts';
import {
  checkLetters,
  checkRecipients,
  chooseOwl,
  depart,
  newLetters,
  publicKeys,
  TOKEN_MS,
} from '../flights/transport.ts';
import { currentEnergy, facts, isReady, ownOwl, ownOwlCount, owlView, type OwlRow } from './model.ts';

function owlIdParam(params: unknown): string {
  return parse(Id, (params as { id?: unknown }).id);
}

export function registerOwlRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, cookieSpec(ctx.config.userOrigin, 'pe_session'));

  app.get('/api/owls', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const now = ctx.now();
    const rows = ctx.db.all<OwlRow>(
      "SELECT * FROM owls WHERE owner_id = ? AND state != 'gift_flight' ORDER BY created_at, id",
      me,
    );
    return {
      owls: rows.map((owl) => owlView(ctx, owl, now)),
      canBuy: canBuyMore(ownOwlCount(ctx, me)),
    };
  });

  app.post('/api/owls/buy', { preHandler: authenticated }, async (request) => {
    const body = parse(OwlBuy, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const species = speciesById(body.species);
    if (!species) throw new HttpError(400, 'bad_request');
    const owl = ctx.db.transaction(() => {
      if (!canBuyMore(ownOwlCount(ctx, me))) throw new HttpError(400, 'owl_limit');
      debit(ctx.db, me, 'owl_purchase', priceTenths(species.price), now);
      const id = randomId();
      ctx.db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
         VALUES (?, ?, 'own', ?, ?, NULL, ?, ?, ?, ?)`,
        id,
        me,
        species.id,
        randomSex(ctx.random()),
        startEnergy(species, ctx.random()),
        now,
        utcDay(now),
        now,
      );
      return ownOwl(ctx, me, id);
    });
    ctx.hub.notify(me, 'owls', 'profile', 'finance');
    return { owl: owlView(ctx, owl, now) };
  });

  app.post('/api/owls/:id/name', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const body = parse(OwlName, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const owl = ownOwl(ctx, me, id);
    if (owl.kind !== 'own') throw new HttpError(400, 'owl_rename_blocked');
    const checked = checkOwlName(body.name);
    if (typeof checked === 'string') throw new HttpError(400, `owl_name_${checked}`);
    const year = new Date(now).getUTCFullYear();
    if (owl.name === null) {
      // The first naming after buying or hatching does not count (9.2.4).
      ctx.db.run('UPDATE owls SET name = ? WHERE id = ?', checked.display, id);
    } else {
      if (!canRenameInYear(owl.renamed_year, year)) throw new HttpError(400, 'owl_rename_blocked');
      ctx.db.run('UPDATE owls SET name = ?, renamed_year = ? WHERE id = ?', checked.display, year, id);
    }
    ctx.hub.notify(me, 'owls');
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  });

  app.post('/api/owls/:id/feed', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const me = userOf(request).id;
    const now = ctx.now();
    const today = utcDay(now);
    ctx.db.transaction(() => {
      const owl = ownOwl(ctx, me, id);
      const species = speciesById(owl.species);
      if (!species || !canCare(facts(owl))) throw new HttpError(400, 'owl_not_home');
      if (owl.fed_on === today) throw new HttpError(400, 'owl_fed_today');
      debit(ctx.db, me, 'feed', GOLD.FEED_PRICE, now);
      const care = markCare(owl.care_mask, owl.care_mask_day, today);
      ctx.db.run(
        'UPDATE owls SET energy = ?, energy_at = ?, fed_on = ?, care_mask = ?, care_mask_day = ? WHERE id = ?',
        energyAfterFeeding(currentEnergy(ctx, owl, now), species),
        now,
        today,
        care.mask,
        care.maskDay,
        id,
      );
    });
    ctx.hub.notify(me, 'owls', 'profile', 'finance');
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  });

  /** Petting is free and unlimited, but counts for the care bonus once per day (9.3). */
  app.post('/api/owls/:id/pet', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const me = userOf(request).id;
    const now = ctx.now();
    const today = utcDay(now);
    const owl = ownOwl(ctx, me, id);
    if (!canCare(facts(owl))) throw new HttpError(400, 'owl_not_home');
    const care = markCare(owl.care_mask, owl.care_mask_day, today);
    ctx.db.run(
      'UPDATE owls SET petted_on = ?, care_mask = ?, care_mask_day = ? WHERE id = ?',
      today,
      care.mask,
      care.maskDay,
      id,
    );
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  });

  app.post('/api/owls/:id/release', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const me = userOf(request).id;
    const owl = ownOwl(ctx, me, id);
    if (!canRelease(facts(owl))) throw new HttpError(400, 'owl_not_home');
    ctx.db.run('DELETE FROM owls WHERE id = ?', id);
    ctx.hub.notify(me, 'owls');
    return { ok: true };
  });

  /** Owls ready for a transport with the server-computed preview (8.4 step 4, 9.4.3). */
  app.post('/api/flights/preview', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const body = parse(FlightPreview, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    checkRecipients(ctx, me, body.recipients, now);
    const own = ctx.db
      .all<OwlRow>("SELECT * FROM owls WHERE owner_id = ? AND state = 'home' ORDER BY created_at, id", me)
      .filter(isReady)
      .map((owl) => owl.id);
    const candidates = [...own, STAND_IN_OWL.id];
    const owls = [];
    for (const owlId of candidates) {
      const owl = chooseOwl(ctx, me, owlId, now);
      if (body.recipients.length > owl.maxRecipients) continue;
      const planned = planFlight(ctx, {
        holderId: me,
        owl,
        recipients: body.recipients,
        returnsHome: owl.returnsHome,
        now,
      });
      owls.push({
        id: owlId,
        kind: owl.kind,
        name: owl.name,
        species: owl.species,
        energy: Math.round(owl.energy),
        maxEnergy: speciesById(owl.species)?.maxEnergy ?? 0,
        arrivals: planned.route
          .filter((stop) => stop.type === 'deliver')
          .map((stop) => ({ recipientId: stop.userId, at: stop.arrivesAt })),
        returnsAt: planned.route.find((stop) => stop.type === 'home')?.arrivesAt ?? null,
      });
    }
    return { owls };
  });

  /** Give an owl away, optionally with a cover letter (9.2.7). */
  app.post('/api/owls/:id/gift/prepare', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const id = owlIdParam(request.params);
    const body = parse(GiftPrepare, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const owl = ownOwl(ctx, me, id);
    if (!canGift(facts(owl)) || owl.name === null) throw new HttpError(400, 'owl_not_ready');
    checkRecipients(ctx, me, [body.recipient], now);
    const planned = planFlight(ctx, {
      holderId: me,
      owl: chooseOwl(ctx, me, id, now),
      recipients: [body.recipient],
      returnsHome: false,
      now,
    });
    const letters = body.withCover ? newLetters([body.recipient], now) : [];
    const token = randomId();
    ctx.letterTokens.set(
      token,
      {
        senderId: me,
        purpose: 'gift',
        owlId: id,
        kind: 'cover_owl',
        parchment: 'small',
        recipients: [body.recipient],
        letters,
        gold: 0,
      },
      TOKEN_MS,
      now,
    );
    return {
      token,
      letters,
      keys: body.withCover ? publicKeys(ctx, [body.recipient]) : [],
      arrivesAt: planned.route[0]?.arrivesAt ?? now,
    };
  });

  app.post('/api/owls/:id/gift/send', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const body = parse(CoverSend, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const token = ctx.letterTokens.take(body.token, now);
    if (!token || token.senderId !== me || token.purpose !== 'gift' || token.owlId !== id) {
      throw new HttpError(410, 'letter_token_expired');
    }
    const letters = checkLetters(token, body.cover ? [body.cover] : []);
    checkRecipients(ctx, me, token.recipients, now);
    const result = ctx.db.transaction(() => {
      const { route, owl } = depart(ctx, token, letters, now);
      return { owl: { name: owl.name, species: owl.species }, arrivesAt: route[0]?.arrivesAt ?? now };
    });
    ctx.hub.notify(me, 'owls', 'map', 'chats');
    return result;
  });
}
