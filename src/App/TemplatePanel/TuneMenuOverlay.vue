<template>
  <div :style="containerStyle" @click.stop>
    <div style="display:flex;flex-direction:column;gap:2px;">
      
      <button class="tune-btn" title="Subir"           @click="emit('action', 'up')">
        <UIcon name="material-symbols:arrow-upward"   style="font-size:20px;" />
      </button>
      <button class="tune-btn" title="Bajar"           @click="emit('action', 'down')">
        <UIcon name="material-symbols:arrow-downward" style="font-size:20px;" />
      </button>
      <button class="tune-btn tune-btn--nav" title="Ir al padre" @click="emit('action', 'parent')">
        <UIcon name="material-symbols:subdirectory-arrow-left-rounded" style="font-size:20px;transform:rotate(90deg);" />
      </button>
      <button class="tune-btn tune-btn--nav" title="Entrar al hijo" @click="emit('action', 'child')">
        <UIcon name="material-symbols:subdirectory-arrow-right-rounded" style="font-size:20px;" />
      </button>
      <button class="tune-btn" title="Duplicar"        @click="emit('action', 'duplicate')">
        <UIcon name="material-symbols:content-copy"   style="font-size:20px;" />
      </button>
      <button class="tune-btn tune-btn--delete" title="Eliminar" @click="emit('action', 'delete')">
        <UIcon name="material-symbols:delete-outline" style="font-size:20px;" />
      </button>
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
  left: Math.max(4, props.rect.left - 52) + 'px',
  zIndex: 200,
  background: '#1e293b',
  borderRadius: '10px',
  padding: '4px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '2px',
}));
</script>

<style scoped>
.tune-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: white;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
}
.tune-btn:hover {
  background: rgba(255,255,255,0.12);
}
.tune-btn--nav {
  color: #93c5fd;
}
.tune-btn--nav:hover {
  background: rgba(147,197,253,0.15);
}
.tune-btn--delete {
  color: #f87171;
}
.tune-btn--delete:hover {
  background: rgba(248,113,113,0.15);
}
</style>
