/**
 * The active scene theme for a game, as CSS variables, plus the actions the
 * theme editor uses. Themes live in this browser only (localStorage) and are
 * never part of room state or transport messages, so every viewer — players
 * and spectators alike — sees their own choice.
 */
import { SCENE_STORAGE_KEYS } from "~/utils/sceneRoles";
import { MemoryStorage, SceneThemeStore } from "~/utils/sceneThemeStore";
import { resolveScene, sceneStyle, type BuiltinSceneId } from "~/utils/sceneThemes";
import type { SceneColors } from "~/utils/sceneRoles";

// Shared across every caller so an edit anywhere re-renders every scene.
const rev = ref(0);
let store: SceneThemeStore | null = null;

function getStore(): SceneThemeStore {
  if (!store) {
    store = new SceneThemeStore(
      import.meta.client ? window.localStorage : new MemoryStorage(),
    );
  }
  return store;
}

const KEYS = new Set<string>(Object.values(SCENE_STORAGE_KEYS));

export function useSceneTheme(gameId?: MaybeRefOrGetter<string | null | undefined>) {
  const colorMode = useColorMode();
  const { theme: appTheme } = useAppTheme();
  const { background } = useCardTheme();

  // Another tab changed a theme → refresh here too.
  if (import.meta.client) {
    useEventListener(window, "storage", (e: StorageEvent) => {
      if (e.key && KEYS.has(e.key)) rev.value++;
    });
  }

  const state = computed(() => {
    void rev.value;
    return getStore().load();
  });

  const resolved = computed(() =>
    resolveScene({
      gameId: toValue(gameId) ?? null,
      mode: colorMode.value === "dark" ? "dark" : "light",
      appTheme: appTheme.value as BuiltinSceneId,
      custom: state.value.custom,
      global: state.value.global,
      byGame: state.value.byGame,
      corrupt: state.value.corrupt,
    }),
  );

  /**
   * CSS variables for the scene. The table surface is a soft gradient of the
   * theme's surface colour; an uploaded table background replaces it.
   */
  const style = computed<Record<string, string>>(() => {
    const p = resolved.value.palette;
    const uploaded = background.value.id.startsWith("upload:");
    return {
      ...sceneStyle(p),
      "--games-scene-felt": uploaded
        ? background.value.css
        : `radial-gradient(ellipse 120% 100% at 50% -10%, color-mix(in oklch, ${p.surface} 78%, white), ${p.surface} 72%)`,
    };
  });

  const bump = () => rev.value++;
  return {
    state,
    resolved,
    style,
    save(draft: { name: string; colors: SceneColors }, editId?: string) {
      const r = getStore().save(draft, editId);
      if (r.ok) bump();
      return r;
    },
    remove(id: string) {
      getStore().remove(id);
      bump();
    },
    setGlobal(id: string | null) {
      getStore().setGlobal(id);
      bump();
    },
    assign(game: string, id: string | null) {
      getStore().assign(game, id);
      bump();
    },
  };
}
