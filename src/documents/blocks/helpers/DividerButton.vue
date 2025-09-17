<template>
  <div
    :style="{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }">
    <UButton
      :style="{
        display: 'flex',
        alignContent: 'center',
        justifyContent: 'center',
        height: 48,
        width: '100%',
        padding: 0,
        backgroundColor: 'transparent',
        borderRadius: 0,
        cursor: 'pointer',
      }"
      @click="$emit('click', $event)"
    >
      <span style="background-color: #0079CC; width: 20px; height: 20px; display: inline-flex; border-radius: 50%; align-items: center; justify-content: center;">
        <UIcon name="material-symbols:add" style="font-size: 1.2rem; color: white;" />
      </span>
    </UButton>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'click', args: MouseEvent): void
}>()
</script>
