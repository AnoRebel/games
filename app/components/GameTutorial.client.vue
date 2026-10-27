<script setup lang="ts">
/**
 * Interactive in-game tutorial using v-tour-guide. Offers the tour to first-time
 * players (persisted per game), is launchable on demand, and is skippable.
 *
 * IMPORTANT: the tour is driven through the <TourGuideManager> component's
 * exposed ref methods (startTourGuide/skipTourGuide) — NOT the standalone
 * useTourGuide() composable, which is a separate instance and won't control
 * this manager's steps.
 */
import { TourGuideManager } from "v-tour-guide";
import "v-tour-guide/style.css";

const props = defineProps<{ gameId: string; variant?: string | null }>();

// Follows the current variant, so a variant switch restarts with its own steps.
const { tutorial } = useGameContent(
  () => props.gameId,
  () => props.variant,
);

// Only include steps whose target element is actually present, so v-tour-guide
// never stalls on a missing anchor. Recomputed when the tour is launched.
const presentTargets = ref<Set<string>>(new Set());
function refreshTargets() {
  if (!import.meta.client) return;
  const found = new Set<string>();
  for (const s of tutorial.value) {
    if (document.querySelector(s.target)) found.add(s.target);
  }
  presentTargets.value = found;
}

const steps = computed(() =>
  tutorial.value
    .filter((s) => presentTargets.value.has(s.target))
    .map((s, i) => ({
      id: `${props.gameId}-${props.variant ?? "default"}-${i}`,
      title: s.title,
      content: s.content,
      target: s.target,
    })),
);

const manager = ref<{
  startTourGuide: () => void;
  skipTourGuide: () => void;
} | null>(null);

const seen = useLocalStorage(`cg:tutorial-seen:${props.gameId}`, false);
const showOffer = ref(false);

onMounted(() => {
  if (!seen.value && steps.value.length) {
    // Slight delay so the target elements (hand/table) are mounted first.
    setTimeout(() => (showOffer.value = true), 600);
  }
});

function launch() {
  refreshTargets();
  nextTick(() => manager.value?.startTourGuide());
}
function start() {
  showOffer.value = false;
  seen.value = true;
  launch();
}
function dismiss() {
  showOffer.value = false;
  seen.value = true;
}

defineExpose({
  start: launch,
  stop: () => manager.value?.skipTourGuide(),
});
</script>

<template>
  <div>
    <TourGuideManager
      ref="manager"
      :steps="steps"
      :show-overlay="true"
      :allow-skip="true"
    />

    <UModal v-model:open="showOffer" :title="$ts('tutorial.offerTitle')">
      <template #body>
        <p class="text-sm text-muted">{{ $ts("tutorial.offerBody") }}</p>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="dismiss">
            {{ $ts("tutorial.noThanks") }}
          </UButton>
          <UButton color="primary" icon="i-lucide-graduation-cap" @click="start">
            {{ $ts("tutorial.startTour") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
