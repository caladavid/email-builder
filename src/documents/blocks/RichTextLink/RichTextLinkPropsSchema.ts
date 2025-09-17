import { z } from 'zod';
import { ContainerPropsSchema } from '@flyhub/email-block-container';


const RichTextLinkPropsSchema = z.object({
    style: z.object({
        color: z.string().optional().nullable(),
        backgroundColor: z.string().optional().nullable(),
        fontFamily: z.string().optional().nullable(),
        fontSize: z.number().optional().nullable(),
        fontWeight: z.string().optional().nullable(),
        textAlign: z.enum(['left', 'center', 'right']).optional().nullable(),
        padding: z.object({
            top: z.number(),
            right: z.number(),
            bottom: z.number(),
            left: z.number(),
        }).optional().nullable(),
    }).optional().nullable(),
    props: z.object({
        content: z.string().optional().nullable(), // HTML content with inline links  
        variables: z.array(z.string()).optional().nullable(), // Variables preservation  
    }).optional().nullable(),
});

export default RichTextLinkPropsSchema;

export type RichTextLinkProps = {
    style?: {
        color?: string | null;
        backgroundColor?: string | null;
        fontFamily?: string | null;
        fontSize?: number | null;
        fontWeight?: string | null;
        textAlign?: 'left' | 'center' | 'right' | null;
        padding?: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        } | null;
    } | null;
    props?: {
        content?: string | null;
        variables?: string[] | null;
    } | null;
}