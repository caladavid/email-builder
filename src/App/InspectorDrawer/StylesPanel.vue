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
    <StyleSection v-if="blockType === 'placeholder'" title="Bloque vacío">
      <div style="text-align:center;padding:8px 0;color:#64748b;font-size:11px;line-height:1.6;">
        Haz clic en un bloque de la barra izquierda para reemplazar este espacio.
      </div>
    </StyleSection>

    <!-- HEADING -->
    <StyleSection v-else-if="blockType === 'heading'" title="Contenido">
      <StyleRow label="Texto" type="text" :value="store.selectedElementInnerText" placeholder="Texto del encabezado" @change="setInnerText" />
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
    <StyleSection v-else-if="blockType === 'text'" title="Contenido">
      <StyleRow label="Texto" type="text" :value="store.selectedElementInnerText" placeholder="Texto del párrafo" @change="setInnerText" />
    </StyleSection>

    <!-- BUTTON -->
    <StyleSection v-else-if="blockType === 'button'" title="Contenido">
      <StyleRow label="Texto del botón" type="text" :value="childData.text" placeholder="Texto del botón" @change="setChildInnerText('a', $event)" />
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
    <StyleSection v-else-if="blockType === 'image-block'" title="Imagen">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir imagen</label>
        <input type="file" accept="image/*" style="font-size:11px;width:100%;" @change="onImageFileChange" />
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          ⚠️ Sin token — imagen guardada como base64.
        </div>
      </div>
      <StyleRow label="URL de origen" type="text" :value="currentImgSrc" placeholder="https://..." @change="setChildAttr('img', 'src', $event)" />
      <StyleRow label="Alt" type="text" :value="childData.alt" placeholder="Descripción" @change="setChildAttr('img', 'alt', $event)" />
      <StyleRow label="Alineación" type="select" :value="styles.textAlign||'center'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
      <StyleRow label="Link URL" type="text" :value="childData.linkHref||''" placeholder="https://..." @change="setChildAttr('a', 'href', $event)" />
    </StyleSection>

    <!-- IMAGE (direct img tag) -->
    <StyleSection v-else-if="store.selectedElementTagName === 'IMG'" title="Imagen">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir imagen</label>
        <input type="file" accept="image/*" style="font-size:11px;width:100%;" @change="onImageFileChange" />
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          ⚠️ Sin token — imagen guardada como base64.
        </div>
      </div>
      <StyleRow label="URL de origen" type="text" :value="currentImgSrc" placeholder="https://..." @change="setAttr('src', $event)" />
    </StyleSection>

    <!-- AVATAR -->
    <StyleSection v-else-if="blockType === 'avatar'" title="Avatar">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">Subir imagen</label>
        <input type="file" accept="image/*" style="font-size:11px;width:100%;" @change="onAvatarFileChange" />
        <div v-if="uploadWarning" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 8px;">
          ⚠️ Sin token — imagen guardada como base64.
        </div>
      </div>
      <StyleRow label="URL de origen" type="text" :value="currentImgSrc" placeholder="https://..." @change="setChildAttr('img', 'src', $event)" />
      <StyleRow label="Alt" type="text" :value="childData.alt" placeholder="Descripción" @change="setChildAttr('img', 'alt', $event)" />
      <StyleRow label="Tamaño" type="slider" :max="256" :value="childData.size ? childData.size+'px' : '64px'" @change="setAvatarSize" />
      <StyleRow label="Forma" type="select" :value="childData.shape||'circle'"
        :options="[{label:'Círculo',value:'circle'},{label:'Redondeado',value:'rounded'},{label:'Cuadrado',value:'square'}]"
        @change="setAvatarShape" />
      <StyleRow label="Alineación" type="select" :value="styles.textAlign||'center'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
    </StyleSection>

    <!-- LINK -->
    <StyleSection v-else-if="blockType === 'link'" title="Contenido">
      <StyleRow label="Texto" type="text" :value="store.selectedElementInnerText" placeholder="Texto del enlace" @change="setInnerText" />
      <StyleRow label="URL" type="text" :value="store.selectedElementAttrs?.href" placeholder="https://..." @change="setAttr('href', $event)" />
    </StyleSection>

    <!-- SEPARATOR -->
    <StyleSection v-else-if="blockType === 'separator'" title="Contenido">
      <StyleRow label="Color de línea" type="color" :value="childData.borderColor" @change="setChildStyle('hr', 'borderTopColor', $event)" />
      <StyleRow label="Grosor" type="slider" :max="10" :value="childData.borderWidth" @change="setChildStyle('hr', 'borderTopWidth', $event)" />
    </StyleSection>

    <!-- SPACER -->
    <StyleSection v-else-if="blockType === 'spacer'" title="Contenido">
      <StyleRow label="Alto" type="slider-text" :max="200" :value="styles.height" placeholder="ej. 32px" @change="setStyle('height', $event)" />
    </StyleSection>

    <!-- HTML -->
    <StyleSection v-else-if="blockType === 'html'" title="Contenido">
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label style="font-size:11px;font-weight:600;color:var(--color-primary);">HTML</label>
        <textarea
          :value="store.selectedElementInnerText"
          placeholder="HTML personalizado..."
          style="width:100%;font-size:11px;padding:6px 8px;border:1px solid #c7d8f5;border-radius:7px;color:#111;background:white;outline:none;box-sizing:border-box;font-family:monospace;resize:vertical;min-height:80px;"
          @change="setInnerHtml(($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </StyleSection>

    <!-- COLUMNAS -->
    <StyleSection v-else-if="blockType === 'columns'" title="Columnas">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:11px;font-weight:600;color:var(--color-primary);">N° columnas:</span>
        <span style="font-size:13px;font-weight:700;color:#111;">{{ childData.columnsCount || '—' }}</span>
      </div>
      <StyleRow label="Espacio entre col." type="slider" :max="48" :value="childData.colGap ? childData.colGap+'px' : '8px'" @change="setColumnsGap" />
      <template v-for="i in (parseInt(childData.columnsCount)||0)" :key="i">
        <StyleRow :label="`Ancho col. ${i}`" type="text" :value="childData['col_'+(i-1)+'_width']||''"
          placeholder="ej. 33.33% o 200px"
          @change="v => setColumnWidth(i, v)" />
      </template>
      <StyleRow label="Alineación V" type="select" :value="'top'"
        :options="[{label:'Arriba',value:'top'},{label:'Centro',value:'middle'},{label:'Abajo',value:'bottom'}]"
        @change="setChildrenStyle('td', 'verticalAlign', $event)" />
    </StyleSection>

    <!-- CONTENEDOR -->
    <StyleSection v-else-if="blockType === 'container'" title="Contenedor">
      <StyleRow label="Ancho máximo" type="text" :value="styles.maxWidth||''" placeholder="ej. 600px"
        @change="setStyle('maxWidth', $event)" />
      <StyleRow label="Display" type="select" :value="styles.display||'block'"
        :options="[{label:'Block',value:'block'},{label:'Flex',value:'flex'}]"
        @change="setStyle('display', $event)" />
      <StyleRow label="Alineación texto" type="select" :value="styles.textAlign||'left'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
    </StyleSection>

    <!-- TABLE -->
    <StyleSection v-else-if="blockType === 'table'" title="Tabla">
      <StyleRow label="Color borde celdas" type="color" :value="childData.cellBorderColor||'#cccccc'"
        @change="setChildrenStyle('td, th', 'borderColor', $event)" />
      <StyleRow label="Grosor borde" type="slider" :max="8" :value="childData.cellBorderWidth ? childData.cellBorderWidth+'px' : '1px'" @change="setTableBorderWidth" />
      <StyleRow label="Padding celda" type="slider" :max="32" :value="childData.cellPadding ? childData.cellPadding+'px' : '8px'" @change="setTableCellPadding" />
      <StyleRow label="Fondo tabla" type="color" :value="styles.backgroundColor||''"
        @change="setStyle('backgroundColor', $event)" />
    </StyleSection>

    <!-- Tipografía -->
    <StyleSection title="Tipografía">
      <StyleRow label="Color de texto" type="color"  :value="styles.color"          @change="setStyle('color', $event)" />
      <StyleRow label="Tamaño de fuente" type="slider" :max="72" :value="styles.fontSize"    @change="setStyle('fontSize', $event)" />
      <StyleRow label="Familia de fuente" type="select-text" :value="styles.fontFamily"
        :options="fontFamilyOptions" placeholder="ej. Arial, sans-serif" @change="setStyle('fontFamily', $event)" />
      <StyleRow label="Peso" type="select" :value="styles.fontWeight"
        :options="fontWeightOptions" @change="setStyle('fontWeight', $event)" />
      <StyleRow label="Estilo" type="select" :value="styles.fontStyle"
        :options="fontStyleOptions" @change="setStyle('fontStyle', $event)" />
      <StyleRow label="Decoración" type="select" :value="styles.textDecoration"
        :options="textDecorationOptions" @change="setStyle('textDecoration', $event)" />
      <StyleRow label="Alineación" type="select" :value="styles.textAlign || 'left'"
        :options="alignOptions" @change="setStyle('textAlign', $event)" />
      <StyleRow label="Altura de línea" type="slider-text" :max="4" :value="styles.lineHeight" placeholder="ej. 1.5" @change="setStyle('lineHeight', $event)" />
      <StyleRow label="Espaciado letras" type="slider-text" :max="20" :value="styles.letterSpacing" placeholder="ej. 0.05em" @change="setStyle('letterSpacing', $event)" />
    </StyleSection>

    <!-- Fondo -->
    <StyleSection title="Fondo">
      <StyleRow label="Color de fondo" type="color" :value="styles.backgroundColor" @change="setStyle('backgroundColor', $event)" />
    </StyleSection>

    <!-- Padding -->
    <StyleSection title="Espaciado interno (Padding)">
      <StyleRow label="Arriba"    type="slider" :max="80" :value="styles.paddingTop"    @change="setStyle('paddingTop', $event)" />
      <StyleRow label="Derecha"   type="slider" :max="80" :value="styles.paddingRight"  @change="setStyle('paddingRight', $event)" />
      <StyleRow label="Abajo"     type="slider" :max="80" :value="styles.paddingBottom" @change="setStyle('paddingBottom', $event)" />
      <StyleRow label="Izquierda" type="slider" :max="80" :value="styles.paddingLeft"   @change="setStyle('paddingLeft', $event)" />
    </StyleSection>

    <!-- Margin -->
    <StyleSection title="Espaciado externo (Margin)" :defaultOpen="false">
      <StyleRow label="Arriba"    type="slider" :max="80" :value="styles.marginTop"    @change="setStyle('marginTop', $event)" />
      <StyleRow label="Derecha"   type="slider" :max="80" :value="styles.marginRight"  @change="setStyle('marginRight', $event)" />
      <StyleRow label="Abajo"     type="slider" :max="80" :value="styles.marginBottom" @change="setStyle('marginBottom', $event)" />
      <StyleRow label="Izquierda" type="slider" :max="80" :value="styles.marginLeft"   @change="setStyle('marginLeft', $event)" />
    </StyleSection>

    <!-- Dimensiones -->
    <StyleSection title="Dimensiones">
      <StyleRow label="Ancho"      type="slider-text" :max="800" :value="styles.width"    placeholder="ej. 100%" @change="setStyle('width', $event)" />
      <StyleRow label="Alto"       type="slider-text" :max="600" :value="styles.height"   placeholder="ej. auto" @change="setStyle('height', $event)" />
      <StyleRow label="Ancho máx." type="slider-text" :max="800" :value="styles.maxWidth" placeholder="ej. 600px" @change="setStyle('maxWidth', $event)" />
    </StyleSection>

    <!-- Borde -->
    <StyleSection title="Borde" :defaultOpen="false">
      <StyleRow label="Grosor"      type="slider" :max="10" :value="styles.borderWidth"  @change="setStyle('borderWidth', $event)" />
      <StyleRow label="Color borde" type="color"            :value="styles.borderColor"  @change="setStyle('borderColor', $event)" />
      <StyleRow label="Estilo"      type="select"           :value="styles.borderStyle"
        :options="borderStyleOptions" @change="setStyle('borderStyle', $event)" />
      <StyleRow label="Radio"       type="slider" :max="50" :value="styles.borderRadius" @change="setStyle('borderRadius', $event)" />
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
import { computed, ref } from 'vue';
import { useInspectorDrawer } from '../../documents/editor/editor.store';
import { sendToCanvas } from '../../composables/useCanvasBridge';
import EmailLayoutSidebarPanel from './ConfigurationPanel/input-panels/EmailLayoutSidebarPanel.vue';
import type { EmailLayoutProps } from '@flyhub/email-builder/blocks/EmailLayout';
import StyleSection from './StylesPanel/StyleSection.vue';
import StyleRow from './StylesPanel/StyleRow.vue';

