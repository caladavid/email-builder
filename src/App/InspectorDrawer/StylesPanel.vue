<template>
  <!-- ── Iframe mode: element selected ──────────────────────────────────── -->
  <div v-if="store.rawHtml && store.selectedElementPath" class="overflow-y-auto h-full" style="padding:10px 10px 24px;">

    <!-- Element badge -->
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <span style="font-size:10px;font-weight:700;color:white;background:var(--color-primary);padding:2px 8px;border-radius:20px;font-family:monospace;letter-spacing:0.02em;">
        &lt;{{ store.selectedElementTagName.toLowerCase() }}&gt;
      </span>
    </div>

    <!-- ── Contenido (block-type-specific) ─────────────────────────────── -->

    <!-- PLACEHOLDER -->
    <StyleSection v-if="blockType === 'placeholder'" title="Bloque vacío" :key="store.selectedElementPath">
      <div style="text-align:center;padding:8px 0;color:#64748b;font-size:11px;line-height:1.6;">
        Haz clic en un bloque de la barra izquierda para reemplazar este espacio.
      </div>
    </StyleSection>

    <!-- HEADING -->
    <StyleSection v-else-if="blockType === 'heading'" title="Contenido" :key="store.selectedElementPath">
      <div v-if="textEditBlocked" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
        ⚠️ Este bloque contiene otro bloque adentro (o es muy largo) — editalo con doble clic directo en el canvas para no perder ese contenido.
      </div>
      <div v-else-if="store.selectedElementHasRichText" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
        ⚠️ Este texto tiene formato (negrita, enlace, etc.) — escribir acá lo va a borrar. Para conservarlo, editalo con doble click directo en el bloque.
      </div>
      <StyleRow v-if="!textEditBlocked" label="Texto" type="text" :value="store.selectedElementInnerText" placeholder="Texto del encabezado" @change="setInnerText" />
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Nivel</label>
        <div style="display:flex;gap:6px;">
          <button
            v-for="lvl in ['h1','h2','h3','h4']"
            :key="lvl"
            :style="{ padding:'4px 10px', borderRadius:'6px', border:'1.5px solid', fontWeight:'700', fontSize:'11px', cursor:'pointer',
              borderColor: headingLevel === lvl ? 'var(--color-primary)' : '#c7d8f5',
              background: headingLevel === lvl ? 'var(--color-primary)' : 'white',
              color: headingLevel === lvl ? 'white' : 'var(--color-primary)' }"
            @click="changeTag(lvl)"
          >{{ lvl.toUpperCase() }}</button>
        </div>
      </div>
    </StyleSection>

    <!-- TEXT / PARAGRAPH -->
    <StyleSection v-else-if="blockType === 'text'" title="Contenido" :key="store.selectedElementPath">
      <div v-if="textEditBlocked" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
        ⚠️ Este bloque contiene otro bloque adentro (o es muy largo) — editalo con doble clic directo en el canvas para no perder ese contenido.
      </div>
      <div v-else-if="store.selectedElementHasRichText" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
        ⚠️ Este texto tiene formato (negrita, enlace, etc.) — escribir acá lo va a borrar. Para conservarlo, editalo con doble click directo en el bloque.
      </div>
      <StyleRow v-if="!textEditBlocked" label="Texto" type="textarea" :value="store.selectedElementInnerText" placeholder="Texto del párrafo" @change="setInnerText" />
    </StyleSection>

    <!-- BUTTON -->
    <StyleSection v-else-if="blockType === 'button'" title="Contenido" :key="store.selectedElementPath">
      <StyleRow label="Texto del botón" type="text" :value="childData.text" placeholder="Texto del botón" @change="setChildInnerText('a', $event)" />
      <div v-if="variableItems.length > 0" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;">
        <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">Vars:</span>
        <button v-for="v in variableItems" :key="v.key" @mousedown.prevent="appendVarToChild('a', v.key)"
          style="font-size:10px;padding:1px 7px;border-radius:10px;border:1px solid #c7d8f5;background:#f0f5ff;color:var(--color-primary);cursor:pointer;font-family:monospace;">
          {{ '{' + v.key + '}' }}
        </button>
      </div>
      <StyleRow label="URL" type="text" :value="childData.href" placeholder="https://..." @change="setChildAttr('a', 'href', $event)" />
      <StyleRow label="Color botón" type="color" :value="childData.bg" @change="setChildStyle('a', 'background', $event)" />
      <StyleRow label="Color texto" type="color" :value="childData.color" @change="setChildStyle('a', 'color', $event)" />
      <StyleRow label="Radio de borde" type="slider" :max="50" :value="childData.borderRadius||'4px'" @change="setChildStyle('a', 'borderRadius', $event)" />
      <StyleRow label="Padding horizontal" type="slider" :max="80" :value="childData.btnPaddingH||'20px'" @change="setBtnPaddingH" />
      <StyleRow label="Padding vertical" type="slider" :max="60" :value="childData.btnPaddingV||'12px'" @change="setBtnPaddingV" />
      <StyleRow label="Abrir en" type="select" :value="childData.target||'_self'"
        :options="[{label:'Misma pestaña',value:'_self'},{label:'Nueva pestaña',value:'_blank'},{label:'Marco padre',value:'_parent'}]"
        @change="setChildAttr('a', 'target', $event)" />
    </StyleSection>

    <!-- IMAGE (wrapper block) -->
    <StyleSection v-else-if="blockType === 'image-block'" title="Imagen" :key="store.selectedElementPath">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir imagen</label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:5px 12px;border-radius:6px;border:1.5px solid var(--color-primary);background:white;color:var(--color-primary);font-size:11px;font-weight:600;width:fit-content;user-select:none;">
          ↑ Elegir archivo
          <input type="file" accept="image/*" style="display:none;" @change="onImageFileChange" />
        </label>
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          {{ isDev ? '⚠️ Sin token — imagen guardada como base64.' : '❌ No se pudo subir la imagen. Intentá de nuevo.' }}
        </div>
      </div>
      <div style="border:1.5px solid #c7d8f5;border-radius:8px;padding:4px 6px;background:#f8faff;">
        <StyleRow label="URL de origen" type="text" :value="currentImgSrc" placeholder="https://..." @change="setChildAttr('img', 'src', $event)" />
      </div>
      <StyleRow label="Alt" type="text" :value="childData.alt" placeholder="Descripción" @change="setChildAttr('img', 'alt', $event)" />
      <StyleRow label="Ancho de imagen" type="slider-text" :max="800" :value="childData.imgWidth" placeholder="ej. 100% o 300px" @change="setImageWidth" />
      <StyleRow label="Alto de imagen" type="slider-text" :max="600" :value="childData.imgHeight" placeholder="auto" @change="setImageHeight" />
      <StyleRow label="Alineación" type="select" :value="styles.textAlign||'center'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Link URL</label>
        <div style="display:flex;gap:4px;">
          <input
            v-model="localLinkHref"
            placeholder="https://..."
            @keydown.enter.prevent="applyLinkHref"
            style="flex:1;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;"
          />
          <button
            @click.prevent="applyLinkHref"
            title="Aplicar URL"
            style="padding:6px 10px;border-radius:7px;border:none;background:var(--color-primary);color:white;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;"
          >✓</button>
        </div>
        <div v-if="linkHrefApplied" style="font-size:11px;color:#16a34a;display:flex;align-items:center;gap:4px;">
          <span>✓</span> URL aplicada
        </div>
        <div v-else-if="localLinkHref && localLinkHref !== (childData.linkHref||'')" style="font-size:11px;color:#92400e;">
          Presiona ✓ para aplicar
        </div>
      </div>
    </StyleSection>

    <!-- IMAGE (direct img tag) -->
    <StyleSection v-else-if="store.selectedElementTagName === 'IMG'" title="Imagen" :key="store.selectedElementPath">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir imagen</label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:5px 12px;border-radius:6px;border:1.5px solid var(--color-primary);background:white;color:var(--color-primary);font-size:11px;font-weight:600;width:fit-content;user-select:none;">
          ↑ Elegir archivo
          <input type="file" accept="image/*" style="display:none;" @change="onImageFileChange" />
        </label>
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          {{ isDev ? '⚠️ Sin token — imagen guardada como base64.' : '❌ No se pudo subir la imagen. Intentá de nuevo.' }}
        </div>
      </div>
      <div style="border:1.5px solid #c7d8f5;border-radius:8px;padding:4px 6px;background:#f8faff;">
        <StyleRow label="URL de origen" type="text" :value="currentImgSrc" placeholder="https://..." @change="setAttr('src', $event)" />
      </div>
    </StyleSection>

    <!-- VIDEO -->
    <StyleSection v-else-if="blockType === 'video'" title="Video" :key="store.selectedElementPath">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir video</label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:5px 12px;border-radius:6px;border:1.5px solid var(--color-primary);background:white;color:var(--color-primary);font-size:11px;font-weight:600;width:fit-content;user-select:none;">
          ↑ Elegir archivo
          <input type="file" accept="video/*" style="display:none;" @change="onVideoFileChange" />
        </label>
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          {{ isDev ? '⚠️ Sin token — video guardado como base64.' : '❌ Subida de video no disponible en producción.' }}
        </div>
      </div>
      <div style="border:1.5px solid #c7d8f5;border-radius:8px;padding:4px 6px;background:#f8faff;">
        <StyleRow label="URL de origen (src)" type="text" :value="videoChildData.src || ''" placeholder="https://example.com/video.mp4"
          @change="setVideoAttr('src', $event)" />
      </div>
      <StyleRow label="Poster (imagen previa)" type="text" :value="videoChildData.poster || ''" placeholder="https://example.com/poster.jpg"
        @change="setVideoAttr('poster', $event)" />
      <div style="display:flex;gap:16px;padding:4px 0;">
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--color-primary);cursor:pointer;">
          <input type="checkbox" :checked="!!videoChildData.controls" @change="setVideoControls(($event.target as HTMLInputElement).checked)"
            style="width:14px;height:14px;accent-color:var(--color-primary);" />
          Controles
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--color-primary);cursor:pointer;">
          <input type="checkbox" :checked="!!videoChildData.autoplay" @change="setVideoControls(($event.target as HTMLInputElement).checked, 'autoplay')"
            style="width:14px;height:14px;accent-color:var(--color-primary);" />
          Autoplay
        </label>
      </div>
    </StyleSection>

    <!-- AVATAR -->
    <StyleSection v-else-if="blockType === 'avatar'" title="Avatar" :key="store.selectedElementPath">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir imagen</label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:5px 12px;border-radius:6px;border:1.5px solid var(--color-primary);background:white;color:var(--color-primary);font-size:11px;font-weight:600;width:fit-content;user-select:none;">
          ↑ Elegir archivo
          <input type="file" accept="image/*" style="display:none;" @change="onAvatarFileChange" />
        </label>
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          {{ isDev ? '⚠️ Sin token — imagen guardada como base64.' : '❌ No se pudo subir la imagen. Intentá de nuevo.' }}
        </div>
      </div>
      <div style="border:1.5px solid #c7d8f5;border-radius:8px;padding:4px 6px;background:#f8faff;">
        <StyleRow label="URL de origen" type="text" :value="currentImgSrc" placeholder="https://..." @change="setChildAttr('img', 'src', $event)" />
      </div>
      <StyleRow label="Alt" type="text" :value="childData.alt" placeholder="Descripción" @change="setChildAttr('img', 'alt', $event)" />
      <StyleRow label="Tamaño" type="slider" :max="256" :value="childData.size ? childData.size+'px' : '64px'" @change="setAvatarSize" />
      <StyleRow label="Forma" type="select" :value="childData.shape||'circle'"
        :options="[{label:'Círculo',value:'circle'},{label:'Redondeado',value:'rounded'},{label:'Cuadrado',value:'square'}]"
        @change="setAvatarShape" />
      <StyleRow label="Alineación" type="select" :value="styles.textAlign||'center'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
    </StyleSection>

    <!-- LINK -->
    <StyleSection v-else-if="blockType === 'link'" title="Contenido" :key="store.selectedElementPath">
      <div v-if="textEditBlocked" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
        ⚠️ Este bloque contiene otro bloque adentro (o es muy largo) — editalo con doble clic directo en el canvas para no perder ese contenido.
      </div>
      <template v-else>
        <StyleRow label="Texto" type="text" :value="store.selectedElementInnerText" placeholder="Texto del enlace" @change="setInnerText" />
        <div v-if="variableItems.length > 0" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;">
          <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">Vars:</span>
          <button v-for="v in variableItems" :key="v.key" @mousedown.prevent="appendVar(v.key)"
            style="font-size:10px;padding:1px 7px;border-radius:10px;border:1px solid #c7d8f5;background:#f0f5ff;color:var(--color-primary);cursor:pointer;font-family:monospace;">
            {{ '{' + v.key + '}' }}
          </button>
        </div>
      </template>
      <StyleRow label="URL" type="text" :value="store.selectedElementAttrs?.href" placeholder="https://..." @change="setAttr('href', $event)" />
    </StyleSection>

    <!-- SEPARATOR -->
    <StyleSection v-else-if="blockType === 'separator'" title="Contenido" :key="store.selectedElementPath">
      <StyleRow label="Color de línea" type="color" :value="childData.borderColor" @change="v => { setChildStyle('hr', 'borderTopColor', v); patchChildData({ borderColor: v }); }" />
      <StyleRow label="Grosor" type="slider" :max="10" :value="childData.borderWidth" @change="v => { setChildStyle('hr', 'borderTopWidth', v); patchChildData({ borderWidth: v }); }" />
    </StyleSection>

    <!-- SPACER -->
    <StyleSection v-else-if="blockType === 'spacer'" title="Contenido" :key="store.selectedElementPath">
      <StyleRow label="Alto" type="slider-text" :max="200" :value="styles.height" placeholder="ej. 32px" @change="setStyle('height', $event)" />
    </StyleSection>

    <!-- HTML -->
    <StyleSection v-else-if="blockType === 'html'" title="Contenido" :key="store.selectedElementPath">
      <div v-if="store.selectedElementContentTruncated" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
        ⚠️ Este bloque es muy largo para editar acá sin riesgo de recortarlo — editalo con doble clic directo en el canvas.
      </div>
      <div v-else style="display:flex;flex-direction:column;gap:5px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">HTML</label>
        <textarea
          :value="store.selectedElementInnerHtml"
          placeholder="HTML personalizado..."
          style="width:100%;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;font-family:monospace;resize:vertical;min-height:80px;"
          @change="setInnerHtml(($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </StyleSection>

    <!-- COLUMNAS -->
    <StyleSection v-else-if="blockType === 'columns'" title="Columnas" :key="store.selectedElementPath">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:11px;font-weight:600;color:var(--color-primary);">N° columnas:</span>
        <button type="button" title="Quitar columna" @click="removeColumn"
          :disabled="(parseInt(childData.columnsCount) || 0) <= 1"
          style="width:22px;height:22px;border:1px solid #c7d8f5;border-radius:6px;background:white;color:var(--color-primary);font-size:14px;font-weight:700;line-height:1;cursor:pointer;"
          :style="{ opacity: (parseInt(childData.columnsCount) || 0) <= 1 ? 0.4 : 1, cursor: (parseInt(childData.columnsCount) || 0) <= 1 ? 'not-allowed' : 'pointer' }"
        >−</button>
        <span style="font-size:13px;font-weight:700;color:#111;min-width:14px;text-align:center;">{{ childData.columnsCount || '—' }}</span>
        <button type="button" title="Agregar columna" @click="addColumn"
          :disabled="(parseInt(childData.columnsCount) || 0) >= 6"
          style="width:22px;height:22px;border:1px solid #c7d8f5;border-radius:6px;background:white;color:var(--color-primary);font-size:14px;font-weight:700;line-height:1;cursor:pointer;"
          :style="{ opacity: (parseInt(childData.columnsCount) || 0) >= 6 ? 0.4 : 1, cursor: (parseInt(childData.columnsCount) || 0) >= 6 ? 'not-allowed' : 'pointer' }"
        >+</button>
      </div>
      <StyleRow label="Espacio entre col." type="slider" :max="48" :value="childData.colGap ? childData.colGap+'px' : '8px'" @change="setColumnsGap" />
      <template v-for="i in (parseInt(childData.columnsCount)||0)" :key="i">
        <StyleRow :label="`Ancho col. ${i}`" type="text" :value="childData['col_'+(i-1)+'_width']||''"
          placeholder="ej. 33.33% o 200px"
          @change="v => setColumnWidth(i, v)" />
      </template>
      <StyleRow label="Alineación V" type="select" :value="childData.vAlign || 'top'"
        :options="[{label:'Arriba',value:'top'},{label:'Centro',value:'middle'},{label:'Abajo',value:'bottom'}]"
        @change="v => { setChildrenStyle('td', 'verticalAlign', v); patchChildData({ vAlign: v }); }" />
    </StyleSection>

    <!-- CONTENEDOR -->
    <StyleSection v-else-if="blockType === 'container'" title="Contenedor" :key="store.selectedElementPath">
      <StyleRow label="Ancho máximo" type="text" :value="styles.maxWidth||''" placeholder="ej. 600px"
        @change="setStyle('maxWidth', $event)" />
      <StyleRow label="Display" type="select" :value="styles.display||'block'"
        :options="displayOptionsR"
        @change="setStyle('display', $event)" />
      <StyleRow label="Alineación texto" type="select" :value="styles.textAlign||'left'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
    </StyleSection>

    <!-- TABLE -->
    <StyleSection v-else-if="blockType === 'table'" title="Tabla" :key="store.selectedElementPath">
      <StyleRow label="Color borde celdas" type="color" :value="childData.cellBorderColor||'#cccccc'"
        @change="v => setChildrenStyle('td, th', 'borderColor', v, 'cellBorderColor')" />
      <StyleRow label="Grosor borde" type="slider" :max="8" :value="childData.cellBorderWidth ? childData.cellBorderWidth+'px' : '1px'" @change="setTableBorderWidth" />
      <StyleRow label="Padding celda" type="slider" :max="32" :value="childData.cellPadding ? childData.cellPadding+'px' : '8px'" @change="setTableCellPadding" />
      <StyleRow label="Fondo tabla" type="color" :value="styles.backgroundColor||''"
        @change="setStyle('backgroundColor', $event)" />
    </StyleSection>

    <!-- LISTA -->
    <StyleSection v-else-if="blockType === 'list'" title="Lista" :key="store.selectedElementPath">
      <StyleRow label="Tipo" type="select" :value="childData.ordered ? 'ol' : 'ul'"
        :options="[{label:'Viñetas',value:'ul'},{label:'Numerada',value:'ol'}]"
        @change="v => setListOrdered(v === 'ol')" />
      <StyleRow label="Estilo de marcador" type="select" :value="styles.listStyleType || ''"
        :options="markerOptionsR"
        @change="v => setStyle('listStyleType', v)" />
      <div style="font-size:11px;color:#64748b;line-height:1.5;">
        Agregar o quitar ítems: doble clic en el bloque, luego Enter/Backspace.
      </div>
      <template v-for="i in (parseInt(childData.itemCount)||0)" :key="i">
        <StyleRow :label="`Ítem ${i}`" type="text" :value="childData['li_'+(i-1)+'_text']||''"
          @change="v => setListItemText(i-1, v)" />
      </template>
    </StyleSection>

    <!-- Tipografía -->
    <StyleSection title="Tipografía" :key="store.selectedElementPath">
      <StyleRow label="Color de texto" type="color" :value="inline.color" :computed-value="styles.color" @change="setStyle('color', $event)" />
      <StyleRow label="Tamaño de fuente" type="slider" :max="72" :value="styles.fontSize"    @change="setStyle('fontSize', $event)" />
      <StyleRow label="Familia de fuente" type="select-text" :value="styles.fontFamily"
        :options="fontFamilyOptions" placeholder="ej. Arial, sans-serif" @change="setStyle('fontFamily', $event)" />
      <StyleRow label="Peso" type="select" :value="fontWeightValue"
        :options="fontWeightOptionsR" @change="setStyle('fontWeight', $event)" />
      <StyleRow label="Estilo" type="select" :value="styles.fontStyle"
        :options="fontStyleOptionsR" @change="setStyle('fontStyle', $event)" />
      <StyleRow label="Decoración" type="select" :value="styles.textDecoration"
        :options="textDecorationOptionsR" @change="setStyle('textDecoration', $event)" />
      <StyleRow label="Alineación" type="select" :value="styles.textAlign || 'left'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
      <StyleRow label="Altura de línea" type="slider-text" :min="0.8" :max="3" :step="0.1" unit="" :value="styles.lineHeight" placeholder="ej. 1.5" @change="setStyle('lineHeight', $event)" />
      <StyleRow label="Espaciado letras" type="slider-text" :max="20" :value="styles.letterSpacing" placeholder="ej. 0.05em" @change="setStyle('letterSpacing', $event)" />
    </StyleSection>

    <!-- Fondo -->
    <StyleSection title="Fondo" :key="store.selectedElementPath">
      <StyleRow label="Color de fondo" type="color" :value="inline.backgroundColor" :computed-value="styles.backgroundColor" @change="setStyle('backgroundColor', $event)" />
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Imagen de fondo</label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:5px 12px;border-radius:6px;border:1.5px solid var(--color-primary);background:white;color:var(--color-primary);font-size:11px;font-weight:600;width:fit-content;user-select:none;">
          ↑ Elegir archivo
          <input type="file" accept="image/*" style="display:none;" @change="onBgFileChange" />
        </label>
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          {{ isDev ? '⚠️ Sin token — imagen guardada como base64.' : '❌ No se pudo subir la imagen. Intentá de nuevo.' }}
        </div>
        <input
          type="text"
          :value="bgImageUrl"
          placeholder="https://example.com/bg.jpg"
          style="font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;width:100%;box-sizing:border-box;"
          @change="onBgImageChange(($event.target as HTMLInputElement).value)"
        />
      </div>
      <StyleRow label="Tamaño fondo" type="select" :value="inline.backgroundSize||''"
        :options="backgroundSizeOptionsR"
        @change="setStyle('backgroundSize', $event)" />
      <StyleRow label="Posición fondo" type="select" :value="inline.backgroundPosition||''"
        :options="backgroundPositionOptionsR"
        @change="setStyle('backgroundPosition', $event)" />
      <StyleRow label="Repetición" type="select" :value="inline.backgroundRepeat||''"
        :options="backgroundRepeatOptionsR"
        @change="setStyle('backgroundRepeat', $event)" />
    </StyleSection>

    <!-- Padding -->
    <StyleSection title="Espaciado interno (Padding)" :key="store.selectedElementPath">
      <StyleRow label="Arriba"    type="slider" :max="80" :value="inline.paddingTop"    :computed-value="styles.paddingTop"    @change="setStyle('paddingTop', $event)" />
      <StyleRow label="Derecha"   type="slider" :max="80" :value="inline.paddingRight"  :computed-value="styles.paddingRight"  @change="setStyle('paddingRight', $event)" />
      <StyleRow label="Abajo"     type="slider" :max="80" :value="inline.paddingBottom" :computed-value="styles.paddingBottom" @change="setStyle('paddingBottom', $event)" />
      <StyleRow label="Izquierda" type="slider" :max="80" :value="inline.paddingLeft"   :computed-value="styles.paddingLeft"   @change="setStyle('paddingLeft', $event)" />
    </StyleSection>

    <!-- Margin -->
    <StyleSection title="Espaciado externo (Margin)" :defaultOpen="false" :key="store.selectedElementPath">
      <StyleRow label="Arriba"    type="slider" :max="80" :value="inline.marginTop"    :computed-value="styles.marginTop"    @change="setStyle('marginTop', $event)" />
      <StyleRow label="Derecha"   type="slider" :max="80" :value="inline.marginRight"  :computed-value="styles.marginRight"  @change="setStyle('marginRight', $event)" />
      <StyleRow label="Abajo"     type="slider" :max="80" :value="inline.marginBottom" :computed-value="styles.marginBottom" @change="setStyle('marginBottom', $event)" />
      <StyleRow label="Izquierda" type="slider" :max="80" :value="inline.marginLeft"   :computed-value="styles.marginLeft"   @change="setStyle('marginLeft', $event)" />
    </StyleSection>

    <!-- Dimensiones -->
    <StyleSection title="Dimensiones" :key="store.selectedElementPath">
      <StyleRow label="Ancho"      type="slider-text" :max="800" :value="inline.width"    :computed-value="styles.width"    placeholder="ej. 100%" @change="setStyle('width', $event)" />
      <StyleRow label="Alto"       type="slider-text" :max="600" :value="inline.height"   :computed-value="styles.height"   placeholder="ej. auto" @change="setStyle('height', $event)" />
      <StyleRow label="Ancho máx." type="slider-text" :max="800" :value="inline.maxWidth" :computed-value="styles.maxWidth" placeholder="ej. 600px" @change="setStyle('maxWidth', $event)" />
    </StyleSection>

    <!-- Borde -->
    <StyleSection title="Borde" :defaultOpen="false" :key="store.selectedElementPath">
      <div v-if="styles.borderWidthMixed || styles.borderColorMixed || styles.borderStyleMixed"
        style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;margin-bottom:4px;">
        ⚠️ Los lados no son todos iguales — se muestra el valor del lado superior; aplicar aquí lo pareja en los 4 lados.
      </div>
      <StyleRow label="Grosor"      type="slider" :max="10" :value="inline.borderWidth" :computed-value="styles.borderWidth" @change="setBorderWidth" />
      <StyleRow label="Color borde" type="color"            :value="inline.borderColor" :computed-value="styles.borderColor" @change="setBorderColor" />
      <StyleRow label="Estilo"      type="select"           :value="inline.borderStyle||''"
        :options="borderStyleOptionsR" @change="setStyle('borderStyle', $event)" />
      <StyleRow label="Radio"       type="slider" :max="50" :value="inline.borderRadius" :computed-value="styles.borderRadius" @change="setStyle('borderRadius', $event)" />
    </StyleSection>
  </div>

  <!-- ── Iframe mode: nothing selected ─────────────────────────────────── -->
  <div v-else-if="store.rawHtml" style="padding:20px 12px;text-align:center;">
    <div style="color:var(--color-primary);font-size:13px;font-weight:600;margin-bottom:6px;">Sin selección</div>
    <div style="color:#64748b;font-size:11px;">Haz clic en un elemento del canvas para editar sus estilos.</div>
  </div>

  <!-- ── Block mode ─────────────────────────────────────────────────────── -->
  <div v-else>
    <UAlert v-if="!block" type="warning" title="Block not found" />
    <UAlert v-else-if="block.type !== 'EmailLayout'" type="warning" title='Expected "root" element to be of type "EmailLayout"' />
    <EmailLayoutSidebarPanel v-else :data="block.data" @update:data="handleUpdateData" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useInspectorDrawer } from '../../documents/editor/editor.store';
