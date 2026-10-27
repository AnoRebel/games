/**
 * The strength ladder is a release gate: on the checked-in seeds, hard must
 * score at least 60% against normal and normal at least 65% against easy, in
 * both games (a draw counts half). The benchmark is deterministic, so these
 * numbers are exact and reproducible.
 *
 * Frozen settings: SEARCH_LIMITS (normal depth 2 / 20k nodes; hard iterative
 * deepening to depth 6 / 60k nodes), 4 random opening plies, move cap below.
 */
import { describe, it, expect } from "vitest";
import { baoGame } from "@card-games/game-bao";
import { checkersGame } from "@card-games/game-checkers";
import { playBenchmarkGame, runMatch, type MatchSpec } from "../src/index";

const BENCHMARK_SEEDS = [
  "kilwa",
  "pemba",
  "lamu",
  "mafia",
  "ukerewe",
  "zanzibar",
] as const;

const BAO: Omit<MatchSpec, "a" | "b"> = {
  variant: "bao-la-kiswahili",
  seeds: BENCHMARK_SEEDS,
  moveCap: 300,
  openingPlies: 4,
};
const CHECKERS: Omit<MatchSpec, "a" | "b"> = {
  variant: "drafti",
  seeds: BENCHMARK_SEEDS,
  moveCap: 200,
  openingPlies: 4,
};

describe("bot strength ladder", () => {
  it("Bao: normal scores at least 65% against easy", () => {
    const r = runMatch(baoGame, { ...BAO, a: "normal", b: "easy" });
    expect(r.games).toBe(12);
    expect(r.score).toBeGreaterThanOrEqual(0.65);
  });

  it("Bao: hard scores at least 60% against normal", () => {
    const r = runMatch(baoGame, { ...BAO, a: "hard", b: "normal" });
    expect(r.score).toBeGreaterThanOrEqual(0.6);
  });

  it("Checkers: normal scores at least 65% against easy", () => {
    const r = runMatch(checkersGame, { ...CHECKERS, a: "normal", b: "easy" });
    expect(r.games).toBe(12);
    expect(r.score).toBeGreaterThanOrEqual(0.65);
  });

  it("Checkers: hard scores at least 60% against normal", { timeout: 120_000 }, () => {
    const r = runMatch(checkersGame, { ...CHECKERS, a: "hard", b: "normal" });
    expect(r.score).toBeGreaterThanOrEqual(0.6);
  });

  it("easy scores below normal", () => {
    const r = runMatch(baoGame, {
      ...BAO,
      a: "easy",
      b: "normal",
      seeds: BENCHMARK_SEEDS.slice(0, 3),
    });
    expect(r.score).toBeLessThan(0.5);
  });

  it("is reproducible", () => {
    for (const seed of BENCHMARK_SEEDS.slice(0, 2)) {
      const spec = { ...CHECKERS, a: "normal", b: "easy" } as const;
      expect(playBenchmarkGame(checkersGame, spec, seed, 0)).toBe(
        playBenchmarkGame(checkersGame, spec, seed, 0),
      );
    }
  });
});
