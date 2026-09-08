import { describe, it, expect } from 'vitest';
import { bakeHostIndependentDefaults } from '../../src/utils/htmlImportNormalizer';

function bodyOf(html: string): string {
  const doc = new DOMParser().parseFromString(bakeHostIndependentDefaults(html), 'text/html');
  return doc.body.innerHTML;
}

describe('bakeHostIndependentDefaults — mergeOrphanedBlockMarkers', () => {
  it('recovers a Texto block whose content got split out of an invalid <p><div> nesting', () => {
    // This is the exact shape that broke the Celcom "sonic branding" template:
    // the browser's own HTML parser can't put a <div> inside a <p>, so it splits
    // it — the marker ends up empty and the real content becomes its sibling.
    const broken =
      '<p data-block-type="Texto" style="color: rgb(255, 154, 1);"></p>' +
      '<div style="box-sizing: content-box;"><span>Usa el "sonic branding"</span></div>';
    const out = bodyOf(broken);
    expect(out).not.toContain('<p');
    expect(out).toContain('data-block-type="Texto"');
    expect(out).toContain('Usa el "sonic branding"');
    // The marker's own attributes (including its style) must survive onto the new <div>.
    expect(out).toMatch(/<div[^>]*data-block-type="Texto"[^>]*color: rgb\(255, 154, 1\)/);
  });

  it('stops absorbing at the next real block — does not swallow an unrelated sibling block', () => {
    const html =
      '<p data-block-type="Texto"></p>' +
      '<div>orphaned text</div>' +
      '<div data-block-type="Imagen"><img src="x.png"></div>';
    const out = bodyOf(html);
    expect(out).toContain('orphaned text');
    // The Imagen block must remain its own, separate element.
    const imagenIdx = out.indexOf('data-block-type="Imagen"');
    const orphanIdx = out.indexOf('orphaned text');
    expect(orphanIdx).toBeLessThan(imagenIdx);
    expect(out.slice(orphanIdx, imagenIdx)).not.toContain('<img'); // img wasn't absorbed backwards into the div
  });

  it('leaves a genuinely empty marker alone (e.g. a fresh placeholder-like block)', () => {
    const html = '<p data-block-type="Texto"></p><div data-block-type="Imagen"></div>';
    const out = bodyOf(html);
    expect(out).toContain('<p');
    expect(out).toContain('data-block-type="Texto"');
  });

  it('leaves a non-empty Texto marker untouched', () => {
    const html = '<p data-block-type="Texto">hello</p><div>unrelated</div>';
    const out = bodyOf(html);
    expect(out).toContain('<p');
    expect(out).toContain('hello');
  });
});

describe('bakeHostIndependentDefaults — hoistSingleRunChildStyle', () => {
  it('hoists color from a lone child <span> onto the data-block-type root (the actual client bug)', () => {
    const html =
      '<div data-block-type="Texto" style="color: inherit; font-size: 16px;">' +
      '<span style="color: rgb(255, 154, 1); font-weight: 700;">Cómo hacer que tu logotipo aparezca</span>' +
      '</div>';
    const out = bodyOf(html);
    expect(out).not.toContain('<span');
    expect(out).toContain('Cómo hacer que tu logotipo aparezca');
    expect(out).toMatch(/data-block-type="Texto"[^>]*color: rgb\(255, 154, 1\)/);
    expect(out).toMatch(/font-weight: 700/);
  });

  it('does not touch a block with genuinely mixed multi-run styling (nothing safe to hoist)', () => {
    const html =
      '<div data-block-type="Texto">' +
      '<span style="color: red;">one</span><span style="color: blue;">two</span>' +
      '</div>';
    const out = bodyOf(html);
    // Two top-level children — not a single-run wrapper case, left alone
    // (bakeContentBoxSizing still stamps box-sizing on every element, unrelated to this check).
    expect(out).toMatch(/<span[^>]*color: red[^>]*>one<\/span>/);
    expect(out).toMatch(/<span[^>]*color: blue[^>]*>two<\/span>/);
  });

  it('does not override a root that already has its own explicit color', () => {
    const html =
      '<div data-block-type="Texto" style="color: rgb(0, 0, 0);">' +
      '<span style="color: rgb(255, 0, 0);">text</span>' +
      '</div>';
    const out = bodyOf(html);
    // Root's own explicit color wins — child is left as-is (still nested), not hoisted over it.
    expect(out).toContain('rgb(0, 0, 0)');
    expect(out).toContain('<span');
  });

  it('does not unwrap a link — only plain formatting wrappers are hoisted', () => {
    const html = '<div data-block-type="Texto"><a href="https://x.com" style="color: red;">link</a></div>';
    const out = bodyOf(html);
    expect(out).toContain('<a href="https://x.com"');
  });
});

