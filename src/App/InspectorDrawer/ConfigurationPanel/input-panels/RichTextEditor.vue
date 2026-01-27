<template>
  <div class="relative">
    <UFormField :label="label">
      <div class="relative">

        <div  
          ref="editableDiv"  
          contenteditable="true"  
          @input="handleContentChange"  
          @keydown="handleKeydown"  
          @focus="handleFocus"  
          @blur="handleBlur" 
          @mouseup="handleTextSelection"  
          @keyup="handleTextSelection"  
          :data-placeholder="placeholder"  
          class="rich-text-editable"  
          :style="{  
            minHeight: `${(rows || 3) * 24}px`,  
            maxHeight: `${(rows || 3) * 48}px`,  
            overflowY: 'auto'  
          }"  
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
              class="absolute right-2 -top-6 text-[var(--color-primary)]"
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
              <div v-if="Object.keys(variableItems).length === 0" class="px-3 py-2 text-white">  
                No hay variables disponibles  
              </div>  
            </div>
          </template>
        </UPopover>
        
          <UTooltip 
            text="Colocar negritas" 
            arrow 
            :delay-duration="0" 
            :content="{ side: 'top', align: 'center' }
            "
          >
            <UButton
              icon="material-symbols:format-bold"
              variant="ghost"
              size="sm"
              class="absolute right-10 -top-6 text-[var(--color-primary)] "
              @click="toggleBold"
            />
          </UTooltip>
        
          <UTooltip 
            text="Colocar italic" 
            arrow 
            :delay-duration="0" 
            :content="{ side: 'top', align: 'center' }"
          >
            <UButton
              icon="material-symbols:format-italic"
              variant="ghost"
              size="sm"
              class="absolute right-18 -top-6 text-[var(--color-primary)]"
              @click="toggleItalic"
            />
          </UTooltip>


      </div>
    </UFormField>
  </div>
</template>

<script setup lang="ts">  
import { computed, nextTick, ref, onMounted, watch, inject } from "vue";  
import { useInspectorDrawer } from "../../../../documents/editor/editor.store";  
  
// ============================================  
// TYPE DEFINITIONS  
// ============================================  
type Props = {  
  label: string;  
  modelValue: string;  
  rows?: number;  
  formats?: any[];
  placeholder?: string;  
};  

export interface TextBlockProps {
  text: string;
  formats?: TextFormat[];
  markdown?: boolean;
}

interface TextFormat {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
}

  
const props = defineProps<Props>();  
const emit = defineEmits<{  
  (e: "update:model-value", value: string): void;  
  (e: "update:formats", value: any[]): void;
  (e: "text-selected", selectedText: string): void;  
  (e: "update:content", value: { text: string; formats: any[] }): void;
}>();  
  
// ============================================  
// REFS & STATE  
// ============================================  
const inspectorDrawer = useInspectorDrawer();  
let animationFrameId: number | null = null;  
  
// Contenteditable refs (currently active)  
const editableDiv = ref<HTMLDivElement | null>(null);  
const isInternalUpdate = ref(false);  
const isActivelyEditing = ref(false);  
  
// Shared refs  
const showVariablesDropdown = ref(false);  
const lastCursorPosition = ref(0);  
const selectedText = ref('');  
  
// ============================================  
// COMPUTED PROPERTIES  
// ============================================  
const variableItems = computed(() => {  
  return Object.entries(inspectorDrawer.globalVariables || {}).map(  
    ([key, value]) => ({  
      key,  
      value,  
      label: `${value}`,  
    })  
  );  
});  

const blockProps = computed(() => {
  const blockId = inspectorDrawer.selectedBlockId;
  if (!blockId) return null;
  const block = inspectorDrawer.document[blockId];

  const blockData = block.data as { props?: TextBlockProps; style?: any };
  
  return {
    text: blockData.props?.text || '',
    formats: blockData.props?.formats || []
  };
}); 
  
