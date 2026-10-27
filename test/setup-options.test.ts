/**
 * Setup reads variants and difficulty tiers from game metadata and emits the
 * same choices for offline and online starts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { requireGame } from "@card-games/engine-core";
import { registerBao } from "@card-games/game-bao";
import { registerCheckers } from "@card-games/game-checkers";
import { registerLastCard } from "@card-games/game-last-card";
import {
  difficultyItems,
  hasBots,
  offlineStart,
  onlineStart,
  setupDefaults,
  variantItems,
} from "../app/utils/setupOptions";

beforeAll(() => {
  registerBao();
  registerCheckers();
  registerLastCard();
});

const t = (k: string) => k;

describe("setup options", () => {
  it("preselects each game's declared default variant and normal difficulty", () => {
    expect(setupDefaults(requireGame("bao").meta)).toEqual({
      variant: "bao-la-kiswahili",
      difficulty: "normal",
    });
    expect(setupDefaults(requireGame("checkers").meta)).toEqual({
      variant: "drafti",
      difficulty: "normal",
    });
  });

  it("offers exactly the declared variants and tiers", () => {
    expect(variantItems(requireGame("checkers").meta).map((i) => i.value)).toEqual([
      "drafti",
      "english",
      "international",
    ]);
    expect(difficultyItems(requireGame("bao").meta, t).map((i) => i.value)).toEqual([
      "easy",
      "normal",
      "hard",
    ]);
  });

  it("offers no variant choice for a game without variants", () => {
    const meta = requireGame("last-card").meta;
    expect(variantItems(meta)).toEqual([]);
    expect(setupDefaults(meta).variant).toBeNull();
    const start = offlineStart(
      { totalPlayers: 2, humanCount: 1 },
      { rounds: 3 },
      setupDefaults(meta),
    );
    expect(start.config).toEqual({ rounds: 3, difficulty: "normal" });
    expect("variant" in start.config).toBe(false);
  });

  it("emits the chosen variant and difficulty for offline starts", () => {
    const start = offlineStart({ totalPlayers: 2, humanCount: 1 }, null, {
      variant: "international",
      difficulty: "hard",
    });
    expect(start).toEqual({
      totalPlayers: 2,
      humanCount: 1,
      config: { variant: "international", difficulty: "hard" },
    });
  });

  it("emits the same choices for online starts", () => {
    const sel = { variant: "bao-la-kujifunza", difficulty: "easy" as const };
    const online = onlineStart(
      { totalPlayers: 2, visibility: "public", botSeats: 1 },
      null,
      sel,
    );
    expect(online.config).toEqual({ variant: "bao-la-kujifunza" });
    expect(online.difficulty).toBe("easy");
    expect(online.botSeats).toBe(1);
  });

  it("shows difficulty only when seats go to bots", () => {
    expect(hasBots("offline", { totalPlayers: 2, humanCount: 1, botSeats: 0 })).toBe(
      true,
    );
    expect(hasBots("offline", { totalPlayers: 2, humanCount: 2, botSeats: 0 })).toBe(
      false,
    );
    expect(hasBots("online", { totalPlayers: 2, humanCount: 1, botSeats: 0 })).toBe(
      false,
    );
    expect(hasBots("online", { totalPlayers: 2, humanCount: 1, botSeats: 1 })).toBe(true);
  });
});
