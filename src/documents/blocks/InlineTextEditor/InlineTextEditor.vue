<template>     

  <InlineTextToolbar    
    v-show="showToolBar"
    label=""    
    :rows="3"    
    :model-value="initialText"     
    :editable-element="editableDiv" 
    @content-changed="handleInput"   
    @toolbar-action="handleToolbarAction"   
  /> 

  <div                     
    ref="editableDiv"                    
    contenteditable="true"                    
    @input="handleInput"                    
    @blur="handleBlur"                    
    @focus="handleFocus"                    
    @keydown="handleKeydown"  
    @mousedown="handleMouseDown"                  
    class="inline-text-editor"                    
    :style="computedStyles"                    
  />   
             
</template>                    
                  
<script setup lang="ts">  
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';  
import { useInspectorDrawer } from '../../editor/editor.store';  
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';  
import InlineTextToolbar from '../../../App/InspectorDrawer/ConfigurationPanel/input-panels/InlineTextToolbar.vue';  
  
// ============================================  
// TYPES  
// ============================================  
  
interface TextFormat {  
  start: number;  
  end: number;  
  bold?: boolean;  
  italic?: boolean;  
}  
  
interface TextBlockProps {  
  text: string;  
  formats?: TextFormat[];  
  markdown?: boolean;  
}  
  
// ============================================  
// PROPS & EMITS  
// ============================================  
  
const props = defineProps<{  
  text: string;  
  style?: Record<string, any>;  
}>();  
  
const emit = defineEmits<{  
  (e: 'update:text', value: string): void;  
  (e: 'update:block-props', value: TextBlockProps): void;
}>();  
  
// ============================================  
// STATE  
// ============================================  
  
const editorStore = useInspectorDrawer();  
const editableDiv = ref<HTMLDivElement | null>(null);  
const blockId = inject(currentBlockIdSymbol);  
const isInternalUpdate = ref(false);  
const lastCursorPosition = ref(0);  
const isActivelyEditing = ref(false); 
  
// ============================================  
// COMPUTED  
// ============================================  
  
const currentBlock = computed(() => {  
  if (!blockId) return null;  
  return editorStore.document[blockId];  
});  

const blockProps = computed(() => {
  if (!blockId) return null;
  const block = editorStore.document[blockId];
  return {
    text: block?.data?.props?.text || '',
    formats: block?.data?.props?.formats || []
  };
});
  
const showToolBar = computed(() => {  
  return editorStore.selectedBlockId === blockId;  
});  
  
const computedStyles = computed(() => {  
  const fontFamilyMap: Record<string, string> = {  
    'MODERN_SANS': 'Helvetica, Arial, sans-serif',  
    'BOOK_ANTIQUA': 'Georgia, "Times New Roman", serif',  
    'MONOSPACE': '"Courier New", Courier, monospace'  
  };  
  
  const rawFontFamily = props.style?.fontFamily;  
  const mappedFontFamily = rawFontFamily && fontFamilyMap[rawFontFamily]  
    ? fontFamilyMap[rawFontFamily]  
    : rawFontFamily || 'inherit';  
  
  return {  
    padding: props.style?.padding  
      ? `${props.style.padding.top}px ${props.style.padding.right}px ${props.style.padding.bottom}px ${props.style.padding.left}px`  
      : '16px 24px',  
    fontFamily: mappedFontFamily,  
    fontSize: props.style?.fontSize ? `${props.style.fontSize}px` : 'inherit',  
    fontWeight: props.style?.fontWeight || 'normal',  
    textAlign: props.style?.textAlign || 'left',  
    color: props.style?.color || 'inherit',  
    backgroundColor: props.style?.backgroundColor || 'transparent'  
  };  
});  
  
// ============================================  
// CURSOR MANAGEMENT  
// ============================================  
  
function saveCursorPosition() {  
  if (!editableDiv.value) return;  
  
  const selection = window.getSelection();  
  if (!selection || selection.rangeCount === 0) return;  
  
  const range = selection.getRangeAt(0);  
  const preCaretRange = range.cloneRange();  
  preCaretRange.selectNodeContents(editableDiv.value);  
  preCaretRange.setEnd(range.endContainer, range.endOffset);  
  lastCursorPosition.value = preCaretRange.toString().length;  
}  
  
