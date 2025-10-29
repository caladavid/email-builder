export const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    'http://localhost:3000',
    "http://email-builder.celcomlatam.com"

] as const;

export function isOriginAllowed(origin: string): boolean {
    return ALLOWED_ORIGINS.includes(origin as any);
}