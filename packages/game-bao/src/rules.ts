/**
 * Bao turn resolution.
 *
 * A Bao move is a complete turn. `simulate` plays one turn from its choices
 * (start pit, direction, capture entry kichwa, nyumba stop/safari) one seed at
 * a time; when the turn reaches a choice the caller has not made it reports
 * which choice is needed. `getLegalMoves` expands every start through those
 * choices, so the legal set lists every legal turn, and the reducer replays a
 * submitted move from its choices alone — the client-supplied path is never
 * trusted.
 *
 * Ruleset: Bao la Kiswahili after De Voogt (Zanzibar), without the disputed
 * kutakatia pit-blocking and nyumba taxation rules.
 */

import {
  type Player,
  type ReducerResult,
  type ScoreResult,
  type Seat,
  createRng,
} from "@card-games/engine-core";
import {
  type BaoCapture,
  type BaoConfig,
  type BaoEndReason,
  type BaoMove,
  type BaoState,
  type BaoVariant,
  type Kichwa,
  type SowDirection,
  type SowSegment,
  FRONT,
  INFINITE_CUTOFF,
  KICHWA,
  NYUMBA,
  RING,
  isFront,
  opposite,
  step,
} from "./state";

export const BAO_VARIANTS: readonly BaoVariant[] = [
  "bao-la-kiswahili",
  "bao-la-kujifunza",
];

export function defaultBaoConfig(): BaoConfig {
  return { variant: "bao-la-kiswahili" };
}

// ---- setup ------------------------------------------------------------------

function startingPits(variant: BaoVariant): number[] {
  if (variant === "bao-la-kujifunza") return Array<number>(RING).fill(2);
  const pits = Array<number>(RING).fill(0);
  // 6 in the nyumba and 2 in each of the two pits to its right.
  pits[NYUMBA] = 6;
  pits[NYUMBA + 1] = 2;
  pits[NYUMBA + 2] = 2;
  return pits;
}

export function createInitialState(
  config: BaoConfig,
  players: Player[],
  seed: string | number,
): BaoState {
  const variant = config?.variant ?? "bao-la-kiswahili";
  if (!BAO_VARIANTS.includes(variant)) {
    throw new Error(`Unsupported Bao variant "${String(variant)}"`);
  }
  if (players.length !== 2) throw new Error("Bao is played by exactly two players");
  const learner = variant === "bao-la-kujifunza";
  const state: BaoState = {
    gameId: "bao",
    rng: createRng(seed),
    players,
    activeSeat: 0,
    phase: learner ? "mtaji" : "kunamua",
    version: 0,
    variant,
    config: { ...config, variant },
    pits: { 0: startingPits(variant), 1: startingPits(variant) },
    reserves: { 0: learner ? 0 : 22, 1: learner ? 0 : 22 },
    nyumba: { 0: !learner, 1: !learner },
    lastMove: null,
    turn: 0,
    winner: null,
    endReason: null,
  };
  return state;
}

// ---- simulation -------------------------------------------------------------

/** How a turn begins. */
export interface TurnStart {
  kind: "capture" | "kutakata";
  start: number;
  direction: SowDirection | null;
  fromReserve: boolean;
}

/** Choices made at branch points during the turn. */
export interface TurnChoices {
  entry: Kichwa | null;
  safari: boolean | null;
}

/** The finished turn, or the branch point that still needs a choice. */
export type SimResult =
  | { status: "done"; move: Omit<BaoMove, "seat" | "type">; board: TurnBoard }
  | { status: "needs"; choice: "entry" | "safari" }
  | { status: "illegal" };

