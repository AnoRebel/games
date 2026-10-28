<script setup lang="ts">
/**
 * Dev-only sanity page: renders all 52 faces, the themed back, hand and pile
 * layouts. Used to verify the presentation layer (task 3.6).
 */
import { standardDeck, type Card } from "@games/engine-core";

const deck = standardDeck();
const sampleHand = deck.slice(0, 7);
const { backgrounds, backgroundId, allBacks, cardBackId, background } = useCardTheme();

useHead({ title: "Cards demo" });
</script>

<template>
  <div class="space-y-8">
    <CardSprite />

    <h1 class="font-display text-2xl font-bold">Card presentation demo</h1>

    <section class="space-y-2">
      <h2 class="font-semibold">Theme</h2>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="b in allBacks"
          :key="b.id"
          size="xs"
          :variant="cardBackId === b.id ? 'solid' : 'outline'"
          @click="cardBackId = b.id"
        >
          {{ b.name }}
        </UButton>
        <span class="mx-2 border-l" />
        <UButton
          v-for="bg in backgrounds"
          :key="bg.id"
          size="xs"
          color="neutral"
          :variant="backgroundId === bg.id ? 'solid' : 'outline'"
          @click="backgroundId = bg.id"
        >
          {{ bg.name }}
        </UButton>
      </div>
    </section>

    <section
      class="rounded-xl p-6 flex flex-col items-center gap-6"
      :style="{ background: background.css }"
    >
      <CardPile :face-down="true" :count="24" label="Draw" :width="84" />
      <CardHand :cards="sampleHand" :width="84" />
    </section>

    <section class="space-y-2">
      <h2 class="font-semibold">All 52 faces</h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
        <PlayingCard
          v-for="card in deck"
          :key="`${card.suit}${card.rank}`"
          :card="card as Card"
          :width="56"
        />
      </div>
    </section>
  </div>
</template>
