// Real-browser regression suite for Tanda 2 (childData/style round-trip bugs)
// of the block-system + styles-panel cleanup. Pattern: set a value via the
// panel -> deselect -> reselect -> assert the panel still shows what was set
// (not a stale/blank/halved value). See
// C:\Users\DavidC\.claude\plans\glittery-exploring-sunset.md for the full list.
//
// Requires: `npm run dev` running and a system Chrome install.
// Usage: node test/e2e/panel-roundtrip-check.mjs

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

async function deselect(page, frame) {
  await frame.locator('body').click({ position: { x: 2, y: 2 }, force: true });
  await page.waitForTimeout(250);
}

async function select(frame, selector) {
  await frame.locator(selector).first().click({ position: { x: 5, y: 5 }, force: true });
}

// StyleRow renders <label>LABEL</label> as a sibling of its control inside
// the same wrapper div — walk up to that wrapper, then find the control.
async function fieldValue(page, label) {
  const lbl = page.getByText(label, { exact: true }).first();
  await lbl.waitFor({ state: 'attached', timeout: 3000 });
  const wrapper = lbl.locator('..');
  const control = wrapper.locator('input[type="text"], input[type="range"], select').first();
  return control.inputValue();
}

async function setFieldText(page, label, value) {
  const lbl = page.getByText(label, { exact: true }).first();
  const wrapper = lbl.locator('..');
  const input = wrapper.locator('input[type="text"]').first();
  await input.fill(value);
  await input.dispatchEvent('change');
  await page.waitForTimeout(250);
}

async function setFieldSelect(page, label, value) {
  const lbl = page.getByText(label, { exact: true }).first();
  const wrapper = lbl.locator('..');
  await wrapper.locator('select').first().selectOption(value);
  await page.waitForTimeout(250);
}

