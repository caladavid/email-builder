// Pure DOM normalization run once at import time (editor.store.ts's
// sanitizeImportedHtml → importRawHtml — the single funnel every entry vector
// goes through: postMessage loadDocument, ZIP parsing, the HTML tab, GrapesJS
// import, sample templates). Kept in its own module so it's unit-testable
// with vitest/happy-dom, same pattern as pasteSanitizer.ts.
//
// Philosophy: users should be able to author/import templates however they
// want (hand-written HTML, Google Docs export, whatever a ZIP contains) and
// have the app quietly make them work — not surface warnings about what's
// "wrong" with their markup. Every function here silently repairs a specific,
// narrow shape; anything it isn't confident about it leaves untouched rather
// than guessing.

// Google Docs paste sometimes carries a run of text with NO explicit color
// anywhere in its own style or its ancestors' inline styles (seen in production:
// a paragraph rendered black in our editor — the browser's default — but grey
// in the wrapper's own preview, whose rendering environment defaults differently).
// Bakes in an explicit '#000000' on any element that directly holds text and has
// no color declared on itself or any ancestor, so it renders the same everywhere
// regardless of what each host's own default text color happens to be. Elements
// that already inherit an EXPLICIT color from a styled ancestor (e.g. white text
// on a dark section) are left alone — inheritance still works, and that ancestor
// is unambiguous already.
function hasDirectText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.textContent || '').trim()) return true;
  }
  return false;
}

// 'inherit'/'unset'/'initial' don't resolve to a concrete color on their own —
// they just defer to the parent, so they must NOT count as "already has an
// explicit color" (seen in production: a `color: inherit` on a <p> whose
// ancestors also have no concrete color let the whole run fall through to
// each renderer's own default, which is exactly the bug this function exists
// to prevent).
function hasConcreteColor(el: HTMLElement): boolean {
  const c = el.style.color.trim().toLowerCase();
  return !!c && c !== 'inherit' && c !== 'unset' && c !== 'initial';
}

// Some host pages that embed this builder's export via v-html (not an iframe —
// confirmed in production: e-commerce-frontend's own preview modal) carry a
// global `* { box-sizing: border-box }` reset. Pasted content frequently bakes
// in both an explicit width AND padding per block (Google Docs does this per
// paragraph) — under border-box those combine into a SMALLER rendered box than
// under this app's own neutral iframe (content-box, the CSS default), so the
// same block renders visibly narrower/"indented" in that host than in our
// editor. Stamping content-box explicitly is a no-op for elements without that
// width+padding combo, and guarantees the ones that DO have it render identically
// regardless of any global reset the host page happens to carry.
function bakeContentBoxSizing(body: HTMLElement) {
  body.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (!el.style.boxSizing) el.style.boxSizing = 'content-box';
  });
}

// A pasted/imported <p data-block-type="..."> that itself contains block-level
// content (a <div>, another <p>, an <li>...) is invalid HTML — the browser's own
// parser splits it apart on the way in: the marker ends up empty and the real
// content lands as its NEXT SIBLING, permanently orphaned from data-block-type.
// Symptom in the app: clicking that content selects the wrong (outer) block,
// because click-to-select walks up to the nearest data-block-type ancestor and
// this content has none. Recover by re-homing the orphaned siblings into a <div>
// (which — unlike <p> — can legally hold block content) carrying the same
// attributes as the original marker.
export function mergeOrphanedBlockMarkers(doc: Document, body: HTMLElement) {
  const markers = Array.from(body.querySelectorAll<HTMLElement>('p[data-block-type]'));
  for (const marker of markers) {
    if ((marker.textContent || '').trim() || marker.children.length) continue; // has real content — not orphaned
    const toAbsorb: ChildNode[] = [];
    let sib: ChildNode | null = marker.nextSibling;
    while (sib) {
      if (sib.nodeType === 1 && (sib as Element).hasAttribute('data-block-type')) break; // next real block — stop
      const next: ChildNode | null = sib.nextSibling;
      toAbsorb.push(sib);
      sib = next;
    }
    const hasRealContent = toAbsorb.some((n) => n.nodeType === 1 || (n.textContent || '').trim());
    if (!hasRealContent) continue; // genuinely empty marker (e.g. a fresh placeholder) — leave it
    const div = doc.createElement('div');
    Array.from(marker.attributes).forEach((attr) => div.setAttribute(attr.name, attr.value));
    toAbsorb.forEach((node) => div.appendChild(node));
    marker.replaceWith(div);
  }
}

