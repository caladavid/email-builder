<template>                    
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
                  
  <UPopover v-model:open="showVariablesDropdown" :ui="{ width: 'w-64' }">                      
    <template #content>                      
      <div class="max-h-64 overflow-y-auto p-2">                      
        <div                       
          v-for="(item, index) in variableItems"                       
          :key="index"                       
          @click="insertVariable(item.key)"                       
          class="flex items-center gap-2 p-2 hover:bg-[var(--ui-primary)] hover:text-white cursor-pointer rounded"                      
        >                      
          <span>{{ item.key }}</span>                      
        </div>                      
        <div v-if="variableItems.length === 0" class="px-3 py-2 text-gray-500">                          
          No hay variables disponibles                          
        </div>                          
      </div>                      
    </template>                      
  </UPopover>                       
</template>                    
                  
<script setup lang="ts">    
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';    
import { useInspectorDrawer } from '../../editor/editor.store';    
import { currentBlockIdSymbol } from '../../editor/EditorBlock.vue';
    
// Definir tipos para los formatos
interface TextFormat {
  start: number;
  end: number;
  bold?: boolean;
}

interface TextBlockProps {
  text: string;
  formats?: TextFormat[];
  markdown?: boolean;
}

interface ButtonBlockProps {
  text: string;
  url?: string;
  // otras props específicas de Button...
}

interface HeadingBlockProps {
  text: string;
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  // otras props específicas de Heading...
}

type BlockProps = TextBlockProps | ButtonBlockProps | HeadingBlockProps;

// Tipo para el bloque actual
interface CurrentBlock {
  type: string;
  data: {
    props: BlockProps;
    style?: Record<string, any>;
  };
}

interface TextFormat {
  start: number;
  end: number;
  bold?: boolean;
}

const props = defineProps<{    
  text: string;    
  style?: Record<string, any>;    
}>();    
    
const emit = defineEmits<{    
  (e: 'update:text', value: string): void    
}>();    
    
const editorStore = useInspectorDrawer();    
const editableDiv = ref<HTMLDivElement | null>(null);    
const showVariablesDropdown = ref(false);    
const lastCursorPosition = ref(0);    
const isInternalUpdate = ref(false);    
let updateTimer: ReturnType<typeof setTimeout> | null = null;
const blockId = inject(currentBlockIdSymbol);
const isUserInteracting = ref(false);  
    
const variableItems = computed(() => {    
  return Object.entries(editorStore.globalVariables || {}).map(    
    ([key, value]) => ({ key, value })    
  );    
});    
  
function processInlineContent(element: HTMLElement): { text: string; formats: any[] } {  
  let text = "";  
  const formats: any[] = [];  
  let pos = 0;  
  
  const append = (t: string) => {  
    if (!t) return;  
    text += t;  
    pos += t.length;  
  };  
  
  const inlineTags = new Set(["strong", "b", "em", "i", "u", "a", "span", "small", "sup", "sub", "br"]);  
  
  Array.from(element.childNodes).forEach((node) => {  
    if (node.nodeType === Node.TEXT_NODE) {  
      append((node.textContent || "").replace(/\s+/g, " "));  
      return;  
    }  
  
    if (node.nodeType === Node.ELEMENT_NODE) {  
      const el = node as HTMLElement;  
      const tag = el.tagName.toLowerCase();  
  
      if (!inlineTags.has(tag)) return;  
  
      if (tag === "br") {  
        append("\n");  
        return;  
      }  
  
      if ((tag === "strong" || tag === "b") && el.querySelector("a")) {  
        const link = el.querySelector("a");  
        if (link) {  
          const href = link.getAttribute("href") || "";  
          const linkText = link.textContent?.trim() || "";  
          if (href && linkText) {  
            append(`**[${linkText}](${href})**`);  
            return;  
          }  
        }  
      }  
  
      if (tag === "a") {  
        const href = el.getAttribute("href") || "";  
        const linkText = el.textContent?.trim() || "";  
        if (href && linkText) {  
          append(`[${linkText}](${href})`);  
          return;  
        }  
      }  
  
      const childRes = processInlineContent(el);  
  
      if (childRes.text.length) {  
        const start = pos;  
        append(childRes.text);  
  
        const fmt: any = { start, end: start + childRes.text.length };  
  
        const computedStyle = window.getComputedStyle(el);  
        const fw = computedStyle.fontWeight;  
        const isBoldTag = tag === "strong" || tag === "b";  
        const isBoldStyle = fw === "bold" || (!isNaN(parseInt(fw)) && parseInt(fw) >= 600);  
        if (isBoldTag || isBoldStyle) fmt.bold = true;  
  
        formats.push(fmt);  
      }  
    }  
  });  
  
  text = text.replace(/[ \t]+\n/g, "\n").trimEnd();  
  return { text: text.trim(), formats };  
}  
  
