<template>
  <div :style="containerStyle" @click.stop>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <UButton
        class="tune-overlay-btn"
        icon="material-symbols:arrow-upward"
        size="xs"
        variant="ghost"
        color="neutral"
        title="Subir"
        @click="emit('action', 'up')"
      />
      <UButton
        class="tune-overlay-btn"
        icon="material-symbols:arrow-downward"
        size="xs"
        variant="ghost"
        color="neutral"
        title="Bajar"
        @click="emit('action', 'down')"
      />
      <UButton
        class="tune-overlay-btn"
        icon="material-symbols:content-copy"
        size="xs"
        variant="ghost"
        color="neutral"
        title="Duplicar"
        @click="emit('action', 'duplicate')"
      />
      <UButton
        class="tune-overlay-btn"
        icon="material-symbols:vertical-align-top"
        size="xs"
        variant="ghost"
        color="neutral"
        title="Seleccionar padre"
        @click="emit('action', 'parent')"
      />
      <UButton
        class="tune-overlay-btn"
        icon="material-symbols:delete-outline"
        size="xs"
        variant="ghost"
        color="error"
        title="Eliminar"
        @click="emit('action', 'delete')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  rect: { top: number; left: number; width: number; height: number };
}>();

const emit = defineEmits<{
  (e: 'action', action: string): void;
}>();

const containerStyle = computed(() => ({
  position: 'absolute' as const,
  top: props.rect.top + 'px',
  left: (props.rect.left - 44) + 'px',
  zIndex: 200,
  background: 'white',
  borderRadius: '8px',
  padding: '4px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '2px',
}));
</script>

<style scoped>
.tune-overlay-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
</style>
