<template>
  <div
    ref="drawerRef"
    v-if="editorStore.samplesDrawerOpen"
    class="fixed left-0 top-0 h-full border-r w-32 md:w-60 overflow-y-auto"
    :style="{
        width: `${editorStore.SAMPLES_DRAWER_WIDTH}px`,
        backgroundColor: 'var(--color-white)',
        color: 'var(--ui-text)',
        borderColor: 'var(--ui-border)',
        }"
  >
    <h1 class="text-lg font-semibold px-3 py-4 text-center" :style="{color: 'var(--color-blue)'}">
      EmailBuilder
    </h1>

    <!-- Bloques (always visible) -->
    <div>
      <h2 class="text-lg text-center font-semibold px-3" :style="{color: 'var(--color-blue)'}">
        Bloques
      </h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;padding:12px;">
        <BlockItem
          v-for="button in BUTTONS"
          :key="button.label"
          :type="button.label"
          :displayName="button.label"
          :icon="button.icon"
        />
      </div>
    </div>

    <!-- Capas (collapsible) -->
    <div class="flex flex-col py-2 px-3 space-y-2">
      <UButton
        :icon="showLayers ? 'material-symbols:arrow-drop-up' : 'material-symbols:arrow-drop-down'"
        @click="showLayers = !showLayers"
        class="w-full text-[var(--color-white)] bg-[var(--color-blue)] hover:bg-[var(--ui-bg-elevated)] text-left flex flex-row-reverse items-center justify-between transition-all"
      >
        <h2>Capas</h2>
      </UButton>
      <div v-if="showLayers" style="max-height:400px;overflow-y:auto;">
        <LayerManager />
      </div>
    </div>

    <!-- Plantillas (collapsible) -->
    <div class="flex flex-col justify-between h-full py-4 px-3 space-y-4">
      <div class="space-y-3">
        <UButton
          :icon="showTemplates ? 'material-symbols:arrow-drop-up' : 'material-symbols:arrow-drop-down'"
          @click="showTemplates = !showTemplates"
          class="w-full text-[var(--color-white)] bg-[var(--color-blue)] hover:bg-[var(--ui-bg-elevated)] text-left flex flex-row-reverse items-center justify-between transition-all"
        >
          <h2>Plantillas</h2>
        </UButton>
        <div v-if="showTemplates" class="flex flex-col items-start space-y-1">
          <SidebarButton href="#">Nueva plantilla</SidebarButton>
          <SidebarButton href="#sample/welcome">Email de bienvenida</SidebarButton>
          <SidebarButton href="#sample/one-time-password">Contraseña de un solo uso (OTP)</SidebarButton>
          <SidebarButton href="#sample/reset-password">Restablecer contraseña</SidebarButton>
          <SidebarButton href="#sample/order-ecomerce">Recibo de e-commerce</SidebarButton>
          <SidebarButton href="#sample/subscription-receipt">Recibo de suscripción</SidebarButton>
          <SidebarButton href="#sample/reservation-reminder">Recordatorio de reserva</SidebarButton>
          <SidebarButton href="#sample/post-metrics-report">Informe de métricas</SidebarButton>
          <SidebarButton href="#sample/respond-to-message">Responder a la consulta</SidebarButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import SidebarButton from './SidebarButton.vue';
import BlockItem from './BlockItem.vue';
import LayerManager from '../LayerManager/index.vue';
import { BUTTONS } from '../../../documents/blocks/helpers/buttons';

const editorStore = useInspectorDrawer();
const showTemplates = ref(false);
const showLayers = ref(false);
const drawerRef = ref<HTMLElement | null>(null);

function handleResize() {
  if (window.innerHeight >= editorStore.SAMPLES_DRAWER_WIDTH) {
    if (drawerRef.value) drawerRef.value.scrollTop = 0;
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
})

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});
</script>
