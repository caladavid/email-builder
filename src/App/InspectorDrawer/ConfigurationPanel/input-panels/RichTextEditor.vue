<template>
  <div class="relative">
    <UFormField :label="label">
      <div class="relative">
        <UTextarea
          ref="textareaRef"
          :rows="rows"
          :model-value="modelValue"
          @update:model-value="handleTextChange"
          @keydown="handleKeydown"
          @click="updateCursorPosition"
          @mouseup="handleTextSelection"  
          @keyup="handleTextSelection" 
          class="w-full"
          :placeholder="placeholder"
        />

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
              class="absolute right-2 -top-6"
            />
          </UTooltip>
          
          
          <template #content>
            <div class="max-h-64 overflow-y-auto p-2">
              <div 
                v-for="(item, index) in variableItems" 
                :key="index" 
                @click="insertVariable(item.key)" 
                class="flex items-center gap-2 p-2 hover:bg-[var(--ui-primary)] hover:text-[var(--ui-text)] cursor-pointer rounded"
              >
                <span>{{ item.value }}</span>
              </div>
              <div v-if="Object.keys(variableItems).length === 0" class="px-3 py-2 text-gray-500">  
                No hay variables disponibles  
              </div>  
            </div>
          </template>
        </UPopover>
      </div>
    </UFormField>
  </div>
</template>
              <!-- <span class="font-mono text-sm" v-text="'{{' + item.key + '}}'"></span> -->

<script setup lang="ts">
import { computed, nextTick, ref, onMounted } from "vue";
import { useInspectorDrawer } from "../../../../documents/editor/editor.store";

// Define type for the UTextarea component instance
type Props = {
  label: string;
  modelValue: string;
  rows?: number;
  placeholder?: string;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:model-value", value: string): void;
  (e: "text-selected", selectedText: string): void;
}>();

const inspectorDrawer = useInspectorDrawer();
const textareaRef = ref<any>(null); // Use `any` type for custom component reference
const showVariablesDropdown = ref(false);
const cursorPosition = ref(0);
const dropdownPosition = ref({ top: "0px", left: "0px" });
const selectedText = ref('');  

let savedTextareaElement: HTMLTextAreaElement | null = null;

// Store the reference to the native textarea element on component mount
onMounted(() => {
  if (textareaRef.value) {
    savedTextareaElement = textareaRef.value?.$el.querySelector("textarea") || null;
    console.log("onMounted: Native textarea element saved.");
  }
});

const variableItems = computed(() => {
  return Object.entries(inspectorDrawer.globalVariables || {}).map(
    ([key, value]) => ({
      key,
      value,
      label: `${value}`,
    })
  );
});

function handleTextChange(value: string) {
  emit("update:model-value", value);
}

function handleKeydown(event: KeyboardEvent) {
  // Mostrar el dropdown de variables con Ctrl + Space o @
  if ((event.ctrlKey && event.code === "Space") || event.key === "@") {
    event.preventDefault();
    if (savedTextareaElement) {
      const textarea = savedTextareaElement;
      cursorPosition.value = textarea.selectionStart || 0; // Save the cursor position
      /* console.log("handleKeydown: Cursor position saved:", cursorPosition.value); */
    }
    showVariablesDropdown.value = true;
  }

  if (event.key === "Escape") {
    showVariablesDropdown.value = false;
  }
}

function updateCursorPosition() {
  if (savedTextareaElement) {
    cursorPosition.value = savedTextareaElement.selectionStart || 0;
    console.log("updateCursorPosition: Cursor position updated:", cursorPosition.value);
  }
}

function handleTextSelection() {  
  if (!savedTextareaElement) return;  
    
  const start = savedTextareaElement.selectionStart || 0;  
  const end = savedTextareaElement.selectionEnd || 0;  
    
  if (start !== end) {  
    const selection = props.modelValue.substring(start, end);  
    selectedText.value = selection;  
    emit('text-selected', selection);  
    console.log('Texto seleccionado:', selection);  
  }  
}  

function getCurrentSelection(): string {  
  if (!savedTextareaElement) return '';  
    
  const start = savedTextareaElement.selectionStart || 0;  
  const end = savedTextareaElement.selectionEnd || 0;  
    
  return start !== end ? props.modelValue.substring(start, end) : '';  
}

// Actualizamos la posición del dropdown
async function updateDropdownPosition() {
  await nextTick(); // Esperamos a que el DOM se actualice
  console.log("Actualizando posición del dropdown");

  if (!savedTextareaElement) return;

  const rect = savedTextareaElement.getBoundingClientRect();

  const lineHeight = 20;
  const textBeforeCursor = props.modelValue.substring(0, cursorPosition.value);
  const lines = textBeforeCursor.split("\n").length;

  dropdownPosition.value = {
    top: `${rect.top + lines * lineHeight + 30}px`,
    left: `${rect.left + 10}px`,
  };
  console.log("Posición del dropdown actualizada:", dropdownPosition.value);
}

function insertVariable(variableKey: string) {
  if (!savedTextareaElement) return;

  const start = savedTextareaElement.selectionStart || 0;
  const end = savedTextareaElement.selectionEnd || 0;
  const currentValue = props.modelValue;

  const newValue =
    currentValue.substring(0, start) +
    `[[[${variableKey}]]]` +
    currentValue.substring(end);

  emit("update:model-value", newValue);

  nextTick(() => {
    const newCursorPos = start + `[[[${variableKey}]]]`.length;
    if (savedTextareaElement) {
      savedTextareaElement.focus();
      savedTextareaElement.setSelectionRange(newCursorPos, newCursorPos);
    } else {
    console.error("savedTextareaElement is null");
  }
    console.log("insertVariable: Cursor posicionado correctamente.");
  });

  showVariablesDropdown.value = false;
}

function toggleVariablesDropdown() {
  showVariablesDropdown.value = !showVariablesDropdown.value;
  console.log("Estado del dropdown:", showVariablesDropdown.value ? "Abierto" : "Cerrado");

  if (showVariablesDropdown.value) {
    updateCursorPosition();
    updateDropdownPosition();
  }
}

defineExpose({  
  getCurrentSelection,  
  getSelectedText: () => selectedText.value  
});
</script>