const store = useInspectorDrawer();
const block = computed(() => store.document.root);
const styles = computed(() => store.selectedElementStyles ?? {});
const childData = computed(() => (store.selectedElementChildData ?? {}) as Record<string, string>);

const uploadWarning = ref(false);

const currentImgSrc = computed(() => {
  if (blockType.value === 'image-block' || blockType.value === 'avatar') return childData.value.src || '';
  if (store.selectedElementTagName === 'IMG') return store.selectedElementAttrs?.src || '';
  return '';
});

const displayImgSrc = computed(() => {
  const src = currentImgSrc.value;
  if (!src) return '—';
  if (src.startsWith('data:')) {
    const commaIdx = src.indexOf(',');
    const header = commaIdx > -1 ? src.slice(0, commaIdx) : src.slice(0, 30);
    const tail = src.slice(-3);
    return `${header},...${tail}`;
  }
  return src.length > 60 ? src.slice(0, 57) + '...' : src;
});

// ── Block type detection ──────────────────────────────────────────────────────

const blockType = computed(() => {
  const t = store.selectedElementTagName;
  if (t === 'placeholder') return 'placeholder';
  if (t === 'Encabezado' || /^H[1-6]$/.test(t)) return 'heading';
  if (t === 'Texto' || t === 'P') return 'text';
  if (t === 'Botón') return 'button';
  if (t === 'Imagen') return 'image-block';
  if (t === 'Avatar') return 'avatar';
  if (t === 'Enlace' || t === 'A') return 'link';
  if (t === 'Separador') return 'separator';
  if (t === 'Espaciador') return 'spacer';
  if (t === 'Html') return 'html';
  if (t === 'Columnas') return 'columns';
  if (t === 'Contenedor') return 'container';
  if (t === 'Table') return 'table';
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
    url = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });
  }
  return url;
}

