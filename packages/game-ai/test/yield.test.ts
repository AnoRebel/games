/**
 * Cooperative yielding: a search driven in slices returns exactly the move a
 * synchronous run returns, and hands the event loop back while it works.
 */
import { describe, it, expect } from "vitest";
import { applyMove, createRng, nextInt, type Player } from "@games/engine-core";
import { checkersGame, type CheckersState } from "@games/game-checkers";
import { baoGame, type BaoState } from "@games/game-bao";
import {
  SEARCH_LIMITS,
  checkersAdapter,
  baoAdapter,
  chooseBotMove,
  chooseBotMoveAsync,
  runAsync,
  searchSteps,
} from "../src/index";

const PLAYERS: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];

function midgame<S extends CheckersState | BaoState>(
  game: typeof checkersGame | typeof baoGame,
  variant: string,
  plies: number,
): S {
  let s = (game.createInitialState as (c: unknown, p: Player[], seed: string) => S)(
    { variant },
    PLAYERS,
    "mid",
  );
  let rng = createRng("mid");
  for (let i = 0; i < plies; i++) {
    const moves = (game.getLegalMoves as (s: S, seat: number) => unknown[])(
      s,
      s.activeSeat!,
    );
    const r = nextInt(rng, moves.length);
    rng = r.state;
    s = (
      applyMove(game as never, s as never, moves[r.value] as never) as unknown as {
        state: S;
      }
    ).state;
  }
  return s;
}

describe("cooperative yielding", () => {
  it("a yielded hard search returns the same move as a synchronous one", async () => {
    const cases = [
      [checkersGame, midgame<CheckersState>(checkersGame, "international", 6)],
      [checkersGame, midgame<CheckersState>(checkersGame, "drafti", 10)],
      [baoGame, midgame<BaoState>(baoGame, "bao-la-kiswahili", 30)],
    ] as const;
    for (const [game, s] of cases) {
      const sync = chooseBotMove(game as never, s as never, s.activeSeat!, "hard");
      // Vary the slice timing: it must never change the decision.
      let pauses = 0;
      const jittered = await chooseBotMoveAsync(
        game as never,
        s as never,
        s.activeSeat!,
        "hard",
        () => {
          pauses++;
          return new Promise((r) => setTimeout(r, pauses % 3));
        },
      );
      expect(jittered).toEqual(sync);
    }
  });

  it("hands the event loop back during a deep search", async () => {
    const s = midgame<CheckersState>(checkersGame, "international", 6);
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0);
    let pauses = 0;
    const result = await runAsync(
      searchSteps(checkersAdapter, s, s.activeSeat!, SEARCH_LIMITS.hard, 200),
      () => {
        pauses++;
        return new Promise((r) => setTimeout(r, 0));
      },
    );
    clearInterval(timer);
    expect(result.move).not.toBeNull();
    expect(pauses).toBeGreaterThan(3);
    // Other work (input handlers, timers) ran while the bot was thinking.
    expect(ticks).toBeGreaterThan(0);
  });

  it("time-boxed slices pause only once a slice has run its course", async () => {
    const s = midgame<CheckersState>(checkersGame, "international", 6);
    const run = (sliceMs: number) => {
      let pauses = 0;
      let tick = 0; // a fake clock: one millisecond per reading
      return runAsync(
        searchSteps(checkersAdapter, s, s.activeSeat!, SEARCH_LIMITS.hard, 50),
        async () => {
          pauses++;
        },
        { ms: sliceMs, now: () => tick++ },
      ).then((result) => ({ result, pauses }));
    };
    const every = await run(0);
    const boxed = await run(1_000_000);
    expect(boxed.result).toEqual(every.result);
    expect(every.pauses).toBeGreaterThan(0);
    expect(boxed.pauses).toBe(0);
  });

  it("Bao searches yield too", async () => {
    const s = midgame<BaoState>(baoGame, "bao-la-kiswahili", 30);
    let pauses = 0;
    await runAsync(
      searchSteps(baoAdapter, s, s.activeSeat!, SEARCH_LIMITS.hard, 50),
      async () => {
        pauses++;
      },
    );
    expect(pauses).toBeGreaterThan(0);
  });
});
