<template>
  <UButton style="display: flex; flex-direction: column; align-items: center;" class="bg-transparent cursor-pointer hover:bg-white/10 rounded-none py-3">
    <UButton color="neutral" @click.prevent="$emit('click')" class="cursor-pointer rounded-none">
      <!-- FIXME: style -->
      <UIcon :name="icon" style="font-size: 1.5rem" />
    </UButton>
    <span class="text-white">{{ label }}</span>
  </UButton>
</template>

<script setup lang="ts">
type BlockMenuButtonProps = {
  label: string;
  icon: string;
}

defineEmits<{
  (e: 'click'): void
}>()

defineProps<BlockMenuButtonProps>()
</script>
