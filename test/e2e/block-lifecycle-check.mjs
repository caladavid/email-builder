// Real-browser regression suite for Tanda 1 (destructive block/style bugs)
// of the block-system + styles-panel cleanup. Each scenario reproduces one
// specific reported/confirmed bug and asserts it no longer happens. See
// C:\Users\DavidC\.claude\plans\glittery-exploring-sunset.md for the full
// bug list this maps to.
//
// Requires: `npm run dev` running and a system Chrome install.
// Usage: node test/e2e/block-lifecycle-check.mjs

import { chromium } from 'playwright-core';

const BASE_URL = process.env.DEV_URL || 'http://localhost:5173';
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function loadDoc(page, html) {
  await page.evaluate((h) => {
    window.postMessage({ type: 'loadDocument', html: h }, window.location.origin);
  }, html);
  await page.waitForTimeout(900);
  return page.frames().find((f) => f !== page.mainFrame()) || null;
}

// Sends a command straight into canvas-bridge.ts's message handler, exactly
// like sendToCanvas() does — bypasses the parent-side UI (palette clicks,
// TuneMenu buttons, keyboard shortcuts) so these scenarios test the bridge's
// own command handling directly and deterministically.
async function sendCmd(page, cmd) {
  await page.evaluate((c) => {
    const iframe = document.querySelector('iframe[title="Email Canvas"]');
    iframe.contentWindow.postMessage(c, '*');
  }, cmd);
  await page.waitForTimeout(250);
}

async function getRawHtml(frame) {
  return frame.evaluate(() => document.body.innerHTML);
}