// ============================================  
// LIFECYCLE HOOKS  
// ============================================  
  
  
// Contenteditable initialization (currently active)  
onMounted(() => {    
  if (!editableDiv.value) return;

  const blockId = inspectorDrawer.selectedBlockId;
  if (!blockId) return;
  
  const selectedBlock = inspectorDrawer.document[blockId];
  const blockData = selectedBlock.data as { props?: TextBlockProps; style?: any };

  const text = blockData.props?.text || '';
  const formats = blockData.props?.formats || [];

  const htmlContent = textWithFormatsToHtml(text, formats);
  editableDiv.value.innerHTML = htmlContent;
}); 
  
// ============================================  
// EVENT HANDLERS - SHARED  
// ============================================  
  
function handleKeydown(event: KeyboardEvent) {  
  // Show variables dropdown with Ctrl + Space or @  
  if ((event.ctrlKey && event.code === "Space") || event.key === "@") {  
    event.preventDefault();  
    saveCursorPosition();
      
      
    showVariablesDropdown.value = true;  
  }  
  
  if (event.key === "Escape") {  
    showVariablesDropdown.value = false;  
  }  
  
  // Bold shortcut (Ctrl+B)  
  if((event.ctrlKey && event.key === "b")){  
    event.preventDefault();   
    toggleBold();  
  }  
  
  // Italic shortcut (Ctrl+I)  
  if((event.ctrlKey && event.key === "i")){  
    event.preventDefault();   
    toggleItalic();  
  }  
}  
 
// ============================================  
// EVENT HANDLERS - CONTENTEDITABLE (Active)  
// ============================================  
  
function handleTextSelection() {  
  saveCursorPosition();
  
  const selection = window.getSelection(); 
  if (!selection || selection.rangeCount === 0) return;

  const selectedText = selection.toString().trim();

  if (selectedText.length > 0){
    emit('text-selected', selectedText)
  }
};
  
function getCurrentSelection(): string {  
  // Contenteditable version (currently active)  
  const selection = window.getSelection();  
  return selection ? selection.toString() : '';  
}  

function htmlToTextAndFormats(htmlContent: string): { text: string; formats: TextFormat[] } {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  let text = "";
  const formats: TextFormat[] = [];
  // Variable para rastrear la posición actual en el texto plano
  let post = 0; 

  function processNode(
    node: Node,
    currentFormats: { bold?: boolean; italic?: boolean } = {},
    depth: number = 0
  ) {
    // --- 1. PROCESAR TEXTO ---
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent || "";
      if (content) {
        const start = text.length;
        text += content;
        const end = text.length;
        post = end; // Actualizar cursor global

        // Solo guardar formato si hay alguno activo
        if (currentFormats.bold || currentFormats.italic) {
          formats.push({
            start,
            end,
            ...(currentFormats.bold && { bold: true }),
            ...(currentFormats.italic && { italic: true })
          });
        }
      }
      return;
    }

    // --- 2. PROCESAR ELEMENTOS ---
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Caso especial: Enlaces Markdown
      if (tag === "a") {
        const href = el.getAttribute("href") || "";
        const linkText = el.textContent?.trim() || "";
        if (href && linkText) {
          const markdownLink = `[${linkText}](${href})`;
          text += markdownLink;
          post += markdownLink.length;
          return; // No procesar hijos del link
        }
      }

      // --- DETECCIÓN DE FORMATOS (MEJORADA) ---
      const newFormats = { ...currentFormats };

      // A. Leer estilos en línea manualmente (porque computedStyle falla en elementos no adjuntos)
      const inlineStyle = el.getAttribute('style')?.toLowerCase() || '';
      const inlineWeight = el.style.fontWeight || '';
      const inlineStyleProp = el.style.fontStyle || '';

      // B. Detectar Negrita (Bold)
      const isBoldTag = tag === "b" || tag === "strong";
      // Detectar "font-weight: bold" o "700" en el atributo style
      const isBoldStyle = inlineStyle.includes('font-weight: bold') || 
                          inlineWeight === 'bold' || 
                          (!isNaN(parseInt(inlineWeight)) && parseInt(inlineWeight) >= 600);
      // Detectar clases comunes (Tailwind, Bootstrap, utilitarios)
      const hasBoldClass = el.classList.contains("bold") || 
                           el.classList.contains("font-bold") || 
                           el.classList.contains("fw-bold");

      if (isBoldTag || isBoldStyle || hasBoldClass) {
        newFormats.bold = true;
      }

      // C. Detectar Cursiva (Italic)
      const isItalicTag = tag === "i" || tag === "em";
      const isItalicStyle = inlineStyle.includes('font-style: italic') || 
                            inlineStyleProp === 'italic';
      const hasItalicClass = el.classList.contains("italic") || 
                             el.classList.contains("font-italic") || 
                             el.classList.contains("fst-italic");

      if (isItalicTag || isItalicStyle || hasItalicClass) {
        newFormats.italic = true;
      }

      // --- RECURSIVIDAD ---
      Array.from(el.childNodes).forEach(child => {
        processNode(child, newFormats, depth + 1);
      });
    }
  }

  // Iniciar proceso
  Array.from(tempDiv.childNodes).forEach(node => {
    processNode(node);
  });

  return { text, formats };
}


