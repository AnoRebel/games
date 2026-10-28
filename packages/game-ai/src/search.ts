/**
 * Deterministic alpha-beta search shared by the board-game bots.
 *
 * Budgets are counted in visited nodes, never wall-clock time, so a slow
 * machine returns the same move as a fast one. Iterative deepening keeps the
 * best move of the last fully completed depth; a depth the budget cuts short
 * is discarded. Move ordering and tie-breaks are fixed (captures first, then
 * the previous best, then a stable move key), so equal positions always
 * produce equal decisions.
 *
 * The search is written as a generator that yields every `yieldEvery` nodes.
 * Driven synchronously (Nitro, tests) the yields are ignored; driven by
 * `runAsync` the browser gets the event loop back once a slice has used its
 * time. Both run exactly the same code, so the chosen move cannot differ.
 */

import type { Seat } from "@games/engine-core";

/** Everything the search needs to know about one game. */
export interface SearchAdapter<S, M> {
  /** Legal moves for the side to move and the states they lead to. */
  expand(state: S, seat: Seat): { move: M; child: S }[];
  /** Winner/draw of a finished state, or null while play continues. */
  outcome(state: S): { winner: Seat | null } | null;
  /** Static evaluation from `seat`'s point of view (higher is better). */
  evaluate(state: S, seat: Seat, strong: boolean): number;
  /** Ordering weight: higher is searched first (e.g. captures). */
  weight(move: M): number;
  /** Stable key used to break ordering ties. */
  moveKey(move: M): string;
  /** Position key for the transposition table. */
  positionKey(state: S, seat: Seat): string;
}

export interface SearchLimits {
  /** Deepest iteration to attempt. */
  maxDepth: number;
  /** Maximum nodes visited across all iterations. */
  nodeBudget: number;
  /** Use the stronger evaluation. */
  strong: boolean;
  /** Use a transposition table. */
  transpositions: boolean;
}

export interface SearchResult<M> {
  move: M | null;
  score: number;
  /** Deepest iteration that completed within budget (0 when none did). */
  completedDepth: number;
  nodes: number;
}

export const WIN = 1_000_000;

interface TTEntry {
  depth: number;
  score: number;
  flag: 0 | 1 | 2; // exact | lower bound | upper bound
  best: string | null;
}

/** Thrown to unwind an iteration that ran out of nodes. */
class BudgetExceeded extends Error {}

/** Generator form of the search; see `runSync` / `runAsync`. */
export function* searchSteps<S, M>(
  adapter: SearchAdapter<S, M>,
  root: S,
  seat: Seat,
  limits: SearchLimits,
  yieldEvery = 250,
): Generator<void, SearchResult<M>> {
  let nodes = 0;
  const tt = new Map<string, TTEntry>();
  const other = (s: Seat): Seat => (1 - s) as Seat;

  const ordered = (children: { move: M; child: S }[], hint: string | null) =>
    children
      .map((c) => ({
        ...c,
        key: adapter.moveKey(c.move),
        weight: adapter.weight(c.move),
      }))
      .sort(
        (a, b) =>
          Number(b.key === hint) - Number(a.key === hint) ||
          b.weight - a.weight ||
          (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
      );

  function* visit(): Generator<void, void> {
    nodes++;
    if (nodes > limits.nodeBudget) throw new BudgetExceeded();
    if (nodes % yieldEvery === 0) yield;
  }

  function* negamax(
    state: S,
    side: Seat,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): Generator<void, number> {
    yield* visit();
    const done = adapter.outcome(state);
    if (done) {
      if (done.winner === null) return 0;
      return done.winner === side ? WIN - ply : -WIN + ply;
    }
    if (depth === 0) return adapter.evaluate(state, side, limits.strong);

    const key = limits.transpositions ? adapter.positionKey(state, side) : "";
    const entry = limits.transpositions ? tt.get(key) : undefined;
    if (entry && entry.depth >= depth) {
      if (entry.flag === 0) return entry.score;
      if (entry.flag === 1 && entry.score >= beta) return entry.score;
      if (entry.flag === 2 && entry.score <= alpha) return entry.score;
    }

    const children = adapter.expand(state, side);
    if (!children.length) return -WIN + ply; // no legal move loses
    const alpha0 = alpha;
    let best = -Infinity;
    let bestKey: string | null = null;
    for (const c of ordered(children, entry?.best ?? null)) {
      const score = -(yield* negamax(
        c.child,
        other(side),
        depth - 1,
        -beta,
        -alpha,
        ply + 1,
      ));
      if (score > best) {
        best = score;
        bestKey = c.key;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    if (limits.transpositions) {
      tt.set(key, {
        depth,
        score: best,
        flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0,
        best: bestKey,
      });
    }
    return best;
  }

  const rootChildren = adapter.expand(root, seat);
  if (!rootChildren.length) return { move: null, score: -WIN, completedDepth: 0, nodes };

  let bestMove: M = ordered(rootChildren, null)[0]!.move;
  let bestScore = -Infinity;
  let bestKey: string | null = null;
  let completedDepth = 0;

  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let iterBest: { move: M; key: string } | null = null;
      for (const c of ordered(rootChildren, bestKey)) {
        const score = -(yield* negamax(
          c.child,
          other(seat),
          depth - 1,
          -Infinity,
          -alpha,
          1,
        ));
        if (score > alpha || iterBest === null) {
          alpha = score;
          iterBest = { move: c.move, key: c.key };
        }
      }
      bestMove = iterBest!.move;
      bestKey = iterBest!.key;
      bestScore = alpha;
      completedDepth = depth;
      // A forced result needs no deeper look.
      if (Math.abs(alpha) > WIN / 2) break;
    } catch (e) {
      if (e instanceof BudgetExceeded) break;
      throw e;
    }
  }
  return {
    move: bestMove,
    score: bestScore,
    completedDepth,
    nodes: Math.min(nodes, limits.nodeBudget),
  };
}

/** Drive a search generator to completion synchronously. */
export function runSync<T>(steps: Generator<void, T>): T {
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** Yield to the event loop (the engine packages are built without DOM/Node typings). */
const macrotask = () =>
  new Promise<void>((resolve) =>
    (
      globalThis as unknown as { setTimeout(cb: () => void, ms: number): unknown }
    ).setTimeout(resolve, 0),
  );

/** Time-boxed slicing: keep working through yields until `ms` have passed. */
export interface SliceClock {
  ms: number;
  /** Millisecond clock supplied by the caller (e.g. `performance.now`). */
  now: () => number;
}

/**
 * Drive a search generator, handing the event loop back between slices. With
 * a `slice` clock it pauses only once a slice has run its time, so slices stay
 * short on slow devices without pausing needlessly on fast ones. The clock
 * decides when to pause, never what the search returns.
 */
export async function runAsync<T>(
  steps: Generator<void, T>,
  pause: () => Promise<void> = macrotask,
  slice?: SliceClock,
): Promise<T> {
  let sliceStart = slice?.now() ?? 0;
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    if (slice && slice.now() - sliceStart < slice.ms) continue;
    await pause();
    if (slice) sliceStart = slice.now();
  }
}
