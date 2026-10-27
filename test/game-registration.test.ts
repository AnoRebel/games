/**
 * Every game module must be registered in BOTH runtimes: the Nuxt app plugin
 * (offline play) and the room hub (online rooms). A missing registration only
 * shows up at runtime as "no game registered", so assert it here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearGames, requireGame, listGames } from "@games/engine-core";

vi.mock("../server/utils/db", () => ({
  loadRoomSnapshots: async () => [],
  saveRoomSnapshot: async () => {},
  deleteRoomSnapshot: async () => {},
  recordOnlineResults: async () => {},
  globalLeaderboard: async () => [],
}));

const ALL = ["last-card", "albastini", "bao", "checkers"];

describe("game registration — app plugin", () => {
  beforeEach(() => clearGames());

  it("registers every game module", async () => {
    // The plugin is a Nuxt auto-import wrapper; run its setup function directly.
    vi.stubGlobal("defineNuxtPlugin", (setup: () => void) => setup);
    const { default: setup } = (await import("../app/plugins/games")) as unknown as {
      default: () => void;
    };
    setup();
    vi.unstubAllGlobals();

    for (const id of ALL) expect(requireGame(id).id).toBe(id);
    expect(
      listGames()
        .map((g) => g.id)
        .sort(),
    ).toEqual([...ALL].sort());
  });
});

describe("game registration — room hub", () => {
  it("registers every game module on construction", async () => {
    clearGames();
    vi.resetModules();
    const engine = await import("@games/engine-core");
    const { RoomHub } = await import("../server/utils/roomHub");
    const hub = new RoomHub();
    for (const id of ALL) expect(engine.requireGame(id).id).toBe(id);
    expect(engine.requireGame("bao").meta.variants?.map((v) => v.id)).toEqual([
      "bao-la-kiswahili",
      "bao-la-kujifunza",
    ]);
    expect(engine.requireGame("checkers").meta.defaultVariant).toBe("drafti");
    hub.dispose();
  });
});
