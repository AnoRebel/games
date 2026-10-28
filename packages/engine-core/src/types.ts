/**
 * The game-module contract.
 *
 * Every game (Last Card, Albastini, …) implements `GameModule`. The engine core
 * knows nothing game-specific — it only orchestrates these pure functions.
 * Nothing here imports a framework, the DOM, or any transport.
 */

import type { RngState } from "./rng";
import type { Difficulty, VariantMeta } from "./variants";

/** A seat index at the table (0-based). */
export type Seat = number;

/** A player occupying a seat. */
export interface Player {
  /** Stable id (assigned by the room/transport layer). */
  id: string;
  /** Display name. */
  name: string;
  /** Seat index. */
  seat: Seat;
  /** Optional team id for partnership games (e.g. Albastini teams). */
  team?: number;
  /** True if this seat is filled by a bot (offline seat-filling). */
  bot?: boolean;
}

/**
 * Base shape every game state extends. Games add their own fields, but these
 * are guaranteed so the engine/transport layers can reason generically.
 */
export interface BaseGameState {
  /** Game module id this state belongs to. */
  gameId: string;
  /** Seeded RNG state — carried in state so transitions stay deterministic. */
  rng: RngState;
  /** Players at the table, indexed by seat. */
  players: Player[];
  /** Seat whose turn it is, or null when no one is to act (e.g. terminal). */
  activeSeat: Seat | null;
  /** High-level phase, e.g. 'playing' | 'finished' (games may add more). */
  phase: string;
  /** Monotonic move counter — increments on every applied move. */
  version: number;
}

/**
 * A move/action submitted by a seat. Games define their own discriminated
 * `type`s and payloads; `seat` is always present so the engine can check turn
 * order and authority.
 */
export interface BaseMove {
  type: string;
  seat: Seat;
}

/** Result of applying a move. */
export type ReducerResult<S> =
  { ok: true; state: S } | { ok: false; error: string; state: S };

/** Final scores keyed by seat, plus optional ranking/victory metadata. */
export interface ScoreResult {
  /** Raw score per seat (meaning is game-specific). */
  bySeat: Record<Seat, number>;
  /** Optional victory points per seat (e.g. Albastini VP). */
  victoryBySeat?: Record<Seat, number>;
  /** Seats that won (may be multiple on a tie; empty if undecided or drawn). */
  winners: Seat[];
  /** True when the game ended in a draw for every seat. */
  drawn?: boolean;
}

/** Static, serializable metadata describing a game for the UI/registry. */
export interface GameMeta {
  id: string;
  name: string;
  /** Short tagline for cards/landing. */
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  /** Player counts that are actually valid (e.g. Albastini: 2,3,4,6). */
  supportedPlayerCounts: number[];
  /**
   * Selectable rule variants. Omitted for games with a single ruleset; when
   * present, config carries the chosen id as `variant`.
   */
  variants?: VariantMeta[];
  /** Variant used when none is chosen (defaults to the first declared). */
  defaultVariant?: string;
  /** Bot difficulty tiers this game supports (all tiers when omitted). */
  difficulties?: Difficulty[];
  /** Tier used when none is chosen (`normal` when omitted). */
  defaultDifficulty?: Difficulty;
}

/**
 * The contract each game implements.
 *
 * @typeParam S - the game's state type (extends BaseGameState)
 * @typeParam M - the game's move type (extends BaseMove)
 * @typeParam C - the game's config type (variant options chosen at setup)
 */
export interface GameModule<
  S extends BaseGameState = BaseGameState,
  M extends BaseMove = BaseMove,
  C = unknown,
> {
  readonly id: string;
  readonly meta: GameMeta;

  /** Default config (variant toggles) for a new game. */
  defaultConfig(): C;

  /**
   * Build the initial, fully-dealt state. MUST be pure and derive all
   * randomness from `seed` (no ambient RNG/time).
   */
  createInitialState(config: C, players: Player[], seed: string | number): S;

  /**
   * Apply a move, returning the next state. MUST be pure and reject illegal /
   * out-of-turn moves (returning `{ ok: false, state }` unchanged).
   */
  reducer(state: S, move: M): ReducerResult<S>;

  /** All legal moves for `seat` at `state` (empty if it's not their turn). */
  getLegalMoves(state: S, seat: Seat): M[];

  /** Whether the game has ended. */
  isTerminal(state: S): boolean;

  /** Final scores/winners (meaningful once terminal). */
  getScores(state: S): ScoreResult;

  /**
   * Project state for a given viewer seat, hiding information that seat is not
   * entitled to (other players' hands). `viewer = null` ⇒ spectator view.
   * Used by the server to avoid leaking hidden state.
   */
  redactFor(state: S, viewer: Seat | null): S;
}
