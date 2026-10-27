/**
 * Scene themes are viewer-local: room state and every transport message stay
 * free of theme data, so a theme change never reaches other players, and a
 * spectator always renders their own theme.
 */
import { describe, it, expect, vi } from "vitest";
import { draftFrom, BUILTIN_SCENE_THEMES, resolveScene } from "../app/utils/sceneThemes";
import { MemoryStorage, SceneThemeStore } from "../app/utils/sceneThemeStore";

vi.mock("../server/utils/db", () => ({
  loadRoomSnapshots: async () => [],
  saveRoomSnapshot: async () => {},
  deleteRoomSnapshot: async () => {},
  recordOnlineResults: async () => {},
  globalLeaderboard: async () => [],
}));
const { RoomHub } = await import("../server/utils/roomHub");
const { buildRoomConfig } = await import("../server/utils/roomConfig");
const { requireGame } = await import("@card-games/engine-core");

const THEME_WORDS = /scene|theme|palette|--games|#[0-9a-f]{6}/i;

class Peer {
  sent: string[] = [];
  constructor(public id: string) {}
  send(d: string) {
    this.sent.push(d);
  }
  subscribe() {}
  unsubscribe() {}
  publish() {}
}

describe("theme locality", () => {
  it("room traffic never carries theme data", () => {
    // Each viewer has their own (different) theme stored locally.
    const playerStore = new SceneThemeStore(new MemoryStorage());
    playerStore.save(draftFrom(BUILTIN_SCENE_THEMES.neon, "Player's"));
    const spectatorStore = new SceneThemeStore(new MemoryStorage());
    spectatorStore.setGlobal("arcade");

    const hub = new RoomHub({ botDelayMs: 0 });
    const roomId = hub.createRoom(
      buildRoomConfig(
        requireGame("checkers"),
        { gameId: "checkers", playerCount: 2 },
        "",
      ),
    );
    const a = new Peer("A");
    const b = new Peer("B");
    const watcher = new Peer("S");
    const inbound: string[] = [];
    const say = (p: Peer, msg: object) => {
      const raw = JSON.stringify(msg);
      inbound.push(raw);
      hub.onMessage(p, raw);
    };
    say(a, { t: "join", roomId, playerId: "pa", name: "A" });
    say(b, { t: "join", roomId, playerId: "pb", name: "B" });
    say(watcher, { t: "join", roomId, playerId: "ps", name: "S", asSpectator: true });
    say(a, { t: "start", roomId });
    for (let i = 0; i < 6; i++) {
      const mover = i % 2 ? b : a;
      const last = JSON.parse(
        [...mover.sent].reverse().find((m) => m.includes('"t":"state"'))!,
      );
      say(mover, { t: "move", roomId, move: last.legalMoves[0] });
    }
    for (const raw of [...inbound, ...a.sent, ...b.sent, ...watcher.sent]) {
      expect(raw).not.toMatch(THEME_WORDS);
    }
    hub.dispose();

    // Each renders their own choice for the same game.
    const view = (store: SceneThemeStore) => {
      const s = store.load();
      return resolveScene({
        gameId: "checkers",
        mode: "dark",
        custom: s.custom,
        global: s.global,
        byGame: s.byGame,
      }).id;
    };
    expect(view(spectatorStore)).toBe("arcade");
    expect(view(playerStore)).toBe("felt"); // saved but not selected
  });
});
