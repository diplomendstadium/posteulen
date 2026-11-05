/**
 * Owls (SPEC 8.5, 8.7, 9.2, 9.3): list, buy, name, feed, pet, release, give away – and the
 * flight preview for choosing an owl (8.4 step 4).
 */
import type { FastifyInstance } from 'fastify';
import { GOLD, MENAGERIE, OWL, TIME } from '@posteulen/shared/constants.ts';
import { energyAfterFeeding, markCare, startEnergy } from '@posteulen/shared/game/energy.ts';
import { priceTenths } from '@posteulen/shared/game/gold.ts';
import {
  canBuyMore,
  canCare,
  canGift,
  canLendToPapeterie,
  canRelease,
  canRenameInYear,
  randomSex,
  speciesById,
} from '@posteulen/shared/game/owls.ts';
import { checkOwlName } from '@posteulen/shared/names.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import {
  ChickGiftPrepare,
  CoverSend,
  FlightPreview,
  GiftPrepare,
  Loan,
  OwlBuy,
  OwlName,
  OwlTreat,
} from '@posteulen/shared/schemas/owls.ts';
import { loanOwl, loanIdentityFor, offerOf } from './lifecycle.ts';
import type { Context } from '../context.ts';
import { HttpError, parse } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { ipKey } from '../security/ip.ts';
import { cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { debit } from '../gold/ledger.ts';
import { planFlight } from '../flights/service.ts';
import {
  checkLetters,
  checkRecipients,
  chooseChick,
  chooseOwl,
  depart,
  newLetters,
  publicKeys,
  TOKEN_MS,
} from '../flights/transport.ts';
import {
  currentEnergy,
  facts,
  isReady,
  ownOwl,
  ownOwlCount,
  owlView,
  type OwlRow,
} from './model.ts';

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
    const clutches = ctx.db.all<{ id: string; hatched_at: number }>(
      "SELECT id, hatched_at FROM clutches WHERE owner_id = ? AND gift_state = 'open'",
      me,
    );
    return {
      owls: rows.map((owl) => owlView(ctx, owl, now)),
      canBuy: canBuyMore(ownOwlCount(ctx, me)),
      // Chicks of which one must be given away within 24 hours (9.9).
      clutches: clutches.map((clutch) => ({
        id: clutch.id,
        giftDeadline: clutch.hatched_at + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR,
      })),
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
      ctx.db.run(
        'UPDATE owls SET name = ?, renamed_year = ? WHERE id = ?',
        checked.display,
        year,
        id,
      );
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
      .all<OwlRow>(
        // Own owls first, then loan owls (9.6).
        "SELECT * FROM owls WHERE owner_id = ? AND state = 'home' ORDER BY kind DESC, created_at, id",
        me,
      )
      .filter(isReady)
      .map((owl) => owl.id);
    const owls = [];
    for (const owlId of own) {
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
      return {
        owl: { name: owl.name, species: owl.species },
        arrivesAt: route[0]?.arrivesAt ?? now,
      };
    });
    ctx.hub.notify(me, 'owls', 'map', 'chats');
    return result;
  });

  /** Treatment of a sick owl (9.8): own care 0.2 gold / 7 days, vet 1.0 gold / 24 hours. */
  app.post('/api/owls/:id/treat', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const body = parse(OwlTreat, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    ctx.db.transaction(() => {
      const owl = ownOwl(ctx, me, id);
      if (owl.state !== 'sick') throw new HttpError(400, 'owl_not_sick');
      const vet = body.kind === 'vet';
      debit(ctx.db, me, 'treatment', vet ? GOLD.VET_PRICE : GOLD.SELF_CARE_PRICE, now);
      const until = now + (vet ? OWL.VET_HOURS * TIME.HOUR : OWL.SELF_CARE_DAYS * TIME.DAY);
      // At the vet the owl is away and does not regenerate: freeze its energy now.
      ctx.db.run(
        'UPDATE owls SET state = ?, state_until = ?, energy = ?, energy_at = ? WHERE id = ?',
        vet ? 'vet' : 'self_care',
        until,
        currentEnergy(ctx, owl, now),
        now,
        id,
      );
      ctx.queue.schedule('treatment_end', id, until);
    });
    ctx.hub.notify(me, 'owls', 'profile', 'finance');
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  });

  /** Lend an owl to the papeterie for 7 days (9.7). */
  app.post('/api/owls/:id/papeterie', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const me = userOf(request).id;
    const now = ctx.now();
    const owl = ownOwl(ctx, me, id);
    if (!canLendToPapeterie(facts(owl)) || owl.name === null)
      throw new HttpError(400, 'owl_not_home');
    const until = now + OWL.PAPETERIE_DAYS * TIME.DAY;
    ctx.db.transaction(() => {
      ctx.db.run(
        "UPDATE owls SET state = 'papeterie', state_until = ?, energy = ?, energy_at = ? WHERE id = ? AND state = 'home'",
        until,
        currentEnergy(ctx, owl, now),
        now,
        id,
      );
      ctx.queue.schedule('papeterie_end', id, until);
    });
    ctx.hub.notify(me, 'owls');
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  });

  /** Today's offer with the names rolled for this user (9.6). */
  app.get('/api/menagerie', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const now = ctx.now();
    const day = utcDay(now);
    const loans = ctx.db.all<{ species: string }>(
      "SELECT species FROM owls WHERE owner_id = ? AND kind = 'loan'",
      me,
    );
    return {
      day,
      maxLoans: MENAGERIE.MAX_CONCURRENT_LOANS,
      loans: loans.length,
      offer: offerOf(ctx, day).map((species) => ({
        species,
        ...loanIdentityFor(ctx, me, day, species),
        loaned: loans.some((loan) => loan.species === species),
      })),
    };
  });

  app.post('/api/menagerie/loan', { preHandler: authenticated }, async (request) => {
    const body = parse(Loan, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const owl = ctx.db.transaction(() => {
      if (!offerOf(ctx, utcDay(now)).includes(body.species))
        throw new HttpError(400, 'loan_not_offered');
      const loans = ctx.db.all<{ species: string }>(
        "SELECT species FROM owls WHERE owner_id = ? AND kind = 'loan'",
        me,
      );
      if (loans.length >= MENAGERIE.MAX_CONCURRENT_LOANS) throw new HttpError(400, 'loan_limit');
      if (loans.some((loan) => loan.species === body.species))
        throw new HttpError(400, 'loan_species');
      debit(ctx.db, me, 'loan', GOLD.LOAN_PRICE, now);
      return loanOwl(ctx, me, body.species, now);
    });
    ctx.hub.notify(me, 'owls', 'profile', 'finance');
    return { owl: owlView(ctx, owl, now) };
  });

  /** The holder gives one chick of a clutch away, optionally with a cover letter (9.9). */
  app.post('/api/clutches/:id/gift/prepare', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const clutchId = owlIdParam(request.params);
    const body = parse(ChickGiftPrepare, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const clutch = ctx.db.get<{ gift_state: string }>(
      'SELECT gift_state FROM clutches WHERE id = ? AND owner_id = ?',
      clutchId,
      me,
    );
    if (!clutch) throw new HttpError(404, 'not_found');
    if (clutch.gift_state !== 'open') throw new HttpError(400, 'clutch_done');
    const chick = ctx.db.get<{ name: string | null }>(
      'SELECT name FROM owls WHERE id = ? AND clutch_id = ? AND owner_id = ?',
      body.chickId,
      clutchId,
      me,
    );
    if (!chick) throw new HttpError(404, 'not_found');
    if (chick.name === null) throw new HttpError(400, 'owl_unnamed');
    checkRecipients(ctx, me, [body.recipient], now);
    const planned = planFlight(ctx, {
      holderId: me,
      owl: chooseChick(ctx, me, body.chickId, now),
      recipients: [body.recipient],
      returnsHome: false,
      now,
      chick: true,
    });
    const letters = body.withCover ? newLetters([body.recipient], now) : [];
    const token = randomId();
    ctx.letterTokens.set(
      token,
      {
        senderId: me,
        purpose: 'gift',
        owlId: body.chickId,
        kind: 'cover_chick',
        parchment: 'small',
        recipients: [body.recipient],
        letters,
        gold: 0,
        chick: true,
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

  app.post('/api/clutches/:id/gift/send', { preHandler: authenticated }, async (request) => {
    const clutchId = owlIdParam(request.params);
    const body = parse(CoverSend, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const token = ctx.letterTokens.take(body.token, now);
    if (!token || token.senderId !== me || !token.chick) {
      throw new HttpError(410, 'letter_token_expired');
    }
    const letters = checkLetters(token, body.cover ? [body.cover] : []);
    checkRecipients(ctx, me, token.recipients, now);
    const result = ctx.db.transaction(() => {
      const done = ctx.db.run(
        "UPDATE clutches SET gift_state = 'sent' WHERE id = ? AND owner_id = ? AND gift_state = 'open'",
        clutchId,
        me,
      );
      if (done.changes !== 1) throw new HttpError(400, 'clutch_done');
      const { route, owl } = depart(ctx, token, letters, now);
      return {
        owl: { name: owl.name, species: owl.species },
        arrivesAt: route[0]?.arrivesAt ?? now,
      };
    });
    ctx.hub.notify(me, 'owls', 'map', 'chats');
    return result;
  });
}
