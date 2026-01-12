<template>     
  <InlineTextToolbar    
    ref="toolbarRef" 
    v-show="showToolBar"
    :editable-element="editableDiv" 
    @toolbar-action="handleToolbarAction"   
    :variable-items="variableItems"
    :show-format-buttons="true" 
  />  

  <div                     
    ref="editableDiv"                    
    contenteditable="true"                    
    @input="handleInput"                    
    @blur="handleBlur"                    
    @focus="handleFocus"                    
    @keydown="handleKeydown"         
    class="outline-0"                    
    :style="computedStyles"                    
  />   
             
</template>                    
                  
<script setup lang="ts">  
import { computed, inject, nextTick, onMounted, provide, ref, watch } from 'vue';  
import { useInspectorDrawer } from '../../editor/editor.store';  
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';  
import InlineTextToolbar from '../../../App/InspectorDrawer/ConfigurationPanel/input-panels/InlineTextToolbar.vue';  
import { getFontFamily } from '@flyhub/email-core';
import { getCleanBlockStyle } from '../../../utils/blockStyleUtils';
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
const showVariablesDropdown = ref(false);
const toolbarRef = ref();
  
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
  const blockData = block.data as { props?: TextBlockProps; style?: any };

  return {
    text: blockData.props?.text || '',
    formats: blockData.props?.formats || []
  };
});
  
const showToolBar = computed(() => {  
  return editorStore.selectedBlockId === blockId;  
});  
  
const computedStyles = computed(() => { 
  // 1. Lógica de Fuente
  const rawFontFamily = props.style?.fontFamily; 
  const mappedFontFamily = getFontFamily(rawFontFamily) || 'inherit'; 
  
  // 2. Limpieza de Estilos (Zombis, Padding, Colores)
  // Aquí pasamos los defaults visuales
  const cleanStyles = getCleanBlockStyle(props.style, {
    padding: '16px 24px', 
    fontSize: 'inherit', 
    fontWeight: 'normal',
    textAlign: 'left',
    color: 'inherit',
    backgroundColor: null,
    fontStyle: 'inherit',
    lineHeight: '1.5',
  });

  // 3. 🔥 SOBRESCRIBIR LO CRÍTICO (El Fix)
  // Al hacer desestructuración (...cleanStyles) primero, y poner nuestras
  // propiedades después, aseguramos que ESTAS ganen siempre.
  return {
    ...cleanStyles,
    
    // Forzamos la fuente mapeada (para que no use MODERN_SANS)
    fontFamily: mappedFontFamily,
    
    // Forzamos pre-wrap (para que funcionen los ENTER y espacios)
    whiteSpace: 'pre-wrap', 
    lineHeight: '1.5',
    
    // Aseguramos que las listas y el texto fluyan bien
    wordBreak: 'break-word' 
  };
});

