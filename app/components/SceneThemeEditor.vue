<script setup lang="ts">
/**
 * Scene theme picker and editor. Lists the built-in and custom themes, sets
 * the global default or this game's own theme, and creates, edits or deletes
 * custom themes with a live light/dark preview on a card table and a board.
 * Saves are validated (valid colours, unique non-empty name, theme limit,
 * WCAG contrast); a rejected save changes nothing.
 */
import { computed, ref } from "vue";
import { SCENE_ROLES, type SceneColors, type SceneRole } from "~/utils/sceneRoles";
import {
  draftFrom,
  normalizeHex,
  sceneStyle,
  type SceneTheme,
  type SceneThemeError,
} from "~/utils/sceneThemes";
import type { SaveResult } from "~/utils/sceneThemeStore";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const props = defineProps<{
  themes: SceneTheme[];
  /** Theme id currently shown in this scene. */
  activeId: string;
  /** Global default id (null follows the app theme). */
  globalId: string | null;
  /** When editing from a game, its id/name and current assignment. */
  gameId?: string | null;
  gameName?: string | null;
  assignedId?: string | null;
  /** The chosen theme could not be read; a fallback is showing. */
  unavailable?: boolean;
  mode: "light" | "dark";
  t: Translate;
  onSave: (draft: { name: string; colors: SceneColors }, editId?: string) => SaveResult;
  onRemove: (id: string) => void;
  onSelectGlobal: (id: string | null) => void;
  onAssign: (gameId: string, id: string | null) => void;
}>();

const scope = ref<"global" | "game">(
  props.gameId && props.assignedId ? "game" : "global",
);
const editing = ref<{ id?: string; name: string; colors: SceneColors } | null>(null);
const previewMode = ref<"light" | "dark">(props.mode);
const errors = ref<SceneThemeError[]>([]);
const hexDrafts = ref<Partial<Record<SceneRole, string>>>({});

const isCustom = (t: SceneTheme) => t.id.startsWith("custom:");
const selectedId = computed(() =>
  scope.value === "game" && props.gameId ? (props.assignedId ?? null) : props.globalId,
);

function select(id: string) {
  errors.value = [];
  if (scope.value === "game" && props.gameId) props.onAssign(props.gameId, id);
  else props.onSelectGlobal(id);
}
function setScope(next: "global" | "game") {
  scope.value = next;
  // Leaving "this game only" clears the assignment so the game follows the default.
  if (next === "global" && props.gameId && props.assignedId)
    props.onAssign(props.gameId, null);
}

function startNew() {
  const base = props.themes.find((t) => t.id === props.activeId) ?? props.themes[0]!;
  editing.value = draftFrom(base, "");
  errors.value = [];
  hexDrafts.value = {};
}
function startEdit(theme: SceneTheme) {
  editing.value = { id: theme.id, ...draftFrom(theme, theme.name) };
  errors.value = [];
  hexDrafts.value = {};
}
function cancel() {
  editing.value = null;
  errors.value = [];
}

function setColor(role: SceneRole, value: string) {
  if (!editing.value) return;
  const hex = normalizeHex(value);
  hexDrafts.value = { ...hexDrafts.value, [role]: value };
  // An invalid value never replaces the role's previous colour.
  if (hex) editing.value.colors[previewMode.value][role] = hex;
  errors.value = errors.value.filter(
    (e) =>
      !(e.kind === "invalid-color" && e.role === role && e.mode === previewMode.value),
  );
  if (!hex)
    errors.value = [
      ...errors.value,
      { kind: "invalid-color", mode: previewMode.value, role },
    ];
}

function save() {
  if (!editing.value) return;
  if (errors.value.some((e) => e.kind === "invalid-color")) return;
  const result = props.onSave(
    { name: editing.value.name, colors: editing.value.colors },
    editing.value.id,
  );
  if (!result.ok) {
    errors.value = result.errors;
    return;
  }
  editing.value = null;
  errors.value = [];
}

function remove(theme: SceneTheme) {
  props.onRemove(theme.id);
  if (editing.value?.id === theme.id) editing.value = null;
}

const previewStyle = computed(() =>
  editing.value ? sceneStyle(editing.value.colors[previewMode.value]) : {},
);

