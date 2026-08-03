// Manual smoke test for the Editor <-> Preview/HTML text-sync mechanism.
// See CLAUDE.md "Zona frágil: sync Editor <-> Preview/HTML" before touching
// canvas-bridge.ts / IframeCanvas.vue / TemplatePanel/index.vue.
//
// Requires: `npm run dev` running (defaults to http://localhost:5173) and a
// system Chrome install. Not part of `npm test` — needs a real browser to
// drive the live iframe canvas, which happy-dom (used by vitest) can't do.
//
// Usage: node test/e2e/text-sync-check.mjs

import { chromium } from 'playwright-core';

const BASE_URL = process.env.DEV_URL || 'http://localhost:5173';
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function loadFreshDoc(page, markerText) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr><td style="padding:20px;"><p id="target-p">${markerText}</p><p id="other-p">Otro parrafo para clickear afuera</p></td></tr></table></body></html>`;
  await page.evaluate((h) => {
    window.postMessage({ type: 'loadDocument', html: h }, window.location.origin);
  }, html);
  await page.waitForTimeout(900);
  for (const f of page.frames()) {
    try { if (await f.evaluate(() => !!document.getElementById('target-p'))) return f; } catch (e) {}
  }
  return null;
}

async function getEditorText(page) {
  for (const f of page.frames()) {
    try {
      const has = await f.evaluate(() => !!document.getElementById('target-p'));
      if (has) return f.evaluate(() => document.getElementById('target-p').textContent);
    } catch (e) {}
  }
  return null;
}

async function editText(page, frame, suffix) {
  await frame.locator('#target-p').dblclick();
  await page.waitForTimeout(250);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(suffix);
  await page.waitForTimeout(150);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Scenario 1: type, switch tab directly — zero clicks inside the canvas.
  // Regression target: UTabs unmountOnHide destroying the live iframe (fixed via
  // :unmount-on-hide="false") and the proactive 'exit-editing' flush on tab change.
  {
    let frame = await loadFreshDoc(page, 'Original-1');
    await editText(page, frame, ' EDIT1');
    const tabs = await page.locator('[role="tab"]').all();
    await tabs[1].click(); // Preview, no click-away first
    await page.waitForTimeout(400);
    const previewHtml = await page.evaluate(() => document.querySelector('iframe[srcdoc]')?.getAttribute('srcdoc') || '');
    const previewOk = previewHtml.includes('EDIT1');
    await tabs[0].click();
    await page.waitForTimeout(400);
    const editorText = await getEditorText(page);
    const editorOk = (editorText || '').includes('EDIT1');
    record('type + switch tab directly (no click) — Preview reflects edit', previewOk);
    record('type + switch tab directly (no click) — Editor keeps edit on return', editorOk, editorText);
  }

  // Scenario 2: type, click on empty canvas background, switch tabs.
  // Regression target: IGNORE_TAGS (<body>) skipping exitEditing() entirely.
  {
    let frame = await loadFreshDoc(page, 'Original-2');
    await editText(page, frame, ' EDIT2');
    await frame.locator('body').click({ position: { x: 5, y: 150 }, force: true });
    await page.waitForTimeout(200);
    const tabs = await page.locator('[role="tab"]').all();
    await tabs[1].click();
    await page.waitForTimeout(300);
    await tabs[0].click();
    await page.waitForTimeout(400);
    const editorText = await getEditorText(page);
    record('type + click empty canvas background + switch tabs', (editorText || '').includes('EDIT2'), editorText);
  }

  // Scenario 3: type, click another block to exit, switch tabs immediately.
  // Regression target: the 150ms save debounce racing the tab switch (fixed via
  // the `immediate` flag on notifyDomChanged from exitEditing).
  {
    let frame = await loadFreshDoc(page, 'Original-3');
    await editText(page, frame, ' EDIT3');
    await frame.locator('#other-p').click();
    const tabs = await page.locator('[role="tab"]').all();
    await tabs[1].click(); // immediately, no wait — races the debounce on purpose
    await page.waitForTimeout(300);
    await tabs[0].click();
    await page.waitForTimeout(400);
    const editorText = await getEditorText(page);
    record('type + click away + switch tabs immediately (debounce race)', (editorText || '').includes('EDIT3'), editorText);
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
