<template>
  <UDrawer
    :open="inspectorDrawer.inspectorDrawerOpen"
    direction="right"
    :overlay="false" 
    :handle="false"
    :dismissible="false"
    :modal="false"
    fixed
  >
    <template #body>
      <UTabs
        v-model="activeTab"
        :items="tabs"
        :style="{
          '--drawer-width': `${inspectorDrawer.INSPECTOR_DRAWER_WIDTH}px`,
        }"
        class="w-[var(--drawer-width)]">
        <template #styles>
          <StylesPanel />
        </template>
        <template #block-configuration>
          <ConfigurationPanel />
        </template>
      </UTabs>
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
import { useInspectorDrawer } from '../../documents/editor/editor.store';
import { ref, watch } from 'vue';
import StylesPanel from './StylesPanel.vue';
import ConfigurationPanel from './ConfigurationPanel/index.vue';

/* const INSPECTOR_DRAWER_WIDTH = 300 */

const tabs = [
  {
    label: 'Estilos',
    slot: 'styles' as const
  },
  {
    label: 'Inspeccionar',
    slot: 'block-configuration' as const
  }, 
]

/** Refs */

const inspectorDrawer = useInspectorDrawer()
const activeTab = ref<string>('0')

/** Watch */

watch(() => inspectorDrawer.selectedSidebarTab, (value) => {
  activeTab.value = value === 'styles' ? '0' : '1'
})
</script>
