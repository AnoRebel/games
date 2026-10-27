/**
 * RoomHub — server-authoritative room & game manager (crossws-driven).
 *
 * Holds canonical engine state per room, validates moves through the engine
 * reducer before broadcasting, redacts state per recipient (no hidden-hand
 * leaks), and enforces host controls + spectator access control (public vs
 * locked + passcode).
 *
 * Broadcast uses crossws topic pub/sub: every member subscribes to
 * `room:<id>`. Because *state* must be redacted per viewer, state is sent with
 * direct `peer.send` per peer; room snapshots and chat (public) use publish.
 */
import {
  type BaseGameState,
  type BaseMove,
  type Player,
  type Seat,
  GameConfigError,
  applyMove,
  requireGame,
  resolveSetup,
} from "@games/engine-core";
import { registerLastCard } from "@games/game-last-card";
import { registerAlbastini } from "@games/game-albastini";
import { registerBao } from "@games/game-bao";
import { registerCheckers } from "@games/game-checkers";
import { chooseBotMoveAsync } from "@games/game-ai";
import { consola } from "consola";
import {
  recordOnlineResults,
  saveRoomSnapshot,
  deleteRoomSnapshot,
  loadRoomSnapshots,
  type OnlineResult,
} from "./db";
import type {
  ChatMessage,
  ClientMessage,
  PublicRoomInfo,
  RoomConfig,
  RoomMember,
  RoomPhase,
  RoomSnapshot,
  ServerMessage,
} from "./roomTypes";
import { roomVariant } from "./roomConfig";

const log = consola.withTag("rooms");

/** Minimal crossws peer surface we rely on. */
export interface WsPeer {
  id: string;
  send(data: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, data: string): void;
}

let registered = false;
function ensureGames() {
  if (registered) return;
  registerLastCard();
  registerAlbastini();
  registerBao();
  registerCheckers();
  registered = true;
}

/** The subset of a Room that survives a restart (no live peer sockets). */
interface PersistedRoom {
  id: string;
  config: RoomConfig;
  phase: RoomPhase;
  hostClientId: string | null;
  members: RoomMember[];
  state: BaseGameState | null;
  startedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
}

interface Room {
  /** The room's own id (its key in `rooms`) — avoids O(n) reverse lookups. */
  id: string;
  config: RoomConfig;
  phase: RoomPhase;
  hostClientId: string | null;
  members: Map<string, RoomMember>; // by clientId (peer id)
  peers: Map<string, WsPeer>; // clientId → peer
  state: BaseGameState | null;
  chat: ChatMessage[];
  startedAt: string | null;
  endedAt: string | null;
  /** Epoch ms by which a dropped seated player must reconnect, else auto-end. */
  disconnectGraceUntil: number | null;
  /** Name of the host who manually ended the game (End button); null otherwise. */
  endedBy: string | null;
}

let counter = 0;
function genId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

const topicFor = (roomId: string) => `room:${roomId}`;

/** How long an empty room lingers before it's reaped (ms) — covers reconnects. */
const EMPTY_ROOM_GRACE_MS = 60_000;
/**
 * Grace for a room rehydrated from a snapshot after a restart. Nobody is
 * connected yet by definition, so it gets a longer window for players to come
 * back before it's reaped — otherwise restart-survival rooms would leak.
 */
const REHYDRATED_ROOM_GRACE_MS = 10 * 60_000;
/** Pause before a server bot seat moves, so humans can follow its play (ms). */
const BOT_DELAY_MS = 700;
/** How long a disconnected SEATED player has to reconnect before the in-progress
 *  game is auto-ended (ms). The client shows a countdown of the same length. */
const PLAYER_GRACE_MS = 30_000;

export interface RoomHubOptions {
  /** Pause before a bot seat moves (ms). */
  botDelayMs?: number;
  /** Seed for a room's next game (defaults to a fresh generated seed). */
  seedFor?: (roomId: string) => string;
}

