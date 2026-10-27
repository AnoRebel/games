// @card-games/game-bao — Bao (East African mancala) game module.

import { type GameModule, registerGame } from "@card-games/engine-core";

export const BAO_ID = "bao";

/** Rule variant ids. */
export type BaoVariant = "bao-la-kiswahili" | "bao-la-kujifunza";

export const baoGame: GameModule = {
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
  defaultConfig: () => ({ variant: "bao-la-kiswahili" }),
  createInitialState() {
    throw new Error("Bao rules are not available yet");
  },
  reducer: (state) => ({ ok: false, error: "Bao rules are not available yet", state }),
  getLegalMoves: () => [],
  isTerminal: () => true,
  getScores: () => ({ bySeat: {}, winners: [] }),
  redactFor: (state) => state,
};

/** Register the Bao game with the engine registry. */
export function registerBao(): void {
  registerGame(baoGame);
}
