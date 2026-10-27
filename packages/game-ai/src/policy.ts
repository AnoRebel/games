/**
 * Bot move selection for every game.
 *
 * Bao and Checkers use one deterministic policy interface with three tiers:
 *
 * | tier   | search                         | budget        |
 * | ------ | ------------------------------ | ------------- |
 * | easy   | none — uniform seeded choice   | 0 nodes       |
 * | normal | alpha-beta, depth 2            | NORMAL budget |
 * | hard   | iterative deepening, ≥4 plies  | HARD budget   |
 *
 * Budgets are node counts. Randomness (easy, and nothing else) comes from the
 * state's seeded PRNG mixed with the move counter, never ambient randomness.
 * The card games keep their existing heuristic policies.
 */
import {
  type BaseGameState,
  type BaseMove,
  type Difficulty,
  type GameModule,
  type Seat,
  createRng,
  hashSeed,
  nextInt,
} from "@games/engine-core";
import { baoAdapter } from "./bao";
import { checkersAdapter } from "./checkers";
import { chooseCardBotMove } from "./cardBots";
import {
  type SearchAdapter,
  type SearchLimits,
  type SearchResult,
  runAsync,
  runSync,
  searchSteps,
} from "./search";

/** Search limits per tier for the board games. */
export const SEARCH_LIMITS: Record<Exclude<Difficulty, "easy">, SearchLimits> = {
  normal: { maxDepth: 2, nodeBudget: 20_000, strong: false, transpositions: false },
  hard: { maxDepth: 6, nodeBudget: 60_000, strong: true, transpositions: true },
};

const ADAPTERS: Record<string, SearchAdapter<never, never>> = {
  bao: baoAdapter as unknown as SearchAdapter<never, never>,
  checkers: checkersAdapter as unknown as SearchAdapter<never, never>,
};

/** Games whose bots use the search policies. */
export const SEARCH_GAMES = Object.keys(ADAPTERS);

/**
 * The easy tier: a uniform choice over the legal moves, seeded by the state's
 * PRNG and its move counter so different positions choose differently while
 * the same position always chooses the same.
 */
export function easyChoice<M>(state: BaseGameState, moves: readonly M[]): M | null {
  if (!moves.length) return null;
  const rng = createRng(hashSeed(`${state.rng.seed}:${state.version}`));
  return moves[nextInt(rng, moves.length).value]!;
}

/** Full search details for a board-game decision (tests and benchmarks). */
export function searchDecision<S extends BaseGameState, M extends BaseMove>(
  state: S,
  seat: Seat,
  difficulty: Exclude<Difficulty, "easy">,
  limits: SearchLimits = SEARCH_LIMITS[difficulty],
): SearchResult<M> {
  const adapter = ADAPTERS[state.gameId] as unknown as SearchAdapter<S, M> | undefined;
  if (!adapter) throw new Error(`No search policy for ${state.gameId}`);
  return runSync(searchSteps(adapter, state, seat, limits));
}

/** Can this state's game be decided by search? */
const searchable = (state: BaseGameState) => state.gameId in ADAPTERS;

/** The only move, or none, when no decision is needed. */
function trivial<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  state: S,
  seat: Seat,
): { decided: true; move: M | null } | { decided: false; moves: M[] } {
  if (game.isTerminal(state)) return { decided: true, move: null };
  const moves = game.getLegalMoves(state, seat);
  if (moves.length <= 1) return { decided: true, move: moves[0] ?? null };
  return { decided: false, moves };
}

/**
 * Choose a move for `seat`. Always one of the engine's legal moves, or null
 * when the game is over or the seat has nothing to do. Synchronous.
 */
export function chooseBotMove<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  state: S,
  seat: Seat,
  difficulty: Difficulty = "normal",
): M | null {
  if (!searchable(state)) return chooseCardBotMove(game, state, seat, difficulty);
  const t = trivial(game, state, seat);
  if (t.decided) return t.move;
  if (difficulty === "easy") return easyChoice(state, t.moves);
  return pickLegal(t.moves, searchDecision<S, M>(state, seat, difficulty).move);
}

/**
 * The same decision as `chooseBotMove`, computed in slices that hand the
 * event loop back so the interface stays responsive during a deep search.
 */
export async function chooseBotMoveAsync<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  state: S,
  seat: Seat,
  difficulty: Difficulty = "normal",
  pause?: () => Promise<void>,
): Promise<M | null> {
  if (!searchable(state) || difficulty === "easy") {
    return chooseBotMove(game, state, seat, difficulty);
  }
  const t = trivial(game, state, seat);
  if (t.decided) return t.move;
  const adapter = ADAPTERS[state.gameId] as unknown as SearchAdapter<S, M>;
  const result = await runAsync(
    searchSteps(adapter, state, seat, SEARCH_LIMITS[difficulty]),
    pause,
  );
  return pickLegal(t.moves, result.move);
}

/** Return the engine's own copy of the chosen move (never a search artefact). */
function pickLegal<M extends BaseMove>(legal: M[], chosen: M | null): M | null {
  if (!chosen) return legal[0] ?? null;
  const key = JSON.stringify(chosen);
  return legal.find((m) => JSON.stringify(m) === key) ?? legal[0] ?? null;
}
