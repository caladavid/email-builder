// Origins allowed to drive the builder via postMessage (loadDocument,
// loadTemplate, setToken, requestHtml...). Only the parent apps that embed the
// builder belong here:
// - never the builder's own origins (email-builder.*): the canvas iframe is
//   same-origin, so listing them let canvas content pass every check;
// - never plain http (a network attacker can spoof it).
// Extra origins can be added per deploy with VITE_ALLOWED_ORIGINS
// (comma-separated); VITE_PARENT_ORIGIN is always included.
const PARENT_ORIGINS = [
  'https://flex.celcomlatam.com',
  'https://flex.multinetlabs.com',
] as const;

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

function envOrigins(): string[] {
  const extra = String(import.meta.env.VITE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const parent = String(import.meta.env.VITE_PARENT_ORIGIN ?? '').trim();
  return parent ? [...extra, parent] : extra;
}

export const ALLOWED_ORIGINS: readonly string[] = Array.from(new Set([
  ...PARENT_ORIGINS,
  ...envOrigins(),
  ...(import.meta.env.PROD ? [] : DEV_ORIGINS),
])).filter((o) => !import.meta.env.PROD || o.startsWith('https://'));

export function isOriginAllowed(origin: unknown): boolean {
  if (typeof origin !== 'string') return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * True when a message really comes from the window that embeds the builder:
 * allowed origin AND sent by window.parent. The origin check alone isn't
 * enough: any other window on an allowed origin (or a frame inside the
 * builder) could otherwise send setToken/loadTemplate.
 */
export function isFromParent(event: MessageEvent): boolean {
  return isOriginAllowed(event.origin) && event.source === window.parent;
}