function restoreCursorPosition() {  
  if (!editableDiv.value) return;  
  
  const selection = window.getSelection();  
  if (!selection) return;  
  
  let charCount = 0;  
  const targetPos = lastCursorPosition.value;  
  
  const findPosition = (node: Node): { node: Node; offset: number } | null => {  
    if (node.nodeType === Node.TEXT_NODE) {  
      const textLength = node.textContent?.length || 0;  
      if (charCount + textLength >= targetPos) {  
        return { node, offset: targetPos - charCount };  
      }  
      charCount += textLength;  
    } else if (node.nodeType === Node.ELEMENT_NODE) {  
      for (const child of Array.from(node.childNodes)) {  
        const result = findPosition(child);  
        if (result) return result;  
      }  
    }  
    return null;  
  };  
  
  const position = findPosition(editableDiv.value);  
  if (position) {  
    const range = document.createRange();  
    range.setStart(position.node, position.offset);  
    range.collapse(true);  
    selection.removeAllRanges();  
    selection.addRange(range);  
  }  
}  
  
// ============================================  
// FORMAT PROCESSING  
// ============================================  
  
function processInlineContent(element: HTMLElement): { text: string; formats: TextFormat[] } {  
  let text = "";  
  const formats: TextFormat[] = [];  
  let pos = 0;  
  
  const append = (t: string) => {  
    if (!t) return;  
    text += t;  
    pos += t.length;  
  };  
  
  const processNode = (node: Node, inheritedFormats: { bold?: boolean; italic?: boolean } = {}) => {  
    if (node.nodeType === Node.TEXT_NODE) {  
      const content = (node.textContent || "").replace(/\s+/g, " ");  
      if (content) {  
        const start = pos;  
        append(content);  
        const end = pos;  
  
        // Si hay formatos heredados, crear un formato para este texto  
        if (inheritedFormats.bold || inheritedFormats.italic) {  
          formats.push({  
            start,  
            end,  
            ...inheritedFormats  
          });  
        }  
      }  
      return;  
    }  
  
    if (node.nodeType === Node.ELEMENT_NODE) {  
      const el = node as HTMLElement;  
      const tag = el.tagName.toLowerCase();  
  
      // Detectar formatos del elemento actual  
      const computedStyle = window.getComputedStyle(el);  
      const fw = computedStyle.fontWeight;  
      const isBoldTag = tag === "strong" || tag === "b";  
      const isBoldStyle = fw === "bold" || (!isNaN(parseInt(fw)) && parseInt(fw) >= 600);  
      const isItalicTag = tag === "em" || tag === "i";  
      const isItalicStyle = computedStyle.fontStyle === "italic";  
  
      // Combinar formatos heredados con los del elemento actual  
      const currentFormats = { ...inheritedFormats };  
      if (isBoldTag || isBoldStyle) currentFormats.bold = true;  
      if (isItalicTag || isItalicStyle) currentFormats.italic = true;  
  
      // Procesar hijos con los formatos actuales  
      Array.from(el.childNodes).forEach(child => {  
        processNode(child, currentFormats);  
      });  
    }  
  };  
  
  Array.from(element.childNodes).forEach(node => {  
    processNode(node);  
  });  
  
  text = text.replace(/[ \t]+\n/g, "\n").trimEnd();  
  return { text: text.trim(), formats };  
}  
  
function textWithFormatsToHtml(text: string, formats: any[]): string {  
  if (!formats || formats.length === 0) return text;  
  
  // Ordenar formatos por posición de inicio
  const sortedFormats = [...formats].sort((a, b) => a.start - b.start);  
    
  let html = '';  
  let lastPos = 0;  
  const stack: string[] = [];  
  const openTags: { pos: number; tags: string[] }[] = [];  
  const closeTags: { pos: number; tags: string[] }[] = [];  
  
  // Planificar apertura y cierre de tags
  sortedFormats.forEach(format => {  
    const tags: string[] = [];  
    if (format.bold) tags.push('b');  
    if (format.italic) tags.push('i');  
      
    if (tags.length > 0) {  
      openTags.push({ pos: format.start, tags });  
      closeTags.push({ pos: format.end, tags: [...tags].reverse() });  
    }  
  });  
  
  // Ordenar por posición
  openTags.sort((a, b) => a.pos - b.pos);  
  closeTags.sort((a, b) => a.pos - b.pos);  
  
  let openIndex = 0;  
  let closeIndex = 0;  
  
  for (let i = 0; i <= text.length; i++) {  
    // Cerrar tags en esta posición
    while (closeIndex < closeTags.length && closeTags[closeIndex].pos === i) {  
      closeTags[closeIndex].tags.forEach(tag => {  
        html += `</${tag}>`;  
      });  
      closeIndex++;  
    }  
      
    // Abrir tags en esta posición
    while (openIndex < openTags.length && openTags[openIndex].pos === i) {  
      openTags[openIndex].tags.forEach(tag => {  
        html += `<${tag}>`;  
      });  
      openIndex++;  
    }  
      
    // Agregar carácter actual
    if (i < text.length) {  
      html += text[i];  
    }  
  }  
    
  return html;  
}