function toggleBold() {    
  if (!editableDiv.value) return;    
      
  isInternalUpdate.value = true;    
      
  document.execCommand('bold', false, undefined);    
      
  nextTick(() => {    
    const htmlContent = editableDiv.value!.innerHTML;    
    const { text, formats } = htmlToTextAndFormats(htmlContent);

    console.log('🔵 RichTextEditor - Bold aplicado, formatos:', formats);
    /* emit('update:model-value', htmlContent);  */   
    const blockId = inspectorDrawer.selectedBlockId;
    if (blockId) {
      const currentBlock = inspectorDrawer.document[blockId];
      if (currentBlock?.type === 'Text' || currentBlock?.type === 'Heading' || currentBlock?.type === 'Button') {
        inspectorDrawer.setDocument({
          [blockId]: {
            ...currentBlock,
            data: {
              ...currentBlock.data,
              props: {
                ...currentBlock.data.props,
                text: text,
                formats: formats
              } as any
            }
          }
        });
      }
    }
        
    setTimeout(() => {    
      isInternalUpdate.value = false;    
    }, 100);    
  });    
}    
  
function toggleItalic() {    
  if (!editableDiv.value) return;    
      
  isInternalUpdate.value = true;    
      
  document.execCommand('italic', false, undefined);    
      
  nextTick(() => {    
    const htmlContent = editableDiv.value!.innerHTML;   
    const { text, formats } = htmlToTextAndFormats(htmlContent); 

    console.log('🔵 RichTextEditor - Italic aplicado, formatos:', formats);
    
    const blockId = inspectorDrawer.selectedBlockId;
    if (blockId) {
      const currentBlock = inspectorDrawer.document[blockId];
      if (currentBlock?.type === 'Text' || currentBlock?.type === 'Heading' || currentBlock?.type === 'Button') {
        inspectorDrawer.setDocument({
          [blockId]: {
            ...currentBlock,
            data: {
              ...currentBlock.data,
              props: {
                ...currentBlock.data.props,
                text: text,
                formats: formats
              } as any
            }
          }
        });
      }
    }
        
    setTimeout(() => {    
      isInternalUpdate.value = false;    
    }, 100);    
  });    
}  
 
