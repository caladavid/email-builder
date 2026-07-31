const KEYWORDS = new Set(['auto', 'inherit', 'initial', 'unset', 'fit-content', 'max-content', 'min-content']);
const UNITS = ['px', 'em', 'rem', '%', 'vw', 'vh', 'pt'];

/**
 * Normalizes a raw user-typed CSS length so it is never sent to the DOM as
 * invalid CSS (e.g. a bare "300" silently no-ops and the field snaps back
 * to the computed value on the next canvas round-trip).
 *
 * '300' → '300px' | '50 %' → '50%' | 'auto' → 'auto' | '' → '' | 'garbage' → null
 */
export function normalizeLength(raw: string): string | null {
  const v = (raw ?? '').trim();
  if (v === '') return '';
  if (KEYWORDS.has(v.toLowerCase())) return v.toLowerCase();
  if (/^calc\(.+\)$/i.test(v) || /^var\(--[\w-]+(\s*,\s*.+)?\)$/i.test(v)) return v;

  const withoutSpace = v.replace(/\s+/g, '');
  const bareNumber = /^-?\d*\.?\d+$/;
  if (bareNumber.test(withoutSpace)) return `${withoutSpace}px`;

  const match = withoutSpace.match(/^(-?\d*\.?\d+)(px|em|rem|%|vw|vh|pt)$/i);
  if (match) return `${match[1]}${match[2].toLowerCase()}`;

  return null;
}

/** '300px' → 300; '50%' → null; 'auto' → null */
export function toPxInt(value: string): number | null {
  const v = (value ?? '').trim();
  const match = v.match(/^(-?\d*\.?\d+)px$/i);
  if (!match) return null;
  const n = Math.round(parseFloat(match[1]));
  return Number.isNaN(n) ? null : n;
}
