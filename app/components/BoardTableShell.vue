<script setup lang="ts">
/**
 * Common frame for the board games: waits for state, shows whose turn it is,
 * hosts the board (default slot) and runs the end-of-game dialog with
 * rematch / new game / exit — identically offline and online.
 */
import type { BaseGameState, BaseMove } from "@games/engine-core";
import type { GameTransport } from "~/transports/types";

const props = defineProps<{
  transport: GameTransport<BaseGameState, BaseMove>;
  gameId: string;
  canRematch?: boolean;
  shareUrl?: string | null;
}>();
const emit = defineEmits<{ restart: []; newGame: []; exit: [] }>();

const session = useGameSession(props.transport);
const { state, legalMoves, isMyTurn, scores, players, viewerSeat, ready } = session;
const { $ts } = useI18n();
const sfx = useSoundFx();

const t = (key: string, params?: Record<string, string | number>) => $ts(key, params);
const hasState = computed(() => ready.value && !!state.value?.players?.length);
const activeName = computed(
  () => players.value.find((p) => p.seat === state.value?.activeSeat)?.name ?? "—",
);

const showGameOver = ref(false);
watch(scores, (s) => {
  if (!s) {
    showGameOver.value = false; // rematch → close it
    return;
  }
  const won = viewerSeat.value !== null && s.winners.includes(viewerSeat.value);
  sfx.play(s.drawn ? "notify" : won ? "win" : "lose");
  if (won) confetti();
  setTimeout(() => (showGameOver.value = true), 600);
});

// A soft cue for every move landing on the board.
watch(
  () => state.value?.version,
  (v, old) => {
    if (v !== undefined && old !== undefined && v > old) sfx.play("play");
  },
);

// Host ended the game early (no natural result).
const endedBy = computed(
  () => (session.roomInfo.value as { endedBy?: string | null } | null)?.endedBy ?? null,
);
watch(endedBy, (name) => {
  if (name && !scores.value) showGameOver.value = true;
  else if (!name && !scores.value) showGameOver.value = false;
});

async function play(move: BaseMove) {
  await session.play(move);
}
</script>

<template>
  <div v-if="!hasState" class="games-surface rounded-2xl p-10 text-center space-y-2">
    <UIcon name="i-lucide-loader-circle" class="animate-spin text-2xl" />
    <p class="text-sm" :style="{ color: 'var(--games-text-muted)' }">
      {{ $ts("game.waitingToStart") }}
    </p>
  </div>

  <div v-else class="space-y-3 games-scene-surface rounded-2xl p-2 sm:p-4">
    <div class="flex justify-center">
      <span
        class="text-sm font-semibold rounded-full px-4 py-1.5 min-h-11 inline-flex items-center"
        :class="isMyTurn ? 'games-turn-active' : ''"
        :style="
          isMyTurn
            ? { background: 'var(--games-accent)', color: 'var(--games-accent-contrast)' }
            : { color: 'var(--games-text-muted)' }
        "
        data-testid="turn-pill"
      >
        <template v-if="scores">{{ $ts("game.gameOver") }}</template>
        <template v-else-if="isMyTurn">{{ $ts("game.yourTurn") }}</template>
        <template v-else>{{ $ts("game.waitingFor", { name: activeName }) }}</template>
      </span>
    </div>

    <slot
      :state="state"
      :legal-moves="legalMoves"
      :viewer-seat="viewerSeat"
      :interactive="isMyTurn && viewerSeat !== null && !scores"
      :players="players"
      :t="t"
      :play="play"
    />

    <GameOverDialog
      v-if="scores || endedBy"
      v-model:open="showGameOver"
      :scores="scores"
      :ended-by="endedBy"
      :players="players"
      :viewer-seat="viewerSeat"
      :game-id="gameId"
      :can-rematch="canRematch"
      :share-url="shareUrl"
      @rematch="emit('restart')"
      @new-game="emit('newGame')"
      @exit="emit('exit')"
    />
  </div>
</template>
