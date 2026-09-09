// Pure display-layer helpers for StylesPanel.vue's <select> rows. Runs only
// in the main app (not embedded in canvas-bridge.ts) — unlike
// canvasDomHelpers.ts, these never touch the DOM.

// The Encabezado template ships `font-weight: bold`, which isn't among the
// numeric weight options ('300'..'800') a <select> offers — the browser
// silently falls back to showing whatever option happens to be first
// ("Normal (400)") on a heading that's actually bold. Normalize the CSS
// keywords to the numeric string the option list actually uses.
export function normalizeFontWeight(raw: string): string {
  var v = (raw || '').trim().toLowerCase();
  if (v === 'bold') return '700';
  if (v === 'bolder') return '800';
  if (v === 'lighter' || v === 'light') return '300';
  if (v === 'normal' || v === '') return '400';
  return raw;
}

// A <select> bound straight to a raw CSS value lies whenever that value
// isn't one of the listed options: the browser silently selects the first
// <option> in the list (visually "picks" it) without ever firing @change,
// so the field shows a value the user never chose and never emitted.
// reconcileOptions injects a synthetic option so what's on screen always
// matches the actual current value — either the value itself (labeled
// "(actual)") or, when the value is empty, a "—" entry that surfaces the
// resolved/inherited value as a hint and emits '' if picked again.
export function reconcileOptions(
  value: string,
  options: { label: string; value: string }[],
  computedValue?: string
): { label: string; value: string }[] {
  var v = value || '';
  if (v === '') {
    var hasBlank = options.some(function (o) { return o.value === ''; });
    if (hasBlank) return options;
    var blankLabel = computedValue ? '— (' + computedValue + ')' : '—';
    return [{ label: blankLabel, value: '' }].concat(options);
  }
  var found = options.some(function (o) { return o.value === v; });
  if (found) return options;
  return [{ label: v + ' (actual)', value: v }].concat(options);
}
