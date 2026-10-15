// Security regression check for imported template HTML and the canvas bridge.
// Runs against real Chrome because happy-dom (vitest) mis-parses Outlook
// conditional comments and can't drive the same-origin canvas iframe.
//
// Requires: `npm run dev` running (defaults to http://localhost:5173) and a
// system Chrome install. Not part of `npm test`.
//
// Usage: node test/e2e/html-security-check.mjs

import { chromium } from 'playwright-core';

const BASE_URL = process.env.DEV_URL || 'http://localhost:5173';
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

const MALICIOUS_HTML = `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml"><head><meta charset="utf-8">
<script>window.parent.__pwned = 'script';</script>
<style>.x{background:url("javascript:window.parent.__pwned='css'")}</style>
</head><body>
<table role="presentation" width="600"><tr><td style="padding:20px;">
<p id="sec-p">Texto seguro</p>
<img id="sec-img" src="x-does-not-exist.png" onerror="window.parent.__pwned='onerror'">
<a id="sec-a" href="javascript:window.parent.__pwned='href'">link</a>
<a id="sec-ok" href="https://celcom.cl">ok</a>
<!--[if mso]><v:roundrect arcsize="10%" fillcolor="#0045B0"><v:textbox>MSO</v:textbox></v:roundrect><![endif]-->
<iframe id="sec-iframe" srcdoc="<script>parent.parent.__pwned='iframe'</script>"></iframe>
<form id="sec-form" action="https://evil.example"><span id="sec-in-form">en form</span></form>
</td></tr></table></body></html>`;

async function findCanvasFrame(page) {
  for (const f of page.frames()) {
    try { if (await f.evaluate(() => !!document.getElementById('sec-p'))) return f; } catch (e) {}
  }
  return null;
}

