// @vitest-environment-options { "settings": { "disableJavaScriptFileLoading": true, "disableJavaScriptEvaluation": true, "disableIframePageLoading": true, "disableCSSFileLoading": true } }
// happy-dom would otherwise try to fetch/run <script src>/<iframe src> inside
// DOMParser documents (real browsers never do). Also note: happy-dom mis-parses
// Outlook conditional comments (<!--[if mso]>...<![endif]-->), which Chrome
// parses as a single comment node — their preservation is checked against
// real Chrome in test/e2e/html-security-check.mjs instead of here.
import { describe, it, expect } from 'vitest';
import { sanitizeTemplateHtml, isSafeAttribute, isSafeUrl, escapeHtmlAttr } from '../../src/utils/htmlSecurity';

const wrap = (body: string, head = '') =>
  `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

describe('sanitizeTemplateHtml: removes script vectors', () => {
  it('drops inline and external <script>', () => {
    const out = sanitizeTemplateHtml(wrap('<p>hola</p><script>alert(1)</script>', '<script type="text/javascript">steal()</script>'));
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('<p>hola</p>');
  });

  it('drops on* handlers (quoted, unquoted, svg)', () => {
    const out = sanitizeTemplateHtml(wrap('<img src="a.png" onerror=alert(1)><svg onload="alert(1)"></svg><div ONCLICK="x()">t</div>'));
    expect(out).not.toMatch(/\son\w+=/i);
    expect(out).toContain('src="a.png"');
    expect(out).toContain('>t</div>');
  });

  it('neutralizes javascript:/vbscript: URLs including obfuscated ones', () => {
    const out = sanitizeTemplateHtml(wrap(
      '<a href="javascript:alert(1)">a</a>' +
      '<a href=" JaVa\tScRiPt:alert(1)">b</a>' +
      '<a href="vbscript:msgbox(1)">c</a>' +
      '<a href="&#106;avascript:alert(1)">d</a>' +
      '<svg><a xlink:href="javascript:alert(1)"><text>e</text></a></svg>'
    ));
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out.toLowerCase()).not.toContain('vbscript:');
    expect(out).toContain('>a</a>');
  });

  it('removes iframe/object/embed/base/template and meta refresh', () => {
    const out = sanitizeTemplateHtml(wrap(
      '<iframe src="https://evil"></iframe><object data="x"></object><embed src="x"><template><img src=x onerror=1></template>',
      '<base href="https://evil/"><meta http-equiv="refresh" content="0;url=https://evil">'
    ));
    expect(out).not.toMatch(/<(iframe|object|embed|base|template)/i);
    expect(out).not.toMatch(/http-equiv="refresh"/i);
  });

  it('unwraps <form> but keeps its content', () => {
    const out = sanitizeTemplateHtml(wrap('<form action="https://evil"><table><tr><td>dentro</td></tr></table></form>'));
    expect(out).not.toMatch(/<form/i);
    expect(out).toContain('dentro');
  });

  it('scrubs dangerous CSS in style attributes and <style>', () => {
    const out = sanitizeTemplateHtml(wrap(
      '<div style="background:url(javascript:alert(1))">x</div>',
      '<style>.a{background:url("javascript:alert(1)")} .b{width:expression(alert(1))}</style>'
    ));
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out).not.toMatch(/[^-]expression\(/);
  });

  it('removes srcdoc and SVG animate targeting href', () => {
    const out = sanitizeTemplateHtml(wrap('<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>'));
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out).not.toMatch(/<animate/i);
  });
});

describe('sanitizeTemplateHtml: preserves email markup', () => {
  it('keeps <meta charset>/viewport and @media in <style>', () => {
    const out = sanitizeTemplateHtml(wrap(
      '<a href="https://celcom.cl" style="color:#fff">Botón</a>',
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>@media (max-width:600px){.c{width:100%!important}}</style>'
    ));
    expect(out).toContain('href="https://celcom.cl"');
    expect(out).toContain('@media (max-width:600px)');
    expect(out).toContain('<meta charset="utf-8">');
    expect(out).toContain('name="viewport"');
  });

  it('keeps table email attributes, data-* and merge tags', () => {
    const out = sanitizeTemplateHtml(wrap(
      '<table width="600" cellpadding="0" bgcolor="#ffffff" align="center"><tr><td valign="top" data-block-type="Texto">' +
      '<a href="{url_promo}">Hola {nombre}</a><img src="cid:logo"><a href="mailto:a@b.cl">m</a><a href="tel:+56">t</a><a href="#top">#</a></td></tr></table>'
    ));
    expect(out).toContain('width="600"');
    expect(out).toContain('bgcolor="#ffffff"');
    expect(out).toContain('data-block-type="Texto"');
    expect(out).toContain('href="{url_promo}"');
    expect(out).toContain('Hola {nombre}');
    expect(out).toContain('src="cid:logo"');
    expect(out).toContain('href="mailto:a@b.cl"');
    expect(out).toContain('href="tel:+56"');
  });

  it('keeps legit CSS like scroll-behavior', () => {
    const out = sanitizeTemplateHtml(wrap('<div style="scroll-behavior:smooth;color:red">x</div>', '<style>html{scroll-behavior:smooth}</style>'));
    expect(out).toContain('scroll-behavior:smooth;color:red');
    expect(out).toContain('html{scroll-behavior:smooth}');
  });

  it('preserves a legacy XHTML doctype', () => {
    const out = sanitizeTemplateHtml('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html><body><p>x</p></body></html>');
    expect(out.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"')).toBe(true);
  });

  it('is idempotent on clean documents', () => {
    const once = sanitizeTemplateHtml(wrap('<table><tr><td style="padding:10px"><a href="https://x.cl?a=1&b=2">x</a></td></tr></table>', '<meta charset="utf-8">'));
    expect(sanitizeTemplateHtml(once)).toBe(once);
  });

  it('returns fragments as fragments', () => {
    const out = sanitizeTemplateHtml('<style>.a{}</style><p onclick="x()">hola</p>');
    expect(out).toBe('<style>.a{}</style><p>hola</p>');
  });
});

describe('isSafeAttribute / isSafeUrl', () => {
  it('rejects event handlers and srcdoc', () => {
    expect(isSafeAttribute('onclick', 'x()')).toBe(false);
    expect(isSafeAttribute('OnError', 'x()')).toBe(false);
    expect(isSafeAttribute('srcdoc', '<p>')).toBe(false);
    expect(isSafeAttribute('formaction', 'https://x')).toBe(false);
    expect(isSafeAttribute('bad name', 'x')).toBe(false);
  });

  it('allows normal attributes', () => {
    expect(isSafeAttribute('alt', 'Logo')).toBe(true);
    expect(isSafeAttribute('alt', 'javascript: the good parts')).toBe(true);
    expect(isSafeAttribute('target', '_blank')).toBe(true);
    expect(isSafeAttribute('width', '600')).toBe(true);
  });

  it('URL allowlist', () => {
    expect(isSafeUrl('https://celcom.cl')).toBe(true);
    expect(isSafeUrl('http://celcom.cl')).toBe(true);
    expect(isSafeUrl('mailto:a@b.cl')).toBe(true);
    expect(isSafeUrl('tel:+56912345678')).toBe(true);
    expect(isSafeUrl('/ruta/relativa')).toBe(true);
    expect(isSafeUrl('//cdn.celcom.cl/x.png')).toBe(true);
    expect(isSafeUrl('#ancla')).toBe(true);
    expect(isSafeUrl('{url}')).toBe(true);
    expect(isSafeUrl('{{url}}')).toBe(true);
    expect(isSafeUrl('')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('  JAVASCRIPT:alert(1)')).toBe(false);
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false);
    expect(isSafeUrl('vbscript:x')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('data:image/png;base64,AAAA')).toBe(false); // never as href
    expect(isSafeUrl('data:image/png;base64,AAAA', 'src')).toBe(true);
    expect(isSafeUrl('data:text/html,x', 'src')).toBe(false);
  });

  it('isSafeAttribute is self-contained (embedded in the canvas via toString)', () => {
    // eslint-disable-next-line no-new-func
    const rebuilt = new Function('return ' + isSafeAttribute.toString())();
    expect(rebuilt('href', 'javascript:x')).toBe(false);
    expect(rebuilt('href', 'https://x')).toBe(true);
  });
});

describe('escapeHtmlAttr', () => {
  it('escapes quotes and angle brackets', () => {
    expect(escapeHtmlAttr(`a"b'c<d>&`)).toBe('a&quot;b&#39;c&lt;d&gt;&amp;');
  });
});