import { sendToCanvas, getCanvasIframe, snapshotCanvasHtml, suppressNextRawHtmlWrite, clearPendingCanvasSnapshot } from '../../composables/useCanvasBridge';
import EmailLayoutSidebarPanel from './ConfigurationPanel/input-panels/EmailLayoutSidebarPanel.vue';
import type { EmailLayoutProps } from '@flyhub/email-builder/blocks/EmailLayout';
import StyleSection from './StylesPanel/StyleSection.vue';
import StyleRow from './StylesPanel/StyleRow.vue';
import { normalizeLength, normalizeCssLength, toPxInt } from '../../utils/css-length';
import { normalizeFontWeight, reconcileOptions } from '../../utils/style-display';

const store = useInspectorDrawer();
const block = computed(() => store.document.root);
const styles = computed(() => store.selectedElementStyles ?? {});
const inline = computed(() => store.selectedElementInlineStyles ?? {});
const childData = computed(() => (store.selectedElementChildData ?? {}) as Record<string, string>);
// canvas-bridge's selectElement() now populates childData.src/poster/controls/
// autoplay whether the wrapper div OR the <video> element itself is selected
// (it reads el.tagName === 'VIDEO' directly in that case) — no need to fall
// back to selectedElementAttrs, which only ever had the raw DOM attributes
// and not the <source src> fallback the palette's own template needs.
const videoChildData = computed(() => (store.selectedElementChildData ?? {}) as Record<string, any>);

