import getConfiguration from "../../getConfiguration";
import { isOriginAllowed } from "../../utils/allowedOrigins";
import type { TEditorConfiguration } from "./core";
import { defineStore } from "pinia";
import { nextTick, ref, render } from "vue";

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
  const INSPECTOR_DRAWER_WIDTH = 335
  const SAMPLES_DRAWER_WIDTH = 240
  const receivedVariables = ref<{ [key: string]: any } | null>(null); // Variable para guardar los datos
  const samplesDrawerOpen = ref<boolean>(false);

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

  function setSelectedBlockId(blockId: TValue['selectedBlockId']) {
    const tab = blockId === null ? 'styles' : 'block-configuration'
    if (blockId !== null) {
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
  }

  // Agregar función para recibir variables individuales  
  function addVariableFromParent(key: string, value: string) {
    // Limpiar llaves de los valores si existen  
    const cleanValue = value.replace(/^{+|}+$/g, '');  

    const newVariables = {
      ...globalVariables.value,
      [key]: cleanValue
    }
    setGlobalVariables(newVariables)
  }

  // Función para recibir múltiples variables  
  function receiveVariablesFromParent(variables: Record<string, string>) {
    const mergedVariables = {
      ...globalVariables.value,
      ...variables
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

    const proccessedDocument = createProcessedDocument(
      document.value,
      globalVariables.value
    )

    const html = await renderToStaticMarkup(proccessedDocument, { rootBlockId: 'root' })
    const jsonContent = JSON.stringify(proccessedDocument, null, 2);

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
  }
});