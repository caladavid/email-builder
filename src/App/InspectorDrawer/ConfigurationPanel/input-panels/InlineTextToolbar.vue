<template>
  <div class="relative">
    <UFormField :label="label">
      <div class="absolute right-0 -top-8 w-fit flex flex-row-reverse border-2 border-[var(--ui-bg)] bg-[var(--ui-bg)] rounded-tl-lg rounded-tr-lg z-10">

        <UPopover v-model:open="showVariablesDropdown">
          <UTooltip 
            text="Insertar variable" 
            arrow 
            :delay-duration="0" 
            :content="{ side: 'top', align: 'center' }"
          >
            <UButton
              icon="material-symbols:variable-insert"
              variant="ghost"
              size="sm"
              class="right-2 -top-6"
              @click="toggleVariablesDropdown"
            />
          </UTooltip>
          
          <template #content>
            <div class="max-h-64 overflow-y-auto p-2">
              <div 
                v-for="(item, index) in variables" 
                :key="index" 
                @click="insertVariable(item.key)" 
                class="flex items-center gap-2 p-2 hover:bg-[var(--ui-primary)] hover:text-[var(--ui-text)] cursor-pointer rounded"
              >
                <span>{{ item.value }}</span>
              </div>
              <div v-if="variables.length === 0" class="px-3 py-2 text-gray-500">  
                No hay variables disponibles  
              </div>  
            </div>
          </template>
        </UPopover>
        
        <UTooltip
          v-if="showFormatButtons !== false" 
          text="Colocar negritas" 
          arrow 
          :delay-duration="0" 
          :content="{ side: 'top', align: 'center' }"
        >
          <UButton
            icon="material-symbols:format-bold"
            variant="ghost"
            size="sm"
            class="right-10 -top-6"
            @click="emitAction('bold')"
          />
        </UTooltip>
        
        <UTooltip
          v-if="showFormatButtons !== false" 
          text="Colocar italic" 
          arrow 
          :delay-duration="0" 
          :content="{ side: 'top', align: 'center' }"
        >
          <UButton
            icon="material-symbols:format-italic"
            variant="ghost"
            size="sm"
            class="right-18 -top-6"
            @click="emitAction('italic')"
          />
        </UTooltip>

      </div>
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, nextTick } from "vue";
import { useInspectorDrawer } from "../../../../documents/editor/editor.store";

// Props simplificadas
const props = defineProps<{
  editableElement?: HTMLElement | null;
  variableItems?: Array<{key: string, value: string, label: string}>;
  showFormatButtons?: boolean;
}>();

// Emits simplificados
const emit = defineEmits<{
  (e: "toolbar-action", action: 'bold' | 'italic' | string): void;
}>();

// Estado mínimo
const showVariablesDropdown = ref(false);
const inspectorDrawer = useInspectorDrawer();

// Obtener funciones del editor padre
const editorFunctions = inject('editorFunctions') as {
  saveCursorPosition: () => void;
  insertVariable: (key: string) => void;
} | undefined;

// Variables computadas simplificadas
const variables = computed(() => {
  return props.variableItems || Object.entries(inspectorDrawer.globalVariables || {}).map(
    ([key, value]) => ({
      key,
      value: String(value),
      label: String(value),
    })
  );
});

// Funciones simplificadas
function toggleVariablesDropdown() {
  console.log('🎯 InlineTextToolbar - toggleVariablesDropdown');
  editorFunctions?.saveCursorPosition?.();
  
  // Forzar un cambio de estado para asegurar que el popover reaccione
  showVariablesDropdown.value = false;
  nextTick(() => {
    showVariablesDropdown.value = true;
  });
}

function insertVariable(variableKey: string) {  
   emit('toolbar-action', variableKey);
  showVariablesDropdown.value = false;
}

function emitAction(action: 'bold' | 'italic' | string) {
  emit('toolbar-action', action);
}

// Expose mínimo
defineExpose({   
  emitAction,
  openVariablesDropdown: () => {
    editorFunctions?.saveCursorPosition?.();
    showVariablesDropdown.value = true;
  }
});
</script>