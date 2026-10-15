import DOMPurify from 'dompurify';

// Security filtering for untrusted template HTML (ZIP/backend response, parent
// loadDocument/loadTemplate, HTML tab, GrapesJS projects, block→HTML render).
//
// Why not DOMPurify on the whole document: its default SAFE_FOR_XML drops any
// comment containing "<", which deletes Outlook conditional comments
// (<!--[if mso]>...<![endif]-->), and it strips xmlns:* on <html> plus every
// <meta>. This is a targeted denylist instead: it removes only what can run
// script or navigate, and leaves comments, <style>, VML and email attributes
// untouched.
//
// isSafeAttribute is embedded verbatim into the canvas iframe script
// (canvas-bridge.ts, via toString()), so it must stay fully self-contained:
// no references to module-scope constants or other helpers in this file.

/**
 * Returns false when setting `name="value"` on an element could run script or
 * navigate to a script URL. URL-bearing attributes only accept http(s),
 * mailto, tel, sms, cid, relative paths, #anchors and merge tags ({var});
 * src-like attributes additionally accept data:image/*.
 */
export function isSafeAttribute(name: string, value: string | null | undefined): boolean {
  var n = String(name == null ? '' : name).trim().toLowerCase();
  if (!n || !/^[a-z_:][a-z0-9_:.\-]*$/.test(n)) return false;
  if (n.indexOf('on') === 0) return false;
  if (n === 'srcdoc' || n === 'formaction') return false;

  // Browsers ignore control chars/whitespace inside a URL scheme ("java\tscript:")
  var v = String(value == null ? '' : value).replace(/[\u0000- \u007f-\u009f]/g, '');
  var lower = v.toLowerCase();

  if (n === 'style') {
    // "behavior:" only as a whole property (scroll-behavior is legit)
    return !/(javascript|vbscript):|expression\(|-moz-binding|(^|;)behavior:/.test(lower);
  }
  // Generic: any attribute whose value is a script URL (covers SVG
  // <animate to="javascript:..."> / values / from / by and unknown attrs).
  // Human-readable text attributes are exempt.
  var TEXT_ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'aria-description'];
  if (TEXT_ATTRS.indexOf(n) === -1 && /^(javascript|vbscript):/.test(lower)) return false;

  var URL_ATTRS = ['href', 'xlink:href', 'src', 'action', 'background', 'poster', 'lowsrc', 'dynsrc', 'longdesc', 'cite', 'codebase', 'data'];
  if (URL_ATTRS.indexOf(n) === -1) return true;
  if (v === '') return true;
  var m = /^([a-z][a-z0-9+.\-]*):/.exec(lower);
  if (!m) return true; // relative path, #anchor, //host, {merge_tag}
  var scheme = m[1];
  if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel' || scheme === 'sms' || scheme === 'cid') return true;
  // data:image/* is inert inside <img>/background (SVG scripts never run
  // there); never allowed on href (navigation) or action
  if (scheme === 'data') {
    var isSrcLike = n === 'src' || n === 'background' || n === 'poster' || n === 'lowsrc' || n === 'dynsrc';
    return isSrcLike && lower.indexOf('data:image/') === 0;
  }
  return false;
}

/** URL check for href/src values set from the UI (link inputs, image URLs). */
export function isSafeUrl(url: string | null | undefined, kind: 'href' | 'src' = 'href'): boolean {
  return isSafeAttribute(kind, url);
}

/** Escapes a string for use inside a double- or single-quoted HTML attribute. */
export function escapeHtmlAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizer for small rich-text fragments (inline editors, readers that use
 * v-html). DOMPurify default allowlist + target on links.
 */
export function sanitizeInlineHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html == null ? '' : String(html), { ADD_ATTR: ['target'] }) as string;
}

const REMOVE_TAGS = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'base', 'template', 'portal',
]);

function scrubCss(css: string): string {
  return css
    .replace(/url\(\s*(['"]?)\s*(javascript|vbscript):[^)]*\)/gi, 'url()')
    .replace(/expression\s*\(/gi, 'x-expression(')
    .replace(/-moz-binding\s*:/gi, 'x-moz-binding:')
    .replace(/(^|[;{\s])behavior\s*:/gi, '$1x-behavior:');
}

function serializeDoctype(dt: DocumentType): string {
  let s = '<!DOCTYPE ' + (dt.name || 'html');
  if (dt.publicId) s += ' PUBLIC "' + dt.publicId + '"';
  if (dt.systemId) s += (dt.publicId ? '' : ' SYSTEM') + ' "' + dt.systemId + '"';
  return s + '>';
}

/**
 * Removes everything in an HTML document (or fragment) that can execute
 * script: <script>/<iframe>/<object>/<embed>/<base>/<template>, meta refresh,
 * on* handlers, srcdoc, javascript:/vbscript: URLs, CSS expression()/url(javascript:).
 * <form> is unwrapped (its content is kept). Full documents keep their doctype
 * and top-level comments; fragments come back as fragments.
 */
export function sanitizeTemplateHtml(html: string): string {
  if (!html) return html;
  const isFullDocument = /<html[\s>]/i.test(html) || /<!doctype/i.test(html);
  let doc: Document;
  try {
    // Fragments are parsed already inside <body>: otherwise a leading comment
    // (<!--[if mso]>) is attached to the Document node and lost, and a leading
    // <style> is hoisted into <head>.
    doc = new DOMParser().parseFromString(isFullDocument ? html : '<!DOCTYPE html><html><head></head><body>' + html + '</body></html>', 'text/html');
  } catch {
    return ''; // fail closed
  }

  const all = Array.from(doc.querySelectorAll('*'));
  for (const el of all) {
    if (!el.isConnected) continue; // inside an already-removed subtree
    const tag = el.localName.toLowerCase();

    if (REMOVE_TAGS.has(tag)) { el.remove(); continue; }
    if (tag === 'meta') {
      const equiv = (el.getAttribute('http-equiv') || '').trim().toLowerCase();
      if (equiv === 'refresh' || equiv === 'set-cookie') { el.remove(); continue; }
    }
    if (tag === 'link' && /\bimport\b/i.test(el.getAttribute('rel') || '')) { el.remove(); continue; }
    if ((tag === 'animate' || tag === 'set' || tag === 'animatemotion' || tag === 'animatetransform')
        && /^(href|xlink:href|on)/i.test((el.getAttribute('attributename') || el.getAttribute('attributeName') || '').trim())) {
      el.remove(); continue;
    }
    if (tag === 'form') {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
      }
      continue;
    }
    if (tag === 'style') {
      const css = el.textContent || '';
      const clean = scrubCss(css);
      if (clean !== css) el.textContent = clean;
    }

    for (const attr of Array.from(el.attributes)) {
      if (!isSafeAttribute(attr.name, attr.value)) el.removeAttribute(attr.name);
    }
  }

  if (!isFullDocument) return doc.body ? doc.body.innerHTML : '';

  let out = '';
  doc.childNodes.forEach((node) => {
    if (node.nodeType === 10) out += serializeDoctype(node as DocumentType);
    else if (node.nodeType === 8) out += '<!--' + (node as Comment).data + '-->';
    else if (node.nodeType === 1) out += (node as Element).outerHTML;
  });
  return out;
}
