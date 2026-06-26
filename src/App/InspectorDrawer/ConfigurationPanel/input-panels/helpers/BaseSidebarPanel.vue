<template>
  <div style="padding:14px 12px 24px;">
    <h2 style="font-size:20px;font-weight:700;color:var(--color-primary);margin:0 0 16px;">{{ title }}</h2>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>
