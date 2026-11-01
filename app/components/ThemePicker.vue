<script setup lang="ts">
/**
 * Theme picker: choose built-in or uploaded card backs and table backgrounds,
 * and upload custom images (stored as Dexie blobs). Runtime switching is live.
 */
const { cardBackId, backgroundId, allBacks, backgrounds, uploads } = useCardTheme();
const toast = useToast();

async function onUpload(e: Event, kind: "card-back" | "background") {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !uploads) return;
  const res = await uploads.upload(file, kind);
  if (res.ok) {
    toast.add({ title: "Uploaded", color: "success", icon: "i-lucide-check" });
  } else {
    toast.add({ title: res.error, color: "error", icon: "i-lucide-x" });
  }
  input.value = "";
}
</script>

<template>
  <div class="space-y-6">
    <!-- Card backs -->
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm">Card back</h3>
        <label class="text-xs text-primary cursor-pointer hover:underline">
          Upload
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="(e) => onUpload(e, 'card-back')"
          />
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="b in allBacks"
          :key="b.id"
          type="button"
          class="rounded-[var(--radius-md)] overflow-hidden ring-2 transition w-14 h-20"
          :class="
            cardBackId === b.id ? 'ring-primary' : 'ring-transparent hover:ring-default'
          "
          :title="b.name"
          @click="cardBackId = b.id"
        >
          <img :src="b.src" :alt="b.name" class="w-full h-full object-cover" />
        </button>
      </div>
    </section>

    <!-- Backgrounds -->
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm">Table background</h3>
        <label class="text-xs text-primary cursor-pointer hover:underline">
          Upload
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="(e) => onUpload(e, 'background')"
          />
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="bg in backgrounds"
          :key="bg.id"
          type="button"
          class="rounded-[var(--radius-md)] ring-2 transition w-20 h-14"
          :class="
            backgroundId === bg.id
              ? 'ring-primary'
              : 'ring-transparent hover:ring-default'
          "
          :style="{ background: bg.css }"
          :title="bg.name"
          @click="backgroundId = bg.id"
        />
      </div>
    </section>
  </div>
</template>
