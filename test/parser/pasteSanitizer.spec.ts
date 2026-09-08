import { describe, it, expect } from 'vitest';
import { sanitizePastedHtml } from '../../src/utils/pasteSanitizer';

describe('sanitizePastedHtml', () => {
  it('unwraps block-level tags instead of nesting them (the actual client bug)', () => {
    // This is the exact shape Google Docs produces and that corrupted the
    // Celcom "sonic branding" template: a <div> wrapping the pasted text.
    // Inserting this verbatim into a <p data-block-type="Texto"> forces the
    // browser to split the <p>, orphaning the text as a sibling — which is
    // exactly why click-to-select then jumped to the parent Columnas block.
    const pasted = '<div><span>Usa el "sonic branding"</span></div>';
    const out = sanitizePastedHtml(pasted);
    expect(out).not.toContain('<div');
    expect(out).toContain('Usa el "sonic branding"');
  });

  it('keeps inline formatting (bold/italic/links)', () => {
    const pasted = '<p><b>bold</b> and <i>italic</i> and <a href="https://x.com">link</a></p>';
    const out = sanitizePastedHtml(pasted);
    expect(out).toContain('<b>bold</b>');
    expect(out).toContain('<i>italic</i>');
    expect(out).toContain('<a href="https://x.com">link</a>');
  });

  it('inserts a line break at former paragraph boundaries instead of running text together', () => {
    const pasted = '<p>Foo</p><p>Bar</p>';
    expect(sanitizePastedHtml(pasted)).toBe('Foo<br>Bar<br>');
  });

  it('drops script/style tags entirely, including their text content', () => {
    // Real script content (not a bare identifier reference like `alert(1)`)
    // so this actually exercises the DROP_TAGS branch in the parsed-DOM path,
    // not a parse-failure fallback.
    const pasted = '<div>hi<script>1+1;</script><style>body{color:red}</style></div>';
    const out = sanitizePastedHtml(pasted);
    expect(out).toBe('hi<br>');
  });

  it('strips event-handler and style attributes on every tag (only href on <a> survives)', () => {
    const pasted = '<div onclick="alert(1)"><a href="https://x.com" style="color:red" onclick="alert(2)">link</a></div>';
    const out = sanitizePastedHtml(pasted);
    expect(out).toBe('<a href="https://x.com">link</a><br>');
  });

  it('drops an unsafe href (javascript: URI) but keeps the link text', () => {
    const pasted = '<a href="javascript:alert(1)">click me</a>';
    expect(sanitizePastedHtml(pasted)).toBe('click me');
  });

  it('drops <img> — no src/alt survives, and it does not corrupt the line breaks around it', () => {
    const pasted = '<p>Before</p><img src="x" onerror="alert(1)"><p>After</p>';
    expect(sanitizePastedHtml(pasted)).toBe('Before<br>After<br>');
  });

  it('handles list items, converting each <li> into its own line (no extra break from <ul> itself)', () => {
    const pasted = '<ul><li>One</li><li>Two</li></ul>';
    expect(sanitizePastedHtml(pasted)).toBe('One<br>Two<br>');
  });

  it('escapes stray text-node HTML metacharacters so they cannot reopen a tag', () => {
    const pasted = 'a < b & c > d';
    expect(sanitizePastedHtml(pasted)).toBe('a &lt; b &amp; c &gt; d');
  });

  it('returns empty output for empty/undefined input without throwing', () => {
    expect(sanitizePastedHtml('')).toBe('');
    expect(sanitizePastedHtml(undefined as unknown as string)).toBe('');
  });

  it('is idempotent-safe on plain text with no markup at all', () => {
    expect(sanitizePastedHtml('just plain text')).toBe('just plain text');
  });
});