function handleContentChange() {  
  if (!editableDiv.value || isInternalUpdate.value) return;  
    
  isInternalUpdate.value = true;  
  saveCursorPosition();  
    
  const htmlContent = editableDiv.value.innerHTML;  
  const { text, formats } = htmlToTextAndFormats(htmlContent); 
  
  /* console.log('🔵 RichTextEditor - Formatos detectados:', formats); */
    
  // Actualizar store
  const blockId = inspectorDrawer.selectedBlockId;
  if (blockId) {
      const currentBlock = inspectorDrawer.document[blockId];
      if (currentBlock?.type === 'Text' || currentBlock?.type === 'Heading' || currentBlock?.type === 'Button') {
        // Verificar si realmente hay cambios para evitar loops
        const currentText = currentBlock.data?.props?.text || '';
        const currentFormats = currentBlock.data?.props?.formats || [];
        
        if (currentText !== text || JSON.stringify(currentFormats) !== JSON.stringify(formats)) {
          /* console.log('💾 RichTextEditor - Guardando cambios en store'); */
          inspectorDrawer.setDocument({
            [blockId]: {
              ...currentBlock,
              data: {
                ...currentBlock.data,
                props: {
                  ...currentBlock.data.props,
                  text: text,
                  formats: formats
                } as any
              }
            }
          });
        } else {
          console.log('⏭️ RichTextEditor - Sin cambios, omitiendo guardado');
        }
      }
    }
    
  nextTick(() => {  
    restoreCursorPosition();  
    isInternalUpdate.value = false;  
  });  
}

function saveCursorPosition() {
  if (!editableDiv.value) {
    console.log('❌ saveCursorPosition: editableDiv is null');
    return;
  }
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !editableDiv.value.contains(selection.anchorNode)) {
    console.log('❌ saveCursorPosition: no selection');
    return;
  }
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(editableDiv.value);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  lastCursorPosition.value = preCaretRange.toString().length;
  
  /* console.log('💾 saveCursorPosition: saved position', lastCursorPosition.value, {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset
  }); */
}

// Agregar handlers de focus/blur  
function handleFocus() {  
  isActivelyEditing.value = true; 
  /* console.log('🎯 RichTextEditor - Foco obtenido');  */
}  
  
function handleBlur() {  
  setTimeout(() => {  
    isActivelyEditing.value = false; 
    /* console.log('🎯 RichTextEditor - Foco perdido'); */ 
  }, 150);  
}  

