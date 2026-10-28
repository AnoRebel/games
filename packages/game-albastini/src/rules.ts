/**
 * Albastini rules engine: deal, bidding (otea), trump, trick play (no
 * follow-suit), draw-to-refill, and tiered victory-point scoring.
 * Pure and deterministic.
 */

import {
  type Card,
  type Player,
  type ReducerResult,
  type ScoreResult,
  type Seat,
  type Suit,
  cardId,
  createRng,
  deckWithout,
  nextSeat,
  shuffle,
} from "@games/engine-core";
import {
  type AlbastiniConfig,
  HAND_SIZE,
  STRIPPED_RANKS,
  pointValue,
  trickStrength,
} from "./config";
import type { AlbastiniMove, AlbastiniState, TrickPlay } from "./state";

/** Seat to the dealer's right leads first (counter-clockwise from dealer). */
function rightOf(seat: Seat, count: number): Seat {
  return nextSeat(seat, count, -1);
}

export function createInitialState(
  config: AlbastiniConfig,
  players: Player[],
  seed: string | number,
): AlbastiniState {
  const rng = createRng(seed);
  const shuffled = shuffle(deckWithout(STRIPPED_RANKS), rng);
  const deck = shuffled.items;
  const count = players.length;

  const hands: Record<Seat, Card[]> = {};
  const taken: Record<Seat, Card[]> = {};
  const victoryPoints: Record<Seat, number> = {};
  for (const p of players) {
    hands[p.seat] = [];
    taken[p.seat] = [];
    victoryPoints[p.seat] = 0;
  }

  let idx = 0;
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of players) {
      hands[p.seat]!.push(deck[idx++]!);
    }
  }
  const stock = deck.slice(idx);

  const dealer = 0;
  const bidding = config.enableBidding;
  const state: AlbastiniState = {
    gameId: "albastini",
    config,
    rng: shuffled.state,
    players,
    activeSeat: rightOf(dealer, count),
    phase: bidding ? "bidding" : "playing",
    version: 0,
    hands,
    stock,
    trump: null,
    trumpCard: null,
    bids: [],
    currentTrick: [],
    ledSuit: null,
    taken,
    hand: 0,
    victoryPoints,
    dealer,
  };
  // With bidding disabled, reveal trump immediately so play can begin.
  if (!bidding) revealTrump(state);
  return state;
}

/**
 * Reveal trump from the top of stock and resolve any matching bid.
 *
 * The turned trump indicator stays IN PLAY — it is slid to the BOTTOM of the
 * stock so it becomes the last card drawn (authentic rule; keeps every hand's
 * captured points totalling 120). If a bidder named the trump suit, they
 * EXCHANGE: their bid card is surrendered to the bottom of the stock (drawn
 * last, in the indicator's place) and the indicator enters their hand — so the
 * bidder's hand stays at HAND_SIZE and no card leaves circulation.
 */
function revealTrump(state: AlbastiniState): void {
  const trumpCard = state.stock[0];
  if (!trumpCard) {
    // No stock to turn (tiny tables) — leave trump unset (no-trump hand).
    state.trump = null;
    state.trumpCard = null;
  } else {
    state.trump = trumpCard.suit;
    // `trumpCard` is kept for DISPLAY only (which card set trump). The actual
    // card is now tracked by identity in the stock / a hand, and scoring sums
    // only the `taken` piles, so this display copy is never double-counted.
    state.trumpCard = trumpCard;
    const rest = state.stock.slice(1);
    // A bidder who named the trump suit claims the indicator by exchange.
    const matching = state.bids.find((b) => b.card.suit === state.trump);
    if (matching) {
      const hand = state.hands[matching.seat]!;
      const i = hand.findIndex((c) => cardId(c) === cardId(matching.card));
      if (i !== -1) {
        const bidCard = hand.splice(i, 1)[0]!;
        hand.push(trumpCard); // indicator into the bidder's hand
        // The surrendered bid card goes to the bottom of the stock (drawn last).
        state.stock = [...rest, bidCard];
      } else {
        // Defensive: bid card no longer in hand — keep the indicator in play.
        state.stock = [...rest, trumpCard];
      }
    } else {
      // No matching bid: the indicator simply becomes the last card drawn.
      state.stock = [...rest, trumpCard];
    }
  }
  state.phase = "playing";
  state.activeSeat = rightOf(state.dealer, state.players.length);
  state.ledSuit = null;
  state.currentTrick = [];
}

/** Bidders are everyone except the dealer (and, in teams, the dealer's team). */
function canBid(state: AlbastiniState, seat: Seat): boolean {
  if (seat === state.dealer) return false;
  if (state.config.teamMode !== "individual") {
    const dealerTeam = state.players[state.dealer]?.team;
    const seatTeam = state.players[seat]?.team;
    if (dealerTeam !== undefined && seatTeam === dealerTeam) return false;
  }
  return true;
}