async function onImageFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const url = await uploadImageFile(file);
  if (!store.selectedElementPath) return;
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
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-child-attr', path: store.selectedElementPath, selector: 'img', property: 'src', value: url });
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
  sendToCanvas({ type: 'set-child-attr', path: store.selectedElementPath, selector, property, value });
  store.selectedElementChildData = { ...store.selectedElementChildData, [property === 'href' ? 'href' : property]: value };
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

function setStyle(property: string, value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-style', path: store.selectedElementPath, property, value });
  store.selectedElementStyles = { ...store.selectedElementStyles, [property]: value };
}

function setChildrenStyle(selector: string, property: string, value: string) {
  if (!store.selectedElementPath) return;
  sendToCanvas({ type: 'set-children-style', path: store.selectedElementPath, selector, property, value });
}

// ── Block-specific multi-action helpers ───────────────────────────────────────

function setAvatarSize(v: string) {
  setChildStyle('img', 'width', v);
  setChildStyle('img', 'height', v);
}

function setAvatarShape(v: string) {
  const radius = v === 'circle' ? '50%' : v === 'rounded' ? '8px' : '0';
  setChildStyle('img', 'borderRadius', radius);
}

function setBtnPaddingH(v: string) {
  setChildStyle('a', 'paddingLeft', v);
  setChildStyle('a', 'paddingRight', v);
}

