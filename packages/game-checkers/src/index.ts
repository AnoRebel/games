// @card-games/game-checkers — Checkers/draughts family game module.

import { type GameModule, registerGame } from "@card-games/engine-core";

export const CHECKERS_ID = "checkers";

/** Rule variant ids. */
export type CheckersVariant = "drafti" | "english" | "international";

export const checkersGame: GameModule = {
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
  defaultConfig: () => ({ variant: "drafti" }),
  createInitialState() {
    throw new Error("Checkers rules are not available yet");
  },
  reducer: (state) => ({
    ok: false,
    error: "Checkers rules are not available yet",
    state,
  }),
  getLegalMoves: () => [],
  isTerminal: () => true,
  getScores: () => ({ bySeat: {}, winners: [] }),
  redactFor: (state) => state,
};

/** Register the Checkers game with the engine registry. */
export function registerCheckers(): void {
  registerGame(checkersGame);
}
