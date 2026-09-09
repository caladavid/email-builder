import { describe, it, expect } from 'vitest';
import { normalizeCssLength, normalizeLength } from '../../src/utils/css-length';

describe('normalizeCssLength — lineHeight (regression guard for the "1.4px collapses the text" bug)', () => {
  it('a bare number stays unitless', () => {
    expect(normalizeCssLength('lineHeight', '1.5')).toBe('1.5');
  });

  it('does NOT append px', () => {
    expect(normalizeCssLength('lineHeight', '1.4')).not.toBe('1.4px');
  });

  it('accepts "normal"', () => {
    expect(normalizeCssLength('lineHeight', 'normal')).toBe('normal');
  });

  it('still accepts an explicit unit if the user types one', () => {
    expect(normalizeCssLength('lineHeight', '24px')).toBe('24px');
    expect(normalizeCssLength('lineHeight', '150%')).toBe('150%');
  });

  it('rejects garbage', () => {
    expect(normalizeCssLength('lineHeight', 'garbage')).toBeNull();
  });
});

describe('normalizeCssLength — other per-property keywords', () => {
  it('letterSpacing accepts "normal"', () => {
    expect(normalizeCssLength('letterSpacing', 'normal')).toBe('normal');
  });

  it('maxWidth accepts "none"', () => {
    expect(normalizeCssLength('maxWidth', 'none')).toBe('none');
  });

  it('borderWidth accepts keyword widths', () => {
    expect(normalizeCssLength('borderWidth', 'thin')).toBe('thin');
    expect(normalizeCssLength('borderWidth', 'Thick')).toBe('thick');
  });

  it('fontSize accepts keyword sizes', () => {
    expect(normalizeCssLength('fontSize', 'larger')).toBe('larger');
  });
});

describe('normalizeCssLength — multi-value properties', () => {
  it('borderRadius accepts a 4-value shorthand', () => {
    expect(normalizeCssLength('borderRadius', '8px 8px 0 0')).toBe('8px 8px 0px 0px');
  });

  it('borderWidth accepts a per-side value', () => {
    expect(normalizeCssLength('borderWidth', '1px 2px 3px 4px')).toBe('1px 2px 3px 4px');
  });

  it('rejects a multi-value if any single part is invalid', () => {
    expect(normalizeCssLength('borderRadius', '8px garbage')).toBeNull();
  });
});

describe('normalizeCssLength — properties with no rule fall back to default behavior', () => {
  it('width: bare number -> px', () => {
    expect(normalizeCssLength('width', '300')).toBe('300px');
  });

  it('width: percentage with a space is normalized', () => {
    expect(normalizeCssLength('width', '50 %')).toBe('50%');
  });

  it('width: auto passes through', () => {
    expect(normalizeCssLength('width', 'auto')).toBe('auto');
  });

  it('width: empty string passes through unchanged', () => {
    expect(normalizeCssLength('width', '')).toBe('');
  });
});

describe('normalizeLength — legacy wrapper is unchanged (setImageWidth/setImageHeight depend on this)', () => {
  it('bare "1.5" still becomes "1.5px" (no unitless rule applied)', () => {
    expect(normalizeLength('1.5')).toBe('1.5px');
  });

  it('"300" -> "300px"', () => {
    expect(normalizeLength('300')).toBe('300px');
  });

  it('"auto" passes through', () => {
    expect(normalizeLength('auto')).toBe('auto');
  });

  it('garbage -> null', () => {
    expect(normalizeLength('garbage')).toBeNull();
  });
});