const uploadWarning = ref(false);
const isDev = import.meta.env.DEV;

// Local state for Link URL input — avoids blur-triggered @change race condition on tab switch.
// Synced from store when element selection changes; committed only on button click or Enter.
const localLinkHref = ref('');
const linkHrefApplied = ref(false);
let _linkHrefAppliedTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => childData.value.linkHref, (v) => { localLinkHref.value = v || ''; }, { immediate: true });
function applyLinkHref() {
  setChildAttr('a', 'href', localLinkHref.value);
  linkHrefApplied.value = true;
  if (_linkHrefAppliedTimer) clearTimeout(_linkHrefAppliedTimer);
  _linkHrefAppliedTimer = setTimeout(() => { linkHrefApplied.value = false; _linkHrefAppliedTimer = null; }, 2000);
}

const variableItems = computed(() =>
  Object.entries(store.globalVariables || {}).map(([key, value]) => ({ key, value }))
);

function appendVar(key: string) {
  if (textEditBlocked.value) return; // the field is hidden in this state; guard direct calls too
  setInnerText((store.selectedElementInnerText || '') + `{${key}}`);
}

function appendVarToChild(selector: string, key: string) {
  setChildInnerText(selector, (childData.value.text || '') + `{${key}}`);
}

const currentImgSrc = computed(() => {
  if (blockType.value === 'image-block' || blockType.value === 'avatar') return childData.value.src || '';
  if (store.selectedElementTagName === 'IMG') return store.selectedElementAttrs?.src || '';
  return '';
});

