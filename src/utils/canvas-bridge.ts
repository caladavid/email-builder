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

  // Walk up to data-block-type; if not found, use the clicked element directly
  // (imported templates have no data-block-type so we allow individual element selection)
  function findBlockEl(el) {
    var cur = el;
    while (cur && cur !== document.body && !cur.getAttribute('data-block-type')) {
      cur = cur.parentElement;
    }
    if (cur && cur !== document.body && cur !== document.documentElement) {
      console.debug('[bridge] findBlockEl: data-block-type', cur.tagName, cur.getAttribute('data-block-type'));
      return cur;
    }
    // No data-block-type — select the clicked element itself (skip ignored tags)
    var target = el;
    while (target && (IGNORE_TAGS.has(target.tagName) || target === document.body || target === document.documentElement)) {
      target = target.parentElement;
    }
    console.debug('[bridge] findBlockEl: fallback direct', target ? target.tagName : 'null', target ? (target.className || target.id || '') : '');
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
    console.debug('[bridge] selectElement:', el.tagName, '| data-block-type:', el.getAttribute('data-block-type'), '| depth from body:', (function(e){var d=0;while(e&&e!==document.body){d++;e=e.parentElement;}return d;})(el));
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
    if (selectedEl && selectedEl.contains(el)) return;
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

  // CLICK → SELECT (walk up to block root, fallback to direct body child for imported templates)
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || IGNORE_TAGS.has(el.tagName)) return;
    if (editingEl) {
      if (!editingEl.contains(el)) {
        exitEditing();
      } else {
        return; // click inside editing element → just move cursor, no re-select
      }
    }
    e.stopPropagation();
    var block = findBlockEl(el);
    if (!block) return;
    selectElement(block);
    // For imported templates (no data-block-type), auto-enter edit mode on click for text elements
    if (!block.getAttribute('data-block-type') && !NON_EDITABLE_TAGS.has(block.tagName) && !editingEl) {
      editingEl = block;
      try { block.removeAttribute('draggable'); } catch(err) {}
      block.contentEditable = 'true';
      block.focus();
      var er2 = block.getBoundingClientRect();
      parent.postMessage({ type: 'editing-start', path: getElementPath(block), rect: { top: er2.top + window.scrollY, left: er2.left + window.scrollX, width: er2.width, height: er2.height } }, '*');
    }
  }, true);


  function exitEditing() {
    if (!editingEl) return;
    var exiting = editingEl;
    editingEl = null;
    exiting.contentEditable = 'false';
    exiting.blur();
    notifyDomChanged();
    parent.postMessage({ type: 'editing-end' }, '*');
    // Re-select to restore blue outline (exitEditing may have cleared it)
    if (exiting === selectedEl) {
      exiting.style.outline = '2px solid rgba(0,121,204,1)';
      exiting.style.outlineOffset = '-1px';
    }
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
    parent.postMessage({ type: 'keydown', key: e.key, ctrlKey: !!e.ctrlKey, shiftKey: !!e.shiftKey, altKey: !!e.altKey }, '*');
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

      case 'get-outerhtml':
        if (target) parent.postMessage({ type: 'outerhtml-response', html: target.outerHTML }, '*');
        break;

      case 'replace-html': {
        var rWrapper = document.createElement('div');
        rWrapper.innerHTML = cmd.html || '';
        var rNewEl = rWrapper.firstElementChild;
        if (rNewEl && target && target.parentElement) {
          target.parentElement.replaceChild(rNewEl, target);
          notifyDomChanged();
          selectElement(rNewEl);
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
        parent.postMessage({ type: 'tree-response', tree: buildNode(document.body) }, '*');
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
          parent.postMessage({ type: 'editing-start', path: getElementPath(target), rect: { top: er.top + window.scrollY, left: er.left + window.scrollX, width: er.width, height: er.height } }, '*');
        }
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
    document.body.appendChild(el);
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
    if (el === document.body) el = document.body.lastElementChild || document.body;
    if (_internalDragEl && (_internalDragEl === el || _internalDragEl.contains(el))) return;
    var candidate = findBlockEl(el);
    if (!candidate) return;

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
        dropTarget.after(_internalDragEl);
        notifyDomChanged();
        selectElement(_internalDragEl);
      }
      _internalDragEl = null;
      dropTarget = null;
    } else {
      if (!dropTarget) return;
      var path = getElementPath(dropTarget);
      parent.postMessage({ type: 'drop-request', path: path, position: _dropPosition }, '*');
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
