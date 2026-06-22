export const CANVAS_BRIDGE_CODE = `
(function () {
  'use strict';
  if (window.__canvasBridgeActive) return;
  window.__canvasBridgeActive = true;

  const IGNORE_TAGS = new Set(['HTML', 'HEAD', 'BODY', 'STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'NOSCRIPT']);
  // Denylist: any element NOT in this set can be inline-edited on dblclick
  const NON_EDITABLE_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'COLGROUP', 'COL', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'BR', 'HR', 'WBR']);

  var hoveredEl = null;
  var selectedEl = null;
  var editingEl = null;
  var prevHoverOutline = '';
  var prevSelOutline = '';
  var prevSelOutlineOffset = '';
  var _internalDragEl = null;

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
      textAlign: pick(s.textAlign, cs.textAlign),
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
    var html = document.documentElement.outerHTML;
    var bridgeStart = html.indexOf('<script id="__canvas-bridge__"');
    if (bridgeStart >= 0) {
      var closeTag = '<' + '/script>';
      var bridgeEnd = html.indexOf(closeTag, bridgeStart);
      if (bridgeEnd >= 0) {
        html = html.slice(0, bridgeStart) + html.slice(bridgeEnd + closeTag.length);
      }
    }
    parent.postMessage({ type: 'dom-changed', html: html }, '*');
  }

  function clearOutline(el, outline, outlineOffset) {
    if (!el) return;
    el.style.outline = outline || '';
    el.style.outlineOffset = outlineOffset || '';
  }

  function selectElement(el) {
    if (!el) return;
    // clear previous selection
    if (selectedEl && selectedEl !== el) {
      clearOutline(selectedEl, prevSelOutline, prevSelOutlineOffset);
      try { selectedEl.removeAttribute('draggable'); } catch(err) {}
    }
    prevSelOutline = el.style.outline.includes('dashed') ? '' : (el.style.outline || '');
    prevSelOutlineOffset = el.style.outlineOffset || '';
    selectedEl = el;
    try { el.setAttribute('draggable', 'true'); } catch(err) {}
    el.style.outline = '2px solid rgba(0,121,204,1)';
    el.style.outlineOffset = '-1px';

    var rect = el.getBoundingClientRect();
    var blockType = el.getAttribute('data-block-type');
    var childData = { _tag: el.tagName.toLowerCase() };
    if (blockType === 'Botón') {
      var btnA = el.querySelector('a');
      if (btnA) { childData.text = (btnA.innerText || '').trim(); childData.href = btnA.getAttribute('href') || ''; childData.bg = btnA.style.backgroundColor || btnA.style.background || ''; childData.color = btnA.style.color || ''; }
    } else if (blockType === 'Imagen') {
      var btnImg = el.querySelector('img');
      if (btnImg) { childData.src = btnImg.getAttribute('src') || ''; childData.alt = btnImg.getAttribute('alt') || ''; }
    } else if (blockType === 'Separador') {
      var btnHr = el.querySelector('hr');
      if (btnHr) { childData.borderColor = btnHr.style.borderTopColor || btnHr.style.borderColor || '#CCCCCC'; childData.borderWidth = btnHr.style.borderTopWidth || '1px'; }
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
    }, '*');
  }

  // HOVER
  document.addEventListener('mouseover', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (el === selectedEl || el === editingEl) return;
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

  // CLICK → SELECT
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (editingEl && !editingEl.contains(el)) {
      exitEditing();
    }
    e.stopPropagation();
    selectElement(el);
  }, true);

  // DBLCLICK → INLINE EDIT (allow any non-structural, non-media element)
  document.addEventListener('dblclick', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (NON_EDITABLE_TAGS.has(el.tagName)) return;
    e.stopPropagation();
    if (editingEl && editingEl !== el) exitEditing();
    editingEl = el;
    try { el.removeAttribute('draggable'); } catch(err) {}
    el.contentEditable = 'true';
    el.style.outline = '2px solid rgba(0,200,100,1)';
    el.style.outlineOffset = '-1px';
    el.focus();
    var editRect = el.getBoundingClientRect();
    parent.postMessage({ type: 'editing-start', path: getElementPath(el), rect: { top: editRect.top + window.scrollY, left: editRect.left + window.scrollX, width: editRect.width, height: editRect.height } }, '*');
  }, true);

  function exitEditing() {
    if (!editingEl) return;
    var exiting = editingEl;
    editingEl = null;
    exiting.contentEditable = 'false';
    exiting.blur();
    exiting.style.outline = '';
    exiting.style.outlineOffset = '';
    notifyDomChanged();
    parent.postMessage({ type: 'editing-end' }, '*');
    selectElement(exiting);
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
      parent.postMessage({ type: 'deselect' }, '*');
    }
  }, true);

  // COMMANDS FROM PARENT
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.type) return;
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
        notifyDomChanged();
        if (target && target === selectedEl) selectElement(target);
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
        if (target) { target.innerHTML = cmd.value || ''; }
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
          if (chAttr) chAttr.setAttribute(cmd.property, cmd.value);
        }
        notifyDomChanged();
        break;

      case 'set-child-style':
        if (target) {
          var chSt = target.querySelector(cmd.selector);
          if (chSt) chSt.style[cmd.property] = cmd.value;
        }
        notifyDomChanged();
        break;

      case 'set-child-text':
        if (target) {
          var chTxt = target.querySelector(cmd.selector);
          if (chTxt) chTxt.textContent = cmd.value || '';
        }
        notifyDomChanged();
        break;

      case 'change-tag': {
        if (target) {
          var newEl = document.createElement(cmd.tag);
          for (var ai = 0; ai < target.attributes.length; ai++) {
            var a = target.attributes[ai];
            newEl.setAttribute(a.name, a.value);
          }
          newEl.innerHTML = target.innerHTML;
          target.parentElement.replaceChild(newEl, target);
          notifyDomChanged();
          selectElement(newEl);
        }
        break;
      }

      case 'delete-element':
        if (target) {
          if (target === selectedEl) {
            clearOutline(selectedEl, '', '');
            selectedEl = null;
          }
          target.remove();
          notifyDomChanged();
          parent.postMessage({ type: 'deselect' }, '*');
        }
        break;

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
        if (target) {
          var par = target.parentElement;
          if (par && !IGNORE_TAGS.has(par.tagName)) selectElement(par);
        }
        break;

      case 'insert-html': {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = cmd.html || '';
        var newEl = wrapper.firstElementChild;
        if (!newEl) break;
        var ref = target || document.body;
        if (ref === document.body) {
          var lastChild = document.body.lastElementChild;
          if (lastChild) { lastChild.after(newEl); }
          else { document.body.appendChild(newEl); }
        } else if (cmd.position === 'inside' || cmd.position === 'center') {
          ref.appendChild(newEl);
        } else if (cmd.position === 'before') {
          ref.before(newEl);
        } else {
          ref.after(newEl);
        }
        notifyDomChanged();
        selectElement(newEl);
        break;
      }

      case 'get-html':
        parent.postMessage({ type: 'html-response', html: document.documentElement.outerHTML }, '*');
        break;

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
        parent.postMessage({ type: 'tree-response', tree: buildNode(document.body) }, '*');
        break;
      }

      case 'deselect':
        if (selectedEl) { try { selectedEl.removeAttribute('draggable'); } catch(err) {} }
        clearOutline(selectedEl, '', '');
        selectedEl = null;
        break;

      case 'exec-command':
        try { document.execCommand(cmd.command, false, cmd.value || null); } catch(err) {}
        notifyDomChanged();
        break;

      case 'highlight':
        if (target) selectElement(target);
        break;
    }
  });

  // ── Drag-drop (palette external + internal canvas reorder) ───────────────
  var dropIndicator = null;
  var dropTarget = null;
  var _rafId = null;
  var _dragleaveTimer = null;

  function removeDropIndicator() {
    if (dropIndicator && dropIndicator.parentElement) dropIndicator.parentElement.removeChild(dropIndicator);
  }

  function createDropIndicator() {
    var el = document.createElement('div');
    el.id = '__drop-indicator__';
    // Thin line so layout shift is minimal (3px vs 38px), label floats above via absolute
    el.style.cssText = 'position:relative;height:3px;background:#0045B0;box-shadow:0 0 8px rgba(0,69,176,0.5);border-radius:2px;pointer-events:none;box-sizing:border-box;overflow:visible;z-index:9999;';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:-24px;background:#0045B0;color:white;font-size:10px;font-weight:700;font-family:sans-serif;padding:2px 12px;border-radius:4px 4px 0 0;white-space:nowrap;pointer-events:none;';
    lbl.textContent = '⬇ Soltar aquí';
    el.appendChild(lbl);
    return el;
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
    if (el === document.body) el = document.body.lastElementChild || document.body;
    if (_internalDragEl && (_internalDragEl === el || _internalDragEl.contains(el))) return;
    var candidate = el;
    // RAF throttle: reposition indicator at most once per animation frame
    if (_rafId) return;
    _rafId = requestAnimationFrame(function() {
      _rafId = null;
      // Skip DOM mutation if target hasn't changed and indicator already placed
      if (candidate === dropTarget && dropIndicator && dropIndicator.parentElement) return;
      dropTarget = candidate;
      if (!dropIndicator) dropIndicator = createDropIndicator();
      if (dropTarget.parentElement) dropTarget.parentElement.insertBefore(dropIndicator, dropTarget.nextSibling);
    });
  });

  document.addEventListener('drop', function(e) {
    e.preventDefault();
    removeDropIndicator();
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_dragleaveTimer) { clearTimeout(_dragleaveTimer); _dragleaveTimer = null; }
    if (_internalDragEl) {
      if (dropTarget && dropTarget !== _internalDragEl && !_internalDragEl.contains(dropTarget)) {
        dropTarget.after(_internalDragEl);
        notifyDomChanged();
        selectElement(_internalDragEl);
      }
      _internalDragEl = null;
      dropTarget = null;
    } else {
      if (!dropTarget) return;
      var path = getElementPath(dropTarget);
      parent.postMessage({ type: 'drop-request', path: path }, '*');
      dropTarget = null;
    }
  });

  // Prevent link navigation in the editor canvas — links are content, not actions
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && el.tagName === 'A') e.preventDefault();
  }, true);

  parent.postMessage({ type: 'bridge-ready' }, '*');
})();
`;
