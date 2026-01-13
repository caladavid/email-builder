import { z } from 'zod';

// --- DEFINICIONES BÁSICAS ---
const COLOR_SCHEMA = z.string().regex(/^#[0-9a-fA-F]{6}$|^transparent$/).optional().nullable();

const PADDING_SCHEMA = z.object({
  top: z.number(),
  bottom: z.number(),
  right: z.number(),
  left: z.number()
}).optional().nullable();

const MARGIN_VALUE_SCHEMA = z.union([z.number(), z.string()]);

const MARGIN_SCHEMA = z.object({
  top: MARGIN_VALUE_SCHEMA.optional(),
  bottom: MARGIN_VALUE_SCHEMA.optional(),
  right: MARGIN_VALUE_SCHEMA.optional(),
  left: MARGIN_VALUE_SCHEMA.optional(),
}).optional().nullable();

// --- 1. SCHEMA DE ESTILOS (SOLO ESTILOS) ---
// Definimos esto por separado para poder reutilizarlo sin anidar.
const CONTAINER_STYLE_SCHEMA = z.object({
    // Propiedades básicas y Colores
    backgroundColor: COLOR_SCHEMA,
    backgroundImage: z.string().optional().nullable(),
    borderColor: COLOR_SCHEMA,
    color: COLOR_SCHEMA,
    
    // Dimensiones y Layout
    borderRadius: z.number().optional().nullable(),
    width: z.string().optional().nullable(),
    maxWidth: z.string().optional().nullable(),
    height: z.string().optional().nullable(),
    display: z.string().optional().nullable(),
    boxSizing: z.string().optional().nullable(),
    
    // Alineación
    textAlign: z.string().optional().nullable(),
    verticalAlign: z.string().optional().nullable(),
    flexDirection: z.string().optional().nullable(),
    justifyContent: z.string().optional().nullable(),
    lineHeight: z.string().optional().nullable(),

    // Espaciado (Padding / Margin)
    padding: PADDING_SCHEMA,
    margin: MARGIN_SCHEMA,
    paddingTop: z.string().optional().nullable(),
    paddingBottom: z.string().optional().nullable(),
    paddingLeft: z.string().optional().nullable(),
    paddingRight: z.string().optional().nullable(),
    marginTop: z.string().optional().nullable(),
    marginBottom: z.string().optional().nullable(),
    marginLeft: z.string().optional().nullable(),
    marginRight: z.string().optional().nullable(),

    // 🔥 BORDES INDIVIDUALES
    borderTop: z.string().optional().nullable(),
    borderRight: z.string().optional().nullable(),
    borderBottom: z.string().optional().nullable(),
    borderLeft: z.string().optional().nullable(),
    borderWidth: z.string().optional().nullable(),
    borderStyle: z.string().optional().nullable(),

    // Soporte para estilos móviles del Parser
    mobileStyle: z.any().optional(),
}).passthrough(); // Importante: permite propiedades extra CSS si las hay

// --- 2. SCHEMA DE PROPS INTERNAS ---
const CONTAINER_INTERNAL_PROPS_SCHEMA = z.object({
    childrenIds: z.array(z.string()).optional().nullable(),
    tagName: z.string().optional().nullable(),
    className: z.string().optional().nullable(),
    id: z.string().optional().nullable(),
    align: z.string().optional().nullable(),
}).passthrough();

// --- 3. SCHEMA PRINCIPAL (EXPORTADO) ---
// Aquí componemos el objeto final correctamente.
export const ContainerPropsSchema = z.object({
  style: CONTAINER_STYLE_SCHEMA.optional().nullable(),
  props: CONTAINER_INTERNAL_PROPS_SCHEMA.optional().nullable(),
});

// --- 4. TIPOS ---
export type ContainerProps = {
  // Usamos z.infer para garantizar que el tipo TS coincida 100% con Zod
  style?: z.infer<typeof CONTAINER_STYLE_SCHEMA> | null;
  props?: z.infer<typeof CONTAINER_INTERNAL_PROPS_SCHEMA> | null;
  document?: Record<string, any>;
}