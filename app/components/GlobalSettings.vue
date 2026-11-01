<script setup lang="ts">
/**
 * Global settings slideover — opened from anywhere via useSettingsPanel().
 * Replaces the standalone /settings page. Tighter, grouped, mobile-friendly.
 */
const { open } = useSettingsPanel();
const { $ts, $switchLocale, $getLocales, $getLocale } = useI18n();
const { isDark, toggle } = useThemeMode();
const { theme, motion, themes } = useAppTheme();
const { notifications, sound } = usePreferences();
const modalUi = useThemedModalUi();
const customize = useCustomizePanel();
const { state: look } = useAppearance();
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="$ts('common.settings')"
    side="right"
    :ui="modalUi"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Profile: avatar, name, and your local stats -->
        <section class="space-y-1.5">
          <span class="cn-label">{{ $ts("profile.title") }}</span>
          <ProfileCard />
        </section>

        <!-- Interface look: Customize (material, layout, contrast, glass) -->
        <section class="space-y-2">
          <span class="cn-label">{{ $ts("common.appearance") }}</span>
          <button
            type="button"
            class="games-panel games-panel--interactive w-full p-3 flex items-center gap-3 text-start"
            data-testid="settings-customize"
            @click="customize.show()"
          >
            <span
              class="games-look-mark"
              :data-material="look.material"
              aria-hidden="true"
            >
              <UIcon name="i-lucide-sliders-horizontal" class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{{ $ts("appearance.customize") }}</span>
              <span class="block text-sm text-[var(--content-secondary)] truncate">
                {{ $ts(`appearance.materials.${look.material}.name`) }} ·
                {{ $ts(`appearance.platforms.${look.platform}`) }} ·
                {{ $ts(`appearance.densities.${look.density}`) }}
              </span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0" />
          </button>
          <div class="flex items-center justify-between pt-1">
            <span class="text-sm">{{
              isDark ? $ts("theme.darkMode") : $ts("theme.lightMode")
            }}</span>
            <USwitch
              :model-value="isDark"
              :aria-label="$ts('theme.darkMode')"
              @update:model-value="() => toggle()"
            />
          </div>
        </section>

        <!-- Motion -->
        <section class="space-y-2">
          <span class="cn-label">{{ $ts("settings.motion") }}</span>
          <UFieldGroup class="w-full">
            <UButton
              :variant="motion === 'rich' ? 'solid' : 'outline'"
              color="primary"
              class="flex-1 justify-center"
              icon="i-lucide-sparkles"
              @click="motion = 'rich'"
            >
              {{ $ts("settings.rich") }}
            </UButton>
            <UButton
              :variant="motion === 'subtle' ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1 justify-center"
              icon="i-lucide-minus"
              @click="motion = 'subtle'"
            >
              {{ $ts("settings.subtle") }}
            </UButton>
          </UFieldGroup>
        </section>

        <!-- Game scenes: table style + per-game scene themes -->
        <section class="space-y-2">
          <span class="cn-label">{{ $ts("theme.sceneHeading") }}</span>
          <p class="text-sm text-[var(--content-secondary)]">
            {{ $ts("settings.tableStyleHint") }}
          </p>
          <div
            class="grid grid-cols-3 gap-2"
            role="radiogroup"
            :aria-label="$ts('settings.tableStyle')"
          >
            <button
              v-for="t in themes"
              :key="t.id"
              type="button"
              role="radio"
              :aria-checked="theme === t.id"
              class="games-table-swatch"
              :data-selected="theme === t.id ? '' : undefined"
              @click="theme = t.id"
            >
              <span class="block h-10" :style="{ background: t.swatch }" />
              <span class="block text-xs mt-1 font-medium">{{ t.name }}</span>
            </button>
          </div>
          <SceneThemePanel />
        </section>

        <!-- Card theme + uploads -->
        <section class="space-y-2">
          <span class="cn-label">{{ $ts("settings.cardsTable") }}</span>
          <ThemePicker />
        </section>

        <!-- Language -->
        <section class="space-y-2">
          <span class="cn-label">{{ $ts("common.language") }}</span>
          <UFieldGroup class="w-full">
            <UButton
              v-for="l in $getLocales()"
              :key="l.code"
              :variant="$getLocale() === l.code ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1 justify-center"
              @click="$switchLocale(l.code)"
            >
              {{ l.code.toUpperCase() }}
            </UButton>
          </UFieldGroup>
        </section>

        <!-- Toggles -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ $ts("settings.notifications") }}</span>
            <USwitch
              v-model="notifications"
              :aria-label="$ts('settings.notifications')"
            />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ $ts("settings.sound") }}</span>
            <USwitch v-model="sound" :aria-label="$ts('settings.sound')" />
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.games-look-mark {
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  flex: none;
  border-radius: var(--radius-md);
  background: var(--accent-primary-base);
  color: var(--content-on-accent);
}
.games-table-swatch {
  padding: 3px;
  border-radius: var(--radius-md);
  border: var(--border-width-default) solid var(--border-subtle);
  background: var(--surface-raised-1);
  overflow: hidden;
}
.games-table-swatch > span:first-child {
  border-radius: calc(var(--radius-md) - 3px);
}
.games-table-swatch[data-selected] {
  border-color: var(--accent-primary-base);
  box-shadow: 0 0 0 1px var(--accent-primary-base);
}
</style>