/* function textWithFormatsToHtml(text: string, formats: any[]): string {  
  if (!formats || formats.length === 0) {  
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');  
  }  
  
  let html = "";  
  let lastPos = 0;  
  
  const sortedFormats = [...formats].sort((a, b) => a.start - b.start);  
  
  sortedFormats.forEach((fmt) => {  
    if (fmt.start > lastPos) {  
      const plainText = text.substring(lastPos, fmt.start);  
      html += plainText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');  
    }  
  
    let formattedText = text.substring(fmt.start, fmt.end);  
    formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');  
  
    if (fmt.bold) {  
      html += `<strong>${formattedText}</strong>`;  
    } else {  
      html += formattedText;  
    }  
  
    lastPos = fmt.end;  
  });  
  
  if (lastPos < text.length) {  
    const remainingText = text.substring(lastPos);  
    html += remainingText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');  
  }  
  
  return html;  
} */  
  
function textWithFormatsToHtml(text: string, formats: any[]): string {  
  let result = text;  
    
  // Primero aplicar formatos de negritas  
  const sortedFormats = [...formats].sort((a, b) => b.start - a.start);  
    
  sortedFormats.forEach(fmt => {  
    if (fmt.bold) {  
      const before = result.substring(0, fmt.start);  
      const content = result.substring(fmt.start, fmt.end);  
      const after = result.substring(fmt.end);  
        
      // Si el contenido tiene markdown de enlaces, envolver todo  
      if (/\[([^\]]+)\]\(([^)]+)\)/.test(content)) {  
        result = before + '**' + content + '**' + after;  
      } else {  
        result = before + '<strong>' + content + '</strong>' + after;  
      }  
    }  
  });  
    
  // Luego convertir markdown a HTML  
  // Manejar **[texto](url)** -> <strong><a>texto</a></strong>  
  result = result.replace(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g, '<strong><a href="$2">$1</a></strong>');  
    
  // Manejar [texto](url) -> <a>texto</a>  
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');  
    
  return result;  
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
  
watch(() => props.text, (newText) => {  
  if (isInternalUpdate.value) return;  
  
  if (editableDiv.value && editableDiv.value.innerHTML !== newText) {  
    isInternalUpdate.value = true;  
    saveCursorPosition();  

    if (!blockId) return;
  
    const currentBlock = editorStore.document[blockId]; 
    const formats = (currentBlock?.data?.props as TextBlockProps)?.formats || [];  
    const htmlContent = textWithFormatsToHtml(newText, formats);  
  
    editableDiv.value.innerHTML = htmlContent;  
  
    nextTick(() => {  
      restoreCursorPosition();  
      setTimeout(() => {  
        isInternalUpdate.value = false;  
      }, 50);  
    });  
  }  
});  
  
function handleInput() {  
  if (!editableDiv.value) return;  
    
  // Solo procesar input si este bloque está seleccionado  
  if (editorStore.selectedBlockId !== blockId) {  
    return;  
  }  
    
  saveCursorPosition();  
    
  const newText = editableDiv.value.textContent || "";  
  updateBlockText(newText);  
}  

function updateBlockText(newText: string) {  
  if (!blockId) return;  
    
  const currentBlock = editorStore.document[blockId];  
  if (!currentBlock) return;  
    
  // Verificar que es un bloque de tipo Text  
  if (currentBlock.type !== 'Text') return;  
    
  editorStore.setDocument({  
    [blockId]: {  
      ...currentBlock,  
      data: {  
        ...currentBlock.data,  
        props: {  
          ...currentBlock.data.props,  
          text: newText  
        }  
      }  
    }  
  });  
}

function handleBlur() {  
  isUserInteracting.value = false;  
  saveCursorPosition();  
} 
  
function handleFocus(event: FocusEvent) {  
  // Solo actualizar selectedBlockId si el usuario hizo clic directamente  
  if (event.target === editableDiv.value) {  
    isUserInteracting.value = true;  
    editorStore.setSelectedBlockId(blockId ?? null);  
    saveCursorPosition();  
  }  
} 
  
