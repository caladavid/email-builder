<template>
  <BaseColorInput :nullable="false" v-bind="$props" />
</template>

<script setup lang="ts">
import BaseColorInput from './BaseColorInput.vue';

defineProps<{
  label: string,
  defaultValue: string,
}>()
</script>
