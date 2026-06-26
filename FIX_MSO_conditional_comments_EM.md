# Fix EM — comentarios condicionales MSO rompen la importación (CTA / bulletproof button)

**Repo:** `email_builder` · **Archivo:** `src/utils/parsers/HTMLToBlockParser.ts` (método `cleanHtml`)
**Fecha:** 2026-06-19 · **Reportado por:** cliente real — "el zip importado no se ve igual".

## Síntoma
Un email con *bulletproof button* (CTA `<a>` envuelto en `<!--[if !mso]><!--> … <!--<![endif]-->`,
con fallback VML en `<!--[if mso]> … <![endif]-->`) perdía el botón **por completo** al importar:
no aparecía ni como `Button` ni como `Text`.

## Causa raíz (reproducida)
El regex de limpieza exigía **espacios literales** (`<!-- [if`), pero el formato MSO estándar no los
lleva (`<!--[if mso]>`). No matcheaba nada → el HTML crudo llegaba a `DOMParser`, que se comía el `<a>`
al parsear los marcadores condicionales como nodos comentario. La segunda línea era un no-op muerto.

## El fix

**ANTES:**
```ts
        // Eliminar Comentarios de IE/Outlook viejos
        cleaned = cleaned.replace(/<!-- \[if[\s\S]*?endif\] -->/gi, "");
        const msoRegex = new RegExp("", "gi");
        cleaned = cleaned.replace(msoRegex, "");
```

**DESPUÉS:**
```ts
        // Eliminar comentarios condicionales de IE/Outlook (MSO).
        // El orden importa: primero DESENVOLVEMOS los bloques "downlevel-revealed"
        // (contenido visible para clientes modernos, p.ej. el <a> de un bulletproof
        // button) conservando su interior; recién después borramos los bloques
        // "downlevel-hidden" (fallbacks VML solo-Outlook) completos.
        // Variantes cubiertas (cualquier condición [if ...], con o sin espacios):
        //   revealed:        <!--[if !mso]><!-->  ...  <!--<![endif]-->
        //   revealed legacy: <![if !mso]>         ...  <![endif]>
        //   hidden:          <!--[if mso]>        ...  <![endif]-->
        //   hidden:          <!--[if gte mso 9]>  ...  <![endif]-->
        cleaned = cleaned
            // apertura revealed: <!--[if ...]><!-->  (tolera espacios en el truco <!-->)
            .replace(/<!--\[if[^\]]*?\]>\s*<!--\s*>/gi, "")
            // cierre revealed:   <!--<![endif]-->
            .replace(/<!--\s*<!\[endif\]\s*-->/gi, "")
            // apertura revealed legacy (sin comentario): <![if ...]>
            .replace(/<!\[if[^\]]*?\]>/gi, "")
            // cierre revealed legacy: <![endif]>
            .replace(/<!\[endif\]>/gi, "");
        // hidden (solo-Outlook): borrar el bloque condicional completo.
        cleaned = cleaned.replace(/<!--\[if[\s\S]*?<!\[endif\]\s*-->/gi, "");
```

## Verificación
`npx vitest run test/parser/` → **153/153 verde** (batería de 100 incluida, sin regresiones).

## Por qué los 100 zips no lo detectaban
1. `test/parser/samples.ts` tenía **0** comentarios condicionales MSO — el patrón nunca estuvo en el corpus.
2. Las aserciones eran de **caracterización** ("parsea y renderiza sin orphans"), no de **fidelidad de
   contenido**: aunque se pierda el CTA, el output igual renderiza con tipos soportados → test verde.

**Recomendado:** sumar a la suite una aserción de que todo `href`/CTA presente en el source sobreviva al render.

## Fuera de alcance (decisión de producto)
Fondo del header (`background-image` en Container): el Reader de `@flyhub/email-builder` no lo pinta
(degradación ya documentada). Header queda azul plano sin la foto. No se tocó.
