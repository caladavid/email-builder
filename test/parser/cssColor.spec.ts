import { describe, it, expect } from 'vitest';
import { parseCssColor, toHex6, formatColor } from '../../src/utils/css-color';

describe('parseCssColor — never resolves to black for unset/unparseable values', () => {
  it.each(['', 'none', 'inherit', 'Inherit', 'currentColor', 'unset', 'initial'])(
    '%s -> null (not #000000)',
    (v) => {
      expect(parseCssColor(v)).toBeNull();
    }
  );

  it('garbage input -> null', () => {
    expect(parseCssColor('not-a-color')).toBeNull();
  });
});

describe('parseCssColor — hex', () => {
  it('#fff -> white, opaque', () => {
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('#ffffff -> white, opaque', () => {
    expect(parseCssColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('#0000 -> transparent black', () => {
    expect(parseCssColor('#0000')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('#ffffffff -> white, opaque (8-digit alpha)', () => {
    expect(parseCssColor('#ffffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('#ff000080 -> red, ~50% alpha', () => {
    const c = parseCssColor('#ff000080')!;
    expect(c.r).toBe(255);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
    expect(c.a).toBeCloseTo(0.502, 2);
  });
});

describe('parseCssColor — rgb()/rgba()', () => {
  it('rgb(0, 123, 255) -> opaque', () => {
    expect(parseCssColor('rgb(0, 123, 255)')).toEqual({ r: 0, g: 123, b: 255, a: 1 });
  });

  it('rgba(0, 0, 0, 0.5) -> half alpha', () => {
    expect(parseCssColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
  });

  it('modern space syntax rgb(0 123 255 / 50%) -> half alpha', () => {
    expect(parseCssColor('rgb(0 123 255 / 50%)')).toEqual({ r: 0, g: 123, b: 255, a: 0.5 });
  });
});

describe('parseCssColor — named colors and transparent', () => {
  it('red -> {255,0,0,1}', () => {
    expect(parseCssColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('rebeccapurple -> {102,51,153,1}', () => {
    expect(parseCssColor('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153, a: 1 });
  });

  it('is case-insensitive', () => {
    expect(parseCssColor('ReD')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('transparent -> alpha 0', () => {
    const c = parseCssColor('transparent')!;
    expect(c.a).toBe(0);
  });
});

describe('toHex6 / formatColor', () => {
  it('toHex6 pads single-digit bytes', () => {
    expect(toHex6({ r: 0, g: 5, b: 255, a: 1 })).toBe('#0005ff');
  });

  it('formatColor is #rrggbb for fully opaque', () => {
    expect(formatColor({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000');
  });

  it('formatColor is rgba(...) when alpha < 1', () => {
    expect(formatColor({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('rgba(0, 0, 0, 0.5)');
  });
});

describe('round-trip: formatColor(parseCssColor(x)) reparses to the same color', () => {
  it.each(['#ff0000', 'rgba(0, 123, 255, 0.5)', 'red', 'transparent', 'rgb(0, 123, 255)'])(
    '%s round-trips',
    (input) => {
      const first = parseCssColor(input)!;
      const reparsed = parseCssColor(formatColor(first))!;
      expect(reparsed.r).toBe(first.r);
      expect(reparsed.g).toBe(first.g);
      expect(reparsed.b).toBe(first.b);
      expect(reparsed.a).toBeCloseTo(first.a, 2);
    }
  );
});
