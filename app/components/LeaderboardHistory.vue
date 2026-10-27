<script setup lang="ts">
/**
 * Recent plays beside the standings: game, rule variant, bot difficulty,
 * the player's experience tier at the time, the result and the date.
 * Plays recorded before this information existed show it as unknown; a play
 * without bots shows the difficulty as not applicable.
 */
import { format } from "date-fns";
import { getGame, variantName } from "@games/engine-core";
import type { HistoryEntry } from "#shared/leaderboard";
import { DIFFICULTY_KEYS } from "~/utils/setupOptions";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const props = defineProps<{ entries: HistoryEntry[]; t: Translate }>();

function labels(e: HistoryEntry) {
  const t = props.t;
  const meta = getGame(e.gameId)?.meta;
  const legacy = e.difficulty === null;
  const game = meta?.name ?? e.gameId;
  const variant = legacy
    ? t("leaderboard.unknown")
    : e.variant
      ? meta
        ? (variantName(meta, e.variant) ?? e.variant)
        : e.variant
      : null;
  const difficulty = legacy
    ? t("leaderboard.unknown")
    : e.difficulty === "none"
      ? t("leaderboard.notApplicable")
      : t(DIFFICULTY_KEYS[e.difficulty!].label);
  const tier = e.tier ? t(`leaderboard.tier.${e.tier}`) : t("leaderboard.unknown");
  return { game, variant, difficulty, tier };
}

function when(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}
</script>

<template>
  <section class="space-y-1.5" :aria-label="t('leaderboard.history')">
    <h3 class="text-xs font-semibold uppercase tracking-wide">
      {{ t("leaderboard.history") }}
    </h3>
    <p
      v-if="!entries.length"
      class="text-sm"
      :style="{ color: 'var(--games-text-muted)' }"
    >
      {{ t("leaderboard.noHistory") }}
    </p>
    <ul v-else class="space-y-1">
      <li
        v-for="(e, i) in entries"
        :key="`${e.playerId}-${e.playedAt}-${i}`"
        class="rounded-lg px-2.5 py-1.5 min-w-0"
        :style="{
          background: 'var(--games-surface)',
          border: '1px solid var(--games-border)',
        }"
        data-testid="history-row"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="truncate font-medium flex-1 min-w-0">{{ e.playerName }}</span>
          <span class="text-xs font-semibold shrink-0" :data-result="e.result">
            {{ t(`leaderboard.result.${e.result}`) }}
          </span>
        </div>
        <div
          class="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          <span data-testid="h-game">{{ labels(e).game }}</span>
          <span v-if="labels(e).variant" data-testid="h-variant"
            >· {{ labels(e).variant }}</span
          >
          <span data-testid="h-difficulty"
            >· {{ t("leaderboard.bot") }}: {{ labels(e).difficulty }}</span
          >
          <span data-testid="h-tier">· {{ labels(e).tier }}</span>
          <span data-testid="h-date">· {{ when(e.playedAt) }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>