function htmlToTextAndFormats(htmlContent: string): { text: string; formats: any[] } {  
  const tempDiv = document.createElement('div');  
  tempDiv.innerHTML = htmlContent;  
    
  let text = "";  
  const formats: any[] = [];  
  let pos = 0;  
  
  function processNode(node: Node, currentFormats: { bold?: boolean; italic?: boolean } = {}) {  
    if (node.nodeType === Node.TEXT_NODE) {  
      const content = node.textContent || "";  
      if (content) {  
        const start = pos;  
        text += content;  
        pos += content.length;  
        
        // Solo crear formato si hay algún estilo activo
        if (currentFormats.bold || currentFormats.italic) {  
          formats.push({  
            start,  
            end: pos,  
            ...(currentFormats.bold && { bold: true }),  
            ...(currentFormats.italic && { italic: true })  
          });  
        }  
      }  
      return;  
    }  
      
    if (node.nodeType === Node.ELEMENT_NODE) {  
      const el = node as HTMLElement;  
      const tag = el.tagName.toLowerCase();  
        
      // Actualizar formatos según la etiqueta
      const newFormats = { ...currentFormats };  
      if (tag === "b" || tag === "strong") newFormats.bold = true;  
      if (tag === "i" || tag === "em") newFormats.italic = true;  
        
      // Procesar hijos recursivamente
      Array.from(el.childNodes).forEach(child => {  
        processNode(child, newFormats);  
      });  
    }  
  }  
    
  Array.from(tempDiv.childNodes).forEach(node => {  
    processNode(node);  
  });  
    
  return { text, formats };  
}
  

// ============================================================================  
// FUNCIONES DE FORMATO (RESTAURADAS)  
// ============================================================================  
function applyBold() {  
  if (!editableDiv.value) return;  
    
  document.execCommand('bold', false);  
  editableDiv.value.focus();  
    
  // Trigger input event para actualizar el store  
  nextTick(() => {  
    if (editableDiv.value) {  
      editableDiv.value.dispatchEvent(new Event('input'));  
    }  
  });  
}  
  
function applyItalic() {  
  if (!editableDiv.value) return;  
    
  document.execCommand('italic', false);  
  editableDiv.value.focus();  
    
  // Trigger input event para actualizar el store  
  nextTick(() => {  
    if (editableDiv.value) {  
      editableDiv.value.dispatchEvent(new Event('input'));  
    }  
  });  
}  
  
// ============================================  
// EVENT HANDLERS  
// ============================================  
  
function handleInput() {
  if (!editableDiv.value || isInternalUpdate.value || !blockId) return;

  isInternalUpdate.value = true;
  saveCursorPosition();

  const htmlContent = editableDiv.value.innerHTML;
  const { text, formats } = htmlToTextAndFormats(htmlContent);

  console.log('🟢 InlineTextEditor - Formatos detectados:', formats);

  // Actualizar store
  const currentBlock = editorStore.document[blockId];
  if (currentBlock?.type === 'Text') {
    editorStore.setDocument({
      [blockId]: {
        ...currentBlock,
        data: {
          ...currentBlock.data,
          props: {
            ...currentBlock.data.props,
            text: text,
            formats: formats
          }
        }
      }
    });
  }

  nextTick(() => {
    restoreCursorPosition();
    isInternalUpdate.value = false;
  });
}


function handleFocus() {  
  isActivelyEditing.value = true;  
}  
  
