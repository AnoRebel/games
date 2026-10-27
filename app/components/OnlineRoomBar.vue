<script setup lang="ts">
/**
 * Online room controls. Reads REACTIVE room metadata (host, visibility, phase,
 * spectator) from the session so the Start button + Public/Private badge update
 * correctly. Spectators see a read-only indicator and no share/host controls.
 */
import type { WsTransport, RoomInfo } from "~/transports/WsTransport";
import type { BaseGameState, BaseMove } from "@games/engine-core";
import { getGame, variantName } from "@games/engine-core";
import { DIFFICULTY_KEYS, variantItems } from "~/utils/setupOptions";

const props = defineProps<{
  gameId: string;
  transport: WsTransport<BaseGameState, BaseMove>;
  shareUrl: string;
  spectatorUrl: string;
  passcode?: string | null;
}>();

const session = useGameSession(props.transport);
const { copy } = useClipboard();
const { track } = useAnalytics();
const { $ts } = useI18n();
const copiedKey = ref<string | null>(null);

function copyAs(key: string, value: string) {
  copy(value);
  track("share_link_copied", { kind: key });
  copiedKey.value = key;
  setTimeout(() => {
    if (copiedKey.value === key) copiedKey.value = null;
  }, 1500);
}

const info = computed(() => (session.roomInfo.value ?? null) as RoomInfo | null);
const isHost = computed(() => info.value?.isHost ?? false);
const amSpectator = computed(() => info.value?.amSpectator ?? false);
const isLocked = computed(() => info.value?.visibility === "locked");
const phase = computed(() => info.value?.phase ?? "lobby");
const seated = computed(() => info.value?.seated ?? 0);
const here = computed(() => info.value?.here ?? 0);
const minPlayers = computed(() => info.value?.minPlayers ?? 2);
// Bot seats count toward the start requirement; humans fill seats first.
const botSeats = computed(() => info.value?.botSeats ?? 0);
const canStart = computed(
  () =>
    isHost.value &&
    phase.value === "lobby" &&
    seated.value + botSeats.value >= minPlayers.value,
);

// The room's game and rule variant, always visible; the host may change the
// variant between games, never during one.
const meta = computed(() => getGame(props.gameId)?.meta ?? null);
const variantLabel = computed(() =>
  meta.value ? (variantName(meta.value, info.value?.variant) ?? null) : null,
);
const variants = computed(() => variantItems(meta.value));
const canConfigure = computed(
  () => isHost.value && phase.value !== "in-progress" && variants.value.length > 1,
);
const difficultyLabel = computed(() =>
  $ts(DIFFICULTY_KEYS[info.value?.difficulty ?? "normal"].label),
);
function setVariant(v: string) {
  if (v && v !== info.value?.variant) props.transport.configure({ variant: v });
}
// Explain WHY start is unavailable. Once the game has left the lobby the reason
// is that it's already running — not a shortage of players, which is what the
// bare "need players" fallback used to (misleadingly) claim.
const startTitle = computed(() => {
  if (canStart.value) return $ts("room.startGame");
  if (phase.value !== "lobby") return $ts("room.alreadyStarted");
  return $ts("room.needPlayers", { min: minPlayers.value });
});

// Reconnect countdown: when a seated player drops mid-game the server sets a
// grace deadline; show a live countdown so everyone knows the game will end if
// they don't return. A 1s ticker drives the remaining seconds.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 500);
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
});
const graceSeconds = computed(() => {
  const until = info.value?.disconnectGraceUntil ?? null;
  if (!until) return null;
  const s = Math.ceil((until - now.value) / 1000);
  return s > 0 ? s : 0;
});

// Socket connection state — show a "reconnecting" banner on a transient drop so
// the player knows the game isn't lost (the server holds their seat).
const connState = ref(props.transport.getConnectionState());
let offConn: (() => void) | null = null;
onMounted(() => {
  offConn = props.transport.onConnection((s) => {
    connState.value = s;
  });
});
onBeforeUnmount(() => offConn?.());
</script>

