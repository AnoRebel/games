/**
 * Offline and online parity: for every board-game variant, the same seed and
 * the same move sequence produce identical final states whether played on a
 * LocalTransport or through a server room.
 */
import { describe, it, expect, vi } from "vitest";
import { requireGame, type BaseGameState, type BaseMove } from "@card-games/engine-core";
import { LocalTransport } from "../app/transports/LocalTransport";

vi.mock("../server/utils/db", () => ({
  loadRoomSnapshots: async () => [],
  saveRoomSnapshot: async () => {},
  deleteRoomSnapshot: async () => {},
  recordOnlineResults: async () => {},
  globalLeaderboard: async () => [],
}));

const { RoomHub } = await import("../server/utils/roomHub");
const { buildRoomConfig } = await import("../server/utils/roomConfig");

class Peer {
  sent: Array<{ t: string; state?: BaseGameState; legalMoves?: BaseMove[] }> = [];
  constructor(public id: string) {}
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  subscribe() {}
  unsubscribe() {}
  publish() {}
  lastState() {
    return [...this.sent].reverse().find((m) => m.t === "state")!;
  }
}

const VARIANTS = [
  ["bao", "bao-la-kiswahili"],
  ["bao", "bao-la-kujifunza"],
  ["checkers", "drafti"],
  ["checkers", "english"],
  ["checkers", "international"],
] as const;

describe("offline / online parity", () => {
  for (const [gameId, variant] of VARIANTS) {
    it(`${variant}: identical seed and moves give identical final states`, async () => {
      new RoomHub().dispose(); // registers the games
      const game = requireGame(gameId);
      const seed = `parity-${variant}`;
      const players = [
        { id: "p-A", name: "A", seat: 0 },
        { id: "p-B", name: "B", seat: 1 },
      ];

      // Offline hotseat: pick a varied but deterministic line of play.
      const local = new LocalTransport({
        game,
        players,
        config: { ...(game.defaultConfig() as object), variant },
        seed,
        humanSeats: [0, 1],
      });
      const moves: BaseMove[] = [];
      for (let i = 0; i < 60; i++) {
        const v = local.getView();
        if (v.scores) break;
        const m = v.legalMoves[(i * 7) % v.legalMoves.length]!;
        moves.push(m);
        expect((await local.submitMove(m)).ok).toBe(true);
      }
      const offline = local.getView().state;
      local.destroy();

      // Online: same seed, same moves, through the server room.
      const hub = new RoomHub({ seedFor: () => seed });
      const roomId = hub.createRoom(
        buildRoomConfig(game, { gameId, variant, playerCount: 2 }, ""),
      );
      const a = new Peer("A");
      const b = new Peer("B");
      hub.onMessage(a, JSON.stringify({ t: "join", roomId, playerId: "p-A", name: "A" }));
      hub.onMessage(b, JSON.stringify({ t: "join", roomId, playerId: "p-B", name: "B" }));
      hub.onMessage(a, JSON.stringify({ t: "start", roomId }));
      for (const m of moves) {
        hub.onMessage(
          m.seat === 0 ? a : b,
          JSON.stringify({ t: "move", roomId, move: m }),
        );
      }
      const online = a.lastState().state;
      hub.dispose();

      expect(moves.length).toBeGreaterThan(5);
      expect(online).toEqual(offline);
    });
  }
});
