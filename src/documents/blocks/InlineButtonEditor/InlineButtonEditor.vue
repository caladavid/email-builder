<template>  
    <InlineTextToolbar    
        ref="toolbarRef" 
        v-show="showToolBar"
        :editable-element="editableDiv" 
        @toolbar-action="handleToolbarAction"   
        :variable-items="variableItems"
        :show-format-buttons="false"
    />
    <div :style="containerStyles">
        <!-- <div v-if="IS_DEBUG" class="debug-label" :title="blockId">
            BTN: {{ blockId }}
        </div> -->

        <div :style="buttonStyles">  
          <div   
              ref="editableDiv"  
              contenteditable="true"  
              @input="handleInput"  
              @focus="handleFocus"  
              @blur="handleBlur"  
              @keydown="handleKeydown"
              :style="textStyles"  
          />  
        </div>  
    </div>  
    
</template>
<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { useInspectorDrawer } from '../../editor/editor.store';
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';
import InlineTextToolbar from '../../../App/InspectorDrawer/ConfigurationPanel/input-panels/InlineTextToolbar.vue';
import { getCleanBlockStyle } from '../../../utils/blockStyleUtils';

// DEBUG PARA VER LOS BORDES
const IS_DEBUG = false;

// ... (Interfaces se mantienen igual) ...
interface TextFormat {  
  start: number;  
  end: number;  
  bold?: boolean;  
  italic?: boolean;  
} 

interface ButtonBlockProps {
  text: string;  
  url?: string;  
  buttonTextColor?: string;  
  buttonBackgroundColor?: string;  
  buttonStyle?: 'rectangle' | 'rounded' | 'pill';  
  size?: 'x-small' | 'small' | 'medium' | 'large';   
  fullWidth?: boolean;
}

// ... (State y Props se mantienen igual) ...
const editorStore = useInspectorDrawer();
const blockId = inject(currentBlockIdSymbol);
const editableDiv = ref<HTMLDivElement | null>(null);
const toolbarRef = ref();
const isInternalUpdate = ref(false);
const isActivelyEditing = ref(false);
const lastCursorPosition = ref(0);

const props = defineProps<{     
  text: string;     
  style?: Record<string, any>;     
  buttonTextColor?: string;     
  buttonBackgroundColor?: string;     
  buttonStyle?: 'rectangle' | 'rounded' | 'pill';     
  size?: 'x-small' | 'small' | 'medium' | 'large';  
  url?: string;   
  fullWidth?: boolean;   
}>();

// ============================================  
// COMPUTED (MODIFICADOS PARA DEBUG)
// ============================================  
 
const currentBlock = computed(() => {
    if (!blockId) return;
    const block = editorStore.document[blockId];
    return block;
});

const containerStyles = computed(() => { 
  const blockData = currentBlock.value?.data as { props?: ButtonBlockProps; style?: any }; 
   
  // 1. Copiamos los estilos del bloque
  const styleForContainer = { ...(blockData?.style || {}) };

  // 🔥 FIX GENÉRICO: El contenedor de un botón NO debe renderizar bordes.
  // Los bordes definidos en el JSON pertenecen al botón interno, no a este wrapper.
  delete styleForContainer.border;
  delete styleForContainer.borderWidth;
  delete styleForContainer.borderColor;
  delete styleForContainer.borderStyle;

  return getCleanBlockStyle(styleForContainer, {
    display: 'block', 
    width: '100%',
    textAlign: "center", 
    backgroundColor: null,
    maxWidth: '100%',
    padding: '16px 24px',
    boxSizing: 'border-box',
    
    // Debug
    ...(IS_DEBUG ? { outline: '2px dashed red', outlineOffset: '-2px', position: 'relative' } : {})
  });
});
  
