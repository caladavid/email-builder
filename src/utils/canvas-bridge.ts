export const CANVAS_BRIDGE_CODE = `
(function () {
  'use strict';
  if (window.__canvasBridgeCleanup) { try { window.__canvasBridgeCleanup(); } catch(e) {} }
  if (window.__canvasBridgeActive) return;
  window.__canvasBridgeActive = true;

  // Capture parent origin from first incoming message so postMessage calls are not sent with '*'
  var _parentOrigin = '*';
  var _parentOriginCaptured = false;

  // Basic XSS sanitizer — strips <script> tags, javascript: protocol, and inline event handlers.
  // DOMPurify is not available in this iframe context; origin validation is the primary guard.
  // IMPORTANT: inside this template literal, regex meta-escapes need \\ so that \s/\w/\b
  // survive template-literal evaluation as \s/\w/\b in the injected script.
  // \/ also needs \\ so the slash does not prematurely close the regex.
  function sanitizeHtml(html) {
    return (html || '')
      .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
      .replace(/\\bon\\w+\\s*=\\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, 'javascript_disabled:');
  }

  const IGNORE_TAGS = new Set(['HTML', 'HEAD', 'BODY', 'STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'NOSCRIPT']);
  // Denylist: any element NOT in this set can be inline-edited on dblclick
  const NON_EDITABLE_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'COLGROUP', 'COL', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'BR', 'HR', 'WBR']);
  const TABLE_INT = new Set(['TR', 'TD', 'TH', 'TBODY', 'THEAD', 'TFOOT', 'COLGROUP', 'COL']);

  var hoveredEl = null;
  var selectedEl = null;
  var editingEl = null;
  var prevHoverOutline = '';
  var prevSelOutline = '';
  var prevSelOutlineOffset = '';
  var _internalDragEl = null;
  var _selectGen = 0; // cancels stale selectAfterImagesLoad callbacks

  function makePlaceholder() {
    var _ph = document.createElement('div');
    _ph.setAttribute('data-block-type', 'placeholder');
    _ph.setAttribute('style', 'margin:0 auto;width:100%;min-height:60px;border:2px dashed #c7d8f5;border-radius:6px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;');
    _ph.innerHTML = '<svg width="24" height="24" viewBox="0 0 40 40" fill="none" style="pointer-events:none;"><path d="M20 11v18M11 20h18" stroke="#0045B0" stroke-width="2.5" stroke-linecap="round"/></svg>';
    return _ph;
  }

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
    // No data-block-type — select the clicked element itself (skip ignored tags)
    var target = el;
    while (target && (IGNORE_TAGS.has(target.tagName) || target === document.body || target === document.documentElement)) {
      target = target.parentElement;
    }
    return target || null;
  }

  function getElementPath(el) {
    if (!el || el === document.body) return 'body';
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var parent = cur.parentElement;
      if (!parent) break;
      var siblings = Array.from(parent.children).filter(function(s) { return s.tagName === cur.tagName; });
      var sel = cur.tagName.toLowerCase();
      if (siblings.length > 1) {
        var idx = siblings.indexOf(cur);
        sel += ':nth-of-type(' + (idx + 1) + ')';
      }
      parts.unshift(sel);
      cur = parent;
    }
    return 'body > ' + parts.join(' > ');
  }

  function getElementStyles(el) {
    var cs = window.getComputedStyle(el);
    var s = el.style;
    function pick(inline, computed) { return inline || computed || ''; }
    return {
      color: pick(s.color, cs.color),
      backgroundColor: pick(s.backgroundColor, cs.backgroundColor),
      fontSize: pick(s.fontSize, cs.fontSize),
      fontFamily: pick(s.fontFamily, cs.fontFamily),
      fontWeight: pick(s.fontWeight, cs.fontWeight),
      fontStyle: pick(s.fontStyle, cs.fontStyle),
      textAlign: (function(v){ return v==='start'?'left':v==='end'?'right':v; })(pick(s.textAlign, cs.textAlign)),
      lineHeight: pick(s.lineHeight, cs.lineHeight),
      letterSpacing: pick(s.letterSpacing, cs.letterSpacing),
      paddingTop: pick(s.paddingTop, cs.paddingTop),
      paddingRight: pick(s.paddingRight, cs.paddingRight),
      paddingBottom: pick(s.paddingBottom, cs.paddingBottom),
      paddingLeft: pick(s.paddingLeft, cs.paddingLeft),
      marginTop: pick(s.marginTop, cs.marginTop),
      marginRight: pick(s.marginRight, cs.marginRight),
      marginBottom: pick(s.marginBottom, cs.marginBottom),
      marginLeft: pick(s.marginLeft, cs.marginLeft),
      width: pick(s.width, cs.width),
      height: pick(s.height, cs.height),
      maxWidth: pick(s.maxWidth, cs.maxWidth),
      borderWidth: pick(s.borderWidth, cs.borderWidth),
      borderColor: pick(s.borderColor, cs.borderColor),
      borderStyle: pick(s.borderStyle, cs.borderStyle),
      borderRadius: pick(s.borderRadius, cs.borderRadius),
      textDecoration: pick(s.textDecoration, cs.textDecoration),
      display: pick(s.display, cs.display),
    };
  }

  function getElementAttrs(el) {
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  function notifyDomChanged() {
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
    var html = document.documentElement.outerHTML;
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
    parent.postMessage({ type: 'dom-changed', html: html }, _parentOrigin);
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
      if (_styleDebTarget && _styleDebTarget === selectedEl) selectElement(_styleDebTarget);
      _styleDebTarget = null;
    }, 120);
  }

  function clearOutline(el, outline, outlineOffset) {
    if (!el) return;
    el.style.outline = outline || '';
    el.style.outlineOffset = outlineOffset || '';
  }

  function selectElement(el) {
    if (!el) return;
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
        childData.btnPaddingH = btnA.style.paddingLeft || '20';
        childData.btnPaddingV = btnA.style.paddingTop || '12';
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
      var colTds = el.querySelectorAll('tr:first-child > td, tr:first-child > th');
      childData.columnsCount = String(colTds.length);
      childData.colGap = colTds[0] ? (colTds[0].style.paddingLeft || '8').replace('px', '') : '8';
      for (var ci = 0; ci < colTds.length; ci++) {
        childData['col_' + ci + '_width'] = colTds[ci].style.width || '';
      }
    } else if (blockType === 'Table') {
      var firstTd = el.querySelector('td');
      if (firstTd) {
        childData.cellBorderColor = firstTd.style.borderColor || firstTd.style.borderTopColor || '#cccccc';
        childData.cellBorderWidth = (firstTd.style.borderWidth || firstTd.style.borderTopWidth || '1').replace('px', '');
        childData.cellPadding = (firstTd.style.padding || firstTd.style.paddingTop || '8').replace('px', '');
      }
    } else if (blockType === 'video') {
      var vidEl = el.querySelector('video');
      if (vidEl) {
        childData.src = vidEl.getAttribute('src') || '';
        childData.poster = vidEl.getAttribute('poster') || '';
        childData.controls = vidEl.hasAttribute('controls') ? 'controls' : null;
        childData.autoplay = vidEl.hasAttribute('autoplay') ? 'autoplay' : null;
      }
    }
    parent.postMessage({
      type: 'select',
      path: getElementPath(el),
      styles: getElementStyles(el),
      attrs: getElementAttrs(el),
      tagName: el.tagName,
      blockType: blockType || null,
      innerText: (el.innerText || '').trim().slice(0, 200),
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
  }, true);

  document.addEventListener('mouseout', function (e) {
    var el = e.target;
    if (!el || el === selectedEl || el === editingEl) return;
    if (el.style && el.style.outline.includes('dashed')) {
      el.style.outline = prevHoverOutline || '';
    }
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

  // CLICK → SELECT (walk up to block root, fallback to direct body child for imported templates)
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (editingEl) {
      if (!editingEl.contains(el)) {
        exitEditing();
      } else {
        // Click inside editing element — if it's a distinct named sub-block, escape and select it
        var innerBlock = findBlockEl(el);
        if (innerBlock && innerBlock !== editingEl && innerBlock.getAttribute('data-block-type')) {
          exitEditing();
          // fall through to selectElement(innerBlock) below
        } else {
          return; // just move cursor
        }
      }
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
    notifyDomChanged();
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
    var imgs = el.querySelectorAll('img');
    if (imgs.length === 0) {
      if (gen === _selectGen) selectElement(el);
      return;
    }
    var pending = imgs.length;
    function done() {
      pending--;
      if (pending <= 0 && gen === _selectGen) selectElement(el);
    }
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) { done(); }
      else {
        (function(img) {
          var t = setTimeout(done, 5000);
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
        if (target) { target.style[cmd.property] = cmd.value; }
        notifyStyleDebounced(target);
        break;

      case 'remove-style':
        if (target) { target.style[cmd.property] = ''; }
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
        if (target) { target.textContent = cmd.value || ''; }
        notifyDomChanged();
        if (target === selectedEl) selectElement(target);
        break;

      case 'set-child-attr':
        if (target) {
          var chAttr = target.querySelector(cmd.selector);
          if (chAttr) {
            if (cmd.value === '') {
              chAttr.removeAttribute(cmd.property);
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
          if (chSt) chSt.style[cmd.property] = cmd.value;
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
          for (var csi = 0; csi < chAllSt.length; csi++) {
            chAllSt[csi].style[cmd.property] = cmd.value;
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
            var nestedKids = [].slice.call(deleteParent.children).filter(function(c) {
              return c.tagName !== 'SCRIPT' && c.getAttribute('data-block-type') !== 'placeholder';
            });
            if (nestedKids.length === 0) deleteParent.appendChild(makePlaceholder());
          } else {
            var remaining = [].slice.call(document.body.children).filter(function(c) { return c.tagName !== 'SCRIPT'; });
            if (remaining.length === 0) document.body.appendChild(makePlaceholder());
          }
          notifyDomChanged();
          parent.postMessage({ type: 'deselect' }, _parentOrigin);
        }
        break;
      }

      case 'duplicate':
        if (target) {
          var clone = target.cloneNode(true);
          clone.style.outline = '';
          clone.style.outlineOffset = '';
          target.after(clone);
          notifyDomChanged();
          selectElement(clone);
        }
        break;

      case 'move-up':
        if (target) {
          var moveUp = (target.tagName === 'TD' || target.tagName === 'TH') && target.parentElement
            ? target.parentElement : target;
          var prev = moveUp.previousElementSibling;
          if (!prev) break;
          moveUp.parentElement.insertBefore(moveUp, prev);
          notifyDomChanged();
          selectElement(target);
        }
        break;

      case 'move-down':
        if (target) {
          var moveDown = (target.tagName === 'TD' || target.tagName === 'TH') && target.parentElement
            ? target.parentElement : target;
          var next = moveDown.nextElementSibling;
          if (!next) break;
          next.after(moveDown);
          notifyDomChanged();
          selectElement(target);
        }
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
        if (ref === document.body) {
          var lastChild = document.body.lastElementChild;
          if (lastChild) { lastChild.after(newEl); }
          else { document.body.appendChild(newEl); }
        } else if (cmd.position === 'inside' || cmd.position === 'center') {
          var insidePh = ref.querySelector('[data-block-type="placeholder"]');
          if (insidePh) insidePh.remove();
          ref.appendChild(newEl);
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
        try { document.execCommand(cmd.command, false, cmd.value || null); } catch(err) {}
        notifyDomChanged();
        break;

      case 'highlight':
        if (target) selectElement(target);
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

  function positionDropIndicator(refEl, pos) {
    if (!dropIndicator) return;
    var rect = refEl.getBoundingClientRect();
    var h = Math.min(Math.max(rect.height, 40), 60);
    var y = pos === 'before' ? rect.top - h - 4 : rect.bottom + 4;
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

  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = _internalDragEl ? 'move' : 'copy';
    var el = e.target;
    while (el && el !== document.body && IGNORE_TAGS.has(el.tagName)) el = el.parentElement;
    if (!el || el === document.documentElement || el === dropIndicator) return;
    if (el === document.body) {
      var bodyKids = document.body.children;
      var lastContent = null;
      for (var bki = bodyKids.length - 1; bki >= 0; bki--) {
        if (bodyKids[bki].id !== '__drop-indicator__') { lastContent = bodyKids[bki]; break; }
      }
      el = lastContent || document.body;
    }
    if (_internalDragEl && (_internalDragEl === el || _internalDragEl.contains(el))) return;
    var candidate = findBlockEl(el);
    if (!candidate) return;

    var candidateBlockType = candidate.getAttribute && candidate.getAttribute('data-block-type');

    // Columnas block: check if cursor is inside any TD rect (both X+Y).
    // Inside TD → drop inside that cell. Outside all TDs → before/after whole block.
    if (candidateBlockType === 'Columnas') {
      var colTds = candidate.querySelectorAll('td');
      var targetTd = null;
      for (var ci = 0; ci < colTds.length; ci++) {
        var tdR = colTds[ci].getBoundingClientRect();
        if (e.clientX >= tdR.left && e.clientX <= tdR.right &&
            e.clientY >= tdR.top  && e.clientY <= tdR.bottom) {
          targetTd = colTds[ci]; break;
        }
      }
      if (targetTd) {
        removeDropIndicator();
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
        highlightPlaceholderForDrop(targetTd);
        dropTarget = targetTd;
        _dropPosition = 'inside';
        return;
      }
    }

    // Contenedor block: 8px border zone → before/after; inside → drop as child
    if (candidateBlockType === 'Contenedor') {
      var contRect = candidate.getBoundingClientRect();
      if (e.clientX > contRect.left + 8 && e.clientX < contRect.right - 8 &&
          e.clientY > contRect.top  + 8 && e.clientY < contRect.bottom - 8) {
        removeDropIndicator();
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
        highlightPlaceholderForDrop(candidate);
        dropTarget = candidate;
        _dropPosition = 'inside';
        return;
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
      var EDGE_PX = 24;
      if (e.clientY < caRect.top + EDGE_PX || e.clientY > caRect.bottom - EDGE_PX) {
        candidate = columnsAncestor;
      }
    }

    // Walk up to find placeholder ancestor
    var phEl = candidate;
    while (phEl && phEl !== document.body) {
      if (phEl.getAttribute && phEl.getAttribute('data-block-type') === 'placeholder') break;
      phEl = phEl.parentElement;
    }
    var isOverPlaceholder = phEl && phEl !== document.body;

    if (isOverPlaceholder) {
      removeDropIndicator();
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      highlightPlaceholderForDrop(phEl);
      dropTarget = phEl;
      _dropPosition = 'inside';
      return;
    }

    clearPlaceholderHighlight();
    // Determine before/after based on cursor Y vs element midpoint
    var candidateRect = candidate.getBoundingClientRect();
    var newPosition = e.clientY < (candidateRect.top + candidateRect.height / 2) ? 'before' : 'after';
    if (_rafId && candidate === dropTarget && newPosition === _dropPosition) return;
    if (_rafId) { cancelAnimationFrame(_rafId); }
    _rafId = requestAnimationFrame(function() {
      _rafId = null;
      dropTarget = candidate;
      _dropPosition = newPosition;
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
          var srcKids = [].slice.call(dragSourceParent.children).filter(function(c) {
            return c.tagName !== 'SCRIPT' && c.getAttribute('data-block-type') !== 'placeholder';
          });
          if (srcKids.length === 0) dragSourceParent.appendChild(makePlaceholder());
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
    if (el && el !== document.body && el !== document.documentElement) {
      var cur = el;
      while (cur && cur !== document.body) {
        if (cur.getAttribute && cur.getAttribute('data-block-type')) { block = cur; break; }
        cur = cur.parentElement;
      }
      if (block && block.getAttribute('data-block-type') === 'placeholder') block = null;
      if (block) _dbgStep = 'data-block-type';
      // Fallback for imported templates: walk up from e.target and find the first
      // non-IGNORE, non-TABLE_INT element the cursor is hovering in/near.
      // TABLE_INT (TD/TR/TH etc.) are excluded because inserting after them breaks table structure.
      // Everything else (SPAN, STRONG, DIV, P, H1-H6, IMG, A…) is a valid insert target.
      if (!block) {
        var wb = el;
        while (wb && wb !== document.body && wb !== document.documentElement) {
          var wbType = wb.getAttribute && wb.getAttribute('data-block-type');
          if (!IGNORE_TAGS.has(wb.tagName) && !TABLE_INT.has(wb.tagName) && wbType !== 'placeholder') {
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
      // Last resort: selected element — trigger in the bottom half
      // Exclude TABLE_INT (TD/TR etc.) — inserting after a table cell is invalid HTML
      var _fromFallback = false;
      if (!block && selectedEl && !IGNORE_TAGS.has(selectedEl.tagName) && !TABLE_INT.has(selectedEl.tagName)) {
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
