<template>  
  <div  
    ref="drawerRef"
    v-if="editorStore.samplesDrawerOpen"  
    class="fixed left-0 top-0 h-full border-r 0 w-32 md:w-60 overflow-y-auto celcomflex:overflow-hidden"  
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

      <div>
        <h2 class="text-lg text-center font-semibold px-3" :style="{color: 'var(--color-blue)'}">
          Bloques
        </h2>
        <div class="grid celcomflex:grid-cols-2 gap-4 p-4">
          <BlockItem     
              v-for="button in BUTTONS"     
              :key="button.label"    
              :type="button.label"     
              :displayName="button.label"     
              :icon="button.icon"     
            /> 
        </div>
      </div>

      <div class="flex flex-col justify-between h-full py-4 px-3 space-y-4">  
        <!-- Header y plantillas -->  
        <div class="space-y-3">  
          <UButton   
            :icon="showTemplates ? 'material-symbols:arrow-drop-up' : 'material-symbols:arrow-drop-down'"  
            @click="showTemplates = !showTemplates" 
            class="w-full text-[var(--color-white)] bg-[var(--color-blue)] text-left flex flex-row-reverse items-center justify-between transition-all"  
          >
          <h2>Plantillas</h2>
        </UButton>
          <div v-if="showTemplates" class="flex flex-col items-start space-y-1">              
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
  </div>  
</template>    
  
<script setup lang="ts">  
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import SidebarButton from './SidebarButton.vue';  
import { SAMPLES_DRAWER_WIDTH } from './constants';
import BlockItem from './BlockItem.vue';
import { BUTTONS } from '../../../documents/blocks/helpers/buttons';
  
const editorStore = useInspectorDrawer();  
const showTemplates = ref(false);
const drawerRef = ref<HTMLElement | null>(null);
/* SAMPLES_DRAWER_WIDTH */

function handleResize(){
  if (window.innerHeight >= editorStore.SAMPLES_DRAWER_WIDTH){
    if(drawerRef.value){
      drawerRef.value.scrollTop = 0; 
    }
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