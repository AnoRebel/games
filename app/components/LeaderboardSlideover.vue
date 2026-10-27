<script setup lang="ts">
/**
 * Leaderboard slideover. The GLOBAL board is server-authoritative (only ranked
 * online matches, shared across everyone). The other scopes (all/public/private/
 * offline) are this device's LOCAL history — honest "your games", never merged
 * with the global ranking.
 */
import type { LeaderboardScope } from "~/composables/useLeaderboard";
import type { HistoryEntry, Standing } from "#shared/leaderboard";

type Scope = "global" | LeaderboardScope;

const props = defineProps<{ gameId: string }>();
const open = defineModel<boolean>("open", { default: false });

const scope = ref<Scope>("global");
const localScope = computed<LeaderboardScope>(() =>
  scope.value === "global" ? "all" : scope.value,
);
const { rows: localRows, history: localHistory } = useLeaderboard(
  () => props.gameId,
  () => localScope.value,
);

// Global board — fetched from the server (only when the tab is active + open).
const globalUnavailable = ref(false);
const { data: globalData } = await useAsyncData(
  () => `lb-${props.gameId}`,
  async () => {
    try {
      const res = await $fetch<{
        rows: Standing[];
        history?: HistoryEntry[];
        unavailable?: boolean;
      }>(`/api/leaderboard/${props.gameId}`);
      globalUnavailable.value = !!res.unavailable;
      return { rows: res.rows, history: res.history ?? [] };
    } catch {
      globalUnavailable.value = true;
      return { rows: [] as Standing[], history: [] as HistoryEntry[] };
    }
  },
  { watch: [() => props.gameId, open], server: false, immediate: false },
);

const rows = computed<Standing[]>(() =>
  scope.value === "global" ? (globalData.value?.rows ?? []) : localRows.value,
);
const history = computed<HistoryEntry[]>(() =>
  scope.value === "global" ? (globalData.value?.history ?? []) : localHistory.value,
);
const modalUi = useThemedModalUi();
const { $ts } = useI18n();
const t = (key: string, params?: Record<string, string | number>) => $ts(key, params);

// `labelKey` resolves via $ts in the template so scope labels follow the locale.
// The two local scopes are labelled "my games" / "my offline games" — calling
// the first one "All" read as "global + local", which it never was.
const scopes: { id: Scope; labelKey: string; icon: string }[] = [
  { id: "global", labelKey: "leaderboard.scopeGlobal", icon: "i-lucide-trophy" },
  { id: "all", labelKey: "leaderboard.scopeMine", icon: "i-lucide-user" },
  { id: "offline", labelKey: "leaderboard.scopeMineOffline", icon: "i-lucide-monitor" },
];
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="$ts('leaderboard.title')"
    side="right"
    :ui="modalUi"
  >
    <template #body>
      <div class="space-y-4">
        <UFieldGroup class="w-full flex-wrap">
          <UButton
            v-for="s in scopes"
            :key="s.id"
            size="xs"
            :icon="s.icon"
            :variant="scope === s.id ? 'solid' : 'outline'"
            :color="scope === s.id ? 'primary' : 'neutral'"
            class="flex-1 justify-center"
            @click="scope = s.id"
          >
            {{ $ts(s.labelKey) }}
          </UButton>
        </UFieldGroup>

        <p class="text-xs" :style="{ color: 'var(--games-text-muted)' }">
          {{
            scope === "global"
              ? $ts("leaderboard.globalCaption")
              : $ts("leaderboard.localCaption")
          }}
        </p>

        <p
          v-if="scope === 'global' && globalUnavailable"
          class="text-sm"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("leaderboard.globalUnavailable") }}
        </p>
        <p
          v-else-if="!rows.length"
          class="text-sm"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("leaderboard.empty") }}
        </p>
        <LeaderboardStandings v-else :game-id="gameId" :rows="rows" :t="t" />

        <LeaderboardHistory
          v-if="!(scope === 'global' && globalUnavailable)"
          :entries="history"
          :t="t"
        />
      </div>
    </template>
  </USlideover>
</template>