/** The board as one turn changes it. */
export interface TurnBoard {
  own: number[];
  opp: number[];
  ownReserve: number;
  ownHouse: boolean;
  oppHouse: boolean;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const frontEmpty = (pits: readonly number[]) => {
  for (let i = 0; i < FRONT; i++) if (pits[i]! > 0) return false;
  return true;
};

/** Is the seat's turn played under namua rules (reserve seeds remaining)? */
const namuaTurn = (state: BaoState, seat: Seat) => state.reserves[seat]! > 0;

/**
 * Play one turn for `seat`. Pure: the state is not modified.
 */
export function simulate(
  state: BaoState,
  seat: Seat,
  start: TurnStart,
  choices: TurnChoices,
): SimResult {
  const opponent = 1 - seat;
  const namua = namuaTurn(state, seat);
  const board: TurnBoard = {
    own: state.pits[seat]!.slice(),
    opp: state.pits[opponent]!.slice(),
    ownReserve: state.reserves[seat]!,
    ownHouse: state.nyumba[seat]!,
    oppHouse: state.nyumba[opponent]!,
  };
  const { own, opp } = board;
  const capturing = start.kind === "capture";
  const path: SowSegment[] = [];
  const captures: BaoCapture[] = [];
  let dir: SowDirection | null = start.direction;
  let sown = 0;
  let entryUsed: Kichwa | null = null;
  let safariUsed: boolean | null = null;

  /** Lift the seeds of an own pit; picking up the nyumba ends its house status. */
  const lift = (pit: number): number => {
    const n = own[pit]!;
    own[pit] = 0;
    if (pit === NYUMBA) board.ownHouse = false;
    return n;
  };

  /** Sow `n` seeds starting AT `first`, in `d`; returns the last pit. */
  const sowInto = (
    source: SowSegment["source"],
    from: number,
    first: number,
    n: number,
    d: SowDirection,
  ): number => {
    const pits: number[] = [];
    let at = first;
    for (let k = 0; k < n; k++) {
      if (k > 0) at = step(at, d);
      own[at]! += 1;
      pits.push(at);
    }
    sown += n;
    path.push({ source, from, pits });
    return at;
  };

  // --- begin the turn -------------------------------------------------------
  let landed: number; // pit where the latest sowing ended
  let mustCaptureAt: number | null = null;

  if (start.fromReserve) {
    // Namua: one reserve seed into a nonempty front-row pit.
    own[start.start]! += 1;
    board.ownReserve -= 1;
    sown += 1;
    path.push({ source: "reserve", from: start.start, pits: [start.start] });
    if (capturing) {
      mustCaptureAt = start.start;
      landed = start.start;
    } else {
      const d = start.direction!;
      const n = lift(start.start);
      landed = sowInto("pit", start.start, step(start.start, d), n, d);
    }
  } else {
    const d = start.direction!;
    const n = lift(start.start);
    landed = sowInto("pit", start.start, step(start.start, d), n, d);
  }

  // --- resolve sowings until the turn ends ----------------------------------
  for (;;) {
    const canCapture =
      capturing && isFront(landed) && own[landed]! > 1 && opp[opposite(landed)]! > 0;

    if (mustCaptureAt !== null || canCapture) {
      mustCaptureAt = null;
      // Capture the opposite pit.
      const target = opposite(landed);
      const seeds = opp[target]!;
      opp[target] = 0;
      if (target === NYUMBA) board.oppHouse = false;
      captures.push({ by: landed, pit: target, seeds });

      // Choose the kichwa the captured seeds enter through.
      let kichwa: Kichwa;
      if (landed <= 1) kichwa = 0;
      else if (landed >= 6) kichwa = 7;
      else if (dir !== null) kichwa = dir === 1 ? 0 : 7;
      else {
        if (choices.entry === null) return { status: "needs", choice: "entry" };
        kichwa = choices.entry;
        entryUsed = kichwa;
      }
      dir = kichwa === 0 ? 1 : -1;
      landed = sowInto("capture", kichwa, kichwa, seeds, dir);
      continue;
    }

    // Last seed fell into an empty pit: the turn ends.
    if (own[landed] === 1) break;

    // A working nyumba during namua: stop, or choose safari on a capturing turn.
    if (namua && landed === NYUMBA && board.ownHouse && own[NYUMBA]! >= 6) {
      if (!capturing) break;
      if (choices.safari === null) return { status: "needs", choice: "safari" };
      safariUsed = choices.safari;
      if (!choices.safari) break;
    }

    // Relay: pick the pit up and keep sowing in the same direction.
    if (sown > INFINITE_CUTOFF) {
      return done(true);
    }
    if (!namua && !isFront(landed) && frontEmpty(own)) {
      return { status: "illegal" };
    }
    const d = dir!;
    const n = lift(landed);
    landed = sowInto("pit", landed, step(landed, d), n, d);
  }

  return done(false);

  function done(infinite: boolean): SimResult {
    return {
      status: "done",
      board,
      move: {
        kind: start.kind,
        start: start.start,
        direction: start.direction,
        entry: entryUsed,
        safari: safariUsed,
        fromReserve: start.fromReserve,
        path,
        captures,
        sown,
        infinite,
      },
    };
  }
}

/**
 * Does sowing a pit of 2..15 seeds in `dir` end in a capture? With fewer than
 * 16 seeds no pit is passed twice, so the last seed lands `n` pits away in a
 * pit that gains exactly one seed.
 */
function lapCaptures(
  own: readonly number[],
  opp: readonly number[],
  pit: number,
  dir: SowDirection,
): boolean {
  const n = own[pit]!;
  const last = (((pit + dir * n) % RING) + RING) % RING;
  return isFront(last) && own[last]! >= 1 && opp[opposite(last)]! > 0;
}

/** Every way the seat may begin its turn, already filtered by the phase rules. */
export function turnStarts(state: BaoState, seat: Seat): TurnStart[] {
  const own = state.pits[seat]!;
  const opp = state.pits[1 - seat]!;
  const dirs: SowDirection[] = [1, -1];

  if (namuaTurn(state, seat)) {
    // Capture by placing a reserve seed opposite a nonempty pit is compulsory.
    const captures: TurnStart[] = [];
    for (let p = 0; p < FRONT; p++) {
      if (own[p]! > 0 && opp[opposite(p)]! > 0) {
        captures.push({ kind: "capture", start: p, direction: null, fromReserve: true });
      }
    }
    if (captures.length) return captures;
    // Otherwise kutakata from an occupied front-row pit that is not a working nyumba.
    const working = state.nyumba[seat]! && own[NYUMBA]! >= 6;
    const out: TurnStart[] = [];
    for (let p = 0; p < FRONT; p++) {
      if (own[p]! === 0 || (p === NYUMBA && working)) continue;
      for (const d of dirs)
        out.push({ kind: "kutakata", start: p, direction: d, fromReserve: true });
    }
    return out;
  }

  // Mtaji: compulsory capture from a pit of 2..15 seeds whose lap ends in a capture.
  const captures: TurnStart[] = [];
  for (let p = 0; p < RING; p++) {
    const n = own[p]!;
    if (n < 2 || n >= 16) continue;
    for (const d of dirs) {
      if (lapCaptures(own, opp, p, d)) {
        captures.push({ kind: "capture", start: p, direction: d, fromReserve: false });
      }
    }
  }
  if (captures.length) return captures;

  // Kutakata: front row preferred; back row only when no front pit has 2+.
  const occupiedFront = [];
  for (let p = 0; p < FRONT; p++) if (own[p]! > 0) occupiedFront.push(p);
  const frontStarts = occupiedFront.filter((p) => own[p]! >= 2);
  const out: TurnStart[] = [];
  if (frontStarts.length) {
    const soleKichwa =
      occupiedFront.length === 1 && (occupiedFront[0] === 0 || occupiedFront[0] === 7);
    for (const p of frontStarts) {
      for (const d of dirs) {
        // A sole occupied kichwa sows toward the centre along the front row.
        if (soleKichwa && ((p === 0 && d === -1) || (p === 7 && d === 1))) continue;
        out.push({ kind: "kutakata", start: p, direction: d, fromReserve: false });
      }
    }
    return out;
  }
  for (let p = FRONT; p < RING; p++) {
    if (own[p]! < 2) continue;
    for (const d of dirs)
      out.push({ kind: "kutakata", start: p, direction: d, fromReserve: false });
  }
  return out;
}

/** A legal move together with the board it produces. */
export interface ResolvedTurn {
  move: BaoMove;
  board: TurnBoard;
}

/** Expand every start through its branch choices into complete turns. */
export function resolveTurns(state: BaoState, seat: Seat): ResolvedTurn[] {
  const out: ResolvedTurn[] = [];
  for (const start of turnStarts(state, seat)) {
    const queue: TurnChoices[] = [{ entry: null, safari: null }];
    while (queue.length) {
      const choices = queue.shift()!;
      const r = simulate(state, seat, start, choices);
      if (r.status === "done") {
        out.push({ move: { type: "sow", seat, ...r.move }, board: r.board });
      } else if (r.status === "needs") {
        if (r.choice === "entry") {
          for (const k of KICHWA) queue.push({ ...choices, entry: k });
        } else {
          queue.push({ ...choices, safari: false }, { ...choices, safari: true });
        }
      }
    }
  }
  return out;
}

export function getLegalMoves(state: BaoState, seat: Seat): BaoMove[] {
  if (state.phase === "finished" || state.activeSeat !== seat) return [];
  return resolveTurns(state, seat).map((t) => t.move);
}

// ---- reducer ----------------------------------------------------------------

/** Same turn choices? (the identifying part of a move) */
export function sameChoices(a: BaoMove, b: BaoMove): boolean {
  return (
    a.kind === b.kind &&
    a.start === b.start &&
    a.direction === b.direction &&
    a.entry === b.entry &&
    a.safari === b.safari &&
    a.fromReserve === b.fromReserve
  );
}

/** Does a submitted move describe exactly what the turn really does? */
function sameOutcome(real: BaoMove, claimed: BaoMove): boolean {
  return (
    real.sown === claimed.sown &&
    real.infinite === claimed.infinite &&
    JSON.stringify(real.path) === JSON.stringify(claimed.path) &&
    JSON.stringify(real.captures) === JSON.stringify(claimed.captures)
  );
}

function finish(state: BaoState, winner: Seat, reason: BaoEndReason): BaoState {
  return { ...state, phase: "finished", activeSeat: null, winner, endReason: reason };
}

/** Apply a resolved turn and settle the end-of-turn rules. */
export function applyTurn(state: BaoState, seat: Seat, turn: ResolvedTurn): BaoState {
  const opponent = 1 - seat;
  const { board, move } = turn;
  const reserves = { ...state.reserves, [seat]: board.ownReserve };
  const next: BaoState = {
    ...state,
    pits: { ...state.pits, [seat]: board.own, [opponent]: board.opp },
    reserves,
    nyumba: {
      ...state.nyumba,
      // Once lost, house status never returns.
      [seat]: board.ownHouse,
      [opponent]: board.oppHouse,
    },
    lastMove: move,
    turn: state.turn + 1,
    activeSeat: opponent,
    phase: reserves[0]! > 0 || reserves[1]! > 0 ? "kunamua" : "mtaji",
  };

  if (move.infinite) return finish(next, opponent, "infinite-turn");
  if (frontEmpty(next.pits[opponent]!)) return finish(next, seat, "front-row-empty");
  // Our own empty front row only loses after the opponent's turn (checked then).
  if (resolveTurns(next, opponent).length === 0)
    return finish(next, seat, "no-legal-move");
  return next;
}

export function reducer(state: BaoState, move: BaoMove): ReducerResult<BaoState> {
  if (state.phase === "finished")
    return { ok: false, error: "Game is already over", state };
  if (move?.type !== "sow" || move.seat !== state.activeSeat) {
    return { ok: false, error: "Not your turn", state };
  }
  // Re-simulate from the move's choices; never trust its path or captures —
  // a move whose description disagrees with the real turn is forged.
  const turn = resolveTurns(state, move.seat).find((t) => sameChoices(t.move, move));
  if (!turn || !sameOutcome(turn.move, move)) {
    return { ok: false, error: "Illegal move", state };
  }
  return { ok: true, state: applyTurn(state, move.seat, turn) };
}

// ---- scoring ----------------------------------------------------------------

/** Seeds a seat holds on the board plus in reserve. */
export function seedsOf(state: BaoState, seat: Seat): number {
  return sum(state.pits[seat]!) + state.reserves[seat]!;
}

export function getScores(state: BaoState): ScoreResult {
  const bySeat: Record<Seat, number> = {};
  for (const p of state.players) bySeat[p.seat] = seedsOf(state, p.seat);
  return { bySeat, winners: state.winner === null ? [] : [state.winner] };
}

/** Is a seat's front row currently empty? */
export const isFrontRowEmpty = (state: BaoState, seat: Seat) =>
  frontEmpty(state.pits[seat]!);
