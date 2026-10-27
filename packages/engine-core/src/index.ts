// @games/engine-core — public surface.
//
// Pure, deterministic, framework-free. Imports no network, DOM, or UI code:
// the whole package type-checks against packages/tsconfig.base.json, whose
// `lib` excludes the DOM, so any such import is a compile error.

export const ENGINE_CORE_VERSION = "0.1.0";

// Deterministic RNG
export { type RngState, hashSeed, createRng, nextFloat, nextInt, shuffle } from "./rng";

// Card / deck model
export {
  type Suit,
  type Rank,
  type Card,
  SUITS,
  RANKS,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  isRed,
  isJoker,
  joker,
  jokers,
  spriteId,
  cardId,
  parseCardId,
  cardName,
  cardShort,
  standardDeck,
  deckWithout,
} from "./cards";

// Turn order
export { type Direction, nextSeat, advanceSeat, seatOrder } from "./turn";

// Core contract & shared types
export type {
  Seat,
  Player,
  BaseGameState,
  BaseMove,
  ReducerResult,
  ScoreResult,
  GameMeta,
  GameModule,
} from "./types";

// Move application / validation / replay
export { applyMove, replay, hasLegalMove } from "./apply";

// Rule variants & difficulty tiers
export {
  type Difficulty,
  type VariantMeta,
  type ResolvedSetup,
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  GameConfigError,
  supportedDifficulties,
  defaultDifficulty,
  defaultVariant,
  resolveDifficulty,
  resolveVariant,
  resolveSetup,
  variantName,
} from "./variants";

// Registry
export { registerGame, getGame, requireGame, listGames, clearGames } from "./registry";
