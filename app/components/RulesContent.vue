<script setup lang="ts">
/** Renders rules sections, or a notice when the active locale has none. */
import type { RulesSection } from "~/utils/gameContent";

defineProps<{
  rules: RulesSection[];
  missing: boolean;
  /** Variant display name shown above the rules, when the game has variants. */
  variantName?: string | null;
  missingText: string;
  emptyText: string;
}>();
</script>

<template>
  <div class="space-y-5">
    <p v-if="variantName" class="text-sm font-semibold" data-testid="rules-variant">
      {{ variantName }}
    </p>
    <p
      v-if="missing"
      role="status"
      class="text-sm text-muted"
      data-testid="rules-missing"
    >
      {{ missingText }}
    </p>
    <template v-else>
      <section v-for="section in rules" :key="section.heading" class="space-y-1">
        <h3 class="font-semibold text-highlighted">{{ section.heading }}</h3>
        <ul class="list-disc ps-5 space-y-1 text-sm text-muted">
          <li v-for="(line, i) in section.body" :key="i">{{ line }}</li>
        </ul>
      </section>
      <p v-if="!rules.length" class="text-sm text-muted">{{ emptyText }}</p>
    </template>
  </div>
</template>
