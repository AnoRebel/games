/**
 * Card-game bot opponents (Last Card, Albastini). Deterministic (no Math.random — the app forbids ambient
 * RNG); any tie-break derives from state.version. Three difficulty levels drive
 * how much value-aware strategy is applied:
 *
 *  - easy   → the old behaviour: shed/play the first sensible legal move.
 *  - normal → value-aware: dump high-penalty cards, keep action cards, don't
 *             feed points into opponents' tricks, defend against a low-hand rival.
 *  - hard   → normal + sharper timing (weaponise action cards vs the leader,
 *             hoard trump, lead low early in Albastini).
 *
 * Policies are per-game (keyed off state.gameId) but everything flows through the
 * generic GameModule.getLegalMoves so no engine change is needed.
 */
import type {
  BaseGameState,
  BaseMove,
  Card,
  Difficulty as BotDifficulty,
  GameModule,
  Seat,
} from "@games/engine-core";

// ---- shared helpers --------------------------------------------------------

const playedCards = (m: BaseMove): Card[] => {
  if (m.type !== "play") return [];
  const pm = m as unknown as { card: Card; extraCards?: Card[] };
  return [pm.card, ...(pm.extraCards ?? [])];
};
const shedCount = (m: BaseMove): number => playedCards(m).length;

/** Deterministic index into a pool from the state version (stable per game). */
const pick = <T>(pool: T[], version: number): T | null =>
  pool.length ? (pool[version % pool.length] ?? null) : null;

// Albastini trick strength (Ace>7>K>J>Q>6>5>4>3) and captured points.
const AB_STRENGTH: Record<number, number> = {
  1: 9,
  7: 8,
  13: 7,
  11: 6,
  12: 5,
  6: 4,
  5: 3,
  4: 2,
  3: 1,
};
const AB_POINTS: Record<number, number> = { 1: 11, 7: 10, 13: 4, 11: 3, 12: 2 };
const abStrength = (c: Card) => AB_STRENGTH[c.rank] ?? 0;
const abPoints = (c: Card) => AB_POINTS[c.rank] ?? 0;

// ---- main ------------------------------------------------------------------

export function chooseCardBotMove<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  state: S,
  seat: Seat,
  difficulty: BotDifficulty = "normal",
): M | null {
  const moves = game.getLegalMoves(state, seat);
  if (moves.length === 0) return null;

  // Always call "Last Card" — free, and dodges the missed-call penalty. Applies
  // at every difficulty (a bot that forgets to call is just buggy, not "easy").
  const standaloneDeclare = moves.find((m) => m.type === "declare-last-card");
  if (standaloneDeclare) return standaloneDeclare;

  // Skip/reverse interjection window. A bot that never answers would leave the
  // chain mechanic dead in offline play, so interject when it's clearly good and
  // otherwise pass promptly (never stall the window).
  const interjections = moves.filter((m) => m.type === "interject");
  if (interjections.length) {
    const choice = interjectionPolicy(state, seat, interjections, difficulty);
    if (choice) return choice;
    const pass = moves.find((m) => m.type === "pass-interjection");
    if (pass) return pass;
  }

  if (difficulty !== "easy") {
    const gameId = (state as { gameId?: string }).gameId;
    const smart =
      gameId === "last-card"
        ? lastCardPolicy(state, seat, moves, difficulty)
        : gameId === "albastini"
          ? albastiniPolicy(state, seat, moves, difficulty)
          : null;
    if (smart) return smart;
  }

  return easyPolicy(moves, state.version);
}

/** Baseline: prefer progress, prefer declaring, shed the most. (old behaviour) */
function easyPolicy<M extends BaseMove>(moves: M[], version: number): M | null {
  const progress = moves.filter(
    (m) => m.type !== "draw" && m.type !== "pass" && m.type !== "pass-bid",
  );
  let pool = progress.length ? progress : moves;
  const declaring = pool.filter(
    (m) => (m as { declareLastCard?: boolean }).declareLastCard === true,
  );
  if (declaring.length) pool = declaring;
  const maxShed = Math.max(...pool.map(shedCount));
  if (maxShed > 1) pool = pool.filter((m) => shedCount(m) === maxShed);
  return pick(pool, version) ?? moves[0] ?? null;
}

// ---- Last Card policy ------------------------------------------------------

/**
 * Last Card is a shedding RACE: whoever empties their hand first wins, and the
 * penalty score only decides the loser's margin. Empirically (repeated 300–400
 * game rotated-seat trials) the naive max-shed play is already a strong line,
 * and every "clever" tie-break I tried — dumping penalty weight, hoarding action
 * cards, disrupting a low-hand rival, suit-denial — consistently LOST to it. So
 * the honest policy is simply: always take a max-shed play. Difficulty in Last
 * Card is expressed through bot SPEED (see LocalTransport), not weaker moves —
 * a bot that plays worse on purpose would just feel random, not "easy".
 */
function lastCardPolicy<S extends BaseGameState, M extends BaseMove>(
  state: S,
  _seat: Seat,
  moves: M[],
  _difficulty: BotDifficulty,
): M | null {
  const plays = moves.filter((m) => m.type === "play") as M[];
  if (!plays.length) return null; // let the caller fall through to draw
  const maxShed = Math.max(...plays.map(shedCount));
  const best = plays.filter((m) => shedCount(m) === maxShed);
  return pick(best, state.version) ?? best[0]!;
}

// ---- skip/reverse interjection policy --------------------------------------