const variableItems = computed(() => {
  return Object.entries(editorStore.globalVariables || {}).map(
    ([key, value]) => ({
      key,
      value,
      label: `${value}`,
    })
  );
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
  
  /* console.log('🔄 restoreCursorPosition: restoring to position', lastCursorPosition.value); */
  
  // Si la posición es 0, ir al inicio
  if (lastCursorPosition.value === 0) {
    const range = document.createRange();
    range.setStart(editableDiv.value, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    /* console.log('📍 Moved to start (position 0)'); */
    return;
  }
  
  // Crear un walker para recorrer los nodos de texto
  const treeWalker = document.createTreeWalker(
    editableDiv.value,
    NodeFilter.SHOW_TEXT,
    null,
  );
  
  let currentPosition = 0;
  let currentNode = null;
  
  // Encontrar el nodo que contiene la posición
  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    const nodeLength = node.textContent?.length || 0;
    
    if (currentPosition + nodeLength >= lastCursorPosition.value) {
      currentNode = node;
      break;
    }
    currentPosition += nodeLength;
  }
  
  if (currentNode) {
    const offset = lastCursorPosition.value - currentPosition;
    const range = document.createRange();
    range.setStart(currentNode, Math.min(offset, currentNode.textContent?.length || 0));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    /* console.log('✅ Position restored in text node'); */
  } else {
    // Si no se encuentra, ir al final
    /* console.warn('⚠️ Position not found, moving to end'); */
    const range = document.createRange();
    range.selectNodeContents(editableDiv.value);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
  
// ============================================  
// FORMAT PROCESSING  
// ============================================  
  
function processInlineContent(
  element: HTMLElement, 
  initialInherited: { bold?: boolean; italic?: boolean } = {} 
): { text: string; formats: TextFormat[] } {
  
  let text = "";
  const formats: TextFormat[] = [];
  let pos = 0;

  const append = (t: string) => {
    if (!t) return;
    text += t;
    pos += t.length;
  };

  const processNode = (node: Node, inheritedFormats: { bold?: boolean; italic?: boolean } = {}) => {
    // --- 1. PROCESAR TEXTO ---
    if (node.nodeType === Node.TEXT_NODE) {
      const content = (node.textContent || "").replace(/\s+/g, " ");
      if (content) {
        const start = pos;
        append(content);
        const end = pos;

        // Guardamos formato si viene heredado o del nodo actual
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

    // --- 2. PROCESAR ELEMENTOS ---
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Enlaces Markdown
      if (tag === "a") {
        const href = el.getAttribute("href") || "";
        const linkText = el.textContent?.trim() || "";
        if (href && linkText) {
          append(`[${linkText}](${href})`);
          return;
        }
      }

      // --- DETECCIÓN DE FORMATOS ROBUSTA ---
      const currentFormats = { ...inheritedFormats };
      
      const computedStyle = window.getComputedStyle(el);
      const styleAttr = el.getAttribute('style') || '';
      
      // BOLD (Tags + Computed + Regex + Clases)
      const fw = computedStyle.fontWeight;
      const isBoldTag = tag === "strong" || tag === "b";
      const isBoldComputed = fw === "bold" || fw === "bolder" || (!isNaN(parseInt(fw)) && parseInt(fw) >= 600);
      const isBoldRegex = /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i.test(styleAttr);
      const hasBoldClass = el.classList.contains("bold") || el.classList.contains("font-bold") || el.classList.contains("fw-bold");

      if (isBoldTag || isBoldComputed || isBoldRegex || hasBoldClass) {
        currentFormats.bold = true;
      }

      // ITALIC
      const fs = computedStyle.fontStyle;
      const isItalicTag = tag === "em" || tag === "i";
      const isItalicComputed = fs === "italic";
      const isItalicRegex = /font-style\s*:\s*italic/i.test(styleAttr);
      const hasItalicClass = el.classList.contains("italic") || el.classList.contains("font-italic");

      if (isItalicTag || isItalicComputed || isItalicRegex || hasItalicClass) {
        currentFormats.italic = true;
      }

      // Recursión
      Array.from(el.childNodes).forEach(child => {
        processNode(child, currentFormats);
      });
    }
  };

  // --- INICIO: Pasamos los estilos iniciales a los hijos ---
  Array.from(element.childNodes).forEach(node => {
    processNode(node, initialInherited); 
  });

  text = text.replace(/[ \t]+\n/g, "\n").trimEnd();
  return { text: text.trim(), formats };
}
  
function htmlToTextAndFormats(htmlContent: string): { text: string; formats: TextFormat[] } {  
  const tempDiv = document.createElement('div');  
  tempDiv.innerHTML = htmlContent;  
    
  let text = "";  
  const formats: TextFormat[] = [];  
  let post = 0;
  
  function processNode(
    node: Node, 
    currentFormats: { bold?: boolean; italic?: boolean } = {}, 
    depth: number = 0
  ) {  
    if (node.nodeType === Node.TEXT_NODE) {  
      const content = node.textContent || "";  
      if (content) {  
        const start = text.length;  
        post = start;  
        text += content;  
        const end = text.length;  
        
        // Solo crear formato si hay algún estilo activo
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
      
    if (node.nodeType === Node.ELEMENT_NODE) {  
      const el = node as HTMLElement;  
      const tag = el.tagName.toLowerCase();  

      if (tag === "a") {  
        const href = el.getAttribute("href") || "";  
        const linkText = el.textContent?.trim() || "";  
        if (href && linkText) {  
          const markdownLink = `[${linkText}](${href})`;  
          text += markdownLink;  
          post += markdownLink.length;  
          return; // No procesar hijos  
        }  
      } 
        
      // Crear una copia de los formatos actuales para no mutar el objeto padre
      const newFormats = { ...currentFormats };  
      
      // Manejar etiquetas de formato
      if (tag === "b" || tag === "strong") {
        newFormats.bold = true;
      } else if (tag === "i" || tag === "em") {
        newFormats.italic = true;
      }
      // Ignorar otras etiquetas como div, span, etc. a menos que tengan estilos específicos
        
      // Procesar hijos recursivamente
      Array.from(el.childNodes).forEach(child => {  
        processNode(child, newFormats, depth + 1);  
      });  
    }  
  }  
    
  // Procesar todos los nodos hijos del div temporal
  Array.from(tempDiv.childNodes).forEach(node => {  
    processNode(node);  
  });  
    
  return { text, formats };  
}

function textWithFormatsToHtml(text: string, formats: TextFormat[]): string {
  if (!formats || formats.length === 0) return text;

  const events: any[] = [];

  // 1. Generación de eventos (Tu formato)
  formats.forEach(format => {
    if (format.bold) {
      // Prioridad 1 (Más externo)
      events.push({ position: format.start, type: 'start', format: { bold: true }, priority: 1 });
      events.push({ position: format.end, type: 'end', format: { bold: true }, priority: 1 });
    }
    if (format.italic) {
      // Prioridad 2 (Más interno)
      events.push({ position: format.start, type: 'start', format: { italic: true }, priority: 2 });
      events.push({ position: format.end, type: 'end', format: { italic: true }, priority: 2 });
    }
    if (format.underline) {
       // Prioridad 3
       events.push({ position: format.start, type: 'start', format: { underline: true }, priority: 3 });
       events.push({ position: format.end, type: 'end', format: { underline: true }, priority: 3 });
    }
  });

  // 2. Ordenamiento (CRÍTICO para que Bold e Italic funcionen juntos)
  events.sort((a, b) => {
    // A. Primero por posición en el texto
    if (a.position !== b.position) return a.position - b.position;

    // B. En la misma posición: Cerrar etiquetas ('end') antes de abrir nuevas ('start')
    if (a.type !== b.type) return a.type === 'end' ? -1 : 1;

    // C. Jerarquía para evitar cruces (LIFO: Last In, First Out)
    // - Al abrir: Bold(1) -> Italic(2)
    // - Al cerrar: Italic(2) -> Bold(1)
    if (a.type === 'start') {
        return a.priority - b.priority;
    } else {
        return b.priority - a.priority;
    }
  });

  // 3. Construcción del HTML
  let result = '';
  let cursor = 0;

  events.forEach(evt => {
    // Agregar texto plano que haya antes de este evento
    if (evt.position > cursor) {
      result += text.substring(cursor, evt.position);
      cursor = evt.position;
    }

    // Determinar qué etiqueta es
    let tag = '';
    if (evt.format.bold) tag = 'b';
    else if (evt.format.italic) tag = 'i';
    else if (evt.format.underline) tag = 'u';

    // Agregar etiqueta de apertura o cierre
    if (evt.type === 'start') {
      result += `<${tag}>`;
    } else {
      result += `</${tag}>`;
    }
  });

  // Agregar cualquier texto restante al final
  if (cursor < text.length) {
    result += text.substring(cursor);
  }

  return result;
}

// ============================================================================  
// FUNCIONES DE FORMATO (RESTAURADAS)  
// ============================================================================  

function toggleBold() {    
  if (!editableDiv.value) return;    
      
  isInternalUpdate.value = true;    
      
  document.execCommand('bold', false, undefined);    
      
  nextTick(() => {    
    const htmlContent = editableDiv.value!.innerHTML;    
    const { text, formats } = htmlToTextAndFormats(htmlContent);

    /* console.log('🟢 InlineTextEditor - Bold aplicado, formatos:', formats); */
    
    updateBlockInStore(text, formats);
        
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

    /* console.log('🟢 InlineTextEditor - Italic aplicado, formatos:', formats); */
    
    updateBlockInStore(text, formats);
        
    setTimeout(() => {    
      isInternalUpdate.value = false;    
    }, 100);    
  });    
}  

// ============================================  
// EVENT HANDLERS  
// ============================================  
  
function handleInput() {
  if (!editableDiv.value || isInternalUpdate.value || !blockId) return;

  isInternalUpdate.value = true;
  saveCursorPosition();

  // --- 1. DETECCIÓN DEL ESTILO RAÍZ (Corrección Full Bold) ---
  const rootEl = editableDiv.value;
  const rootStyle = window.getComputedStyle(rootEl);
  const rootStyleAttr = rootEl.getAttribute('style') || '';

  // Verificar Bold en el contenedor padre
  const rootFw = rootStyle.fontWeight;
  const isRootBold = 
    rootFw === "bold" || 
    rootFw === "bolder" || 
    (!isNaN(parseInt(rootFw)) && parseInt(rootFw) >= 600) ||
    /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i.test(rootStyleAttr);

  // Verificar Italic en el contenedor padre
  const isRootItalic = 
    rootStyle.fontStyle === "italic" || 
    /font-style\s*:\s*italic/i.test(rootStyleAttr);

  // --- 2. PROCESAMIENTO CON HERENCIA ---
  // Pasamos { bold: true/false } como estado inicial
  const { text, formats } = processInlineContent(rootEl, { 
    bold: isRootBold, 
    italic: isRootItalic 
  });
  
  const hasMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(text); 

  updateBlockInStore(text, formats, hasMarkdownLinks);

  nextTick(() => {
    restoreCursorPosition();
    isInternalUpdate.value = false;
  });
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
    
    handleInput();
    return;
  }

  const range = selection.getRangeAt(0);
/*   console.log('🎯 Current range for insertion:', {
    collapsed: range.collapsed,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    startContainer: range.startContainer.nodeName,
    commonAncestor: range.commonAncestorContainer.nodeName
  }); */

  // 4. VERIFICAR que la selección esté dentro del editor
  if (!editableDiv.value.contains(range.commonAncestorContainer)) {
    /* console.warn('⚠️ Selection outside editor, moving to end'); */
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
    
    /*console.log('✅ Manual insertion completed'); */
    
    // Disparar input event manualmente
    const inputEvent = new Event('input', { bubbles: true });
    editableDiv.value.dispatchEvent(inputEvent);
    
  } catch (error) {
    /* console.error('❌ Manual insertion failed:', error); */
    
    // ÚLTIMO RECURSO: innerHTML
    /* console.warn('🔄 Last resort: innerHTML append'); */
    const currentHTML = editableDiv.value.innerHTML;
    editableDiv.value.innerHTML = currentHTML + variableText;
    handleInput();
  }
  
  /* console.log('🎉 insertVariable completed'); */
}

function handleFocus() {  
  isActivelyEditing.value = true;
  
  if (editorStore.selectedBlockId !== blockId && blockId) {  
    editorStore.setSelectedBlockId(blockId);  
  }  
}  
  
function handleBlur() {  
  setTimeout(() => {  
    isActivelyEditing.value = false;  
  }, 150);  
} 

  
// Evitar que tener que darle doble click al bloque de text
function handleMouseDown(event: MouseEvent) {  
   if (editorStore.selectedBlockId !== blockId && blockId) {  
     editorStore.setSelectedBlockId(blockId);  
    }
    
    event.stopPropagation();  
}  
  
function handleKeydown(event: KeyboardEvent) {  
  // Ctrl + B → negrita  
  if (event.ctrlKey && event.key.toLowerCase() === "b") {  
    event.preventDefault();  
    toggleBold();  
    return;  
  }  
  
  // Ctrl + I → itálica  
  if (event.ctrlKey && event.key.toLowerCase() === "i") {  
    event.preventDefault();  
    toggleItalic();  
    return;  
  }  

  // Ctrl + spacio → variables 
  if ((event.ctrlKey && event.code === "Space") || event.key === "@") {  
    event.preventDefault();  
    saveCursorPosition();
    toolbarRef.value?.openVariablesDropdown?.(); 
    return; 
  } 
}  

  
function handleToolbarAction(action: 'bold' | 'italic' | string) {
  /* console.log('🎛️ InlineTextEditor - handleToolbarAction:', action); */

  if (action === 'bold') {
    toggleBold();
  } else if (action === 'italic') {
    toggleItalic();
  } else {
    // Si es una variable
    saveCursorPosition();
    setTimeout(() => {
      insertVariable(action);
    }, 10);
  }
}

// ============================================  
// UTILITY FUNCTIONS
// ============================================

function updateBlockInStore(text: string, formats: TextFormat[], markdown?: boolean) {
  if (!blockId) return;
  
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
            formats: formats,
            markdown: markdown
          } as any
        }
      }
    });
  }
}


