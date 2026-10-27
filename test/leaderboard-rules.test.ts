/**
 * Leaderboard rules: per-game metrics (card games unchanged), draw and win
 * attribution, wins → win rate → games → name ordering, one board across
 * variants and difficulties, and experience tiers that never affect rank.
 */
import { describe, it, expect } from "vitest";
import {
  aggregate,
  rankingMetric,
  seatResult,
  standings,
  tierFor,
  type PlayRecord,
} from "../shared/leaderboard";

const play = (
  playerId: string,
  outcome: "win" | "draw" | "loss",
  at = "2026-01-01",
  name = playerId,
): PlayRecord => ({
  playerId,
  playerName: name,
  won: outcome === "win",
  drawn: outcome === "draw",
  rankMetric: outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0,
  playedAt: at,
});

describe("ranking metrics", () => {
  it("declares one metric per game", () => {
    expect(rankingMetric("last-card")).toBe("penalty");
    expect(rankingMetric("albastini")).toBe("victory-points");
    expect(rankingMetric("bao")).toBe("match-wins");
    expect(rankingMetric("checkers")).toBe("match-wins");
  });

  it("keeps Last Card's penalty and Albastini's victory points exactly as before", () => {
    const lc = { bySeat: { 0: 12, 1: 3 }, winners: [1] };
    expect(seatResult("last-card", lc, 0)).toEqual({
      won: false,
      drawn: false,
      score: 12,
      rankMetric: -12,
    });
    const ab = { bySeat: { 0: 70, 1: 50 }, victoryBySeat: { 0: 3, 1: 1 }, winners: [0] };
    expect(seatResult("albastini", ab, 0)).toEqual({
      won: true,
      drawn: false,
      score: 70,
      rankMetric: 3,
    });
  });

  it("scores Bao and Checkers by match result", () => {
    expect(
      seatResult("bao", { bySeat: { 0: 40, 1: 24 }, winners: [0] }, 0).rankMetric,
    ).toBe(1);
    expect(
      seatResult("bao", { bySeat: { 0: 40, 1: 24 }, winners: [0] }, 1).rankMetric,
    ).toBe(0);
    const draw = { bySeat: { 0: 2, 1: 2 }, winners: [], drawn: true };
    expect(seatResult("checkers", draw, 0)).toMatchObject({
      won: false,
      drawn: true,
      rankMetric: 0.5,
    });
    expect(seatResult("checkers", draw, 1)).toMatchObject({
      won: false,
      drawn: true,
      rankMetric: 0.5,
    });
  });
});

describe("standings", () => {
  it("counts wins, draws, losses and games played", () => {
    const [row] = aggregate([
      play("a", "win"),
      play("a", "draw"),
      play("a", "loss"),
      play("a", "loss"),
    ]);
    expect(row).toMatchObject({
      played: 4,
      wins: 1,
      draws: 1,
      losses: 2,
      winRate: 0.375,
    });
  });

  it("orders win-based games by wins, then win rate, then fewer games, then name", () => {
    const rows = standings("checkers", [
      // More wins ranks higher.
      play("most", "win"),
      play("most", "win"),
      play("most", "win"),
      // Two wins each: higher win rate first.
      play("rate", "win"),
      play("rate", "win"),
      play("lower", "win"),
      play("lower", "win"),
      play("lower", "loss"),
      // Same wins and rate: fewer games first.
      play("fewer", "win"),
      play("fewer", "loss"),
      play("more", "win"),
      play("more", "win"),
      play("more", "loss"),
      play("more", "loss"),
      // Fully tied: by name.
      play("t2", "loss", "2026-01-01", "Zuri"),
      play("t1", "loss", "2026-01-01", "Baraka"),
    ]);
    expect(rows.map((r) => r.playerId)).toEqual([
      "most",
      "rate",
      "lower",
      "more",
      "fewer",
      "t1",
      "t2",
    ]);
  });

  it("puts every variant and difficulty on one board, counting each win the same", () => {
    // A Drafti win against a hard bot and an International win against an
    // easy bot are both just wins on the Checkers board.
    const rows = standings("checkers", [play("p", "win"), play("p", "win")]);
    expect(rows).toEqual([expect.objectContaining({ wins: 2, played: 2 })]);
  });

  it("keeps the card games' established order (wins, then their metric)", () => {
    const rows = standings("last-card", [
      { ...play("low", "win"), rankMetric: -2 },
      { ...play("high", "win"), rankMetric: -10 },
    ]);
    expect(rows.map((r) => r.playerId)).toEqual(["low", "high"]);
  });
});

describe("experience tiers", () => {
  it("are New for 0–9 plays, Regular for 10–49, Veteran from 50", () => {
    expect(tierFor(0)).toBe("new");
    expect(tierFor(9)).toBe("new");
    expect(tierFor(10)).toBe("regular");
    expect(tierFor(49)).toBe("regular");
    expect(tierFor(50)).toBe("veteran");
  });

  it("never change the order", () => {
    const veteran = Array.from({ length: 60 }, () => play("vet", "loss"));
    const rows = standings("bao", [...veteran, play("new", "win")]);
    expect(rows.map((r) => [r.playerId, r.tier])).toEqual([
      ["new", "new"],
      ["vet", "veteran"],
    ]);
  });
});
