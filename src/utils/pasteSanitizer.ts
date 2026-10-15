// Pure paste-sanitization logic, kept in its own module so it can be unit
// tested with vitest/happy-dom. canvas-bridge.ts embeds this SAME function
// inside the iframe by interpolating `sanitizePastedHtml.toString()` into its
// injected script text — do not fork/copy this logic into canvas-bridge.ts,
// or the two will silently drift apart.
//
// IMPORTANT: everything this function needs (helpers, tag tables) MUST be
// declared INSIDE it, not at module scope. Function.prototype.toString()
// only returns THIS function's own source — any module-scope helper it
// called would be undefined once embedded in the iframe (caught in
// production: paste threw "walk is not defined" because an earlier version
// had `walk`/`escapeText`/the tag tables as separate module-level
// declarations that never made it into the injected script).
//
// Why this exists: pasting rich HTML (Google Docs/Word) straight into a
// contentEditable block root (e.g. a Texto block is a <p>) breaks the canvas —
// clipboard HTML brings block-level tags (<div>/<p>/<li>...) which are invalid
// inside a <p>, so the browser's own HTML parser splits the block apart: the
// marked element ends up empty and the real text lands as a SIBLING outside
// it, permanently orphaned from data-block-type (click-to-select then walks
// past it to the next real ancestor, e.g. the parent Columnas table).
//
// This walks the pasted DOM itself, allowlist-style — it never emits a tag
// or attribute it didn't explicitly choose to, so there's nothing for a
// separate DOMPurify pass to still need to strip afterwards (verified: an
// earlier version ran DOMPurify as a "defense-in-depth" pass on the output,
// but under happy-dom/vitest DOMPurify was found to corrupt already-safe
// output — e.g. silently dropping sibling text nodes next to <br> — so it's
// deliberately NOT used here. The construction below is the actual guarantee.
export function sanitizePastedHtml(html: string): string {
  // Tags whose own text content forms one "line" — a trailing <br> is emitted
  // after each so pasted paragraphs/list items/headings don't run together.
  var LINE_TAGS: Record<string, true> = {
    P: true, DIV: true, LI: true, TR: true, BLOCKQUOTE: true,
    H1: true, H2: true, H3: true, H4: true, H5: true, H6: true,
  };
  // Dropped entirely, content included (never just unwrapped).
  var DROP_TAGS: Record<string, true> = {
    SCRIPT: true, STYLE: true, NOSCRIPT: true, IFRAME: true, OBJECT: true, EMBED: true, TEMPLATE: true,
  };
  var INLINE_TAG_MAP: Record<string, string> = {
    B: 'b', STRONG: 'strong', I: 'i', EM: 'em', U: 'u', S: 's', STRIKE: 'strike', SPAN: 'span',
  };

  function escapeText(s: string): string {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // For attribute values: also escape quotes, otherwise an href like
  // https://x" onmouseover="... breaks out of href="..."
  function escapeAttr(s: string): string {
    return escapeText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isSafeHref(href: string): boolean {
    var h = String(href || '').trim().toLowerCase();
    return /^(https?:|mailto:|tel:|#|\/)/.test(h);
  }

  function walk(node: Node, out: string[]): void {
    var children = node.childNodes;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 3) { // Node.TEXT_NODE
        out.push(escapeText(child.nodeValue || ''));
        continue;
      }
      if (child.nodeType !== 1) continue; // skip comments/etc.
      var el = child as Element;
      var tag = el.tagName;
      if (DROP_TAGS[tag]) continue; // drop node + its whole subtree
      if (tag === 'BR') { out.push('<br>'); continue; }
      if (tag === 'A') {
        var href = el.getAttribute('href') || '';
        var innerA: string[] = [];
        walk(el, innerA);
        if (isSafeHref(href)) {
          out.push('<a href="' + escapeAttr(href) + '">' + innerA.join('') + '</a>');
        } else {
          out.push(innerA.join(''));
        }
        continue;
      }
      var mapped = INLINE_TAG_MAP[tag];
      if (mapped) {
        var innerEl: string[] = [];
        walk(el, innerEl);
        out.push('<' + mapped + '>' + innerEl.join('') + '</' + mapped + '>');
        continue;
      }
      // Anything else (div/p/li/h1-6/ul/table/...): unwrap, keep only its content.
      walk(el, out);
      if (LINE_TAGS[tag]) out.push('<br>');
    }
  }

  if (!html) return '';
  var doc: Document;
  try {
    // Do NOT wrap in an extra <body> tag: some HTML parsers (e.g. happy-dom,
    // in tests) nest a literal duplicate <body> element instead of merging it
    // into the real one per spec, which would make it an ancestor `walk()`
    // never reaches. Feeding the fragment directly and reading back
    // `doc.body` works correctly in both a real browser and happy-dom.
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return String(html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '');
  }
  var out: string[] = [];
  walk(doc.body, out);
  return out.join('');
}
