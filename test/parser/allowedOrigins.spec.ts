import { describe, it, expect } from 'vitest';
import { isOriginAllowed, isFromParent, ALLOWED_ORIGINS } from '../../src/utils/allowedOrigins';

describe('allowedOrigins', () => {
  it('allows only the parent apps (https) and, in dev, localhost', () => {
    expect(isOriginAllowed('https://flex.celcomlatam.com')).toBe(true);
    expect(isOriginAllowed('https://flex.multinetlabs.com')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true); // vitest runs in dev mode
  });

  it("never allows the builder's own origins or plain http", () => {
    expect(isOriginAllowed('https://email-builder.celcomlatam.com')).toBe(false);
    expect(isOriginAllowed('https://email-builder.multinetlabs.com')).toBe(false);
    expect(isOriginAllowed('http://email-builder.multinetlabs.com')).toBe(false);
    expect(isOriginAllowed('http://flex.celcomlatam.com')).toBe(false);
    expect(ALLOWED_ORIGINS.some((o) => o.includes('email-builder'))).toBe(false);
  });

  it('rejects non-strings and lookalikes', () => {
    expect(isOriginAllowed(undefined)).toBe(false);
    expect(isOriginAllowed('https://flex.celcomlatam.com.evil.com')).toBe(false);
    expect(isOriginAllowed('null')).toBe(false);
  });

  it('isFromParent requires the allowed origin AND window.parent as source', () => {
    const ok = { origin: 'https://flex.celcomlatam.com', source: window.parent } as unknown as MessageEvent;
    const otherWindow = { origin: 'https://flex.celcomlatam.com', source: {} } as unknown as MessageEvent;
    const badOrigin = { origin: 'https://evil.com', source: window.parent } as unknown as MessageEvent;
    expect(isFromParent(ok)).toBe(true);
    expect(isFromParent(otherWindow)).toBe(false);
    expect(isFromParent(badOrigin)).toBe(false);
  });
});
