import { describe, it, expect, afterEach } from 'vitest';
import { isFillerNode, hasRealChildren, getElementPath } from '../../src/utils/canvasDomHelpers';

function el(html: string): Element {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  return doc.getElementById('root')!.firstElementChild!;
}

function root(html: string): Element {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  return doc.getElementById('root')!;
}

describe('isFillerNode', () => {
  it('empty <p></p> is filler', () => {
    expect(isFillerNode(el('<p></p>'))).toBe(true);
  });

  it('whitespace-only <p> is filler', () => {
    expect(isFillerNode(el('<p> </p>'))).toBe(true);
  });

  it('<p> with text is not filler', () => {
    expect(isFillerNode(el('<p>x</p>'))).toBe(false);
  });

  it('<img> with no text is not filler (void/replaced element)', () => {
    expect(isFillerNode(el('<img src="x.png">'))).toBe(false);
  });

  it('<div> with an element child is not filler, even if that child is empty', () => {
    expect(isFillerNode(el('<div><span></span></div>'))).toBe(false);
  });

  it('<hr> is not filler', () => {
    expect(isFillerNode(el('<hr>'))).toBe(false);
  });
});

describe('hasRealChildren', () => {
  it('the exact broken-Contenedor shape [empty <p>, placeholder, empty <p>] has no real children', () => {
    const parent = root('<p></p><div data-block-type="placeholder"></div><p></p>');
    expect(hasRealChildren(parent)).toBe(false);
  });

  it('a container with real text content has real children', () => {
    const parent = root('<p>hello</p>');
    expect(hasRealChildren(parent)).toBe(true);
  });

  it('a container with only SCRIPT/STYLE has no real children', () => {
    const parent = root('<script>1</script><style>a{}</style>');
    expect(hasRealChildren(parent)).toBe(false);
  });

  it('a container with only the internal overlay divs has no real children', () => {
    const parent = root('<div id="__box-model-overlay__"></div><div id="__drop-indicator__"></div>');
    expect(hasRealChildren(parent)).toBe(false);
  });

  it('a container with only a placeholder has no real children', () => {
    const parent = root('<div data-block-type="placeholder"></div>');
    expect(hasRealChildren(parent)).toBe(false);
  });

  it('an empty container has no real children', () => {
    const parent = root('');
    expect(hasRealChildren(parent)).toBe(false);
  });

  it('a container with a real image has real children', () => {
    const parent = root('<img src="x.png">');
    expect(hasRealChildren(parent)).toBe(true);
  });
});

// getElementPath needs elements actually attached under the AMBIENT
// document.body (unlike the other helpers here) — it compares against the
// real global document.body/documentElement, which a DOMParser-parsed
// document never is.
describe('getElementPath', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('every segment carries an explicit :nth-of-type index, even the only sibling of its tag', () => {
    document.body.innerHTML = '<div><p>only child</p></div>';
    const p = document.body.querySelector('p')!;
    const path = getElementPath(p);
    expect(path).toBe('body > div:nth-of-type(1) > p:nth-of-type(1)');
  });

  it('resolves back to the exact same node via document.querySelector', () => {
    document.body.innerHTML = '<div><p id="a">A</p><p id="b">B</p></div>';
    const b = document.body.querySelector('#b')!;
    const path = getElementPath(b);
    expect(document.querySelector(path)).toBe(b);
  });

  it('a path captured BEFORE appending a same-tag sibling AFTER it still resolves to the same node', () => {
    // A positional selector can never survive a sibling inserted BEFORE the
    // target — that's exactly why the data-block-id migration is proposed as
    // separate, out-of-scope work (see the plan). This guards the case the
    // fix actually targets: the OLD code only added :nth-of-type once
    // siblings.length > 1, so a path captured while an element was the lone
    // child of its tag came back as a BARE tag selector, which then matches
    // whichever element of that tag comes FIRST in the DOM — silently the
    // wrong one — the moment ANY sibling of that tag exists, regardless of
    // where it's inserted. The always-indexed fix has no such "momentarily
    // unique" blind spot.
    document.body.innerHTML = '<div><p id="only">only</p></div>';
    const p = document.body.querySelector('#only')!;
    const path = getElementPath(p);
    expect(path).toContain(':nth-of-type(1)');

    const newP = document.createElement('p');
    newP.id = 'appended';
    p.parentElement!.appendChild(newP); // inserted AFTER — target's own position is unchanged
    expect(document.querySelector(path)).toBe(p);
  });

  it('returns "body" for document.body itself', () => {
    expect(getElementPath(document.body)).toBe('body');
  });
});
