import { describe, it, expect } from "vitest";
import {
  applyMove,
  type BaseGameState,
  type BaseMove,
  type GameModule,
  type Player,
} from "@games/engine-core";
import { lastCardGame, defaultLastCardConfig } from "@games/game-last-card";
import { albastiniGame, defaultAlbastiniConfig } from "@games/game-albastini";
import { chooseBotMove, type BotDifficulty } from "@games/game-ai";

const P = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));

function playToEnd<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  config: C,
  players: Player[],
  seed: string,
  diffOf: (seat: number) => BotDifficulty,
): S {
  let s = game.createInitialState(config, players, seed);
  for (let i = 0; i < 5000 && !game.isTerminal(s); i++) {
    const active = s.activeSeat;
    if (active === null) break;
    const m = chooseBotMove(game, s, active, diffOf(active));
    if (!m) break;
    const r = applyMove(game, s, m);
    if (!r.ok) throw new Error(`bot made an illegal move: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe("bot — all difficulties drive games to termination (never stalls or cheats)", () => {
  for (const diff of ["easy", "normal", "hard"] as const) {
    for (const n of [2, 3, 4]) {
      it(`Last Card ${n}p @ ${diff} finishes`, () => {
        const end = playToEnd(
          lastCardGame,
          defaultLastCardConfig(),
          P(n),
          `lc-${diff}-${n}`,
          () => diff,
        );
        expect(lastCardGame.isTerminal(end)).toBe(true);
      });
      it(`Albastini ${n}p @ ${diff} finishes`, () => {
        const end = playToEnd(
          albastiniGame,
          { ...defaultAlbastiniConfig(), enableBidding: true },
          P(n),
          `ab-${diff}-${n}`,
          () => diff,
        );
        expect(albastiniGame.isTerminal(end)).toBe(true);
      });
    }
  }
});

describe("bot — Albastini hard is measurably stronger than easy", () => {
  it("hard wins more than easy over many rotated-seat games", () => {
    let hardWins = 0;
    let easyWins = 0;
    for (let g = 0; g < 120; g++) {
      const hardSeats = new Set([g % 4, (g + 2) % 4]); // rotate to cancel seat bias
      const end = playToEnd(
        albastiniGame,
        { ...defaultAlbastiniConfig(), enableBidding: false },
        P(4),
        `abstrength-${g}`,
        (seat) => (hardSeats.has(seat) ? "hard" : "easy"),
      );
      for (const w of albastiniGame.getScores(end).winners) {
        if (hardSeats.has(w)) hardWins++;
        else easyWins++;
      }
    }
    // Deterministic engine + bot → this ratio is stable across runs.
    expect(hardWins).toBeGreaterThan(easyWins);
  });
});
