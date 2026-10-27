<script setup lang="ts">
import { standardDeck, getGame } from "@card-games/engine-core";

const { $ts, $localePath } = useI18n();
useHead({ title: () => $ts("app.title") });

// Daily challenge — a fixed seed of the day + local streak.
const { today: daily } = useDailyChallenge();
const dailyGameName = computed(
  () => getGame(daily.value.gameId)?.meta.name ?? daily.value.gameId,
);

const games = computed(() => [
  {
    id: "last-card",
    name: "Last Card",
    tagline: $ts("home.taglineLastCard"),
    players: "2–6",
    to: "/play/last-card",
    font: "font-last-card",
    accent: "oklch(0.72 0.15 25)",
    sample: [
      { rank: 7 as const, suit: "h" as const },
      { rank: 11 as const, suit: "s" as const },
      { rank: 2 as const, suit: "d" as const },
    ],
  },
  {
    id: "albastini",
    name: "Albastini",
    tagline: $ts("home.taglineAlbastini"),
    players: "2·3·4·6",
    to: "/play/albastini",
    font: "font-albastini italic",
    accent: "oklch(0.7 0.14 150)",
    sample: [
      { rank: 1 as const, suit: "c" as const },
      { rank: 7 as const, suit: "h" as const },
      { rank: 13 as const, suit: "s" as const },
    ],
  },
  {
    id: "bao",
    name: "Bao",
    tagline: $ts("home.taglineBao"),
    players: "2",
    to: "/play/bao",
    font: "font-display",
    accent: "oklch(0.72 0.12 60)",
    board: "bao" as const,
  },
  {
    id: "checkers",
    name: "Checkers",
    tagline: $ts("home.taglineCheckers"),
    players: "2",
    to: "/play/checkers",
    font: "font-display",
    accent: "oklch(0.7 0.1 200)",
    board: "checkers" as const,
  },
]);

const root = ref<HTMLElement | null>(null);
onMounted(() => {
  if (root.value) dealIn([...root.value.querySelectorAll("[data-reveal]")]);
});

void standardDeck;
</script>

<template>
  <div ref="root" class="space-y-6">
    <CardSprite />

    <section data-reveal class="pt-6 pb-2 text-center sm:text-left">
      <p
        class="text-xs font-semibold uppercase tracking-[0.2em] mb-2"
        :style="{ color: 'var(--cg-accent)' }"
      >
        {{ $ts("home.badge") }}
      </p>
      <h1
        class="font-display text-4xl sm:text-6xl font-extrabold tracking-tight leading-[0.95]"
      >
        {{ $ts("app.tagline") }}
      </h1>
      <p
        class="mt-3 max-w-xl text-sm sm:text-base"
        :style="{ color: 'var(--cg-text-muted)' }"
      >
        {{ $ts("app.subtitle") }}
      </p>
    </section>

    <!-- Daily challenge — same deal for everyone today, keeps a play streak -->
    <NuxtLink
      data-reveal
      :to="$localePath(`/play/${daily.gameId}?daily=1`)"
      class="block rounded-2xl p-4 cg-surface transition hover:-translate-y-0.5 flex items-center gap-3"
    >
      <span class="text-3xl">📅</span>
      <div class="min-w-0 flex-1">
        <p class="font-display font-bold flex items-center gap-2">
          {{ $ts("daily.title") }}
          <UBadge v-if="daily.playedToday" color="success" variant="subtle" size="sm">{{
            $ts("daily.doneToday")
          }}</UBadge>
        </p>
        <p class="text-xs" :style="{ color: 'var(--cg-text-muted)' }">
          {{ $ts("daily.subtitle", { game: dailyGameName }) }}
        </p>
      </div>
      <div v-if="daily.streak > 0" class="text-right shrink-0">
        <p class="font-display font-bold text-lg leading-none">{{ daily.streak }}🔥</p>
        <p
          class="text-[10px] uppercase tracking-wide"
          :style="{ color: 'var(--cg-text-muted)' }"
        >
          {{ $ts("daily.streak") }}
        </p>
      </div>
    </NuxtLink>

    <section class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        v-for="game in games"
        :key="game.id"
        :to="$localePath(game.to)"
        data-reveal
        class="cg-game-card group relative overflow-hidden rounded-2xl p-5 cg-surface transition-transform"
      >
        <!-- board games: a small board preview -->
        <div
          v-if="'board' in game && game.board"
          class="absolute right-3 top-3 opacity-95 transition-transform duration-300 group-hover:-translate-y-1 group-hover:-rotate-2"
        >
          <BoardPreview :kind="game.board" />
        </div>
        <!-- card games: floating sample cards -->
        <div
          v-else
          class="absolute -right-4 -top-2 flex opacity-90 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3"
        >
          <PlayingCard
            v-for="(c, i) in game.sample"
            :key="i"
            :card="c"
            :width="58"
            class="-ml-7 first:ml-0 drop-shadow-xl"
            :style="{ transform: `rotate(${(i - 1) * 8}deg)`, zIndex: i }"
          />
        </div>

        <div class="relative z-10 mt-16 sm:mt-20">
          <div class="flex items-baseline gap-2">
            <h2 :class="['text-2xl font-bold', game.font]">{{ game.name }}</h2>
            <span
              class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
              :style="{
                background: 'color-mix(in oklch, var(--cg-accent) 18%, transparent)',
                color: 'var(--cg-accent)',
              }"
            >
              {{ game.players }}
            </span>
          </div>
          <p class="mt-1.5 text-sm min-h-10" :style="{ color: 'var(--cg-text-muted)' }">
            {{ game.tagline }}
          </p>
          <div
            class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold cg-accent-text"
          >
            {{ $ts("common.play") }}
            <UIcon
              name="i-lucide-arrow-right"
              class="transition-transform group-hover:translate-x-1"
            />
          </div>
        </div>
      </NuxtLink>
    </section>

    <section data-reveal class="flex justify-center pb-4">
      <UButton
        :to="$localePath('/rooms')"
        variant="soft"
        color="neutral"
        size="lg"
        icon="i-lucide-radio"
      >
        {{ $ts("lobby.browseRooms") }}
      </UButton>
    </section>
  </div>
</template>

<style scoped>
.cg-game-card:hover {
  transform: translateY(-3px);
}
.cg-game-card:active {
  transform: translateY(0) scale(0.99);
}
</style>
