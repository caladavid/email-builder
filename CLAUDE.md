# Email Builder — Celcom

## Commands

```bash
npm run dev      # dev server → localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build
npm run preview:local  # production build on :4173 that accepts a parent on localhost:3000 and proxies /rest (see below)
```

`npm test` runs the vitest unit suite (`test/parser/*.spec.ts`, happy-dom — no real browser, can't drive the live iframe canvas). `vitest.config.ts` registers `@vitejs/plugin-vue`/`@vitejs/plugin-vue-jsx` so `.vue`/`.tsx` files can be *parsed* when a pure module transitively imports one (e.g. `HTMLToBlockParser.ts` → `documents/editor/core.tsx` → block editor `.vue` components) — this is NOT `@vue/test-utils`; there is still no component-mounting API here, and no test in this repo renders/mounts a Vue component. That's an intentional decision: logic that causes bugs in the block/styles system is pure and lives in `src/utils/` (`css-color.ts`, `css-length.ts`, `canvasDomHelpers.ts`, `style-display.ts`) where it's tested directly; anything DOM/iframe-shaped is a Playwright e2e script below instead.

The following need `npm run dev` running and a system Chrome install — none are part of `npm test`:
- `node test/e2e/text-sync-check.mjs` (`npm run test:e2e`) — Editor↔Preview↔HTML text-sync mechanism (see "Zona frágil" below).
- `node test/e2e/block-lifecycle-check.mjs` (`npm run test:e2e:lifecycle`) — destructive-edit regressions (palette click, Contenedor/placeholder refill, duplicate/move, truncation).
- `node test/e2e/panel-roundtrip-check.mjs` (`npm run test:e2e:panel`) — styles-panel round-trip (set → deselect → reselect → same value shown): Video, Columnas widths/gap/vAlign, Lista.
- `node test/e2e/dragdrop-affordance-check.mjs` (`npm run test:e2e:dnd`) — "+" placeholder anchoring, proportional drop edge-bands, fast selection on a blocked image host.
- `node test/e2e/html-security-check.mjs` (`npm run test:e2e:security`): imported template HTML can't run script in the builder origin (script/on*/javascript: stripped on import and export, Outlook conditional comments kept), and the canvas bridge rejects unsafe `set-attr`/`exec-command` and commands from any window other than its parent.
- `node test/e2e/import-normalize-check.mjs <path-to-html>` — smoke test for the import-time normalizer + paste sanitizer against a real (uncommitted) client template; takes a file path since real templates aren't committed.

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
| `src/utils/canvas-bridge.ts` | Iframe-injected canvas script — selection, hover, drag-drop, postMessage command handler |
| `src/utils/canvasDomHelpers.ts` | Pure DOM helpers shared by `canvas-bridge.ts` and vitest — source of truth for `getElementPath`, `isFillerNode`, `hasRealChildren`, `collapseSides`, `readColumnsChildData`. **Embedding contract**: each function must be fully self-contained (no references to module-scope constants/other helpers) — `canvas-bridge.ts` pulls them in verbatim via `` var name = ${fn.toString()} `` inside its own giant template literal, and `Function.prototype.toString()` only returns a function's own source text |
| `src/utils/htmlSecurity.ts` | `sanitizeTemplateHtml` (targeted denylist, NOT DOMPurify: DOMPurify drops Outlook `<!--[if mso]>` comments) runs in `sanitizeImportedHtml` (every import vector) and `getHtmlFromDocument` (export). `isSafeAttribute` is embedded in `canvas-bridge.ts` via `toString()` (same self-contained contract as `canvasDomHelpers.ts`). `sanitizeInlineHtml` (DOMPurify) guards every `innerHTML`/`v-html` in inline editors and readers; the Html block goes through `src/lib/email-builder/blocks/Html/SafeHtml.ts`. DOMPurify does NOT work under happy-dom (returns handlers untouched), so DOMPurify-based checks live in `test/e2e/html-security-check.mjs`, not vitest |
| `src/utils/css-color.ts` | Pure CSS color parsing — source of truth for what a "real" vs. unset color is (`parseCssColor`/`toHex6`/`formatColor`) |
| `src/utils/css-length.ts` | `LENGTH_RULES` — per-property CSS length rules (unitless, keywords, multi-value) layered on the legacy `normalizeLength` |
| `src/utils/style-display.ts` | `reconcileOptions`/`normalizeFontWeight` — keeps a `<select>` in `StylesPanel.vue` from silently showing a value the user never picked |

## Backend APIs

| Purpose | URL |
|---------|-----|
| ZIP template upload | `https://services.celcom.cl/rest/protected/flex_email/addFileZip` |
| Image upload | `https://dos.multinetlabs.com/sms_services/rest/protected/flex_email/addFileImage` |

**Dev vs production:** with `npm run dev` (`import.meta.env.DEV`), ZIP parsing runs client-side (JSZip) and images fall back to base64. Production builds send the ZIP/images to the backend. SVG uploads are always converted to PNG in the browser first (`src/utils/svgToPng.ts`): SVG can carry script and email clients don't render it.

The upload services reject the `localhost` origin (CORS 403). `npm run preview:local` (mode `localtest`, `.env.localtest`) points `VITE_API_BASE` at the preview server, whose `/rest` proxy forwards server-side and drops the Origin header. Only that mode has a proxy; `npm run dev` and production don't.

**Deploy (Dockerfile):** nginx config lives in `nginx/default.conf.template` (`frame-ancestors` from build arg `FRAME_ANCESTORS`, plus `nosniff` and `Referrer-Policy`). The `<meta>` CSP in `index.html` keeps `'unsafe-eval'` and the HMR websocket for dev only; the `prod-csp` plugin in `vite.config.ts` strips both from the built `index.html`.

## Zona frágil: sync Editor ↔ Preview/HTML (texto editado en el canvas)

El texto que se edita con doble click en el canvas (`contentEditable`, dentro del iframe) solo llega a `store.rawHtml` — y por lo tanto a las pestañas Preview/HTML — a través de esta cadena. Si algo de esto se rompe, el síntoma es "escribo texto, cambio de pestaña, se pierde o no se refleja":

1. **`exitEditing()`** (`src/utils/canvas-bridge.ts`) — corre dentro del iframe, al clickear afuera del elemento en edición (incluido el fondo vacío, ambos casos manejados explícitamente en el handler de `click`) o Escape. Llama `notifyDomChanged(true)`.
2. **`notifyDomChanged(immediate)`** (mismo archivo) — el flag `immediate` salta el debounce de 150ms del lado del padre. Sin esto, cambiar de pestaña muy rápido after de salir de edición podía perder el cambio.
3. **`case 'exit-editing'`** (mismo archivo) — comando que el padre manda proactivamente ANTES de dejar la pestaña Editor, para forzar el guardado aunque el usuario no haya clickeado nada dentro del canvas (el caso más común: escribís y vas directo a Preview).
4. **`<UTabs v-model="activeTab" ... :unmount-on-hide="false">`** (`src/App/TemplatePanel/index.vue`) — reka-ui destruye el panel inactivo por defecto (`unmountOnHide: true`). Sin `:unmount-on-hide="false"`, el iframe del Editor se destruye de verdad al cambiar de pestaña, matando cualquier texto que solo vivía en su DOM. El `watch(activeTab, ...)` en el mismo archivo es lo que manda el comando `exit-editing` del punto 3, y depende de que los `tabs` items tengan `value` explícito (`'editor'|'preview'|'html'`) — sin eso, reka-ui usa el índice como valor y el watcher nunca matchea.

**Antes de tocar cualquiera de estos 4 puntos**, correr `node test/e2e/text-sync-check.mjs` (con `npm run dev` corriendo) para confirmar que el flujo completo sigue funcionando.

## `canvas-bridge.ts`'s template-literal trap

`CANVAS_BRIDGE_CODE` (the whole injected iframe script) is ONE giant backtick template literal. Inside it:
- A **single backslash** written directly between the backticks (not through `${}`) collapses at evaluation time — `\r\n` silently becomes a real CR+LF, `\s` silently becomes a bare `s`. Always double it: `\\s`.
- **Any unescaped backtick** — even inside a `//` comment — prematurely closes the whole template literal and corrupts everything after it into invalid top-level JS. Never write a backtick in a comment or string inside this file; use plain quotes instead.

`test/parser/canvasBridgeSource.spec.ts` guards both classes of bug automatically (scans the raw `.ts` source text, not the evaluated output — by the time a buggy single backslash has been evaluated, there's nothing left to detect).

## Known Issues / Gotchas

- **Parent channel** (`src/utils/allowedOrigins.ts`): `App.vue` and `editor.store.ts` only obey messages that pass `isFromParent` (allowed https origin AND `event.source === window.parent`). The list is the `flex.*` parents + `VITE_PARENT_ORIGIN` + optional `VITE_ALLOWED_ORIGINS` (comma-separated); localhost only in dev. Never add the builder's own `email-builder.*` origins: the canvas iframe is same-origin and would pass the check. Builder↔canvas messages check `event.source` on both sides (`isFromCanvas` in `useCanvasBridge.ts`, `window.parent` in the bridge).
- **Dark mode forced** on init (`document.body.classList.add('dark')` in `main.ts`).
- **Accordion state leak** (`StylesPanel.vue`'s `<StyleSection>` instances): fixed via `:key="store.selectedElementPath"` on all of them — if a future refactor removes that key, a section's open/closed state will silently carry over from whatever was previously selected.

Already fixed (kept here as history, not current bugs): `createFlexContainer()` used to put `childrenIds` in `data` instead of `data.props`; `Video`/`List`/`ListItem`/`Separator` used to be generated by the HTML parser but missing from `ReaderBlock.vue`'s `READER_DICTIONARY` (Separator now maps to the same `Divider` component/schema — the sanitizer already renames `Separator`→`Divider` on ZIP/HTML import, but a document delivered directly via `loadDocument` bypasses that sanitizer, so the Reader needs its own entry too); `renderToStaticMarkup` used to render raw `document.value` instead of `processedDocument`, so text formats/variables were missing from the exported HTML.

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
Code-based: `#code/<base64(JSON)>` (DEV only: in production builds it is ignored, since a crafted link would be a one-click XSS)
