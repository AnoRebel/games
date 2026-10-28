<script setup lang="ts">
/**
 * The player's hand with mobile gesture support: drag a card upward to play it
 * (with live drag feedback + a release threshold), or tap. Falls back to tap on
 * desktop. Built on @vueuse/gesture's useDrag.
 */
import { useDrag } from "@vueuse/gesture";
import type { Card } from "@games/engine-core";
import { cardId, cardName } from "@games/engine-core";

const props = withDefaults(
  defineProps<{
    cards: Card[];
    playableIds?: Set<string>;
    /**
     * Cards that legally match the table, independent of whose turn it is. Used
     * for the dim only; omit to fall back to `playableIds`.
     */
    matchingIds?: Set<string>;
    enabled?: boolean;
    width?: number;
  }>(),
  { playableIds: undefined, matchingIds: undefined, enabled: false, width: 84 },
);
const emit = defineEmits<{ play: [card: Card] }>();

const el = ref<HTMLElement | null>(null);
const { width: containerW } = useElementSize(el);

// Deal-in via the shared animation helpers: stagger every card on first render, and animate only
// the newly-arrived cards when the hand grows (a draw). cardId keys make this
// stable across reorders.
function dealCards(ids: string[]) {
  if (!el.value || !ids.length) return;
  const nodes = ids
    .map((id) => el.value!.querySelector<HTMLElement>(`[data-card-id="${id}"]`))
    .filter((n): n is HTMLElement => !!n);
  if (nodes.length) nextTick(() => dealIn(nodes));
}

onMounted(() => {
  if (props.cards.length) dealCards(props.cards.map((c) => cardId(c)));
});

watch(
  () => props.cards.map((c) => cardId(c)),
  (next, prev) => {
    const before = new Set(prev ?? []);
    const fresh = next.filter((id) => !before.has(id));
    // Only animate genuine additions (draws/deals), not plays or reorders.
    if (fresh.length && fresh.length < next.length) dealCards(fresh);
    else if (fresh.length === next.length) dealCards(fresh);
  },
);

const isPlayable = (c: Card) =>
  props.enabled && (props.playableIds === undefined || props.playableIds.has(cardId(c)));

/**
 * Is `c` a legal play IGNORING whose turn it is?
 *
 * Dimming used to be gated on `enabled`, so off-turn NOTHING was dimmed and the
 * hand changed appearance the instant your turn began. That made unplayable
 * cards look playable while you waited — most confusingly right after a Jack, an
 * 8 or a multi-card play, which are exactly the moments the suit demand shifts.
 * Keeping the dim stable across turns means the hand always reads honestly.
 *
 * When no `playableIds` set is supplied the caller isn't tracking legality, so
 * nothing is dimmed.
 */
const isLegal = (c: Card) => {
  // Only a caller that supplies `matchingIds` has turn-independent legality; for
  // everyone else fall back to the old behaviour (dim on your turn only), since
  // their `playableIds` is empty off-turn and would grey out the whole hand.
  if (props.matchingIds !== undefined) return props.matchingIds.has(cardId(c));
  return isPlayable(c) || !props.enabled;
};

// Overlap step so the hand always fits.
const step = computed(() => {
  const n = props.cards.length;
  if (n <= 1) return props.width;
  const avail = Math.max(containerW.value || props.width * n, props.width);
  const needed = (avail - props.width) / (n - 1);
  return Math.max(Math.min(props.width * 0.66, needed), 22);
});

// Per-card live drag offset for visual feedback. A card is "active" only while
// being dragged; on release we clear it back to undefined via a Map reset.
const drag = ref<Map<string, { x: number; y: number; lifting: boolean }>>(new Map());
const PLAY_THRESHOLD = -70; // px upward to trigger a play

function setDrag(id: string, v: { x: number; y: number; lifting: boolean } | null) {
  const next = new Map(drag.value);
  if (v) next.set(id, v);
  else next.delete(id);
  drag.value = next;
}
function getDrag(id: string) {
  return drag.value.get(id);
}

