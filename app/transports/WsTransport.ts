/**
 * WsTransport — online play over the Nitro-native WebSocket endpoint (/_ws).
 *
 * Satisfies the same GameTransport interface as LocalTransport, so the table UI
 * is identical online and offline. The server is authoritative: this transport
 * sends intents (join/move/chat) and renders the redacted state it receives.
 */
import type {
  BaseGameState,
  BaseMove,
  Difficulty,
  Player,
  ScoreResult,
  Seat,
} from "@card-games/engine-core";
import type { ChatMessage, GameTransport, PresenceInfo, TransportView } from "./types";

interface ServerStateMsg {
  t: "state";
  state: BaseGameState;
  legalMoves: BaseMove[];
  scores: ScoreResult | null;
}
interface ServerRoomMsg {
  t: "room";
  room: {
    members: {
      clientId: string;
      playerId: string;
      name: string;
      seat: Seat | null;
      spectator: boolean;
      connected: boolean;
    }[];
    hostClientId: string | null;
    spectatorVisibility?: "public" | "locked";
    phase?: "lobby" | "in-progress" | "finished";
    minPlayers?: number;
    maxPlayers?: number;
    disconnectGraceUntil?: number | null;
    endedBy?: string | null;
    variant?: string | null;
    difficulty?: Difficulty;
    botSeats?: number;
  };
}

/** Reactive-friendly room metadata exposed to the UI. */
export interface RoomInfo {
  isHost: boolean;
  amSpectator: boolean;
  visibility: "public" | "locked";
  phase: "lobby" | "in-progress" | "finished";
  seated: number;
  here: number;
  minPlayers: number;
  maxPlayers: number;
  /** Epoch ms by which a dropped seated player must reconnect, else auto-end. */
  disconnectGraceUntil: number | null;
  /** Name of the host who manually ended the game; null otherwise. */
  endedBy: string | null;
  /** The room's rule variant (null for games without variants). */
  variant: string | null;
  /** Strength of bot-filled seats. */
  difficulty: Difficulty;
  /** Seats the server fills with bots at start. */
  botSeats: number;
  /** Snapshot version, bumped on every room update for reactivity. */
  rev: number;
}
type ServerMsg =
  | ServerStateMsg
  | ServerRoomMsg
  | {
      t: "joined";
      youAre: { clientId: string; seat: Seat | null; spectator: boolean };
      isHost: boolean;
    }
  | { t: "denied"; reason: string }
  | { t: "chat"; messages: ChatMessage[] }
  | { t: "error"; message: string };

/** Socket lifecycle exposed to the UI for a connection banner. */
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "closed";

export interface WsTransportOptions {
  roomId: string;
  playerId: string;
  name: string;
  asSpectator?: boolean;
  spectatorPasscode?: string;
  /** ws url; defaults to same-origin /_ws. */
  url?: string;
}

export class WsTransport<
  S extends BaseGameState,
  M extends BaseMove,
