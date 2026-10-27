<script setup lang="ts">
/**
 * Per-game leaderboard. Themed surface, responsive, collapsible on the table.
 */
const props = defineProps<{ gameId: string }>();
const { rows } = useLeaderboard(() => props.gameId);
const open = ref(true);

const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
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
        <ol v-else class="px-3 pb-2">
          <li
            v-for="(row, i) in rows"
            :key="row.playerId"
            class="flex items-center gap-3 py-1.5 border-t first:border-t-0"
            :style="{ borderColor: 'var(--games-border)' }"
          >
            <span class="w-6 text-center">{{ medal(i) }}</span>
            <span class="flex-1 truncate font-medium">{{ row.playerName }}</span>
            <span
              class="text-sm whitespace-nowrap"
              :style="{ color: 'var(--games-text-muted)' }"
            >
              {{ $ts("leaderboard.wins", { count: row.wins }) }} ·
              {{ $ts("leaderboard.played", { count: row.played }) }}
            </span>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>