function setBtnPaddingV(v: string) {
  setChildStyle('a', 'paddingTop', v);
  setChildStyle('a', 'paddingBottom', v);
}

function setColumnsGap(v: string) {
  const half = Math.round(parseInt(v) / 2) + 'px';
  setChildrenStyle('td', 'padding', half);
}

function setColumnWidth(colIndex: number, v: string) {
  setChildStyle(`tr:first-child > td:nth-child(${colIndex})`, 'width', v);
}

function setTableBorderWidth(v: string) {
  setChildrenStyle('td, th', 'borderWidth', v);
}

function setTableCellPadding(v: string) {
  setChildrenStyle('td, th', 'padding', v);
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
  { label: 'Normal (400)',   value: '400' },
  { label: 'Ligero (300)',   value: '300' },
  { label: 'Medio (500)',    value: '500' },
  { label: 'Semi-negrita (600)', value: '600' },
  { label: 'Negrita (700)', value: '700' },
  { label: 'Extra negrita (800)', value: '800' },
];

const fontStyleOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Cursiva', value: 'italic' },
];

const textDecorationOptions = [
  { label: 'Ninguno', value: 'none' },
  { label: 'Subrayado', value: 'underline' },
  { label: 'Tachado', value: 'line-through' },
  { label: 'Sobrelineado', value: 'overline' },
];

const alignOptions = [
  { label: 'Izquierda', value: 'left' },
  { label: 'Centro',    value: 'center' },
  { label: 'Derecha',   value: 'right' },
  { label: 'Justificado', value: 'justify' },
];

const borderStyleOptions = [
  { label: 'Sólido',    value: 'solid' },
  { label: 'Punteado',  value: 'dotted' },
  { label: 'Guiones',   value: 'dashed' },
  { label: 'Doble',     value: 'double' },
  { label: 'Ninguno',   value: 'none' },
];
</script>