function bindCard(node: HTMLElement, card: Card) {
  useDrag(
    ({ movement: [mx, my], dragging, last }) => {
      const id = cardId(card);
      if (!isPlayable(card)) return;
      if (dragging) {
        setDrag(id, { x: mx, y: my, lifting: my < PLAY_THRESHOLD });
      }
      if (last) {
        const played = my < PLAY_THRESHOLD;
        setDrag(id, null);
        if (played) emit("play", card);
      }
    },
    { domTarget: node, eventOptions: { passive: false } },
  );
}

// Apply the directive-like binding via a template ref callback.
const cardRefs = new Map<string, HTMLElement>();
function setCardRef(node: Element | null, card: Card) {
  const id = cardId(card);
  if (node && !cardRefs.has(id)) {
    cardRefs.set(id, node as HTMLElement);
    bindCard(node as HTMLElement, card);
  } else if (!node) {
    cardRefs.delete(id);
  }
}

function onTap(card: Card) {
  if (isPlayable(card)) emit("play", card);
}

/** Expose a card's DOM node so the table can fly it to the discard on play. */
function cardEl(id: string): HTMLElement | null {
  return cardRefs.get(id) ?? null;
}
/** Expose the hand's root element so the table can fly drawn cards to it. */
function rootEl(): HTMLElement | null {
  return el.value;
}
defineExpose({ cardEl, rootEl });
</script>

<template>
  <div
    ref="el"
    class="relative flex items-end justify-center w-full select-none"
    :style="{ height: `${Math.round(width / 0.715) + 28}px` }"
    data-tour="hand"
  >
    <div class="relative" :style="{ width: `${width + step * (cards.length - 1)}px` }">
      <div
        v-for="(card, i) in cards"
        :key="cardId(card)"
        :ref="(n) => setCardRef(n as Element | null, card)"
        :data-card-id="cardId(card)"
        class="absolute bottom-0 touch-none transition-[filter,transform]"
        :class="enabled && isPlayable(card) ? 'games-playable' : ''"
        :style="{
          left: `${i * step}px`,
          zIndex: getDrag(cardId(card)) ? 100 : i,
          transform: getDrag(cardId(card))
            ? `translate(${getDrag(cardId(card))!.x}px, ${getDrag(cardId(card))!.y}px) rotate(${getDrag(cardId(card))!.x * 0.05}deg)`
            : undefined,
          transition: getDrag(cardId(card))
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
          filter: getDrag(cardId(card))?.lifting
            ? 'drop-shadow(0 0 0 2px var(--games-accent))'
            : undefined,
        }"
      >
        <PlayingCard
          :card="card"
          :width="width"
          :selectable="isPlayable(card)"
          :disabled="!isLegal(card)"
          :action-label="isPlayable(card) ? `Play ${cardName(card)}` : null"
          @select="onTap(card)"
        />
      </div>
    </div>

    <!-- hint -->
    <span
      v-if="enabled"
      class="absolute -bottom-1 text-[10px] uppercase tracking-wider sm:hidden"
      :style="{ color: 'var(--games-text-muted)' }"
    >
      {{ $ts("game.swipeHint") }}
    </span>
  </div>
</template>

<style scoped>
/* On your turn, playable cards lift slightly and gain an accent underglow so
   the eye goes straight to legal moves (unplayable cards are dimmed by
   PlayingCard). */
.games-playable {
  transform: translateY(-6px);
}
.games-playable :deep(.games-card) {
  box-shadow:
    0 0 0 2px color-mix(in oklch, var(--games-accent) 60%, transparent),
    0 6px 14px -4px color-mix(in oklch, var(--games-accent) 40%, transparent);
  border-radius: 7%;
}
@media (prefers-reduced-motion: reduce) {
  .games-playable {
    transform: none;
  }
}
</style>
