<script setup lang="ts">
/**
 * Per-game leaderboard. Themed surface, responsive, collapsible on the table.
 */
const props = defineProps<{ gameId: string }>();
const { rows } = useLeaderboard(() => props.gameId);
const open = ref(true);

const { $ts } = useI18n();
const t = (key: string, params?: Record<string, string | number>) => $ts(key, params);
</script>

<template>
  <div class="games-surface rounded-xl overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold"
      :title="open ? 'Collapse leaderboard' : 'Expand leaderboard'"
      @click="open = !open"
    >
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-trophy" /> {{ $ts("leaderboard.title") }}
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <div
      class="grid transition-[grid-template-rows] duration-300"
      :style="{ gridTemplateRows: open ? '1fr' : '0fr' }"
    >
      <div class="overflow-hidden">
        <p
          v-if="!rows.length"
          class="px-3 pb-3 text-sm"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("leaderboard.empty") }}
        </p>
        <div v-else class="px-3 pb-2">
          <LeaderboardStandings :game-id="gameId" :rows="rows" :t="t" />
        </div>
      </div>
    </div>
  </div>
</template>