// Editing a "Texto"-style field through this panel replaces textContent
// wholesale — safe for plain text, destructive when the element actually
// contains a nested real block (hasBlockChildren) or was too large to send
// in full (contentTruncated, so we'd be writing back a partial value).
// Those states hide the field entirely rather than just warning, unlike
// selectedElementHasRichText (inline formatting only — a real but smaller,
// warn-and-allow loss).
const textEditBlocked = computed(() =>
  store.selectedElementHasBlockChildren || store.selectedElementContentTruncated
);

// ── Block type detection ──────────────────────────────────────────────────────

const blockType = computed(() => {
  const t = store.selectedElementTagName;
  if (t === 'placeholder') return 'placeholder';
  if (t === 'Encabezado' || /^H[1-6]$/.test(t)) return 'heading';
  if (t === 'Texto' || t === 'P') return 'text';
  if (t === 'Botón') return 'button';
  if (t === 'Imagen') return 'image-block';
  if (t === 'VIDEO' || t === 'video' || t === 'Video') return 'video';
  if (t === 'Avatar') return 'avatar';
  if (t === 'Enlace' || t === 'A') return 'link';
  if (t === 'Separador') return 'separator';
  if (t === 'Espaciador') return 'spacer';
  if (t === 'Html') return 'html';
  if (t === 'Columnas') return 'columns';
  if (t === 'Contenedor') return 'container';
  if (t === 'Table') return 'table';
  if (t === 'Lista' || t === 'Lista Ordenada' || t === 'UL' || t === 'OL') return 'list';
  return null;
});

