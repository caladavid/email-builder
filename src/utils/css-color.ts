// Pure CSS color parsing — the single source of truth for the Styles panel's
// color widget (StyleRow.vue). Replaces an earlier `toHex()` that returned
// '#000000' for almost everything it couldn't parse (empty string, 'inherit',
// named colors, rgba() with alpha), which meant the picker showed black for
// an element that had no color set OR a real named/rgba color, AND the first
// touch of the picker overwrote that real value with black. The cases that
// actually reach this code in practice (verified against this app's own
// palette templates, which ship `color:inherit` on Texto/Encabezado, and
// against browser CSSOM serialization, which turns e.g. `#fff` into
// `rgb(255, 255, 255)` before this ever sees it): '', 'inherit',
// 'currentColor', CSS named colors, and rgba()/modern rgb() with alpha.

export type ParsedColor = { r: number; g: number; b: number; a: number };

// Cases that mean "no concrete color here" — never resolve to black, resolve
// to nothing (the widget then falls back to showing the computed/inherited
// color as a hint, never as a value the user "set").
export const UNSET_KEYWORDS = new Set(['', 'none', 'inherit', 'initial', 'unset', 'currentcolor']);

// CSS Level 3 extended named colors (all 147 + the SVG/CSS synonym 'grey'
// spellings). CSSOM preserves these verbatim on both el.style.color and
// getComputedStyle in every evergreen browser, so they DO reach this parser.
const NAMED_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
  coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', green: '#008000', greenyellow: '#adff2f',
  grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
  midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5',
  navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6', olive: '#808000',
  olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6',
  palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
  papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
  plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513',
  salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
  sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
  steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
};

function hexPairToInt(h: string): number {
  return parseInt(h.length === 1 ? h + h : h, 16);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseAlphaToken(token: string | undefined): number {
  if (!token) return 1;
  const t = token.trim();
  if (t.endsWith('%')) return clamp01(parseFloat(t) / 100);
  return clamp01(parseFloat(t));
}

/**
 * Parses any CSS color value this app's inline styles / computed styles can
 * actually contain. Returns null for "no concrete color" (unset keywords,
 * currentColor, or anything unparseable) — callers must treat null as
 * "don't show black, show the unset state" rather than defaulting to a color.
 */
export function parseCssColor(raw: string): ParsedColor | null {
  const v = (raw ?? '').trim();
  const lower = v.toLowerCase();
  if (UNSET_KEYWORDS.has(lower)) return null;
  if (lower === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return { r: hexPairToInt(hex[0]), g: hexPairToInt(hex[1]), b: hexPairToInt(hex[2]), a: 1 };
    }
    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
      return { r: hexPairToInt(hex[0]), g: hexPairToInt(hex[1]), b: hexPairToInt(hex[2]), a: clamp01(hexPairToInt(hex[3]) / 255) };
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return { r: hexPairToInt(hex.slice(0, 2)), g: hexPairToInt(hex.slice(2, 4)), b: hexPairToInt(hex.slice(4, 6)), a: 1 };
    }
    if (/^[0-9a-fA-F]{8}$/.test(hex)) {
      return {
        r: hexPairToInt(hex.slice(0, 2)), g: hexPairToInt(hex.slice(2, 4)), b: hexPairToInt(hex.slice(4, 6)),
        a: clamp01(hexPairToInt(hex.slice(6, 8)) / 255),
      };
    }
    return null;
  }

  // Comma syntax: rgb(0, 123, 255) / rgba(0, 123, 255, 0.5)
  let m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?))?\s*\)$/i);
  if (m) {
    return { r: clampByte(m[1]), g: clampByte(m[2]), b: clampByte(m[3]), a: parseAlphaToken(m[4]) };
  }
  // Modern space syntax: rgb(0 123 255 / 50%)
  m = v.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)$/i);
  if (m) {
    return { r: clampByte(m[1]), g: clampByte(m[2]), b: clampByte(m[3]), a: parseAlphaToken(m[4]) };
  }

  const named = NAMED_COLORS[lower];
  if (named) return parseCssColor(named);

  return null;
}

function clampByte(token: string): number {
  return Math.max(0, Math.min(255, Math.round(parseFloat(token))));
}

function byteToHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

export function toHex6(c: ParsedColor): string {
  return `#${byteToHex(c.r)}${byteToHex(c.g)}${byteToHex(c.b)}`;
}

/** '#rrggbb' when fully opaque, 'rgba(r, g, b, a)' when it carries alpha. */
export function formatColor(c: ParsedColor): string {
  if (c.a >= 1) return toHex6(c);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round(c.a * 1000) / 1000})`;
}
