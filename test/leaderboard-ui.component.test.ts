// @vitest-environment happy-dom
/**
 * Leaderboard display: the active metric is labelled, win-based games show
 * wins/draws/losses/games, and each history row shows game, variant,
 * difficulty, tier, result and date — unknown for legacy rows and not
 * applicable for plays without bots.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { registerBao } from "@games/game-bao";
import { registerCheckers } from "@games/game-checkers";
import { registerLastCard } from "@games/game-last-card";
import LeaderboardHistory from "../app/components/LeaderboardHistory.vue";
import LeaderboardStandings from "../app/components/LeaderboardStandings.vue";
import { standings, type HistoryEntry } from "../shared/leaderboard";

beforeAll(() => {
  registerBao();
  registerCheckers();
  registerLastCard();
});

const LABELS: Record<string, string> = {
  "setup.diffEasy": "Easy",
  "setup.diffNormal": "Normal",
  "setup.diffHard": "Hard",
  "leaderboard.unknown": "Unknown",
  "leaderboard.notApplicable": "N/A",
  "leaderboard.tier.new": "New",
  "leaderboard.tier.regular": "Regular",
  "leaderboard.tier.veteran": "Veteran",
  "leaderboard.result.win": "Win",
  "leaderboard.result.draw": "Draw",
  "leaderboard.result.loss": "Loss",
  "leaderboard.metricWins": "Ranked by wins, then win rate",
  "leaderboard.metricPenalty": "Ranked by wins, then lowest penalty",
};
const t = (k: string, p?: Record<string, string | number>) =>
  LABELS[k] ?? (p ? `${k}(${Object.values(p).join(",")})` : k);

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  playerId: "p",
  playerName: "Ana",
  gameId: "checkers",
  variant: "drafti",
  difficulty: "hard",
  result: "win",
  tier: "veteran",
  playedAt: "2026-10-01T12:30:00.000Z",
  ...over,
});

describe("LeaderboardHistory", () => {
  it("shows Checkers, Drafti and Hard for an offline Drafti win against a hard bot", () => {
    const w = mount(LeaderboardHistory, { props: { entries: [entry({})], t } });
    const row = w.get('[data-testid="history-row"]');
    expect(row.get('[data-testid="h-game"]').text()).toBe("Checkers");
    expect(row.get('[data-testid="h-variant"]').text()).toContain("Drafti");
    expect(row.get('[data-testid="h-difficulty"]').text()).toContain("Hard");
    // Bot difficulty and experience tier are separate fields.
    expect(row.get('[data-testid="h-tier"]').text()).toContain("Veteran");
    expect(row.text()).toContain("Win");
    expect(row.get('[data-testid="h-date"]').text()).toMatch(/1 Oct 2026/);
  });

  it("shows not applicable for a human-only play and unknown for legacy rows", () => {
    const w = mount(LeaderboardHistory, {
      props: {
        entries: [
          entry({ difficulty: "none", result: "draw" }),
          entry({
            variant: null,
            difficulty: null,
            tier: null,
            gameId: "last-card",
            result: "loss",
          }),
        ],
        t,
      },
    });
    const [human, legacy] = w.findAll('[data-testid="history-row"]');
    expect(human!.get('[data-testid="h-difficulty"]').text()).toContain("N/A");
    expect(human!.text()).toContain("Draw");
    expect(legacy!.get('[data-testid="h-variant"]').text()).toContain("Unknown");
    expect(legacy!.get('[data-testid="h-difficulty"]').text()).toContain("Unknown");
    expect(legacy!.get('[data-testid="h-tier"]').text()).toContain("Unknown");
  });

  it("omits the variant for a game without variants", () => {
    const w = mount(LeaderboardHistory, {
      props: {
        entries: [entry({ gameId: "last-card", variant: null, difficulty: "normal" })],
        t,
      },
    });
    expect(w.find('[data-testid="h-variant"]').exists()).toBe(false);
    expect(w.get('[data-testid="h-game"]').text()).toBe("Last Card");
  });
});

describe("LeaderboardStandings", () => {
  const plays = [
    {
      playerId: "a",
      playerName: "Ana",
      won: true,
      drawn: false,
      rankMetric: 1,
      playedAt: "1",
    },
    {
      playerId: "a",
      playerName: "Ana",
      won: false,
      drawn: true,
      rankMetric: 0.5,
      playedAt: "2",
    },
    {
      playerId: "b",
      playerName: "Ben",
      won: false,
      drawn: false,
      rankMetric: 0,
      playedAt: "3",
    },
  ];

  it("labels win-based ranking and shows wins, draws, losses and games", () => {
    const w = mount(LeaderboardStandings, {
      props: { gameId: "checkers", rows: standings("checkers", plays), t },
    });
    expect(w.get('[data-testid="metric-caption"]').text()).toBe(
      "Ranked by wins, then win rate",
    );
    const first = w.findAll('[data-testid="standing"]')[0]!;
    expect(first.get('[data-testid="wdl"]').text()).toContain("leaderboard.wdl(1,1,0)");
    expect(first.get('[data-testid="wdl"]').text()).toContain("leaderboard.played(2)");
    expect(first.text()).toContain("New");
  });

  it("keeps the card games' metric label and columns", () => {
    const w = mount(LeaderboardStandings, {
      props: {
        gameId: "last-card",
        rows: standings(
          "last-card",
          plays.map((p) => ({ ...p, drawn: false })),
        ),
        t,
      },
    });
    expect(w.get('[data-testid="metric-caption"]').text()).toBe(
      "Ranked by wins, then lowest penalty",
    );
    expect(w.find('[data-testid="wdl"]').exists()).toBe(false);
  });
});
