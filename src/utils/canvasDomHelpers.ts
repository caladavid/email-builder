// Pure DOM helpers shared by canvas-bridge.ts (the injected iframe script) and
// unit tests. Same embedding contract as pasteSanitizer.ts: canvas-bridge.ts
// pulls these in verbatim via `${fn.toString()}`, so each function MUST be
// fully self-contained — no references to module-scope constants or other
// helpers, since Function.prototype.toString() only returns the function's
// own source text. (Production incident that established this rule: an
// earlier version of the paste sanitizer had its helpers as separate
// module-level functions and they were silently undefined once embedded.)

// A "filler" node is DOM debris that LOOKS like content but isn't — leftover
// empty <p>/<div> wrappers from invalid HTML nesting (e.g. a <div> inside a
// <p> gets split by the browser's own parser into [p, div, p], the two
// empty <p>s are filler). Real content and void/replaced elements (an <img>
// with no text is still real content) are never filler.
export function isFillerNode(el: Element): boolean {
  var VOID_OR_REPLACED: Record<string, true> = {
    IMG: true, HR: true, VIDEO: true, AUDIO: true, IFRAME: true, TABLE: true,
    INPUT: true, PICTURE: true, SOURCE: true, SVG: true, CANVAS: true, EMBED: true, OBJECT: true,
  };
  if (VOID_OR_REPLACED[String(el.tagName || '').toUpperCase()]) return false;
  if (el.children && el.children.length > 0) return false;
  var text = (el.textContent || '').replace(/[\s ]+/g, '');
  return text.length === 0;
}

// Does this container have anything worth keeping — i.e. is it safe to leave
// as-is without restoring the empty-slot placeholder? Ignores SCRIPT/STYLE,
// the permanent overlay hosts, the placeholder itself, and filler nodes
// (the exact shape a broken "invalid nesting" template leaves behind:
// [empty <p>, placeholder, empty <p>] must count as "no real children" so
// the placeholder actually gets restored on delete).
export function hasRealChildren(parent: Element): boolean {
  var kids = parent.children;
  for (var i = 0; i < kids.length; i++) {
    var c = kids[i];
    var tag = String(c.tagName || '').toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
    var id = c.id || '';
    if (id === '__drop-indicator__' || id === '__box-model-overlay__') continue;
    if (c.getAttribute && c.getAttribute('data-block-type') === 'placeholder') continue;
    var VOID_OR_REPLACED: Record<string, true> = {
      IMG: true, HR: true, VIDEO: true, AUDIO: true, IFRAME: true, TABLE: true,
      INPUT: true, PICTURE: true, SOURCE: true, SVG: true, CANVAS: true, EMBED: true, OBJECT: true,
    };
    var isFiller = !VOID_OR_REPLACED[tag] && (!c.children || c.children.length === 0) &&
      (c.textContent || '').replace(/[\s ]+/g, '').length === 0;
    if (isFiller) continue;
    return true;
  }
  return false;
}

// Reads a Columnas table's per-column childData for the Styles panel —
// widths, the gap, and the vertical-alignment. Three separate bugs used to
// live in this one read: (1) the palette template writes width as an
// ATTRIBUTE but the old code only read style.width, so every "Ancho col. N"
// field showed blank on a fresh block; (2) the gap setter wrote HALF the
// value (padding-per-side) via the padding SHORTHAND, and this reader read
// paddingLeft back raw — displaying gap/2, which then halved AGAIN on every
// subsequent reselect; (3) vAlign was hardcoded 'top' in the panel template
// itself, so the select could never show what the block actually had.
// CSS path from <body> down to `el`, one segment per ancestor. Always
// includes :nth-of-type — a path is recomputed on every select/get-tree, so
// nothing persisted ever breaks from the extra index, but a BARE tag
// selector (omitted when `el` was momentarily the only sibling of its tag)
// silently starts matching a DIFFERENT element the instant a sibling of the
// same tag gets inserted before this one resolves again.
export function getElementPath(el: Element | null): string {
  if (!el || el === document.body) return 'body';
  var parts: string[] = [];
  var cur: Element | null = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    var parent: Element | null = cur.parentElement;
    if (!parent) break;
    var siblings = Array.from(parent.children).filter(function (s) { return s.tagName === (cur as Element).tagName; });
    var idx = siblings.indexOf(cur);
    var sel = cur.tagName.toLowerCase() + ':nth-of-type(' + (idx + 1) + ')';
    parts.unshift(sel);
    cur = parent;
  }
  return 'body > ' + parts.join(' > ');
}

// Collapses 4 per-side border values (already read from computed/inline
// style by the caller) into the single value the shorthand-based panel
// fields (borderWidth/borderColor/borderStyle) expect, plus a `mixed` flag —
// so a border that's actually 1px on top and 0 elsewhere shows "1px (mixto)"
// instead of silently reporting a uniform 1px border that isn't real.
export function collapseSides(top: string, right: string, bottom: string, left: string): { value: string; mixed: boolean } {
  if (top === right && right === bottom && bottom === left) return { value: top, mixed: false };
  return { value: top, mixed: true };
}

export function readColumnsChildData(table: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const tds = Array.from(table.querySelectorAll<HTMLElement>('tr:first-child > td, tr:first-child > th'));
  out.columnsCount = String(tds.length);
  const first = tds[0];
  const padLeft = first ? parseFloat(first.style.paddingLeft || '') : NaN;
  out.colGap = String(isNaN(padLeft) ? 16 : Math.round(padLeft * 2)); // gap = 2x the per-side padding
  out.vAlign = (first && (first.style.verticalAlign || first.getAttribute('valign'))) || 'top';
  for (let i = 0; i < tds.length; i++) {
    const w = tds[i].style.width || tds[i].getAttribute('width') || '';
    out['col_' + i + '_width'] = /^[0-9.]+$/.test(w) ? w + 'px' : w; // a bare attribute number has no unit
  }
  return out;
}
