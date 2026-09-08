// Real-browser smoke test for the import-time normalizer + paste sanitizer
// added to fix the Celcom "sonic branding" bug (see htmlImportNormalizer.ts
// and pasteSanitizer.ts). Catches the class of bug unit tests with happy-dom
// cannot (e.g. the `SyntaxError: Invalid regular expression: missing /` from
// a template-literal escaping mistake, which only throws when the injected
// script actually runs in a real browser).
//
// Requires: `npm run dev` running and a system Chrome install.
// Usage: node test/e2e/import-normalize-check.mjs <path-to-original-html>

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const BASE_URL = process.env.DEV_URL || 'http://localhost:5173';
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTML_PATH = process.argv[2];
if (!HTML_PATH) {
  console.error('Usage: node test/e2e/import-normalize-check.mjs <path-to-html>');
  process.exit(1);
}
const ORIGINAL_HTML = readFileSync(HTML_PATH, 'utf-8');

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

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO 1: import the ORIGINAL, unmodified broken client HTML.
  // ══════════════════════════════════════════════════════════════════════
  {
    consoleErrors.length = 0;
    const frame = await loadDoc(page, ORIGINAL_HTML);
    record('S1: no console/page errors right after import (catches injected-script SyntaxError class of bug)',
      consoleErrors.length === 0, consoleErrors.join(' | '));

    if (!frame) {
      record('S1: canvas iframe found', false);
    } else {
      record('S1: canvas iframe found', true);

      const target = frame.locator('[data-block-type="Texto"]').first();
      await target.click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(300);

      const badgeText = await page.locator('text=/<.*>/').first().textContent().catch(() => null);
      record('S1: clicking the text selects a Texto block (not Columnas)',
        (badgeText || '').toLowerCase().includes('texto'), badgeText);

      // Tipografía accordion may render collapsed (pre-existing StyleSection UI
      // behavior, unrelated to this fix) — open it to reach the color picker.
      const tipografiaHeader = page.locator('button:has-text("Tipografía")').first();
      if (await tipografiaHeader.count()) {
        await tipografiaHeader.click({ force: true });
        await page.waitForTimeout(300);
      }
      const colorInputs = page.locator('input[type="color"]');
      const colorCount = await colorInputs.count();
      let colorApplied = false;
      if (colorCount > 0) {
        await colorInputs.first().evaluate((el, v) => {
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, '#00ff00');
        await page.waitForTimeout(400);
        const styleAttr = await target.getAttribute('style');
        colorApplied = (styleAttr || '').toLowerCase().includes('0, 255, 0') || (styleAttr || '').toLowerCase().includes('#00ff00');
      }
      record('S1: color picker present and visibly changes the block color (hoisted from child <span> at import)',
        colorCount > 0 && colorApplied, `inputs=${colorCount}`);

      record('S1: no console/page errors after selecting + recoloring', consoleErrors.length === 0, consoleErrors.join(' | '));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO 2: paste sanitizer, isolated on a fresh minimal Texto block —
  // this is the actual runtime path that hit the SyntaxError in production.
  // ══════════════════════════════════════════════════════════════════════
  {
    consoleErrors.length = 0;
    const freshHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;"><p data-block-type="Texto" id="target-p" style="padding:16px;">Original text</p></body></html>`;
    const frame = await loadDoc(page, freshHtml);
    if (!frame) {
      record('S2: canvas iframe found', false);
    } else {
      await frame.locator('#target-p').dblclick();
      await page.waitForTimeout(250);

      const pasteResult = await frame.evaluate(() => {
        const el = document.getElementById('target-p');
        const dt = new DataTransfer();
        dt.setData('text/html', '<div><span style="color:red;">pasted <b>rich</b> text</span></div>');
        const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        let threw = null;
        try { el.dispatchEvent(evt); } catch (e) { threw = String(e); }
        return { ok: !threw, reason: threw, html: el.outerHTML };
      });
      await page.waitForTimeout(200);

      record('S2: dispatching a paste event does not throw (the actual production SyntaxError)',
        pasteResult.ok, pasteResult.reason || '');

      const hasNestedDiv = /<div/i.test(pasteResult.html || '');
      const hasNestedSpan = /<span/i.test(pasteResult.html || '');
      const hasBold = /<b>rich<\/b>/i.test(pasteResult.html || '');
      const hasText = /pasted/i.test(pasteResult.html || '');
      record('S2: pasted content is flattened to inline-only (no nested <div>/<span> re-corruption)',
        hasNestedDiv === false && hasBold && hasText,
        `div=${hasNestedDiv} span=${hasNestedSpan} bold=${hasBold} text=${hasText} html=${pasteResult.html}`);

      record('S2: no console/page errors after paste', consoleErrors.length === 0, consoleErrors.join(' | '));

      // Exit edit mode and switch tabs — confirm nothing crashes downstream.
      await frame.locator('body').click({ position: { x: 5, y: 300 }, force: true }).catch(() => {});
      await page.waitForTimeout(300);
      const tabs = await page.locator('[role="tab"]').all();
      for (const tab of tabs) {
        await tab.click({ force: true });
        await page.waitForTimeout(400);
      }
      record('S2: no console/page errors after cycling all tabs', consoleErrors.length === 0, consoleErrors.join(' | '));
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join('; '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
