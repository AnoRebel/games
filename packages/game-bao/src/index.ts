// @card-games/game-bao — Bao (East African mancala) game module.

import { type GameModule, type Player, registerGame } from "@card-games/engine-core";
import type { BaoConfig, BaoMove, BaoState } from "./state";
import {
  createInitialState,
  defaultBaoConfig,
  getLegalMoves,
  getScores,
  reducer,
} from "./rules";

export const BAO_ID = "bao";

export const baoGame: GameModule<BaoState, BaoMove, BaoConfig> = {
  id: BAO_ID,
  meta: {
    id: BAO_ID,
    name: "Bao",
    tagline: "Sow, relay and capture across the four-row board.",
    minPlayers: 2,
    maxPlayers: 2,
    supportedPlayerCounts: [2],
    variants: [
      { id: "bao-la-kiswahili", name: "Bao la Kiswahili" },
      { id: "bao-la-kujifunza", name: "Bao la Kujifunza" },
    ],
    defaultVariant: "bao-la-kiswahili",
    difficulties: ["easy", "normal", "hard"],
    defaultDifficulty: "normal",
  },
  defaultConfig: defaultBaoConfig,
  createInitialState(config: BaoConfig, players: Player[], seed) {
    return createInitialState(config, players, seed);
  },
  reducer,
  getLegalMoves,
  isTerminal: (state) => state.phase === "finished",
  getScores,
  // Bao is perfect information: every viewer sees the whole board and reserves.
  redactFor: (state) => state,
};

/** Register the Bao game with the engine registry. */
export function registerBao(): void {
  registerGame(baoGame as unknown as GameModule);
}

export type {
  BaoConfig,
  BaoMove,
  BaoState,
  BaoVariant,
  BaoPhase,
  BaoCapture,
  BaoEndReason,
  SowSegment,
  SowDirection,
  Kichwa,
} from "./state";
export {
  RING,
  FRONT,
  NYUMBA,
  KICHWA,
  KIMBI,
  TOTAL_SEEDS,
  INFINITE_CUTOFF,
  isFront,
  opposite,
  pitCell,
  cellPit,
} from "./state";
export {
  BAO_VARIANTS,
  defaultBaoConfig,
  resolveTurns,
  applyTurn,
  turnStarts,
  simulate,
  sameChoices,
  seedsOf,
  isFrontRowEmpty,
} from "./rules";
export { baoContent, baoContentSw } from "./content";
export type { BaoContent, RulesSection, TutorialStep } from "./content";