async function ensureSectionOpen(page, title) {
  const header = page.locator('button', { hasText: title }).first();
  if (await header.count()) {
    const contentPresent = await header.evaluate((el) => {
      let n = el.nextSibling;
      while (n && n.nodeType === 8) n = n.nextSibling;
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
  // 1. Video: controls checkbox reflects the template's own `controls` attr,
  //    src is read from <source>, poster/autoplay persist across reselect.
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div id="marker">x</div>');
    await page.locator('.block-item', { hasText: 'Video' }).first().click();
    await page.waitForTimeout(400);
    await select(frame, '[data-block-type="Video"]');
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Video');
    const controlsChecked = await page.locator('label', { hasText: 'Controles' }).locator('input[type=checkbox]').first().isChecked();
    record('V1: freshly inserted Video shows Controles checked (template ships controls)', controlsChecked);

    await setFieldText(page, 'URL de origen (src)', 'https://example.com/video.mp4');
    await setFieldText(page, 'Poster (imagen previa)', 'https://example.com/poster.jpg');
    await page.locator('label', { hasText: 'Autoplay' }).locator('input[type=checkbox]').first().click();
    await page.waitForTimeout(300);
    await deselect(page, frame);
    await select(frame, '[data-block-type="Video"]');
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Video');
    const src = await fieldValue(page, 'URL de origen (src)');
    const poster = await fieldValue(page, 'Poster (imagen previa)');
    const autoplayChecked = await page.locator('label', { hasText: 'Autoplay' }).locator('input[type=checkbox]').first().isChecked();
    record('V2: Video src/poster/autoplay survive a reselect', src === 'https://example.com/video.mp4' && poster === 'https://example.com/poster.jpg' && autoplayChecked,
      `src=${src} poster=${poster} autoplay=${autoplayChecked}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. Columnas: width shown on the FIRST selection, gap does not halve
  //    across repeated reselects, vAlign reflects the real value.
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div id="marker">x</div>');
    await page.locator('.block-item', { hasText: '3 Columnas' }).first().click();
    await page.waitForTimeout(400);
    await select(frame, '[data-block-type="Columnas"]');
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Columnas');
    const width1 = await fieldValue(page, 'Ancho col. 1');
    record('C1: column width shows a real value on the FIRST selection (not blank)', /33\.3/.test(width1), `width1=${width1}`);

    // Drive the gap slider's underlying range input directly (fill() doesn't
    // work on type=range) — set it to 24, then reselect 3 times.
    const gapLbl = page.getByText('Espacio entre col.', { exact: true }).first();
    const gapRange = gapLbl.locator('..').locator('input[type=range]').first();
    await gapRange.evaluate((el) => { el.value = '24'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(300);
    let lastGap = null;
    for (let i = 0; i < 3; i++) {
      await deselect(page, frame);
      await select(frame, '[data-block-type="Columnas"]');
      await page.waitForTimeout(300);
      await ensureSectionOpen(page, 'Columnas');
      lastGap = await gapRange.inputValue();
    }
    record('C2: column gap does not halve on repeated reselection', lastGap === '24', `gap after 3 reselects=${lastGap}`);

    await setFieldSelect(page, 'Alineación V', 'middle');
    await deselect(page, frame);
    await select(frame, '[data-block-type="Columnas"]');
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Columnas');
    const vAlign = await fieldValue(page, 'Alineación V');
    record('C3: vertical alignment reflects the real value (not hardcoded top)', vAlign === 'middle', `vAlign=${vAlign}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. Columnas: quantity control preserves content on remove, seeds
  //    placeholders on add.
  // ══════════════════════════════════════════════════════════════════════
  {
    const html = `<table data-block-type="Columnas" style="table-layout:fixed;"><tbody><tr>
      <td width="33.33%" style="width:33.33%;"><p data-block-type="Texto">Col A</p></td>
      <td width="33.33%" style="width:33.33%;"><p data-block-type="Texto">Col B</p></td>
      <td width="33.33%" style="width:33.33%;"><p data-block-type="Texto">Col C (removed)</p></td>
    </tr></tbody></table>`;
    const frame = await loadDoc(page, html);
    await select(frame, '[data-block-type="Columnas"]');
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Columnas');
    await page.locator('button[title="Quitar columna"]').first().click();
    await page.waitForTimeout(400);
    const html2 = await getRawHtml(frame);
    const tds = html2.match(/<td[^]*?<\/td>/g) || [];
    const contentPreserved = tds.length === 2 && /Col B/.test(tds[1]) && /Col C \(removed\)/.test(tds[1]);
    record('C4: removing a column MOVES its content into the last remaining cell (never discards)', contentPreserved, `tds=${tds.length} last=${(tds[1] || '').slice(0, 120)}`);

    await page.locator('button[title="Agregar columna"]').first().click();
    await page.waitForTimeout(400);
    const html3 = await getRawHtml(frame);
    const tds3 = html3.match(/<td[^]*?<\/td>/g) || [];
    const newColHasPlaceholder = tds3.length === 3 && /data-block-type="placeholder"/.test(tds3[2]);
    record('C5: adding a column seeds it with a placeholder', newColHasPlaceholder, `tds=${tds3.length}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. Lista: panel shows real items, editing one leaves the others intact,
  //    switching viñetas -> numerada preserves items and flips the tag.
  // ══════════════════════════════════════════════════════════════════════
  {
    const frame = await loadDoc(page, '<div id="marker">x</div>');
    await page.locator('.block-item', { hasText: 'Lista' }).first().click();
    await page.waitForTimeout(400);
    await select(frame, '[data-block-type="Lista"]');
    await page.waitForTimeout(300);
    await ensureSectionOpen(page, 'Lista');
    const item1 = await fieldValue(page, 'Ítem 1');
    const item2Before = await fieldValue(page, 'Ítem 2');
    record('L1: Lista panel shows the real item text (not blank/null)', item1 === 'Elemento 1' && item2Before === 'Elemento 2', `item1=${item1} item2=${item2Before}`);

    await setFieldText(page, 'Ítem 1', 'Edited item');
    await page.waitForTimeout(300);
    const item2After = await fieldValue(page, 'Ítem 2');
    record('L2: editing one item does not disturb the others', item2After === 'Elemento 2', `item2After=${item2After}`);

    await setFieldSelect(page, 'Tipo', 'ol');
    await page.waitForTimeout(400);
    const html2 = await getRawHtml(frame);
    const flippedToOl = /data-block-type="Lista Ordenada"/.test(html2) && /<ol[^>]*data-block-type="Lista Ordenada"/.test(html2);
    const itemsSurvived = (html2.match(/<li>/g) || []).length === 3 && /Edited item/.test(html2);
    record('L3: switching to numerada flips the tag+marker and preserves all items', flippedToOl && itemsSurvived, html2.slice(0, 200));
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