<template>
  <div class="space-y-2">
    <!-- Our own socket dropped — reconnecting (server holds our seat) -->
    <UAlert
      v-if="connState === 'reconnecting'"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      :title="$ts('room.reconnecting')"
      :description="$ts('room.reconnectingBody')"
    />

    <!-- Reconnect countdown (a seated player dropped mid-game) -->
    <UAlert
      v-if="graceSeconds !== null"
      color="warning"
      variant="subtle"
      icon="i-lucide-user-x"
      :title="$ts('game.playerLeftTitle')"
      :description="$ts('game.playerLeftCountdown', { count: graceSeconds })"
    />

    <div class="games-surface rounded-xl p-2.5 flex flex-wrap items-center gap-2">
      <!-- Game and rule variant (host may change the variant between games) -->
      <USelect
        v-if="canConfigure"
        :model-value="info?.variant ?? undefined"
        size="xs"
        class="min-w-36"
        :items="variants"
        :aria-label="$ts('setup.variant')"
        data-testid="room-variant"
        @update:model-value="(v: string) => setVariant(v)"
      />
      <UBadge
        v-else-if="variantLabel"
        color="primary"
        variant="subtle"
        icon="i-lucide-scroll-text"
        data-testid="room-variant"
      >
        {{ meta?.name }} · {{ variantLabel }}
      </UBadge>
      <UBadge
        v-if="botSeats > 0"
        color="neutral"
        variant="subtle"
        icon="i-lucide-bot"
        :title="$ts('setup.difficulty')"
      >
        {{ $ts("room.botSeats", { count: botSeats }) }} · {{ difficultyLabel }}
      </UBadge>
      <UBadge color="info" variant="subtle" icon="i-lucide-users">
        {{ $ts("game.seated", { count: seated }) }} ·
        {{ $ts("game.here", { count: here }) }}
      </UBadge>

      <!-- Spectator indicator (read-only) -->
      <UBadge v-if="amSpectator" color="neutral" variant="subtle" icon="i-lucide-eye">
        {{ $ts("common.spectating") }}
      </UBadge>

      <UBadge
        :color="isLocked ? 'warning' : 'success'"
        variant="subtle"
        :icon="isLocked ? 'i-lucide-lock' : 'i-lucide-globe'"
      >
        {{ isLocked ? $ts("common.private") : $ts("common.public") }}
      </UBadge>

      <!-- Click/focus (default) mode so the help is reachable by keyboard and
         touch, not hover-only. -->
      <UPopover>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-info"
          :aria-label="$ts('room.aboutLinks')"
        />
        <template #content>
          <div
            class="p-3 text-xs max-w-64 space-y-1.5"
            :style="{ color: 'var(--games-text-muted)' }"
          >
            <p>
              <strong class="text-default">{{ $ts("room.playerLink") }}</strong> —
              {{ $ts("room.playerLinkExplain") }}
            </p>
            <p>
              <strong class="text-default">{{ $ts("room.spectatorLink") }}</strong> —
              {{ $ts("room.spectatorLinkExplain") }}
            </p>
            <p v-if="isLocked">{{ $ts("room.privateExplain") }}</p>
            <p v-else>{{ $ts("room.publicExplain") }}</p>
          </div>
        </template>
      </UPopover>

      <!-- Share controls: PLAYERS only (spectators can't invite). The QR popover
         carries both the player and spectator links (QR + copy + native share);
         the passcode stays a separate chip since it's not a link. -->
      <template v-if="!amSpectator">
        <RoomShare
          :share-url="shareUrl"
          :spectator-url="spectatorUrl || undefined"
          :title="$ts('app.title')"
        />
        <UButton
          v-if="passcode"
          size="xs"
          variant="soft"
          color="warning"
          icon="i-lucide-key-round"
          :title="$ts('room.copyPasscode')"
          @click="copyAs('code', passcode)"
        >
          {{ copiedKey === "code" ? $ts("game.copied") : passcode }}
        </UButton>
      </template>

      <span class="flex-1" />

      <!-- Host controls -->
      <template v-if="isHost">
        <UButton
          size="xs"
          color="primary"
          icon="i-lucide-play"
          :disabled="!canStart"
          :title="startTitle"
          @click="transport.startGame()"
        >
          {{ $ts("common.start") }}
        </UButton>
        <UButton
          v-if="phase === 'in-progress'"
          size="xs"
          color="error"
          variant="soft"
          icon="i-lucide-square"
          :title="$ts('room.endGame')"
          @click="transport.endGame()"
        >
          {{ $ts("common.end") }}
        </UButton>
      </template>
      <UBadge v-else color="neutral" variant="subtle">
        {{
          phase === "lobby"
            ? $ts("room.waitingForHost")
            : $ts(`lobby.phase${phase === "in-progress" ? "InProgress" : "Finished"}`)
        }}
      </UBadge>
    </div>
  </div>
</template>
