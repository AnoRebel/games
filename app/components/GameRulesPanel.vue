<script setup lang="ts">
/**
 * Always-accessible "Rules / How to Play" overlay. Renders per-game content in
 * a slideover so it opens mid-game without losing state (game-learnability).
 * Follows the current rule variant, so switching variant switches the rules.
 */
import { getGame, variantName } from "@games/engine-core";

const props = defineProps<{ gameId: string; variant?: string | null }>();
const open = defineModel<boolean>("open", { default: false });

const { rules, missing } = useGameContent(
  () => props.gameId,
  () => props.variant,
);
const variantLabel = computed(() => {
  const meta = getGame(props.gameId)?.meta;
  if (!meta?.variants?.length) return null;
  return variantName(meta, props.variant ?? meta.defaultVariant) ?? null;
});
</script>

<template>
  <USlideover v-model:open="open" :title="$ts('common.howToPlay')" side="right">
    <template #body>
      <RulesContent
        :rules="rules"
        :missing="missing"
        :variant-name="variantLabel"
        :missing-text="$ts('common.rulesMissing')"
        :empty-text="$ts('common.noRules')"
      />
    </template>
  </USlideover>
</template>
