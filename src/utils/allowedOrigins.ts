export const ALLOWED_ORIGINS = [
  'https://flex.celcomlatam.com',
  'https://email-builder.celcomlatam.com',
  'http://email-builder.multinetlabs.com',
  'https://email-builder.multinetlabs.com',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

export function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin as any);
}