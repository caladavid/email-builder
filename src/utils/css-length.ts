const KEYWORDS = new Set(['auto', 'inherit', 'initial', 'unset', 'fit-content', 'max-content', 'min-content']);

// Per-property exceptions to the default "bare number -> px, else must have a
// unit" rule. Added because the default rule was silently dropping values a
// user would reasonably type for these specific properties — the setter
// just returns null and the field snaps back with no feedback:
//   - lineHeight: unitless is the actual email-builder standard (scales with
//     font-size, survives Outlook) — typing the "1.5" the field's own
//     placeholder suggests used to become "1.5px" and collapse the text.
//   - letterSpacing/maxWidth/minWidth: "normal"/"none" are real CSS values,
//     not typos.
//   - fontSize: the CSS keyword sizes (smaller/larger/x-large/...).
//   - borderWidth: the CSS keyword widths, and a per-side value like
//     "1px 2px 0 0".
//   - borderRadius: almost always typed as 2-4 space-separated values.
export type LengthRule = {
  unitless?: boolean;
  keywords?: string[];
  multi?: boolean;
};
export const LENGTH_RULES: Record<string, LengthRule> = {
  lineHeight: { unitless: true, keywords: ['normal'] },
  letterSpacing: { keywords: ['normal'] },
  fontSize: { keywords: ['smaller', 'larger', 'xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large'] },
  maxWidth: { keywords: ['none'] },
  minWidth: { keywords: ['none'] },
  borderWidth: { keywords: ['thin', 'medium', 'thick'], multi: true },
  borderRadius: { multi: true },
};

function normalizeSingleLength(raw: string, rule?: LengthRule): string | null {
  const v = (raw ?? '').trim();
  if (v === '') return '';
  const kw = v.toLowerCase();
  if (KEYWORDS.has(kw) || (rule?.keywords && rule.keywords.indexOf(kw) !== -1)) return kw;
  if (/^calc\(.+\)$/i.test(v) || /^var\(--[\w-]+(\s*,\s*.+)?\)$/i.test(v)) return v;

  const withoutSpace = v.replace(/\s+/g, '');
  const bareNumber = /^-?\d*\.?\d+$/;
  if (bareNumber.test(withoutSpace)) {
    if (rule?.unitless) return withoutSpace; // e.g. line-height stays a bare multiplier
    return `${withoutSpace}px`;
  }

  const match = withoutSpace.match(/^(-?\d*\.?\d+)(px|em|rem|%|vw|vh|pt)$/i);
  if (match) return `${match[1]}${match[2].toLowerCase()}`;

  return null;
}

/**
 * Normalizes a raw user-typed CSS length for a SPECIFIC property, applying
 * that property's rule from LENGTH_RULES if one exists (see above). Multi-value
 * properties (border-radius, per-side border-width) are split on whitespace,
 * each part normalized independently, and rejoined — the whole value is
 * rejected (null) if any part fails, rather than silently dropping a segment.
 */
export function normalizeCssLength(prop: string, raw: string): string | null {
  const rule = LENGTH_RULES[prop];
  const v = (raw ?? '').trim();
  if (rule?.multi && /\s/.test(v)) {
    const parts = v.split(/\s+/);
    const normalized = parts.map((p) => normalizeSingleLength(p, rule));
    if (normalized.some((p) => p === null)) return null;
    return normalized.join(' ');
  }
  return normalizeSingleLength(v, rule);
}

/**
 * Legacy property-agnostic normalizer — identical behavior to before
 * LENGTH_RULES existed (no property-specific keywords/unitless handling).
 * Kept as-is for callers (setImageWidth/setImageHeight, generic width/height/
 * padding/margin rows) that intentionally want the plain "300 -> 300px"
 * behavior with no per-property exceptions.
 *
 * '300' → '300px' | '50 %' → '50%' | 'auto' → 'auto' | '' → '' | 'garbage' → null
 */
export function normalizeLength(raw: string): string | null {
  return normalizeSingleLength(raw);
}

/** '300px' → 300; '50%' → null; 'auto' → null */
export function toPxInt(value: string): number | null {
  const v = (value ?? '').trim();
  const match = v.match(/^(-?\d*\.?\d+)px$/i);
  if (!match) return null;
  const n = Math.round(parseFloat(match[1]));
  return Number.isNaN(n) ? null : n;
}