// Estilos del botón (colores, bordes, tamaño)  
const buttonStyles = computed(() => {
  const blockData = currentBlock.value?.data as { props?: ButtonBlockProps; style?: any };
  const styles = blockData?.style || {}; // Acceso rápido a estilos
  const fontSizePx = "16px";
  const isFullWidth = blockData?.props?.fullWidth;

  const sizeStyles = {
    'x-small': { fontSize: fontSizePx, padding: '4px 8px' },
    'small': { fontSize: fontSizePx, padding: '8px 12px' },
    'medium': { fontSize: fontSizePx, padding: '12px 20px' },
    'large': { fontSize: fontSizePx, padding: '16px 32px' }
  };

  const currentSize = blockData?.props?.size || 'medium';
  const borderRadiusMap = {
    'rectangle': '0px',
    'rounded': '4px',
    'pill': '9999px'
  };

  // Prioridad de color de fondo: Propiedad específica > Estilo CSS > Default gris
  const bgColor = blockData?.props?.buttonBackgroundColor || styles.backgroundColor || '#999999';

  return {
    display: isFullWidth ? 'block' : 'inline-block',
    // Si no es fullWidth, eliminamos márgenes que puedan interferir
    margin: isFullWidth ? '0' : '0 auto', 
    width: isFullWidth ? '100%' : 'auto',
    padding: sizeStyles[currentSize].padding,
    backgroundColor: bgColor,
    borderRadius: borderRadiusMap[blockData?.props?.buttonStyle || 'rounded'],
    
    // 🔥 FIX 1: Permitir bordes si vienen del parser
    border: styles.border || styles.borderWidth ? undefined : 'none', // Si hay borde en estilo, dejamos que getCleanBlockStyle o el style object lo aplique. Si lo definimos aquí, sobrescribimos.
    // MEJOR AÚN: Fusionar explícitamente
    borderWidth: styles.borderWidth,
    borderStyle: styles.borderStyle,
    borderColor: styles.borderColor,
    
    cursor: 'pointer',
    boxSizing: 'border-box', // 🔥 Fix layout

    // Debug visual
    ...(IS_DEBUG ? { outline: '2px dashed blue', outlineOffset: '-2px' } : {})
  };
});
  
// Estilos del texto editable  
const textStyles = computed(() => {
  const blockData = currentBlock.value?.data as { props?: ButtonBlockProps; style?: any };
  const styles = blockData?.style || {};
  const fontSizePx = "16px";
  
  const fontFamilyMap: Record<string, string> = {
    'MODERN_SANS': 'Helvetica, Arial, sans-serif',
    'BOOK_ANTIQUA': 'Georgia, "Times New Roman", serif',
    'MONOSPACE': '"Courier New", Courier, monospace'
  };

  const sizeStyles = {
    'x-small': { fontSize: fontSizePx },
    'small': { fontSize: fontSizePx },
    'medium': { fontSize: fontSizePx },
    'large': { fontSize: fontSizePx }
  };

  const rawTextAlign = styles.textAlign || props.style?.textAlign || 'left';
  const validTextAlign = ['left', 'center', 'right', 'justify'].includes(rawTextAlign) 
      ? rawTextAlign 
      : 'left';

  // 🔥 FIX 2: Prioridad de color de texto: Propiedad > Estilo CSS > Default blanco
  const textColor = blockData?.props?.buttonTextColor || styles.color || '#ffffff';

  return {
    color: textColor,
    fontSize: styles.fontSize ? `${styles.fontSize}px` : sizeStyles[blockData?.props?.size || 'medium'].fontSize,
    fontFamily: fontFamilyMap[styles.fontFamily] || 'inherit',
    fontWeight: styles.fontWeight || 'bold',
    textAlign: validTextAlign as any,
    outline: 'none',
    border: 'none',
    background: 'transparent', // Asegurar transparencia
    width: '100%',
    
    // Debug visual
    ...(IS_DEBUG ? { outline: '1px dotted green' } : {})
  };
});

// ... (Resto del código: blockProps, functions, watchers, hooks SE MANTIENE IGUAL) ...
const blockProps = computed(() => {   
  if (!blockId) return null;   
  const block = editorStore.document[blockId];   
  const blockData = block.data as { props?: ButtonBlockProps; style?: any };   
  
  return {   
    text: blockData.props?.text || "",   
    buttonTextColor: blockData.props?.buttonTextColor,   
    buttonBackgroundColor: blockData.props?.buttonBackgroundColor,   
    buttonStyle: blockData.props?.buttonStyle,   
    size: blockData.props?.size,   
    url: blockData.props?.url,   
    fullWidth: blockData.props?.fullWidth,   
    style: blockData.style   
  };   
});