// Current heading level: from childData._tag (h1/h2/h3) or from raw tagName (H1/H2/H3)
const headingLevel = computed(() => {
  const raw = childData.value._tag;
  if (raw) return raw;
  return store.selectedElementTagName.toLowerCase();
});

// ── Image upload ─────────────────────────────────────────────────────────────

async function uploadImageFile(file: File): Promise<string> {
  uploadWarning.value = false;
  let url = await store.uploadImage(file);
  if (!url) {
    uploadWarning.value = true;
    if (import.meta.env.DEV) {
      url = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target!.result as string);
        reader.readAsDataURL(file);
      });
    }
  }
  return url;
}

async function onImageFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const url = await uploadImageFile(file);
  if (!url || !store.selectedElementPath) return;
  if (blockType.value === 'image-block') {
    sendToCanvas({ type: 'set-child-attr', path: store.selectedElementPath, selector: 'img', property: 'src', value: url });
  } else {
    sendToCanvas({ type: 'set-attr', path: store.selectedElementPath, property: 'src', value: url });
    store.selectedElementAttrs = { ...store.selectedElementAttrs, src: url };
  }
}

async function onAvatarFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const url = await uploadImageFile(file);
  if (!url || !store.selectedElementPath) return;
  sendToCanvas({ type: 'set-child-attr', path: store.selectedElementPath, selector: 'img', property: 'src', value: url });
}