function errorText(e: SceneThemeError): string {
  const t = props.t;
  const role = (r: SceneRole) => t(`theme.roles.${r}`);
  const mode = (m: "light" | "dark") =>
    t(m === "light" ? "theme.lightMode" : "theme.darkMode");
  switch (e.kind) {
    case "name-empty":
      return t("theme.errors.nameEmpty");
    case "name-taken":
      return t("theme.errors.nameTaken");
    case "limit":
      return t("theme.errors.limit");
    case "invalid-color":
      return t("theme.errors.invalidColor", { role: role(e.role), mode: mode(e.mode) });
    case "contrast":
      return t("theme.errors.contrast", {
        fg: role(e.fg),
        bg: role(e.bg),
        mode: mode(e.mode),
        ratio: e.ratio,
        min: e.min,
      });
  }
}
</script>

<template>
  <div class="space-y-3 text-sm" data-testid="scene-theme-editor">
    <p
      v-if="unavailable"
      role="status"
      class="games-board-banner"
      data-testid="theme-unavailable"
    >
      {{ t("theme.unavailable") }}
    </p>

    <div
      v-if="gameId"
      class="grid grid-cols-2 gap-2"
      role="radiogroup"
      :aria-label="t('theme.scope')"
    >
      <button
        type="button"
        role="radio"
        :aria-checked="scope === 'global'"
        class="scene-chip"
        data-testid="scope-global"
        @click="setScope('global')"
      >
        {{ t("theme.allGames") }}
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="scope === 'game'"
        class="scene-chip"
        data-testid="scope-game"
        @click="setScope('game')"
      >
        {{ t("theme.thisGame", { game: gameName ?? gameId }) }}
      </button>
    </div>

    <ul class="space-y-1.5" :aria-label="t('theme.sceneThemes')">
      <li v-for="theme in themes" :key="theme.id" class="flex items-center gap-2">
        <button
          type="button"
          class="scene-theme"
          :aria-pressed="
            selectedId === theme.id || (!selectedId && activeId === theme.id)
          "
          :data-testid="`theme-${theme.id}`"
          @click="select(theme.id)"
        >
          <span class="flex shrink-0 overflow-hidden rounded" aria-hidden="true">
            <span
              class="scene-swatch"
              :style="{ background: theme.colors[mode].surface }"
            />
            <span
              class="scene-swatch"
              :style="{ background: theme.colors[mode].boardDark }"
            />
            <span
              class="scene-swatch"
              :style="{ background: theme.colors[mode].accent }"
            />
          </span>
          <span class="truncate">{{ theme.name }}</span>
          <span v-if="activeId === theme.id" class="ms-auto text-xs opacity-70">{{
            t("theme.active")
          }}</span>
        </button>
        <template v-if="isCustom(theme)">
          <button
            type="button"
            class="scene-icon"
            :aria-label="t('theme.edit', { name: theme.name })"
            @click="startEdit(theme)"
          >
            ✎
          </button>
          <button
            type="button"
            class="scene-icon"
            :aria-label="t('theme.delete', { name: theme.name })"
            :data-testid="`delete-${theme.id}`"
            @click="remove(theme)"
          >
            🗑
          </button>
        </template>
      </li>
    </ul>

    <button
      v-if="!editing"
      type="button"
      class="scene-chip w-full"
      data-testid="new-theme"
      @click="startNew"
    >
      ＋ {{ t("theme.newTheme") }}
    </button>

    <form
      v-else
      class="space-y-3 rounded-lg p-3 scene-form"
      data-testid="theme-form"
      @submit.prevent="save"
    >
      <label class="block space-y-1">
        <span class="font-medium">{{ t("theme.name") }}</span>
        <input
          v-model="editing.name"
          class="scene-input w-full"
          data-testid="theme-name"
          maxlength="40"
        />
      </label>

      <div
        class="grid grid-cols-2 gap-2"
        role="radiogroup"
        :aria-label="t('theme.previewMode')"
      >
        <button
          v-for="m in ['light', 'dark'] as const"
          :key="m"
          type="button"
          role="radio"
          :aria-checked="previewMode === m"
          class="scene-chip"
          :data-testid="`mode-${m}`"
          @click="previewMode = m"
        >
          {{ t(m === "light" ? "theme.lightMode" : "theme.darkMode") }}
        </button>
      </div>

      <!-- Live preview: a card table and a board in the draft palette. -->
      <div
        class="scene-preview"
        :style="previewStyle"
        data-testid="theme-preview"
        aria-hidden="true"
      >
        <div class="preview-table">
          <span class="preview-card" />
          <span class="preview-card" />
          <span class="preview-text">{{ t("theme.previewTable") }}</span>
        </div>
        <div class="preview-board">
          <span
            v-for="i in 16"
            :key="i"
            class="preview-cell"
            :class="(Math.floor((i - 1) / 4) + i) % 2 ? 'dark' : 'light'"
          >
            <span v-if="i === 6" class="preview-piece own" />
            <span v-else-if="i === 11" class="preview-piece opp" />
            <span v-else-if="i === 8" class="preview-legal" />
            <span v-else-if="i === 13" class="preview-capture" />
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-1.5">
        <label v-for="role in SCENE_ROLES" :key="role" class="flex items-center gap-2">
          <input
            type="color"
            class="scene-color"
            :value="editing.colors[previewMode][role]"
            :aria-label="t(`theme.roles.${role}`)"
            :data-testid="`color-${role}`"
            @input="(e) => setColor(role, (e.target as HTMLInputElement).value)"
          />
          <span class="flex-1">{{ t(`theme.roles.${role}`) }}</span>
          <input
            class="scene-input w-24 font-mono text-xs"
            :value="hexDrafts[role] ?? editing.colors[previewMode][role]"
            :aria-label="`${t(`theme.roles.${role}`)} (hex)`"
            :data-testid="`hex-${role}`"
            @change="(e) => setColor(role, (e.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <ul
        v-if="errors.length"
        role="alert"
        class="space-y-1 text-xs scene-errors"
        data-testid="theme-errors"
      >
        <li v-for="(e, i) in errors" :key="i">{{ errorText(e) }}</li>
      </ul>

      <div class="flex justify-end gap-2">
        <button type="button" class="scene-chip" @click="cancel">
          {{ t("game.cancel") }}
        </button>
        <button type="submit" class="games-board-choice" data-testid="save-theme">
          {{ t("theme.save") }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.scene-chip,
.scene-theme,
.scene-icon {
  min-height: 44px;
  border-radius: 0.6rem;
  border: 1px solid var(--games-border);
  background: var(--games-surface);
  padding: 0 0.75rem;
}
.scene-icon {
  min-width: 44px;
  padding: 0;
}
.scene-theme {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  text-align: start;
}
.scene-chip[aria-checked="true"],
.scene-theme[aria-pressed="true"] {
  border-color: var(--games-accent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--games-accent) 45%, transparent);
  font-weight: 600;
}
.scene-swatch {
  width: 14px;
  height: 22px;
}
.scene-form {
  border: 1px solid var(--games-border);
}
.scene-input {
  min-height: 36px;
  border-radius: 0.4rem;
  border: 1px solid var(--games-border);
  background: transparent;
  padding: 0 0.5rem;
}
.scene-color {
  width: 44px;
  height: 36px;
  border-radius: 0.4rem;
  background: transparent;
}
.scene-errors {
  color: var(--ui-error, #b91c1c);
}
.scene-preview {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.6rem;
  background: var(--games-scene-surface);
  color: var(--games-scene-text);
}
.preview-table {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.preview-card {
  width: 22px;
  height: 31px;
  border-radius: 3px;
  background: var(--games-scene-accent);
}
.preview-text {
  font-size: 0.7rem;
  font-weight: 600;
}
.preview-board {
  display: grid;
  grid-template-columns: repeat(4, 18px);
  box-shadow: 0 0 0 2px var(--games-scene-cell-border);
}
.preview-cell {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
}
.preview-cell.dark {
  background: var(--games-scene-board-dark);
}
.preview-cell.light {
  background: var(--games-scene-board-light);
}
.preview-piece {
  width: 13px;
  height: 13px;
  border-radius: 9999px;
}
.preview-piece.own {
  background: var(--games-scene-own-piece);
}
.preview-piece.opp {
  background: var(--games-scene-opponent-piece);
}
.preview-legal {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--games-scene-legal);
}
.preview-capture {
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border: 2px solid var(--games-scene-capture);
}
</style>
