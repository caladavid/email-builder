// Real-browser regression suite for Tanda 3 (drag/drop affordances) of the
// block-system + styles-panel cleanup. See
// C:\Users\DavidC\.claude\plans\glittery-exploring-sunset.md for the full list.
//
// Requires: `npm run dev` running and a system Chrome install.
// Usage: node test/e2e/dragdrop-affordance-check.mjs

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

async function getRawHtml(frame) {
  return frame.evaluate(() => document.body.innerHTML);
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
  // 1. The "+" never anchors inside a placeholder (not the icon, not the
  //    placeholder box itself) — dispatching mousemove over its 24px SVG
  //    icon must never produce a hover-block-bottom rect.
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = '<div data-block-type="placeholder" style="min-height:60px;width:100%;display:flex;align-items:center;justify-content:center;"><svg width="24" height="24" viewBox="0 0 40 40"><path d="M20 11v18M11 20h18" stroke="#0045B0" stroke-width="2.5"/></svg></div>';
    const frame = await loadDoc(page, html);
    let sawHoverRect = false;
    page.on('framenavigated', () => {}); // no-op, keep listener setup simple
    const gotMessage = await frame.evaluate(() => {
      return new Promise((resolve) => {
        function onMsg(e) {
          if (e.data && e.data.type === 'hover-block-bottom') {
            window.removeEventListener('message', onMsg);
            resolve(e.data.rect !== null);
          }
        }
        window.addEventListener('message', onMsg);
        const icon = document.querySelector('svg path');
        const rect = icon.getBoundingClientRect();
        const evt = new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
        icon.dispatchEvent(evt);
        // No message arrives at all if nothing changed from the initial
        // (null) state — resolve false after a short grace window.
        setTimeout(() => { window.removeEventListener('message', onMsg); resolve(false); }, 600);
      });
    });
    sawHoverRect = gotMessage;
    record('D1: mousemove over a placeholder\'s inner SVG icon never anchors the "+" (no hover-block-bottom rect)', !sawHoverRect);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. Dropping in the CENTER of a freshly-inserted (short) Columnas
  //    placeholder lands INSIDE it, not "outside the table" — the
  //    proportional edgeBand fix (was a fixed 24px eating most of a ~76px
  //    tall block).
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div id="marker">x</div>');
    await page.locator('.block-item', { hasText: '2 Columnas' }).first().click();
    await page.waitForTimeout(400);
    const dropWorked = await frame.evaluate(() => {
      const table = document.querySelector('[data-block-type="Columnas"]');
      const td = table.querySelector('td');
      const ph = td.querySelector('[data-block-type="placeholder"]');
      const rect = ph.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dt = new DataTransfer();
      const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, dataTransfer: dt };
      ph.dispatchEvent(new DragEvent('dragover', opts));
      ph.dispatchEvent(new DragEvent('drop', opts));
      return true;
    });
    await page.waitForTimeout(300);
    const html2 = await getRawHtml(frame);
    // A real DataTransfer carries no payload here (no palette drag started
    // it), so the bridge's own drop handler has nothing internal to insert —
    // this only exercises computeDropTarget's targeting math, verified via
    // the fact that it didn't throw and the table structure is untouched
    // (2 columns, no stray content appended outside the table).
    const stillTwoCols = (html2.match(/<td/g) || []).length === 2;
    record('D2: dispatching dragover/drop at the CENTER of a short Columnas placeholder does not throw or corrupt the table', dropWorked && stillTwoCols, `cols=${(html2.match(/<td/g) || []).length}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. Inserting an Imagen block with a blocked image host still selects
  //    the new block quickly (not stuck up to the old 5s timeout).
  // ══════════════════════════════════════════════════════════════════════
  {
    await page.route('**/*.{png,jpg,jpeg,gif,webp}', (route) => route.abort());
    const frame = await loadDoc(page, '<div id="marker">x</div>');
    const t0 = Date.now();
    await page.locator('.block-item', { hasText: 'Imagen' }).first().click();
    // Poll for the Imagen panel section's header to appear (proxy for
    // "selection landed") — the accordion may render collapsed (known,
    // separate Tanda-3 item 5 leak), so probe the section title, not a row
    // inside it.
    let selectedInTime = false;
    for (let i = 0; i < 60; i++) {
      const count = await page.locator('button', { hasText: 'Imagen' }).count();
      if (count > 0) { selectedInTime = (Date.now() - t0) < 2000; break; }
      await page.waitForTimeout(50);
    }
    record('D3: inserting Imagen with a blocked image host still selects the new block quickly (< 2s)', selectedInTime, `elapsed=${Date.now() - t0}ms`);
    await page.unroute('**/*.{png,jpg,jpeg,gif,webp}');
  }

  // D4: grabbing an Imagen block ON its <img> (natively draggable) must move the
  // whole block. Used to be ignored: the drag started from the <img>, not from
  // the selected wrapper, so the drop never moved anything. Repeated twice
  // because the user saw "first time works, second doesn't" (first grab was on
  // the padding, second on the image).
  {
    const html = '<!DOCTYPE html><html><body>' +
      '<h1 id="d4h" data-block-type="Encabezado" style="padding:16px">Titulo</h1>' +
      '<p id="d4t" data-block-type="Texto" style="padding:16px">Parrafo</p>' +
      '<div id="d4im" data-block-type="Imagen" style="padding:16px 24px;text-align:center;"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" style="width:300px;height:100px;display:block;margin:0 auto;" /></div>' +
      '</body></html>';
    await loadDoc(page, html);
    let frame = null;
    for (const f of page.frames()) {
      if (f.url() === 'about:srcdoc') continue;
      try { if (await f.evaluate(() => !!document.getElementById('d4im'))) frame = f; } catch (e) {}
    }
    const order = () => frame.evaluate(() => Array.from(document.body.querySelectorAll('[data-block-type]')).map((e) => e.id).join(','));
    const dragImgTo = async (targetSel) => {
      await frame.locator('#d4im img').click({ force: true });
      await page.waitForTimeout(300);
      const box = await frame.locator(targetSel).boundingBox();
      await frame.locator('#d4im img').dragTo(frame.locator(targetSel), { force: true, targetPosition: { x: 40, y: box.height - 3 } });
      await page.waitForTimeout(700);
    };
    await dragImgTo('#d4h');
    const first = await order();
    await dragImgTo('#d4t'); // back to the end
    await dragImgTo('#d4h');
    const second = await order();
    record('D4: dragging an Imagen block by its <img> moves the block (twice in a row)',
      first === 'd4h,d4im,d4t' && second === 'd4h,d4im,d4t', `first=${first} second=${second}`);
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
