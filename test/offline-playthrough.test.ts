import { describe, it, expect } from "vitest";
import type { BaseGameState, BaseMove, GameModule, Player } from "@games/engine-core";
import { lastCardGame, defaultLastCardConfig } from "@games/game-last-card";
import { albastiniGame, defaultAlbastiniConfig } from "@games/game-albastini";
import { LocalTransport } from "../app/transports/LocalTransport";

// Drive an all-bot game to completion to prove offline play reaches terminal.
async function playOut<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  config: C,
  players: Player[],
  seed: string,
) {
  const t = new LocalTransport({
    game,
    players,
    config,
    seed,
    humanSeats: [0],
    botDelayMs: 0,
    now: () => "2026-06-14T00:00:00.000Z",
  });
  for (let i = 0; i < 2000; i++) {
    const v = t.getView();
    if (v.scores) {
      t.destroy();
      return v.scores;
    }
    if (v.isMyTurn && v.legalMoves.length) {
      // human takes first legal move
      await t.submitMove(v.legalMoves[0]!);
    } else {
      await new Promise((r) => setTimeout(r, 0)); // let bot timer flush
    }
  }
  t.destroy();
  return null;
}

const p2: Player[] = [
  { id: "a", name: "A", seat: 0 },
  { id: "b", name: "B", seat: 1 },
];

describe("offline playthrough reaches a winner", () => {
  it("Last Card completes with a winner", async () => {
    const scores = await playOut(lastCardGame, defaultLastCardConfig(), p2, "play-lc");
    expect(scores).not.toBeNull();
    expect(scores!.winners.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("Albastini completes with scores", async () => {
    const scores = await playOut(
      albastiniGame,
      { ...defaultAlbastiniConfig(), enableBidding: false },
      p2,
      "play-ab",
    );
    expect(scores).not.toBeNull();
  }, 15000);
});
