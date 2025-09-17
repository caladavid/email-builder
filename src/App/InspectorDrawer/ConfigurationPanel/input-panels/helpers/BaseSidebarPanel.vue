<template>
  <div class="p-2">
    <h1 class="text-xl mb-3 font-semibold">
      {{ title }}
    </h1>

    <div class="space-y-5">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>