// ============================================  
// WATCHERS  
// ============================================  

watch(blockProps, (newProps, oldProps) => {
  if (!editableDiv.value || !newProps || isInternalUpdate.value || isActivelyEditing.value) return;

  // Evitar actualizaciones innecesarias
  const oldText = oldProps?.text || '';
  const oldFormats = oldProps?.formats || [];
  const newText = newProps.text;
  const newFormats = newProps.formats || [];
  
  if (oldText === newText && JSON.stringify(oldFormats) === JSON.stringify(newFormats)) {
    return;
  }

/*   console.log('🔄 InlineTextEditor - Sincronizando desde store');
  console.log('📝 Texto:', newText);
  console.log('🎨 Formatos:', newFormats); */

  const htmlContent = textWithFormatsToHtml(newText, newFormats);
  
  if (editableDiv.value.innerHTML !== htmlContent) {
    /* console.log('✅ Actualizando contenido del editor'); */
    
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
  if (!editableDiv.value || !blockId) return;  
  
  const block = currentBlock.value;  
  if (!block) return;  
  
  // ✅ USAR DATOS DEL STORE, NO DE PROPS
  const blockData = block.data as { props?: TextBlockProps; style?: any };

  const text = (blockData.props as TextBlockProps)?.text || '';
  let formats = (blockData.props as TextBlockProps)?.formats || [];
  if (blockData.style?.fontStyle === 'italic' && !formats.some(f => f.italic)) {  
    formats = [...formats, {  
      start: 0,  
      end: text.length,  
      italic: true  
    }];  
    updateBlockInStore(text, formats);  
  }    
  const htmlContent = textWithFormatsToHtml(text, formats);  
  
  /* console.log('🚀 InlineTextEditor - Montado con datos del store:', { text, formats }); */
  
  editableDiv.value.innerHTML = htmlContent;  
});

provide('editorFunctions', {
  saveCursorPosition,
  insertVariable
});

defineExpose({   
  handleInput  
});  

</script> 

  
<style scoped>  

.inline-text-editor:focus {  
  outline: none !important;  
  background-color: transparent !important;  
}  
</style>