async function onVideoFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadWarning.value = false;
  if (!import.meta.env.DEV) {
    uploadWarning.value = true;
    return;
  }
  const url = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as string);
    reader.readAsDataURL(file);
  });
  setVideoAttr('src', url);
}

function setVideoAttr(property: string, value: string) {
  if (!store.selectedElementPath) return;
  if (store.selectedElementTagName === 'VIDEO') {
    setAttr(property, value);
  } else {
    setChildAttr('video', property, value);
  }
}

function setVideoControls(checked: boolean, attr = 'controls') {
  setVideoAttr(attr, checked ? attr : '');
}

// ── Content setters ───────────────────────────────────────────────────────────

function setInnerText(value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-inner-text', path: store.selectedElementPath, value });
  store.selectedElementInnerText = value;
}

function setInnerHtml(value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-innerHTML', path: store.selectedElementPath, value });
  store.selectedElementInnerHtml = value;
}

function changeTag(tag: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'change-tag', path: store.selectedElementPath, tag });
}

function setAttr(property: string, value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-attr', path: store.selectedElementPath, property, value });
  store.selectedElementAttrs = { ...store.selectedElementAttrs, [property]: value };
}

function setChildAttr(selector: string, property: string, value: string) {
  if (!store.selectedElementPath) return;

  // Image link href: bypass postMessage round-trip.
  // @change fires on blur, triggered by clicking the Preview tab — BEFORE the
  // tab switch unmounts IframeCanvas. sendToCanvas is async (postMessage); by the
  // time the canvas sends dom-changed back, the listener is already removed.
  // Fix: directly modify the live iframe DOM (same-origin, synchronous) and
  // snapshot immediately — no race condition.
  // Scoped to image/avatar blocks specifically — the "clear URL → unwrap the
  // <a>" branch below is meant for "this image is no longer a link", but
  // without this guard it also fired for the Botón block's own href field:
  // clearing a button's URL unwrapped its <a>, destroying the button's
  // background/padding/border-radius (all inline styles on that <a>) along
  // with it. A Botón's href is set via the normal sendToCanvas path below instead.
  if (selector === 'a' && property === 'href' && (blockType.value === 'image-block' || blockType.value === 'avatar')) {
    const doc = getCanvasIframe()?.contentDocument;
    if (doc) {
      const target = doc.querySelector(store.selectedElementPath) as HTMLElement | null;
      if (target) {
        let a = target.querySelector('a') as HTMLAnchorElement | null;
        const img = target.querySelector('img') as HTMLImageElement | null;
        if (value) {
          if (!a && img) {
            a = doc.createElement('a');
            a.setAttribute('target', '_blank');
            img.parentNode!.insertBefore(a, img);
            a.appendChild(img);
          }
          if (a) a.setAttribute('href', value);
        } else if (a) {
          const frag = doc.createDocumentFragment();
          while (a.firstChild) frag.appendChild(a.firstChild);
          a.parentNode?.replaceChild(frag, a);
        }
        const html = snapshotCanvasHtml();
        if (html) {
          suppressNextRawHtmlWrite();
          clearPendingCanvasSnapshot();
          store.saveHtmlSnapshot(html);
        }
      }
    }
    store.selectedElementChildData = { ...store.selectedElementChildData, linkHref: value };
    return;
  }

  sendToCanvas({ type: 'set-child-attr', path: store.selectedElementPath, selector, property, value });
  // 'href' is exposed as 'linkHref' in childData, but only for the Imagen
  // block's own separate "Link URL" field (applyLinkHref, above) — a Botón's
  // URL row reads childData.href directly (line ~67). Remapping unconditionally
  // used to leave the Botón URL field showing the stale value until the next
  // full reselect, since the write landed under a key nothing read.
  const cdKey = (selector === 'a' && property === 'href' && blockType.value === 'image-block') ? 'linkHref' : property;
  store.selectedElementChildData = { ...store.selectedElementChildData, [cdKey]: value };
}

function setChildStyle(selector: string, property: string, value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-child-style', path: store.selectedElementPath, selector, property, value });
  const key = property === 'background' ? 'bg' : property === 'color' ? 'color' : property;
  store.selectedElementChildData = { ...store.selectedElementChildData, [key]: value };
}

function setChildInnerText(selector: string, value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-child-text', path: store.selectedElementPath, selector, value });
  store.selectedElementChildData = { ...store.selectedElementChildData, text: value };
}

// ── Style setter ─────────────────────────────────────────────────────────────

const bgImageUrl = computed(() => {
  const raw = styles.value.backgroundImage as string | null | undefined;
  if (!raw) return '';
  const m = raw.match(/url\(['"]?([^'"]+)['"]?\)/);
  return m ? m[1] : raw;
});

function onBgImageChange(url: string) {
  const trimmed = url.trim();
  const cssValue = trimmed ? `url('${trimmed}')` : '';
  setStyle('backgroundImage', cssValue);
}

async function onBgFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  let url = await store.uploadImage(file);
  if (!url) {
    uploadWarning.value = true;
    if (import.meta.env.DEV) {
      url = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target!.result as string);
        reader.readAsDataURL(file);
      });
    }
  }
  if (!url) return;
  onBgImageChange(url);
}

// Only textDecoration is applied to the text selection; all other props go to the element directly
const DECORATION_PROPS = new Set(['textDecoration']);

// Properties that take a CSS length — raw user input ("300") is invalid CSS and gets
// silently dropped by the DOM, so it must be normalized ("300px") before sending.
const LENGTH_PROPS = new Set([
  'width', 'height', 'maxWidth', 'minWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'fontSize', 'lineHeight', 'letterSpacing', 'borderWidth', 'borderRadius',
]);

function setStyle(property: string, value: string) {
  if (!store.selectedElementPath) return;
  let v = value;
  if (LENGTH_PROPS.has(property)) {
    const normalized = normalizeCssLength(property, value);
    if (normalized === null) return; // invalid length — don't send, don't optimistic-write
    v = normalized;
  }
  const type = DECORATION_PROPS.has(property) ? 'apply-style-to-selection' : 'set-style';
  sendToCanvas({ type, path: store.selectedElementPath, property, value: v });
  // DECORATION_PROPS apply to selection (not whole element) — don't optimistic-write element styles;
  // the panel will refresh via selectElement round-trip from notifyStyleDebounced
  if (!DECORATION_PROPS.has(property)) {
    store.selectedElementStyles = { ...store.selectedElementStyles, [property]: v };
    store.selectedElementInlineStyles = { ...store.selectedElementInlineStyles, [property]: v };
  }
}

