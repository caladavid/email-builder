# Import de alta fidelidad ("Camino A") — FE SPEC para el equipo email_builder

**Fecha:** 2026-06-19 · **Repo:** `email_builder` · **Archivo:** `src/documents/editor/editor.store.ts`
**Motivo:** un email importado "no se ve igual" al original. La descomposición HTML→bloques
es lossy (pierde tipografía Poppins, rompe bullets `•|texto`, pierde `max-width`, etc.). El
Reader solo soporta 11 tipos de bloque, enum fijo de fuentes, sin `background-image`.

## Qué cambia (solo EM — backend y flex NO se tocan)
Al importar un zip, en vez de descomponer el HTML en bloques se carga **tal cual** en un único
bloque `Html`. El envío y la preview lo renderizan verbatim → **se ve igual** al original.
El email queda editable por HTML vía el `HtmlSidebarPanel` existente (no por bloques).

Controlado por un flag `IMPORT_VERBATIM` (default `true`); poner `false` restaura el modo
legacy de descomponer en bloques.

## Cambio 1 — helpers + flag (tras `const API_BASE = ...`)
```ts
const IMPORT_VERBATIM = true;
const IMPORTED_HTML_BLOCK_ID = "imported-html";

export function extractEmailBodyWithStyles(fullHtml: string): string {
  const head = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const styles = (fullHtml.match(/<style[\s\S]*?<\/style>/gi) || []).join("\n");
  // <link rel="stylesheet"> del <head> (cargadores de fuentes web, p.ej. Google Fonts).
  // Sin ellos la preview pierde la tipografía del email (Poppins) y "no se ve igual".
  const links = (head.match(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi) || []).join("\n");
  const headBits = [links, styles].filter(Boolean).join("\n");
  const bodyInner = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  return (headBits ? headBits + "\n" : "") + (bodyInner ?? fullHtml);
}

export function buildVerbatimHtmlConfiguration(htmlContent: string): TEditorConfiguration {
  const contents = extractEmailBodyWithStyles(htmlContent);
  return {
    root: {
      type: "EmailLayout",
      data: { backdropColor: "#F5F5F5", canvasColor: "#FFFFFF", textColor: "#262626",
              fontFamily: "MODERN_SANS", childrenIds: [IMPORTED_HTML_BLOCK_ID] },
    },
    [IMPORTED_HTML_BLOCK_ID]: {
      type: "Html",
      data: { style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { contents } },
    },
  } as unknown as TEditorConfiguration;
}
```

## Cambio 2 — `sendZip()` (reemplaza el bloque que llamaba al parser)
Tras los fixes de prefijo de imagen (`htmlContent.replace(/src="images\/(https?...`), reemplazar
la creación del `HTMLToBlockParser` + `resetDocument(parseResult.configuration)` por:
```ts
        if (IMPORT_VERBATIM) {
          resetDocument(buildVerbatimHtmlConfiguration(htmlContent));
          console.log('✅ Plantilla importada (verbatim, alta fidelidad)');
        } else {
          const parser = new HTMLToBlockParser();
          const parseResult = await parser.parseHtmlStringToBlocks(htmlContent);
          const criticalErrors = parseResult.errors.filter(e => !e.recoverable);
          if (criticalErrors.length > 0) { console.error('❌ Errores críticos:', criticalErrors); return; }
          if (parseResult.configuration) {
            resetDocument(parseResult.configuration);
            console.log('✅ Plantilla importada y lista para editar');
          }
        }
```

## Lo que NO cambia (verificado)
- **Guardado** (`exportHtmlAndJsonToParent`): renderiza `document.value`; con el bloque Html
  la `vista` es el HTML verbatim. Sin cambios.
- **Preview del flex**: muestra `message.vista` en iframe → fiel. **Cero cambios en el flex.**
- **Backend** (`addFileZip`): igual; ya reescribe las URLs de imagen. Sin cambios.
- **Reabrir para editar**: EM carga el `project` json (config del bloque Html) vía
  `resetDocument`. Funciona.

## Implicación de UX
El email importado se edita por **HTML** (textarea del `HtmlSidebarPanel`), no por bloques.
Para "importar diseño terminado y enviar" es lo correcto. Opción futura (no incluida): botón
"convertir a bloques editables" que invoque el parser (modo legacy), asumiendo la pérdida.

## Validado e2e contra DEV (2026-06-19)
Se subió el zip real del cliente por el flujo completo (`addFileZip` contra
`dos.multinetlabs.com`, token AES customer 36, HTTP 200) → `buildVerbatimHtmlConfiguration`
→ `renderToStaticMarkup`. Comparación visual (Chrome headless) original vs preview:
**idéntico** — incluida la fuente Poppins tras preservar el `<link>` del `<head>` (sin ese
fix la preview caía a Arial). Backend y CORS OK; el `<head>` venía intacto del backend.

## A validar en QA
1. Variables/merge tags `{{...}}` en el HTML: confirmar que se resuelven en el render del bloque Html.
2. Seguridad: el HTML entra al bloque Html y se inyecta en el iframe del flex; el `addFileZip`
   ya sanea (allowlist + límites). Confirmar que no hay vector nuevo.
3. Canvas del editor: validado el Reader/preview (mismo `renderToStaticMarkup`); falta mirar el
   lienzo de edición con el iframe embebido en el flex (no bloqueante para "se ve igual").

## Tests (en `test/parser/`)
- `import-verbatim.spec.ts`: verbatim preserva tipografía/bullets/ancho + todo el contenido del email real.
- `content-fidelity.spec.ts`: red de fidelidad de contenido sobre el corpus.
- Suite completa: **188/188 verde**. `npx vue-tsc --noEmit` sin errores en `editor.store.ts`.