const showToolBar = computed(() => {   
  return editorStore.selectedBlockId === blockId;   
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

// ============================================================================   
// FUNCTIONS 
// ============================================================================   

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

function updateBlockInStore(text: string, formats: TextFormat[], markdown?: boolean) {
  if (!blockId) return;
  
  const currentBlock = editorStore.document[blockId];
  if (currentBlock?.type === 'Button') {
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

function handleInput(){
    if (!editableDiv.value || isInternalUpdate.value || !blockId) return;
    console.log('🟢 InlineHeadingEditor - handleInput disparado');
    isInternalUpdate.value = true;
    saveCursorPosition();

    const { text, formats } = processInlineContent(editableDiv.value)
    /* const text = editableDiv.value.textContent || "";  */
    const hasMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(text); 
    const currentBlock = editorStore.document[blockId]; 
    const level = (currentBlock?.data as any)?.props?.level || "h2";

    updateBlockInStore(text, formats, hasMarkdownLinks);

    nextTick(() => {
        restoreCursorPosition();
        isInternalUpdate.value = false;
    })
}

function handleBlur(){
    setTimeout(() => {  
        isActivelyEditing.value = false;  
  }, 150);  
}

function handleFocus(){
    isActivelyEditing.value = true;

    if (editorStore.selectedBlockId !== blockId && blockId){
        editorStore.setSelectedBlockId(blockId)
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
    
    handleInput();
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

function handleKeydown(event: KeyboardEvent) {  
  // Ctrl + spacio → variables 
  if ((event.ctrlKey && event.code === "Space") || event.key === "@") {  
    event.preventDefault();  
    saveCursorPosition();
    toolbarRef.value?.openVariablesDropdown?.(); 
    return; 
  } 
}  

function handleToolbarAction(action: 'bold' | 'italic' | string) {
saveCursorPosition();  
  setTimeout(() => {  
    insertVariable(action);  
  }, 10);  
}

// ============================================  
// WATCHERS  
// ============================================  

watch(blockProps, (newProps, oldProps) => {
    if (!editableDiv.value || isInternalUpdate.value  || isActivelyEditing.value || !newProps)  return;

/* // Evitar actualizaciones innecesarias
    const oldText = oldProps?.text || '';
    const oldFormats = oldProps?.formats || [];
    const newText = newProps.text;
    const newFormats = newProps.formats || [];
    
    if (oldText === newText && JSON.stringify(oldFormats) === JSON.stringify(newFormats)) {
        return;
    }

    const htmlContent = textWithFormatsToHtml(newText, newFormats); */

    /* if (editableDiv.value.innerHTML !== htmlContent){
            const wasFocused = document.activeElement === editableDiv.value;
            if (wasFocused) saveCursorPosition();
    
            editableDiv.value.innerHTML = htmlContent;
    
            if (wasFocused){
                nextTick(() => restoreCursorPosition());
            }
        } */

    const oldText = oldProps?.text || '';  
    const newText = newProps.text;  
      
    // ✅ Solo comparar texto  
    if (oldText === newText) {  
        return;  
    }


    if (editableDiv.value.innerHTML !== newText){
        const wasFocused = document.activeElement === editableDiv.value;
        if (wasFocused) saveCursorPosition();

        editableDiv.value.innerHTML = newText;

        if (wasFocused){
            nextTick(() => restoreCursorPosition());
        }
    }
}, { deep: true, immediate: true })

// ============================================  
// LIFECYCLE  
// ============================================  
  
onMounted(() => {
    if (!editableDiv.value || !blockId) return;

    const block = currentBlock.value;
    if (!block) return;
    
    const blockData = block.data as { props?: ButtonBlockProps; styles?: any}
    
    const text = blockData.props?.text || "";
    /* const formats = blockData.props?.formats || [];
    const htmlContent = textWithFormatsToHtml(text, formats);  */


    editableDiv.value.innerHTML = text;
})

</script>

<style scoped>
/* 🔥 Estilos para la etiqueta de debug */
.debug-label {
  position: absolute;
  top: 0;
  left: 0;
  background-color: blue;
  color: white;
  font-family: monospace;
  font-size: 10px;
  padding: 1px 4px;
  z-index: 9999;
  pointer-events: none;
  white-space: nowrap;
  opacity: 0.8;
}
</style>