> implements GameTransport<S, M> {
  readonly mode = "online" as const;
  viewerSeat: Seat | null = null;

  private ws: WebSocket | null = null;
  private opts: WsTransportOptions;
  private view: TransportView<S, M> | null = null;
  private chat: ChatMessage[] = [];
  private presence: PresenceInfo[] = [];
  private players: Player[] = [];
  private hostClientId: string | null = null;
  private myClientId: string | null = null;
  private amSpectator = false;
  private roomInfo: RoomInfo = {
    isHost: false,
    amSpectator: false,
    visibility: "public",
    phase: "lobby",
    seated: 0,
    here: 0,
    minPlayers: 2,
    maxPlayers: 6,
    disconnectGraceUntil: null,
    endedBy: null,
    variant: null,
    difficulty: "normal",
    botSeats: 0,
    rev: 0,
  };

  private changeCbs = new Set<(v: TransportView<S, M>) => void>();
  private presenceCbs = new Set<() => void>();
  private chatCbs = new Set<(m: ChatMessage[]) => void>();
  private deniedCb?: (reason: string) => void;
  private errorCb?: (msg: string) => void;
  private connectionCbs = new Set<(s: ConnectionState) => void>();

  // Reconnection state. The server keeps a dropped seated player's seat alive
  // for a grace window (PLAYER_GRACE_MS) and reclaims by playerId on re-join, so
  // a transient drop (wifi blip, sleep) recovers if we reconnect fast enough.
  private connectionState: ConnectionState = "connecting";
  private closedByUs = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onOnline = () => this.reconnectNow();
  private onVisible = () => {
    if (!document.hidden) this.reconnectNow();
  };

  constructor(opts: WsTransportOptions) {
    this.opts = opts;
    if (import.meta.client) {
      window.addEventListener("online", this.onOnline);
      document.addEventListener("visibilitychange", this.onVisible);
    }
    this.connect();
  }

  onDenied(cb: (reason: string) => void) {
    this.deniedCb = cb;
  }
  onError(cb: (msg: string) => void) {
    this.errorCb = cb;
  }
  /** Subscribe to connection lifecycle changes (for a "reconnecting" banner). */
  onConnection(cb: (s: ConnectionState) => void) {
    this.connectionCbs.add(cb);
    cb(this.connectionState);
    return () => this.connectionCbs.delete(cb);
  }
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  private setConnection(s: ConnectionState) {
    if (this.connectionState === s) return;
    this.connectionState = s;
    for (const cb of this.connectionCbs) cb(s);
  }
  get isHost() {
    return this.myClientId !== null && this.myClientId === this.hostClientId;
  }
  /** The room this transport is connected to (used by voice chat signalling). */
  get roomId() {
    return this.opts.roomId;
  }
  /** This client's stable player identity (used by voice chat signalling). */
  get playerId() {
    return this.opts.playerId;
  }

  private wsUrl(): string {
    if (this.opts.url) return this.opts.url;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/_ws`;
  }

  private connect() {
    if (this.closedByUs) return;
    this.setConnection(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(this.wsUrl());
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.setConnection("connected");
      // Re-send join on every (re)open; the server reclaims our seat by playerId.
      this.sendRaw({
        t: "join",
        roomId: this.opts.roomId,
        playerId: this.opts.playerId,
        name: this.opts.name,
        asSpectator: this.opts.asSpectator,
        spectatorPasscode: this.opts.spectatorPasscode,
      });
    });
    ws.addEventListener("message", (e) => this.onMessage(String(e.data)));
    ws.addEventListener("close", () => this.scheduleReconnect());
    ws.addEventListener("error", () => {
      // 'error' is followed by 'close'; let close drive the retry. Close the
      // socket to be safe (some browsers don't always fire close after error).
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    });
  }

  /** Reconnect with exponential backoff (capped), unless we closed on purpose. */
  private scheduleReconnect() {
    if (this.closedByUs || this.reconnectTimer) return;
    this.setConnection("reconnecting");
    // 0.5s, 1s, 2s, 4s … capped at 8s, with a little jitter.
    const base = Math.min(8000, 500 * 2 ** Math.min(this.reconnectAttempts, 4));
    const delay = base + Math.floor((this.reconnectAttempts % 3) * 150);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /** Force an immediate reconnect (e.g. network back online / tab visible). */
  private reconnectNow() {
    if (this.closedByUs) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  private onMessage(raw: string) {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(raw) as ServerMsg;
    } catch {
      return;
    }
    switch (msg.t) {
      case "joined":
        this.myClientId = msg.youAre.clientId;
        this.viewerSeat = msg.youAre.seat;
        this.amSpectator = msg.youAre.spectator;
        break;
      case "denied":
        this.deniedCb?.(msg.reason);
        break;
      case "error":
        this.errorCb?.(msg.message);
        break;
      case "room":
        this.hostClientId = msg.room.hostClientId;
        this.presence = msg.room.members.map((m) => ({
          playerId: m.playerId,
          name: m.name,
          seat: m.seat,
          connected: m.connected,
          spectator: m.spectator,
        }));
        // Before a game starts the seated members are the players; once state
        // arrives it is authoritative (and includes any bot seats).
        if (!this.view) {
          this.players = msg.room.members
            .filter((m) => m.seat !== null)
            .map((m) => ({ id: m.playerId, name: m.name, seat: m.seat! }));
        }
        // keep our seat + spectator status in sync
        {
          const me = msg.room.members.find((m) => m.clientId === this.myClientId);
          if (me) {
            this.viewerSeat = me.seat;
            this.amSpectator = me.spectator;
          }
        }
        // Reactive room metadata for the UI (host, visibility, phase, counts).
        this.roomInfo = {
          isHost: this.myClientId !== null && this.myClientId === this.hostClientId,
          amSpectator: this.amSpectator,
          visibility: msg.room.spectatorVisibility ?? "public",
          phase: msg.room.phase ?? "lobby",
          seated: msg.room.members.filter((m) => m.seat !== null && m.connected).length,
          here: msg.room.members.filter((m) => m.connected).length,
          minPlayers: msg.room.minPlayers ?? 2,
          maxPlayers: msg.room.maxPlayers ?? 6,
          disconnectGraceUntil: msg.room.disconnectGraceUntil ?? null,
          endedBy: msg.room.endedBy ?? null,
          variant: msg.room.variant ?? null,
          difficulty: msg.room.difficulty ?? "normal",
          botSeats: msg.room.botSeats ?? 0,
          rev: this.roomInfo.rev + 1,
        };
        // Notify the UI that room membership/host changed (presence, seating)
        // even though no game state arrived — so the lobby/room bar updates.
        for (const cb of this.presenceCbs) cb();
        if (this.view) for (const cb of this.changeCbs) cb(this.view);
        break;
      case "state":
        // Game state lists every seat, bots included (members are humans only).
        if (Array.isArray(msg.state?.players)) this.players = msg.state.players;
        this.view = {
          ready: true,
          state: msg.state as S,
          legalMoves: msg.legalMoves as M[],
          scores: msg.scores,
          isMyTurn: this.viewerSeat !== null && msg.state.activeSeat === this.viewerSeat,
        };
        for (const cb of this.changeCbs) cb(this.view);
        break;
      case "chat":
        this.chat = msg.messages;
        for (const cb of this.chatCbs) cb(this.chat);
        break;
    }
  }

  private sendRaw(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  // --- host/room intents (beyond the base interface) -----------------------
  takeSeat(seat: Seat) {
    this.sendRaw({ t: "take-seat", roomId: this.opts.roomId, seat });
  }
  startGame() {
    this.sendRaw({ t: "start", roomId: this.opts.roomId });
  }
  endGame() {
    this.sendRaw({ t: "end", roomId: this.opts.roomId });
  }
  /** Host: change the rule variant or bot settings (lobby / between games). */
  configure(change: { variant?: string; difficulty?: Difficulty; botSeats?: number }) {
    this.sendRaw({ t: "configure", roomId: this.opts.roomId, ...change });
  }
  setVisibility(visibility: "public" | "locked", passcode?: string) {
    this.sendRaw({ t: "set-visibility", roomId: this.opts.roomId, visibility, passcode });
  }

  // --- GameTransport --------------------------------------------------------
  getView(): TransportView<S, M> {
    return (
      this.view ?? {
        ready: false,
        state: {} as S,
        legalMoves: [],
        scores: null,
        isMyTurn: false,
      }
    );
  }

  async submitMove(move: M) {
    this.sendRaw({ t: "move", roomId: this.opts.roomId, move });
    return { ok: true }; // server validates; rejections arrive via 'error'
  }

  onChange(cb: (v: TransportView<S, M>) => void) {
    this.changeCbs.add(cb);
    if (this.view) cb(this.view);
    return () => this.changeCbs.delete(cb);
  }

  getPresence() {
    return this.presence;
  }

  /** Subscribe to room/presence/host changes (online-only). */
  onPresence(cb: () => void) {
    this.presenceCbs.add(cb);
    return () => this.presenceCbs.delete(cb);
  }

  /** Reactive-friendly room metadata (host, visibility, phase, counts). */
  getRoomInfo(): RoomInfo {
    return this.roomInfo;
  }

  // `sender` is ignored online — the server attributes the message to this
  // connection's member (identity can't be spoofed by the client).
  async sendChat(body: string, _sender?: { id: string; name: string }) {
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, error: "empty" };
    this.sendRaw({ t: "chat", roomId: this.opts.roomId, body: trimmed });
    return { ok: true };
  }

  onChat(cb: (m: ChatMessage[]) => void) {
    this.chatCbs.add(cb);
    cb(this.chat);
    return () => this.chatCbs.delete(cb);
  }
  getChat() {
    return this.chat;
  }
  getPlayers() {
    return this.players;
  }

  destroy() {
    this.closedByUs = true;
    this.setConnection("closed");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (import.meta.client) {
      window.removeEventListener("online", this.onOnline);
      document.removeEventListener("visibilitychange", this.onVisible);
    }
    this.sendRaw({ t: "leave", roomId: this.opts.roomId });
    this.ws?.close();
    this.changeCbs.clear();
    this.chatCbs.clear();
    this.connectionCbs.clear();
    this.presenceCbs.clear();
  }
}
