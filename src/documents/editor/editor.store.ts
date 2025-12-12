import getConfiguration from "../../getConfiguration";
import { isOriginAllowed } from "../../utils/allowedOrigins";
import type { TEditorConfiguration } from "./core";
import { defineStore } from "pinia";
import { computed, nextTick, ref, render } from "vue";

// Nuevos tipos para los mensajes recibidos
type TReceivedMessage = {
  type: string;
  document?: TEditorConfiguration;
  variables?: { [key: string]: any }; // Tipo para las variables
  html?: string;
  template?: TEditorConfiguration;
  json?: string
};

type TValue = {
  document: TEditorConfiguration;
  selectedBlockId: string | null;
  selectedSidebarTab: 'block-configuration' | 'styles';
  selectedMainTab: 'editor' | 'preview' | 'json' | 'html';
  selectedScreenSize: 'desktop' | 'mobile';
  inspectorDrawerOpen: boolean;
  INSPECTOR_DRAWER_WIDTH: number;
  samplesDrawerOpen: boolean;

  globalVariables: Record<string, string>;
  history: TEditorConfiguration[]; // Array de estados anteriores  
  historyIndex: number; // Posición actual en el historial 
  maxHistorySize: number;  // Límite de tamaño del historial
};

const STORAGE_KEY = 'email-builder-variables'

function loadVariablesFromStorage(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveVariablesToStorage(variables: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(variables))
  } catch (error) {
    console.error('Error saving variables to localStorage:', error)
  }
}

