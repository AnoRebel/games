<script setup lang="ts">
/**
 * Game lobby — offline (LocalTransport) and online (WsTransport) play, plus
 * online room creation with spectator visibility (public/locked).
 */
import { getGame } from "@card-games/engine-core";
import type { BaseGameState, BaseMove } from "@card-games/engine-core";
import type { GameTransport } from "~/transports/types";
import { WsTransport } from "~/transports/WsTransport";

const route = useRoute();
const router = useRouter();
const { $ts, $localePath } = useI18n();
const gameId = computed(() => String(route.params.game));

const meta = computed(() => getGame(gameId.value)?.meta ?? null);
const title = computed(() => meta.value?.name ?? "Game");
useHead({ title: () => title.value });

const { id: playerId, name: playerName } = usePlayerIdentity();
const { track } = useAnalytics();

const totalPlayers = ref(2);
const humanCount = ref(1);
// Rule-variant config chosen in the setup modal (null = engine defaults).
const offlineConfig = ref<Record<string, unknown> | null>(null);
watch(
  meta,
  (m) => {
    if (m) totalPlayers.value = m.supportedPlayerCounts[0] ?? 2;
  },
  { immediate: true },
);

const transport = shallowRef<GameTransport | null>(null);
// Cast to the same parameters `GameTransport` is erased to (and that
// OnlineRoomBar expects). `WsTransport<never, never>` looked harmless but made
// the callback sets contravariantly incompatible, so the prop never type-checked.
const wsTransport = computed(() =>
  transport.value?.mode === "online"
    ? (transport.value as WsTransport<BaseGameState, BaseMove>)
    : null,
);
// Remount the game table whenever the transport INSTANCE changes (e.g. an
// offline rematch swaps in a fresh LocalTransport). Without this, the table's
// setup-time onChange/useGameSession subscriptions stay bound to the destroyed
// transport and the game silently freezes after a rematch. Keying by a counter
// that bumps on every instance swap forces a clean re-setup against the new one.
const transportRev = ref(0);
watch(transport, () => {
  transportRev.value++;
});
const showRules = ref(route.query.rules === "1");
const showLeaderboard = ref(false);
const banner = ref<{ type: "error" | "info"; text: string } | null>(null);
const tutorialRef = ref<{ start: () => void } | null>(null);
const setupOpen = ref(false);

// Daily challenge: ?daily=1 starts an offline game on the shared seed of the day.
const { today: daily, markPlayed: markDailyPlayed } = useDailyChallenge();
const isDaily = ref(false);

// Auto-open the setup modal when arriving with no active game and no shared room.
onMounted(() => {
  if (transport.value || route.query.room || !meta.value) return;
  if (route.query.daily === "1" && daily.value.gameId === gameId.value) {
    isDaily.value = true;
    totalPlayers.value = 2;
    humanCount.value = 1;
    offlineConfig.value = null;
    startOffline(daily.value.seed);
    return;
  }
  // The guards above are synchronous, so no delay/race-hack is needed here.
  setupOpen.value = true;
});

function onSetupOffline(cfg: {
  totalPlayers: number;
  humanCount: number;
  config?: Record<string, unknown> | null;
}) {
  totalPlayers.value = cfg.totalPlayers;
  humanCount.value = cfg.humanCount;
  offlineConfig.value = cfg.config ?? null;
  startOffline();
}
const onlineConfig = ref<Record<string, unknown> | null>(null);
const onlineTurnTimeoutMs = ref<number | undefined>(undefined);
const onlinePersist = ref<boolean | undefined>(undefined);
const onlineMaxSpectators = ref<number | undefined>(undefined);
function onSetupOnline(cfg: {
  totalPlayers: number;
  visibility: "public" | "locked";
  customId?: string;
  config?: Record<string, unknown> | null;
  turnTimeoutMs?: number;
  persist?: boolean;
  maxSpectators?: number;
}) {
  totalPlayers.value = cfg.totalPlayers;
  onlineVisibility.value = cfg.visibility;
  onlineConfig.value = cfg.config ?? null;
  onlineTurnTimeoutMs.value = cfg.turnTimeoutMs;
  onlinePersist.value = cfg.persist;
  onlineMaxSpectators.value = cfg.maxSpectators;
  createOnlineRoom(cfg.customId);
}

