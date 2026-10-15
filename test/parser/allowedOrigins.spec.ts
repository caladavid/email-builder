import { describe, it, expect, vi, afterEach } from 'vitest';
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

describe('allowedOrigins in a production build', () => {
  const load = async (env: Record<string, string | boolean>) => {
    vi.resetModules();
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as any);
    return import('../../src/utils/allowedOrigins');
  };

  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it('rejects localhost unless listed in VITE_ALLOWED_ORIGINS', async () => {
    const m = await load({ PROD: true, DEV: false, VITE_ALLOWED_ORIGINS: '' });
    expect(m.isOriginAllowed('https://flex.celcomlatam.com')).toBe(true);
    expect(m.isOriginAllowed('https://flex.multinetlabs.com')).toBe(true);
    expect(m.isOriginAllowed('http://localhost:3000')).toBe(false);
    expect(m.isOriginAllowed('http://localhost:5173')).toBe(false);
  });

  it('opt-in: accepts only the listed localhost origin, never other http', async () => {
    const m = await load({ PROD: true, DEV: false, VITE_ALLOWED_ORIGINS: 'http://localhost:3000, http://evil.example, https://otra.celcom.cl' });
    expect(m.isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(m.isOriginAllowed('http://localhost:5173')).toBe(false);
    expect(m.isOriginAllowed('http://evil.example')).toBe(false);
    expect(m.isOriginAllowed('https://otra.celcom.cl')).toBe(true);
    expect(m.isOriginAllowed('https://email-builder.celcomlatam.com')).toBe(false);
  });
});
