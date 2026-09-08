# Errores de tipo preexistentes — pendientes

`npx vue-tsc --noEmit -p tsconfig.app.json` reportaba ~146 errores antes de esta
limpieza, todos preexistentes (el compilador nunca llegaba a chequear medio
proyecto porque `HTMLToBlockParser.ts` tenía un syntax error que rompía la
cascada — ver commit que arregla el comentario `/* ... */` sin abrir en
`createFormBlock`).

## Ya resuelto en esta pasada (35 errores, -0 regresiones)

- **`env.d.ts` no existía en el repo** (nunca estuvo, ni en git history) pese a
  que `tsconfig.app.json` lo esperaba en `include`. Sin él no había tipos de
  Vite (`import.meta.env`, imports `?raw`, imports de `.css`). Recreado con
  `/// <reference types="vite/client" />` — resolvió 23 errores de un saque
  (TS2307 del `?raw` de dompurify, 11× `Property 'env' does not exist on type
  'ImportMeta'`, 3× imports de `.css` sin tipos).
- **9 imports rotos** `../../../documents/editor/core` (3 niveles) en vez de
  `../../documents/editor/core` (2 niveles) — copy-paste bug, un archivo
  hermano (`welcome.ts`) ya tenía la ruta correcta. Afectaba 8 archivos en
  `src/getConfiguration/sample/*.ts` + `validateJsonStringValueTest.ts`.
- **10 usos de `Zod.ZodError`** (namespace global que no existe) en vez de
  `z.ZodError` con `import { z } from 'zod'` — mismo patrón copy-pasteado en
  los 10 `*SidebarPanel.vue`, sin el import. `AvatarSidebarPanel.vue` e
  `ImageSidebarPanel.vue` ya usaban el patrón correcto — se igualó al resto.
- **`JSZip` namespace usado como tipo** sin import — el módulo se carga
  dinámicamente en runtime (`await import('jszip')`) pero el código
  referenciaba `JSZip.JSZipObject` como tipo sin traerlo. Agregado
  `import type JSZip from 'jszip'` (type-only, no toca el lazy-load real).

Quedan **111 errores**. Ninguno bloquea `npm test` ni `npm run build` (Vite/
esbuild no hacen type-check estricto en build normal) — son deuda de
`vue-tsc --noEmit`.

## Lo que queda, agrupado por causa real (no por archivo)

### 1. Zod `.passthrough()` vs tipos `*Props` escritos a mano — el cluster más grande

Afecta: `src/documents/editor/editor.store.ts` (parte de sus 17), `src/App/InspectorDrawer/ConfigurationPanel/index.vue`,
`RichTextEditor.vue`, `ColumnsContainerSidebarPanel.vue`, `ButtonSidebarPanel.vue`,
`src/getConfiguration/sample/order-ecommerce.ts`, `reservation-reminder.ts`.

Cada bloque (`Button`, `Heading`, `ColumnsContainer`, ...) tiene DOS
definiciones de forma paralelas que deberían coincidir y ya no coinciden:
- un Zod schema (`XPropsSchema`, con `.passthrough()`)
- un tipo TS escrito a mano (`XProps`)

`z.output<typeof XPropsSchema>` con `.passthrough()` produce un tipo
`objectOutputType<...>` que TS ya no considera estructuralmente igual al
`XProps` manual (probablemente drift tras un upgrade de `zod`, o el `XProps`
se editó sin tocar el schema o viceversa). Síntoma típico:

```
Type 'objectOutputType<{ fontSize: ZodNullable<...>; ... }, ZodTypeAny,
"passthrough">' is not assignable to type 'ButtonProps'.
```

**No es mecánico** — hay que decidir, por par de tipos, cuál es la fuente de
verdad (¿el schema debería generar el tipo vía `z.infer`, matando el tipo
manual duplicado? ¿o el schema necesita ajustarse?) y aplicarlo consistente
en todos los bloques. Es la única categoría que vale la pena mirar con
cuidado antes de tocar — las demás son mecánicas.

### 2. Tipo de estilo de `TableRow` le faltan campos (14 errores)

`src/documents/blocks/TableRow/TableRowEditor.vue` (7) y
`src/lib/email-builder/blocks/TableRow/TableRowReader.vue` (7): el tipo de
`style` solo tiene `{ backgroundColor, height, width }` pero el código ya usa
`.textAlign` y `.padding` en varios lugares. El tipo del schema de TableRow
quedó desactualizado respecto al código real. Fix: agregar `textAlign` y
`padding` al schema/tipo de `TableRow` — mecánico, un solo lugar de origen
(buscar `TableRowPropsSchema` o equivalente).

### 3. `RichTextLink.vue` — drift con Nuxt UI (10 errores)

Todo en un archivo. Patrones:
- `color: "gray"` ya no existe en el union de colores del componente Nuxt UI
  usado (probablemente renombrado a `"neutral"` en una versión más nueva de
  `@nuxt/ui`) — 4 ocurrencias.
- handlers tipados `(event: MouseEvent) => boolean` donde el prop espera
  `void | Promise<void>` — el `return true/false` sobra, no hace nada, se
  puede quitar.
- 3× `as Event` sobre un objeto `{ target: HTMLElement | undefined }` que no
  es un `Event` real — cast forzado que probablemente esconde un bug de
  verdad (¿por qué se está simulando un Event así?), vale la pena mirar el
  contexto antes de solo cambiar el cast.

Mecánico salvo el último punto.

### 4. `InlineIconsMatcher.ts` (7 errores)

- Líneas 29 y 57: `error TS2554: Expected 2 arguments, but got 1` — llamada
  a función con un argumento faltante de verdad. Hay que mirar qué función es
  y si el segundo argumento faltante es un bug funcional (no solo de tipos).
- Líneas 111-112: mismo patrón que TableRow — accede a `.width` /
  `.backgroundColor` en un tipo de estilo que no los declara. Mecánico.

### 5. `StyleUtils.ts` líneas 358-361 — tipo angostado a `never`

```
error TS2339: Property 'top' does not exist on type 'never'.
```
4 líneas seguidas — típico de un type guard o `switch` que TS decidió que no
puede alcanzar ese branch. Hay que mirar la lógica de control de flujo ahí
arriba (no es un simple "agregar tipo"), puede ser un bug real de lógica
disfrazado de error de tipos.

### 6. Mecánicos sueltos (rápidos, sin agrupar)

- `editor.store.ts` líneas 454-462: `TS7006` implicit any — parámetros de
  callbacks de `.replace()` sin anotar (`match, pre, q, src`). Anotar y listo.
- `editor.store.ts` líneas 338-339, 689-690: `TS18048`/`TS18049` — acceso a
  `.childrenIds.length` / `.props` sin chequear null/undefined antes.
  Optional chaining o guard.
- Resto de archivos con 1-2 errores sueltos (`ContainerEditor.vue`,
  `TuneMenu.vue`, `IframeCanvas.vue`, etc.) — no forman patrón, revisar caso
  a caso cuando se llegue.

## Cómo retomar

```bash
npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"   # cuenta total
npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -rn   # por código
npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | grep "archivo.vue"   # por archivo puntual
```

Orden sugerido: cluster 2 (TableRow) → cluster 6 (sueltos mecánicos) →
cluster 3 (RichTextLink) → cluster 4 (InlineIconsMatcher) → cluster 5
(StyleUtils, investigar lógica) → cluster 1 (Zod/Props, el más grande y el
que más pensar requiere, dejarlo para el final o para una sesión dedicada).
