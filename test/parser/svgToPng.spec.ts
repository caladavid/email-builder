import { describe, it, expect } from 'vitest';
import { isSvgFile, readSvgSize } from '../../src/utils/svgToPng';

// The canvas rendering itself (svgFileToPng) needs a real browser: it is
// checked in test/e2e/html-security-check.mjs.
describe('svgToPng helpers', () => {
  it('detects SVG by MIME type or extension', () => {
    expect(isSvgFile({ type: 'image/svg+xml', name: 'x' })).toBe(true);
    expect(isSvgFile({ type: '', name: 'logo.SVG' })).toBe(true);
    expect(isSvgFile({ type: 'image/png', name: 'logo.png' })).toBe(false);
  });

  it('reads size from width/height, viewBox, or a mix', () => {
    expect(readSvgSize('<svg width="120" height="40"></svg>')).toEqual({ width: 120, height: 40 });
    expect(readSvgSize('<svg viewBox="0 0 300 100"></svg>')).toEqual({ width: 300, height: 100 });
    expect(readSvgSize('<svg width="150" viewBox="0 0 300 100"></svg>')).toEqual({ width: 150, height: 50 });
    expect(readSvgSize('<svg width="100%" viewBox="0,0,24,24"></svg>')).toEqual({ width: 24, height: 24 });
    expect(readSvgSize('<svg></svg>')).toBeNull();
    expect(readSvgSize('no es svg')).toBeNull();
  });
});
