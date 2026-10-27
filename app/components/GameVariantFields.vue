<script setup lang="ts">
/**
 * Rule variant and bot difficulty fields, built from the game's declared
 * metadata. Shared by offline and online setup so both offer the same choices
 * with the same defaults. Difficulty only appears when seats go to bots.
 */
import { computed } from "vue";
import { getGame, type Difficulty } from "@card-games/engine-core";
import { DIFFICULTY_KEYS, difficultyItems, variantItems } from "~/utils/setupOptions";

const props = defineProps<{
  gameId: string;
  /** Whether any seat is played by a bot. */
  withBots: boolean;
  /** Translate a locale key. */
  t: (key: string) => string;
}>();
const variant = defineModel<string | null>("variant", { default: null });
const difficulty = defineModel<Difficulty>("difficulty", { default: "normal" });

const meta = computed(() => getGame(props.gameId)?.meta ?? null);
const variants = computed(() => variantItems(meta.value));
const tiers = computed(() => difficultyItems(meta.value, props.t));
const tierHelp = computed(() => props.t(DIFFICULTY_KEYS[difficulty.value].help));
</script>

<template>
  <div class="grid gap-3" :class="variants.length && withBots ? 'grid-cols-2' : ''">
    <UFormField v-if="variants.length" :label="t('setup.variant')" size="sm">
      <USelect
        :model-value="variant ?? undefined"
        size="sm"
        class="w-full"
        :items="variants"
        data-testid="variant-select"
        @update:model-value="(v: string) => (variant = v)"
      />
    </UFormField>
    <UFormField v-if="withBots" :label="t('setup.difficulty')" :help="tierHelp" size="sm">
      <USelect
        v-model="difficulty"
        size="sm"
        class="w-full"
        :items="tiers"
        data-testid="difficulty-select"
      />
    </UFormField>
  </div>
</template>