export const useInspectorDrawer = defineStore('inspectorDrawer', () => {
  const document = ref<TValue['document']>(getConfiguration(typeof window !== 'undefined' ? window.location.hash : ''))
  const selectedBlockId = ref<TValue['selectedBlockId']>(null)
  const selectedSidebarTab = ref<TValue['selectedSidebarTab']>('styles')
  const selectedMainTab = ref<TValue['selectedMainTab']>('editor')
  const selectedScreenSize = ref<TValue['selectedScreenSize']>('desktop')
  const inspectorDrawerOpen = ref<TValue['inspectorDrawerOpen']>(false)
  const INSPECTOR_DRAWER_WIDTH = computed(() => {  
    if (viewportWidth.value < 840) {  // breakpoint md de Tailwind  
      return 220  // w-32  
    }  
    return 300   // w-60  
  })
  const SAMPLES_DRAWER_WIDTH = computed(() => {  
    if (viewportWidth.value < 840) {  // breakpoint md de Tailwind  
      return 160  // w-32  
    }  
    return 240   // w-60  
  })
  const receivedVariables = ref<{ [key: string]: any } | null>(null); // Variable para guardar los datos
  const samplesDrawerOpen = ref<boolean>(true);
  const viewportWidth = ref(window.innerWidth)  
  const history = ref<TEditorConfiguration[]>([]);
  const historyIndex = ref<number>(-1);
  const maxHistorySize = ref<number>(50);
  let debounceTimer: NodeJS.Timeout | null = null;

  /* const globalVariables = ref<TValue['globalVariables']>(loadVariablesFromStorage()); */
  const globalVariables = ref<TValue['globalVariables']>({}); 

  function initializeGlobalVariables(variables: Record<string, string>) {
    /* const merged = { ...loadVariablesFromStorage(), ...variables }
    globalVariables.value = merged
    saveVariablesToStorage(merged) */
    globalVariables.value = variables  
    saveVariablesToStorage(variables)
  }

  // Escuchar mensajes de la aplicación padre
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
      // Verificar origen por seguridad
      /* if (event.origin !== 'http://localhost:3000' && event.origin !== 'http://email-builder.multinetlabs.com/' && event.origin !== "http://localhost:5173") return // Tu app principal */

      if (!isOriginAllowed(event.origin)) {
        return;
      }

      const data = event.data as TReceivedMessage; // Casteo de tipo

      // Manejar diferentes tipos de mensajes
      if (data.type === 'loadDocument') {
        if (data.document) {
          resetDocument(data.document);
        }
        if (data.variables) {
          receivedVariables.value = data.variables;
          // Muestra las variables en la consola para verificar que se recibieron
          console.log('Variables recibidas desde la app principal:', data.variables);
        }
      }
    })
  }

  // Función para enviar datos a la aplicación padre
  function sendToParent(data: TReceivedMessage) {
    if (window.parent) {
      window.parent.postMessage(data, '*');
    }
  }

  function setGlobalVariables(variables: Record<string, string>) {
    globalVariables.value = variables
    saveVariablesToStorage(variables)
  }

  function setSelectedBlockId(blockId: TValue['selectedBlockId'], openDrawer = true) {
    const tab = blockId === null ? 'styles' : 'block-configuration'
/*     if (blockId !== null) {
      inspectorDrawerOpen.value = true
    } */
    if (blockId !== null && openDrawer) {  
      inspectorDrawerOpen.value = true  
    }  
    selectedBlockId.value = blockId
    selectedSidebarTab.value = tab
  }

  function setDocument(newDocument: TValue['document']) {
    const originalDocument = document.value
    document.value = {
      ...originalDocument,
      ...newDocument,
    }
  }

  function resetDocument(newDocument: TValue['document']) {
    document.value = newDocument
    selectedSidebarTab.value = 'styles'
    selectedBlockId.value = null

    // Limpiar variables globales  
    globalVariables.value = {}  
    saveVariablesToStorage({})

    // Inicializar historial con el primer estado  
    history.value = [JSON.parse(JSON.stringify(newDocument))];  
    historyIndex.value = 0;  
  }

  // Agregar función para recibir variables individuales  
  function addVariableFromParent(key: string, value: string) {
    // Limpiar llaves de los valores si existen  
    const cleanKey = key.replace(/[{}]/g, '');  
    const cleanValue = value.replace(/[{}]/g, '');   

    const newVariables = {
      ...globalVariables.value,
      [cleanKey]: cleanValue
    }
    setGlobalVariables(newVariables)
  }

  // Función para recibir múltiples variables  
  function receiveVariablesFromParent(variables: Record<string, string>) {
    // Limpiar TODAS las llaves de keys y values  
    const cleanedVariables: Record<string, string> = {};  
      
    for (const [key, value] of Object.entries(variables)) {  
      const cleanKey = key.replace(/[{}]/g, '');  
      const cleanValue = value.replace(/[{}]/g, '');  
      cleanedVariables[cleanKey] = cleanValue;  
    } 

    const mergedVariables = {
      ...globalVariables.value,
      ...cleanedVariables
    }
    setGlobalVariables(mergedVariables)
  }

  function toggleSamplesDrawerOpen() {
    samplesDrawerOpen.value = !samplesDrawerOpen.value
  }

  async function getHtmlFromDocument(): Promise<string> {
    const { renderToStaticMarkup } = await import("@flyhub/email-builder");
    const { createProcessedDocument } = await import("../../utils/documentProcessor");

    const proccessedDocument = createProcessedDocument(
      document.value,
      globalVariables.value
    )

    const html = await renderToStaticMarkup(proccessedDocument, { rootBlockId: 'root' })

    return html;
  }

  async function sendHtmlToParent() {
    const htmlContent = await getHtmlFromDocument()

    sendToParent({
      type: 'htmlResponse',
      html: htmlContent
    })
  }

  async function exportJsonToParent() {
    const { createProcessedDocument } = await import("../../utils/documentProcessor");

    const processed = createProcessedDocument(
      document.value,
      globalVariables.value || {}
    );
    const jsonContent = JSON.stringify(processed, null, 2);

    sendToParent({
      type: 'jsonResponse',
      html: jsonContent
    })

  }

  async function exportHtmlAndJsonToParent() {
    const { renderToStaticMarkup } = await import("@flyhub/email-builder");
    const { createProcessedDocument } = await import("../../utils/documentProcessor");

    /* const proccessedDocument = createProcessedDocument(
      document.value,
      globalVariables.value
    ) */

    /* const html = await renderToStaticMarkup(proccessedDocument, { rootBlockId: 'root' }) */
    /* const jsonContent = JSON.stringify(proccessedDocument, null, 2); */
    const html = await renderToStaticMarkup(document.value, { rootBlockId: 'root' }) 
    const jsonContent = JSON.stringify(document.value, null, 2);

    sendToParent({
      type: 'htmlAndJsonResponse',
      html: html,
      json: jsonContent
    })
  }

  function loadTemplateFromParent(template: TEditorConfiguration) {
    // Usar resetDocument para reemplazar completamente el documento actual  
    resetDocument(template);

    // Abrir el inspector drawer para que el usuario vea que está en modo edición  
    inspectorDrawerOpen.value = true;

    const rootBlock = template['root'];

    if (rootBlock.type === 'EmailLayout' && rootBlock.data.childrenIds && rootBlock.data.childrenIds.length > 0) {
      // Seleccionar el primer bloque para indicar que está listo para editar
      const firstChildId = rootBlock.data.childrenIds[0];
      nextTick(() => {
        setSelectedBlockId(firstChildId)
      })
    }

  }

  
  function saveToHistory(){
      // Clonar el estado actual del documento  
      const currentState = JSON.parse(JSON.stringify(document.value));

      // Eliminar estados futuros si no estamos al final  
      if (historyIndex.value < history.value.length - 1){
          history.value = history.value.slice(0, historyIndex.value + 1)
      };

      // Agregar nuevo estado  
      history.value.push(currentState);
      historyIndex.value = history.value.length - 1;

      // Mantener límite del tamaño
      if (history.value.length > maxHistorySize.value){
          history.value.shift();
          historyIndex.value--;
      }
  }

  function debouncedSaveToHistory(){
    if (debounceTimer){
      clearTimeout(debounceTimer)
    };

    debounceTimer = setTimeout(() => {
      saveToHistory()
      debounceTimer = null;
    }, 300);
  }

  function undo(){
      if (canUndo()){
          historyIndex.value--;
          document.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
      }
  }
  
  function redo(){
      if (canRedo()){
          historyIndex.value++;
          document.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
      }
  }

  function canUndo(){
      return historyIndex.value > 0;
  }

  function canRedo(){
      return historyIndex.value < history.value.length - 1;
  }

  return {
    document,
    globalVariables,
    receivedVariables, // Retorna la variable para que otros componentes puedan acceder a ella
    selectedBlockId,
    selectedSidebarTab,
    selectedMainTab,
    selectedScreenSize,
    inspectorDrawerOpen,
    INSPECTOR_DRAWER_WIDTH,
    samplesDrawerOpen,
    SAMPLES_DRAWER_WIDTH,

    setSelectedBlockId,
    setDocument,
    resetDocument,
    sendToParent,
    setGlobalVariables,
    initializeGlobalVariables,
    receiveVariablesFromParent,
    addVariableFromParent,
    toggleSamplesDrawerOpen,
    sendHtmlToParent,
    loadTemplateFromParent,
    exportJsonToParent,
    exportHtmlAndJsonToParent,
    history,  
    historyIndex,  
    maxHistorySize,  
    saveToHistory,  
    debouncedSaveToHistory,
    undo,  
    redo,  
    canUndo,  
    canRedo,  
  }
});