<script setup lang="ts">
/**
 * Settings section for scene themes: the editor bound to this browser's theme
 * store. Opened from a game, it can also give that game its own theme.
 */
import { getGame } from "@card-games/engine-core";
import { BUILTIN_SCENE_THEMES } from "~/utils/sceneThemes";

const route = useRoute();
const { $ts } = useI18n();
const colorMode = useColorMode();

const gameId = computed(() => {
  const g = (route.params as { game?: unknown }).game;
  return typeof g === "string" && getGame(g) ? g : null;
});
const gameName = computed(() =>
  gameId.value ? (getGame(gameId.value)?.meta.name ?? null) : null,
);
const scene = useSceneTheme(gameId);
const themes = computed(() => {
  void scene.state.value;
  return [...Object.values(BUILTIN_SCENE_THEMES), ...scene.state.value.custom];
});
const t = (key: string, params?: Record<string, string | number>) => $ts(key, params);
</script>

<template>
  <SceneThemeEditor
    :themes="themes"
    :active-id="scene.resolved.value.id"
    :global-id="scene.state.value.global"
    :game-id="gameId"
    :game-name="gameName"
    :assigned-id="gameId ? (scene.state.value.byGame[gameId] ?? null) : null"
    :unavailable="scene.resolved.value.unavailable"
    :mode="colorMode.value === 'dark' ? 'dark' : 'light'"
    :t="t"
    :on-save="scene.save"
    :on-remove="scene.remove"
    :on-select-global="scene.setGlobal"
    :on-assign="scene.assign"
  />
</template>