export class RoomHub {
  private rooms = new Map<string, Room>();
  /** Pending bot-seat turns (roomId → timer). */
  private botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private botDelayMs: number;
  private seedFor: (roomId: string) => string;
  /** Which room a peer is currently in (peer.id → roomId). */
  private peerRoom = new Map<string, string>();
  /** Pending deletion timers for rooms that just went empty. */
  private reapTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Per-disconnected-player grace timers (clientId → timer). */
  private graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Per-room turn timers (roomId → timer) for the optional turn limit. */
  private turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Debounced snapshot timers (roomId → timer) for restart-survival. */
  private snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: RoomHubOptions = {}) {
    ensureGames();
    this.botDelayMs = options.botDelayMs ?? BOT_DELAY_MS;
    this.seedFor = options.seedFor ?? (() => genId("seed"));
  }

  /** Cancel a player's reconnect-grace timer (they came back, or were removed). */
  private cancelGrace(clientId: string) {
    const t = this.graceTimers.get(clientId);
    if (t) {
      clearTimeout(t);
      this.graceTimers.delete(clientId);
    }
  }

  /** True when no member of the room is still connected. */
  private isEmpty(room: Room): boolean {
    for (const m of room.members.values()) if (m.connected) return false;
    return true;
  }

  /**
   * Schedule deletion of a room once it has no connected members. The grace
   * period lets a sole player reconnect (refresh, flaky network) without losing
   * the room. Any later join cancels the timer (see onJoin).
   *
   * Rooms opted into `config.persist` are exempt — they're meant to outlive an
   * empty lobby. Everything else (including a room created via the API but never
   * joined) is reaped, so rooms can't accumulate for the process's lifetime.
   */
  private scheduleReap(roomId: string, delayMs = EMPTY_ROOM_GRACE_MS) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.config.persist) return this.cancelReap(roomId);
    if (!this.isEmpty(room)) return this.cancelReap(roomId);
    if (this.reapTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      this.reapTimers.delete(roomId);
      const r = this.rooms.get(roomId);
      if (r && !r.config.persist && this.isEmpty(r)) {
        this.clearTurnTimer(roomId);
        this.clearBotTimer(roomId);
        void deleteRoomSnapshot(roomId).catch(() => {});
        this.rooms.delete(roomId);
        log.info(`reaped empty room ${roomId} (${this.rooms.size} left)`);
      }
    }, delayMs);
    // Don't keep the process alive just for a reap timer.
    (timer as { unref?: () => void }).unref?.();
    this.reapTimers.set(roomId, timer);
  }

  private cancelReap(roomId: string) {
    const t = this.reapTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.reapTimers.delete(roomId);
    }
  }

  private clearTurnTimer(roomId: string) {
    const t = this.turnTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.turnTimers.delete(roomId);
    }
  }

  /**
   * If the room has a turn limit, (re)arm a timer for the active seat. On expiry
   * we auto-play a legal move for that seat (or draw/pass) and advance — so one
   * idle player can't freeze the room. Called after every state broadcast.
   */
  private scheduleTurnTimeout(roomId: string) {
    this.clearTurnTimer(roomId);
    const room = this.rooms.get(roomId);
    const limit = room?.config.turnTimeoutMs ?? 0;
    if (!room || !room.state || room.phase !== "in-progress" || limit <= 0) return;
    const active = room.state.activeSeat;
    if (active === null || active === undefined) return;

    const timer = setTimeout(() => {
      this.turnTimers.delete(roomId);
      const r = this.rooms.get(roomId);
      if (!r || !r.state || r.phase !== "in-progress") return;
      if (r.state.activeSeat !== active) return; // they already moved
      const game = requireGame(r.config.gameId);
      const moves = game.getLegalMoves(r.state, active);
      if (!moves.length) return;
      // On a skip/reverse interjection window, timing out must PASS — never
      // spend the player's card for them. Elsewhere the first legal move stands.
      const auto = moves.find((m) => m.type === "pass-interjection") ?? moves[0]!;
      const res = applyMove(game, r.state, auto);
      if (!res.ok) return;
      r.state = res.state;
      log.info(`turn timeout: auto-played for seat ${active} in room ${roomId}`);
      if (game.isTerminal(r.state)) {
        r.phase = "finished";
        r.endedAt = new Date().toISOString();
        this.broadcastRoom(r);
      }
      this.broadcastState(r); // re-arms the next turn timer
    }, limit);
    (timer as { unref?: () => void }).unref?.();
    this.turnTimers.set(roomId, timer);
  }

  // --- restart survival (persist in-progress rooms) -------------------------

  /** The persistable shape of a room (no live peer sockets). */
  private serializeRoom(room: Room): PersistedRoom {
    return {
      id: room.id,
      config: room.config,
      phase: room.phase,
      hostClientId: room.hostClientId,
      members: [...room.members.values()],
      state: room.state,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      endedBy: room.endedBy,
    };
  }

  /** Debounced snapshot save so bursts of moves don't hammer the datastore. */
  private snapshotSoon(roomId: string) {
    if (this.snapshotTimers.has(roomId)) return;
    const t = setTimeout(() => {
      this.snapshotTimers.delete(roomId);
      const r = this.rooms.get(roomId);
      if (r && r.phase === "in-progress" && r.state) {
        void saveRoomSnapshot(r.id, this.serializeRoom(r)).catch(() => {});
      }
    }, 1_000);
    (t as { unref?: () => void }).unref?.();
    this.snapshotTimers.set(roomId, t);
  }

  /** Rehydrate in-progress rooms from the datastore on boot (best-effort). */
  async rehydrate(): Promise<void> {
    try {
      const snaps = await loadRoomSnapshots();
      for (const { data } of snaps) {
        const p = data as PersistedRoom;
        if (!p?.id || p.phase !== "in-progress" || this.rooms.has(p.id)) continue;
        this.rooms.set(p.id, {
          id: p.id,
          config: p.config,
          phase: p.phase,
          hostClientId: null, // sockets are gone; reclaimed on rejoin by playerId
          members: new Map(
            p.members.map((m) => [m.clientId, { ...m, connected: false }]),
          ),
          peers: new Map(),
          state: p.state,
          chat: [],
          startedAt: p.startedAt,
          endedAt: p.endedAt,
          disconnectGraceUntil: null,
          endedBy: p.endedBy,
        });
        // Nobody is connected to a rehydrated room yet, so nothing else would
        // ever arm the reaper for it. Give players a long window to come back;
        // the first rejoin cancels the timer (see onJoin).
        this.scheduleReap(p.id, REHYDRATED_ROOM_GRACE_MS);
        // Bots don't need a connection: resume one that was due to move.
        this.scheduleBotTurn(p.id);
      }
      if (snaps.length) log.info(`rehydrated ${this.rooms.size} room(s) from snapshots`);
    } catch (e) {
      log.warn(`rehydrate skipped (datastore unavailable): ${e}`);
    }
  }

  /**
   * Create a room. An optional `customId` lets the host pick a memorable id;
   * it's sanitized and must be unused, otherwise we fall back to a generated id.
   */
  createRoom(config: RoomConfig, customId?: string): string {
    const id = this.resolveId(customId);
    this.rooms.set(id, {
      id,
      config,
      phase: "lobby",
      hostClientId: null,
      members: new Map(),
      peers: new Map(),
      state: null,
      chat: [],
      startedAt: null,
      endedAt: null,
      disconnectGraceUntil: null,
      endedBy: null,
    });
    log.info(`created room ${id} (${config.gameId}, ${this.rooms.size} total)`);
    // A brand-new room has no members, so nothing would ever arm the reaper for
    // it. Arm it now: if nobody joins within the grace period it's cleaned up
    // (the host's own join cancels the timer).
    this.scheduleReap(id);
    return id;
  }

  /** Sanitize a requested custom id; fall back to a generated id if taken/empty. */
  private resolveId(customId?: string): string {
    const clean = (customId ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    if (clean && !this.rooms.has(clean)) return clean;
    return genId("room");
  }

  getRoom(id: string) {
    return this.rooms.get(id);
  }

  /**
   * Public, joinable rooms for the spectate lobby. Excludes locked rooms (their
   * existence/passcode shouldn't leak) and finished rooms. No secrets included.
   */
  listPublicRooms(): PublicRoomInfo[] {
    const out: PublicRoomInfo[] = [];
    for (const [id, room] of this.rooms) {
      if (room.config.spectatorVisibility !== "public") continue;
      if (room.phase === "finished") continue;
      const members = [...room.members.values()];
      out.push({
        id,
        gameId: room.config.gameId,
        variant: roomVariant(room.config),
        phase: room.phase,
        seated: members.filter((m) => m.seat !== null).length,
        spectators: members.filter((m) => m.spectator && m.connected).length,
        maxPlayers: room.config.maxPlayers,
        startedAt: room.startedAt,
      });
    }
    return out;
  }

  // --- crossws lifecycle ----------------------------------------------------

  onMessage(peer: WsPeer, raw: string) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      log.warn(`malformed message from peer ${peer.id} (${raw.length} bytes)`);
      return this.send(peer, { t: "error", message: "bad message" });
    }
    switch (msg.t) {
      case "join":
        return this.onJoin(peer, msg);
      case "take-seat":
        return this.onTakeSeat(peer, msg);
      case "start":
        return this.onStart(peer, msg);
      case "end":
        return this.onEnd(peer, msg);
      case "configure":
        return this.onConfigure(peer, msg);
      case "move":
        return this.onMove(peer, msg);
      case "chat":
        return this.onChat(peer, msg);
      case "set-visibility":
        return this.onSetVisibility(peer, msg);
      case "leave":
        return this.onLeave(peer);
    }
  }

  onClose(peer: WsPeer) {
    const roomId = this.peerRoom.get(peer.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    const member = room?.members.get(peer.id);
    if (room && member) {
      member.connected = false; // keep seat for grace-period reconnect
      if (room.hostClientId === peer.id) {
        const next = [...room.members.values()].find(
          (m) => m.seat !== null && m.connected,
        );
        room.hostClientId = next?.clientId ?? room.hostClientId;
      }
      room.peers.delete(peer.id);

      // A SEATED player dropping out of an IN-PROGRESS game starts a reconnect
      // countdown. If they don't return in time, the game is auto-ended. The
      // deadline is broadcast so clients can show a live countdown.
      if (member.seat !== null && room.phase === "in-progress") {
        room.disconnectGraceUntil = Date.now() + PLAYER_GRACE_MS;
        const droppedClientId = peer.id;
        const timer = setTimeout(() => {
          this.graceTimers.delete(droppedClientId);
          const r = this.rooms.get(roomId);
          if (!r) return;
          const m = r.members.get(droppedClientId);
          // Only end if still gone and the game is still running.
          if (m && !m.connected && r.phase === "in-progress") {
            r.phase = "finished";
            r.endedAt = new Date().toISOString();
            r.disconnectGraceUntil = null;
            this.broadcastRoom(r);
          }
        }, PLAYER_GRACE_MS);
        (timer as { unref?: () => void }).unref?.();
        this.graceTimers.set(peer.id, timer);
      }

      this.broadcastRoom(room);
      this.scheduleReap(roomId);
    }
    this.peerRoom.delete(peer.id);
  }

  // --- Spectator access control --------------------------------------------

  private onJoin(peer: WsPeer, msg: Extract<ClientMessage, { t: "join" }>) {
    const room = this.rooms.get(msg.roomId);
    if (!room) return this.send(peer, { t: "denied", reason: "no such room" });
    // Someone's joining → cancel any pending empty-room deletion.
    this.cancelReap(msg.roomId);

    // Locked rooms require the passcode for ANY entry — players and spectators.
    const codeOk =
      room.config.spectatorVisibility === "public" ||
      (!!msg.spectatorPasscode &&
        msg.spectatorPasscode === room.config.spectatorPasscode);
    if (room.config.spectatorVisibility === "locked" && !codeOk) {
      return this.send(peer, {
        t: "denied",
        reason: "this room is private — a passcode is required to join",
      });
    }

    // RECONNECTION: an existing member with the same stable playerId (e.g. the
    // player refreshed or their tab was closed) reclaims its seat/host status
    // under the NEW connection. The stale entry is removed so counts stay right.
    const prior = [...room.members.values()].find((m) => m.playerId === msg.playerId);
    let member: RoomMember;
    if (prior) {
      const wasHost = room.hostClientId === prior.clientId;
      room.members.delete(prior.clientId);
      room.peers.delete(prior.clientId);
      this.cancelGrace(prior.clientId);
      member = {
        clientId: peer.id,
        playerId: prior.playerId,
        name: msg.name || prior.name,
        seat: prior.seat, // reclaim the original seat (may be null for spectators)
        spectator: prior.spectator,
        connected: true,
      };
      if (wasHost) room.hostClientId = peer.id;
      // If every seated player is connected again, clear the auto-end countdown.
      room.members.set(peer.id, member); // provisional, so the check below sees us
      const anyoneStillGone = [...room.members.values()].some(
        (m) => m.seat !== null && !m.connected && m.clientId !== peer.id,
      );
      if (!anyoneStillGone) room.disconnectGraceUntil = null;
    } else {
      const seatedCount = [...room.members.values()].filter(
        (m) => m.seat !== null,
      ).length;
      const wantsSeat =
        !msg.asSpectator &&
        room.phase === "lobby" &&
        seatedCount < room.config.maxPlayers;
      // Anyone who doesn't land a seat becomes a spectator — including someone
      // who wanted to play but arrived to a full/in-progress room. Enforce the
      // host's spectator cap on that role, not just on explicit `asSpectator`.
      if (!wantsSeat) {
        const cap = room.config.maxSpectators;
        if (cap !== undefined) {
          const spectators = [...room.members.values()].filter((m) => m.spectator).length;
          if (spectators >= cap) {
            return this.send(peer, {
              t: "denied",
              reason:
                cap === 0
                  ? "this room does not allow spectators"
                  : "this room is full — the spectator limit has been reached",
            });
          }
        }
      }
      member = {
        clientId: peer.id,
        playerId: msg.playerId,
        name: msg.name,
        seat: wantsSeat ? seatedCount : null,
        spectator: !wantsSeat,
        connected: true,
      };
    }

    room.members.set(peer.id, member);
    room.peers.set(peer.id, peer);
    this.peerRoom.set(peer.id, msg.roomId);
    peer.subscribe(topicFor(msg.roomId));
    if (!room.hostClientId && !member.spectator) room.hostClientId = peer.id;

    this.send(peer, {
      t: "joined",
      roomId: msg.roomId,
      youAre: {
        clientId: peer.id,
        seat: member.seat,
        spectator: member.spectator,
      },
      isHost: room.hostClientId === peer.id,
    });
    this.broadcastRoom(room);
    this.send(peer, { t: "chat", messages: room.chat });
    if (room.state) this.sendStateTo(room, peer);
  }

  private onTakeSeat(peer: WsPeer, msg: Extract<ClientMessage, { t: "take-seat" }>) {
    const room = this.rooms.get(msg.roomId);
    if (!room || room.phase !== "lobby") return;
    const member = room.members.get(peer.id);
    if (!member) return;
    const taken = new Set(
      [...room.members.values()].map((m) => m.seat).filter((s) => s !== null),
    );
    if (taken.has(msg.seat) || msg.seat >= room.config.maxPlayers) return;
    member.seat = msg.seat;
    member.spectator = false;
    if (!room.hostClientId) room.hostClientId = peer.id;
    this.broadcastRoom(room);
  }

  private onStart(peer: WsPeer, msg: Extract<ClientMessage, { t: "start" }>) {
    const room = this.rooms.get(msg.roomId);
    // Host may start from the lobby OR restart a finished game (rematch); an
    // in-progress game can't be restarted out from under the players.
    if (!room || room.hostClientId !== peer.id || room.phase === "in-progress") {
      return;
    }
    const seated = [...room.members.values()]
      .filter((m) => m.seat !== null)
      .sort((a, b) => a.seat! - b.seat!);
    const bots = Math.max(
      0,
      Math.min(room.config.botSeats ?? 0, room.config.maxPlayers - seated.length),
    );
    if (seated.length + bots < room.config.minPlayers) {
      return this.send(peer, {
        t: "error",
        message: `Need at least ${room.config.minPlayers} players`,
      });
    }
    const game = requireGame(room.config.gameId);
    const teamMode = (room.config.gameConfig as { teamMode?: string } | undefined)
      ?.teamMode;
    const teamCount =
      teamMode === "teams-of-two" ? 2 : teamMode === "teams-of-three" ? 3 : 0;
    const players: Player[] = seated.map((m) => ({
      id: m.playerId,
      name: m.name,
      seat: m.seat!,
      ...(teamCount ? { team: m.seat! % teamCount } : {}),
    }));
    // Bots take the free seats after the humans.
    const taken = new Set(players.map((p) => p.seat));
    for (let seat = 0, added = 0; added < bots; seat++) {
      if (taken.has(seat)) continue;
      players.push({
        id: `bot-${seat}`,
        name: `Bot ${seat + 1}`,
        seat,
        bot: true,
        ...(teamCount ? { team: seat % teamCount } : {}),
      });
      added++;
    }
    players.sort((a, b) => a.seat - b.seat);
    room.state = game.createInitialState(
      room.config.gameConfig,
      players,
      this.seedFor(room.id),
    );
    room.phase = "in-progress";
    room.startedAt = new Date().toISOString();
    // Fresh game → clear any prior end/grace markers.
    room.endedAt = null;
    room.endedBy = null;
    room.disconnectGraceUntil = null;
    this.snapshotSoon(room.id); // start persisting for restart-survival
    this.broadcastRoom(room);
    this.broadcastState(room);
  }

  /**
   * Host changes the rule variant, bot difficulty or bot seats. Allowed in the
   * lobby or between games (before a rematch); an in-progress game keeps its
   * variant for the whole match.
   */
  private onConfigure(peer: WsPeer, msg: Extract<ClientMessage, { t: "configure" }>) {
    const room = this.rooms.get(msg.roomId);
    if (!room || room.hostClientId !== peer.id) return;
    if (room.phase === "in-progress") {
      return this.send(peer, {
        t: "error",
        message: "The rule variant can't change during a game",
      });
    }
    const game = requireGame(room.config.gameId);
    try {
      const { config, difficulty } = resolveSetup(game, {
        ...(room.config.gameConfig as Record<string, unknown>),
        ...(msg.variant !== undefined ? { variant: msg.variant } : {}),
        difficulty: msg.difficulty ?? room.config.difficulty,
      });
      room.config.gameConfig = config;
      room.config.difficulty = difficulty;
    } catch (e) {
      if (e instanceof GameConfigError)
        return this.send(peer, { t: "error", message: e.message });
      throw e;
    }
    if (typeof msg.botSeats === "number") {
      room.config.botSeats = Math.max(
        0,
        Math.min(Math.floor(msg.botSeats), room.config.maxPlayers - 1),
      );
    }
    this.broadcastRoom(room);
  }

  private onEnd(peer: WsPeer, msg: Extract<ClientMessage, { t: "end" }>) {
    const room = this.rooms.get(msg.roomId);
    if (!room || room.hostClientId !== peer.id) return;
    room.phase = "finished";
    room.endedAt = new Date().toISOString();
    // Record who ended it so every client can notify (natural/auto ends leave
    // this null).
    room.endedBy = room.members.get(peer.id)?.name ?? "The host";
    this.clearTurnTimer(room.id);
    this.clearBotTimer(room.id);
    void deleteRoomSnapshot(room.id).catch(() => {}); // ended → nothing to resume
    this.broadcastRoom(room);
  }

  private onMove(peer: WsPeer, msg: Extract<ClientMessage, { t: "move" }>) {
    const room = this.rooms.get(msg.roomId);
    if (!room || !room.state || room.phase !== "in-progress") return;
    const member = room.members.get(peer.id);
    if (!member || member.seat === null) return; // spectators can't move

    const move = msg.move as BaseMove;
    if (move.seat !== member.seat) {
      return this.send(peer, { t: "error", message: "not your seat" });
    }
    const error = this.applyRoomMove(room, move);
    if (error) return this.send(peer, { t: "error", message: error });
  }

  /**
   * Validate and apply a move to a room's game, then settle and broadcast.
   * Returns an error message when the engine rejects the move.
   */
  private applyRoomMove(room: Room, move: BaseMove): string | null {
    if (!room.state) return "no game";
    const game = requireGame(room.config.gameId);
    const result = applyMove(game, room.state, move);
    if (!result.ok) return result.error;
    room.state = result.state;
    if (game.isTerminal(room.state)) {
      room.phase = "finished";
      room.endedAt = new Date().toISOString();
      this.clearTurnTimer(room.id);
      this.persistResults(room); // server-authoritative → global leaderboard
      void deleteRoomSnapshot(room.id).catch(() => {}); // game over, no resume
      this.broadcastRoom(room);
    } else {
      this.snapshotSoon(room.id); // keep an up-to-date resume point
    }
    this.broadcastState(room);
    return null;
  }

  private clearBotTimer(roomId: string) {
    const t = this.botTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.botTimers.delete(roomId);
    }
  }

  /**
   * If a bot holds the active seat, play its move after the bot delay using
   * the same shared policy as offline play. The search yields between slices,
   * so a deep decision never stalls other rooms.
   */
  private scheduleBotTurn(roomId: string) {
    this.clearBotTimer(roomId);
    const room = this.rooms.get(roomId);
    if (!room?.state || room.phase !== "in-progress") return;
    const active = room.state.activeSeat;
    const bot = room.state.players.find((p) => p.seat === active && p.bot);
    if (active === null || !bot) return;
    const state = room.state;
    const timer = setTimeout(() => {
      this.botTimers.delete(roomId);
      const game = requireGame(room.config.gameId);
      void chooseBotMoveAsync(
        game,
        state,
        active,
        room.config.difficulty ?? "normal",
      ).then((move) => {
        // Drop a decision the room has moved past (end, rematch, timeout).
        if (!move || room.state !== state || room.phase !== "in-progress") return;
        const error = this.applyRoomMove(room, move);
        if (error) log.warn(`bot move rejected in room ${roomId}: ${error}`);
      });
    }, this.botDelayMs);
    (timer as { unref?: () => void }).unref?.();
    this.botTimers.set(roomId, timer);
  }

  /** Record this finished online match to the global leaderboard (humans only,
   * once per match). Fire-and-forget; a datastore outage must not break play. */
  private persistResults(room: Room) {
    if (!room.state) return;
    const game = requireGame(room.config.gameId);
    const scores = game.getScores(room.state);
    const matchId = `${room.id}:${room.startedAt ?? ""}`;
    const rows: OnlineResult[] = [];
    for (const m of room.members.values()) {
      if (m.seat === null) continue; // spectators
      const seat = m.seat;
      const raw = scores.bySeat[seat] ?? 0;
      rows.push({
        gameId: room.config.gameId,
        matchId,
        playerId: m.playerId,
        playerName: m.name,
        won: scores.winners.includes(seat),
        score: raw,
        rankMetric:
          room.config.gameId === "last-card"
            ? -raw
            : (scores.victoryBySeat?.[seat] ?? raw),
        playedAt: new Date().toISOString(),
      });
    }
    void recordOnlineResults(rows)
      .then(() => log.info(`persisted ${rows.length} result(s) for ${room.id}`))
      .catch((e) => log.warn(`persist results failed: ${e}`));
  }

  private onChat(peer: WsPeer, msg: Extract<ClientMessage, { t: "chat" }>) {
    const room = this.rooms.get(msg.roomId);
    if (!room) return;
    const member = room.members.get(peer.id);
    if (!member) return;
    const body = msg.body.trim();
    if (!body || body.length > 500) return;
    room.chat.push({
      id: genId("msg"),
      senderId: member.playerId,
      senderName: member.name,
      body,
      at: new Date().toISOString(),
    });
    if (room.chat.length > 200) room.chat = room.chat.slice(-200);
    // Chat is public to the room → publish to the topic.
    this.publishRoom(room, { t: "chat", messages: room.chat });
  }

  private onSetVisibility(
    peer: WsPeer,
    msg: Extract<ClientMessage, { t: "set-visibility" }>,
  ) {
    const room = this.rooms.get(msg.roomId);
    if (!room || room.hostClientId !== peer.id) return;
    room.config.spectatorVisibility = msg.visibility;
    if (msg.visibility === "locked" && msg.passcode !== undefined) {
      room.config.spectatorPasscode = msg.passcode;
    }
    this.broadcastRoom(room);
  }

  private onLeave(peer: WsPeer) {
    const roomId = this.peerRoom.get(peer.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.cancelGrace(peer.id); // explicit leave → no reconnect grace
    room.members.delete(peer.id);
    room.peers.delete(peer.id);
    peer.unsubscribe(topicFor(roomId));
    if (room.hostClientId === peer.id) {
      const next = [...room.members.values()].find((m) => m.seat !== null);
      room.hostClientId = next?.clientId ?? null;
    }
    this.peerRoom.delete(peer.id);
    // An explicit leave that empties the room → delete it right away.
    if (room.members.size === 0) {
      this.cancelReap(roomId);
      this.clearBotTimer(roomId);
      this.rooms.delete(roomId);
      return;
    }
    this.broadcastRoom(room);
    this.scheduleReap(roomId);
  }

  // --- Broadcast helpers ----------------------------------------------------

  private roomId(room: Room): string {
    return room.id;
  }

  private snapshot(room: Room): RoomSnapshot {
    return {
      id: this.roomId(room),
      gameId: room.config.gameId,
      variant: roomVariant(room.config),
      difficulty: room.config.difficulty ?? "normal",
      botSeats: room.config.botSeats ?? 0,
      phase: room.phase,
      hostClientId: room.hostClientId,
      members: [...room.members.values()],
      maxPlayers: room.config.maxPlayers,
      minPlayers: room.config.minPlayers,
      spectatorVisibility: room.config.spectatorVisibility,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      disconnectGraceUntil: room.disconnectGraceUntil,
      endedBy: room.endedBy,
    };
  }

  private broadcastRoom(room: Room) {
    this.publishRoom(room, { t: "room", room: this.snapshot(room) });
  }

  /** Publish a public message to every member of the room. */
  private publishRoom(room: Room, msg: ServerMessage) {
    const data = JSON.stringify(msg);
    const topic = topicFor(this.roomId(room));
    // Publish reaches OTHER subscribers; also send to each peer directly so the
    // sender/host sees it too (crossws publish excludes the publisher).
    for (const peer of room.peers.values()) {
      peer.send(data);
    }
    void topic;
  }

  private sendStateTo(room: Room, peer: WsPeer) {
    if (!room.state) return;
    const game = requireGame(room.config.gameId);
    const member = room.members.get(peer.id);
    const viewer: Seat | null = member?.seat ?? null;
    const redacted = game.redactFor(room.state, viewer);
    // Always ask the engine — it returns the on-turn moves for the active seat
    // AND any off-turn moves (e.g. an out-of-turn "Last Card" declaration for a
    // seat that reduced to one card). The engine returns [] when there's nothing.
    const legalMoves = viewer !== null ? game.getLegalMoves(room.state, viewer) : [];
    const scores = game.isTerminal(room.state) ? game.getScores(room.state) : null;
    this.send(peer, { t: "state", state: redacted, legalMoves, scores });
  }

  private broadcastState(room: Room) {
    // State is redacted per viewer → must send individually.
    for (const peer of room.peers.values()) this.sendStateTo(room, peer);
    // (Re)arm the optional per-turn timer for the new active seat, and let a
    // bot holding that seat move.
    this.scheduleTurnTimeout(room.id);
    this.scheduleBotTurn(room.id);
  }

  private send(peer: WsPeer, msg: ServerMessage) {
    try {
      peer.send(JSON.stringify(msg));
    } catch {
      /* peer gone */
    }
  }

  /** Number of live rooms (for the create cap). */
  roomCount(): number {
    return this.rooms.size;
  }

  /** Aggregate counts for the health endpoint / ops metrics. */
  stats() {
    let peers = 0;
    let inProgress = 0;
    for (const room of this.rooms.values()) {
      peers += room.peers.size;
      if (room.phase === "in-progress") inProgress++;
    }
    return { rooms: this.rooms.size, peers, inProgress };
  }

  dispose() {
    for (const t of this.reapTimers.values()) clearTimeout(t);
    for (const t of this.graceTimers.values()) clearTimeout(t);
    for (const t of this.turnTimers.values()) clearTimeout(t);
    for (const t of this.snapshotTimers.values()) clearTimeout(t);
    for (const t of this.botTimers.values()) clearTimeout(t);
    this.botTimers.clear();
    this.reapTimers.clear();
    this.graceTimers.clear();
    this.turnTimers.clear();
    this.snapshotTimers.clear();
    this.rooms.clear();
    this.peerRoom.clear();
  }
}

let hub: RoomHub | null = null;
export function getRoomHub(): RoomHub {
  if (!hub) {
    hub = new RoomHub();
    // Best-effort: bring back in-progress games persisted before a restart.
    void hub.rehydrate();
  }
  return hub;
}