export function getLegalMoves(state: AlbastiniState, seat: Seat): AlbastiniMove[] {
  if (state.phase === "finished" || state.activeSeat !== seat) return [];
  const hand = state.hands[seat] ?? [];

  if (state.phase === "bidding") {
    if (!canBid(state, seat)) return [{ type: "pass-bid", seat }];
    const usedSuits = new Set(state.bids.map((b) => b.card.suit));
    const moves: AlbastiniMove[] = [{ type: "pass-bid", seat }];
    for (const card of hand) {
      if (!usedSuits.has(card.suit)) moves.push({ type: "bid", seat, card });
    }
    return moves;
  }

  // Playing: any card may be played (no follow-suit requirement).
  return hand.map((card) => ({ type: "play", seat, card }));
}

/** Determine the winning seat of a completed trick. */
function trickWinner(trick: TrickPlay[], ledSuit: Suit, trump: Suit | null): Seat {
  const trumpPlays = trump ? trick.filter((t) => t.card.suit === trump) : [];
  const pool = trumpPlays.length
    ? trumpPlays
    : trick.filter((t) => t.card.suit === ledSuit);
  let best = pool[0]!;
  for (const p of pool) {
    if (trickStrength(p.card.rank) > trickStrength(best.card.rank)) best = p;
  }
  return best.seat;
}

/**
 * Refill hands to HAND_SIZE from stock, beginning with `from` (the trick
 * winner) and proceeding ANTICLOCKWISE — the same direction as play — so the
 * trump indicator at the bottom of the stock is drawn last, by the player to
 * the winner's right (authentic rule).
 */
function refill(state: AlbastiniState, from: Seat): void {
  const count = state.players.length;
  let seat = from;
  for (let n = 0; n < count; n++) {
    while (state.stock.length > 0 && (state.hands[seat]?.length ?? 0) < HAND_SIZE) {
      state.hands[seat]!.push(state.stock.shift()!);
    }
    seat = nextSeat(seat, count, -1);
  }
}

function clone(state: AlbastiniState): AlbastiniState {
  return {
    ...state,
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([s, h]) => [s, [...h]]),
    ) as Record<Seat, Card[]>,
    taken: Object.fromEntries(
      Object.entries(state.taken).map(([s, h]) => [s, [...h]]),
    ) as Record<Seat, Card[]>,
    stock: [...state.stock],
    bids: [...state.bids],
    currentTrick: [...state.currentTrick],
    victoryPoints: { ...state.victoryPoints },
  };
}

/** Are all hands empty (hand over)? */
function handsEmpty(state: AlbastiniState): boolean {
  return state.players.every((p) => (state.hands[p.seat]?.length ?? 0) === 0);
}

export function reducer(
  state: AlbastiniState,
  move: AlbastiniMove,
): ReducerResult<AlbastiniState> {
  if (state.phase === "finished") {
    return { ok: false, error: "Hand is over", state };
  }
  const count = state.players.length;

  switch (move.type) {
    case "bid":
    case "pass-bid": {
      if (state.phase !== "bidding") {
        return { ok: false, error: "Not bidding phase", state };
      }
      const next = clone(state);
      if (move.type === "bid") {
        next.bids.push({ seat: move.seat, card: move.card });
      }
      // Advance bidding around the non-dealer seats; when we return to the
      // lead bidder position (all eligible have acted), reveal trump.
      const lead = rightOf(state.dealer, count);
      const nextSeatToAct = nextSeat(move.seat, count, -1);
      // Skip back to dealer means bidding is complete.
      if (nextSeatToAct === state.dealer || nextSeatToAct === lead) {
        revealTrump(next);
      } else {
        next.activeSeat = nextSeatToAct;
      }
      return { ok: true, state: next };
    }

    case "play": {
      if (state.phase !== "playing") {
        return { ok: false, error: "Not playing phase", state };
      }
      const hand = state.hands[move.seat] ?? [];
      const idx = hand.findIndex((c) => cardId(c) === cardId(move.card));
      if (idx === -1) return { ok: false, error: "Card not in hand", state };

      const next = clone(state);
      next.hands[move.seat]!.splice(idx, 1);
      next.currentTrick.push({ seat: move.seat, card: move.card });
      if (next.ledSuit === null) next.ledSuit = move.card.suit;

      // Find the next seat (clockwise — to the right) that still holds cards and
      // has not yet played in this trick. The trick completes when there is no
      // such seat (handles the endgame where some players are already out).
      const playedSeats = new Set(next.currentTrick.map((t) => t.seat));
      let nextActor: Seat | null = null;
      let probe = nextSeat(move.seat, count, -1);
      for (let n = 0; n < count; n++) {
        if (!playedSeats.has(probe) && (next.hands[probe]?.length ?? 0) > 0) {
          nextActor = probe;
          break;
        }
        probe = nextSeat(probe, count, -1);
      }

      if (nextActor !== null) {
        next.activeSeat = nextActor;
        return { ok: true, state: next };
      }

      // Trick complete: resolve, award cards, refill, set leader.
      const winner = trickWinner(next.currentTrick, next.ledSuit!, next.trump);
      for (const tp of next.currentTrick) next.taken[winner]!.push(tp.card);
      next.currentTrick = [];
      next.ledSuit = null;
      refill(next, winner);

      if (handsEmpty(next)) {
        finalizeHand(next);
      } else {
        // Winner leads — unless they are out of cards, then the next seat with
        // cards leads.
        let leader = winner;
        for (let n = 0; n < count; n++) {
          if ((next.hands[leader]?.length ?? 0) > 0) break;
          leader = nextSeat(leader, count, -1);
        }
        next.activeSeat = leader;
      }
      return { ok: true, state: next };
    }
  }
}

