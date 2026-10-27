<script setup lang="ts">
/**
 * Your local profile: avatar + name, and lifetime stats derived from the
 * results table (games, win rate, streaks, per-game). Shown in settings. The
 * honest "your journey" view — all local, all yours.
 */
import { getGame } from "@games/engine-core";

const { $ts } = useI18n();
const { id, name, avatar, avatarOverride, avatarChoices } = usePlayerIdentity();
const { stats } = usePlayerStats(id);

const gameName = (gid: string) => getGame(gid)?.meta.name ?? gid;
const pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

<template>
  <div class="space-y-3">
    <!-- Identity: avatar + name -->
    <div class="flex items-center gap-3">
      <UPopover>
        <button
          type="button"
          class="text-3xl leading-none rounded-full size-12 grid place-items-center transition hover:scale-105"
          :style="{
            background: 'var(--games-surface)',
            border: '1px solid var(--games-border)',
          }"
          :aria-label="$ts('profile.changeAvatar')"
        >
          {{ avatar }}
        </button>
        <template #content>
          <div class="p-2 grid grid-cols-6 gap-1 max-w-56">
            <button
              v-for="a in avatarChoices"
              :key="a"
              type="button"
              class="text-2xl rounded-md p-1 transition hover:scale-110"
              :class="avatar === a ? 'ring-2 ring-[var(--games-accent)]' : ''"
              @click="avatarOverride = a"
            >
              {{ a }}
            </button>
          </div>
        </template>
      </UPopover>
      <UInput
        v-model="name"
        size="sm"
        class="flex-1"
        :placeholder="$ts('common.yourName')"
      />
    </div>

    <!-- Stats -->
    <div v-if="stats.played" class="grid grid-cols-4 gap-2 text-center">
      <div class="rounded-lg p-2" :style="{ background: 'var(--games-surface)' }">
        <p class="text-lg font-bold font-display tabular-nums">{{ stats.played }}</p>
        <p
          class="text-[10px] uppercase tracking-wide"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("profile.played") }}
        </p>
      </div>
      <div class="rounded-lg p-2" :style="{ background: 'var(--games-surface)' }">
        <p class="text-lg font-bold font-display tabular-nums">{{ stats.wins }}</p>
        <p
          class="text-[10px] uppercase tracking-wide"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("profile.wins") }}
        </p>
      </div>
      <div class="rounded-lg p-2" :style="{ background: 'var(--games-surface)' }">
        <p class="text-lg font-bold font-display tabular-nums">
          {{ pct(stats.winRate) }}
        </p>
        <p
          class="text-[10px] uppercase tracking-wide"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("profile.winRate") }}
        </p>
      </div>
      <div class="rounded-lg p-2" :style="{ background: 'var(--games-surface)' }">
        <p class="text-lg font-bold font-display tabular-nums">
          {{ stats.currentStreak
          }}<span v-if="stats.currentStreak" class="text-sm">🔥</span>
        </p>
        <p
          class="text-[10px] uppercase tracking-wide"
          :style="{ color: 'var(--games-text-muted)' }"
        >
          {{ $ts("profile.streak") }}
        </p>
      </div>
    </div>
    <p v-else class="text-sm text-center" :style="{ color: 'var(--games-text-muted)' }">
      {{ $ts("profile.noGames") }}
    </p>

    <!-- Per-game breakdown -->
    <div v-if="stats.byGame.length" class="space-y-1">
      <div
        v-for="g in stats.byGame"
        :key="g.gameId"
        class="flex items-center justify-between text-xs px-1"
      >
        <span class="font-medium">{{ gameName(g.gameId) }}</span>
        <span :style="{ color: 'var(--games-text-muted)' }">
          {{ $ts("profile.recordLine", { wins: g.wins, played: g.played }) }}
        </span>
      </div>
    </div>
  </div>
</template>
