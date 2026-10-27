<script setup lang="ts">
/**
 * App footer — a centered, rounded "credit pill" with a shimmering name, a
 * pulsing heart, and gently floating suit pips. All motion is gated by the
 * user's reduced-motion preference (the suit float uses the GSAP helpers; the shimmer +
 * heart are pure CSS that respects `prefers-reduced-motion`).
 */
const year = new Date().getFullYear();
const suits = ["♠", "♥", "♦", "♣"];
const pipsRef = ref<HTMLElement | null>(null);
// Build-stamped app version, so a player can report exactly what they're running.
const version = useRuntimeConfig().public.appVersion as string;

onMounted(() => {
  if (!pipsRef.value) return;
  // Soft, continuous bob — each pip offset so they ripple rather than sync.
  // floatLoop() is reduced-motion aware (no-op when the user opts out).
  floatLoop(Array.from(pipsRef.value.querySelectorAll<HTMLElement>("[data-pip]")));
});
</script>

<template>
  <footer class="mt-6 mb-4 flex justify-center px-3">
    <div
      class="games-credit group relative inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm select-none"
      :style="{
        background: 'var(--games-surface)',
        border: '1px solid var(--games-border)',
        backdropFilter: 'blur(8px)',
      }"
    >
      <!-- floating suit pips -->
      <span ref="pipsRef" class="flex items-center gap-1 text-[13px]" aria-hidden="true">
        <span
          v-for="(s, i) in suits"
          :key="s"
          data-pip
          class="inline-block"
          :style="{ color: i % 2 ? 'oklch(0.7 0.2 25)' : 'var(--games-text-muted)' }"
          >{{ s }}</span
        >
      </span>

      <span :style="{ color: 'var(--games-text-muted)' }">Made with</span>
      <span class="games-heart text-base leading-none" aria-label="love">❤️</span>
      <span :style="{ color: 'var(--games-text-muted)' }">by</span>

      <!-- shimmering name → links to the source -->
      <a
        href="https://github.com/AnoRebel/card_games"
        target="_blank"
        rel="noopener noreferrer"
        class="games-name font-display font-bold tracking-tight transition-transform group-hover:scale-105"
      >
        Ano Rebel
      </a>

      <span
        class="hidden sm:inline text-xs"
        :style="{ color: 'var(--games-text-muted)' }"
      >
        · {{ year }}
      </span>
      <span
        v-if="version"
        class="text-[10px] font-mono tabular-nums opacity-60"
        :style="{ color: 'var(--games-text-muted)' }"
        :title="`Version ${version}`"
        >v{{ version }}</span
      >
    </div>
  </footer>
</template>

<style scoped>
.games-credit {
  transition:
    transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.25s;
}
.games-credit:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -8px color-mix(in oklch, var(--games-accent) 50%, transparent);
}

/* Animated accent-gradient shimmer on the name. */
.games-name {
  background-image: linear-gradient(
    100deg,
    var(--games-accent) 0%,
    color-mix(in oklch, var(--games-accent) 55%, white) 45%,
    var(--games-accent) 90%
  );
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: games-shimmer 3.2s linear infinite;
}

.games-heart {
  display: inline-block;
  animation: games-beat 1.4s ease-in-out infinite;
}

@keyframes games-shimmer {
  to {
    background-position: -220% 0;
  }
}
@keyframes games-beat {
  0%,
  100% {
    transform: scale(1);
  }
  15% {
    transform: scale(1.25);
  }
  30% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.18);
  }
}

@media (prefers-reduced-motion: reduce) {
  .games-name,
  .games-heart,
  .games-credit {
    animation: none;
    transition: none;
  }
  .games-name {
    background-position: 0 0;
  }
}
</style>