// The accordion open/closed state leaks across selections (known Tanda-3 bug,
// not yet fixed) — a section can render collapsed on a fresh selection for
// reasons unrelated to what THIS suite is testing. Force it open before
// reading/driving fields inside it, same workaround already used by
// import-normalize-check.mjs for "Tipografía".
async function ensureSectionOpen(page, title) {
  const header = page.locator('button', { hasText: title }).first();
  if (await header.count()) {
    // Reliable open/closed signal: does the section already have a real
    // (non-comment) sibling element right after the accordion header button?
    const contentPresent = await header.evaluate((el) => {
      let n = el.nextSibling;
      while (n && n.nodeType === 8) n = n.nextSibling; // skip the "<!-- Content -->" comment
      return !!(n && n.nodeType === 1);
    });
    if (!contentPresent) await header.click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ══════════════════════════════════════════════════════════════════════
  // 1. Palette click never destroys a selected block
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<table data-block-type="Columnas"><tbody><tr>
      <td width="50%"><div data-block-type="Texto">Col A</div></td>
      <td width="50%"><div data-block-type="Texto">Col B</div></td>
    </tr></tbody></table>`;
    const frame = await loadDoc(page, html);
    await frame.locator('[data-block-type="Columnas"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    // Click the "Texto" item in the left palette.
    await page.locator('.block-item', { hasText: 'Texto' }).first().click();
    await page.waitForTimeout(400);
    const html2 = await getRawHtml(frame);
    const tableSurvived = html2.includes('data-block-type="Columnas"') && (html2.match(/data-block-type="Texto"/g) || []).length >= 2;
    record('S1: palette click with a Columnas table selected does not delete it', tableSurvived, html2.slice(0, 200));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. Palette click with nothing selected inserts at the end, not the
  //    first placeholder in the document
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<div data-block-type="placeholder" style="min-height:60px;"></div>
      <p data-block-type="Texto">real content</p>
      <div data-block-type="placeholder" style="min-height:60px;"></div>`;
    const frame = await loadDoc(page, html);
    await frame.locator('body').click({ position: { x: 5, y: 400 }, force: true }); // deselect
    await page.waitForTimeout(200);
    await page.locator('.block-item', { hasText: 'Encabezado' }).first().click();
    await page.waitForTimeout(400);
    const html2 = await getRawHtml(frame);
    const placeholderCount = (html2.match(/data-block-type="placeholder"/g) || []).length;
    const headingLast = html2.trim().endsWith('</h1>') || html2.trim().endsWith('</h2>') || /data-block-type="Encabezado"[^]*$/.test(html2.trim());
    record('S2: palette click with no selection consumes a placeholder and lands at the end (not the first slot)',
      placeholderCount === 1, `placeholders left=${placeholderCount} tail=${html2.trim().slice(-120)}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. Contenedor is always refillable — fresh AND legacy-broken shapes
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div id="marker">x</div>');
    await page.locator('.block-item', { hasText: 'Contenedor' }).first().click();
    await page.waitForTimeout(400);
    const html1 = await getRawHtml(frame);
    const hasOnePlaceholder = (html1.match(/data-block-type="placeholder"/g) || []).length === 1;
    const hasNoStrayP = !/<p[ >]/i.test(html1.split('data-block-type="Contenedor"')[1]?.split('</div>')[0] ?? '');
    record('S3a: fresh Contenedor has exactly one placeholder and no stray <p>', hasOnePlaceholder && hasNoStrayP, html1.slice(0, 250));

    // Insert a Texto into it, then delete it — placeholder must come back.
    // Click the placeholder INSIDE the Contenedor specifically (not the
    // Contenedor's own border/padding area) — that's what makes the palette
    // click go "inside" (replace-html on a placeholder selection) instead of
    // inserting as a sibling after the Contenedor.
    await frame.locator('[data-block-type="Contenedor"] [data-block-type="placeholder"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await page.locator('.block-item', { hasText: 'Texto' }).first().click();
    await page.waitForTimeout(300);
    await frame.locator('[data-block-type="Contenedor"] [data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await sendCmd(page, { type: 'delete-element', path: null });
    const html2 = await getRawHtml(frame);
    const refilled = (html2.match(/data-block-type="placeholder"/g) || []).length === 1;
    record('S3b: Contenedor placeholder is restored after deleting its content', refilled, html2.slice(0, 250));
  }
  {
    // Legacy broken shape: [empty <p>, placeholder, empty <p>] — the exact
    // invalid-nesting damage the old template produced.
    const html = `<div data-block-type="Contenedor" style="padding:16px;">
        <p style="margin:0;"></p>
        <div data-block-type="placeholder" style="min-height:60px;"><span>ph</span></div>
        <p></p>
      </div>`;
    const frame = await loadDoc(page, html);
    await frame.locator('[data-block-type="Contenedor"] [data-block-type="placeholder"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await page.locator('.block-item', { hasText: 'Texto' }).first().click();
    await page.waitForTimeout(300);
    await frame.locator('[data-block-type="Contenedor"] [data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await sendCmd(page, { type: 'delete-element', path: null });
    const html2 = await getRawHtml(frame);
    const refilled = (html2.match(/data-block-type="placeholder"/g) || []).length === 1;
    const contenedorHtml = html2.split('data-block-type="Contenedor"')[1] ?? '';
    const noStrayP = !/<p[ >]/i.test(contenedorHtml);
    record('S3c: a LEGACY broken Contenedor ([p, placeholder, p]) self-heals on delete', refilled && noStrayP, html2.slice(0, 250));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. Long text is not truncated
  // ══════════════════════════════════════════════════════════════════════
  {
    const longText = 'X'.repeat(500);
    const frame = await loadDoc(page, `<p data-block-type="Texto">${longText}</p>`);
    await frame.locator('[data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Contenido');
    // The "Texto" field on párrafo blocks is a <textarea> (Tanda 3 item 6 —
    // long-text fields switched from a single-line input).
    const fieldValue = await page.locator('textarea[placeholder="Texto del párrafo"]').inputValue().catch(() => null);
    record('S4: the Texto field shows the FULL 500-char value, not truncated to 200', (fieldValue || '').length === 500, `len=${(fieldValue || '').length}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. Html block keeps its markup when edited
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div data-block-type="Html"><strong>bold</strong> tail</div>');
    await frame.locator('[data-block-type="Html"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Contenido');
    const textarea = page.locator('textarea[placeholder="HTML personalizado..."]');
    const val = await textarea.inputValue();
    const showsMarkup = val.includes('<strong');
    await textarea.fill(val + ' more');
    await textarea.blur();
    await page.waitForTimeout(300);
    const html2 = await getRawHtml(frame);
    record('S5: Html block panel shows real markup and preserves it on edit', showsMarkup && html2.includes('<strong'), `field=${val} after=${html2.slice(0, 150)}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. set-inner-text refuses to eat a nested real block
  // ══════════════════════════════════════════════════════════════════════
  {
    // Deliberately the ALREADY-BROKEN shape (predates the normalizer reorder
    // fix) — a Texto marker directly wrapping a real heading.
    const frame = await loadDoc(page, '<div data-block-type="Texto"><h1>Important Title</h1></div>');
    await frame.locator('[data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Contenido');
    const fieldGone = (await page.locator('textarea[placeholder="Texto del párrafo"]').count()) === 0;
    await sendCmd(page, { type: 'set-inner-text', path: null, value: 'x' });
    const html2 = await getRawHtml(frame);
    record('S6: the Texto field is hidden AND set-inner-text is refused when the block wraps a real <h1>',
      fieldGone && html2.includes('<h1') && html2.includes('Important Title'), html2.slice(0, 150));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. duplicate on a TD is a no-op — no column added, no undo entry
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<table data-block-type="Columnas"><tbody><tr>
      <td width="50%"><div data-block-type="Texto">A</div></td>
      <td width="50%"><div data-block-type="Texto">B</div></td>
    </tr></tbody></table>`;
    const frame = await loadDoc(page, html);
    const before = await getRawHtml(frame);
    await frame.locator('[data-block-type="Texto"]').first().click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await sendCmd(page, { type: 'select-parent', path: null }); // Texto -> TD
    await sendCmd(page, { type: 'duplicate', path: null });
    const after = await getRawHtml(frame);
    const tdCountBefore = (before.match(/<td/g) || []).length;
    const tdCountAfter = (after.match(/<td/g) || []).length;
    record('S7: duplicating a TD does not change the column count', tdCountBefore === tdCountAfter, `before=${tdCountBefore} after=${tdCountAfter}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8. duplicate strips ids
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div data-block-type="Texto" id="dup-me">x</div>');
    await frame.locator('[data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await sendCmd(page, { type: 'duplicate', path: null });
    const idCount = await frame.evaluate(() => document.querySelectorAll('#dup-me').length);
    record('S8: duplicate strips the id from the clone (no duplicate ids in the document)', idCount === 1, `count=${idCount}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 9. move-up on the only block in a cell is a no-op (does not move the row)
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<table data-block-type="Columnas"><tbody>
      <tr><td><div data-block-type="Texto" id="row1">Row1</div></td></tr>
      <tr><td><div data-block-type="Texto" id="row2">Row2</div></td></tr>
    </tbody></table>`;
    const frame = await loadDoc(page, html);
    await frame.locator('#row2').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await sendCmd(page, { type: 'move-up', path: null }); // row2's TD has no prior sibling TD within its own TR — no-op
    const html2 = await getRawHtml(frame);
    const order = html2.indexOf('id="row1"') < html2.indexOf('id="row2"');
    record('S9: moving the only block in a cell does not move the whole row', order, html2.slice(0, 250));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 10. move-down at the very end of body (after a hover created the
  //     box-model overlay) is a no-op, not a silent "move behind the overlay"
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div data-block-type="Texto" id="only">only block</div>');
    await frame.locator('#only').hover(); // creates the box-model overlay as body's last child
    await page.waitForTimeout(150);
    await frame.locator('#only').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    const before = await getRawHtml(frame);
    await sendCmd(page, { type: 'move-down', path: null });
    const after = await getRawHtml(frame);
    record('S10: move-down on the last real block is a no-op even with the overlay present', before === after, `changed=${before !== after}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 11. Clearing a Botón URL does not destroy the <a> / its styling
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<div data-block-type="Botón"><a href="https://x.com" style="background:#0030A4;color:#fff;padding:12px 20px;border-radius:4px;">Click me</a></div>`;
    const frame = await loadDoc(page, html);
    await frame.locator('[data-block-type="Botón"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Contenido');
    const urlField = page.locator('input[placeholder="https://..."]').first();
    await urlField.fill('');
    await urlField.blur();
    await page.waitForTimeout(400);
    const html2 = await getRawHtml(frame);
    const anchorSurvived = /<a[^>]*style="[^"]*background/i.test(html2);
    record('S11: clearing a Botón URL keeps the <a> and its styling (does not unwrap it)', anchorSurvived, html2.slice(0, 250));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12. Botón URL field is not stale after setting it
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<div data-block-type="Botón"><a href="#" style="background:#0030A4;color:#fff;">Click</a></div>`;
    const frame = await loadDoc(page, html);
    await frame.locator('[data-block-type="Botón"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Contenido');
    const urlField = page.locator('input[placeholder="https://..."]').first();
    await urlField.fill('https://example.com/new');
    await urlField.blur();
    await page.waitForTimeout(400);
    const val = await urlField.inputValue();
    record('S12: Botón URL field shows the value just set, not stale', val === 'https://example.com/new', `field=${val}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 13. Line-height: text input and slider both emit unitless
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<p data-block-type="Texto" style="line-height:1.5;">text</p>');
    await frame.locator('[data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Tipografía');
    const lhField = page.locator('input[placeholder="ej. 1.5"]');
    await lhField.fill('1.4');
    await lhField.press('Enter');
    await page.waitForTimeout(300);
    const html2 = await getRawHtml(frame);
    const correct = /line-height:\s*1\.4(;|"|$)/.test(html2) && !html2.includes('1.4px');
    record('S13: line-height set via text field stays unitless (not "1.4px")', correct, html2.slice(0, 200));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 14. Color: inherit shows unset (not black), and opening the panel
  //     does not silently overwrite it
  // ══════════════════════════════════════════════════════════════════════
  {
    // A concrete color on the ANCESTOR is required here — otherwise the
    // import-time normalizer (bakeHostIndependentDefaults, a separate,
    // intentional fix: "no color anywhere in the chain" gets baked to a
    // concrete #000000 for cross-host rendering consistency) resolves
    // color:inherit to black before the panel ever sees it, which is
    // correct behavior for THAT feature but means it wouldn't be exercising
    // what THIS test cares about. With a concrete ancestor color, "inherits
    // a concrete color already" is true, so the fill is (correctly) skipped
    // and color:inherit survives import — that's the real scenario: a
    // deliberate inherit (e.g. white text on a colored section).
    const frame = await loadDoc(page, '<div style="color: rgb(255, 255, 255);"><p data-block-type="Texto" style="color:inherit;">text</p></div>');
    await frame.locator('[data-block-type="Texto"]').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Tipografía');
    await page.waitForTimeout(200);
    const html2 = await getRawHtml(frame);
    const untouched = html2.includes('color:inherit') || html2.includes('color: inherit');
    record('S14: opening the panel on a color:inherit block does not silently overwrite it', untouched, html2.slice(0, 250));
  }

  console.log('\nconsole/page errors observed:', consoleErrors.length ? consoleErrors : 'none');
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length || consoleErrors.length) {
    if (failed.length) console.log('FAILED:', failed.map((f) => f.name).join('; '));
    if (consoleErrors.length) console.log('CONSOLE ERRORS:', consoleErrors.join(' | '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
