<template>
    <div
        draggable="true"
        @dragstart="handleDragStart" 
        class="block-item cursor-grab bg-[var(--color-blue)] hover:bg-[var(--ui-bg-elevated)] rounded-lg p-3 border border-gray-200 transition-colors"  
        :style="{   
            borderColor: 'var(--ui-border) hover:bg-[var(--color-secondary)]',  
            color: 'var(--color-white)'  
        }" 
    >
        <div class="block-preview  mb-2 flex justify-center">    
            <div class="text-2xl" :style="{ color: 'var(--color-white, #0079cc)' }">    
                <UIcon v-if="isMaterialIcon" :name="props.icon" />  
                <span v-else>{{ getIcon() }}</span>  
            </div>    
        </div> 

        <span class="block-name text-xs text-center font-medium ">
            {{ displayName }}
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';


interface Props {
    type: string;
    displayName: string;
    icon?: string;
}

const props = defineProps<Props>();

const handleDragStart = (event: DragEvent) => {
    /* console.log('🚀 Iniciando drag desde BlockItem:', props.type);  */ 
  if (event.dataTransfer) {
    // Importante: usar "block-type:" como prefijo para identificar que es un nuevo bloque
    event.dataTransfer.setData('text/plain', `block-type:${props.type}`);
    
    event.dataTransfer.effectAllowed = 'copyMove';
    
    // Opcional: agregar datos adicionales
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: props.type,
      displayName: props.displayName
    }));
    
    /* console.log('🚀 Iniciando arrastre de nuevo bloque:', props.type); */
  }
};

/* const handleDragEnd = () => {
  console.log('🏁 Finalizando arrastre');
}; */

// Detectar si es un icono de Material Symbols  
const isMaterialIcon = computed(() => {  
  return props.icon && props.icon.startsWith('material-symbols:');  
}); 

function getIcon(): string {
    if (props.icon && !isMaterialIcon.value) return props.icon; 

    // Iconos por defecto según tipo  
  const icons: Record<string, string> = {  
    'Heading': 'H1',  
    'Text': 'T',  
    'Button': 'Btn',  
    'Image': '🖼️',  
    'Container': '☐',  
    'Avatar': '👤',  
    'Divider': '—',  
    'Spacer': '␣'  
  }; 

  return icons[props.type] || "?";
}
</script>

<style scoped>  
.block-item {  
  min-height: 80px;  
  display: flex;  
  flex-direction: column;  
  justify-content: center;  
  user-select: none;  
}  
  
.block-item:hover {  
  transform: translateY(-1px);  
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);  
}  
  
.block-item:active {  
  transform: translateY(0);  
}  
</style>