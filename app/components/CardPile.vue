<script setup lang="ts">
/**
 * A stacked pile — draw pile (face-down, shows count) or discard/trump (shows
 * the top card). Slight offsets give a tactile "stack" look without per-card DOM
 * for every card (we render at most a few backing layers).
 */
import type { Card } from "@games/engine-core";

const props = withDefaults(
  defineProps<{
    /** Top (visible) card; omit for a face-down draw pile. */
    top?: Card | null;
    faceDown?: boolean;
    count?: number;
    width?: number;
    label?: string;
    selectable?: boolean;
  }>(),
  {
    top: null,
    faceDown: false,
    count: 0,
    width: 92,
    label: "",
    selectable: false,
  },
);

const emit = defineEmits<{ activate: [] }>();

// Up to 3 backing layers for depth, regardless of true count.
const layers = computed(() => Math.min(Math.max(props.count - 1, 0), 3));
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div
      class="relative"
      :style="{
        width: `${width + layers * 2}px`,
        height: `${Math.round(width / 0.715) + layers * 2}px`,
      }"
    >
      <div
        v-for="l in layers"
        :key="`layer-${l}`"
        class="absolute rounded-[7%] bg-black/10 ring-1 ring-black/10"
        :style="{
          width: `${width}px`,
          height: `${Math.round(width / 0.715)}px`,
          left: `${l * 2}px`,
          top: `${l * 2}px`,
        }"
      />
      <div class="absolute" style="left: 0; top: 0">
        <PlayingCard
          :card="top"
          :face-down="faceDown || !top"
          :width="width"
          :selectable="selectable"
          @select="emit('activate')"
        />
      </div>
    </div>
    <span v-if="label || count" class="text-xs text-muted">
      {{ label }}<span v-if="count"> · {{ count }}</span>
    </span>
  </div>
</template>
