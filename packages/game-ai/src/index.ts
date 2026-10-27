// @games/game-ai — bot opponents shared by offline play and server rooms.
//
// Pure and framework-free like the game packages, so both the Nuxt app and the
// Nitro server import the same policies and make the same decisions.

export type { Difficulty as BotDifficulty } from "@games/engine-core";
export {
  SEARCH_LIMITS,
  SEARCH_GAMES,
  chooseBotMove,
  chooseBotMoveAsync,
  easyChoice,
  searchDecision,
} from "./policy";
export { chooseCardBotMove } from "./cardBots";
export {
  WIN,
  runAsync,
  runSync,
  searchSteps,
  type SearchAdapter,
  type SearchLimits,
  type SearchResult,
} from "./search";
export { baoAdapter, evaluateBao } from "./bao";
export { checkersAdapter, evaluateCheckers } from "./checkers";
export {
  runMatch,
  playBenchmarkGame,
  type MatchSpec,
  type MatchReport,
} from "./benchmark";
