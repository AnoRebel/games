<script setup lang="ts">
/**
 * A player's hand: a responsive fanned/overlapping row of cards. Overlap tightens
 * as the hand grows or the viewport shrinks so it never overflows horizontally.
 */
import type { Card } from "@games/engine-core";
import { cardId } from "@games/engine-core";

const props = withDefaults(
  defineProps<{
    cards: Card[];
    faceDown?: boolean;
    /** Card ids that are currently legal to play (others render disabled). */
    playableIds?: string[];
    selectable?: boolean;
    width?: number;
  }>(),
  {
    faceDown: false,
    playableIds: undefined,
    selectable: false,
    width: 92,
  },
);

const emit = defineEmits<{ play: [card: Card] }>();

const el = ref<HTMLElement | null>(null);
const { width: containerWidth } = useElementSize(el);
const reduced = usePreferredReducedMotion();

// Compute per-card horizontal step so the whole hand fits the container.
const step = computed(() => {
  const n = props.cards.length;
  if (n <= 1) return props.width;
  const avail = Math.max(containerWidth.value || props.width * n, props.width);
  const ideal = props.width * 0.62; // pleasant overlap when there's room
  const needed = (avail - props.width) / (n - 1);
  return Math.max(Math.min(ideal, needed), 18); // never collapse below 18px
});

const isPlayable = (c: Card) =>
  props.playableIds === undefined || props.playableIds.includes(cardId(c));
</script>

<template>
  <div
    ref="el"
    class="relative flex items-end justify-center w-full"
    :style="{ height: `${Math.round(width / 0.715) + 16}px` }"
    data-tour="hand"
  >
    <div class="relative" :style="{ width: `${width + step * (cards.length - 1)}px` }">
      <div
        v-for="(card, i) in cards"
        :key="faceDown ? `back-${i}` : cardId(card)"
        v-motion
        :initial="reduced === 'reduce' ? undefined : { opacity: 0, y: 24 }"
        :enter="
          reduced === 'reduce'
            ? undefined
            : { opacity: 1, y: 0, transition: { delay: i * 30 } }
        "
        class="absolute bottom-0"
        :style="{ left: `${i * step}px`, zIndex: i }"
      >
        <PlayingCard
          :card="card"
          :face-down="faceDown"
          :width="width"
          :selectable="selectable && isPlayable(card)"
          :disabled="selectable && !isPlayable(card)"
          @select="emit('play', card)"
        />
      </div>
    </div>
  </div>
</template>