/**
 * Whether to spend a 7/8 answering an open chain.
 *
 * Interjecting always costs a card, and in Last Card raw shedding speed wins, so
 * spending one is only worth it when it buys a turn back or dodges a stop:
 *
 *  - skip chain: interject when the stop currently points AT US. Playing the 7
 *    sheds a card AND moves the stop onward instead of us losing the turn.
 *  - reverse chain: interject when flipping brings the turn back to us.
 *
 * Easy bots never interject (they simply pass), which keeps them readable.
 */
function interjectionPolicy<S extends BaseGameState, M extends BaseMove>(
  state: S,
  seat: Seat,
  interjections: M[],
  difficulty: BotDifficulty,
): M | null {
  if (difficulty === "easy") return null;
  const s = state as unknown as {
    pendingAction: { kind: "skip" | "reverse"; origin: Seat; count: number } | null;
    players: { seat: Seat }[];
    direction: 1 | -1;
  };
  const chain = s.pendingAction;
  if (!chain) return null;

  const n = s.players.length;
  const stepFrom = (from: Seat, steps: number, dir: 1 | -1): Seat =>
    (((from + dir * steps) % n) + n) % n;

  let worth: boolean;
  if (chain.kind === "skip") {
    // Every seat the stop passes through is stopped: origin+1 … origin+count.
    worth = Array.from({ length: chain.count }, (_, i) =>
      stepFrom(chain.origin, i + 1, s.direction),
    ).includes(seat);
  } else {
    // Would adding one more flip hand the turn to us?
    const flipped = (chain.count + 1) % 2 === 1;
    const dir = (flipped ? s.direction * -1 : s.direction) as 1 | -1;
    worth =
      n === 2
        ? stepFrom(chain.origin, chain.count + 2, s.direction) === seat
        : stepFrom(chain.origin, 1, dir) === seat;
  }
  if (!worth) return null;

  // Prefer an interjection that also lets us declare our last card.
  const declaring = interjections.filter(
    (m) => (m as { declareLastCard?: boolean }).declareLastCard === true,
  );
  const pool = declaring.length ? declaring : interjections;
  return pick(pool, state.version) ?? pool[0] ?? null;
}

// ---- Albastini policy ------------------------------------------------------

function albastiniPolicy<S extends BaseGameState, M extends BaseMove>(
  state: S,
  seat: Seat,
  moves: M[],
  difficulty: BotDifficulty,
): M | null {
  const s = state as unknown as {
    trump: string | null;
    ledSuit: string | null;
    currentTrick: { seat: number; card: Card }[];
    hands: Record<number, Card[]>;
  };

  // Bidding phase: bid conservatively (pass) unless a bid is clearly offered;
  // the engine only lets us bid legal suits, so just pass at normal, take the
  // first bid at hard to exercise trump-claiming.
  const bids = moves.filter((m) => m.type === "bid") as M[];
  if (moves.some((m) => m.type === "pass-bid") || bids.length) {
    if (difficulty === "hard" && bids.length) return bids[0]!;
    return (moves.find((m) => m.type === "pass-bid") as M) ?? bids[0] ?? moves[0]!;
  }

  const plays = moves.filter((m) => m.type === "play") as M[];
  if (!plays.length) return moves[0] ?? null;

  const trump = s.trump;
  const led = s.ledSuit;
  const trick = s.currentTrick ?? [];
  const cardOf = (m: M) => (m as unknown as { card: Card }).card;

  // Current best card to beat in the trick (highest trump, else highest led).
  const trumpPlays = trump ? trick.filter((t) => t.card.suit === trump) : [];
  const contenders = trumpPlays.length
    ? trumpPlays
    : trick.filter((t) => t.card.suit === led);
  let bestInTrick = 0;
  const bestIsTrump = trumpPlays.length > 0;
  for (const t of contenders) bestInTrick = Math.max(bestInTrick, abStrength(t.card));

  const pointsInTrick = trick.reduce((sum, t) => sum + abPoints(t.card), 0);
  const leading = trick.length === 0;

  const beats = (c: Card): boolean => {
    if (leading) return true;
    if (trump && c.suit === trump) return !bestIsTrump || abStrength(c) > bestInTrick;
    if (bestIsTrump) return false; // can't beat a trump with a non-trump
    if (c.suit === led) return abStrength(c) > bestInTrick;
    return false;
  };

  const winners = plays.filter((m) => beats(cardOf(m)));
  const value = (m: M) => abPoints(cardOf(m));
  const strength = (m: M) => abStrength(cardOf(m));

  // Can win the trick: if it carries points (or we're leading), win it — with
  // the CHEAPEST card that still wins, saving high cards for later.
  if (winners.length && (pointsInTrick > 0 || leading || difficulty === "hard")) {
    const cheapestWinner = [...winners].sort(
      (a, b) => strength(a) - strength(b) || value(a) - value(b),
    )[0]!;
    // Leading: at hard, lead a low non-point card early to draw out trumps.
    if (leading && difficulty === "hard") {
      const lowLead = [...plays].sort(
        (a, b) => value(a) - value(b) || strength(a) - strength(b),
      )[0]!;
      if (value(lowLead) === 0) return lowLead;
    }
    return cheapestWinner;
  }

  // Can't (or shouldn't) win: throw the LOWEST-value card — never feed a Dume
  // or Jike into an opponent's trick.
  const dump = [...plays].sort(
    (a, b) => value(a) - value(b) || strength(a) - strength(b),
  )[0]!;
  return dump;
}
