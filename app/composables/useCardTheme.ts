/**
 * Card + table theme store (minimal core; extended in Group 8 with uploads).
 *
 * Persists the selected card-back and table background via VueUse
 * useLocalStorage so choices survive reloads (theming-and-backgrounds spec).
 */

export interface CardBackTheme {
  id: string;
  name: string;
  /** Image URL (built-in served from /cards, or a user data URL). */
  src: string;
}

export interface TableBackground {
  id: string;
  name: string;
  /** CSS background value (gradient or url()). */
  css: string;
}

export const BUILTIN_CARD_BACKS: CardBackTheme[] = [
  { id: "classic", name: "Classic", src: "/cards/back-classic.svg" },
  { id: "redblue", name: "Red & Blue", src: "/cards/back-redblue.svg" },
  { id: "atlas", name: "Atlas", src: "/cards/back-atlas.svg" },
];

export const BUILTIN_BACKGROUNDS: TableBackground[] = [
  {
    id: "felt-green",
    name: "Green felt",
    css: "radial-gradient(circle at 50% 30%, #1f7a4d, #0c3b25)",
  },
  {
    id: "felt-blue",
    name: "Blue felt",
    css: "radial-gradient(circle at 50% 30%, #1e4f8a, #0b2545)",
  },
  {
    id: "midnight",
    name: "Midnight",
    css: "radial-gradient(circle at 50% 30%, #2a2a3a, #111119)",
  },
];

export function useCardTheme() {
  // Selected ids persist in localStorage (small scalar prefs, shared across tabs).
  const cardBackId = useLocalStorage("games:card-back", "classic");
  const backgroundId = useLocalStorage("games:background", "felt-green");

  // Uploaded assets live in Dexie (blobs); merged in client-side only.
  const uploads = import.meta.client ? useThemeUploads() : null;

  const uploadedBacks = computed<CardBackTheme[]>(
    () =>
      uploads?.cardBacks.value.map((a) => ({
        id: `upload:${a.id}`,
        name: a.name,
        src: a.url,
      })) ?? [],
  );
  const uploadedBackgrounds = computed<TableBackground[]>(
    () =>
      uploads?.backgrounds.value.map((a) => ({
        id: `upload:${a.id}`,
        name: a.name,
        css: `center / cover no-repeat url("${a.url}")`,
      })) ?? [],
  );

  const allBacks = computed(() => [...BUILTIN_CARD_BACKS, ...uploadedBacks.value]);
  const allBackgrounds = computed(() => [
    ...BUILTIN_BACKGROUNDS,
    ...uploadedBackgrounds.value,
  ]);

  const cardBack = computed(
    () => allBacks.value.find((b) => b.id === cardBackId.value) ?? BUILTIN_CARD_BACKS[0]!,
  );

  const background = computed(
    () =>
      allBackgrounds.value.find((b) => b.id === backgroundId.value) ??
      BUILTIN_BACKGROUNDS[0]!,
  );

  return {
    cardBackId,
    backgroundId,
    allBacks,
    cardBack,
    background,
    backgrounds: allBackgrounds,
    uploads,
  };
}
