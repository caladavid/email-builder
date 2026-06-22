<template>
  <div
    v-if="inspectorDrawer.inspectorDrawerOpen"
    :style="{
      width: inspectorDrawer.INSPECTOR_DRAWER_WIDTH + 'px',
      position: 'fixed',
      top: 0,
      right: 0,
      height: '100%',
      background: 'var(--color-white)',
      borderLeft: '1px solid var(--ui-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }"
  >
    <!-- Pill switch tabs -->
    <div style="padding:12px 12px 0;flex-shrink:0;">
      <div style="display:flex;background:#e8edf3;border-radius:10px;padding:3px;gap:2px;">
        <button
          v-for="(tab, i) in tabs"
          :key="tab.slot"
          type="button"
          :style="{
            flex: 1,
            padding: '7px 0',
            borderRadius: '8px',
            border: activeTab === String(i) ? '1px solid #c5d3e8' : '1px solid transparent',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '0.01em',
            transition: 'all 0.15s',
            background: activeTab === String(i) ? 'white' : 'transparent',
            color: activeTab === String(i) ? '#0045B0' : 'var(--color-primary)',
            boxShadow: activeTab === String(i) ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }"
          @click="activeTab = String(i)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Panel content -->
    <div style="flex:1;overflow-y:auto;overflow-x:hidden;">
      <StylesPanel v-if="activeTab === '0'" />
      <ConfigurationPanel v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useInspectorDrawer } from '../../documents/editor/editor.store';
import StylesPanel from './StylesPanel.vue';
import ConfigurationPanel from './ConfigurationPanel/index.vue';

const inspectorDrawer = useInspectorDrawer();
const activeTab = ref<string>('0');

const tabs = [
  { label: 'Estilos',      slot: 'styles' as const },
  { label: 'Inspeccionar', slot: 'block-configuration' as const },
];

watch(() => inspectorDrawer.selectedSidebarTab, (value) => {
  activeTab.value = value === 'styles' ? '0' : '1';
});
</script>