describe('bakeHostIndependentDefaults — autoTagPlainTextBlocks', () => {
  it('tags a plain unmarked <p> as Texto (the actual "shows <p> instead of Texto" bug)', () => {
    const out = bodyOf('<p>Haz este ejercicio rápido</p>');
    expect(out).toMatch(/<p[^>]*data-block-type="Texto"[^>]*>Haz este ejercicio rápido<\/p>/);
  });

  it('tags a plain unmarked <div> with nested font/span formatting as Texto', () => {
    const html = '<div><font face="Arial"><span>Junto a los correos</span></font></div>';
    const out = bodyOf(html);
    expect(out).toMatch(/<div[^>]*data-block-type="Texto"/);
    expect(out).toContain('Junto a los correos');
  });

  it('tags each sibling paragraph as its own separate Texto block, not merged into one', () => {
    const html = '<td><p>First</p><p>Second</p></td>';
    const out = bodyOf(`<table><tbody><tr>${html}</tr></tbody></table>`);
    const matches = out.match(/data-block-type="Texto"/g) || [];
    expect(matches.length).toBe(2);
    expect(out).toContain('First');
    expect(out).toContain('Second');
  });

  it('tags only the OUTER wrapper for nested <div><p>...</p></div>, not both', () => {
    const html = '<div><p>Nested paragraph</p></div>';
    const out = bodyOf(html);
    const matches = out.match(/data-block-type="Texto"/g) || [];
    expect(matches.length).toBe(1);
    // The tag landed on the outer <div>, not the inner <p>.
    expect(out).toMatch(/<div[^>]*data-block-type="Texto"[^>]*><p[^>]*>Nested paragraph<\/p><\/div>/);
  });

  it('does not tag a wrapper around an already-marked block (would renest a real block)', () => {
    const html = '<div><div data-block-type="Imagen"><img src="x.png"></div></div>';
    const out = bodyOf(html);
    // Only the original Imagen marker exists — the outer wrapper was left alone.
    const matches = out.match(/data-block-type="/g) || [];
    expect(matches.length).toBe(1);
    expect(out).toContain('data-block-type="Imagen"');
  });

  it('does not tag an element containing a structural/replaced child (img, table, button...)', () => {
    const html = '<div>Caption text<img src="x.png"></div>';
    const out = bodyOf(html);
    expect(out).not.toContain('data-block-type="Texto"');
  });

  it('does not tag an empty element (nothing to classify)', () => {
    const out = bodyOf('<p></p><div></div>');
    expect(out).not.toContain('data-block-type');
  });

  it('tags an element containing only an inline <a> link (legitimate rich text, not structural)', () => {
    const html = '<p>Click <a href="https://x.com">here</a> to read more</p>';
    const out = bodyOf(html);
    expect(out).toMatch(/<p[^>]*data-block-type="Texto"/);
    expect(out).toMatch(/<a href="https:\/\/x\.com"[^>]*>here<\/a>/);
  });

  it('leaves an already-marked element alone (idempotent, does not duplicate/change the marker)', () => {
    const html = '<p data-block-type="Texto" style="color: red;">already a block</p>';
    const out = bodyOf(html);
    const matches = out.match(/data-block-type="Texto"/g) || [];
    expect(matches.length).toBe(1);
  });

  it('composes with hoistSingleRunChildStyle: a freshly auto-tagged block still gets its lone <span> color hoisted', () => {
    const html = '<div><span style="color: rgb(255, 0, 0);">red text</span></div>';
    const out = bodyOf(html);
    expect(out).not.toContain('<span');
    expect(out).toMatch(/data-block-type="Texto"[^>]*color: rgb\(255, 0, 0\)/);
    expect(out).toContain('red text');
  });
});
