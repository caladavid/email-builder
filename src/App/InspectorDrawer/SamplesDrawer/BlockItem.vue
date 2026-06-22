<template>
    <div
        draggable="true"
        @dragstart="handleDragStart"
        @click="handleClick"
        class="block-item cursor-grab bg-[var(--color-blue)] hover:bg-[var(--ui-bg-elevated)] rounded-lg p-3 border border-gray-200 transition-colors"
        :style="{
            borderColor: 'var(--ui-border)',
            color: 'var(--color-white)',
            position: 'relative',
        }"
    >
        <!-- "+" badge: top-right corner, shows on hover -->
        <div class="block-add-badge">+</div>

        <div class="block-preview mb-2 flex justify-center">
            <div class="text-2xl" :style="{ color: 'var(--color-white, #0079cc)' }">
                <UIcon v-if="isMaterialIcon" :name="props.icon" />
                <span v-else>{{ getIcon() }}</span>
            </div>
        </div>

        <span class="block-name text-xs text-center font-medium">
            {{ displayName }}
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useInspectorDrawer } from '../../../documents/editor/editor.store';
import { BUTTONS } from '../../../documents/blocks/helpers/buttons';
import { sendToCanvas } from '../../../composables/useCanvasBridge';

interface Props {
    type: string;
    displayName: string;
    icon?: string;
}

const props = defineProps<Props>();
const store = useInspectorDrawer();

const htmlTemplate = computed(() => {
  const btn = BUTTONS.find(b => b.label === props.type);
  return btn?.htmlTemplate ?? '';
});

const handleDragStart = (event: DragEvent) => {
  store.draggedHtml = htmlTemplate.value;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', `block-type:${props.type}`);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: props.type,
      displayName: props.displayName,
      htmlTemplate: htmlTemplate.value,
    }));
  }
};

function handleClick() {
  if (!store.rawHtml) return;
  if (!htmlTemplate.value) return;
  const selectedPath = store.selectedElementPath;
  if (selectedPath) {
    sendToCanvas({ type: 'replace-html', path: selectedPath, html: htmlTemplate.value });
  } else if (store.rawHtml.includes('data-block-type="placeholder"')) {
    // Auto-replace placeholder even if user never clicked it first
    sendToCanvas({ type: 'replace-html', path: '[data-block-type="placeholder"]', html: htmlTemplate.value });
  } else {
    sendToCanvas({ type: 'insert-html', path: null, position: 'after', html: htmlTemplate.value });
  }
}

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

.block-add-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.block-item:hover .block-add-badge {
  opacity: 1;
}
</style>