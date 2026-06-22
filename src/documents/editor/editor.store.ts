/* import { HTMLToBlockParser } from "../../App/TemplatePanel/ImportJson/htmlParser"; */

import getConfiguration from "../../getConfiguration";
import { isOriginAllowed } from "../../utils/allowedOrigins";
import { HTMLToBlockParser } from "../../utils/parsers/HTMLToBlockParser";
import type { TEditorConfiguration } from "./core";
import { defineStore } from "pinia";
import { computed, nextTick, onScopeDispose, ref, render } from "vue";

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
  authToken: string | null;
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

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://dos.multinetlabs.com';
/* const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://services.celcom.cl'; */

export const useInspectorDrawer = defineStore('inspectorDrawer', () => {
  const document = ref<TValue['document']>(getConfiguration(typeof window !== 'undefined' ? window.location.hash : ''))
  const selectedBlockId = ref<TValue['selectedBlockId']>(null)
  const selectedSidebarTab = ref<TValue['selectedSidebarTab']>('styles')
  const selectedMainTab = ref<TValue['selectedMainTab']>('editor')
  const selectedScreenSize = ref<TValue['selectedScreenSize']>('desktop')
  const inspectorDrawerOpen = ref<TValue['inspectorDrawerOpen']>(false)
  const INSPECTOR_DRAWER_WIDTH = computed(() => {  
    if (viewportWidth.value < 1270) {  // breakpoint md de Tailwind  
      return 220  // w-32  
    }  
    return 300   // w-60  
  })
  const SAMPLES_DRAWER_WIDTH = computed(() => {  
    if (viewportWidth.value < 1270) {  // breakpoint md de Tailwind  
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
  const authToken = ref<string | null>(null);
  let debounceTimer: NodeJS.Timeout | null = null;

  // ── IFRAME CANVAS STATE ──────────────────────────────────────────────────
  const rawHtml = ref<string>('');
  const htmlHistory = ref<string[]>([]);
  const htmlHistoryIndex = ref<number>(-1);
  const selectedElementPath = ref<string | null>(null);
  const selectedElementStyles = ref<Record<string, string>>({});
  const selectedElementAttrs = ref<Record<string, string>>({});
  const selectedElementTagName = ref<string>('');
  const selectedElementInnerText = ref<string>('');
  const selectedElementChildData = ref<Record<string, string> | null>(null);
  const htmlClipboard = ref<string>('');
  const draggedHtml = ref<string>('');
  // ────────────────────────────────────────────────────────────────────────

  /* const globalVariables = ref<TValue['globalVariables']>(loadVariablesFromStorage()); */
  // Limpiar variables
  const globalVariables = ref<TValue['globalVariables']>({}); 

  function initializeGlobalVariables(variables: Record<string, string>) {
    /* const merged = { ...loadVariablesFromStorage(), ...variables }
    globalVariables.value = merged
    saveVariablesToStorage(merged) */
    globalVariables.value = variables  
    saveVariablesToStorage(variables)
  }

  // Origin del padre capturado del primer mensaje válido
  let parentOrigin: string | null = null;

  // Escuchar mensajes de la aplicación padre
  const handleMessage = (event: MessageEvent) => {
    if (!isOriginAllowed(event.origin)) return;

    // Only capture parent origin from cross-origin messages.
    // Same-origin messages (Vite HMR, canvas bridge, etc.) must not overwrite it.
    if (!parentOrigin && event.origin !== window.location.origin) {
      parentOrigin = event.origin;
    }

    const data = event.data as TReceivedMessage;

    if (data.type === 'loadDocument') {
      if (data.html) {
        importRawHtml(data.html);
      } else if (data.document) {
        resetDocument(data.document);
      }
      if (data.variables) {
        receivedVariables.value = data.variables;
      }
    }
  };

  const handleResize = () => { viewportWidth.value = window.innerWidth; };

  window.addEventListener('message', handleMessage);
  window.addEventListener('resize', handleResize);

  onScopeDispose(() => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('resize', handleResize);
  });

  if (window.parent !== window) {
    const target = import.meta.env.VITE_PARENT_ORIGIN ?? '*';
    window.parent.postMessage({ type: 'iframeReady' }, target);
  }

  // Función para enviar datos a la aplicación padre
  function sendToParent(data: TReceivedMessage) {
    if (!window.parent || window.parent === window) return;
    // Priority: 1) captured from first cross-origin message, 2) env var, 3) drop (never '*')
    const target = parentOrigin ?? import.meta.env.VITE_PARENT_ORIGIN ?? null;
    if (!target) return;
    window.parent.postMessage(data, target);
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
    // Exit iframe mode — switch back to block editor
    rawHtml.value = '';
    htmlHistory.value = [];
    htmlHistoryIndex.value = -1;
    selectedElementPath.value = null;
    selectedElementStyles.value = {};
    selectedElementAttrs.value = {};
    selectedElementTagName.value = '';
    selectedElementInnerText.value = '';
    selectedElementChildData.value = null;

    document.value = newDocument;
    selectedSidebarTab.value = 'styles';
    selectedBlockId.value = null;

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
    // En modo iframe, el rawHtml ya es el HTML final 1:1
    if (rawHtml.value) return rawHtml.value;

    const { default: renderToStaticMarkup } = await import("../../lib/email-builder/renderers/renderToStaticMarkup");
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
      json: jsonContent
    })

  }

  async function exportHtmlAndJsonToParent() {
    const html = await getHtmlFromDocument();
    // json must always be valid JSON so wrappers can JSON.parse() it.
    // In iframe mode: wrap rawHtml in a JSON envelope { mode:'iframe', rawHtml }
    //   → parent can restore via loadTemplate({ mode:'iframe', rawHtml })
    // In block mode: standard block document JSON
    const jsonContent = rawHtml.value
      ? JSON.stringify({ mode: 'iframe', rawHtml: rawHtml.value })
      : JSON.stringify(document.value, null, 2);

    sendToParent({
      type: 'htmlAndJsonResponse',
      html,
      json: jsonContent
    });
  }

  async function loadTemplateFromParent(template: TEditorConfiguration) {
    const t = template as any;

    // Detect iframe-mode envelope saved by exportHtmlAndJsonToParent
    if (t.mode === 'iframe' && typeof t.rawHtml === 'string') {
      importRawHtml(t.rawHtml);
      inspectorDrawerOpen.value = true;
      return;
    }

    // Block mode: standard block document
    resetDocument(template);
    await convertAllBase64Images(template);
    inspectorDrawerOpen.value = true;

    const rootBlock = template['root'];
    if (rootBlock && rootBlock.type === 'EmailLayout' && rootBlock.data.childrenIds?.length > 0) {
      const firstChildId = rootBlock.data.childrenIds[0];
      nextTick(() => { setSelectedBlockId(firstChildId); });
    }
  }

  function setAuthToken(token: string){
    authToken.value = token;
    /* console.log('📊 Valor actual de authToken:', authToken.value);  */ 
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

  async function sendZip(file: File) {
    try {
      const token = authToken.value
      
      if (!token){
        console.error('❌ No hay token disponible');  
        return;  
      }

      const formData = new FormData()
      formData.append('TOKEN', token)
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE}/sms_services/rest/protected/flex_email/addFileZip`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok){
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();

      if (result.response === "200") {
        let htmlContent = result.data;
        if (!htmlContent || typeof htmlContent !== 'string') {
          console.error('❌ Respuesta inválida del servidor ZIP: data vacío');
          return;
        }

        // 1. FIX: Corregir etiquetas <img src="..."> (Tu solución)
        htmlContent = htmlContent.replace(/src="images\/(https?:\/\/)/g, 'src="$1');

        // 2. FIX: Corregir estilos background-image: url('...')
        // El HTML que enviaste usa comillas simples dentro de url()
        htmlContent = htmlContent.replace(/url\('images\/(https?:\/\/)/g, "url('$1");
        
        // Opcional: Si a veces viene con comillas dobles en el CSS
        htmlContent = htmlContent.replace(/url\("images\/(https?:\/\/)/g, 'url("$1');
        
        // Modo iframe: cargar HTML directo sin parsear a bloques
        importRawHtml(htmlContent);
        console.log('✅ ZIP importado como HTML directo (modo iframe)');
      } else {  
        console.error('❌ Error procesando ZIP:', result);  
      }  

    } catch (error) {
      console.error('❌ Error en sendZip:', error);  
    }
  }

  async function uploadImage(file: File): Promise<string | null>{  
    try {  
      const token = authToken.value;  

      if (!token) {  
        console.error('❌ No hay token disponible');  
        return null;  
      }  
      
      const formData = new FormData();
      formData.append('TOKEN', token);
      formData.append('image', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE}/rest/protected/flex_email/addFileImage`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();

      if (result.response === "200") {
        const imageUrl = result.data;
        if (!imageUrl || typeof imageUrl !== 'string') {
          console.error('❌ Respuesta inválida del servidor imagen: data vacío');
          return null;
        }
        console.log('✅ Imagen subida:', imageUrl);
        return imageUrl;
      } else {
        console.error('❌ Error del backend:', result.message);
        return null;
      }

    } catch (error) {  
      console.error('❌ Error subiendo imagen:', error);  
      return null;  
    }  
  }

  async function convertBase64ToService(base64Url: string): Promise<string> {
    try {
      
      if (!base64Url.startsWith("data:image/")){
        return base64Url;
      }

      const response = await fetch(base64Url);
      const blob = await response.blob();
      const file = new File([blob], 'image.png', { type: blob.type });

      const serviceUrl = await uploadImage(file);

      if (serviceUrl) return serviceUrl;

      return base64Url;

    } catch (error) {
      console.error('❌ Error convirtiendo base64:', error);  
      return base64Url;
    }
  }

  // ── IFRAME CANVAS FUNCTIONS ──────────────────────────────────────────────

  function importRawHtml(html: string) {
    rawHtml.value = html;
    selectedElementPath.value = null;
    selectedElementStyles.value = {};
    selectedElementAttrs.value = {};
    selectedElementTagName.value = '';
    selectedElementInnerText.value = '';
    selectedElementChildData.value = null;
    htmlHistory.value = [html];
    htmlHistoryIndex.value = 0;
  }

  function saveHtmlSnapshot(html: string) {
    if (htmlHistoryIndex.value < htmlHistory.value.length - 1) {
      htmlHistory.value = htmlHistory.value.slice(0, htmlHistoryIndex.value + 1);
    }
    htmlHistory.value.push(html);
    htmlHistoryIndex.value++;
    if (htmlHistory.value.length > 50) {
      htmlHistory.value.shift();
      htmlHistoryIndex.value--;
    }
    rawHtml.value = html;
  }

  function undoHtml() {
    if (htmlHistoryIndex.value > 0) {
      htmlHistoryIndex.value--;
      rawHtml.value = htmlHistory.value[htmlHistoryIndex.value];
    }
  }

  function redoHtml() {
    if (htmlHistoryIndex.value < htmlHistory.value.length - 1) {
      htmlHistoryIndex.value++;
      rawHtml.value = htmlHistory.value[htmlHistoryIndex.value];
    }
  }

  function canUndoHtml(): boolean {
    return htmlHistoryIndex.value > 0;
  }

  function canRedoHtml(): boolean {
    return htmlHistoryIndex.value < htmlHistory.value.length - 1;
  }

  function clearRawHtml() {
    rawHtml.value = '';
    htmlHistory.value = [];
    htmlHistoryIndex.value = -1;
    selectedElementPath.value = null;
    selectedElementStyles.value = {};
    selectedElementAttrs.value = {};
    selectedElementTagName.value = '';
    selectedElementInnerText.value = '';
    selectedElementChildData.value = null;
  }

  // ────────────────────────────────────────────────────────────────────────

  async function convertAllBase64Images(config: TEditorConfiguration) {
    const conversions: Promise<void>[] = [];

    for (const blockId in config) {
      const block = config[blockId];

      if (block.type === 'Image' && block.data.props?.url?.startsWith('data:image/')) {
        conversions.push(
          convertBase64ToService(block.data.props.url).then(convertedUrl => {
            if (convertedUrl !== block.data.props.url) {
              block.data.props.url = convertedUrl;
            }
          })
        );
      }

      if (block.type === 'Avatar' && block.data.props?.imageUrl?.startsWith('data:image/')) {
        conversions.push(
          convertBase64ToService(block.data.props.imageUrl).then(convertedUrl => {
            if (convertedUrl !== block.data.props.imageUrl) {
              block.data.props.imageUrl = convertedUrl;
            }
          })
        );
      }
    }

    await Promise.all(conversions);
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
    authToken,
    setAuthToken,
    sendZip,
    getHtmlFromDocument,
    uploadImage,
    convertBase64ToService,
    // iframe canvas
    rawHtml,
    htmlHistory,
    htmlHistoryIndex,
    selectedElementPath,
    selectedElementStyles,
    selectedElementAttrs,
    selectedElementTagName,
    selectedElementInnerText,
    selectedElementChildData,
    htmlClipboard,
    draggedHtml,
    importRawHtml,
    saveHtmlSnapshot,
    undoHtml,
    redoHtml,
    canUndoHtml,
    canRedoHtml,
    clearRawHtml,
  }
});