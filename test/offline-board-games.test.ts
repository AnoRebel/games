/**
 * Offline play of the board games through the real setup path
 * (createLocalTransport → LocalTransport → shared bots): every difficulty
 * plays to a finish, and the chosen variant and difficulty are kept.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { GameConfigError, type BaseGameState } from "@card-games/engine-core";
import { registerBao } from "@card-games/game-bao";
import { registerCheckers } from "@card-games/game-checkers";
import { createLocalTransport } from "../app/composables/useLocalGame";

beforeAll(() => {
  registerBao();
  registerCheckers();
});

async function playOut(t: ReturnType<typeof createLocalTransport>, cap = 4000) {
  let plies = 0;
  for (let i = 0; i < cap; i++) {
    const v = t.getView();
    if (v.scores) return { done: true, plies, state: v.state };
    if (v.isMyTurn && v.legalMoves.length) {
      await t.submitMove(v.legalMoves[0]!);
      plies++;
    } else {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return { done: false, plies, state: t.getView().state };
}

const CASES = [
  ["bao", "bao-la-kiswahili"],
  ["bao", "bao-la-kujifunza"],
  ["checkers", "drafti"],
  ["checkers", "english"],
  ["checkers", "international"],
] as const;

describe("offline board games", () => {
  for (const [gameId, variant] of CASES) {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      it(`${variant} vs a ${difficulty} bot keeps its setup and finishes`, async () => {
        const t = createLocalTransport({
          gameId,
          totalPlayers: 2,
          humanCount: 1,
          config: { variant, difficulty },
          seed: `offline-${variant}-${difficulty}`,
          botDelayMs: 0,
        });
        expect(t.botDifficulty).toBe(difficulty);
        expect((t.getView().state as BaseGameState & { variant: string }).variant).toBe(
          variant,
        );
        expect(t.getPlayers().map((p) => !!p.bot)).toEqual([false, true]);
        const r = await playOut(t);
        expect(r.done).toBe(true);
        expect((r.state as BaseGameState & { variant: string }).variant).toBe(variant);
        t.destroy();
      }, 60_000);
    }
  }

  it("defaults to the declared variant and normal difficulty", () => {
    const t = createLocalTransport({
      gameId: "checkers",
      totalPlayers: 2,
      humanCount: 1,
    });
    expect((t.getView().state as BaseGameState & { variant: string }).variant).toBe(
      "drafti",
    );
    expect(t.botDifficulty).toBe("normal");
    t.destroy();
  });

  it("rejects an unknown variant or difficulty", () => {
    expect(() =>
      createLocalTransport({
        gameId: "bao",
        totalPlayers: 2,
        humanCount: 1,
        config: { variant: "x" },
      }),
    ).toThrow(GameConfigError);
    expect(() =>
      createLocalTransport({
        gameId: "bao",
        totalPlayers: 2,
        humanCount: 1,
        config: { difficulty: "brutal" },
      }),
    ).toThrow(/brutal/);
  });
});
