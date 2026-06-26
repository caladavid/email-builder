# Handoff — Robustez de importación (zip/HTML) + repunte de backend configurable

**Para:** equipo email_builder
**Fecha:** 2026-06-18
**Estado:** todo en *working copy*, **sin commitear**. Este doc describe los cambios para que los apliquen/mergeen en la rama oficial.

---

## 1. Contexto

Al integrar el email_builder con el flex (reemplazo de GrapesJS) aparecieron dos problemas al **importar un zip** de template:

1. El editor cargaba el diseño en el canvas, pero al **guardar/exportar** el flujo se colgaba y se guardaba vacío.
2. Templates de email reales (tableados) hacían **crashear el render** (`renderToStaticMarkup`).

Causa raíz: el `HTMLToBlockParser` emite block types que el **Reader** del `@flyhub/email-builder` (el que usa `renderToStaticMarkup`) no conoce → `Cannot read properties of undefined (reading 'Component')`. Además `exportHtmlAndJsonToParent` no tenía `try/catch`, así que esa excepción mataba el handler antes de responderle al padre (el flex quedaba en timeout → guardaba vacío).

> Dato clave: hay **dos diccionarios**. El `EDITOR_DICTIONARY` (`src/documents/editor/core.tsx`) incluye `Table/TableRow/TableCell/TableSection` (por eso el editor los renderiza sin crashear), pero el **READER_DICTIONARY** del dist (`@flyhub/email-builder`) solo soporta 11 types. El render del envío usa el Reader → ahí rompe.

---

## 2. Resumen de cambios

| Archivo | Cambio | Por qué |
|---|---|---|
| `src/utils/parsers/blockSanitizer.ts` *(NUEVO)* | Saneador de block types por capas + `SUPPORTED_BLOCK_TYPES` | Garantiza que ningún type fuera del Reader llegue a render |
| `src/utils/parsers/HTMLToBlockParser.ts` | Llama al saneador en `buildConfiguration`; `sourceHtmlMap`; captura outerHTML en path legacy de Separator | Punto único donde se ensambla el documento final |
| `src/utils/parsers/matchers/{TableBlockMatcher,TableRowMatcher,TableCellMatcher}.ts` | Capturan `outerHTML` en `sourceHtmlMap` al emitir types riesgosos | Habilita el fallback `Html` exacto |
| `src/documents/editor/editor.store.ts` | `try/catch` en `exportHtmlAndJsonToParent`; API base por env var en `sendZip`/`uploadImage` | EM siempre responde; backend configurable |
| `vite.config.ts` | Proxy `/api-zip` usa `VITE_API_BASE` | Backend configurable por ambiente |
| `.gitignore` | Ignora `.env.local` / `.env.*.local` | El valor de backend va por env, no se commitea |
| `package.json` | devDeps `vitest`, `happy-dom`, `zod`; scripts `test`/`test:watch` | Harness de tests headless |
| `vitest.config.ts` *(NUEVO)*, `test/parser/**` *(NUEVO)* | Harness + 146 tests | Validación reproducible |

---

## 3. Detalle

### A. Saneador de block types (el fix central)

**`src/utils/parsers/blockSanitizer.ts` (nuevo):**
- `SUPPORTED_BLOCK_TYPES`: set de los 11 types del **Reader** (`ColumnsContainer, Container, EmailLayout, Avatar, Button, Divider, Heading, Html, Image, Spacer, Text`). Derivado del `READER_DICTIONARY` del dist; hay un test (`dictionary-drift.spec.ts`) que **falla si el dist cambia** para que no se desincronice.
- `sanitizeBlocks(blocks, sourceHtmlMap)`: pasa por capas garantizando `type ∈ SUPPORTED`:
  1. **Mapeo semántico** (preserva contenido + editabilidad): `Separator→Divider`; `Table→Container`; `TableRow→ColumnsContainer` (si 2–3 celdas, sino `Container`); `TableCell→Container`; `Heading` con `level` h4/h5/h6 → `h3` (el Reader solo soporta h1–h3); `ColumnsContainer` con >3 columnas → `Container` (el Reader pinta 3 slots fijos).
  2. **Validación de schema**: si los props remapeados no validan (`EditorConfigurationSchema`), degrada a `Container` mínimo conservando `childrenIds`.
  3. **Fallback último**: type sin mapeo y sin hijos → `Html` con `outerHTML` (vía `sourceHtmlMap`); si no hay fuente, drop con warning. **Nunca crashea, nunca pierde contenido.**

**`src/utils/parsers/HTMLToBlockParser.ts`:**
- Import de `sanitizeBlocks`/`SourceHtmlMap`; campo público `sourceHtmlMap` (reset al inicio de cada parseo).
- En `buildConfiguration()` (chokepoint, antes del `safeParse`): `this.blocks = sanitizeBlocks(this.blocks, this.sourceHtmlMap).blocks` + log de remapeos vía `CriticalLogger`.
- Path legacy de Separator: `sourceHtmlMap.set(id, element.outerHTML)`.

