<script setup lang="ts">
/**
 * Standings for one game: labels the metric it ranks by, shows wins, draws,
 * losses and games played for win-based games (the card games keep their wins
 * and games columns), and each player's current experience tier.
 */
import { computed } from "vue";
import { rankingMetric, type Standing } from "#shared/leaderboard";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const props = defineProps<{ gameId: string; rows: Standing[]; t: Translate }>();

const metric = computed(() => rankingMetric(props.gameId));
const caption = computed(() =>
  props.t(
    metric.value === "penalty"
      ? "leaderboard.metricPenalty"
      : metric.value === "victory-points"
        ? "leaderboard.metricVp"
        : "leaderboard.metricWins",
  ),
);
const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-xs font-medium" data-testid="metric-caption">{{ caption }}</p>
    <ol class="space-y-0.5">
      <li
        v-for="(row, i) in rows"
        :key="row.playerId"
        class="flex items-center gap-2 py-2 border-b last:border-b-0 min-w-0"
        :style="{ borderColor: 'var(--games-border)' }"
        data-testid="standing"
      >
        <span class="w-7 shrink-0 text-center text-lg">{{ medal(i) }}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">{{ row.playerName }}</span>
          <span class="block text-[11px]" :style="{ color: 'var(--games-text-muted)' }">
            {{ t(`leaderboard.tier.${row.tier}`) }}
          </span>
        </span>
        <span
          v-if="metric === 'match-wins'"
          class="text-xs tabular-nums text-end leading-tight shrink-0"
          :style="{ color: 'var(--games-text-muted)' }"
          data-testid="wdl"
        >
          <span class="block">{{
            t("leaderboard.wdl", { wins: row.wins, draws: row.draws, losses: row.losses })
          }}</span>
          <span class="block">{{ t("leaderboard.played", { count: row.played }) }}</span>
        </span>
        <span
          v-else
          class="text-sm whitespace-nowrap shrink-0"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ t("leaderboard.wins", { count: row.wins }) }} ·
          {{ t("leaderboard.played", { count: row.played }) }}
        </span>
      </li>
    </ol>
  </div>
</template>
