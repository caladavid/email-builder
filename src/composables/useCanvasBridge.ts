import { ref } from 'vue';

const _iframeRef = ref<HTMLIFrameElement | null>(null);

export function registerCanvasIframe(el: HTMLIFrameElement | null) {
  _iframeRef.value = el;
}

export function sendToCanvas(cmd: Record<string, unknown>) {
  _iframeRef.value?.contentWindow?.postMessage(cmd, '*');
}

export function useCanvasBridge() {
  return { sendToCanvas };
}