/** Sum captured points for a seat (incl. the trump card if claimed in hand). */
function takenPoints(state: AlbastiniState, seat: Seat): number {
  return (state.taken[seat] ?? []).reduce((s, c) => s + pointValue(c.rank), 0);
}

/** Group seats into scoring units (teams or individuals). */
function scoringUnits(state: AlbastiniState): Seat[][] {
  if (state.config.teamMode === "individual") {
    return state.players.map((p) => [p.seat]);
  }
  const byTeam = new Map<number, Seat[]>();
  for (const p of state.players) {
    const t = p.team ?? p.seat;
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t)!.push(p.seat);
  }
  return [...byTeam.values()];
}

/** Award victory points for the completed hand and advance / finish. */
function finalizeHand(state: AlbastiniState): void {
  const units = scoringUnits(state);
  const unitScore = units.map((seats) => ({
    seats,
    points: seats.reduce((s, seat) => s + takenPoints(state, seat), 0),
  }));

  const max = Math.max(...unitScore.map((u) => u.points));
  const topUnits = unitScore.filter((u) => u.points === max);

  // The winner of the hand (or a member of the winning unit) deals next; on a
  // tie the same player re-deals. The winning unit's dealer is its top scorer.
  let nextDealer = state.dealer;
  if (topUnits.length === 1) {
    const winner = topUnits[0]!;
    const vp = victoryPointsFor(state, unitScore);
    for (const seat of winner.seats) {
      state.victoryPoints[seat] = (state.victoryPoints[seat] ?? 0) + vp;
    }
    nextDealer = winner.seats.reduce(
      (best, seat) => (takenPoints(state, seat) > takenPoints(state, best) ? seat : best),
      winner.seats[0]!,
    );
  }

  if (state.hand + 1 >= state.config.hands) {
    state.phase = "finished";
    state.activeSeat = null;
  } else {
    startNextHand(state, nextDealer);
  }
}

/** Compute VP awarded based on the threshold rules per mode. */
function victoryPointsFor(
  state: AlbastiniState,
  unitScore: { seats: Seat[]; points: number }[],
): number {
  const mode = state.config.teamMode;
  if (mode === "individual") {
    // 1 VP if every player ate ≥ 10, else 2.
    return unitScore.every((u) => u.points >= 10) ? 1 : 2;
  }
  if (mode === "teams-of-two") {
    return unitScore.every((u) => u.points >= 20) ? 1 : 2;
  }
  // teams-of-three: based on the losing team's total.
  const min = Math.min(...unitScore.map((u) => u.points));
  return min >= 30 ? 1 : 2;
}

/** Deal a fresh hand. `dealer` is the hand winner (or same seat after a tie). */
function startNextHand(state: AlbastiniState, dealer: Seat): void {
  const count = state.players.length;
  const reseed = createRng(state.rng.seed ^ (state.hand + 1));
  const shuffled = shuffle(deckWithout(STRIPPED_RANKS), reseed);
  const deck = shuffled.items;
  for (const p of state.players) {
    state.hands[p.seat] = [];
    state.taken[p.seat] = [];
  }
  let idx = 0;
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of state.players) state.hands[p.seat]!.push(deck[idx++]!);
  }
  state.stock = deck.slice(idx);
  state.rng = shuffled.state;
  state.trump = null;
  state.trumpCard = null;
  state.bids = [];
  state.currentTrick = [];
  state.ledSuit = null;
  state.hand += 1;
  state.dealer = dealer;
  state.phase = state.config.enableBidding ? "bidding" : "playing";
  state.activeSeat = rightOf(state.dealer, count);
  if (!state.config.enableBidding) revealTrump(state);
}

export function getScores(state: AlbastiniState): ScoreResult {
  const bySeat: Record<Seat, number> = {};
  for (const p of state.players) bySeat[p.seat] = takenPoints(state, p.seat);

  const vp = state.victoryPoints;
  const maxVp = Math.max(0, ...Object.values(vp));
  const winners =
    state.phase === "finished" && maxVp > 0
      ? Object.entries(vp)
          .filter(([, v]) => v === maxVp)
          .map(([s]) => Number(s))
      : [];

  return { bySeat, victoryBySeat: { ...vp }, winners };
}
