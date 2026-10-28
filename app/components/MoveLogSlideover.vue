<script setup lang="ts">
/**
 * Move log as an always-accessible side panel: a floating button (bottom-left,
 * mirroring the chat bubble on the right) opens a themed slideover with the full
 * structured log. The button shows the latest action inline and an unread badge
 * so players can glance without opening, keeping the table itself uncluttered.
 */
import type { LogEntry } from "~/composables/useMoveLog";

const props = defineProps<{ entries: LogEntry[] }>();

const open = ref(false);
const unread = ref(0);
const modalUi = useThemedModalUi();

const suitColor = (card?: string) =>
  card && (card.includes("♥") || card.includes("♦")) ? "text-red-500" : "";

watch(
  () => props.entries.length,
  (n, prev) => {
    if (!open.value && n > (prev ?? 0)) unread.value += n - (prev ?? 0);
  },
);
watch(open, (o) => {
  if (o) unread.value = 0;
});
</script>

<template>
  <div>
    <!-- Floating trigger (bottom-left, mirrors the chat bubble) -->
    <button
      type="button"
      class="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-xl transition hover:scale-105 max-w-[60vw]"
      :style="{
        background: 'var(--games-surface-solid)',
        border: '1px solid var(--games-border)',
      }"
      :title="$ts('game.moves')"
      data-tour="moves"
      @click="open = true"
    >
      <span class="relative grid place-items-center">
        <UIcon
          name="i-lucide-scroll-text"
          class="text-lg"
          :style="{ color: 'var(--games-accent)' }"
        />
        <span
          v-if="unread"
          class="absolute -top-2 -right-2 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold"
        >
          {{ unread > 9 ? "9+" : unread }}
        </span>
      </span>
      <span
        class="text-xs font-medium truncate"
        :style="{ color: 'var(--games-text-muted)' }"
      >
        <template v-if="entries.length">
          {{ entries[0]?.who }} {{ entries[0]?.action }}
          <span :class="suitColor(entries[0]?.card)">{{ entries[0]?.card }}</span>
        </template>
        <template v-else>{{ $ts("game.moves") }}</template>
      </span>
    </button>

    <USlideover v-model:open="open" :title="$ts('game.moves')" side="left" :ui="modalUi">
      <template #body>
        <div
          v-if="!entries.length"
          class="flex flex-col items-center gap-2 py-12 text-center"
        >
          <UIcon
            name="i-lucide-scroll-text"
            class="text-3xl"
            :style="{ color: 'var(--games-text-muted)' }"
          />
          <p class="text-sm" :style="{ color: 'var(--games-text-muted)' }">
            {{ $ts("game.noMoves") }}
          </p>
        </div>
        <ol v-else class="space-y-1.5">
          <li
            v-for="(e, i) in entries"
            :key="e.id"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5"
            :style="{
              background:
                i === 0
                  ? 'color-mix(in oklch, var(--games-accent) 12%, transparent)'
                  : 'var(--games-surface)',
              border: '1px solid var(--games-border)',
            }"
          >
            <span
              class="grid place-items-center size-8 shrink-0 rounded-full"
              :style="{
                background: 'var(--games-surface-solid)',
                color: 'var(--games-accent)',
              }"
            >
              <UIcon :name="e.icon" class="size-4" />
            </span>
            <span class="flex-1 min-w-0 leading-tight">
              <span class="font-semibold block truncate">{{ e.who }}</span>
              <span class="text-xs" :style="{ color: 'var(--games-text-muted)' }">{{
                e.action
              }}</span>
            </span>
            <span
              v-if="e.card"
              class="shrink-0 rounded-md px-2 py-1 text-sm font-bold tabular-nums"
              :class="suitColor(e.card)"
              :style="{
                background: 'var(--games-surface-solid)',
                border: '1px solid var(--games-border)',
              }"
            >
              {{ e.card }}
            </span>
          </li>
        </ol>
      </template>
    </USlideover>
  </div>
</template>