// Record results to the leaderboard once, when a game terminates.
const recordedFor = ref<string | null>(null);
const gameOver = ref(false);
function watchForResults(t: GameTransport) {
  const off = t.onChange((view) => {
    gameOver.value = !!view.scores;
    if (!view.scores) return;
    const key = `${gameId.value}:${(view.state as { version?: number }).version ?? ""}`;
    if (recordedFor.value === key) return;
    recordedFor.value = key;
    const players = t.getPlayers();
    const scores = view.scores;
    track("game_finished", {
      game: gameId.value,
      mode: t.mode,
      players: players.length,
      youWon: t.viewerSeat != null && scores.winners.includes(t.viewerSeat),
    });
    if (isDaily.value) markDailyPlayed(); // advance the daily streak

    void recordResults(
      // Only record real humans — bots must never appear on the leaderboard.
      players
        .filter((p) => !p.bot)
        .map((p) => ({
          gameId: gameId.value,
          playerId: p.id,
          playerName: p.name,
          won: scores.winners.includes(p.seat),
          score: scores.bySeat[p.seat] ?? 0,
          // higher-is-better metric: Last Card penalty is lower-better → negate.
          rankMetric:
            gameId.value === "last-card"
              ? -(scores.bySeat[p.seat] ?? 0)
              : (scores.victoryBySeat?.[p.seat] ?? scores.bySeat[p.seat] ?? 0),
          playedAt: new Date().toISOString(),
          matchId: key,
          visibility:
            t.mode === "local"
              ? "offline"
              : onlineVisibility.value === "locked"
                ? "private"
                : "public",
        })),
    );
    off();
  });
}

// The live game's rule variant drives the rules panel and tutorial content.
const activeVariant = ref<string | null>(null);
watch(transport, (t, _old, onCleanup) => {
  activeVariant.value = null;
  if (!t) return;
  const off = t.onChange((view) => {
    const v = (view.state as { variant?: unknown } | undefined)?.variant;
    activeVariant.value = typeof v === "string" ? v : null;
  });
  onCleanup(off);
});

// Event toasts: bound once in setup; the composable watches the transport ref
// internally (so useToast/useI18n resolve in proper setup context).
useGameNotifications(transport as Ref<GameTransport | null>, gameId);

// --- offline ---------------------------------------------------------------
function startOffline(seed?: string) {
  transport.value?.destroy();
  transport.value = createLocalTransport({
    gameId: gameId.value,
    totalPlayers: totalPlayers.value,
    humanCount: humanCount.value,
    humanNames: [playerName.value],
    humanIds: [playerId.value], // seat 0 = this device's persistent identity
    config: offlineConfig.value ?? undefined,
    seed, // daily challenge passes the shared seed of the day
  });
  track("game_started", {
    game: gameId.value,
    mode: "offline",
    players: totalPlayers.value,
    humans: humanCount.value,
    daily: isDaily.value,
  });
  watchForResults(transport.value);
}

// Restart: a fresh deal with the same setup. Offline re-deals immediately;
// online asks the host to start again (the room stays).
function restart() {
  gameOver.value = false;
  if (transport.value?.mode === "local") {
    recordedFor.value = null;
    startOffline();
  } else if (wsTransport.value) {
    wsTransport.value.startGame();
  }
}

// Rematch is available offline always, and online only to the host.
const canRematch = computed(() => {
  const t = transport.value;
  if (!t) return false;
  if (t.mode === "local") return true;
  const info = (t as WsTransport<never, never>).getRoomInfo?.();
  return info?.isHost ?? false;
});

// "New game": tear down the current game and reopen setup.
function newGame() {
  gameOver.value = false;
  transport.value?.destroy();
  transport.value = null;
  recordedFor.value = null;
  createdPasscode.value = null;
  if (route.query.room) {
    router.replace({
      query: { ...route.query, room: undefined, spectate: undefined, code: undefined },
    });
  }
  setupOpen.value = true;
}