// Y restoreCursorPosition con logs
function restoreCursorPosition() {
  if (!editableDiv.value) return;
  
  const selection = window.getSelection();
  if (!selection) return;
  
/*   console.log('🔄 restoreCursorPosition: restoring to position', lastCursorPosition.value); */
  
  // Caso especial: si la posición es 0, ir al inicio
  if (lastCursorPosition.value === 0) {
    const range = document.createRange();
    range.setStart(editableDiv.value, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    /* console.log('📍 Moved to start (position 0)'); */
    return;
  }
  
  let charIndex = 0;
  const nodeStack = [editableDiv.value];
  let node: Node | null = null;
  let found = false;
  
  while (!found && (node = nodeStack.pop()!)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      const nextCharIndex = charIndex + textLength;
      
      /* console.log('🔍 Checking text node:', {
        charIndex,
        nextCharIndex,
        target: lastCursorPosition.value,
        textLength,
        textContent: node.textContent?.substring(0, 50) + '...'
      }); */
      
      if (lastCursorPosition.value <= nextCharIndex) {
        const offset = lastCursorPosition.value - charIndex;
        const range = document.createRange();
        range.setStart(node, Math.min(offset, textLength));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        found = true;
        /* console.log('✅ Position restored to text node with offset', offset); */
      }
      charIndex = nextCharIndex;
    } else {
      // Para elementos no-texto, procesar hijos
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        nodeStack.push(children[i]);
      }
    }
  }
  
  if (!found) {
    console.log('⚠️ Position not found, moving to end');
    // Mover al final
    const range = document.createRange();
    range.selectNodeContents(editableDiv.value);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
  
function insertVariable(variableKey: string) {
  /* console.log('🔧 InlineTextEditor - insertVariable called with:', variableKey); */
  
  if (!editableDiv.value) return;

  // 1. ENFOCAR primero - esto es crítico
  editableDiv.value.focus();
  
  // 2. RESTAURAR posición ANTES de cualquier otra operación
  /* console.log('🔄 Restoring cursor position before insertion...'); */
  restoreCursorPosition();
  
  // 3. Obtener la selección DESPUÉS de restaurar
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    /* console.error('❌ No selection after restore, using fallback'); */
    
    // Fallback robusto: insertar en la posición guardada
    const currentContent = editableDiv.value.innerHTML;
    const variableText = `{${variableKey}}`;
    
    if (lastCursorPosition.value >= 0 && lastCursorPosition.value <= currentContent.length) {
      // Insertar en la posición específica
      const textContent = editableDiv.value.textContent || '';
      const before = textContent.substring(0, lastCursorPosition.value);
      const after = textContent.substring(lastCursorPosition.value);
      editableDiv.value.textContent = before + variableText + after;
    } else {
      // Insertar al final
      editableDiv.value.innerHTML += variableText;
    }
    
    /* handleInput(); */
    return;
  }

  const range = selection.getRangeAt(0);
  /* console.log('🎯 Current range for insertion:', {
    collapsed: range.collapsed,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    startContainer: range.startContainer.nodeName,
    commonAncestor: range.commonAncestorContainer.nodeName
  }); */

  // 4. VERIFICAR que la selección esté dentro del editor
  if (!editableDiv.value.contains(range.commonAncestorContainer)) {
    console.log('⚠️ Selection outside editor, moving to end');
    range.selectNodeContents(editableDiv.value);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // 5. INTENTAR execCommand PRIMERO (más confiable para contenteditable)
  const variableText = `{${variableKey}}`;
  let success = false;
  
  try {
    /* console.log('🔄 Attempting execCommand insert...'); */
    success = document.execCommand('insertText', false, variableText);
    console.log('✅ execCommand result:', success);
  } catch (error) {
    console.error('❌ execCommand failed:', error);
    success = false;
  }

  if (success) {
    // execCommand tuvo éxito, el input event se disparará automáticamente
    console.log('🎉 Variable inserted successfully with execCommand');
    return;
  }

  // 6. FALLBACK: Inserción manual
  /* console.log('🔄 Falling back to manual insertion...'); */
  try {
    // Para contenteditable, necesitamos manejar la inserción cuidadosamente
    if (range.collapsed) {
      // Insertar en posición de cursor
      const textNode = document.createTextNode(variableText);
      range.insertNode(textNode);
      
      // Mover cursor después del texto insertado
      range.setStartAfter(textNode);
      range.collapse(true);
    } else {
      // Reemplazar selección
      const textNode = document.createTextNode(variableText);
      range.deleteContents();
      range.insertNode(textNode);
      range.selectNodeContents(textNode);
      range.collapse(false);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
    
    console.log('✅ Manual insertion completed');
    
    // Disparar input event manualmente
    const inputEvent = new Event('input', { bubbles: true });
    editableDiv.value.dispatchEvent(inputEvent);
    
  } catch (error) {
    console.error('❌ Manual insertion failed:', error);
    
    // ÚLTIMO RECURSO: innerHTML
    console.log('🔄 Last resort: innerHTML append');
    const currentHTML = editableDiv.value.innerHTML;
    editableDiv.value.innerHTML = currentHTML + variableText;
    /* handleInput(); */
  }
  
  console.log('🎉 insertVariable completed');
}

function textWithFormatsToHtml(text: string, formats: TextFormat[]): string {  
  if (!formats || formats.length === 0) return text;  
  
  const events: Array<{ position: number; type: 'start' | 'end'; format: Partial<TextFormat> }> = [];
  formats.forEach(format => {
    if (format.bold) {
      events.push({ position: format.start, type: 'start', format: { bold: true } });
      events.push({ position: format.end, type: 'end', format: { bold: true } });
    }
    if (format.italic) {
      events.push({ position: format.start, type: 'start', format: { italic: true } });
      events.push({ position: format.end, type: 'end', format: { italic: true } });
    }
  });
  
  events.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.type === 'end' ? -1 : 1; 
  });
  
  let result = '';
  let currentPosition = 0;
  let boldCount = 0;
  let italicCount = 0;
  
  events.forEach(event => {
    if (event.position > currentPosition) {
      result += text.substring(currentPosition, event.position);
    }
    currentPosition = event.position;
    
    if (event.type === 'start') {
      if (event.format.bold) {
        if (boldCount === 0) result += '<b>'; 
        boldCount++;
      }
      if (event.format.italic) {
        if (italicCount === 0) result += '<i>'; 
        italicCount++;
      }
    } else { // event.type === 'end'
      if (event.format.italic) {
        italicCount--;
        if (italicCount === 0) result += '</i>'; 
      }
      if (event.format.bold) {
        boldCount--;
        if (boldCount === 0) result += '</b>'; 
      }
    }
  });
  
  if (currentPosition < text.length) {
    result += text.substring(currentPosition);
  }
  
  return result;
}
  
