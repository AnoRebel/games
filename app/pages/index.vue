<script setup lang="ts">
import { standardDeck, getGame } from "@games/engine-core";

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
      <p class="cn-label games-eyebrow mb-3">
        {{ $ts("home.badge") }}
      </p>
      <h1 class="games-hero font-display">
        {{ $ts("app.tagline") }}
      </h1>
      <p class="mt-4 max-w-xl text-base sm:text-lg text-[var(--content-secondary)]">
        {{ $ts("app.subtitle") }}
      </p>
    </section>

    <!-- Daily challenge — same deal for everyone today, keeps a play streak -->
    <NuxtLink
      data-reveal
      :to="$localePath(`/play/${daily.gameId}?daily=1`)"
      class="games-panel games-panel--interactive no-underline p-4 flex items-center gap-4"
    >
      <span class="games-daily-icon" aria-hidden="true">📅</span>
      <div class="min-w-0 flex-1">
        <p class="font-display font-bold flex items-center gap-2">
          {{ $ts("daily.title") }}
          <UBadge v-if="daily.playedToday" color="success" variant="subtle" size="sm">{{
            $ts("daily.doneToday")
          }}</UBadge>
        </p>
        <p class="text-sm text-[var(--content-secondary)]">
          {{ $ts("daily.subtitle", { game: dailyGameName }) }}
        </p>
      </div>
      <div v-if="daily.streak > 0" class="text-right shrink-0">
        <p class="cn-num text-xl leading-none">{{ daily.streak }}🔥</p>
        <p class="cn-label mt-1">
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
        class="games-game-card games-panel games-panel--interactive group relative overflow-hidden no-underline p-5 flex flex-col"
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

        <div class="relative z-10 mt-auto pt-16 sm:pt-20">
          <div class="flex items-baseline gap-2">
            <h2 :class="['text-2xl font-bold', game.font]">{{ game.name }}</h2>
            <span class="games-chip cn-num" :title="$ts('common.players')">
              {{ game.players }}
            </span>
          </div>
          <p class="mt-1.5 text-sm min-h-10 text-[var(--content-secondary)]">
            {{ game.tagline }}
          </p>
          <div
            class="games-play mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
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
        variant="outline"
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
.games-eyebrow {
  color: var(--accent-primary-subtle);
}
.games-hero {
  font-size: clamp(2.25rem, 7vw, var(--type-display));
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}
.games-daily-icon {
  display: grid;
  place-items: center;
  inline-size: 3rem;
  block-size: 3rem;
  flex: none;
  font-size: 1.6rem;
  border-radius: var(--radius-md);
  background: var(--accent-primary-soft);
}
.games-game-card {
  min-height: 13rem;
  color: var(--content-primary);
}
.games-chip {
  font-size: var(--type-caption);
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-round);
  background: var(--accent-primary-soft);
  color: var(--content-primary);
}
.games-play {
  color: var(--accent-primary-subtle);
}
</style>
