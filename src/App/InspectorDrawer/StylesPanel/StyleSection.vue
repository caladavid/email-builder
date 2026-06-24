<template>
  <div style="border-radius:10px;overflow:hidden;margin-bottom:6px;border:1px solid #c7d8f5;">
    <!-- Accordion header -->
    <button
      type="button"
      :style="{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 12px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: '0.01em',
        background: open ? 'var(--color-primary)' : 'white',
        color: open ? 'white' : 'var(--color-primary)',
        borderRadius: open ? '9px 9px 0 0' : '9px',
        transition: 'background 0.15s, color 0.15s',
      }"
      @click="open = !open"
    >
      {{ title }}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
           :style="{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }">
        <polyline points="3,5 7,9 11,5" :stroke="open ? 'white' : 'var(--color-primary)'" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Content -->
    <div
      v-if="open"
      style="background:white;border-top:1px solid #c7d8f5;border-radius:0 0 9px 9px;padding:12px;display:flex;flex-direction:column;gap:12px;"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{ title: string; defaultOpen?: boolean }>();
const open = ref(props.defaultOpen !== false);
</script>
