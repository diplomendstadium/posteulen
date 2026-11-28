/**
 * Owls (SPEC 8.5, 8.7, 9.2, 9.3): list, buy, name, feed, pet, release, give away – and the
 * flight preview for choosing an owl (8.4 step 4).
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { GOLD, OWL, TIME } from '@posteulen/shared/constants.ts';
import {
  displayEnergy,
  energyAfterFeeding,
  energyAfterSnack,
  startEnergy,
} from '@posteulen/shared/game/energy.ts';
import type { Interaction } from '@posteulen/shared/game/motivation.ts';
import { canAfford, priceTenths } from '@posteulen/shared/game/gold.ts';
import {
  canBuyMore,
  canCare,
  canFeedAgain,
  cargoOf,
  loanPrice,
  canGift,
  canLendToPostOffice,
  maxOwnOwls,
  quarterOf,
  canRelease,
  releaseAllowed,
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
  LOAN_REF_PREFIX,
  OwlBuy,
  OwlName,
  OwlRelease,
  VacationPlan,
} from '@posteulen/shared/schemas/owls.ts';
import { interact, leftHome } from './care.ts';
import { requireRoom } from './limit.ts';
import { clutchNoticeSeen } from './clutch-notice.ts';
import { assignLook, hasSecondLook } from './look.ts';
import {
  cancelVacation,
  endVacation,
  planVacation,
  sendOwlsOnVacation,
  vacationView,
} from './vacation.ts';
import { kmOf, owlLabel } from './globe.ts';
import { countInteraction, recordGift, requireGiftAllowed } from '../accounts/stats.ts';
import { careForBotOwl } from '../central/care.ts';
import {
  borrow,
  loanedOn,
  loanIdentitiesFor,
  loanProblem,
  loanStillHere,
  offerOf,
  offerTeamOf,
} from './lifecycle.ts';
import type { Context } from '../context.ts';
import { HttpError, parse, emptyBody } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { accountClientKey } from '../security/ip.ts';
import { userCookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { balance } from '../gold/ledger.ts';
import { isPrivileged, pay, payCare } from '../gold/privilege.ts';
import {
  endRest,
  loadFlight,
  planFlight,
  previewReturn,
  replanFlight,
  routeOf,
} from '../flights/service.ts';
import { isBotId } from '../bots/registry.ts';
import {
  checkLetters,
  checkRecipients,
  chooseChick,
  chooseOwl,
  depart,
  guestFlight,
  guestRef,
  guestsOf,
  newLetters,
  publicKeys,
  TOKEN_MS,
} from '../flights/transport.ts';
import {
  currentEnergy,
  facts,
  botGuestView,
  guestView,
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
  const authenticated = requireUser(ctx, userCookieSpec(ctx.config));

  app.get('/api/owls', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const now = ctx.now();
    const rows = ctx.db.all<OwlRow>(
      "SELECT * FROM owls WHERE owner_id = ? AND state != 'gift_flight' ORDER BY created_at, id",
      me,
    );
    const clutches = ctx.db.all<{ id: string; hatched_at: number; gift_all: number }>(
      "SELECT id, hatched_at, gift_all FROM clutches WHERE owner_id = ? AND gift_state = 'open'",
      me,
    );
    // v0.7: owls of others resting here for a while.
    const guests = guestsOf(ctx, me).flatMap(({ flight, index }) => {
      // v0.8: the owl of a control-centre bot (no owl row; not cared for by players).
      if (flight.holder_kind === 'bot') return [botGuestView(ctx, flight, index, now)];
      const owl = flight.owl_id
        ? ctx.db.get<OwlRow>('SELECT * FROM owls WHERE id = ?', flight.owl_id)
        : undefined;
      return owl ? [guestView(ctx, owl, flight, index, now)] : [];
    });
    const count = ownOwlCount(ctx, me);
    return {
      owls: rows.map((owl) => owlView(ctx, owl, now, count)),
      guests,
      // v1.3.1: privileged players may buy beyond the limit (SPEC 9.1.7).
      canBuy: canBuyMore(count) || isPrivileged(ctx.db, me, now),
      // v1.4: the most own owls – as many as there are species (9.2.3).
      maxOwls: maxOwnOwls(),
      ownCount: count,
      // Chicks of which one (v1.4: beyond the limit all) must be given away in five days (9.9).
      clutches: clutches.map((clutch) => ({
        id: clutch.id,
        giftDeadline: clutch.hatched_at + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR,
        giftAll: clutch.gift_all === 1,
      })),
    };
  });

  app.post('/api/owls/buy', { preHandler: authenticated }, async (request) => {
    const body = parse(OwlBuy, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const species = speciesById(body.species);
    if (!species) throw new HttpError(400, 'bad_request');
    // v0.8.4: the Virginiauhu comes only from bots and vouchers.
    if (species.notForSale) throw new HttpError(400, 'owl_not_for_sale');
    const owl = ctx.db.transaction(() => {
      if (!canBuyMore(ownOwlCount(ctx, me)) && !isPrivileged(ctx.db, me, now))
        throw new HttpError(400, 'owl_limit');
      pay(ctx.db, me, 'owl_purchase', priceTenths(species.price), now);
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
      assignLook(ctx, id);
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
    // v1.4: a named owl at home joins a running holiday (9.12).
    ctx.db.transaction(() => sendOwlsOnVacation(ctx, me, now));
    ctx.hub.notify(me, 'owls', 'map');
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  });

  /**
   * The four interactions (v0.5, 9.3): water (free, once a day), petting (free, unlimited),
   * the owl biscuit (0.1 gold, +10 % energy) and the favourite snack (0.2 gold, +20 % energy) –
   * v0.10 each once a day in any case and again while the energy is not full. Each kind raises
   * the motivation once a day.
   */
  const interaction = (kind: Interaction) => async (request: FastifyRequest) => {
    const id = owlIdParam(request.params);
    const me = userOf(request).id;
    const now = ctx.now();
    const today = utcDay(now);
    // v0.7: an owl resting here can be cared for by its host (who pays); it counts for the
    // owl's motivation and care days, and more energy takes it further on its next leg.
    const guest = ctx.db.get('SELECT 1 FROM owls WHERE id = ? AND owner_id = ?', id, me)
      ? undefined
      : guestFlight(ctx, me, id);
    // v0.8.3: a visiting owl of a control-centre bot (no owl row; free care, SPEC 10.7).
    if (guest?.flight.holder_kind === 'bot') {
      ctx.db.transaction(() => {
        careForBotOwl(ctx, guest.flight, kind, today, now);
        countInteraction(ctx, me, kind);
      });
      const flight = loadFlight(ctx, guest.flight.id);
      return { guest: flight ? botGuestView(ctx, flight, guest.index, now) : null };
    }
    ctx.db.transaction(() => {
      const owl = guest
        ? ctx.db.get<OwlRow>('SELECT * FROM owls WHERE id = ?', id)
        : ownOwl(ctx, me, id);
      if (!owl) throw new HttpError(404, 'not_found');
      const species = speciesById(owl.species);
      if (!species || (!guest && !canCare(facts(owl)))) throw new HttpError(400, 'owl_not_home');
      // v0.10: biscuit and snack once a day in any case, more often while the energy is not
      // full right now (each time paid, SPEC 9.3). Motivation rises only once a day per kind.
      const fullNow = () =>
        !canFeedAgain({
          fedToday: true,
          energy: displayEnergy(currentEnergy(ctx, owl, now)),
          maxEnergy: species.maxEnergy,
        });
      // v1.5.0: a chick knows only two interactions – a mealworm (0.1 gold, strictly once a
      // day, never from the pouch, no energy) and petting (SPEC 9.3, 9.9).
      const chick = !guest && owl.is_chick === 1;
      if (chick && (kind === 'water' || kind === 'snack'))
        throw new HttpError(400, 'owl_chick_care');
      if (chick && kind === 'feed' && owl.fed_on === today)
        throw new HttpError(400, 'owl_fed_today');
      if (kind === 'feed' && owl.fed_on === today && fullNow())
        throw new HttpError(400, 'owl_fed_today');
      if (kind === 'water' && owl.watered_on === today)
        throw new HttpError(400, 'owl_watered_today');
      if (kind === 'snack' && owl.snacked_on === today && fullNow())
        throw new HttpError(400, 'owl_snacked_today');
      // v1.3.1: from the pouch while it holds some, free for privileged players (9.1.6, 9.1.7).
      if (chick && kind === 'feed') pay(ctx.db, me, 'mealworm', GOLD.MEALWORM_PRICE, now);
      else if (kind === 'feed') payCare(ctx.db, me, 'feed', GOLD.FEED_PRICE, now);
      if (kind === 'snack') payCare(ctx.db, me, 'snack', GOLD.SNACK_PRICE, now);
      const energy = chick
        ? undefined
        : kind === 'feed'
          ? energyAfterFeeding(currentEnergy(ctx, owl, now), species)
          : kind === 'snack'
            ? energyAfterSnack(currentEnergy(ctx, owl, now), species)
            : undefined;
      interact(
        ctx,
        owl,
        kind,
        today,
        now,
        energy === undefined || guest ? undefined : { value: energy, at: now },
      );
      // v1.3: every interaction counts in the player's statistics (SPEC 8.10).
      countInteraction(ctx, me, kind);
      if (guest) {
        // The plan follows: more energy now, and the next leg with the new motivation.
        const flight = loadFlight(ctx, guest.flight.id);
        if (flight) {
          replanFlight(ctx, flight, routeOf(flight), now, {
            newLeg: true,
            adjust: (state) => (energy === undefined ? state : { ...state, energy }),
          });
        }
      }
    });
    ctx.hub.notify(me, 'owls', 'profile', 'finance');
    if (guest) {
      ctx.hub.notify(guest.flight.holder_id, 'owls', 'map');
      const owl = ctx.db.get<OwlRow>('SELECT * FROM owls WHERE id = ?', id);
      const flight = loadFlight(ctx, guest.flight.id);
      return { guest: owl && flight ? guestView(ctx, owl, flight, guest.index, now) : null };
    }
    return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
  };
  app.post('/api/owls/:id/water', { preHandler: [authenticated, emptyBody] }, interaction('water'));
  app.post('/api/owls/:id/pet', { preHandler: [authenticated, emptyBody] }, interaction('pet'));
  app.post('/api/owls/:id/feed', { preHandler: [authenticated, emptyBody] }, interaction('feed'));
  app.post('/api/owls/:id/snack', { preHandler: [authenticated, emptyBody] }, interaction('snack'));

  /**
   * v0.8.2: the host sends a visiting owl on early, without a letter (SPEC 8.4): it takes off at
   * once – to its next recipient or home (a loan owl without replies vanishes). `:id` is the
   * reference of the guest owl (owl ID, or flight ID for owls of bots).
   */
  app.post(
    '/api/guests/:id/send-on',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const id = owlIdParam(request.params);
      const me = userOf(request).id;
      const after: (() => void)[] = [];
      ctx.db.transaction(() => {
        const guest = guestFlight(ctx, me, id);
        if (!guest) throw new HttpError(404, 'not_found');
        endRest(ctx, guest.flight, guest.index, ctx.now(), (work) => after.push(work));
      });
      for (const work of after) work();
      ctx.hub.notify(me, 'owls');
      return { ok: true };
    },
  );

  app.post('/api/owls/:id/release', { preHandler: authenticated }, async (request) => {
    const id = owlIdParam(request.params);
    const me = userOf(request).id;
    // Foreign owls stay invisible (404) before anything about the body is said (17.3).
    const owl = ownOwl(ctx, me, id);
    const body = parse(OwlRelease, request.body);
    if (!canRelease(facts(owl))) throw new HttpError(400, 'owl_not_home');
    // v0.8.5: only while more than 20 own owls live here (9.2.8).
    if (!releaseAllowed(facts(owl), ownOwlCount(ctx, me)))
      throw new HttpError(400, 'owl_release_limit');
    // The user typed the exact name and confirmed twice (v0.3).
    if (owl.name === null || body.name.normalize('NFC') !== owl.name.normalize('NFC'))
      throw new HttpError(400, 'owl_name_mismatch');
    ctx.db.run('DELETE FROM owls WHERE id = ?', id);
    ctx.hub.notify(me, 'owls');
    return { ok: true };
  });

  /** Owls ready for a transport with the server-computed preview (8.4 step 4, 9.4.3). */
  app.post('/api/flights/preview', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(accountClientKey(request, userOf(request).id), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const body = parse(FlightPreview, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    checkRecipients(ctx, me, body.recipients, now, { allowBots: true });
    const own = ctx.db
      .all<OwlRow>(
        // Own owls first, then loan owls (9.6).
        "SELECT * FROM owls WHERE owner_id = ? AND state = 'home' ORDER BY kind DESC, created_at, id",
        me,
      )
      .filter(isReady)
      .map((owl) => owl.id);
    // The loan owls of the day, borrowed only on sending (8.4 step 4, 9.6). Since v0.4 also for
    // several recipients; v0.8.5 always, not only when no owl is ready.
    // v0.10: the price depends on the species (0.2 gold for gold carriers).
    const gold = isPrivileged(ctx.db, me, now) ? Number.POSITIVE_INFINITY : balance(ctx.db, me);
    const offers = offerOf(ctx, me, utcDay(now))
      .filter((species) => canAfford(gold, loanPrice(species)))
      .filter((species) => loanProblem(ctx, me, species, now) === null)
      .map((species) => `${LOAN_REF_PREFIX}${species}`);
    const owls = [];
    // v0.7: a visiting owl of the only recipient comes first – it takes the reply straight back.
    if (body.guests && body.recipients.length === 1) {
      for (const guest of guestsOf(ctx, me)) {
        if (guest.flight.holder_id !== body.recipients[0]) continue;
        const ref = guestRef(guest.flight);
        const owl = chooseOwl(ctx, me, ref, now);
        // v0.8.5: further recipients first – the reply waits on board (their names stay private).
        const moreStops = routeOf(guest.flight).some(
          (stop, index) =>
            index > guest.index && stop.type === 'deliver' && stop.status === 'pending',
        );
        owls.push({
          id: ref,
          kind: owl.kind,
          guest: true,
          // v1.3: with 🌍 for an owl that has flown around the Earth (SPEC 9.2.1).
          name: owlLabel({ name: owl.name, km_flown: kmOf(ctx, owl.id) }),
          species: owl.species,
          second: hasSecondLook(ctx, owl.id),
          energy: Math.round(owl.energy),
          maxEnergy: speciesById(owl.species)?.maxEnergy ?? 0,
          arrivals: [
            {
              recipientId: guest.flight.holder_id,
              at: previewReturn(ctx, guest.flight, guest.index, now),
            },
          ],
          returnsAt: null,
          restUntil: routeOf(guest.flight)[guest.index]?.restUntil ?? null,
          moreStops,
          // v0.10: owls of bots carry everything (the rule is for the owls of players).
          cargo: guest.flight.holder_kind === 'bot' ? 'gold' : cargoOf(owl.species),
        });
      }
    }
    for (const owlId of [...own, ...offers]) {
      const owl = chooseOwl(ctx, me, owlId, now);
      if (body.recipients.length > owl.maxRecipients) continue;
      const planned = planFlight(ctx, {
        holderId: me,
        owl,
        recipients: body.recipients,
        returnsHome: owl.returnsHome,
        now,
        // v0.7: the rest at each person is part of the preview (not with bots); v0.8.5 for loan
        // owls the one of their kind, exactly as it is sent later.
        restMs: body.recipients.some((id) => isBotId(ctx, id))
          ? 0
          : (owl.kind === 'loan' ? (body.restLoan ?? body.rest) : body.rest) * TIME.HOUR,
      });
      owls.push({
        id: owlId,
        kind: owl.kind,
        offer: owlId.startsWith(LOAN_REF_PREFIX),
        name: owlLabel({ name: owl.name, km_flown: kmOf(ctx, owl.id) }),
        species: owl.species,
        second: hasSecondLook(ctx, owl.id),
        energy: Math.round(owl.energy),
        maxEnergy: speciesById(owl.species)?.maxEnergy ?? 0,
        arrivals: planned.route
          .filter((stop) => stop.type === 'deliver')
          .map((stop) => ({ recipientId: stop.userId, at: stop.arrivesAt })),
        returnsAt: planned.route.find((stop) => stop.type === 'home')?.arrivesAt ?? null,
        cargo: cargoOf(owl.species),
        ...(owlId.startsWith(LOAN_REF_PREFIX) ? { price: loanPrice(owl.species) } : {}),
      });
    }
    return { owls };
  });

  /** Give an owl away, optionally with a cover letter (9.2.7). */
  app.post('/api/owls/:id/gift/prepare', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(accountClientKey(request, userOf(request).id), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const id = owlIdParam(request.params);
    const body = parse(GiftPrepare, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const owl = ownOwl(ctx, me, id);
    if (!canGift(facts(owl)) || owl.name === null) throw new HttpError(400, 'owl_not_ready');
    // v1.3: only active players, one gift of gold or an owl in two weeks (SPEC 9.1.5).
    requireGiftAllowed(ctx, me, now);
    checkRecipients(ctx, me, [body.recipient], now);
    // v1.4: only to someone below the most own owls (9.2.3).
    requireRoom(ctx, body.recipient);
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
      requireGiftAllowed(ctx, me, now);
      for (const recipient of token.recipients) requireRoom(ctx, recipient);
      const { route, owl } = depart(ctx, token, letters, now);
      recordGift(ctx, me, now);
      return {
        owl: { name: owl.name, species: owl.species },
        arrivesAt: route[0]?.arrivesAt ?? now,
      };
    });
    ctx.hub.notify(me, 'owls', 'map', 'chats');
    return result;
  });

  /** Lend an owl to the post office for 7 days, once per calendar quarter (9.7). */
  app.post(
    '/api/owls/:id/menagerie',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const id = owlIdParam(request.params);
      const me = userOf(request).id;
      const now = ctx.now();
      const owl = ownOwl(ctx, me, id);
      if (!canLendToPostOffice(facts(owl)) || owl.name === null)
        throw new HttpError(400, 'owl_not_home');
      if (!canLendToPostOffice(facts(owl), owl.lent_quarter ?? null, now))
        throw new HttpError(400, 'owl_lent_this_quarter');
      const until = now + OWL.MENAGERIE_DAYS * TIME.DAY;
      ctx.db.transaction(() => {
        ctx.db.run(
          "UPDATE owls SET state = 'menagerie', state_until = ?, energy = ?, energy_at = ?, lent_quarter = ? WHERE id = ? AND state = 'home'",
          until,
          currentEnergy(ctx, owl, now),
          now,
          quarterOf(now),
          id,
        );
        leftHome(ctx, id, now);
        ctx.queue.schedule('menagerie_end', id, until);
      });
      ctx.hub.notify(me, 'owls');
      return { owl: owlView(ctx, ownOwl(ctx, me, id), now) };
    },
  );

  /** Today's offer with the names rolled for this user (9.6). */
  app.get('/api/menagerie', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const now = ctx.now();
    const day = utcDay(now);
    // Borrowed today (v0.3.2: the limit is per offer day, not for all loan owls at once).
    const loaned = loanedOn(ctx, me, day);
    const identities = loanIdentitiesFor(ctx, me, day);
    return {
      day,
      // v1.1: one whole team a day, every species once (offers from before: four species).
      maxLoans: offerOf(ctx, me, day).length,
      team: offerTeamOf(ctx, me, day),
      loans: loaned.length,
      // v0.8.5: a loan of this offer day that is over (vanished after the last stop, back with
      // replies, or expired unused) hides its offer until the next day; it still counts.
      offer: offerOf(ctx, me, day)
        .filter((species) => !loaned.includes(species) || loanStillHere(ctx, me, species, day))
        .map((species) => ({
          species,
          name: identities.get(species)?.name ?? '',
          sex: identities.get(species)?.sex ?? 'f',
          loaned: loaned.includes(species),
          // v0.10: price and carrying capacity depend on the species.
          price: loanPrice(species),
          cargo: cargoOf(species),
        })),
    };
  });

  app.post('/api/menagerie/loan', { preHandler: authenticated }, async (request) => {
    const body = parse(Loan, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const owl = ctx.db.transaction(() => borrow(ctx, me, body.species, now));
    ctx.hub.notify(me, 'owls', 'profile', 'finance');
    return { owl: owlView(ctx, owl, now) };
  });

  /** The holder gives one chick of a clutch away, optionally with a cover letter (9.9). */
  app.post('/api/clutches/:id/gift/prepare', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(accountClientKey(request, userOf(request).id), ctx.now()) > 0)
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
    requireRoom(ctx, body.recipient);
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
      const clutch = ctx.db.get<{ gift_all: number }>(
        "SELECT gift_all FROM clutches WHERE id = ? AND owner_id = ? AND gift_state = 'open'",
        clutchId,
        me,
      );
      if (!clutch) throw new HttpError(400, 'clutch_done');
      for (const recipient of token.recipients) requireRoom(ctx, recipient);
      const { route, owl } = depart(ctx, token, letters, now);
      // One chick – v1.4 beyond the limit all of them, one after the other (9.9).
      const left =
        ctx.db.get<{ n: number }>(
          "SELECT COUNT(*) AS n FROM owls WHERE clutch_id = ? AND owner_id = ? AND is_chick = 1 AND state = 'home'",
          clutchId,
          me,
        )?.n ?? 0;
      if (clutch.gift_all === 0 || left === 0) {
        ctx.db.run("UPDATE clutches SET gift_state = 'sent' WHERE id = ?", clutchId);
        // The chicks that stay are free now; during a holiday they fly to the island.
        sendOwlsOnVacation(ctx, me, now);
      }
      return {
        owl: { name: owl.name, species: owl.species },
        arrivesAt: route[0]?.arrivesAt ?? now,
      };
    });
    ctx.hub.notify(me, 'owls', 'map', 'chats', 'profile');
    return result;
  });

  /** v1.5.0: the big notice about a chick to give away was shown today (SPEC 9.9). */
  app.post(
    '/api/clutches/:id/notice-seen',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const clutchId = owlIdParam(request.params);
      const me = userOf(request).id;
      clutchNoticeSeen(ctx, me, clutchId, ctx.now());
      ctx.hub.notify(me, 'profile');
      return { ok: true };
    },
  );

  /** v1.4: holiday mode (SPEC 8.10, 9.12). */
  app.get('/api/vacation', { preHandler: authenticated }, async (request) =>
    vacationView(ctx, userOf(request).id, ctx.now()),
  );

  app.post('/api/vacation', { preHandler: authenticated }, async (request) => {
    const body = parse(VacationPlan, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const after: (() => void)[] = [];
    ctx.db.transaction(() => planVacation(ctx, me, body, now, (work) => after.push(work)));
    for (const work of after) work();
    return vacationView(ctx, me, now);
  });

  /** A planned holiday is called off (it does not count). */
  app.post('/api/vacation/cancel', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const me = userOf(request).id;
    const after: (() => void)[] = [];
    ctx.db.transaction(() => cancelVacation(ctx, me, (work) => after.push(work)));
    for (const work of after) work();
    return vacationView(ctx, me, ctx.now());
  });

  /** The running holiday ends early: the owls fly home at once. */
  app.post('/api/vacation/end', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const me = userOf(request).id;
    const now = ctx.now();
    const after: (() => void)[] = [];
    ctx.db.transaction(() => endVacation(ctx, me, now, (work) => after.push(work)));
    for (const work of after) work();
    return vacationView(ctx, me, now);
  });
}
