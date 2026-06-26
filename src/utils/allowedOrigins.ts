export const ALLOWED_ORIGINS = [
  'https://flex.celcomlatam.com',
  'https://email-builder.celcomlatam.com',
  'http://email-builder.multinetlabs.com',
  'https://email-builder.multinetlabs.com',
  'https://flex.multinetlabs.com',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

export function isOriginAllowed(origin: unknown): boolean {
  if (typeof origin !== 'string') return false;
  // In production, strip localhost entries to prevent local-origin spoofing
  const list = import.meta.env.PROD
    ? ALLOWED_ORIGINS.filter(o => !o.includes('localhost'))
    : ALLOWED_ORIGINS;
  return (list as readonly string[]).includes(origin);
}