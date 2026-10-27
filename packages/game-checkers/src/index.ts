// @card-games/game-checkers — Checkers/draughts family game module.

import { type GameModule, type Player, registerGame } from "@card-games/engine-core";
import type { CheckersConfig, CheckersMove, CheckersState } from "./state";
import {
  createInitialState,
  defaultCheckersConfig,
  getLegalMoves,
  getScores,
  reducer,
} from "./rules";

export const CHECKERS_ID = "checkers";

export const checkersGame: GameModule<CheckersState, CheckersMove, CheckersConfig> = {
  id: CHECKERS_ID,
  meta: {
    id: CHECKERS_ID,
    name: "Checkers",
    tagline: "Jump, chain captures and crown your kings.",
    minPlayers: 2,
    maxPlayers: 2,
    supportedPlayerCounts: [2],
    variants: [
      { id: "drafti", name: "Drafti" },
      { id: "english", name: "English/American" },
      { id: "international", name: "International" },
    ],
    defaultVariant: "drafti",
    difficulties: ["easy", "normal", "hard"],
    defaultDifficulty: "normal",
  },
  defaultConfig: defaultCheckersConfig,
  createInitialState(config: CheckersConfig, players: Player[], seed) {
    return createInitialState(config, players, seed);
  },
  reducer,
  getLegalMoves,
  isTerminal: (state) => state.phase === "finished",
  getScores,
  // Checkers is perfect information: nothing to hide.
  redactFor: (state) => state,
};

/** Register the Checkers game with the engine registry. */
export function registerCheckers(): void {
  registerGame(checkersGame as unknown as GameModule);
}

export type {
  CheckersConfig,
  CheckersMove,
  CheckersState,
  CheckersVariant,
  CheckersPhase,
  CheckersEndReason,
  CapturedPiece,
  EndgameCounter,
  Piece,
} from "./state";
export {
  EMPTY,
  MAN_0,
  KING_0,
  MAN_1,
  KING_1,
  BOARD_SIZE,
  ownerOf,
  isKing,
  manOf,
  kingOf,
  isDark,
  kingsRow,
  squareNumber,
} from "./state";
export {
  CHECKERS_VARIANTS,
  defaultCheckersConfig,
  startingBoard,
  positionKey,
  generateMoves,
  applyToBoard,
  applyLegalMove,
  material,
} from "./rules";
export { previewMove, moveNotation, type MovePreview } from "./preview";
export { checkersContent, checkersContentSw } from "./content";
export type { CheckersContent, RulesSection, TutorialStep } from "./content";