// Plain <p>/<div> text content with no data-block-type at all (hand-written
// HTML, content pasted straight into the HTML tab, a ZIP built outside this
// app...) is only ever selectable by its raw tag — click-to-select shows
// "<p>" or "<div>" instead of "Texto", and none of the Texto-specific Style
// panel affordances apply. Every text-bearing element should end up as the
// SAME block type regardless of how it got into the document — one canonical
// "Texto", not a mix of raw tags — so the editing experience doesn't depend
// on which tool originally produced the markup.
//
// Deliberately conservative — only tags an element when doing so can't
// possibly swallow something that should stay its own block:
//   - already marked, or already living inside a marked ancestor → skip
//     (never touch/renest an existing block)
//   - wraps a marked descendant (e.g. an unmarked <div> around an Imagen
//     block) → skip (would nest a real block inside a fake "Texto" one)
//   - contains a replaced/structural element (img, video, table, form,
//     button, hr...) → skip (that's a distinct block, not text — an inline
//     <a> link is fine and stays, since "click here to read more" is
//     legitimate rich text)
//   - no real text anywhere in it → skip (nothing to classify)
// Processes top-down (document order): once a wrapper is tagged, its
// descendants are skipped on their own turn via the "inside a marked
// ancestor" check, so nested <div><p>text</p></div> becomes ONE Texto block
// (the outer element) rather than two nested ones. Siblings at the same
// depth (e.g. several <p> directly in a <td>) each become their own block,
// same as building them one-by-one from the block picker would.
const NON_TEXT_TAGS: Record<string, true> = {
  IMG: true, VIDEO: true, AUDIO: true, IFRAME: true, TABLE: true, FORM: true,
  INPUT: true, BUTTON: true, SELECT: true, TEXTAREA: true, HR: true,
  CANVAS: true, SVG: true, OBJECT: true, EMBED: true, SCRIPT: true, STYLE: true,
};
export function autoTagPlainTextBlocks(body: HTMLElement) {
  const candidates = Array.from(body.querySelectorAll<HTMLElement>('p, div'));
  for (const el of candidates) {
    if (el.closest('[data-block-type]')) continue; // already marked, or inside a marked block
    if (el.querySelector('[data-block-type]')) continue; // wraps a real block — don't renest it
    if (Array.from(el.querySelectorAll<HTMLElement>('*')).some((d) => NON_TEXT_TAGS[d.tagName])) continue;
    if (!(el.textContent || '').trim()) continue; // nothing to classify
    el.setAttribute('data-block-type', 'Texto');
  }
}

// Text styling (color, size, weight...) that lives on a lone child <span>/<font>
// instead of the data-block-type root is invisible to the app: the Styles panel
// always reads/writes the root element, so the color picker shows the wrong
// (inherited) value and editing it has no visible effect — the child's own
// inline style still wins. Common with content authored outside the app (Google
// Docs export, hand-written HTML) where a single text run got wrapped instead of
// styled directly. Only fires for a lone wrapper with no other sibling text —
// a block with genuinely mixed per-run styling is left alone (no single color to
// hoist), since guessing wrong there would be worse than doing nothing.
const TEXT_STYLE_KEYS = ['color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textAlign', 'textDecoration', 'lineHeight', 'letterSpacing'] as const;
export function hoistSingleRunChildStyle(body: HTMLElement) {
  body.querySelectorAll<HTMLElement>('[data-block-type]').forEach((root) => {
    const childEls = Array.from(root.children);
    if (childEls.length !== 1) return;
    const onlyChild = childEls[0] as HTMLElement;
    const otherText = Array.from(root.childNodes).some((n) => n !== onlyChild && n.nodeType === 3 && (n.textContent || '').trim());
    if (otherText) return; // real content outside the single child — not a pure wrapper case
    if (onlyChild.tagName !== 'SPAN' && onlyChild.tagName !== 'FONT') return; // only unwrap plain formatting wrappers
    if (onlyChild.children.length > 0) return; // further nested formatting — leave it, don't guess
    let hoisted = false;
    for (const key of TEXT_STYLE_KEYS) {
      const childVal = onlyChild.style[key as any];
      if (!childVal) continue;
      const rootVal = root.style[key as any];
      const rootHasValue = key === 'color' ? hasConcreteColor(root) : !!(rootVal && rootVal !== 'inherit');
      if (rootHasValue) continue; // root already has its own explicit value — don't override it
      root.style[key as any] = childVal;
      hoisted = true;
    }
    if (hoisted) {
      while (onlyChild.firstChild) root.insertBefore(onlyChild.firstChild, onlyChild);
      onlyChild.remove();
    }
  });
}

export function bakeHostIndependentDefaults(html: string): string {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return html;
  }
  const body = doc.body;
  if (!body) return html;
  mergeOrphanedBlockMarkers(doc, body);
  autoTagPlainTextBlocks(body);
  hoistSingleRunChildStyle(body);
  body.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (hasConcreteColor(el) || !hasDirectText(el)) return;
    let cur: HTMLElement | null = el.parentElement;
    while (cur && cur !== body) {
      if (hasConcreteColor(cur)) return; // inherits a concrete color already — leave it
      cur = cur.parentElement;
    }
    el.style.color = '#000000';
  });
  bakeContentBoxSizing(body);
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}