describe('Fase 2: sinks secundarios', () => {
  // sanitizeInlineHtml (DOMPurify) is checked in test/e2e/html-security-check.mjs:
  // DOMPurify doesn't work under happy-dom (returns handlers untouched).

  it('pasteSanitizer escapes quotes inside href', async () => {
    const { sanitizePastedHtml } = await import('../../src/utils/pasteSanitizer');
    const out = sanitizePastedHtml('<a href=\'https://x.cl" onmouseover="alert(1)\'>link</a>');
    expect(out).not.toMatch(/"\s*onmouseover=/);
    expect(out).toContain('&quot;');
  });

  it('grapesJsProjectToHtml drops script tags, on* attrs and escapes quotes', async () => {
    const { grapesJsProjectToHtml } = await import('../../src/utils/grapesJsToHtml');
    const project: any = {
      pages: [{ frames: [{ component: { components: [
        { tagName: 'script', components: [{ type: 'textnode', content: 'alert(1)' }] },
        { tagName: 'div', attributes: { onclick: 'alert(1)', title: 'a" onmouseover="alert(1)', 'bad name': 'x' }, components: [{ type: 'textnode', content: 'ok' }] },
        { tagName: 'img"><svg onload=alert(1)>', components: [] },
      ] } }] }],
      styles: [],
    };
    const out = grapesJsProjectToHtml(project);
    expect(out).not.toMatch(/<script|onclick|onload|"\s*onmouseover=/i);
    expect(out).toContain('>ok</div>');
  });

  it('processDocumentVariables ignores prototype keys', async () => {
    const { processDocumentVariables } = await import('../../src/utils/documentProcessor');
    expect(processDocumentVariables('Hola {nombre} {constructor}', { nombre: 'Ana' })).toBe('Hola Ana {constructor}');
  });
});