// Setting a width/color on a borderless element (border-style: none, the
// browser default) produces zero visible change — the shorthand needs a
// style too. Piggyback a 'solid' write onto the SAME optimistic update so
// the panel and canvas agree immediately, only when nothing solid is set yet.
function ensureBorderStyleSolid() {
  if (styles.value.borderStyle && styles.value.borderStyle !== 'none') return;
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-style', path: store.selectedElementPath, property: 'borderStyle', value: 'solid' });
  store.selectedElementStyles = { ...store.selectedElementStyles, borderStyle: 'solid' };
  store.selectedElementInlineStyles = { ...store.selectedElementInlineStyles, borderStyle: 'solid' };
}
function setBorderWidth(v: string) { ensureBorderStyleSolid(); setStyle('borderWidth', v); }
function setBorderColor(v: string) { ensureBorderStyleSolid(); setStyle('borderColor', v); }

// childDataKey: optional key to optimistically patch under — setChildrenStyle
// used to write NOTHING optimistic at all (unlike setChildStyle/setChildAttr),
// so every Table row it drives froze at its stale value for the whole
// round-trip to the next notifyStyleDebounced resync.
function setChildrenStyle(selector: string, property: string, value: string, childDataKey?: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-children-style', path: store.selectedElementPath, selector, property, value });
  if (childDataKey) patchChildData({ [childDataKey]: value });
}

// Optimistic childData write for multi-action setters below — several of them
// were writing under a key nothing reads (e.g. Separador's color setter wrote
// borderTopColor while the row reads childData.borderColor), so the widget
// showed a stale value for the whole 120ms round-trip to the next
// notifyStyleDebounced → selectElement resync. setChildrenStyle in particular
// wrote NO optimistic value at all, freezing the Table rows during any drag.
function patchChildData(patch: Record<string, string>) {
  store.selectedElementChildData = { ...store.selectedElementChildData, ...patch };
}

// ── Block-specific multi-action helpers ───────────────────────────────────────

function setAvatarSize(v: string) {
  setChildStyle('img', 'width', v);
  setChildStyle('img', 'height', v);
  // Read back as childData.size, a bare number the row re-appends 'px' to —
  // not childData.width/height, which is what setChildStyle's generic
  // key-mapping would have written instead.
  patchChildData({ size: String(toPxInt(v) ?? (parseInt(v) || 0)) });
}

function setImageWidth(raw: string) {
  const v = normalizeLength(raw);
  if (v === null) return;
  setChildStyle('img', 'width', v);
  const px = toPxInt(v);
  setChildStyle('img', 'maxWidth', px === null ? '100%' : v);
  setChildStyle('img', 'height', 'auto'); // preserve aspect ratio
  setChildAttr('img', 'width', px === null ? '' : String(px));
  setChildAttr('img', 'height', '');
  if (px !== null) {
    const wrapPx = toPxInt(childData.value.wrapMaxWidth || '');
    if (wrapPx !== null && px > wrapPx) setStyle('maxWidth', v);
  }
  // Read back as childData.imgWidth — setChildStyle('img','width',v) above
  // already patched under 'width', a key this row never reads. Height is
  // forced to 'auto' above (aspect ratio) — clear the stale explicit height
  // so the Alto field falls back to its 'auto' placeholder instead of
  // showing whatever px value was there before this width change.
  patchChildData({ imgWidth: v, imgHeight: '' });
}

function setImageHeight(raw: string) {
  const v = normalizeLength(raw);
  if (v === null) return;
  setChildStyle('img', 'height', v);
  const px = toPxInt(v);
  setChildAttr('img', 'height', px === null ? '' : String(px));
  patchChildData({ imgHeight: v });
}

function setAvatarShape(v: string) {
  const radius = v === 'circle' ? '50%' : v === 'rounded' ? '8px' : '0';
  setChildStyle('img', 'borderRadius', radius);
  patchChildData({ shape: v }); // setChildStyle would have patched under 'borderRadius', not 'shape'
}

function setBtnPaddingH(v: string) {
  setChildStyle('a', 'paddingLeft', v);
  setChildStyle('a', 'paddingRight', v);
  patchChildData({ btnPaddingH: v });
}

function setBtnPaddingV(v: string) {
  setChildStyle('a', 'paddingTop', v);
  setChildStyle('a', 'paddingBottom', v);
  patchChildData({ btnPaddingV: v });
}

function setColumnsGap(v: string) {
  // Per-side longhands only — the shorthand 'padding' also overwrote the
  // cell's own vertical padding (whatever the template had), and reading
  // paddingLeft back as "the gap" without ever multiplying by 2 meant the
  // displayed value HALVED itself on every single reselect.
  const half = Math.round(parseInt(v) / 2) + 'px';
  setChildrenStyle('td', 'paddingLeft', half);
  setChildrenStyle('td', 'paddingRight', half);
  patchChildData({ colGap: String(parseInt(v) || 0) });
}

// Flips ul<->ol AND the data-block-type marker in the SAME change-tag
// command (see the comment on change-tag in canvas-bridge.ts) — sending them
// as two separate commands would race, since the second one needs the path
// the first one's replaceChild just created.
function setListOrdered(ordered: boolean) {
  if (!store.selectedElementPath) return;
  sendToCanvas({
    type: 'change-tag',
    path: store.selectedElementPath,
    tag: ordered ? 'ol' : 'ul',
    attrs: { 'data-block-type': ordered ? 'Lista Ordenada' : 'Lista' },
  });
}

// set-child-text (unlike most other commands) doesn't trigger a full
// selectElement resync on its own — the optimistic patchChildData write
// below is the only thing keeping the OTHER items' fields from reverting
// while this one is mid-edit.
function setListItemText(index: number, value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-child-text', path: store.selectedElementPath, selector: `li:nth-child(${index + 1})`, value });
  patchChildData({ ['li_' + index + '_text']: value });
}

function addColumn() {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'columns-add', path: store.selectedElementPath });
}

function removeColumn() {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'columns-remove', path: store.selectedElementPath });
}

