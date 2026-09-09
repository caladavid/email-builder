import { describe, it, expect } from 'vitest';
import { normalizeFontWeight, reconcileOptions } from '../../src/utils/style-display';
import { collapseSides } from '../../src/utils/canvasDomHelpers';

describe('normalizeFontWeight', () => {
  it('maps CSS keywords to the numeric string the option list uses', () => {
    expect(normalizeFontWeight('bold')).toBe('700');
    expect(normalizeFontWeight('bolder')).toBe('800');
    expect(normalizeFontWeight('lighter')).toBe('300');
    expect(normalizeFontWeight('normal')).toBe('400');
    expect(normalizeFontWeight('')).toBe('400');
  });

  it('passes numeric weights through unchanged', () => {
    expect(normalizeFontWeight('600')).toBe('600');
    expect(normalizeFontWeight('100')).toBe('100');
  });
});

describe('reconcileOptions', () => {
  const options = [
    { label: 'Ligero (300)', value: '300' },
    { label: 'Normal (400)', value: '400' },
    { label: 'Negrita (700)', value: '700' },
  ];

  it('returns the options untouched when the value is already listed', () => {
    expect(reconcileOptions('400', options)).toEqual(options);
  });

  it('never silently shows option[0] for a value not in the list — prepends it labeled "(actual)"', () => {
    const out = reconcileOptions('900', options);
    expect(out[0]).toEqual({ label: '900 (actual)', value: '900' });
    expect(out.slice(1)).toEqual(options);
  });

  it('prepends a "—" entry for an empty value, hinting the computed value', () => {
    const out = reconcileOptions('', options, 'center');
    expect(out[0]).toEqual({ label: '— (center)', value: '' });
  });

  it('prepends a bare "—" when there is no computed value to hint', () => {
    const out = reconcileOptions('', options);
    expect(out[0].value).toBe('');
    expect(out[0].label).toBe('—');
  });

  it('does not duplicate a blank entry the option list already provides', () => {
    const withBlank = [{ label: 'Auto', value: '' }, ...options];
    expect(reconcileOptions('', withBlank, 'center')).toEqual(withBlank);
  });
});

describe('collapseSides', () => {
  it('reports uniform sides with mixed:false', () => {
    expect(collapseSides('1px', '1px', '1px', '1px')).toEqual({ value: '1px', mixed: false });
  });

  it('reports non-uniform sides with mixed:true, using the top value as representative', () => {
    expect(collapseSides('1px', '0px', '0px', '0px')).toEqual({ value: '1px', mixed: true });
  });
});
