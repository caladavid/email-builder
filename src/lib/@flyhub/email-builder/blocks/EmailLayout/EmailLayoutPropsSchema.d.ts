import { FONT_FAMILY_NAMES } from '@flyhub/email-core';
import { z } from 'zod';
export declare const EmailLayoutPropsSchema: z.ZodObject<{
    backdropColor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    borderColor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    borderRadius: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    canvasColor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    textColor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fontFamily: z.ZodOptional<z.ZodNullable<z.ZodEnum<["MODERN_SANS", "BOOK_SANS", "ORGANIC_SANS", "GEOMETRIC_SANS", "HEAVY_SANS", "ROUNDED_SANS", "MODERN_SERIF", "BOOK_SERIF", "MONOSPACE"]>>>;
    childrenIds: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    childrenIds?: string[] | null | undefined;
    backdropColor?: string | null | undefined;
    borderColor?: string | null | undefined;
    borderRadius?: number | null | undefined;
    canvasColor?: string | null | undefined;
    textColor?: string | null | undefined;
    fontFamily?: "MODERN_SANS" | "BOOK_SANS" | "ORGANIC_SANS" | "GEOMETRIC_SANS" | "HEAVY_SANS" | "ROUNDED_SANS" | "MODERN_SERIF" | "BOOK_SERIF" | "MONOSPACE" | null | undefined;
}, {
    childrenIds?: string[] | null | undefined;
    backdropColor?: string | null | undefined;
    borderColor?: string | null | undefined;
    borderRadius?: number | null | undefined;
    canvasColor?: string | null | undefined;
    textColor?: string | null | undefined;
    fontFamily?: "MODERN_SANS" | "BOOK_SANS" | "ORGANIC_SANS" | "GEOMETRIC_SANS" | "HEAVY_SANS" | "ROUNDED_SANS" | "MODERN_SERIF" | "BOOK_SERIF" | "MONOSPACE" | null | undefined;
}>;
export type EmailLayoutProps = {
    document: Record<string, any>;
    backdropColor?: string | null;
    borderColor?: string | null;
    borderRadius?: number | null;
    canvasColor?: string | null;
    textColor?: string | null;
    fontFamily?: typeof FONT_FAMILY_NAMES[number] | null;
    childrenIds?: string[] | null;
};
