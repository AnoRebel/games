<script setup lang="ts">
/**
 * Customize: the Crystal Neuo material, layout (platform style and density),
 * colour mode and contrast, and glass settings. Every change applies at once
 * and is remembered in this browser.
 *
 * Each material swatch carries its own data-material, so it previews that
 * material's palette, corners, border, shadow and type in place.
 */
import {
  DENSITIES,
  MATERIALS,
  PLATFORMS,
  type Density,
  type Material,
  type Platform,
} from "~/composables/useAppearance";

const open = defineModel<boolean>("open", { default: false });

const { $ts } = useI18n();
const appearance = useAppearance();
const { state } = appearance;
const colorMode = useColorMode();
const matched = ref("");

const modes = ["light", "dark", "system"] as const;
type Mode = (typeof modes)[number];
const mode = computed<Mode>({
  get: () => (colorMode.preference as Mode) ?? "system",
  set: (m) => (colorMode.preference = m),
});

function matchDevice() {
  const p = appearance.matchDevice();
  matched.value = $ts("appearance.matched", {
    platform: $ts(`appearance.platforms.${p}`),
  });
}

function reset() {
  appearance.reset();
  matched.value = "";
}

const materialName = computed(() => $ts(`appearance.materials.${state.material}.name`));
</script>

<template>
  <UModal
    v-model:open="open"
    :title="$ts('appearance.customize')"
    :description="$ts('appearance.intro')"
    :ui="{
      content: 'games-overlay sm:max-w-xl',
      header: 'border-b border-[var(--border-subtle)] pe-14',
      footer: 'border-t border-[var(--border-subtle)] justify-between',
      title: 'font-display text-lg',
      description: 'text-[var(--content-secondary)]',
      overlay: 'games-scrim',
    }"
  >
    <template #body>
      <div class="space-y-6" data-testid="appearance-customizer">
        <!-- Material -->
        <fieldset class="space-y-2.5">
          <legend class="cn-label mb-2.5">{{ $ts("appearance.material") }}</legend>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <label
              v-for="m in MATERIALS"
              :key="m"
              class="games-swatch"
              :data-material="m"
              :data-selected="state.material === m ? '' : undefined"
            >
              <input
                type="radio"
                name="games-material"
                class="games-swatch__input"
                :value="m"
                :checked="state.material === m"
                :data-testid="`material-${m}`"
                @change="appearance.setMaterial(m as Material)"
              />
              <span class="games-swatch__dots" aria-hidden="true">
                <span style="background: var(--surface-app)" />
                <span style="background: var(--accent-primary-base)" />
                <span style="background: var(--surface-raised-3)" />
              </span>
              <span class="games-swatch__name">
                {{ $ts(`appearance.materials.${m}.name`) }}
              </span>
              <span class="games-swatch__hint">
                {{ $ts(`appearance.materials.${m}.hint`) }}
              </span>
            </label>
          </div>
        </fieldset>

        <!-- Layout: platform style and density -->
        <section class="space-y-3">
          <h3 class="cn-label">{{ $ts("appearance.layout") }}</h3>
          <fieldset
            class="cn-segmented cn-segmented--block games-segmented-wrap w-full"
            data-testid="platform-select"
          >
            <legend>{{ $ts("appearance.platform") }}</legend>
            <label v-for="p in PLATFORMS" :key="p" class="cn-segmented__item">
              <input
                class="cn-segmented__input"
                type="radio"
                name="games-platform"
                :value="p"
                :checked="state.platform === p"
                :data-testid="`platform-${p}`"
                @change="appearance.setPlatform(p as Platform)"
              />
              <span class="cn-segmented__label">{{
                $ts(`appearance.platforms.${p}`)
              }}</span>
            </label>
          </fieldset>
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm text-[var(--content-secondary)]" aria-live="polite">
              {{ matched || $ts("appearance.platformHint") }}
            </p>
            <UButton
              size="sm"
              variant="outline"
              color="neutral"
              icon="i-lucide-smartphone"
              class="shrink-0"
              @click="matchDevice"
            >
              {{ $ts("appearance.matchDevice") }}
            </UButton>
          </div>
          <fieldset
            class="cn-segmented cn-segmented--block w-full"
            data-testid="density-select"
          >
            <legend>{{ $ts("appearance.density") }}</legend>
            <label v-for="d in DENSITIES" :key="d" class="cn-segmented__item">
              <input
                class="cn-segmented__input"
                type="radio"
                name="games-density"
                :value="d"
                :checked="state.density === d"
                :data-testid="`density-${d}`"
                @change="appearance.setDensity(d as Density)"
              />
              <span class="cn-segmented__label">{{
                $ts(`appearance.densities.${d}`)
              }}</span>
            </label>
          </fieldset>
        </section>

        <!-- Colour: light / dark / system, and high contrast -->
        <section class="space-y-3">
          <h3 class="cn-label">{{ $ts("appearance.colour") }}</h3>
          <ClientOnly>
            <fieldset class="cn-segmented cn-segmented--block w-full">
              <legend>{{ $ts("appearance.mode") }}</legend>
              <label v-for="m in modes" :key="m" class="cn-segmented__item">
                <input
                  class="cn-segmented__input"
                  type="radio"
                  name="games-mode"
                  :value="m"
                  :checked="mode === m"
                  @change="mode = m"
                />
                <span class="cn-segmented__label">{{
                  $ts(`appearance.modes.${m}`)
                }}</span>
              </label>
            </fieldset>
          </ClientOnly>
          <div class="games-setting">
            <div>
              <div class="font-medium">{{ $ts("appearance.highContrast") }}</div>
              <div class="text-sm text-[var(--content-secondary)]">
                {{ $ts("appearance.highContrastHint") }}
              </div>
            </div>
            <USwitch
              :model-value="state.contrast === 'high'"
              :aria-label="$ts('appearance.highContrast')"
              data-testid="contrast-toggle"
              @update:model-value="
                (v: boolean) => appearance.setContrast(v ? 'high' : 'standard')
              "
            />
          </div>
        </section>

        <!-- Glass -->
        <section class="space-y-3">
          <h3 class="cn-label">{{ $ts("appearance.glass") }}</h3>
          <template v-if="appearance.hasGlass.value">
            <div class="games-setting">
              <div>
                <div class="font-medium">{{ $ts("appearance.frost") }}</div>
                <div class="text-sm text-[var(--content-secondary)]">
                  {{ $ts("appearance.frostHint") }}
                </div>
              </div>
              <USwitch
                :model-value="state.frost"
                :aria-label="$ts('appearance.frost')"
                @update:model-value="appearance.setFrost"
              />
            </div>
            <div class="games-setting">
              <div>
                <div class="font-medium">{{ $ts("appearance.rim") }}</div>
                <div class="text-sm text-[var(--content-secondary)]">
                  {{ $ts("appearance.rimHint") }}
                </div>
              </div>
              <USwitch
                :model-value="state.rim"
                :aria-label="$ts('appearance.rim')"
                @update:model-value="appearance.setRim"
              />
            </div>
            <div class="games-setting">
              <div>
                <div class="font-medium">{{ $ts("appearance.refraction") }}</div>
                <div class="text-sm text-[var(--content-secondary)]">
                  {{
                    appearance.refractionAvailable.value
                      ? $ts("appearance.refractionHint")
                      : $ts("appearance.refractionUnavailable")
                  }}
                </div>
              </div>
              <USwitch
                :model-value="state.refraction"
                :disabled="!appearance.refractionAvailable.value"
                :aria-label="$ts('appearance.refraction')"
                @update:model-value="appearance.setRefraction"
              />
            </div>
          </template>
          <p v-else class="text-sm text-[var(--content-secondary)]">
            {{ $ts("appearance.noGlass", { material: materialName }) }}
          </p>
          <div class="games-setting">
            <div>
              <div class="font-medium">{{ $ts("appearance.reduceTransparency") }}</div>
              <div class="text-sm text-[var(--content-secondary)]">
                {{ $ts("appearance.reduceTransparencyHint") }}
              </div>
            </div>
            <USwitch
              :model-value="state.reducedTransparency"
              :aria-label="$ts('appearance.reduceTransparency')"
              @update:model-value="appearance.setReducedTransparency"
            />
          </div>
        </section>
      </div>
    </template>

    <template #footer>
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-rotate-ccw"
        data-testid="appearance-reset"
        @click="reset"
      >
        {{ $ts("appearance.reset") }}
      </UButton>
      <UButton data-testid="appearance-done" @click="open = false">
        {{ $ts("appearance.done") }}
      </UButton>
    </template>
  </UModal>
</template>

<style scoped>
.games-swatch {
  position: relative;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--surface-raised-1);
  color: var(--content-primary);
  border: var(--border-width-default) solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-base) var(--motion-easing-standard),
    transform var(--motion-duration-base) var(--motion-easing-spring);
}
@media (hover: hover) {
  .games-swatch:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
}
.games-swatch[data-selected] {
  border-color: var(--accent-primary-base);
  box-shadow:
    0 0 0 1px var(--accent-primary-base),
    var(--shadow-md);
}
.games-swatch__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.games-swatch:has(.games-swatch__input:focus-visible) {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
.games-swatch__dots {
  display: flex;
  gap: 4px;
}
.games-swatch__dots > span {
  inline-size: 12px;
  block-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
}
.games-swatch__name {
  font-family: var(--font-family-display);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-tight);
}
.games-swatch__hint {
  font-size: var(--type-caption);
  color: var(--content-secondary);
  line-height: var(--leading-snug);
}
/* Five platform styles don't fit one row on a phone: wrap them. */
.games-segmented-wrap {
  grid-auto-flow: row;
  grid-template-columns: repeat(auto-fit, minmax(5.25rem, 1fr));
}
.games-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
</style>