// --- online ----------------------------------------------------------------
const onlineVisibility = ref<"public" | "locked">("public");
const creating = ref(false);
const createdPasscode = ref<string | null>(null);

const loading = useLoadingIndicator();
const codeModalUi = useThemedModalUi();

async function createOnlineRoom(customId?: string) {
  creating.value = true;
  banner.value = null;
  // Drive the top progress bar during the async create + join (not a route nav).
  loading.start();
  try {
    const res = await $fetch<{ roomId: string; spectatorPasscode?: string }>(
      "/api/rooms",
      {
        method: "POST",
        body: {
          gameId: gameId.value,
          playerCount: totalPlayers.value,
          spectatorVisibility: onlineVisibility.value,
          customId: customId?.trim() || undefined,
          gameConfig: onlineConfig.value ?? undefined,
          turnTimeoutMs: onlineTurnTimeoutMs.value,
          persist: onlinePersist.value,
          maxSpectators: onlineMaxSpectators.value,
        },
      },
    );
    createdPasscode.value = res.spectatorPasscode ?? null;
    track("room_created", {
      game: gameId.value,
      visibility: onlineVisibility.value,
      players: totalPlayers.value,
    });
    // Host joins its own (possibly locked) room with the code it just received.
    joinOnline(res.roomId, false, createdPasscode.value ?? undefined);
    // Reflect the room in the URL so it can be shared.
    router.replace({ query: { ...route.query, room: res.roomId } });
  } catch (e) {
    banner.value = {
      type: "error",
      text: $ts("lobby.couldNotCreate", { error: String(e) }),
    };
  } finally {
    creating.value = false;
    loading.finish();
  }
}

// Passcode prompt state for joining a locked room without a code in the URL.
const codePrompt = ref<{ roomId: string; spectate: boolean } | null>(null);
const codeInput = ref("");

function joinOnline(roomId: string, asSpectator: boolean, passcode?: string) {
  transport.value?.destroy();
  const t = new WsTransport({
    roomId,
    playerId: playerId.value,
    name: playerName.value,
    asSpectator,
    spectatorPasscode: passcode,
  });
  t.onDenied((reason) => {
    transport.value = null;
    // Missing/incorrect code on a locked room → prompt for it.
    if (/passcode|authoriz/i.test(reason)) {
      codePrompt.value = { roomId, spectate: asSpectator };
    } else {
      banner.value = { type: "error", text: reason };
    }
  });
  t.onError((msg) => (banner.value = { type: "error", text: msg }));
  transport.value = t as unknown as GameTransport;
  watchForResults(transport.value);
}

function submitCode() {
  const p = codePrompt.value;
  const code = codeInput.value.trim();
  if (!p || !code) return;
  codePrompt.value = null;
  codeInput.value = "";
  joinOnline(p.roomId, p.spectate, code);
}

// --- join by link / room id + code -----------------------------------------
const joinLink = ref("");
const joinRoomId = ref("");
const joinCode = ref("");

/** Parse a pasted share link OR a raw room id, plus an optional code/spectate. */
function joinByInput(asSpectator: boolean) {
  banner.value = null;
  let roomId = joinRoomId.value.trim();
  let code = joinCode.value.trim() || undefined;
  let spectate = asSpectator;

  const raw = joinLink.value.trim();
  if (raw) {
    try {
      const url = new URL(raw, location.origin);
      roomId = url.searchParams.get("room") ?? roomId;
      code = url.searchParams.get("code") ?? code;
      if (url.searchParams.get("spectate") === "1") spectate = true;
    } catch {
      // Not a URL — treat the whole thing as a room id.
      roomId = raw;
    }
  }
  if (!roomId) {
    banner.value = { type: "error", text: $ts("lobby.enterRoomOrId") };
    return;
  }
  if (code) createdPasscode.value = code;
  router.replace({
    query: {
      ...route.query,
      room: roomId,
      spectate: spectate ? "1" : undefined,
      code: code ?? undefined,
    },
  });
  joinOnline(roomId, spectate, code);
}

