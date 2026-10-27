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
          <label class="text-xs font-medium uppercase tracking-wide text-muted">
            {{ $ts("profile.title") }}
          </label>
          <ProfileCard />
        </section>

        <!-- Visual theme -->
        <section class="space-y-2">
          <span class="text-xs font-medium uppercase tracking-wide text-muted">
            {{ $ts("common.appearance") }}
          </span>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="t in themes"
              :key="t.id"
              type="button"
              class="group rounded-lg p-0.5 ring-2 transition"
              :class="
                theme === t.id ? 'ring-primary' : 'ring-transparent hover:ring-default'
              "
              @click="theme = t.id"
            >
              <span class="block h-10 rounded-md" :style="{ background: t.swatch }" />
              <span class="block text-[11px] mt-1 font-medium">{{ t.name }}</span>
            </button>
          </div>
          <div class="flex items-center justify-between pt-1">
            <span class="text-sm">{{
              isDark ? $ts("theme.darkMode") : $ts("theme.lightMode")
            }}</span>
            <USwitch :model-value="isDark" @update:model-value="() => toggle()" />
          </div>
        </section>

        <!-- Motion -->
        <section class="space-y-2">
          <span class="text-xs font-medium uppercase tracking-wide text-muted"
            >Motion</span
          >
          <UFieldGroup class="w-full">
            <UButton
              :variant="motion === 'rich' ? 'solid' : 'outline'"
              color="primary"
              class="flex-1 justify-center"
              icon="i-lucide-sparkles"
              @click="motion = 'rich'"
            >
              Rich
            </UButton>
            <UButton
              :variant="motion === 'subtle' ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1 justify-center"
              icon="i-lucide-minus"
              @click="motion = 'subtle'"
            >
              Subtle
            </UButton>
          </UFieldGroup>
        </section>

        <!-- Scene theme for card tables and boards -->
        <section class="space-y-2">
          <span class="text-xs font-medium uppercase tracking-wide text-muted">
            {{ $ts("theme.sceneHeading") }}
          </span>
          <SceneThemePanel />
        </section>

        <!-- Card theme + uploads -->
        <section class="space-y-2">
          <span class="text-xs font-medium uppercase tracking-wide text-muted"
            >Cards & table</span
          >
          <ThemePicker />
        </section>

        <!-- Language -->
        <section class="space-y-2">
          <span class="text-xs font-medium uppercase tracking-wide text-muted">
            {{ $ts("common.language") }}
          </span>
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
            <span class="text-sm">Notifications</span>
            <USwitch v-model="notifications" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">Sound</span>
            <USwitch v-model="sound" />
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