**Matchers** (`TableBlockMatcher`, `TableRowMatcher`, `TableCellMatcher`): capturan `outerHTML` en `sourceHtmlMap` al emitir `Table`/`TableRow`/`TableCell`. **No se cambió ninguna firma pública** (solo usan `parser.sourceHtmlMap`, ya público).

### B. Export robusto

**`src/documents/editor/editor.store.ts` → `exportHtmlAndJsonToParent()`:** se calcula el `json` primero (no falla) y se envuelve `renderToStaticMarkup` en `try/catch` (`console.error` + `html=''` en fallo). **Siempre** se hace `sendToParent({ type:'htmlAndJsonResponse', html, json })`. Así el padre nunca queda en timeout aunque el render del HTML falle.

### C. Backend configurable por env var (repunte)

Los endpoints estaban hardcodeados a prod. Ahora:
- **`editor.store.ts`** (`sendZip` ~`addFileZip`, `uploadImage` ~`addFileImage`): `const API_BASE = import.meta.env.VITE_API_BASE || 'https://services.celcom.cl'` y los `fetch` usan `${API_BASE}/rest/protected/flex_email/...`.
- **`vite.config.ts`**: el proxy `/api-zip` usa `loadEnv` → `VITE_API_BASE`.
- **Fallback a prod** si la env var no está → no rompe el build de prod.

> ⚠️ `.env.local` (con `VITE_API_BASE=...`) es **solo para DEV y está git-ignored** — NO lo commiteen. Cada ambiente define `VITE_API_BASE`; en prod no setearla (o apuntarla al dominio prod).

### D. Harness de tests

`vitest` + `happy-dom` (da `DOMParser`; `renderToStaticMarkup` ya es SSR/Node). `test/parser/`:
- `samples.ts` / `parse-render.spec.ts` — batería inicial.
- `samples-100.ts` / `parse-render-100.spec.ts` — 100 HTML sintéticos diversos.
- `parse-render-zips.spec.ts` + `fixtures/*.html` (31) — camino real: zips corridos por el `addFileZip` del backend, congelados como fixtures.
- `dictionary-drift.spec.ts` — guard del set soportado vs el dist.

**Correr:** `npx vitest run` (o `npm test`). Estado actual: **146 tests en verde**, sin regresión.

Invariantes asertados (duros) por cada muestra: (a) ningún type fuera de `SUPPORTED`, (b) `renderToStaticMarkup` no tira, (c) `EditorConfigurationSchema.safeParse` ok, (d) salida no vacía.

---

## 4. Qué mergear vs qué NO

- **Mergear:** `blockSanitizer.ts`, cambios de `HTMLToBlockParser.ts`, matchers, `editor.store.ts`, `vite.config.ts`, `.gitignore`, devDeps de `package.json`/`package-lock.json`, y el harness `test/` + `vitest.config.ts`.
- **NO commitear:** `.env.local` (DEV-only, git-ignored).

---

## 5. Limitaciones conocidas (degradan, no rompen)

Algunos HTML no tienen bloque nativo en el Reader y caen a `Html` (renderizan exacto, pierden edición granular): **forms** (`form/input/select/textarea/button`), **`figure/figcaption`**, **`details/summary`**, **`pre/code`**, **`dl/dt/dd`**. Y las **tablas multi-fila** degradan a `Container`/`ColumnsContainer` apilado: renderizan y conservan contenido, pero el layout en grilla puede aplanarse. Esto es aceptable hoy porque el editor **no tiene UI para editar tablas** (ver §6).

---

## 6. Hallazgos pre-existentes (NO introducidos por estos cambios)

Reportados para que el equipo decida; **no** se tocaron:

1. **2 errores de TypeScript pre-existentes** en líneas no modificadas: `HTMLToBlockParser.ts:606` (`COMPARISON_WARNING` no asignable al union de `ParseError`) y `TableBlockMatcher.ts:407` (`cellEl.style` sobre `Element`). No rompen el dev server (Vite transpila sin type-check).
2. **Botón "Table" del menú de inserción roto:** crea `props: { rows:[{cells:[...]}] }` pero `TableEditor.vue` lee `props.childrenIds` → tabla vacía. Insertar/renderer desincronizados.
3. **El editor NO tiene UI para editar tablas:** `Table/TableRow/TableCell` están en el `EDITOR_DICTIONARY` con componentes solo-display; no existen `Table*SidebarPanel` (al seleccionar una tabla, el inspector cae a `<pre>{JSON}</pre>`), ni handlers `addRow/addColumn/etc`. Por eso el saneo se hace en **import** (convierte tablas a bloques sí editables) y no en render. Si en el futuro se quiere edición de tablas real, hay que **construir** esos panels + handlers + arreglar el botón de inserción.
4. **`Heading` h4–h6:** el parser emite el tag crudo; el Reader solo soporta h1–h3. El saneador los colapsa a h3. Mejor de fondo: que `HeadingMatcher` ya emita h3 para h4–h6.

---

## 7. Recomendación

Mergear el saneador + el `try/catch` + la env-var del backend tal cual (cubren "importar cualquier HTML sin crashear"). Los hallazgos del §6 son trabajo aparte de producto. La edición de tablas, si se prioriza, es un proyecto en sí (panels + handlers), no un movimiento del saneador.