// ============================================  
// WATCHERS  
// ============================================  

// POR ESTE:  
watch([() => props.modelValue, () => props.formats], ([newText, newFormats]) => {    
  if (isActivelyEditing.value || !editableDiv.value) return;    
      
  const htmlContent = textWithFormatsToHtml(newText, newFormats || []);    
      
  if (editableDiv.value.innerHTML !== htmlContent) {    
    const wasFocused = document.activeElement === editableDiv.value;  
      
    if (wasFocused) saveCursorPosition();  
    editableDiv.value.innerHTML = htmlContent;    
      
    if (wasFocused) {  
      nextTick(() => restoreCursorPosition());  
    }  
  }    
}, { deep: true, immediate: true });

watch(blockProps, (newProps) => {
  if (!editableDiv.value || !newProps || isInternalUpdate.value || isActivelyEditing.value) return;

  if (animationFrameId) {  
    cancelAnimationFrame(animationFrameId);  
  }  
 
  animationFrameId = requestAnimationFrame(() => {
    if (!editableDiv.value) return

    const { text, formats } = newProps;
    const htmlContent = textWithFormatsToHtml(text, formats);
  
    /* console.log('🔵 RichTextEditor - Sincronizando formatos:', formats); */
    
    if (editableDiv.value.innerHTML !== htmlContent) {
      const wasFocused = document.activeElement === editableDiv.value;
      if (wasFocused) saveCursorPosition();
      
      editableDiv.value.innerHTML = htmlContent;
      
      if (wasFocused) {
        nextTick(() => restoreCursorPosition());
      }
    }
  })
}, { deep: true, immediate: true });


defineExpose({    
  getCurrentSelection,    
  getSelectedText: () => selectedText.value    
});  
</script>   
              
<style scoped>  
.rich-text-editable {  
  width: 100%;  
  color: black;
  background-color: white;
  padding: 0.5rem 0.75rem;  
  /* border: 1px solid #d1d5db;   */
  border: 1px solid var(--color-blue);   
  border-radius: 0.375rem;  
  font-family: inherit;  
  font-size: 0.875rem;  
  line-height: 1.5;  
  outline: none;  
  transition: border-color 0.2s;  
  white-space: pre-wrap;  
  word-wrap: break-word;  
}  
  
.rich-text-editable:focus {  
  border-color: var(--ui-primary);  
  box-shadow: 0 0 0 1px var(--ui-primary);  
}  
  
.rich-text-editable:empty:before {  
  content: attr(data-placeholder);  
  color: #9ca3af;  
  pointer-events: none;  
}  
</style>