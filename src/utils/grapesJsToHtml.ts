/* =========================================================
   ARCHIVO: grapesJsToHtml.ts
   Convierte un proyecto exportado de GrapesJS (formato distinto
   al Record<blockId,...> de este editor) a un string HTML plano,
   para poder cargarlo con importRawHtml() en vez de mostrar un
   canvas en blanco.
   ========================================================= */

type GrapesSelector = string | { name: string; private?: number };

interface GrapesStyleRule {
  selectors?: GrapesSelector[];
  style?: Record<string, string>;
}

interface GrapesComponent {
  type?: string;
  tagName?: string;
  content?: string;
  attributes?: Record<string, string>;
  classes?: GrapesSelector[];
  components?: GrapesComponent[];
  void?: boolean;
}

interface GrapesProject {
  assets?: unknown[];
  styles?: GrapesStyleRule[];
  pages?: Array<{ frames?: Array<{ component?: GrapesComponent }> }>;
  symbols?: unknown[];
}

/** Heurística: es un proyecto GrapesJS (no el Record<blockId,...> de este editor) */
export function isGrapesJsProject(doc: unknown): doc is GrapesProject {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Record<string, unknown>;
  return Array.isArray(d.pages) && !('root' in d);
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function selectorName(sel: GrapesSelector): string {
  return typeof sel === 'string' ? sel.replace(/^#/, '') : sel?.name ?? '';
}

function selectorIsId(sel: GrapesSelector): boolean {
  return typeof sel === 'string' && sel.startsWith('#');
}

function nodeMatchesRule(node: GrapesComponent, selectors: GrapesSelector[]): boolean {
  if (!selectors.length) return false;
  const classNames = (node.classes || []).map(selectorName);
  const id = node.attributes?.id;
  return selectors.every((sel) => (selectorIsId(sel) ? id === selectorName(sel) : classNames.includes(selectorName(sel))));
}

function stylesForNode(node: GrapesComponent, rules: GrapesStyleRule[]): Record<string, string> {
  let merged: Record<string, string> = {};
  for (const rule of rules) {
    if (nodeMatchesRule(node, rule.selectors || [])) {
      merged = { ...merged, ...(rule.style || {}) };
    }
  }
  return merged;
}

function defaultTagFor(node: GrapesComponent): string {
  if (node.tagName) return node.tagName;
  switch (node.type) {
    case 'image': return 'img';
    case 'link': return 'a';
    default: return 'div';
  }
}

function renderNode(node: GrapesComponent, rules: GrapesStyleRule[]): string {
  if (node.type === 'textnode') {
    return escapeHtml(node.content || '');
  }

  const tag = defaultTagFor(node);
  const classNames = (node.classes || []).map(selectorName).filter(Boolean);
  const style = stylesForNode(node, rules);

  const attrParts: string[] = [];
  for (const [key, value] of Object.entries(node.attributes || {})) {
    if (key === 'id' || value === undefined || value === null || value === '') continue;
    attrParts.push(`${key}="${escapeHtml(String(value))}"`);
  }
  if (classNames.length) attrParts.push(`class="${classNames.join(' ')}"`);
  const styleStr = Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
  if (styleStr) attrParts.push(`style="${escapeHtml(styleStr)}"`);

  const attrStr = attrParts.length ? ` ${attrParts.join(' ')}` : '';
  const isVoid = node.void === true || VOID_TAGS.has(tag);
  if (isVoid) return `<${tag}${attrStr}>`;

  const childrenHtml = (node.components || []).map((c) => renderNode(c, rules)).join('');
  return `<${tag}${attrStr}>${childrenHtml}</${tag}>`;
}

/** Convierte el proyecto GrapesJS completo a un documento HTML standalone */
export function grapesJsProjectToHtml(project: GrapesProject): string {
  const wrapper = project.pages?.[0]?.frames?.[0]?.component;
  if (!wrapper) return '';

  const rules = project.styles || [];
  const bodyHtml = (wrapper.components || []).map((c) => renderNode(c, rules)).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${bodyHtml}</body></html>`;
}
