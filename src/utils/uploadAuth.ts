// Auth for the upload services (addFileZip / addFileImage).
//
// Flex sends two credentials in setToken:
// - token: legacy AES TOKEN, sent in the FormData (accepted until backend
//   phase 2);
// - jwt: short-lived upload token (scope "email_upload", ~10 min), sent as
//   Authorization: Bearer.
// Until Flex sends a jwt for the first time, uploads behave exactly as before
// (no header, no requestToken round trip, no wait). Once a jwt exists, each
// upload first asks Flex for a fresh one (requestToken, short timeout) and a
// 401 triggers one refresh + one retry.

export const MAX_TOKEN_LENGTH = 65536;

/** Trimmed non-empty string (numbers coerced), else null. */
export function readCredential(value: unknown): string | null {
  const t = typeof value === 'number' ? String(value) : value;
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  return trimmed.length > 0 && t.length <= MAX_TOKEN_LENGTH ? trimmed : null;
}

/** Each field of a setToken message is validated on its own. */
export function parseSetTokenMessage(data: { token?: unknown; jwt?: unknown }): { token: string | null; jwt: string | null } {
  return { token: readCredential(data?.token), jwt: readCredential(data?.jwt) };
}

export interface UploadCredentials {
  token: string | null;
  jwt: string | null;
}

export interface AuthorizedUploadDeps {
  getCredentials: () => UploadCredentials;
  /** Asks the parent for fresh credentials; resolves when they arrive or on timeout. */
  refreshCredentials: () => Promise<void>;
  fetchImpl?: typeof fetch;
  onSessionExpired?: () => void;
  timeoutMs?: number;
}

/**
 * POSTs the form built by `buildForm` (it receives the legacy TOKEN, or null)
 * with the Bearer header when a jwt is known. Returns the last Response, or
 * null when there are no credentials at all.
 */
export async function authorizedUpload(
  url: string,
  buildForm: (token: string | null) => FormData,
  deps: AuthorizedUploadDeps,
): Promise<Response | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 30000;

  // jwt mode only once Flex has sent one: before that, no round trip at all
  if (deps.getCredentials().jwt) await deps.refreshCredentials();

  const attempt = async (): Promise<Response | null> => {
    const { token, jwt } = deps.getCredentials();
    if (!token && !jwt) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(url, {
        method: 'POST',
        // No Content-Type: the browser sets the multipart boundary itself
        ...(jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {}),
        body: buildForm(token),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response = await attempt();
  if (response?.status === 401 && deps.getCredentials().jwt) {
    await deps.refreshCredentials();
    response = await attempt();
    if (response?.status === 401) deps.onSessionExpired?.();
  }
  return response;
}

/** Non-blocking toast shown when the upload token can't be renewed. */
export function notifySessionExpired(): void {
  import('@nuxt/ui/composables/useToast.js')
    .then(({ useToast }) => useToast().add({
      title: 'Tu sesión expiró',
      description: 'Vuelve a ingresar a Flex.',
      color: 'error',
    }))
    .catch(() => {});
}
