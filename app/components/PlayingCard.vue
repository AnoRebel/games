<script setup lang="ts">
/**
 * A single playing card. Faces come from the DeckCards.svg sprite (injected by
 * <CardSprite>) referenced by `#<suit><rank>` (e.g. King of clubs = `#c13`).
 * Backs render the active themed image. Compositor-friendly hover/selected
 * transforms only (transform/opacity), honouring reduced motion.
 */
import type { Card, Suit } from "@games/engine-core";
import { isJoker } from "@games/engine-core";

const props = withDefaults(
  defineProps<{
    card?: Card | null;
    faceDown?: boolean;
    /** Width in px; height derives from the 0.715 aspect. */
    width?: number;
    selectable?: boolean;
    selected?: boolean;
    disabled?: boolean;
    /**
     * Overrides the spoken accessible name (e.g. "Play Seven of hearts").
     * Falls back to the plain card name when omitted.
     */
    actionLabel?: string | null;
  }>(),
  {
    card: null,
    faceDown: false,
    width: 96,
    selectable: false,
    selected: false,
    disabled: false,
    actionLabel: null,
  },
);

const emit = defineEmits<{ select: [] }>();

const { cardBack } = useCardTheme();
const reduced = usePreferredReducedMotion();

const height = computed(() => Math.round(props.width / 0.715));

// SVG symbol id is `<suit><rank>`, e.g. `c13`.
const symbolId = computed(() =>
  props.card ? `#${props.card.suit as Suit}${props.card.rank}` : "",
);

// Jokers have no sprite face — render a dedicated star face instead.
const joker = computed(() => (props.card && isJoker(props.card) ? props.card : null));

const ariaLabel = computed(() => {
  if (props.faceDown || !props.card) return "Face-down card";
  if (props.actionLabel) return props.actionLabel;
  return cardLabel(props.card);
});

function cardLabel(c: Card): string {
  if (isJoker(c)) return c.jokerId === 1 ? "Black Joker" : "Red Joker";
  const ranks: Record<number, string> = {
    1: "Ace",
    11: "Jack",
    12: "Queen",
    13: "King",
  };
  const suits: Record<Suit, string> = {
    c: "clubs",
    s: "spades",
    h: "hearts",
    d: "diamonds",
  };
  return `${ranks[c.rank] ?? c.rank} of ${suits[c.suit]}`;
}

function onActivate() {
  if (props.selectable && !props.disabled) emit("select");
}
</script>

<template>
  <component
    :is="selectable ? 'button' : 'div'"
    class="games-card relative shrink-0 rounded-[7%] select-none"
    :class="[
      selectable && !disabled ? 'cursor-pointer' : '',
      selected ? 'games-card--selected' : '',
      disabled ? 'games-card--disabled' : '',
      reduced === 'reduce' ? 'games-card--no-motion' : '',
    ]"
    :style="{ width: `${width}px`, height: `${height}px` }"
    :type="selectable ? 'button' : undefined"
    :disabled="selectable && disabled ? true : undefined"
    :aria-label="ariaLabel"
    :aria-pressed="selectable ? selected : undefined"
    @click="onActivate"
  >
    <!-- Joker face (no sprite symbol exists) -->
    <svg
      v-if="!faceDown && joker"
      class="w-full h-full block rounded-[7%] bg-white shadow-sm ring-1 ring-black/10"
      viewBox="0 0 140 190"
      preserveAspectRatio="xMidYMid meet"
    >
      <text
        x="70"
        y="108"
        text-anchor="middle"
        font-size="72"
        :fill="joker.jokerId === 1 ? '#1a1a1a' : '#d21f3c'"
      >
        ★
      </text>
      <text
        x="70"
        y="150"
        text-anchor="middle"
        font-size="18"
        font-weight="700"
        letter-spacing="1"
        :fill="joker.jokerId === 1 ? '#1a1a1a' : '#d21f3c'"
      >
        JOKER
      </text>
    </svg>

    <!-- Face -->
    <svg
      v-else-if="!faceDown && card"
      class="w-full h-full block rounded-[7%] bg-white shadow-sm ring-1 ring-black/10"
      viewBox="0 0 140 190"
      preserveAspectRatio="xMidYMid meet"
    >
      <use :href="symbolId" />
    </svg>

    <!-- Back -->
    <img
      v-else
      :src="cardBack.src"
      :alt="''"
      aria-hidden="true"
      draggable="false"
      class="w-full h-full block rounded-[7%] object-cover shadow-sm ring-1 ring-black/15 bg-white"
    />
  </component>
</template>

<style scoped>
.games-card {
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
  will-change: transform;
}
.games-card:not(.games-card--no-motion):hover {
  transform: translateY(-8px);
}
.games-card--selected {
  transform: translateY(-14px);
  box-shadow: 0 0 0 3px var(--ui-primary, #3b82f6);
}
.games-card--no-motion {
  transition: none;
}

/* An unplayable card.
 *
 * This used to be `opacity-50 grayscale`, which reads clearly on a light page
 * but almost vanishes as a signal in dark mode: a white card at 50% opacity over
 * the dark felt is still a bright white card, and `grayscale` does nothing to a
 * face that is already black and white. Players reported cards "looking
 * playable" when they were not.
 *
 * Darken the card itself (brightness/contrast) rather than fading it toward the
 * background, so the cue survives on any backdrop, and desaturate the pips so a
 * red suit stops drawing the eye. Hover-lift is suppressed too — a card that
 * cannot be played should not feel interactive.
 */
.games-card--disabled {
  filter: grayscale(0.85) brightness(0.62) contrast(0.9);
  opacity: 0.85;
}
.games-card--disabled:hover {
  transform: none;
}
</style>