async function sendToCanvas(page, cmd) {
  await page.evaluate((c) => {
    const ifr = Array.from(document.querySelectorAll('iframe')).find((i) => {
      try { return !!i.contentDocument?.getElementById('sec-p'); } catch (e) { return false; }
    });
    ifr.contentWindow.postMessage(c, '*');
  }, cmd);
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.evaluate((h) => window.postMessage({ type: 'loadDocument', html: h }, window.location.origin), MALICIOUS_HTML);
  await page.waitForTimeout(1500);

  const frame = await findCanvasFrame(page);
  record('malicious template still loads into the canvas', !!frame);
  if (!frame) { await browser.close(); process.exit(1); }

  // 1. Nothing from the template executed in the builder origin
  const pwned = await page.evaluate(() => window.__pwned);
  record('no template script/handler/URL executed', pwned === undefined, pwned ? `__pwned=${pwned}` : '');

  // 2. Canvas DOM is clean but email markup survives
  const canvas = await frame.evaluate(() => ({
    templateScripts: Array.from(document.scripts).filter((s) => s.id !== '__canvas-bridge__' && !/DOMPurify/.test(s.textContent || '')).length,
    imgOnerror: document.getElementById('sec-img')?.hasAttribute('onerror'),
    aHref: document.getElementById('sec-a')?.getAttribute('href'),
    okHref: document.getElementById('sec-ok')?.getAttribute('href'),
    iframe: !!document.getElementById('sec-iframe'),
    form: !!document.getElementById('sec-form'),
    formContent: !!document.getElementById('sec-in-form'),
    mso: document.body.innerHTML.includes('<!--[if mso]>') && document.body.innerHTML.includes('v:roundrect'),
    cssJs: Array.from(document.querySelectorAll('style')).some((s) => /javascript:/i.test(s.textContent || '')),
  }));
  record('template <script> removed', canvas.templateScripts === 0, `count=${canvas.templateScripts}`);
  record('onerror attribute removed', canvas.imgOnerror === false);
  record('javascript: href removed', canvas.aHref === null, String(canvas.aHref));
  record('https href kept', canvas.okHref === 'https://celcom.cl');
  record('<iframe srcdoc> removed', canvas.iframe === false);
  record('<form> unwrapped, content kept', canvas.form === false && canvas.formContent === true);
  record('Outlook conditional comment + VML kept', canvas.mso === true);
  record('javascript: in <style> scrubbed', canvas.cssJs === false);

  // 3. Export is clean and keeps MSO markup
  const exported = await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    return pinia._s.get('inspectorDrawer').getHtmlFromDocument();
  });
  record('export has no script/on*/javascript:', !/<script(?![^>]*__canvas)|\sonerror=|javascript:/i.test(exported.replace(/<script[^>]*id="__canvas-bridge__"[\s\S]*?<\/script>/i, '')));
  record('export keeps Outlook conditional comment', exported.includes('<!--[if mso]>'));

  // 4. Bridge: legit command from the builder still works
  await sendToCanvas(page, { type: 'set-attr', path: '#sec-p', property: 'title', value: 'ok-title' });
  record('builder set-attr (safe) applied', (await frame.evaluate(() => document.getElementById('sec-p').getAttribute('title'))) === 'ok-title');

  // 5. Bridge: unsafe attributes / commands from the builder are rejected
  await sendToCanvas(page, { type: 'set-attr', path: '#sec-p', property: 'onclick', value: "window.parent.__pwned='set-attr'" });
  record('set-attr onclick rejected', !(await frame.evaluate(() => document.getElementById('sec-p').hasAttribute('onclick'))));
  await sendToCanvas(page, { type: 'set-child-attr', path: '#sec-p', selector: 'a', property: 'href', value: 'javascript:alert(1)' });
  await sendToCanvas(page, { type: 'set-attr', path: '#sec-ok', property: 'href', value: 'javascript:alert(1)' });
  record('set-attr javascript: href rejected', (await frame.evaluate(() => document.getElementById('sec-ok').getAttribute('href'))) === 'https://celcom.cl');
  await sendToCanvas(page, { type: 'exec-command', path: '#sec-p', command: 'insertHTML', value: '<img src=x onerror="window.parent.__pwned=\'exec\'">' });
  await page.waitForTimeout(300);
  record('exec-command insertHTML rejected', (await page.evaluate(() => window.__pwned)) === undefined && !(await frame.evaluate(() => !!document.querySelector('#sec-p img'))));
  // exec-command enters edit mode — leave it so later checks see a stable DOM
  await frame.evaluate(() => document.body.click());

  // 6. Bridge: commands from a window other than the builder are ignored
  await frame.evaluate(() => window.postMessage({ type: 'set-attr', path: '#sec-p', property: 'title', value: 'from-self' }, '*'));
  await page.waitForTimeout(300);
  record('command from non-parent window ignored', (await frame.evaluate(() => document.getElementById('sec-p').getAttribute('title'))) === 'ok-title');

  // 7. Fase 2: sinks secundarios (DOMPurify / readers), evaluated in real Chrome
  const p2 = await page.evaluate(async () => {
    const { sanitizeInlineHtml, sanitizeTemplateHtml } = await import('/src/utils/htmlSecurity.ts');
    const inline = sanitizeInlineHtml('<b>Hola</b> <i>{nombre}</i> <a href="https://celcom.cl" target="_blank">x</a><img src=x onerror="window.__pwned=1"><a href="javascript:alert(1)">y</a>');
    const htmlBlock = sanitizeTemplateHtml('<!--[if mso]><table><tr><td>MSO</td></tr></table><![endif]--><p onclick="x()">bloque</p>');
    const { default: renderToStaticMarkup } = await import('/src/lib/email-builder/renderers/renderToStaticMarkup.ts');
    const doc = {
      root: { type: 'EmailLayout', data: { childrenIds: ['h', 't', 'b', 'x'], backdropColor: '#fff', canvasColor: '#fff', textColor: '#000', fontFamily: 'MODERN_SANS' } },
      h: { type: 'Heading', data: { props: { text: 'Titulo<img src=x onerror="window.__pwned=2">', level: 'h1' }, style: {} } },
      t: { type: 'Text', data: { props: { markdown: true, text: '[a](javascript:alert(1)) [b](https://x.cl" onmouseover="alert(1))' }, style: {} } },
      b: { type: 'Button', data: { props: { text: 'Boton', url: 'javascript:alert(1)' }, style: {} } },
      x: { type: 'Html', data: { props: { contents: '<p>html</p><img src=x onerror="window.__pwned=3">' }, style: {} } },
    };
    const rendered = await renderToStaticMarkup(doc, { rootBlockId: 'root' });
    // Inspect the real DOM: escaped text like "onerror=&quot;" is inert, only attributes matter
    const parsed = new DOMParser().parseFromString(rendered, 'text/html');
    const bad = [];
    parsed.querySelectorAll('*').forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        if (/^on/i.test(a.name) || /^\s*(javascript|vbscript):/i.test(a.value)) bad.push(el.localName + '[' + a.name + '=' + a.value + ']');
      }
    });
    return { inline, htmlBlock, rendered, bad };
  });
  record('sanitizeInlineHtml keeps <b>/{var}/target, drops onerror/javascript:',
    p2.inline.includes('<b>Hola</b>') && p2.inline.includes('{nombre}') && p2.inline.includes('target="_blank"') && !/onerror|javascript:/i.test(p2.inline), p2.inline);
  record('Html block sanitizer keeps MSO comment, drops onclick', p2.htmlBlock.includes('<!--[if mso]>') && !/onclick/i.test(p2.htmlBlock));
  record('rendered blocks (Heading/Text md/Button/Html) have no handlers or javascript:',
    p2.rendered.includes('Titulo') && p2.rendered.includes('html') && p2.bad.length === 0, p2.bad.join(' | '));
  record('nothing executed during block rendering', (await page.evaluate(() => window.__pwned)) === undefined);

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
