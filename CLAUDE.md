# Email Builder — Celcom

## Commands

```bash
npm run dev      # dev server → localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build
```

`npm test` runs the vitest unit suite (`test/parser/*.spec.ts`, happy-dom — no real browser, can't drive the live iframe canvas).

`node test/e2e/text-sync-check.mjs` — manual Playwright smoke test for the Editor↔Preview↔HTML text-sync mechanism (see "Zona frágil" below). Requires `npm run dev` running and a system Chrome install; not part of `npm test` since it needs a real browser + the dev server.

## Tech Stack

Vue 3 (Composition API) · Vite · Pinia · Nuxt UI v3 · Tailwind CSS v4 · TypeScript · Zod · JSZip

## Architecture

App runs as an **iframe** embedded in a parent application. Communication via `window.postMessage`.

### Document model

```ts
Record<blockId, { type: string, data: { props: {...}, style: {...} } }>
```

- `root` key is always the EmailLayout (wrapper for all email content)
- Children tracked in `data.props.childrenIds` — **NOT** `data.childrenIds`
- Block IDs generated with `uuidv4()` or `block-${Date.now()}`

### Two rendering modes

| Mode | Component | Document source |
|------|-----------|-----------------|
| Editor | `EditorBlock` + `EDITOR_DICTIONARY` | Pinia store directly |
| Preview | `Reader` + `READER_DICTIONARY` | `processedDocument` prop (computed) |

`processedDocument` = `createProcessedDocument(document, variables)` — applies bold/italic → markdown and substitutes `{variables}`.

`document` flows from `Reader/core.vue` → `BuildBlockComponent` → `EmailLayoutReader` as a **Vue fallthrough attr** (not explicit prop).

## Key Files

| File | Purpose |
|------|---------|
| `src/documents/editor/editor.store.ts` | Pinia store: state, undo/redo history, API calls, postMessage bus |
| `src/documents/editor/core.tsx` | `EDITOR_DICTIONARY` — all editable block definitions |
| `src/lib/email-builder/Reader/core.vue` | `READER_DICTIONARY` + preview root component |
| `src/lib/email-builder/Reader/ReaderBlock.vue` | Renders individual blocks in preview |
| `src/App/TemplatePanel/index.vue` | Editor/Preview/HTML/JSON tabs; `processedDocument` computed |
| `src/utils/parsers/HTMLToBlockParser.ts` | ZIP/HTML → blocks (137KB); CSS inlining, matchers |
| `src/utils/documentProcessor.ts` | `createProcessedDocument()` |
| `src/utils/markdown-formatter.ts` | `textWithFormatsToMarkdownRobust()` |

## Backend APIs

| Purpose | URL |
|---------|-----|
| ZIP template upload | `https://services.celcom.cl/rest/protected/flex_email/addFileZip` |
| Image upload | `https://dos.multinetlabs.com/sms_services/rest/protected/flex_email/addFileImage` |

**Dev vs production:** On `localhost`, ZIP parsing runs client-side via `parseZipToBlocks()` (JSZip). On production, the ZIP is sent to the backend and the returned HTML is parsed.

Dev proxy in `vite.config.ts`: `/api-zip` → `https://services.celcom.cl/...`

## Zona frágil: sync Editor ↔ Preview/HTML (texto editado en el canvas)

El texto que se edita con doble click en el canvas (`contentEditable`, dentro del iframe) solo llega a `store.rawHtml` — y por lo tanto a las pestañas Preview/HTML — a través de esta cadena. Si algo de esto se rompe, el síntoma es "escribo texto, cambio de pestaña, se pierde o no se refleja":

1. **`exitEditing()`** (`src/utils/canvas-bridge.ts`) — corre dentro del iframe, al clickear afuera del elemento en edición (incluido el fondo vacío, ambos casos manejados explícitamente en el handler de `click`) o Escape. Llama `notifyDomChanged(true)`.
2. **`notifyDomChanged(immediate)`** (mismo archivo) — el flag `immediate` salta el debounce de 150ms del lado del padre. Sin esto, cambiar de pestaña muy rápido after de salir de edición podía perder el cambio.
3. **`case 'exit-editing'`** (mismo archivo) — comando que el padre manda proactivamente ANTES de dejar la pestaña Editor, para forzar el guardado aunque el usuario no haya clickeado nada dentro del canvas (el caso más común: escribís y vas directo a Preview).
4. **`<UTabs v-model="activeTab" ... :unmount-on-hide="false">`** (`src/App/TemplatePanel/index.vue`) — reka-ui destruye el panel inactivo por defecto (`unmountOnHide: true`). Sin `:unmount-on-hide="false"`, el iframe del Editor se destruye de verdad al cambiar de pestaña, matando cualquier texto que solo vivía en su DOM. El `watch(activeTab, ...)` en el mismo archivo es lo que manda el comando `exit-editing` del punto 3, y depende de que los `tabs` items tengan `value` explícito (`'editor'|'preview'|'html'`) — sin eso, reka-ui usa el índice como valor y el watcher nunca matchea.

**Antes de tocar cualquiera de estos 4 puntos**, correr `node test/e2e/text-sync-check.mjs` (con `npm run dev` corriendo) para confirmar que el flujo completo sigue funcionando.

## Known Issues / Gotchas

- **`createFlexContainer()` bug** (`HTMLToBlockParser.ts:2414`): puts `childrenIds` in `data` instead of `data.props` → Container children invisible in Reader preview.
- **Missing READER_DICTIONARY types**: `Separator`, `Espaciador`, `Video`, `List`, `Script` are generated by the HTML parser but not registered in `ReaderBlock.vue`'s dictionary → those blocks silently don't render.
- **Origin validation disabled**: `allowedOrigins.ts` always returns `true` — do not ship to prod without fixing.
- **Dark mode forced** on init (`document.body.classList.add('dark')` in `main.ts`).
- `renderToStaticMarkup` (HTML export to parent) uses raw `document.value`, not `processedDocument` — text formats/variables are NOT applied in the exported HTML.

## postMessage API

Parent sends to iframe:

| `type` | Payload | Action |
|--------|---------|--------|
| `loadDocument` | `{ document, variables? }` | Load template + variables |

Iframe sends to parent:

| `type` | Payload |
|--------|---------|
| `htmlAndJsonResponse` | `{ html, json }` |

## Sample Templates

Accessible via URL hash: `#sample/welcome`, `#sample/reset-password`, etc.
Code-based: `#code/<base64(JSON)>`