// Auto-join if the URL carries a room id (shared link).
onMounted(() => {
  const room = route.query.room;
  if (typeof room === "string" && room) {
    const spectate = route.query.spectate === "1";
    const passcode = typeof route.query.code === "string" ? route.query.code : undefined;
    // Carry the code so this client can re-share the proper (locked) links.
    if (passcode) createdPasscode.value = passcode;
    joinOnline(room, spectate, passcode);
  }
});

function quit() {
  transport.value?.destroy();
  transport.value = null;
  createdPasscode.value = null;
  router.replace({
    query: { ...route.query, room: undefined, spectate: undefined, code: undefined },
  });
}

onBeforeUnmount(() => transport.value?.destroy());

const baseRoomUrl = computed(() => {
  if (!import.meta.client || !route.query.room) return "";
  return `${location.origin}${location.pathname}?room=${route.query.room}`;
});
// Locked rooms require the code to JOIN too → bake it into the player link.
const shareUrl = computed(() => {
  if (!baseRoomUrl.value) return "";
  return createdPasscode.value
    ? `${baseRoomUrl.value}&code=${createdPasscode.value}`
    : baseRoomUrl.value;
});
const spectatorShareUrl = computed(() => {
  if (!baseRoomUrl.value) return "";
  const base = `${baseRoomUrl.value}&spectate=1`;
  return createdPasscode.value ? `${base}&code=${createdPasscode.value}` : base;
});
</script>