function setColumnWidth(colIndex: number, raw: string) {
  const v = normalizeLength(raw);
  if (v === null) return; // invalid length — don't send, don't optimistic-write
  const sel = `tr:first-child > td:nth-child(${colIndex})`;
  setChildStyle(sel, 'width', v);
  // Keep the attribute in sync too — Outlook/legacy clients only honour the
  // width ATTRIBUTE, not the inline style, so leaving it stale would silently
  // desync what the editor shows from what actually ships in the export.
  const px = toPxInt(v);
  setChildAttr(sel, 'width', v.endsWith('%') ? v : (px === null ? '' : String(px)));
  patchChildData({ ['col_' + (colIndex - 1) + '_width']: v });
}

function setTableBorderWidth(v: string) {
  // childData reads cellBorderWidth as a bare number (it appends 'px' itself), unlike
  // the CSS value the canvas needs — strip the unit before patching the optimistic copy.
  setChildrenStyle('td, th', 'borderWidth', v);
  patchChildData({ cellBorderWidth: String(toPxInt(v) ?? (parseInt(v) || 0)) });
}

function setTableCellPadding(v: string) {
  setChildrenStyle('td, th', 'padding', v);
  patchChildData({ cellPadding: String(toPxInt(v) ?? (parseInt(v) || 0)) });
}

function handleUpdateData(data: Omit<EmailLayoutProps, 'document'>) {
  store.setDocument({ root: { type: 'EmailLayout', data } });
}

// ── Options ──────────────────────────────────────────────────────────────────

const fontFamilyOptions = [
  { label: 'Arial',           value: 'Arial, sans-serif' },
  { label: 'Helvetica',       value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana',         value: 'Verdana, sans-serif' },
  { label: 'Tahoma',          value: 'Tahoma, sans-serif' },
  { label: 'Trebuchet MS',    value: "'Trebuchet MS', sans-serif" },
  { label: 'Georgia',         value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Courier New',     value: "'Courier New', Courier, monospace" },
  { label: 'Impact',          value: 'Impact, Charcoal, sans-serif' },
  { label: 'Roboto',          value: 'Roboto, sans-serif' },
  { label: 'Open Sans',       value: "'Open Sans', sans-serif" },
  { label: 'Lato',            value: 'Lato, sans-serif' },
  { label: 'Montserrat',      value: 'Montserrat, sans-serif' },
  { label: 'Poppins',         value: 'Poppins, sans-serif' },
  { label: 'Raleway',         value: 'Raleway, sans-serif' },
  { label: 'Oswald',          value: 'Oswald, sans-serif' },
  { label: 'Nunito',          value: 'Nunito, sans-serif' },
];


const fontWeightOptions = [
  { label: 'Extra ligero (100)', value: '100' },
  { label: 'Ligero (200)',   value: '200' },
  { label: 'Ligero (300)',   value: '300' },
  { label: 'Normal (400)',   value: '400' },
  { label: 'Medio (500)',    value: '500' },
  { label: 'Semi-negrita (600)', value: '600' },
  { label: 'Negrita (700)', value: '700' },
  { label: 'Extra negrita (800)', value: '800' },
  { label: 'Máxima negrita (900)', value: '900' },
];

const fontStyleOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Cursiva', value: 'italic' },
  { label: 'Oblicua', value: 'oblique' },
];

const textDecorationOptions = [
  { label: 'Ninguno', value: 'none' },
  { label: 'Subrayado', value: 'underline' },
  { label: 'Tachado', value: 'line-through' },
  { label: 'Sobrelineado', value: 'overline' },
];

// The Encabezado palette template ships font-weight:bold — normalize it to
// the numeric string the select's options list actually contains before
// even reconciling, so it lands on "Negrita (700)" instead of a synthetic
// "bold (actual)" entry.
const fontWeightValue = computed(() => normalizeFontWeight(styles.value.fontWeight || ''));
const fontWeightOptionsR = computed(() => reconcileOptions(fontWeightValue.value, fontWeightOptions));
const fontStyleOptionsR = computed(() => reconcileOptions(styles.value.fontStyle || '', fontStyleOptions));
const textDecorationOptionsR = computed(() => reconcileOptions(styles.value.textDecoration || '', textDecorationOptions));

const backgroundSizeOptions = [
  { label: 'Auto', value: 'auto' }, { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' }, { label: '100% auto', value: '100% auto' },
];
const backgroundPositionOptions = [
  { label: 'Center', value: 'center' }, { label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' }, { label: 'Right', value: 'right' },
];
const backgroundRepeatOptions = [
  { label: 'No repeat', value: 'no-repeat' }, { label: 'Repeat', value: 'repeat' },
  { label: 'Repeat-X', value: 'repeat-x' }, { label: 'Repeat-Y', value: 'repeat-y' },
];
const backgroundSizeOptionsR = computed(() => reconcileOptions(inline.value.backgroundSize || '', backgroundSizeOptions, styles.value.backgroundSize));
const backgroundPositionOptionsR = computed(() => reconcileOptions(inline.value.backgroundPosition || '', backgroundPositionOptions, styles.value.backgroundPosition));
const backgroundRepeatOptionsR = computed(() => reconcileOptions(inline.value.backgroundRepeat || '', backgroundRepeatOptions, styles.value.backgroundRepeat));

const displayOptions = [{ label: 'Block', value: 'block' }, { label: 'Flex', value: 'flex' }];
const displayOptionsR = computed(() => reconcileOptions(styles.value.display || 'block', displayOptions));

const alignOptions = [
  { label: 'Izquierda', value: 'left' },
  { label: 'Centro',    value: 'center' },
  { label: 'Derecha',   value: 'right' },
  { label: 'Justificado', value: 'justify' },
];

const unorderedMarkerOptions = [
  { label: 'Disco', value: 'disc' },
  { label: 'Círculo', value: 'circle' },
  { label: 'Cuadrado', value: 'square' },
  { label: 'Ninguno', value: 'none' },
];

const orderedMarkerOptions = [
  { label: 'Números (1, 2, 3)', value: 'decimal' },
  { label: 'Letras minúsculas (a, b, c)', value: 'lower-alpha' },
  { label: 'Números romanos (i, ii, iii)', value: 'lower-roman' },
  { label: 'Ninguno', value: 'none' },
];
const markerOptionsR = computed(() => reconcileOptions(
  styles.value.listStyleType || '',
  childData.value.ordered ? orderedMarkerOptions : unorderedMarkerOptions
));

const borderStyleOptions = [
  { label: 'Sólido',    value: 'solid' },
  { label: 'Punteado',  value: 'dotted' },
  { label: 'Guiones',   value: 'dashed' },
  { label: 'Doble',     value: 'double' },
  { label: 'Ninguno',   value: 'none' },
];
const borderStyleOptionsR = computed(() => reconcileOptions(inline.value.borderStyle || '', borderStyleOptions, styles.value.borderStyle));
</script>
