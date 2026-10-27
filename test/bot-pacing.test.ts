/**
 * A bot's move lands after the pacing delay, not after delay + thinking time:
 * the search runs while the delay elapses.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { checkersGame } from "@card-games/game-checkers";

vi.mock("@card-games/game-ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@card-games/game-ai")>();
  return {
    ...real,
    // A search that takes 150ms of (fake) time.
    chooseBotMoveAsync: (...args: Parameters<typeof real.chooseBotMoveAsync>) =>
      new Promise((resolve) =>
        setTimeout(() => resolve(real.chooseBotMove(...args)), 150),
      ),
  };
});

const { LocalTransport } = await import("../app/transports/LocalTransport");

afterEach(() => vi.useRealTimers());

describe("bot pacing", () => {
  it("applies the move after the delay when thinking finishes first", async () => {
    vi.useFakeTimers();
    const t = new LocalTransport({
      game: checkersGame,
      players: [
        { id: "bot", name: "Bot", seat: 0, bot: true },
        { id: "me", name: "Me", seat: 1 },
      ],
      config: { variant: "drafti" },
      seed: "pace",
      humanSeats: [1],
      botDelayMs: 200,
      difficulty: "normal",
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(t.getView().state.version).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    // 200ms, not 350ms: the 150ms search overlapped the delay.
    expect(t.getView().state.version).toBe(1);
    t.destroy();
  });

  it("waits for a search that outlasts the delay, without adding the delay on top", async () => {
    vi.useFakeTimers();
    const t = new LocalTransport({
      game: checkersGame,
      players: [
        { id: "bot", name: "Bot", seat: 0, bot: true },
        { id: "me", name: "Me", seat: 1 },
      ],
      config: { variant: "drafti" },
      seed: "pace",
      humanSeats: [1],
      botDelayMs: 50,
      difficulty: "normal",
    });
    await vi.advanceTimersByTimeAsync(149);
    expect(t.getView().state.version).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.getView().state.version).toBe(1);
    t.destroy();
  });
});
