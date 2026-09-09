import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CANVAS_BRIDGE_CODE } from '../../src/utils/canvas-bridge';

// canvas-bridge.ts's injected script is one giant JS template literal. A
// backslash written as a SINGLE `\` directly between the backticks (not
// through a `${}` interpolation) is collapsed by the template literal's own
// string-escape rules before the iframe ever sees it — `\r\n` silently
// became a real carriage-return + newline (production SyntaxError, since
// fixed), and `[\s;]` silently became `[s;]` (a regex that strips the letter
// "s", not whitespace — since fixed too). Both were shipped bugs that only
// surfaced in a real browser, since vitest/happy-dom never actually PARSE
// the emitted script as new top-level source the way a <script> tag does.
//
// IMPORTANT: this must scan the RAW SOURCE FILE TEXT, not the already-
// evaluated CANVAS_BRIDGE_CODE — by the time the template literal has been
// evaluated, a buggy single backslash has ALREADY collapsed away, so there
// would be nothing left to detect in the output string. The bug is only
// visible in the .ts file's own source text.
function templateLiteralBody(source: string): string {
  const start = source.indexOf('CANVAS_BRIDGE_CODE = purifySrc + `');
  const bodyStart = source.indexOf('`', start) + 1;
  const bodyEnd = source.lastIndexOf('`');
  const body = source.slice(bodyStart, bodyEnd);
  // Strip `${...}` interpolations — those are real JS expressions (e.g.
  // `${sanitizePastedHtml.toString()}`), not literal template text, so the
  // template literal's escape rules never apply to their own source.
  return body.replace(/\$\{[^}]*\}/g, '');
}

describe('canvas-bridge.ts source — template-literal backslash-collapse guard', () => {
  it('CANVAS_BRIDGE_CODE parses as valid top-level script syntax (does not throw)', () => {
    expect(() => new Function(CANVAS_BRIDGE_CODE)).not.toThrow();
  });

  it('has no single-backslash regex-class escapes (\\s \\d \\w \\b) in the literal template text — these collapse to a bare letter at runtime, silently breaking any regex that uses them', () => {
    const source = readFileSync('src/utils/canvas-bridge.ts', 'utf-8');
    const body = templateLiteralBody(source);
    // A backslash NOT itself preceded by another backslash, immediately
    // followed by one of the collapsing escape letters. A correctly-doubled
    // `\\s` (which evaluates to a real single backslash + s at runtime) does
    // NOT match this, since its second backslash IS preceded by a backslash.
    const suspicious = body.match(/(?<!\\)\\[sSdDwWbB]/g);
    expect(suspicious).toBeNull();
  });

  it('has no stray backtick anywhere in the literal template text — even inside a "//" comment, an unescaped backtick closes the OUTER template literal early (production incident: a comment mentioning `data-block-type="video"` in backticks split the string mid-file, turning the rest of the injected script into invalid top-level JS)', () => {
    const source = readFileSync('src/utils/canvas-bridge.ts', 'utf-8');
    const body = templateLiteralBody(source);
    // After stripping ${...} interpolations, a correctly-formed template body
    // has ZERO backtick characters left — any real backtick, comment or not,
    // means it's either the accidental early close itself or content that
    // will never be reached because an earlier stray backtick already ended
    // the string.
    expect(body.includes('`')).toBe(false);
  });
});
