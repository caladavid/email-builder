import { describe, it, expect, vi } from 'vitest';
import { authorizedUpload, parseSetTokenMessage, readCredential } from '../../src/utils/uploadAuth';

const URL_ = 'https://services.example/rest/protected/flex_email/addFileImage';

function makeDeps(initial: { token: string | null; jwt: string | null }, opts: {
  statuses?: number[];
  onRefresh?: (creds: { token: string | null; jwt: string | null }) => void;
} = {}) {
  const creds = { ...initial };
  const statuses = [...(opts.statuses ?? [200])];
  const calls: Array<{ headers: Record<string, string> | undefined; form: FormData }> = [];
  const fetchImpl = vi.fn(async (_url: string, init: any) => {
    calls.push({ headers: init.headers, form: init.body });
    return new Response('{}', { status: statuses.shift() ?? 200 });
  }) as unknown as typeof fetch;
  const refreshCredentials = vi.fn(async () => { opts.onRefresh?.(creds); });
  const onSessionExpired = vi.fn();
  const buildForm = (token: string | null) => {
    const f = new FormData();
    if (token) f.append('TOKEN', token);
    f.append('image', 'x');
    return f;
  };
  const run = () => authorizedUpload(URL_, buildForm, {
    getCredentials: () => creds, refreshCredentials, fetchImpl, onSessionExpired,
  });
  return { run, calls, refreshCredentials, onSessionExpired, fetchImpl };
}

describe('readCredential / parseSetTokenMessage', () => {
  it('accepts non-empty strings and numbers, trims them', () => {
    expect(readCredential('  abc ')).toBe('abc');
    expect(readCredential(12345)).toBe('12345');
  });
  it('rejects empty, objects, oversized', () => {
    expect(readCredential('')).toBeNull();
    expect(readCredential('   ')).toBeNull();
    expect(readCredential({})).toBeNull();
    expect(readCredential(undefined)).toBeNull();
    expect(readCredential('a'.repeat(65537))).toBeNull();
  });
  it('validates token and jwt independently', () => {
    expect(parseSetTokenMessage({ token: 'aes' })).toEqual({ token: 'aes', jwt: null });
    expect(parseSetTokenMessage({ jwt: 'j' })).toEqual({ token: null, jwt: 'j' });
    expect(parseSetTokenMessage({ token: '', jwt: { x: 1 } })).toEqual({ token: null, jwt: null });
  });
});

describe('authorizedUpload', () => {
  it('legacy (no jwt ever received): same request as before, no header, no requestToken', async () => {
    const d = makeDeps({ token: 'aes', jwt: null });
    const res = await d.run();
    expect(res?.status).toBe(200);
    expect(d.refreshCredentials).not.toHaveBeenCalled();
    expect(d.calls).toHaveLength(1);
    expect(d.calls[0].headers).toBeUndefined();
    expect(d.calls[0].form.get('TOKEN')).toBe('aes');
  });

  it('legacy 401: no retry, no session-expired toast (behaves as today)', async () => {
    const d = makeDeps({ token: 'aes', jwt: null }, { statuses: [401] });
    const res = await d.run();
    expect(res?.status).toBe(401);
    expect(d.calls).toHaveLength(1);
    expect(d.onSessionExpired).not.toHaveBeenCalled();
  });

  it('jwt known: refreshes first, sends Bearer with the fresh token and keeps TOKEN', async () => {
    const d = makeDeps({ token: 'aes', jwt: 'old' }, { onRefresh: (c) => { c.jwt = 'fresh'; } });
    await d.run();
    expect(d.refreshCredentials).toHaveBeenCalledTimes(1);
    expect(d.calls[0].headers).toEqual({ Authorization: 'Bearer fresh' });
    expect(d.calls[0].form.get('TOKEN')).toBe('aes');
  });

  it('jwt only (phase 2, no AES): Bearer header, no TOKEN field', async () => {
    const d = makeDeps({ token: null, jwt: 'j' });
    await d.run();
    expect(d.calls[0].headers).toEqual({ Authorization: 'Bearer j' });
    expect(d.calls[0].form.has('TOKEN')).toBe(false);
  });

  it('401 with jwt: refreshes and retries exactly once', async () => {
    let n = 0;
    const d = makeDeps({ token: null, jwt: 'j0' }, { statuses: [401, 200], onRefresh: (c) => { c.jwt = `j${++n}`; } });
    const res = await d.run();
    expect(res?.status).toBe(200);
    expect(d.calls.map((c) => c.headers?.Authorization)).toEqual(['Bearer j1', 'Bearer j2']);
    expect(d.onSessionExpired).not.toHaveBeenCalled();
  });

  it('401 twice: shows session expired once, no loop', async () => {
    const d = makeDeps({ token: null, jwt: 'j' }, { statuses: [401, 401, 401] });
    const res = await d.run();
    expect(res?.status).toBe(401);
    expect(d.calls).toHaveLength(2);
    expect(d.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('no credentials: returns null without calling fetch', async () => {
    const d = makeDeps({ token: null, jwt: null });
    expect(await d.run()).toBeNull();
    expect(d.fetchImpl).not.toHaveBeenCalled();
  });
});