function handleBlur() {  
  setTimeout(() => {  
    isActivelyEditing.value = false;  
  }, 150);  
} 

  
// Evitar que tener que darle doble click al bloque de text
function handleMouseDown(event: MouseEvent) {  
  // Solo detener propagación si el bloque ya está seleccionado  
  // Esto permite que el primer click seleccione el bloque  
  // y el contenido sea editable inmediatamente después
  if (editorStore.selectedBlockId === blockId) {  
    event.stopPropagation();  
  }  
}  
  
function handleKeydown(event: KeyboardEvent) {  
  // Ctrl + B → negrita  
  if (event.ctrlKey && event.key.toLowerCase() === "b") {  
    event.preventDefault();  
    handleToolbarAction('bold');  
    return;  
  }  
  
  // Ctrl + I → itálica  
  if (event.ctrlKey && event.key.toLowerCase() === "i") {  
    event.preventDefault();  
    handleToolbarAction('italic');  
    return;  
  }  
}  
  
function handleToolbarAction(action: 'bold' | 'italic') {  
  if (!editableDiv.value) return;  

  isInternalUpdate.value = true;
  
  // Enfocar y restaurar selección  
  editableDiv.value.focus(); 
  saveCursorPosition(); 
  /* restoreCursorPosition();   */
  
  // Aplicar formato  
  document.execCommand(action, false, undefined);  
  
  nextTick(() => {  
    if (editableDiv.value) {  
      editableDiv.value.dispatchEvent(new Event('input')); // ✅ Dispara el handleInput corregido
    }  
  });
}  
  
// ============================================  
// WATCHERS  
// ============================================  
 
watch(() => {  
  if (!blockId) return null;  
  const block = editorStore.document[blockId];  
  return {  
    text: block?.data?.props?.text || '',  
    formats: block?.data?.props?.formats || []  
  };  
}, (newData) => {  
  if (!newData || isInternalUpdate.value || !editableDiv.value) return;  
  
    
  const { text, formats } = newData;  
  const htmlContent = textWithFormatsToHtml(text, formats);  
    
  // Solo actualizar si el contenido HTML es diferente  
  if (editableDiv.value.innerHTML !== htmlContent) {  
    isInternalUpdate.value = true;  
    saveCursorPosition();  
      
    editableDiv.value.innerHTML = htmlContent;  
      
    nextTick(() => {  
      restoreCursorPosition();  
      isInternalUpdate.value = false;  
    });  
  }  
}, { deep: true, immediate: false });

watch(blockProps, (newProps) => {
  if (!editableDiv.value || !newProps || isInternalUpdate.value) return;

  const { text, formats = [] } = newProps;
  const htmlContent = textWithFormatsToHtml(text, formats);

  console.log('🟢 InlineTextEditor - Sincronizando formatos:', formats);
  
  if (editableDiv.value.innerHTML !== htmlContent) {
    const wasFocused = document.activeElement === editableDiv.value;
    if (wasFocused) saveCursorPosition();
    
    editableDiv.value.innerHTML = htmlContent;
    
    if (wasFocused) {
      nextTick(() => restoreCursorPosition());
    }
  }
}, { deep: true, immediate: true });

// ============================================  
// LIFECYCLE  
// ============================================  
  
onMounted(() => {  
  if (!editableDiv.value || !props.text || !blockId) return;  
  
  const block = currentBlock.value;  
  if (!block) return;  
  
  const formats = (block.data?.props as TextBlockProps)?.formats || [];  
  const htmlContent = textWithFormatsToHtml(props.text, formats);  
  editableDiv.value.innerHTML = htmlContent;  
});  

defineExpose({  
  applyBold,  
  applyItalic,  
  handleInput  
});  

</script> 

  
<style scoped>  
/** 
.inline-text-editor {  
  min-height: 20px;  
  outline: none;  
  cursor: text;  
  transition: background-color 0.2s;  
  white-space: pre-wrap;  
  word-wrap: break-word;  
}  
  
.inline-text-editor:focus {  
  background-color: rgba(255, 153, 0, 0.05);  
  outline: 2px solid var(--ui-primary);  
  outline-offset: 2px;  
}  
  
.inline-text-editor:empty:before {  
  content: 'Haz clic para editar...';  
  color: #999;  
  font-style: italic;  
}  
  */
</style>