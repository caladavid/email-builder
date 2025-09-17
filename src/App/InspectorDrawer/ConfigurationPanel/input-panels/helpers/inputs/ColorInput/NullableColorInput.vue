<template>
  <BaseColorInput nullable v-bind="$props" />
</template>

<script setup lang="ts">
import BaseColorInput from './BaseColorInput.vue';

defineProps<{
  label: string,
  defaultValue: string | null,
}>()
</script>