<template>
  <div class="space-y-3">
    <CardSprite />

    <!-- Compact header -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UButton
          :to="$localePath('/')"
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-arrow-left"
          square
        />
        <h1
          class="text-xl font-bold truncate"
          :class="gameId === 'albastini' ? 'font-albastini italic' : 'font-last-card'"
        >
          {{ title }}
        </h1>
      </div>
      <div class="flex gap-0.5">
        <UButton
          v-if="transport"
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-graduation-cap"
          :title="$ts('common.tutorial')"
          :aria-label="$ts('common.tutorial')"
          @click="tutorialRef?.start()"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-trophy"
          :title="$ts('leaderboard.title')"
          :aria-label="$ts('leaderboard.title')"
          @click="showLeaderboard = true"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-book-open"
          :title="$ts('common.rules')"
          :aria-label="$ts('common.rules')"
          @click="showRules = true"
        />
        <UButton
          v-if="transport"
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-x"
          :title="$ts('common.quit')"
          :aria-label="$ts('common.quit')"
          @click="quit"
        />
      </div>
    </div>

    <UAlert
      v-if="banner"
      :color="banner.type === 'error' ? 'error' : 'info'"
      variant="subtle"
      :title="banner.text"
      :close="true"
      @update:open="banner = null"
    />

    <!-- Live game -->
    <div v-if="transport" class="space-y-3">
      <OnlineRoomBar
        v-if="wsTransport"
        :transport="wsTransport"
        :share-url="shareUrl"
        :spectator-url="spectatorShareUrl"
        :passcode="createdPasscode"
      />

      <LastCardTable
        v-if="gameId === 'last-card'"
        :key="`lc-${transportRev}`"
        :transport="transport as any"
        :can-rematch="canRematch"
        :share-url="wsTransport ? shareUrl : null"
        @restart="restart"
        @new-game="newGame"
        @exit="quit"
      />
      <AlbastiniTable
        v-else-if="gameId === 'albastini'"
        :key="`ab-${transportRev}`"
        :transport="transport as any"
        :can-rematch="canRematch"
        :share-url="wsTransport ? shareUrl : null"
        @restart="restart"
        @new-game="newGame"
        @exit="quit"
      />

      <!-- Floating chat (renders fixed) -->
      <GameChat :transport="transport as any" :name="playerName" />
      <GameTutorial ref="tutorialRef" :game-id="gameId" :variant="activeVariant" />
    </div>

    <!-- Idle: leaderboard preview + a prompt to set up (modal auto-opens) -->
    <div v-else-if="meta" class="space-y-3">
      <button
        type="button"
        class="w-full cg-surface rounded-2xl p-6 text-center transition hover:-translate-y-0.5"
        @click="setupOpen = true"
      >
        <p class="text-3xl mb-1">🃏</p>
        <p class="font-display font-bold text-lg">{{ $ts("common.play") }} {{ title }}</p>
        <p class="text-xs mt-1" :style="{ color: 'var(--cg-text-muted)' }">
          {{ $ts("lobby.tapToSetUp") }}
        </p>
      </button>
      <!-- Join an existing online game by link, or room id + code -->
      <div class="cg-surface rounded-2xl p-4 space-y-3">
        <p class="text-sm font-semibold flex items-center gap-1.5">
          <UIcon name="i-lucide-link" :style="{ color: 'var(--cg-accent)' }" />
          {{ $ts("lobby.joinExisting") }}
        </p>
        <UFormField :label="$ts('lobby.joinByLink')" size="sm">
          <UInput
            v-model="joinLink"
            size="sm"
            class="w-full"
            :placeholder="$ts('lobby.joinByLinkPlaceholder')"
            icon="i-lucide-clipboard"
          />
        </UFormField>
        <div
          class="flex items-center gap-2 text-xs"
          :style="{ color: 'var(--cg-text-muted)' }"
        >
          <span class="flex-1 border-t" :style="{ borderColor: 'var(--cg-border)' }" />
          {{ $ts("common.or") }}
          <span class="flex-1 border-t" :style="{ borderColor: 'var(--cg-border)' }" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="$ts('lobby.roomId')" size="sm">
            <UInput v-model="joinRoomId" size="sm" class="w-full" icon="i-lucide-hash" />
          </UFormField>
          <UFormField :label="$ts('lobby.code')" :hint="$ts('common.optional')" size="sm">
            <UInput
              v-model="joinCode"
              size="sm"
              class="w-full"
              icon="i-lucide-key-round"
            />
          </UFormField>
        </div>
        <div class="flex gap-2">
          <UButton
            color="primary"
            icon="i-lucide-log-in"
            class="flex-1 justify-center"
            @click="joinByInput(false)"
          >
            {{ $ts("lobby.joinAsPlayer") }}
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-eye"
            class="flex-1 justify-center"
            @click="joinByInput(true)"
          >
            {{ $ts("lobby.spectate") }}
          </UButton>
        </div>
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        <UButton
          variant="soft"
          color="neutral"
          icon="i-lucide-radio"
          :to="$localePath('/rooms')"
        >
          {{ $ts("lobby.browseRooms") }}
        </UButton>
        <UButton
          variant="soft"
          color="neutral"
          icon="i-lucide-trophy"
          @click="showLeaderboard = true"
        >
          {{ $ts("leaderboard.title") }}
        </UButton>
      </div>
    </div>

    <UAlert
      v-else
      color="error"
      variant="subtle"
      :title="$ts('lobby.unknownGame')"
      :description="$ts('lobby.unknownGameDesc', { id: gameId })"
    />

    <GameSetupModal
      v-if="meta"
      v-model:open="setupOpen"
      :game-id="gameId"
      @start-offline="onSetupOffline"
      @start-online="onSetupOnline"
    />
    <GameRulesPanel
      v-if="meta"
      v-model:open="showRules"
      :game-id="gameId"
      :variant="activeVariant"
    />
    <LeaderboardSlideover v-if="meta" v-model:open="showLeaderboard" :game-id="gameId" />

    <!-- Passcode prompt for a private (locked) room -->
    <UModal
      :open="codePrompt !== null"
      :title="$ts('lobby.privateRoom')"
      :ui="codeModalUi"
      @update:open="
        (o: boolean) => {
          if (!o) codePrompt = null;
        }
      "
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="submitCode">
          <p class="text-sm" :style="{ color: 'var(--cg-text-muted)' }">
            {{
              codePrompt?.spectate
                ? $ts("lobby.privateRoomWatch")
                : $ts("lobby.privateRoomJoin")
            }}
          </p>
          <UInput
            v-model="codeInput"
            :placeholder="$ts('lobby.passcode')"
            autofocus
            size="lg"
          />
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="codePrompt = null">
              {{ $ts("game.cancel") }}
            </UButton>
            <UButton type="submit" color="primary" :disabled="!codeInput.trim()">
              {{ $ts("common.start") }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
