<template>  
  <div  
    v-if="editorStore.samplesDrawerOpen"  
    class="fixed left-0 top-0 h-full border-r 0 z-10 overflow-y-auto"  
    :style="{ 
        width: `${SAMPLES_DRAWER_WIDTH}px`,
        backgroundColor: 'var(--ui-bg)',
        color: 'var(--ui-text)',
        borderColor: 'var(--ui-border)',
        }"  
  >  
    <div class="flex flex-col justify-between h-full py-4 px-3 space-y-4">  
      <!-- Header y plantillas -->  
      <div class="space-y-3">  
        <h1 class="text-lg font-semibold" :style="{color: 'var(--ui-text)'}">  
          EmailBuilder  
        </h1>  
  
        <div class="flex flex-col items-start space-y-1">  
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
import { computed } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import SidebarButton from './SidebarButton.vue';  
import { SAMPLES_DRAWER_WIDTH } from './constants';
  
const editorStore = useInspectorDrawer();  
SAMPLES_DRAWER_WIDTH

const isOpen = computed({
    get: () => editorStore.samplesDrawerOpen,
    set: (value: boolean) => {
        if (value !== editorStore.samplesDrawerOpen) {
            editorStore.toggleSamplesDrawerOpen();
        }
    }
})
</script>