function insertVariable(variableKey: string) {  
  if (!editableDiv.value) return;  
  
  saveCursorPosition();  
  
  const selection = window.getSelection();  
  if (!selection || selection.rangeCount === 0) return;  
  
  const range = selection.getRangeAt(0);  
  const variableText = `{${variableKey}}`;  
  const textNode = document.createTextNode(variableText);  
  
  range.deleteContents();  
  range.insertNode(textNode);  
  
  range.setStartAfter(textNode);  
  range.collapse(true);  
  selection.removeAllRanges();  
  selection.addRange(range);  
  
  lastCursorPosition.value += variableText.length;  
  
  showVariablesDropdown.value = false;  
  
  if (editableDiv.value) {  
    const { text, formats } = processInlineContent(editableDiv.value);  
    updateBlockTextWithFormats(text, formats);  
  }  
}  
  
function handleKeydown(event: KeyboardEvent) {  
  if (event.ctrlKey && event.code === "Space") {  
    event.preventDefault();  
    saveCursorPosition();  
    showVariablesDropdown.value = true;  
  }  
  
  if (event.key === "Escape") {  
    showVariablesDropdown.value = false;  
  }  
}  
  
function updateBlockTextWithFormats(newText: string, formats: any[]) {  
  if (!blockId) return;
  const currentBlock = editorStore.document[blockId];  
  
  if (!currentBlock) return;  
  
  if (currentBlock.type === 'Text' ||  
      currentBlock.type === 'Heading' ||  
      currentBlock.type === 'Button') {  
  
    saveCursorPosition();  
  
    editorStore.setDocument({  
      [blockId]: {  
        ...currentBlock,  
        data: {  
          ...currentBlock.data,  
          props: {  
            ...currentBlock.data.props,  
            text: newText,  
            ...(currentBlock.type === "Text" && {
              formats: formats,  
              markdown: /\[([^\]]+)\]\(([^)]+)\)/.test(newText)
            })  
          }  
        }  
      }  
    });  
  
    nextTick(() => {  
      restoreCursorPosition();  
    });  
  
    emit('update:text', newText);  
  }  
}  

function handleMouseDown(event: MouseEvent) {  
  // Marcar que el usuario está interactuando directamente  
  isUserInteracting.value = true;  
    
  // Prevenir que el evento se propague y cause selección múltiple  
  event.stopPropagation();  
}

  
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
    padding: props.style?.padding ?  
      `${props.style.padding.top}px ${props.style.padding.right}px ${props.style.padding.bottom}px ${props.style.padding.left}px` :  
      '16px 24px',  
    fontFamily: mappedFontFamily,  
    fontSize: props.style?.fontSize ? `${props.style.fontSize}px` : 'inherit',  
    fontWeight: props.style?.fontWeight || 'normal',  
    textAlign: props.style?.textAlign || 'left',  
    color: props.style?.color || 'inherit',  
    backgroundColor: props.style?.backgroundColor || 'transparent'  
  };  
});  
  
// Watch para actualizar contenido cuando cambia props.text  
watch(() => props.text, (newText) => {  
  if (isInternalUpdate.value || !editableDiv.value) return;  
    
  isInternalUpdate.value = true;  
  saveCursorPosition();  

   if (!blockId) return;
    
  const currentBlock = editorStore.document[blockId];  
  
  const formats = currentBlock?.data?.props?.formats || [];  
  const markdown = currentBlock?.data?.props?.markdown || false;  
    
  // Si markdown está activado, convertir a HTML  
  if (markdown && /\[([^\]]+)\]\(([^)]+)\)/.test(newText)) {  
    const htmlContent = textWithFormatsToHtml(newText, formats);  
    editableDiv.value.innerHTML = htmlContent;  
  } else {  
    editableDiv.value.textContent = newText;  
  }  
    
  nextTick(() => {  
    restoreCursorPosition();  
    setTimeout(() => {  
      isInternalUpdate.value = false;  
    }, 50);  
  });  
});
  

onMounted(() => {  
  if (editableDiv.value && props.text) { 
    if (!blockId) return;

    const currentBlock = editorStore.document[blockId];  
    const formats = currentBlock?.data?.props?.formats || [];  
    const markdown = currentBlock?.data?.props?.markdown || false;  
      
    // Si markdown está activado, convertir enlaces markdown a HTML  
    if (markdown) {  
      const htmlContent = textWithFormatsToHtml(props.text, formats);  
      editableDiv.value.innerHTML = htmlContent;  
    } else {  
      editableDiv.value.textContent = props.text;  
    }  
  }  
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