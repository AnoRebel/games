<script setup lang="ts">
/**
 * End-of-game modal. Two modes:
 *  - natural end (`scores` present): ranked scoreboard, winner highlighted.
 *  - host-ended (`endedBy` set, no scores): a short "ended the game" notice.
 * Both offer rematch / new game / exit. Rematch keeps the same room/setup; new
 * game returns to setup; exit leaves to the lobby.
 */
import type { Player, ScoreResult, Seat } from "@games/engine-core";

const props = defineProps<{
  scores: ScoreResult | null;
  /** Host who manually ended the game (no natural result). */
  endedBy?: string | null;
  players: Player[];
  viewerSeat: Seat | null;
  gameId: string;
  /** Online host can trigger a rematch for everyone; offline always can. */
  canRematch?: boolean;
  /** Online room share URL — enables an "invite your group" CTA. */
  shareUrl?: string | null;
}>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ rematch: []; newGame: []; exit: [] }>();

const modalUi = useThemedModalUi();

// Albastini ranks by victory points (higher better); Last Card by penalty
// (lower better); the board games show seeds / pieces left (higher better).
// Use victoryBySeat when present, else raw score.
const useVp = computed(() => !!props.scores?.victoryBySeat);
const boardGame = computed(() => props.gameId === "bao" || props.gameId === "checkers");
const higherBetter = computed(() => useVp.value || boardGame.value);
const scoredLabel = computed(() =>
  useVp.value
    ? "game.scoredVp"
    : props.gameId === "bao"
      ? "board.scoredSeeds"
      : props.gameId === "checkers"
        ? "board.scoredPieces"
        : "game.scoredPenalty",
);
const drawn = computed(() => !!props.scores?.drawn);
const rows = computed(() => {
  const s = props.scores;
  if (!s) return [];
  return props.players
    .map((p) => ({
      seat: p.seat,
      name: p.name,
      score:
        (useVp.value ? s.victoryBySeat?.[p.seat] : undefined) ?? s.bySeat[p.seat] ?? 0,
      won: s.winners.includes(p.seat),
      you: p.seat === props.viewerSeat,
    }))
    .sort((a, b) => (higherBetter.value ? b.score - a.score : a.score - b.score));
});
const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
const youWon = computed(
  () =>
    !!props.scores &&
    props.viewerSeat != null &&
    props.scores.winners.includes(props.viewerSeat),
);
const winnerNames = computed(() =>
  props.players
    .filter((p) => props.scores?.winners.includes(p.seat))
    .map((p) => p.name)
    .join(", "),
);
</script>

<template>
  <UModal v-model:open="open" :title="$ts('game.gameOver')" :ui="modalUi">
    <template #body>
      <!-- Host-ended (no natural result) -->
      <div v-if="!scores" class="text-center space-y-2 py-2">
        <p class="text-4xl">🛑</p>
        <p class="font-display text-lg font-bold">
          {{ $ts("game.endedByHost", { name: endedBy || $ts("game.theHost") }) }}
        </p>
        <p class="text-sm" :style="{ color: 'var(--games-text-muted)' }">
          {{ $ts("game.endedByHostBody") }}
        </p>
      </div>

      <!-- Natural end: scoreboard -->
      <div v-else class="space-y-4">
        <!-- Headline -->
        <div class="text-center space-y-1">
          <p class="text-4xl">
            {{ youWon ? "🏆" : drawn ? "🤝" : boardGame ? "🏁" : "🎴" }}
          </p>
          <p class="font-display text-lg font-bold">
            {{
              drawn
                ? $ts("board.draw")
                : youWon
                  ? $ts("game.youWin")
                  : $ts("game.wins", { name: winnerNames || "—" })
            }}
          </p>
          <p class="text-xs" :style="{ color: 'var(--games-text-muted)' }">
            {{ $ts(scoredLabel) }}
          </p>
        </div>

        <!-- Scoreboard -->
        <ol class="space-y-1">
          <li
            v-for="(row, i) in rows"
            :key="row.seat"
            class="flex items-center gap-3 rounded-lg px-3 py-2"
            :style="{
              background: row.won
                ? 'color-mix(in oklch, var(--games-accent) 16%, transparent)'
                : 'var(--games-surface)',
              border: row.won
                ? '1px solid var(--games-accent)'
                : '1px solid var(--games-border)',
            }"
          >
            <span class="w-7 text-center text-lg">{{ medal(i) }}</span>
            <span class="flex-1 truncate font-medium">
              {{ row.name }}
              <span
                v-if="row.you"
                class="text-xs"
                :style="{ color: 'var(--games-text-muted)' }"
              >
                ({{ $ts("game.you") }})
              </span>
            </span>
            <span
              class="text-lg font-bold tabular-nums"
              :style="{ color: row.won ? 'var(--games-accent)' : 'var(--games-text)' }"
            >
              {{ row.score }}
            </span>
          </li>
        </ol>
      </div>
    </template>
    <template #footer>
      <div class="w-full space-y-2">
        <!-- Highest-intent moment to invite the group to play again -->
        <div v-if="shareUrl" class="flex justify-center">
          <RoomShare :share-url="shareUrl" :title="$ts('app.title')" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
          <UButton
            v-if="canRematch"
            color="primary"
            icon="i-lucide-rotate-ccw"
            class="justify-center"
            @click="emit('rematch')"
          >
            {{ $ts("game.rematch") }}
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-settings-2"
            class="justify-center"
            @click="emit('newGame')"
          >
            {{ $ts("game.newGame") }}
          </UButton>
          <UButton
            variant="ghost"
            color="error"
            icon="i-lucide-log-out"
            class="justify-center"
            @click="emit('exit')"
          >
            {{ $ts("game.exit") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
