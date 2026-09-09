// UMD build — executed as plain inline script text inside the iframe, so it
// assigns `window.DOMPurify` there (no module system present in that context).
import purifySrc from 'dompurify/dist/purify.min.js?raw';
import { sanitizePastedHtml } from './pasteSanitizer';
import { isFillerNode, hasRealChildren, readColumnsChildData, collapseSides, getElementPath } from './canvasDomHelpers';

export const CANVAS_BRIDGE_CODE = purifySrc + `
(function () {
  'use strict';
  if (window.__canvasBridgeCleanup) { try { window.__canvasBridgeCleanup(); } catch(e) {} }
  if (window.__canvasBridgeActive) return;
  window.__canvasBridgeActive = true;

  // Capture parent origin from first incoming message so postMessage calls are not sent with '*'
  var _parentOrigin = '*';
  var _parentOriginCaptured = false;

  // Real sanitizer (DOMPurify, loaded above as a plain global) — the previous
  // regex-only version missed unquoted event handlers (onerror=alert(1) with no
  // quotes), <svg onload=...>, and other well-known bypasses. Keeps VML tags
  // (Outlook "bulletproof" buttons) and inline styles, which DOMPurify would
  // otherwise strip since they're not in its default allowlist.
  function sanitizeHtml(html) {
    if (!window.DOMPurify) return ''; // fail closed if the bundled purify script didn't load
    return window.DOMPurify.sanitize(html || '', {
      ADD_TAGS: ['v:shape', 'v:rect', 'v:oval', 'v:roundrect', 'v:textbox', 'v:fill', 'v:stroke', 'o:lock'],
      ADD_ATTR: ['xmlns:v', 'xmlns:o', 'xmlns:w', 'fillcolor', 'strokecolor', 'arcsize'],
    });
  }

  // Real function lives in src/utils/pasteSanitizer.ts (unit tested there via
  // vitest/happy-dom) — embedded here verbatim via toString() so the iframe
  // runtime and the tested source can never drift apart.
  var sanitizePastedHtml = ${sanitizePastedHtml.toString()};

  // Real functions live in src/utils/canvasDomHelpers.ts (unit tested there
  // via vitest/happy-dom) — embedded verbatim via toString(), same contract
  // as sanitizePastedHtml above: each must be fully self-contained.
  var isFillerNode = ${isFillerNode.toString()};
  var hasRealChildren = ${hasRealChildren.toString()};
  var collapseSides = ${collapseSides.toString()};
  var readColumnsChildData = ${readColumnsChildData.toString()};
  var getElementPath = ${getElementPath.toString()};

  const IGNORE_TAGS = new Set(['HTML', 'HEAD', 'BODY', 'STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'NOSCRIPT']);
  // Denylist: any element NOT in this set can be inline-edited on dblclick
  const NON_EDITABLE_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'COLGROUP', 'COL', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'BR', 'HR', 'WBR']);
  const TABLE_INT = new Set(['TR', 'TD', 'TH', 'TBODY', 'THEAD', 'TFOOT', 'COLGROUP', 'COL']);
  // Real block-level elements — used to detect "this text field would delete
  // a real nested block if you typed through it", distinct from inline
  // formatting (b/i/span/a), which only loses styling, not whole blocks.
  const BLOCK_LEVEL_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'IMG', 'HR', 'VIDEO', 'IFRAME']);

  var hoveredEl = null;
  var selectedEl = null;
  var editingEl = null;
  var prevHoverOutline = '';
  var prevSelOutline = '';
  var prevSelOutlineOffset = '';
  var _internalDragEl = null;
  var _selectGen = 0; // cancels stale selectAfterImagesLoad callbacks

  // Editor-injected overlay elements that live as permanent children of <body>
  // (hidden/shown, never removed) — any "find the last REAL block" walk must skip
  // these, or it silently resolves to an invisible 0x0 div instead of actual
  // template content (this is exactly what broke drag-and-drop positioning after
  // the box-model hover overlay was added — it was the last child of <body> in
  // any session where the user had already hovered something, which is "always").
  function isInternalOverlayId(id) {
    return id === '__drop-indicator__' || id === '__box-model-overlay__';
  }

  // Box-model overlay (DevTools/GrapesJS style) — 4 orange strips for margin,
  // 4 green strips for padding, drawn around whatever is currently hovered.
  // position:fixed + viewport rects so no scroll-offset math is needed.
  var _boxModelEls = null;
  function ensureBoxModelEls() {
    if (_boxModelEls) return _boxModelEls;
    var host = document.createElement('div');
    host.id = '__box-model-overlay__';
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
    var els = { margin: [], padding: [] };
    function makeStrip(color) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;pointer-events:none;display:none;background:' + color + ';';
      host.appendChild(d);
      return d;
    }
    for (var mi = 0; mi < 4; mi++) els.margin.push(makeStrip('rgba(246,178,107,0.45)'));
    for (var pi = 0; pi < 4; pi++) els.padding.push(makeStrip('rgba(147,196,125,0.45)'));
    (document.body || document.documentElement).appendChild(host);
    _boxModelEls = els;
    return els;
  }

  function hideBoxModel() {
    if (!_boxModelEls) return;
    var all = _boxModelEls.margin.concat(_boxModelEls.padding);
    for (var i = 0; i < all.length; i++) all[i].style.display = 'none';
  }

  function showBoxModelFor(el) {
    if (!el || !el.getBoundingClientRect) { hideBoxModel(); return; }
    // Skip empty-canvas / add-block placeholders — they're an editor affordance,
    // not real email content, so their own padding/margin isn't meaningful to show.
    if (el.getAttribute && el.getAttribute('data-block-type') === 'placeholder') { hideBoxModel(); return; }
    var els = ensureBoxModelEls();
    var cs = window.getComputedStyle(el);
    var r = el.getBoundingClientRect();
    var mt = parseFloat(cs.marginTop) || 0, mr = parseFloat(cs.marginRight) || 0, mb = parseFloat(cs.marginBottom) || 0, ml = parseFloat(cs.marginLeft) || 0;
    var bt = parseFloat(cs.borderTopWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0, bl = parseFloat(cs.borderLeftWidth) || 0;
    var pt = parseFloat(cs.paddingTop) || 0, pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0, pl = parseFloat(cs.paddingLeft) || 0;

    // Nothing to show at all — hide instead of drawing empty 0-size strips.
    if (!mt && !mr && !mb && !ml && !pt && !pr && !pb && !pl) { hideBoxModel(); return; }

    function place(d, top, left, width, height) {
      if (width <= 0 || height <= 0) { d.style.display = 'none'; return; }
      d.style.display = 'block';
      d.style.top = top + 'px';
      d.style.left = left + 'px';
      d.style.width = width + 'px';
      d.style.height = height + 'px';
    }

    // Margin ring — outside the border box.
    place(els.margin[0], r.top - mt, r.left - ml, r.width + ml + mr, mt);              // top
    place(els.margin[1], r.bottom, r.left - ml, r.width + ml + mr, mb);                // bottom
    place(els.margin[2], r.top, r.left - ml, ml, r.height);                             // left
    place(els.margin[3], r.top, r.right, mr, r.height);                                 // right

    // Padding ring — inside the border box, between border and content.
    var innerTop = r.top + bt, innerLeft = r.left + bl;
    var innerWidth = r.width - bl - br, innerHeight = r.height - bt - bb;
    var contentTop = innerTop + pt, contentLeft = innerLeft + pl;
    var contentWidth = innerWidth - pl - pr, contentHeight = innerHeight - pt - pb;
    place(els.padding[0], innerTop, innerLeft, innerWidth, pt);                          // top
    place(els.padding[1], contentTop + contentHeight, innerLeft, innerWidth, pb);        // bottom
    place(els.padding[2], contentTop, innerLeft, pl, contentHeight);                     // left
    place(els.padding[3], contentTop, contentLeft + contentWidth, pr, contentHeight);    // right
  }

  function makePlaceholder() {
    var _ph = document.createElement('div');
    _ph.setAttribute('data-block-type', 'placeholder');
    _ph.setAttribute('style', 'margin:0 auto;width:100%;min-height:60px;border:2px dashed #c7d8f5;border-radius:6px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;');
    _ph.innerHTML = '<svg width="24" height="24" viewBox="0 0 40 40" fill="none" style="pointer-events:none;"><path d="M20 11v18M11 20h18" stroke="#0045B0" stroke-width="2.5" stroke-linecap="round"/></svg>';
    return _ph;
  }

  // Pure inline-formatting tags — clicking one of these (no data-block-type
  // ancestor) should select the paragraph/container they live in, not the tag
  // itself, so a bold word inside running text doesn't become its own tiny
  // selectable "block". <A> is deliberately excluded — plain text links keep
  // their own selection (Link panel: href/text) when not wrapped in a Botón block.
  const INLINE_FORMAT_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'SPAN', 'SMALL', 'MARK', 'SUB', 'SUP', 'Q', 'ABBR', 'CITE', 'TIME', 'KBD', 'VAR', 'CODE', 'FONT']);

  // Walk up to data-block-type; if not found, use the clicked element directly
  // (imported templates have no data-block-type so we allow individual element selection)
  function findBlockEl(el) {
    var cur = el;
    while (cur && cur !== document.body && !cur.getAttribute('data-block-type')) {
      cur = cur.parentElement;
    }
    if (cur && cur !== document.body && cur !== document.documentElement) {
      return cur;
    }
    // No data-block-type — select the clicked element itself, but skip past
    // ignored tags and pure inline-formatting tags (see INLINE_FORMAT_TAGS above)
    var target = el;
    while (target && (IGNORE_TAGS.has(target.tagName) || INLINE_FORMAT_TAGS.has(target.tagName) || target === document.body || target === document.documentElement)) {
      target = target.parentElement;
    }
    return target || null;
  }

  // Single source of truth for the style properties the panel reads. Plain 1:1
  // properties only — textAlign/textDecoration need extra logic and are handled
  // separately below. Kept as a flat list (not a map) so getInlineStyles (added
  // later) can reuse it without duplicating the property names.
  var STYLE_KEYS = [
    'color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
    'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'width', 'height', 'maxWidth',
    'borderWidth', 'borderColor', 'borderStyle', 'borderRadius',
    'display', 'listStyleType',
  ];

  function getElementStyles(el) {
    var cs = window.getComputedStyle(el);
    var s = el.style;
    function pick(inline, computed) { return inline || computed || ''; }
    var out = {};
    for (var i = 0; i < STYLE_KEYS.length; i++) {
      var k = STYLE_KEYS[i];
      out[k] = pick(s[k], cs[k]);
    }
    // Per-side computed values, always real (getComputedStyle never returns
    // ''), so collapseSides sees the browser's true resolved border — not
    // just what happens to be set inline on this one element.
    var widthC = collapseSides(cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth);
    var colorC = collapseSides(cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor);
    var styleC = collapseSides(cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle);
    out.borderWidth = widthC.value; out.borderWidthMixed = widthC.mixed ? '1' : '';
    out.borderColor = colorC.value; out.borderColorMixed = colorC.mixed ? '1' : '';
    out.borderStyle = styleC.value; out.borderStyleMixed = styleC.mixed ? '1' : '';
    out.textAlign = (function(v){ return v==='start'?'left':v==='end'?'right':v; })(pick(s.textAlign, cs.textAlign));
    out.textDecoration = (function() {
      if (s.textDecoration) return s.textDecoration;
      if (el.querySelector('u')) return 'underline';
      if (el.querySelector('s, strike')) return 'line-through';
      if (el.querySelector('span[style*="text-decoration: underline"],span[style*="text-decoration:underline"]')) return 'underline';
      if (el.querySelector('span[style*="text-decoration: line-through"],span[style*="text-decoration:line-through"]')) return 'line-through';
      return '';
    })();
    return out;
  }

  // Inline-only values (no computed fallback) for fields where showing a computed
  // value as if the user had set it is misleading (e.g. an untouched width field
  // rendering "600px" in black as though it were an explicit choice).
  function getInlineStyles(el) {
    var s = el.style;
    var out = {};
    for (var i = 0; i < STYLE_KEYS.length; i++) {
      var k = STYLE_KEYS[i];
      out[k] = s[k] || '';
    }
    var widthC = collapseSides(s.borderTopWidth || '', s.borderRightWidth || '', s.borderBottomWidth || '', s.borderLeftWidth || '');
    var colorC = collapseSides(s.borderTopColor || '', s.borderRightColor || '', s.borderBottomColor || '', s.borderLeftColor || '');
    var styleC = collapseSides(s.borderTopStyle || '', s.borderRightStyle || '', s.borderBottomStyle || '', s.borderLeftStyle || '');
    out.borderWidth = widthC.value; out.borderWidthMixed = widthC.mixed ? '1' : '';
    out.borderColor = colorC.value; out.borderColorMixed = colorC.mixed ? '1' : '';
    out.borderStyle = styleC.value; out.borderStyleMixed = styleC.mixed ? '1' : '';
    return out;
  }

  function getElementAttrs(el) {
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  function notifyDomChanged(immediate) {
    // Strip editor hover/selection outlines before snapshot — they must not leak into exported HTML
    var outlineEls = document.querySelectorAll('[style*="dashed"]');
    var savedOutlines = [];
    for (var oi = 0; oi < outlineEls.length; oi++) {
      var _oel = outlineEls[oi];
      if (_oel.style && _oel.style.outline && _oel.style.outline.indexOf('dashed') !== -1) {
        savedOutlines.push([_oel, _oel.style.outline]);
        _oel.style.outline = '';
      }
    }
    // Box-model hover overlay lives permanently in the DOM (just hidden/shown) —
    // detach it before serializing so it never leaks into the saved/exported HTML.
    var _boxModelHost = document.getElementById('__box-model-overlay__');
    var _boxModelParent = _boxModelHost ? _boxModelHost.parentNode : null;
    if (_boxModelHost && _boxModelParent) _boxModelParent.removeChild(_boxModelHost);
    var html = document.documentElement.outerHTML;
    if (_boxModelHost && _boxModelParent) _boxModelParent.appendChild(_boxModelHost);
    for (var ri = 0; ri < savedOutlines.length; ri++) {
      savedOutlines[ri][0].style.outline = savedOutlines[ri][1];
    }
    var bridgeStart = html.indexOf('<script id="__canvas-bridge__"');
    if (bridgeStart >= 0) {
      var closeTag = '<' + '/script>';
      var bridgeEnd = html.indexOf(closeTag, bridgeStart);
      if (bridgeEnd >= 0) {
        html = html.slice(0, bridgeStart) + html.slice(bridgeEnd + closeTag.length);
      }
    }
    // Strip the editor-only scroll-padding style injected by IframeCanvas — it must
    // never reach the saved/exported HTML (was leaking as body{padding-bottom:160px!important}).
    var padStart = html.indexOf('<style id="__canvas-padding__"');
    if (padStart >= 0) {
      var padCloseTag = '<' + '/style>';
      var padEnd = html.indexOf(padCloseTag, padStart);
      if (padEnd >= 0) {
        html = html.slice(0, padStart) + html.slice(padEnd + padCloseTag.length);
      }
    }
    // Strip editor-only attributes (selection drag handle, in-progress text editing)
    html = html.replace(/\\s*draggable="[^"]*"/gi, '');
    html = html.replace(/\\s*contenteditable="[^"]*"/gi, '');
    // 'immediate' skips IframeCanvas's 150ms save debounce — needed for one-shot events
    // (like finishing a text edit) where switching tabs right after would otherwise
    // destroy the pending timer before the change is ever saved to rawHtml.
    parent.postMessage({ type: 'dom-changed', html: html, immediate: !!immediate }, _parentOrigin);
  }

  // Debounced version for rapid-fire style changes (slider drag).
  // Style applies immediately; DOM sync + overlay update fire once drag settles.
  var _styleDebTimer = null;
  var _styleDebTarget = null;
  function notifyStyleDebounced(target) {
    _styleDebTarget = target;
    clearTimeout(_styleDebTimer);
    _styleDebTimer = setTimeout(function() {
      _styleDebTimer = null;
      notifyDomChanged();
      // Skip selectElement while in text-edit mode — it clears _savedRange
      if (!editingEl && _styleDebTarget && _styleDebTarget === selectedEl) selectElement(_styleDebTarget);
      _styleDebTarget = null;
    }, 120);
  }

  function clearOutline(el, outline, outlineOffset) {
    if (!el) return;
    el.style.outline = outline || '';
    el.style.outlineOffset = outlineOffset || '';
  }

  // Writes an inline style, escalating to !important only when a stylesheet rule
  // (e.g. a template's own "img{max-width:100%!important}") would otherwise win.
  // Compares computed value before/after rather than against the requested value,
  // since computed values are normalized ('50%' -> '300px', '#fff' -> 'rgb(...)').
  function writeStyle(el, prop, value) {
    if (!el) return;
    var css = prop.replace(/[A-Z]/g, function(m) { return '-' + m.toLowerCase(); });
    if (!value) { el.style.removeProperty(css); return; }
    // Once a property is already escalated (e.g. from a previous slider tick),
    // keep writing !important directly. Clearing priority first to "test" would
    // let the competing stylesheet rule win for one tick — since that fallback
    // value differs from our *previous* value, the before/after check below
    // reads it as "the write worked" and skips re-escalating, snapping the
    // field back to the stylesheet's value on every write after the first.
    if (el.style.getPropertyPriority(css) === 'important') {
      el.style.setProperty(css, value, 'important');
      return;
    }
    var before = window.getComputedStyle(el).getPropertyValue(css);
    el.style.setProperty(css, value, '');
    var after = window.getComputedStyle(el).getPropertyValue(css);
    if (after === before && el.style.getPropertyValue(css)) {
      el.style.setProperty(css, value, 'important');
    }
  }

  function selectElement(el) {
    if (!el) return;
    if (el !== selectedEl) _savedRange = null; // clear stale selection only when element changes
    // clear previous selection — always restore to empty, never back to a saved blue outline
    if (selectedEl && selectedEl !== el) {
      clearOutline(selectedEl, '', '');
      try { selectedEl.removeAttribute('draggable'); } catch(err) {}
    }
    prevSelOutline = '';
    prevSelOutlineOffset = '';
    selectedEl = el;
    // Clear any hover outlines left on child elements
    var staleHovers = el.querySelectorAll('[style*="outline"]');
    for (var si = 0; si < staleHovers.length; si++) { staleHovers[si].style.outline = ''; }
    try { el.setAttribute('draggable', 'true'); } catch(err) {}

    var rect = el.getBoundingClientRect();
    var blockType = el.getAttribute('data-block-type');
    var childData = { _tag: el.tagName.toLowerCase() };
    if (blockType === 'Botón') {
      var btnA = el.querySelector('a');
      if (btnA) {
        childData.text = (btnA.innerText || '').trim();
        childData.href = btnA.getAttribute('href') || '';
        childData.bg = btnA.style.backgroundColor || btnA.style.background || '';
        childData.color = btnA.style.color || '';
        childData.btnPaddingH = btnA.style.paddingLeft || '20px';
        childData.btnPaddingV = btnA.style.paddingTop || '12px';
        childData.target = btnA.getAttribute('target') || '_self';
        childData.borderRadius = btnA.style.borderRadius || '4px';
      }
    } else if (blockType === 'Imagen') {
      var btnImg = el.querySelector('img');
      if (btnImg) {
        childData.src = btnImg.getAttribute('src') || '';
        childData.alt = btnImg.getAttribute('alt') || '';
        var linkA = el.querySelector('a');
        childData.linkHref = linkA ? (linkA.getAttribute('href') || '') : '';
        // Inline-only (not computed) — mirrors Avatar's childData.size so the field
        // never snaps back to a computed px value the user didn't type.
        childData.imgWidth = btnImg.style.width || (btnImg.getAttribute('width') ? btnImg.getAttribute('width') + 'px' : '');
        childData.imgHeight = btnImg.style.height || (btnImg.getAttribute('height') ? btnImg.getAttribute('height') + 'px' : '');
        childData.wrapMaxWidth = el.style.maxWidth || '';
      }
    } else if (blockType === 'Separador') {
      var btnHr = el.querySelector('hr');
      if (btnHr) { childData.borderColor = btnHr.style.borderTopColor || btnHr.style.borderColor || '#CCCCCC'; childData.borderWidth = btnHr.style.borderTopWidth || '1px'; }
    } else if (blockType === 'Avatar') {
      var avImg = el.querySelector('img');
      if (avImg) {
        childData.src = avImg.getAttribute('src') || '';
        childData.alt = avImg.getAttribute('alt') || '';
        childData.size = (avImg.style.width || avImg.getAttribute('width') || '64').replace('px', '');
        var br = avImg.style.borderRadius || '';
        childData.shape = br === '50%' ? 'circle' : (br && br !== '0' && br !== '0px') ? 'rounded' : 'square';
      }
    } else if (blockType === 'Columnas') {
      var colData = readColumnsChildData(el);
      for (var colKey in colData) { if (colData.hasOwnProperty(colKey)) childData[colKey] = colData[colKey]; }
    } else if (blockType === 'Table') {
      var firstTd = el.querySelector('td');
      if (firstTd) {
        childData.cellBorderColor = firstTd.style.borderColor || firstTd.style.borderTopColor || '#cccccc';
        childData.cellBorderWidth = (firstTd.style.borderWidth || firstTd.style.borderTopWidth || '1').replace('px', '');
        childData.cellPadding = (firstTd.style.padding || firstTd.style.paddingTop || '8').replace('px', '');
      }
    } else if (blockType === 'video' || blockType === 'Video' || el.tagName === 'VIDEO') {
      // The lowercase 'video' branch matched VideoReader.vue's own rendered
      // output (data-block-type="video"), but the palette's own insert
      // template emits "Video" (capital V, buttons.ts) — a freshly-inserted
      // Video block never matched this branch at all, so the panel showed
      // empty src/poster and unchecked Controles/Autoplay even though the
      // template ships the controls attribute.
      var vidEl = el.tagName === 'VIDEO' ? el : el.querySelector('video');
      if (vidEl) {
        // The palette template puts the URL on <source src>, not on the
        // <video> element itself — read whichever one actually has it.
        var vidSource = vidEl.querySelector('source');
        childData.src = vidEl.getAttribute('src') || (vidSource ? vidSource.getAttribute('src') : '') || '';
        childData.poster = vidEl.getAttribute('poster') || '';
        childData.controls = vidEl.hasAttribute('controls') ? 'controls' : '';
        childData.autoplay = vidEl.hasAttribute('autoplay') ? 'autoplay' : '';
      }
    } else if (blockType === 'Lista' || blockType === 'Lista Ordenada' || el.tagName === 'UL' || el.tagName === 'OL') {
      var liEls = el.querySelectorAll(':scope > li');
      childData.itemCount = String(liEls.length);
      childData.ordered = (el.tagName === 'OL') ? '1' : '';
      childData.markerStyle = el.style.listStyleType || '';
      for (var liI = 0; liI < liEls.length; liI++) {
        childData['li_' + liI + '_text'] = (liEls[liI].textContent || '').trim();
      }
    }
    // Does this element contain formatting (bold/link/line-break/etc.)? The "Texto"
    // panel field is plain-text — writing through it replaces textContent wholesale,
    // silently destroying any such formatting. Surfaced so the panel can warn.
    var hasRichText = false;
    for (var _rtI = 0; _rtI < el.childNodes.length; _rtI++) {
      if (el.childNodes[_rtI].nodeType === 1) { hasRichText = true; break; }
    }
    // Stronger than hasRichText: does it contain a BLOCK-level child (a
    // nested heading, paragraph, list...)? Overwriting textContent here
    // doesn't just lose inline formatting, it DELETES that whole nested
    // block — production bug: an imported <div><h1>Title</h1></div> that got
    // auto-tagged "Texto" on the wrapper had its <h1> silently erased the
    // first time someone used the "Texto" field. hasBlockChildren gates
    // hiding the field entirely (see StylesPanel.vue); set-inner-text below
    // refuses to run on one regardless, as a second line of defense for
    // content that predates this check.
    var hasBlockChildren = false;
    for (var _bcI = 0; _bcI < el.children.length; _bcI++) {
      if (BLOCK_LEVEL_TAGS.has(el.children[_bcI].tagName)) { hasBlockChildren = true; break; }
    }
    // No truncation — an earlier 200-char slice() meant editing (or even just
    // clicking "insert variable" on) any longer block silently chopped it.
    // Still capped, generously, so a resync during hover/scroll on a huge
    // imported template doesn't ship the whole document over postMessage.
    var _rawInnerText = (el.innerText || '').trim();
    var _rawInnerHtml = blockType === 'Html' ? (el.innerHTML || '') : '';
    var TEXT_CAP = 20000, HTML_CAP = 50000;
    parent.postMessage({
      type: 'select',
      path: getElementPath(el),
      styles: getElementStyles(el),
      inlineStyles: getInlineStyles(el),
      attrs: getElementAttrs(el),
      tagName: el.tagName,
      blockType: blockType || null,
      innerText: _rawInnerText.slice(0, TEXT_CAP),
      innerHtml: _rawInnerHtml.slice(0, HTML_CAP),
      contentTruncated: _rawInnerText.length > TEXT_CAP || _rawInnerHtml.length > HTML_CAP,
      hasRichText: hasRichText,
      hasBlockChildren: hasBlockChildren,
      childData: childData,
      rect: {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      }
    }, _parentOrigin);
  }

  // HOVER
  document.addEventListener('mouseover', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    // Bubble past pure inline-formatting tags so hovering a bold/span word
    // highlights its paragraph instead of just that word — matches click-select.
    while (el && INLINE_FORMAT_TAGS.has(el.tagName)) { el = el.parentElement; }
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (el === selectedEl || el === editingEl) return;
    if (selectedEl && selectedEl.contains(el)) {
      // Allow hover on distinct child blocks inside a selected parent (e.g. heading inside Columnas)
      var nb = el;
      while (nb && nb !== selectedEl) {
        if (nb.getAttribute && nb.getAttribute('data-block-type')) break;
        nb = nb.parentElement;
      }
      if (!nb || nb === selectedEl) return;
      el = nb; // hover the child block root, not the inner leaf
    }
    if (hoveredEl && hoveredEl !== selectedEl && hoveredEl !== editingEl) {
      if (hoveredEl.style.outline.includes('dashed')) {
        hoveredEl.style.outline = prevHoverOutline || '';
      }
    }
    prevHoverOutline = el.style.outline.includes('rgba(0,121,204,1)') ? el.style.outline : (el.style.outline || '');
    hoveredEl = el;
    if (!el.style.outline.includes('rgba(0,121,204,1)') && !el.style.outline.includes('rgba(0,200,100')) {
      el.style.outline = '1px dashed rgba(0,121,204,0.5)';
    }
    showBoxModelFor(el);
  }, true);

  document.addEventListener('mouseout', function (e) {
    var el = e.target;
    if (!el || el === selectedEl || el === editingEl) return;
    if (el.style && el.style.outline.includes('dashed')) {
      el.style.outline = prevHoverOutline || '';
    }
    if (el === hoveredEl) { hoveredEl = null; hideBoxModel(); }
  }, true);

  // INPUT while editing → debounce re-measure overlay rect as block grows
  var _editResizeTimer = null;
  document.addEventListener('input', function() {
    if (!editingEl) return;
    clearTimeout(_editResizeTimer);
    _editResizeTimer = setTimeout(function() {
      _editResizeTimer = null;
      if (editingEl) selectElement(editingEl);
    }, 80);
  }, true);

  // DBLCLICK → enter edit mode for palette blocks (data-block-type) that are text-editable
  document.addEventListener('dblclick', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (editingEl) return;
    var block = findBlockEl(el);
    if (!block) return;
    if (NON_EDITABLE_TAGS.has(block.tagName)) return;
    e.stopPropagation();
    editingEl = block;
    try { block.removeAttribute('draggable'); } catch(err) {}
    block.contentEditable = 'true';
    block.focus();
    var er = block.getBoundingClientRect();
    parent.postMessage({ type: 'editing-start', path: getElementPath(block), rect: { top: er.top + window.scrollY, left: er.left + window.scrollX, width: er.width, height: er.height } }, _parentOrigin);
  }, true);

  // PASTE while editing → force inline-only content (see sanitizePastedHtml above).
  // Without this, clipboard HTML can invalidly nest inside the editable block root
  // and silently corrupt the document (orphaned, unselectable content).
  document.addEventListener('paste', function (e) {
    if (!editingEl || !editingEl.contains(e.target)) return;
    e.preventDefault();
    var cd = e.clipboardData || window.clipboardData;
    var html = cd && cd.getData && cd.getData('text/html');
    var sanitized;
    if (html) {
      sanitized = sanitizePastedHtml(html);
    } else {
      var text = (cd && cd.getData && cd.getData('text/plain')) || '';
      sanitized = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .split(/\\r\\n|\\r|\\n/).join('<br>');
    }
    document.execCommand('insertHTML', false, sanitized);
  }, true);

  // CLICK → SELECT (walk up to block root, fallback to direct body child for imported templates)
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el) return;
    var isIgnoredTag = IGNORE_TAGS.has(el.tagName);
    if (editingEl) {
      if (!editingEl.contains(el)) {
        // Clicking empty canvas background (<body>/<html>, both IGNORE_TAGS) must still
        // exit editing and save — previously the IGNORE_TAGS early-return below ran first,
        // so exitEditing() (and the save it triggers) never fired and the edit was lost.
        exitEditing();
        if (isIgnoredTag) return;
      } else {
        if (isIgnoredTag) return;
        // Click inside editing element — if it's a distinct named sub-block, escape and select it
        var innerBlock = findBlockEl(el);
        if (innerBlock && innerBlock !== editingEl && innerBlock.getAttribute('data-block-type')) {
          exitEditing();
          // fall through to selectElement(innerBlock) below
        } else {
          return; // just move cursor
        }
      }
    } else if (isIgnoredTag) {
      return;
    }
    e.stopPropagation();
    var block = findBlockEl(el);
    if (!block) {
      if (selectedEl) {
        clearOutline(selectedEl, '', '');
        try { selectedEl.removeAttribute('draggable'); } catch(err) {}
        selectedEl = null;
        parent.postMessage({ type: 'deselect' }, _parentOrigin);
      }
      return;
    }
    selectElement(block);
  }, true);


  function exitEditing() {
    if (!editingEl) return;
    var exiting = editingEl;
    editingEl = null;
    exiting.contentEditable = 'false';
    exiting.blur();
    // Sanitize <br> inside Botón blocks — email clients render them as hard line breaks
    var exitBlock = exiting;
    while (exitBlock && exitBlock !== document.body) {
      if (exitBlock.getAttribute && exitBlock.getAttribute('data-block-type') === 'Botón') break;
      exitBlock = exitBlock.parentElement;
    }
    if (exitBlock && exitBlock !== document.body) {
      var brs = exitBlock.querySelectorAll('br');
      for (var bi = brs.length - 1; bi >= 0; bi--) {
        var br = brs[bi];
        var isTrailing = !br.nextSibling || (br.nextSibling.nodeType === 3 && br.nextSibling.nodeValue.trim() === '');
        if (isTrailing) {
          br.parentNode.removeChild(br);
        } else {
          br.parentNode.replaceChild(document.createTextNode(' '), br);
        }
      }
    }
    notifyDomChanged(true);
    parent.postMessage({ type: 'editing-end' }, _parentOrigin);
    // Do NOT re-select exiting: it sends a stale 'select' for the old element right before
    // the new click's 'select' arrives, causing the overlay to flash to the wrong position.
  }

  document.addEventListener('keydown', function (e) {
    if (editingEl) {
      if (e.key === 'Escape') { e.preventDefault(); exitEditing(); }
      return;
    }
    if (e.key === 'Escape' && selectedEl) {
      try { selectedEl.removeAttribute('draggable'); } catch(err) {}
      clearOutline(selectedEl, prevSelOutline, prevSelOutlineOffset);
      selectedEl = null;
      parent.postMessage({ type: 'deselect' }, _parentOrigin);
    }
  }, true);

  // Forward keyboard shortcuts to parent (iframe captures focus, parent never sees keydown)
  document.addEventListener('keydown', function(e) {
    if (editingEl) return;
    var fwd = false;
    if (e.ctrlKey) fwd = true;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) fwd = true;
    if (!e.ctrlKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace') && selectedEl) fwd = true;
    if (!fwd) return;
    e.preventDefault();
    e.stopPropagation();
    parent.postMessage({ type: 'keydown', key: e.key, ctrlKey: !!e.ctrlKey, shiftKey: !!e.shiftKey, altKey: !!e.altKey }, _parentOrigin);
  }, true);

  // Defers selectElement until all <img> in el have loaded (or errored).
  // Prevents stale/tiny overlayRect when image hasn't loaded yet.
  function selectAfterImagesLoad(el) {
    var gen = ++_selectGen;
    // Select IMMEDIATELY — the panel should reflect the freshly-inserted
    // block right away, not wait on image loads. If the image host never
    // responds, this used to be the ONLY select that ever happened, up to
    // 5s later; now it's just a rect correction once images actually settle.
    selectElement(el);
    var imgs = el.querySelectorAll('img');
    if (imgs.length === 0) return;
    var pending = imgs.length;
    function done() {
      pending--;
      if (pending <= 0 && gen === _selectGen) selectElement(el);
    }
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) { done(); }
      else {
        (function(img) {
          var t = setTimeout(done, 1500);
          img.addEventListener('load', function() { clearTimeout(t); done(); }, { once: true });
          img.addEventListener('error', function() { clearTimeout(t); done(); }, { once: true });
        })(imgs[i]);
      }
    }
  }

  // COMMANDS FROM PARENT
  var _msgHandler = function (e) {
    if (!e.data || !e.data.type) return;
    // Capture parent origin from first incoming message
    if (!_parentOriginCaptured && e.origin !== window.location.origin) {
      _parentOrigin = e.origin;
      _parentOriginCaptured = true;
    }
    var cmd = e.data;
    var target = null;
    try {
      target = (cmd.path && cmd.path !== '__selected__')
        ? document.querySelector(cmd.path)
        : selectedEl;
    } catch(err) {
      target = selectedEl;
    }

    switch (cmd.type) {
      case 'set-style':
        writeStyle(target, cmd.property, cmd.value);
        notifyStyleDebounced(target);
        break;

      case 'apply-style-to-selection':
        var _appliedToSel = false;
        // --- Remove all: value 'none'/'' → strip ALL matching spans + semantic tags from target ---
        if (!cmd.value || cmd.value === 'none') {
          if (target) {
            target.style[cmd.property] = '';
            // Remove inline-style spans with this property
            var _rmSpans = Array.from(target.querySelectorAll('span[style]'));
            _rmSpans.forEach(function(_rms) {
              if (_rms.style[cmd.property]) {
                _rms.style[cmd.property] = '';
                var _rmsStyle = (_rms.getAttribute('style') || '').replace(/[\\s;]/g, '');
                if (!_rmsStyle && !_rms.className) {
                  var _rmsFrag = document.createDocumentFragment();
                  while (_rms.firstChild) _rmsFrag.appendChild(_rms.firstChild);
                  if (_rms.parentNode) _rms.parentNode.replaceChild(_rmsFrag, _rms);
                }
              }
            });
            // Also unwrap semantic tags (<u>, <s>) for textDecoration
            if (cmd.property === 'textDecoration') {
              Array.from(target.querySelectorAll('u, s, strike')).forEach(function(_st) {
                var _sf = document.createDocumentFragment();
                while (_st.firstChild) _sf.appendChild(_st.firstChild);
                if (_st.parentNode) _st.parentNode.replaceChild(_sf, _st);
              });
            }
          }
          _appliedToSel = true;
          _savedRange = null; // DOM restructured; old range references are stale
          notifyStyleDebounced(target);
        }
        if (!_appliedToSel && _savedRange && !_savedRange.collapsed) {
          try {
            // --- Adjacent-span check: if ALL text nodes in range are inside same-value elements → toggle all off ---
            var _asAllStyled = false;
            var _asStyledNodes = [];
            try {
              var _asAdjCommon = _savedRange.commonAncestorContainer;
              if (_asAdjCommon.nodeType === 3) _asAdjCommon = _asAdjCommon.parentNode;
              var _asAdjWalker = document.createTreeWalker(_asAdjCommon, 4, null);
              var _asAdjN, _asAdjAllMatch = true;
              while ((_asAdjN = _asAdjWalker.nextNode())) {
                if (!_savedRange.intersectsNode(_asAdjN)) continue;
                var _asAdjUp = _asAdjN.parentElement;
                var _asAdjFound = null;
                while (_asAdjUp && _asAdjUp !== document.body) {
                  if (_asAdjUp.style && _asAdjUp.style[cmd.property] === cmd.value) { _asAdjFound = _asAdjUp; break; }
                  if (cmd.property === 'textDecoration') {
                    if (cmd.value === 'underline' && _asAdjUp.tagName === 'U') { _asAdjFound = _asAdjUp; break; }
                    if (cmd.value === 'line-through' && (_asAdjUp.tagName === 'S' || _asAdjUp.tagName === 'STRIKE')) { _asAdjFound = _asAdjUp; break; }
                  }
                  _asAdjUp = _asAdjUp.parentElement;
                }
                if (!_asAdjFound) { _asAdjAllMatch = false; break; }
                if (_asStyledNodes.indexOf(_asAdjFound) === -1) _asStyledNodes.push(_asAdjFound);
              }
              if (_asAdjAllMatch && _asStyledNodes.length > 0) _asAllStyled = true;
            } catch(_asAdjE) {}
            if (_asAllStyled) {
              _asStyledNodes.forEach(function(_asN) {
                var _asNTag = _asN.tagName;
                var _asNIsW = (_asNTag === 'SPAN' || _asNTag === 'U' || _asNTag === 'S' || _asNTag === 'STRIKE');
                if (_asN.style) _asN.style[cmd.property] = '';
                var _asNStyle = (_asN.getAttribute('style') || '').replace(/[\\s;]/g, '');
                if (_asNIsW && !_asNStyle && !_asN.className) {
                  var _asNFrag = document.createDocumentFragment();
                  while (_asN.firstChild) _asNFrag.appendChild(_asN.firstChild);
                  if (_asN.parentNode) _asN.parentNode.replaceChild(_asNFrag, _asN);
                }
              });
              _appliedToSel = true;
              _savedRange = null;
              notifyStyleDebounced(target);
            }
            // --- Toggle off: same value already applied → clear/unwrap matching ancestor ---
            if (!_appliedToSel && _savedRange) {
              var _asContainer = _savedRange.commonAncestorContainer;
              if (_asContainer.nodeType === 3) _asContainer = _asContainer.parentElement;
              var _asExistSpan = null;
              var _asWalk = _asContainer;
              while (_asWalk && _asWalk !== document.body) {
                var _asTag = _asWalk.tagName;
                // Match any element (not just SPAN) that has the property set to same value
                if (_asWalk.style && _asWalk.style[cmd.property] === cmd.value) {
                  _asExistSpan = _asWalk; break;
                }
                // Match semantic tags: <u> → underline, <s>/<strike> → line-through
                if (cmd.property === 'textDecoration') {
                  if (cmd.value === 'underline' && _asTag === 'U') { _asExistSpan = _asWalk; break; }
                  if (cmd.value === 'line-through' && (_asTag === 'S' || _asTag === 'STRIKE')) { _asExistSpan = _asWalk; break; }
                }
                _asWalk = _asWalk.parentElement;
              }
              if (_asExistSpan) {
                var _asETag = _asExistSpan.tagName;
                var _asIsWrapper = (_asETag === 'SPAN' || _asETag === 'U' || _asETag === 'S' || _asETag === 'STRIKE');
                if (_asExistSpan.style) _asExistSpan.style[cmd.property] = '';
                var _asStyleStr = (_asExistSpan.getAttribute('style') || '').replace(/[\\s;]/g, '');
                // Only unwrap inline wrappers (SPAN/U/S) with no remaining style — don't unwrap block elements
                if (_asIsWrapper && !_asStyleStr && !_asExistSpan.className) {
                  var _ph = document.createDocumentFragment();
                  while (_asExistSpan.firstChild) _ph.appendChild(_asExistSpan.firstChild);
                  if (_asExistSpan.parentNode) _asExistSpan.parentNode.replaceChild(_ph, _asExistSpan);
                }
                _appliedToSel = true;
                notifyStyleDebounced(target);
              }
            }
            // --- Normal path: wrap selection in a span ---
            if (!_appliedToSel && _savedRange) {
              var asel = window.getSelection();
              asel.removeAllRanges();
              asel.addRange(_savedRange);
              var aspan = document.createElement('span');
              aspan.style[cmd.property] = cmd.value;
              var _surroundOk = false;
              try {
                _savedRange.surroundContents(aspan);
                _surroundOk = true;
              } catch(e) {}
              if (!_surroundOk) {
                // Cross-node range: wrap each text node individually instead of extractContents
                var _rCommon = _savedRange.commonAncestorContainer;
                if (_rCommon.nodeType === 3) _rCommon = _rCommon.parentNode;
                var _rnodes = [];
                var _rWalker = document.createTreeWalker(_rCommon, 4, null);
                var _rn;
                while ((_rn = _rWalker.nextNode())) {
                  if (_savedRange.intersectsNode(_rn)) _rnodes.push(_rn);
                }
                var _firstCnSpan = null, _lastCnSpan = null;
                _rnodes.forEach(function(_rTextNode) {
                  var _nr = document.createRange();
                  var _ns = _rTextNode === _savedRange.startContainer ? _savedRange.startOffset : 0;
                  var _ne = _rTextNode === _savedRange.endContainer ? _savedRange.endOffset : (_rTextNode.textContent || '').length;
                  if (_ns >= _ne) return;
                  _nr.setStart(_rTextNode, _ns);
                  _nr.setEnd(_rTextNode, _ne);
                  var _ns2 = document.createElement('span');
                  _ns2.style[cmd.property] = cmd.value;
                  try {
                    _nr.surroundContents(_ns2);
                    if (!_firstCnSpan) _firstCnSpan = _ns2;
                    _lastCnSpan = _ns2;
                  } catch(_e2) {}
                });
                // Update _savedRange to span all newly created spans
                if (_firstCnSpan && _lastCnSpan) {
                  var _cnRange = document.createRange();
                  _cnRange.setStartBefore(_firstCnSpan);
                  _cnRange.setEndAfter(_lastCnSpan);
                  _savedRange = _cnRange;
                }
              }
              _appliedToSel = true;
              if (_surroundOk) {
                var _newRange = document.createRange();
                _newRange.selectNodeContents(aspan);
                _savedRange = _newRange;
              }
              notifyStyleDebounced(target);
            }
          } catch(e) {
            _savedRange = null; // clear only on failure
          }
        }
        if (!_appliedToSel && target) {
          target.style[cmd.property] = cmd.value;
          notifyStyleDebounced(target);
        }
        break;

      case 'remove-style':
        writeStyle(target, cmd.property, '');
        notifyDomChanged();
        break;

      case 'set-attr':
        if (target) { target.setAttribute(cmd.property, cmd.value); }
        notifyDomChanged();
        break;

      case 'remove-attr':
        if (target) { target.removeAttribute(cmd.property); }
        notifyDomChanged();
        break;

      case 'set-innerHTML':
        if (target) { target.innerHTML = sanitizeHtml(cmd.value); }
        notifyDomChanged();
        break;

      case 'set-inner-text':
        if (target) {
          // Refuse to nuke a real nested block (e.g. a <div><h1> that got
          // auto-tagged Texto on the wrapper) — textContent= would silently
          // delete it. StylesPanel already hides this field in that state;
          // this is the second line of defense for content saved before
          // that check existed, or reached via a direct command.
          var _sitBlocked = false;
          for (var _sitI = 0; _sitI < target.children.length; _sitI++) {
            if (BLOCK_LEVEL_TAGS.has(target.children[_sitI].tagName)) { _sitBlocked = true; break; }
          }
          if (_sitBlocked) {
            parent.postMessage({ type: 'command-rejected', command: 'set-inner-text', reason: 'block-children' }, _parentOrigin);
            break;
          }
          target.textContent = cmd.value || '';
        }
        notifyDomChanged();
        if (target === selectedEl) selectElement(target);
        break;

      case 'set-child-attr':
        if (target) {
          var chAttr = target.querySelector(cmd.selector);
          // No <a> exists and user is setting href on image → create wrapper <a>
          if (!chAttr && cmd.selector === 'a' && cmd.property === 'href' && cmd.value) {
            var _wrapImg = target.querySelector('img');
            if (_wrapImg) {
              chAttr = document.createElement('a');
              chAttr.setAttribute('target', '_blank');
              _wrapImg.parentNode.insertBefore(chAttr, _wrapImg);
              chAttr.appendChild(_wrapImg);
            }
          }
          if (chAttr) {
            if (cmd.value === '') {
              chAttr.removeAttribute(cmd.property);
              // Unwrap <a> with no href — but ONLY when it wraps just an
              // image (the "this image is no longer a link" case this was
              // written for). A Botón's <a> IS the button — all of its
              // background/padding/border-radius styling lives on that same
              // element, so unwrapping it on an empty URL used to destroy the
              // whole button. Leave a non-image <a> in place as an inert
              // (href-less) anchor instead; its styling survives.
              var _wrapsOnlyImg = cmd.selector === 'a' && chAttr.querySelector('img') && !(chAttr.textContent || '').trim();
              if (cmd.selector === 'a' && cmd.property === 'href' && !chAttr.getAttribute('href') && _wrapsOnlyImg) {
                var _unwrapFrag = document.createDocumentFragment();
                while (chAttr.firstChild) _unwrapFrag.appendChild(chAttr.firstChild);
                if (chAttr.parentNode) chAttr.parentNode.replaceChild(_unwrapFrag, chAttr);
              }
            } else {
              chAttr.setAttribute(cmd.property, cmd.value);
            }
          }
        }
        notifyDomChanged();
        break;

      case 'set-child-style':
        if (target) {
          var chSt = target.querySelector(cmd.selector);
          if (chSt) writeStyle(chSt, cmd.property, cmd.value);
        }
        notifyStyleDebounced(target);
        break;

      case 'set-child-text':
        if (target) {
          var chTxt = target.querySelector(cmd.selector);
          if (chTxt) chTxt.textContent = cmd.value || '';
        }
        notifyDomChanged();
        break;

      case 'set-children-style':
        if (target) {
          var chAllSt = target.querySelectorAll(cmd.selector);
          // Scope to the block's own table only — a cell/box built with a nested
          // <table> (e.g. a bordered inner box) must not have its borders/padding
          // changed by an edit meant for the outer Table/Columnas block.
          var _outerTable = target.tagName === 'TABLE' ? target : target.querySelector('table');
          for (var csi = 0; csi < chAllSt.length; csi++) {
            var _cell = chAllSt[csi];
            if (_outerTable && _cell.closest('table') !== _outerTable) continue;
            writeStyle(_cell, cmd.property, cmd.value);
          }
        }
        notifyStyleDebounced(target);
        break;

      case 'change-tag': {
        if (target) {
          var newEl = document.createElement(cmd.tag);
          for (var ai = 0; ai < target.attributes.length; ai++) {
            var a = target.attributes[ai];
            newEl.setAttribute(a.name, a.value);
          }
          // Optional attribute overrides applied in the SAME command as the
          // tag swap (e.g. Lista -> Lista Ordenada alongside ul -> ol) — doing
          // it in one round-trip avoids a second command racing the new
          // element's path, which only exists after this one lands.
          if (cmd.attrs) {
            for (var attrKey in cmd.attrs) {
              if (cmd.attrs.hasOwnProperty(attrKey)) newEl.setAttribute(attrKey, cmd.attrs[attrKey]);
            }
          }
          newEl.innerHTML = target.innerHTML;
          var headingSizes = { h1:'36px', h2:'28px', h3:'22px', h4:'18px', h5:'16px', h6:'14px' };
          var hSize = headingSizes[cmd.tag.toLowerCase()];
          if (hSize) newEl.style.fontSize = hSize;
          target.parentElement.replaceChild(newEl, target);
          notifyDomChanged();
          selectElement(newEl);
        }
        break;
      }

      case 'delete-element': {
        if (target) {
          if (target === selectedEl) {
            clearOutline(selectedEl, '', '');
            selectedEl = null;
          }
          var deleteParent = target.parentElement;
          var deleteParentType = deleteParent && deleteParent.getAttribute && deleteParent.getAttribute('data-block-type');
          var deleteIsNested = deleteParent && (deleteParent.tagName === 'TD' || deleteParentType === 'Contenedor');
          target.remove();
          if (deleteIsNested) {
            if (!hasRealChildren(deleteParent)) {
              // Sweep any filler debris too (e.g. the empty <p>s a broken
              // "<div> inside a <p>" template leaves behind) — a container
              // reported as having no real children should end up with
              // NOTHING but the fresh placeholder, not filler + placeholder.
              while (deleteParent.firstElementChild) deleteParent.removeChild(deleteParent.firstElementChild);
              deleteParent.appendChild(makePlaceholder());
            }
          } else {
            if (!hasRealChildren(document.body)) {
              var _bodyKids = [].slice.call(document.body.children);
              for (var _bkI = 0; _bkI < _bodyKids.length; _bkI++) {
                if (_bodyKids[_bkI].tagName !== 'SCRIPT' && _bodyKids[_bkI].tagName !== 'STYLE') document.body.removeChild(_bodyKids[_bkI]);
              }
              document.body.appendChild(makePlaceholder());
            }
          }
          notifyDomChanged();
          parent.postMessage({ type: 'deselect' }, _parentOrigin);
        }
        break;
      }

      case 'duplicate':
        if (target) {
          // TD/TH/TR/... are structural table pieces, not a "block" — cloning
          // one silently adds a column/row with no UI to remove it again
          // (column count elsewhere is display-only text). Reject instead of
          // corrupting the table; no notifyDomChanged means no undo entry either.
          if (TABLE_INT.has(target.tagName)) {
            parent.postMessage({ type: 'command-rejected', command: 'duplicate', reason: 'table-internal' }, _parentOrigin);
            break;
          }
          var clone = target.cloneNode(true);
          clone.style.outline = '';
          clone.style.outlineOffset = '';
          clone.removeAttribute('id');
          clone.removeAttribute('draggable');
          clone.removeAttribute('contenteditable');
          var _dupIds = clone.querySelectorAll('[id]');
          for (var _dI = 0; _dI < _dupIds.length; _dI++) _dupIds[_dI].removeAttribute('id');
          target.after(clone);
          notifyDomChanged();
          selectElement(clone);
        }
        break;

      case 'move-up':
        moveBlock(target, 'prev');
        break;

      case 'move-down':
        moveBlock(target, 'next');
        break;

      case 'select-parent':
        if (editingEl) exitEditing();
        if (target) {
          var par = target.parentElement;
          if (par && !IGNORE_TAGS.has(par.tagName)) selectElement(par);
        }
        break;

      case 'select-child':
        if (editingEl) exitEditing();
        if (target) {
          var _findChild = function(el) {
            for (var i = 0; i < el.children.length; i++) {
              var c = el.children[i];
              if (!IGNORE_TAGS.has(c.tagName) && !TABLE_INT.has(c.tagName)) return c;
              var deeper = _findChild(c);
              if (deeper) return deeper;
            }
            return null;
          };
          var ch = _findChild(target);
          if (ch) selectElement(ch);
        }
        break;

      case 'insert-html': {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = sanitizeHtml(cmd.html);
        var newEl = wrapper.firstElementChild;
        if (!newEl) { break; }
        var ref = target || document.body;
        // Placeholders are always CONSUMED, never left orphaned next to new
        // content — inserting "near" a placeholder means "fill this slot".
        if (ref === document.body) {
          var bodyChildren = document.body.children;
          var lastRealChild = null;
          for (var lci = bodyChildren.length - 1; lci >= 0; lci--) {
            if (!isInternalOverlayId(bodyChildren[lci].id)) { lastRealChild = bodyChildren[lci]; break; }
          }
          if (lastRealChild && lastRealChild.getAttribute && lastRealChild.getAttribute('data-block-type') === 'placeholder') {
            document.body.replaceChild(newEl, lastRealChild);
          } else if (lastRealChild) {
            lastRealChild.after(newEl);
          } else {
            document.body.appendChild(newEl);
          }
        } else if (cmd.position === 'inside' || cmd.position === 'center') {
          // Sweep every placeholder + filler node (not just the first match) —
          // a legacy container broken by invalid HTML nesting can look like
          // [empty <p>, placeholder, empty <p>]; all of it needs to go.
          var _refKids = [].slice.call(ref.children);
          for (var _rkI = 0; _rkI < _refKids.length; _rkI++) {
            var _rk = _refKids[_rkI];
            var _rkIsPlaceholder = _rk.getAttribute && _rk.getAttribute('data-block-type') === 'placeholder';
            if (_rkIsPlaceholder || isFillerNode(_rk)) ref.removeChild(_rk);
          }
          ref.appendChild(newEl);
        } else if (ref.getAttribute && ref.getAttribute('data-block-type') === 'placeholder') {
          ref.parentElement.replaceChild(newEl, ref);
        } else if (cmd.position === 'before') {
          ref.before(newEl);
        } else {
          ref.after(newEl);
        }
        notifyDomChanged();
        selectAfterImagesLoad(newEl);
        break;
      }

      case 'get-html':
        parent.postMessage({ type: 'html-response', html: document.documentElement.outerHTML }, _parentOrigin);
        break;

      case 'get-outerhtml':
        if (target) parent.postMessage({ type: 'outerhtml-response', html: target.outerHTML }, _parentOrigin);
        break;

      case 'replace-html': {
        var rWrapper = document.createElement('div');
        rWrapper.innerHTML = sanitizeHtml(cmd.html);
        var rNewEl = rWrapper.firstElementChild;
        if (rNewEl && target && target.parentElement) {
          target.parentElement.replaceChild(rNewEl, target);
          notifyDomChanged();
          selectAfterImagesLoad(rNewEl);
        }
        break;
      }

      // Add/remove a column from a Columnas table. Applied per-row (in
      // practice this app's Columnas blocks are single-row, but this stays
      // correct if a table ever has more), then every cell's width is
      // recalculated together so the columns stay evenly split.
      case 'columns-add': {
        if (target && target.tagName === 'TABLE') {
          var caRows = target.querySelectorAll('tr');
          for (var caRI = 0; caRI < caRows.length; caRI++) {
            var caCells = caRows[caRI].querySelectorAll('td, th');
            if (caCells.length >= 6) continue; // hard cap
            var caNewTd = document.createElement('td');
            caNewTd.setAttribute('style', 'padding:8px; vertical-align:top; border: 1px dashed transparent;');
            caNewTd.appendChild(makePlaceholder());
            caRows[caRI].appendChild(caNewTd);
          }
          var caFirstRowCells = target.querySelectorAll('tr:first-child > td, tr:first-child > th');
          var caPct = (100 / caFirstRowCells.length).toFixed(2) + '%';
          var caAllCells = target.querySelectorAll('tr > td, tr > th');
          for (var caCI = 0; caCI < caAllCells.length; caCI++) {
            caAllCells[caCI].style.width = caPct;
            caAllCells[caCI].setAttribute('width', caPct);
          }
          notifyDomChanged();
          selectElement(target);
        }
        break;
      }

      case 'columns-remove': {
        if (target && target.tagName === 'TABLE') {
          var crRows = target.querySelectorAll('tr');
          for (var crRI = 0; crRI < crRows.length; crRI++) {
            var crCells = crRows[crRI].querySelectorAll('td, th');
            if (crCells.length <= 1) continue; // never go below 1 column
            var crLastCell = crCells[crCells.length - 1];
            var crTargetCell = crCells[crCells.length - 2];
            // Move the removed cell's REAL content into the cell that stays
            // last, instead of discarding it — the user's own content should
            // never silently disappear just because the column layout changed.
            var crLastKids = [].slice.call(crLastCell.children);
            for (var crLkI = 0; crLkI < crLastKids.length; crLkI++) {
              var crLk = crLastKids[crLkI];
              var crIsPlaceholder = crLk.getAttribute && crLk.getAttribute('data-block-type') === 'placeholder';
              if (crIsPlaceholder || isFillerNode(crLk)) continue;
              crTargetCell.appendChild(crLk);
            }
            crLastCell.remove();
            if (!hasRealChildren(crTargetCell)) {
              while (crTargetCell.firstElementChild) crTargetCell.removeChild(crTargetCell.firstElementChild);
              crTargetCell.appendChild(makePlaceholder());
            }
          }
          var crFirstRowCells = target.querySelectorAll('tr:first-child > td, tr:first-child > th');
          var crPct = (100 / crFirstRowCells.length).toFixed(2) + '%';
          var crAllCells = target.querySelectorAll('tr > td, tr > th');
          for (var crCI = 0; crCI < crAllCells.length; crCI++) {
            crAllCells[crCI].style.width = crPct;
            crAllCells[crCI].setAttribute('width', crPct);
          }
          notifyDomChanged();
          selectElement(target);
        }
        break;
      }

      case 'get-tree': {
        function buildNode(el) {
          if (!el || el.nodeType !== 1) return null;
          if (IGNORE_TAGS.has(el.tagName)) return null;
          var kids = [];
          for (var ci = 0; ci < el.children.length; ci++) {
            var n = buildNode(el.children[ci]);
            if (n) kids.push(n);
          }
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            className: (el.className && typeof el.className === 'string') ? el.className.trim() : null,
            path: getElementPath(el),
            snippet: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50),
            children: kids
          };
        }
        parent.postMessage({ type: 'tree-response', tree: buildNode(document.body) }, _parentOrigin);
        break;
      }

      case 'deselect':
        if (selectedEl) { try { selectedEl.removeAttribute('draggable'); } catch(err) {} }
        clearOutline(selectedEl, '', '');
        selectedEl = null;
        break;

      case 'exec-command':
        // Auto-enter edit mode so format commands work without double-click
        if (!editingEl && target && !NON_EDITABLE_TAGS.has(target.tagName)) {
          editingEl = target;
          try { target.removeAttribute('draggable'); } catch(err) {}
          target.contentEditable = 'true';
          target.focus();
          var er = target.getBoundingClientRect();
          parent.postMessage({ type: 'editing-start', path: getElementPath(target), rect: { top: er.top + window.scrollY, left: er.left + window.scrollX, width: er.width, height: er.height } }, _parentOrigin);
        }
        // Restore saved text selection — clicking mini-bar button causes iframe blur
        // which collapses the selection; _savedRange preserves the last non-collapsed range
        if (_savedRange) {
          try {
            var _ecSel = window.getSelection();
            _ecSel.removeAllRanges();
            _ecSel.addRange(_savedRange);
          } catch(e) {}
        }
        // Detect CSS-inherited formatting on ancestor elements.
        // execCommand only toggles <u>/<b>/<i> tags — it cannot unset text-decoration/font-weight
        // applied via inline style on a parent element. When found, we handle it ourselves:
        // wrap the before/after text in spans with the original style, then remove it from the ancestor.
        var _cssInheritEl = null;
        var _cssInheritProp = null;
        var _cssInheritVal = null;
        var _cmdHandled = false;
        var _cssToggleMap = { underline: 'textDecoration', bold: 'fontWeight', italic: 'fontStyle' };
        if (_cssToggleMap[cmd.command] && _savedRange && !_savedRange.collapsed) {
          try {
            var _ctiProp = _cssToggleMap[cmd.command];
            var _ctiWalk = _savedRange.commonAncestorContainer;
            if (_ctiWalk.nodeType === 3) _ctiWalk = _ctiWalk.parentElement;
            while (_ctiWalk && _ctiWalk !== document.body) {
              if (_ctiWalk.style && _ctiWalk.style[_ctiProp]) {
                _cssInheritEl = _ctiWalk;
                _cssInheritProp = _ctiProp;
                _cssInheritVal = _ctiWalk.style[_ctiProp];
                break;
              }
              _ctiWalk = _ctiWalk.parentElement;
            }
          } catch(_ctie) {}
        }
        // Handle CSS-inherited case: split ancestor at selection boundaries
        // so only the unselected parts keep the style (via spans), not the selected text.
        if (_cssInheritEl && _cssInheritProp && _cssInheritVal) {
          try {
            var _ciStartNode = _savedRange.startContainer;
            var _ciStartOff = _savedRange.startOffset;
            var _ciEndNode = _savedRange.endContainer;
            var _ciEndOff = _savedRange.endOffset;
            // Wrap AFTER part first (no impact on start boundary)
            var _ciAfterOk = false;
            try {
              var _ciAfter = document.createRange();
              _ciAfter.setStart(_ciEndNode, _ciEndOff);
              _ciAfter.setEnd(_cssInheritEl, _cssInheritEl.childNodes.length);
              if (!_ciAfter.collapsed) {
                var _ciAfterSpan = document.createElement('span');
                _ciAfterSpan.style[_cssInheritProp] = _cssInheritVal;
                _ciAfter.surroundContents(_ciAfterSpan);
                _ciAfterOk = true;
              } else {
                _ciAfterOk = true; // collapsed = nothing to wrap, that's fine
              }
            } catch(_e1) {}
            // Wrap BEFORE part
            var _ciBeforeOk = false;
            try {
              var _ciBefore = document.createRange();
              _ciBefore.setStart(_cssInheritEl, 0);
              _ciBefore.setEnd(_ciStartNode, _ciStartOff);
              if (!_ciBefore.collapsed) {
                var _ciBeforeSpan = document.createElement('span');
                _ciBeforeSpan.style[_cssInheritProp] = _cssInheritVal;
                _ciBefore.surroundContents(_ciBeforeSpan);
                _ciBeforeOk = true;
              } else {
                _ciBeforeOk = true; // collapsed = nothing to wrap, that's fine
              }
            } catch(_e2) {}
            // Only clear ancestor style if at least one wrap succeeded — otherwise leave intact
            if (_ciAfterOk || _ciBeforeOk) {
              _cssInheritEl.style[_cssInheritProp] = '';
              if (!(_cssInheritEl.getAttribute('style') || '').replace(/[\\s;]/g, '')) {
                _cssInheritEl.removeAttribute('style');
              }
              _cmdHandled = true;
            }
          } catch(_ciErr) {}
        }
        if (!_cmdHandled) {
          try { document.execCommand(cmd.command, false, cmd.value || null); } catch(err) {}
        }
        // removeFormat: also unwrap CSS-styled spans that execCommand doesn't touch
        if (cmd.command === 'removeFormat' && target) {
          try {
            // Re-fetch live range AFTER execCommand — DOM has shifted, pre-mutation range is stale
            var _rfRange = (function() {
              var _s = window.getSelection();
              return _s && _s.rangeCount ? _s.getRangeAt(0) : null;
            })();
            var _rfRoot = editingEl || target;
            var _rfSpans = _rfRoot.querySelectorAll('span[style]');
            if (_rfRange && !_rfRange.collapsed) {
              // Non-collapsed selection: strip only spans that intersect it
              Array.from(_rfSpans).forEach(function(_rfSpan) {
                if (_rfRange.intersectsNode(_rfSpan)) {
                  var _rfFrag = document.createDocumentFragment();
                  while (_rfSpan.firstChild) _rfFrag.appendChild(_rfSpan.firstChild);
                  if (_rfSpan.parentNode) _rfSpan.parentNode.replaceChild(_rfFrag, _rfSpan);
                }
              });
            } else {
              // No selection / block-level click: strip ALL spans in the target element
              Array.from(_rfSpans).forEach(function(_rfSpan) {
                var _rfFrag = document.createDocumentFragment();
                while (_rfSpan.firstChild) _rfFrag.appendChild(_rfSpan.firstChild);
                if (_rfSpan.parentNode) _rfSpan.parentNode.replaceChild(_rfFrag, _rfSpan);
              });
              // Also remove semantic inline tags (<u>, <s>, <b>, <i>) from the entire element
              Array.from(target.querySelectorAll('u, s, strike, b, strong, i, em')).forEach(function(_st) {
                var _sf = document.createDocumentFragment();
                while (_st.firstChild) _sf.appendChild(_st.firstChild);
                if (_st.parentNode) _st.parentNode.replaceChild(_sf, _st);
              });
              target.style.textDecoration = '';
              target.style.fontWeight = '';
              target.style.fontStyle = '';
            }
          } catch(_rfe) {}
        }
        notifyDomChanged();
        break;

      case 'highlight':
        if (target) selectElement(target);
        break;

      case 'exit-editing':
        // Sent proactively by the parent when leaving the Editor tab, so an
        // in-progress edit (no click-away inside the canvas yet) still gets
        // saved and reflected in Preview/HTML instead of staying stuck live
        // in the DOM until the user happens to click something in the canvas.
        if (editingEl) exitEditing();
        break;
    }
  };
  window.addEventListener('message', _msgHandler);

  // ── Drag-drop (palette external + internal canvas reorder) ───────────────
  var dropIndicator = null;
  var dropTarget = null;
  var _dropPosition = 'after';
  var _rafId = null;
  var _dragleaveTimer = null;
  var _placeholderHighlighted = null;

  function removeDropIndicator() {
    if (dropIndicator) {
      if (dropIndicator.parentElement) dropIndicator.parentElement.removeChild(dropIndicator);
      dropIndicator = null;
    }
  }

  function highlightPlaceholderForDrop(el) {
    if (_placeholderHighlighted === el) return;
    clearPlaceholderHighlight();
    _placeholderHighlighted = el;
    el.__dragOrigBorder = el.style.border;
    el.__dragOrigBg = el.style.background;
    el.style.border = '2px solid #0045B0';
    el.style.background = 'rgba(0,69,176,0.10)';
  }

  function clearPlaceholderHighlight() {
    if (!_placeholderHighlighted) return;
    _placeholderHighlighted.style.border = _placeholderHighlighted.__dragOrigBorder || '';
    _placeholderHighlighted.style.background = _placeholderHighlighted.__dragOrigBg || '';
    _placeholderHighlighted = null;
  }

  function createDropIndicator() {
    var el = document.createElement('div');
    el.id = '__drop-indicator__';
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;box-sizing:border-box;border:2px dashed rgba(0,69,176,0.55);border-radius:8px;background:rgba(0,69,176,0.05);';
    document.documentElement.appendChild(el);
    return el;
  }

  function isSkippableSibling(el) {
    return !el || isInternalOverlayId(el.id) || el.tagName === 'SCRIPT' || el.tagName === 'STYLE';
  }

  // Sibling-only move — deliberately never walks up to a <tr> ancestor. An
  // earlier version did that when the target was the first/last child of a
  // TD, which silently moved the WHOLE ROW while the selection stayed on the
  // inner block (confusing, and one class of table corruption). Standard
  // market builders (Unlayer/Stripo) scope move-up/down to the current
  // container and no-op at its edges — escaping a column is done by
  // dragging, not by "up" enough times. isSkippableSibling above already
  // excludes the permanent box-model-overlay/drop-indicator divs and
  // SCRIPT/STYLE, so the last real block never "moves" behind an invisible one.
  function realSibling(el, dir) {
    var s = dir === 'prev' ? el.previousElementSibling : el.nextElementSibling;
    while (s && isSkippableSibling(s)) s = dir === 'prev' ? s.previousElementSibling : s.nextElementSibling;
    return s;
  }
  function moveBlock(el, dir) {
    if (!el) return;
    var sib = realSibling(el, dir);
    if (!sib) return; // already first/last among real siblings — no-op, no undo entry
    if (dir === 'prev') el.parentElement.insertBefore(el, sib);
    else sib.after(el);
    notifyDomChanged();
    selectElement(el);
  }

  // Nearest real sibling in the given direction — skipping overlay elements
  // (drop indicator, box-model overlay) and non-visual tags.
  function getAdjacentBlockRect(el, direction) {
    var sib = direction === 'before' ? el.previousElementSibling : el.nextElementSibling;
    while (sib && isSkippableSibling(sib)) {
      sib = direction === 'before' ? sib.previousElementSibling : sib.nextElementSibling;
    }
    return sib ? sib.getBoundingClientRect() : null;
  }

  function positionDropIndicator(refEl, pos) {
    if (!dropIndicator) return;
    var rect = refEl.getBoundingClientRect();
    var neighborRect = getAdjacentBlockRect(refEl, pos);
    var h, y;
    if (neighborRect) {
      // Center the indicator in the actual gap between refEl and its neighbor,
      // instead of a fixed-size bar hanging off refEl's own edge — otherwise a
      // small gap makes the indicator overlap deep into the neighbor (or stay
      // visually "inside" refEl), never reading as "between the two blocks".
      var gapTop = pos === 'before' ? neighborRect.bottom : rect.bottom;
      var gapBottom = pos === 'before' ? rect.top : neighborRect.top;
      var gap = gapBottom - gapTop;
      h = Math.min(Math.max(gap, 12), 60);
      y = gapTop + gap / 2 - h / 2;
    } else {
      h = Math.min(Math.max(rect.height, 40), 60);
      y = pos === 'before' ? rect.top - h - 4 : rect.bottom + 4;
    }
    dropIndicator.style.left = rect.left + 'px';
    dropIndicator.style.width = rect.width + 'px';
    dropIndicator.style.top = y + 'px';
    dropIndicator.style.height = h + 'px';
  }

  document.addEventListener('dragstart', function(e) {
    if (e.target && e.target === selectedEl) {
      _internalDragEl = e.target;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '__internal__');
      }
    }
  }, true);

  document.addEventListener('dragend', function(e) {
    _internalDragEl = null;
    removeDropIndicator();
    clearPlaceholderHighlight();
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_dragleaveTimer) { clearTimeout(_dragleaveTimer); _dragleaveTimer = null; }
    dropTarget = null;
  }, true);

  // Cancel the hide-timer when drag re-enters (layout shift may cause false dragleave)
  document.addEventListener('dragenter', function(e) {
    if (_dragleaveTimer) { clearTimeout(_dragleaveTimer); _dragleaveTimer = null; }
  });

  // Grace-period: only remove indicator 100ms after truly leaving the document
  document.addEventListener('dragleave', function(e) {
    if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
      if (_dragleaveTimer) clearTimeout(_dragleaveTimer);
      _dragleaveTimer = setTimeout(function() {
        removeDropIndicator();
        clearPlaceholderHighlight();
        dropTarget = null;
        _dragleaveTimer = null;
      }, 100);
    }
  });

  // A fixed 24px edge band was fine for a normal-height block but ate ~63% of
  // a freshly-inserted Columnas table (~76px tall, 24px top + 24px bottom) —
  // dropping on the visible placeholder inside it landed "outside" about half
  // the time. Scale the band down for short elements: 15% of the relevant
  // dimension, clamped to [6, 24]px.
  function edgeBand(size) {
    return Math.max(6, Math.min(24, size * 0.15));
  }

  // Pure computation, no side effects — resolves where a drop AT THESE COORDINATES
  // would land: { target, position: 'inside'|'before'|'after' }, or null. Called by
  // dragover (rAF-throttled, just for the visual indicator) AND synchronously by
  // 'drop' itself right before committing, so a fast move+release within the same
  // animation frame can't commit a stale target from an earlier point in the drag
  // path (e.g. a container's "inside" zone the cursor already left) — that race is
  // what caused a new block to land as a child/column instead of after the block.
  function computeDropTarget(e) {
    var el = e.target;
    while (el && el !== document.body && IGNORE_TAGS.has(el.tagName)) el = el.parentElement;
    if (!el || el === document.documentElement || el === dropIndicator) return null;
    if (el === document.body) {
      var bodyKids = document.body.children;
      var lastContent = null;
      for (var bki = bodyKids.length - 1; bki >= 0; bki--) {
        if (!isInternalOverlayId(bodyKids[bki].id)) { lastContent = bodyKids[bki]; break; }
      }
      el = lastContent || document.body;
    }
    if (_internalDragEl && (_internalDragEl === el || _internalDragEl.contains(el))) return null;
    var candidate = findBlockEl(el);
    if (!candidate) return null;

    // Imported templates have no data-block-type, so findBlockEl's fallback can
    // hand back a bare TD/TR from inside a horizontal table row (an icon row, a
    // 2-column layout built with <table>). before/after on a TD inserts a
    // sibling inside the same <tr> — renders BESIDE it, not below, and can
    // break the row's cell count. Walk up to the nearest ancestor outside the
    // table's internal structure (typically that row's own <table>) so
    // before/after acts on the whole row, not one cell of it.
    while (candidate && TABLE_INT.has(candidate.tagName) && candidate.parentElement) {
      candidate = candidate.parentElement;
    }
    if (!candidate || candidate === document.documentElement) return null;

    // A placeholder always wins "inside", checked on the RAW candidate before
    // any of the edge-band/reroute logic below gets a chance to overwrite it.
    // findBlockEl already resolves hovering anywhere inside a placeholder
    // (including its 24px SVG icon) to the placeholder element itself — so if
    // this check ran AFTER the Columnas-ancestor edge-band reroute further
    // down (which reassigns candidate to the whole table), a placeholder
    // near that table's top/bottom edge would already have been overwritten
    // away from before this ever got to look at it.
    if (candidate.getAttribute && candidate.getAttribute('data-block-type') === 'placeholder') {
      return { target: candidate, position: 'inside' };
    }

    var candidateBlockType = candidate.getAttribute && candidate.getAttribute('data-block-type');

    // Columnas block: check if cursor is inside any TD rect (both X+Y) — but only
    // away from the block's own top/bottom edge (same 24px margin used below for
    // "candidate is a descendant of a Columnas block"). Without this, dropping
    // right at the seam between a narrow-column block (e.g. a row of social
    // icons) and whatever comes next resolved to "inside" that narrow cell —
    // the new block landed squeezed into it instead of after the whole row.
    if (candidateBlockType === 'Columnas') {
      var colOuterRect = candidate.getBoundingClientRect();
      var colEdgeY = edgeBand(colOuterRect.height);
      var nearColumnsEdge = e.clientY < colOuterRect.top + colEdgeY || e.clientY > colOuterRect.bottom - colEdgeY;
      var colTds = nearColumnsEdge ? [] : candidate.querySelectorAll('td');
      for (var ci = 0; ci < colTds.length; ci++) {
        var tdR = colTds[ci].getBoundingClientRect();
        if (e.clientX >= tdR.left && e.clientX <= tdR.right &&
            e.clientY >= tdR.top  && e.clientY <= tdR.bottom) {
          return { target: colTds[ci], position: 'inside' };
        }
      }
    }

    // Contenedor block: 8px border zone → before/after; inside → drop as child
    if (candidateBlockType === 'Contenedor') {
      // If the container lays its children out in a row (flex/inline-*), an
      // 'inside' drop does appendChild (see 'insert-html' below) — the new
      // block would just become another item in that same row, squeezed next
      // to whatever's already there (an icon row, a flex footer section…),
      // instead of a full-width block. No pixel margin can fix that — the
      // container itself is the wrong kind of drop target, at any size.
      // flex-direction defaults to 'row' — but plenty of vertical stacks use
      // display:flex + flex-direction:column purely for the gap. Only 'flex'/
      // 'inline-flex' with an actual row direction count as row layout; the
      // inline-* values are inherently row-flow regardless of flex-direction.
      var contCs = window.getComputedStyle(candidate);
      var isRowLayout = (contCs.display === 'flex' || contCs.display === 'inline-flex')
        ? (contCs.flexDirection === 'row' || contCs.flexDirection === 'row-reverse')
        : (contCs.display === 'inline-block' || contCs.display === 'inline' || contCs.display === 'inline-table');
      if (!isRowLayout) {
        // Fixed 24px margin — a container shorter/narrower than 2x this simply
        // never offers 'inside' at all (an icon row isn't a sensible place to
        // append a new block either), only before/after the whole thing.
        var contRect = candidate.getBoundingClientRect();
        var contEdgeX = edgeBand(contRect.width);
        var contEdgeY = edgeBand(contRect.height);
        if (e.clientX > contRect.left + contEdgeX && e.clientX < contRect.right - contEdgeX &&
            e.clientY > contRect.top  + contEdgeY && e.clientY < contRect.bottom - contEdgeY) {
          return { target: candidate, position: 'inside' };
        }
      }
    }

    // If candidate's own parent is a Contenedor laid out as a row (flex/inline-*),
    // before/after on the candidate itself inserts as a DOM sibling — which, in a
    // flex row, renders BESIDE the candidate, not below it, even though the
    // indicator (sized from the candidate's own narrow rect) reads as a below/above
    // bar. Same problem the direct-hover check above solves, but for children
    // inside the row instead of the row container itself. Reroute to the row so
    // before/after targets the whole row, matching what the drop actually does.
    var rowParent = candidate.parentElement;
    if (rowParent && rowParent !== document.body && rowParent.getAttribute &&
        rowParent.getAttribute('data-block-type') === 'Contenedor') {
      var rowParentCs = window.getComputedStyle(rowParent);
      var rowParentIsRow = (rowParentCs.display === 'flex' || rowParentCs.display === 'inline-flex')
        ? (rowParentCs.flexDirection === 'row' || rowParentCs.flexDirection === 'row-reverse')
        : (rowParentCs.display === 'inline-block' || rowParentCs.display === 'inline' || rowParentCs.display === 'inline-table');
      if (rowParentIsRow) {
        candidate = rowParent;
      }
    }

    // If candidate is a child inside a Columnas block, check if cursor is near the
    // top/bottom edge of the whole table. If so, reroute to drop before/after the
    // entire Columnas block instead of inside a column cell.
    var columnsAncestor = null;
    var walkUpEl = candidate.parentElement;
    while (walkUpEl && walkUpEl !== document.body) {
      if (walkUpEl.getAttribute && walkUpEl.getAttribute('data-block-type') === 'Columnas') {
        columnsAncestor = walkUpEl;
        break;
      }
      walkUpEl = walkUpEl.parentElement;
    }
    if (columnsAncestor) {
      var caRect = columnsAncestor.getBoundingClientRect();
      var caEdgeY = edgeBand(caRect.height);
      if (e.clientY < caRect.top + caEdgeY || e.clientY > caRect.bottom - caEdgeY) {
        candidate = columnsAncestor;
      }
    }

    // Determine before/after based on cursor Y vs element midpoint
    var candidateRect = candidate.getBoundingClientRect();
    var newPosition = e.clientY < (candidateRect.top + candidateRect.height / 2) ? 'before' : 'after';
    return { target: candidate, position: newPosition };
  }

  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = _internalDragEl ? 'move' : 'copy';
    var result = computeDropTarget(e);
    if (!result) return;

    if (result.position === 'inside') {
      removeDropIndicator();
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      highlightPlaceholderForDrop(result.target);
      dropTarget = result.target;
      _dropPosition = 'inside';
      return;
    }

    clearPlaceholderHighlight();
    if (_rafId && result.target === dropTarget && result.position === _dropPosition) return;
    if (_rafId) { cancelAnimationFrame(_rafId); }
    _rafId = requestAnimationFrame(function() {
      _rafId = null;
      dropTarget = result.target;
      _dropPosition = result.position;
      if (!dropIndicator) dropIndicator = createDropIndicator();
      positionDropIndicator(dropTarget, _dropPosition);
    });
  });

  document.addEventListener('drop', function(e) {
    e.preventDefault();
    removeDropIndicator();
    clearPlaceholderHighlight();
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_dragleaveTimer) { clearTimeout(_dragleaveTimer); _dragleaveTimer = null; }
    // Recompute from the drop event's own coordinates instead of trusting the
    // cached dropTarget/_dropPosition — see computeDropTarget's comment.
    var finalDrop = computeDropTarget(e);
    if (finalDrop) { dropTarget = finalDrop.target; _dropPosition = finalDrop.position; }
    if (_internalDragEl) {
      if (dropTarget && dropTarget !== _internalDragEl && !_internalDragEl.contains(dropTarget)) {
        var dragSourceParent = _internalDragEl.parentElement;
        var dragSourceType = dragSourceParent && dragSourceParent.getAttribute && dragSourceParent.getAttribute('data-block-type');
        var dragSourceIsContainer = dragSourceParent && (dragSourceParent.tagName === 'TD' || dragSourceType === 'Contenedor');
        if (_dropPosition === 'inside') {
          if (dropTarget.getAttribute('data-block-type') === 'placeholder') {
            dropTarget.parentElement.replaceChild(_internalDragEl, dropTarget);
          } else {
            var dragInsidePh = dropTarget.querySelector('[data-block-type="placeholder"]');
            if (dragInsidePh) dragInsidePh.remove();
            dropTarget.appendChild(_internalDragEl);
          }
        } else if (_dropPosition === 'before') {
          dropTarget.before(_internalDragEl);
        } else {
          dropTarget.after(_internalDragEl);
        }
        // If block moved out of a TD/Contenedor, restore placeholder if now empty
        if (dragSourceIsContainer && dragSourceParent !== _internalDragEl.parentElement) {
          if (!hasRealChildren(dragSourceParent)) {
            while (dragSourceParent.firstElementChild) dragSourceParent.removeChild(dragSourceParent.firstElementChild);
            dragSourceParent.appendChild(makePlaceholder());
          }
        }
        notifyDomChanged();
        selectElement(_internalDragEl);
      }
      _internalDragEl = null;
      dropTarget = null;
    } else {
      if (!dropTarget) return;
      var path = getElementPath(dropTarget);
      var isPlaceholder = dropTarget.getAttribute('data-block-type') === 'placeholder';
      parent.postMessage({ type: 'drop-request', path: path, position: _dropPosition, isPlaceholder: isPlaceholder }, _parentOrigin);
      dropTarget = null;
    }
  });

  // Prevent link navigation in the editor canvas — links are content, not actions
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && el.tagName === 'A') e.preventDefault();
  }, true);

  // HOVER BOTTOM EDGE → notify parent to show "+" add button
  var _hoverBottomEl = null;
  document.addEventListener('mousemove', function(e) {
    var el = e.target;
    // Only block hover-bottom detection when cursor is INSIDE the editing element.
    // If cursor moved outside (to another block), still detect "+" so it stays usable.
    if (editingEl && el && editingEl.contains(el)) {
      if (_hoverBottomEl !== null) {
        _hoverBottomEl = null;
        parent.postMessage({ type: 'hover-block-bottom', rect: null, path: null }, _parentOrigin);
      }
      return;
    }
    var block = null;
    var _dbgStep = 'none';
    // Nearest ancestor with a data-block-type, checked FIRST and independent
    // of what el itself is — a placeholder's inner 24px SVG icon has no
    // data-block-type of its own, so without this upfront check the walk
    // below would treat the icon as if it were outside the placeholder
    // entirely and anchor the "+" to it.
    var insidePlaceholder = false;
    if (el && el !== document.body && el !== document.documentElement) {
      var _phCur = el;
      while (_phCur && _phCur !== document.body) {
        if (_phCur.getAttribute && _phCur.getAttribute('data-block-type')) {
          insidePlaceholder = _phCur.getAttribute('data-block-type') === 'placeholder';
          break;
        }
        _phCur = _phCur.parentElement;
      }
    }
    if (!insidePlaceholder && el && el !== document.body && el !== document.documentElement) {
      var cur = el;
      while (cur && cur !== document.body) {
        if (cur.getAttribute && cur.getAttribute('data-block-type')) { block = cur; break; }
        cur = cur.parentElement;
      }
      if (block) _dbgStep = 'data-block-type';
      // Fallback for imported templates: walk up from e.target and find the first
      // non-IGNORE, non-TABLE_INT, non-inline-formatting element the cursor is
      // hovering in/near. TABLE_INT (TD/TR/TH etc.) are excluded because inserting
      // after them breaks table structure; INLINE_FORMAT_TAGS (SPAN, STRONG…) are
      // excluded so the "+" anchors to the paragraph, not a formatted word inside it.
      // DIV, P, H1-H6, IMG, A… remain valid insert targets. tagName is upper-cased
      // before the Set lookups — an inline <svg>/<path> keeps the lowercase tagName
      // it was authored with (SVG is case-sensitive XML, unlike HTML), so a raw
      // comparison against these all-uppercase Sets silently never matched it,
      // letting a tiny icon slip through as a "valid" hover target.
      if (!block) {
        var wb = el;
        while (wb && wb !== document.body && wb !== document.documentElement) {
          var wbTag = String(wb.tagName || '').toUpperCase();
          var wbType = wb.getAttribute && wb.getAttribute('data-block-type');
          if (!IGNORE_TAGS.has(wbTag) && !TABLE_INT.has(wbTag) && !INLINE_FORMAT_TAGS.has(wbTag) && wbType !== 'placeholder') {
            var wbBr = wb.getBoundingClientRect();
            // max(50%, 30px): short elements (single-line span/p) always get a 30px zone
            var wbZone = Math.max(wbBr.height * 0.5, 30);
            if (wbBr.height > 5 && e.clientY >= wbBr.bottom - wbZone && e.clientY <= wbBr.bottom + 10) {
              block = wb; _dbgStep = 'walk-bottom'; break;
            }
          }
          wb = wb.parentElement;
        }
      }
      // Last resort: selected element — trigger in the bottom half.
      // Exclude TABLE_INT (TD/TR etc.) — inserting after a table cell is invalid
      // HTML — and exclude a selected placeholder itself (the other two branches
      // above already exclude placeholders; this was the one fallback that didn't).
      var _fromFallback = false;
      if (!block && selectedEl && !IGNORE_TAGS.has(selectedEl.tagName) && !TABLE_INT.has(selectedEl.tagName) &&
          selectedEl.getAttribute('data-block-type') !== 'placeholder') {
        var selBr = selectedEl.getBoundingClientRect();
        var selThresh = Math.min(selBr.top + selBr.height * 0.5, selBr.bottom - 10);
        if (e.clientY >= selThresh) { block = selectedEl; _dbgStep = 'selectedEl'; _fromFallback = true; }
      }
      // For data-block-type blocks, use lower-50% threshold (much easier to hit than strict 20px).
      // Fallback blocks already have their own threshold — skip the gate.
      if (block && !_fromFallback && _dbgStep === 'data-block-type') {
        var br = block.getBoundingClientRect();
        var addThresh = Math.min(br.top + br.height * 0.5, br.bottom - 10);
        if (e.clientY < addThresh) { block = null; _dbgStep = 'cleared-not-near-bottom'; }
      }
    }
    if (block !== _hoverBottomEl) {
      _hoverBottomEl = block;
      if (block) {
        var r = block.getBoundingClientRect();
        parent.postMessage({ type: 'hover-block-bottom', rect: { top: r.top, left: r.left, width: r.width, height: r.height }, path: getElementPath(block) }, _parentOrigin);
      } else {
        parent.postMessage({ type: 'hover-block-bottom', rect: null, path: null }, _parentOrigin);
      }
    }
  });

  // Push body height to parent — runs every 300ms for 6s after load, then stops.
  // Covers late image loads, fonts, and dynamic content without relying on parent timing.
  // Backup: if template CSS resists the height:auto override and the iframe still scrolls
  // internally, notify parent so it can clear the overlay and resync after scroll settles.
  var _iframeScrollTimer = null;
  var _scrollHandler = function() {
    parent.postMessage({ type: 'iframe-internal-scroll' }, _parentOrigin);
    clearTimeout(_iframeScrollTimer);
    _iframeScrollTimer = setTimeout(function() {
      _iframeScrollTimer = null;
      if (selectedEl) selectElement(selectedEl);
    }, 150);
  };
  window.addEventListener('scroll', _scrollHandler);

  // Save text selection so StylesPanel can apply styles to selected words
  var _savedRange = null;
  document.addEventListener('selectionchange', function() {
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      _savedRange = sel.getRangeAt(0).cloneRange();
      parent.postMessage({ type: 'canvas-text-selection', selectedText: sel.toString() }, _parentOrigin);
    }
    // Do NOT clear _savedRange on collapse — clicking parent frame collapses iframe
    // selection, but _savedRange must survive until apply-style-to-selection runs.
  });

  var _heightPushCount = 0;
  var _heightPushTimer = setInterval(function() {
    _heightPushCount++;
    var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    parent.postMessage({ type: 'body-height', height: h }, _parentOrigin);
    if (_heightPushCount >= 20) clearInterval(_heightPushTimer);
  }, 300);

  var _unloadHandler = function() {
    if (_heightPushTimer) clearInterval(_heightPushTimer);
  };
  window.addEventListener('beforeunload', _unloadHandler);

  window.__canvasBridgeCleanup = function() {
    window.removeEventListener('message', _msgHandler);
    window.removeEventListener('scroll', _scrollHandler);
    window.removeEventListener('beforeunload', _unloadHandler);
    window.__canvasBridgeActive = false;
    window.__canvasBridgeCleanup = null;
  };

  parent.postMessage({ type: 'bridge-ready' }, _parentOrigin);
})();
`;
