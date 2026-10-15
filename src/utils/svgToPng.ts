// SVG uploads are converted to PNG in the browser before they reach the
// image service (same approach as Stripo):
// - security: an SVG is XML that can carry <script>/onload; served from the
//   CDN and opened directly it runs on the CDN origin (stored XSS);
// - compatibility: Gmail, Outlook and Yahoo don't render SVG at all.
// Rendering goes through an <img>, where SVG scripts never run.

export function isSvgFile(file: { type?: string; name?: string }): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
}

/** Intrinsic size from width/height attributes, else from viewBox. */
export function readSvgSize(svgText: string): { width: number; height: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(svgText)?.[0];
  if (!tag) return null;
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1];
  const px = (v?: string) => {
    if (!v || /%$/.test(v.trim())) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  let width = px(attr('width'));
  let height = px(attr('height'));
  const vb = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const vbOk = vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0;
  if (vbOk) {
    if (!width && !height) { width = vb![2]; height = vb![3]; }
    else if (!width) width = height * (vb![2] / vb![3]);
    else if (!height) height = width * (vb![3] / vb![2]);
  }
  return width && height ? { width, height } : null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG inválido o no se pudo renderizar'));
    img.src = url;
  });
}

/**
 * Renders an SVG file to a PNG File at `scale`x (2 = Retina), capped so the
 * longest side never exceeds `maxSide` px.
 */
export async function svgFileToPng(file: File, scale = 2, maxSide = 4096): Promise<File> {
  const text = await file.text();
  const size = readSvgSize(text) ?? { width: 300, height: 150 };
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth || size.width;
    const height = img.naturalHeight || size.height;
    const factor = Math.min(scale, maxSide / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar el PNG');
    const base = (file.name || 'imagen').replace(/\.svg$/i, '');
    return new File([blob], `${base}.png`, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

let lastNotice = 0;

/** Non-blocking toast; throttled so a ZIP with many SVGs shows one notice. */
export function notifySvgConverted(): void {
  const now = Date.now();
  if (now - lastNotice < 4000) return;
  lastNotice = now;
  // Dynamic import: keeps @nuxt/ui (and its #imports alias) out of vitest
  import('@nuxt/ui/composables/useToast.js')
    .then(({ useToast }) => useToast().add({
      title: 'SVG convertido a PNG',
      description: 'Gmail y Outlook no muestran imágenes SVG, así que se subió como PNG.',
      color: 'warning',
    }))
    .catch(() => {});
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ZIP import: converts every .svg inside the ZIP to .png and rewrites the
 * references in its .html/.css files, before the ZIP goes to the backend
 * (which doesn't handle SVG: imported SVGs ended up as broken images, and
 * any script inside them would be hosted as-is).
 * Text files are rewritten byte-for-byte (binary string), so a Latin-1 or
 * UTF-8 template keeps its encoding. On any error the original ZIP is used.
 */
export async function convertZipSvgsToPng(file: File): Promise<{ file: File; converted: number }> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const isJunk = (n: string) => n.startsWith('__MACOSX/') || /(^|\/)\._/.test(n);
    const entries = (re: RegExp) => Object.keys(zip.files).filter((n) => !zip.files[n].dir && !isJunk(n) && re.test(n));

    const renames: Array<[string, string]> = [];
    for (const name of entries(/\.svg$/i)) {
      try {
        const text = await zip.files[name].async('string');
        const png = await svgFileToPng(new File([text], name.split('/').pop() || 'imagen.svg', { type: 'image/svg+xml' }));
        let newName = name.replace(/\.svg$/i, '.png');
        if (zip.files[newName]) newName = name + '.png';
        zip.file(newName, await png.arrayBuffer());
        zip.remove(name);
        renames.push([name, newName]);
      } catch { /* unrenderable SVG: leave it as is */ }
    }
    if (!renames.length) return { file, converted: 0 };

    for (const tn of entries(/\.(html?|css)$/i)) {
      const original = await zip.files[tn].async('binarystring');
      let content = original;
      for (const [oldName, newName] of renames) {
        const oldBase = oldName.split('/').pop() as string;
        const newBase = newName.split('/').pop() as string;
        // basename at a path boundary, followed by a quote, ), ?, # or space
        const re = new RegExp(`(?<=^|[/"'(\\s=])${escapeRegExp(oldBase)}(?=["')\\s?#]|$)`, 'g');
        content = content.replace(re, newBase);
      }
      if (content !== original) zip.file(tn, content, { binary: true });
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { file: new File([blob], file.name, { type: file.type || 'application/zip' }), converted: renames.length };
  } catch {
    return { file, converted: 0 };
  }
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * HTML import: every data:image/svg+xml URI (img src, background, CSS url())
 * becomes a PNG, uploaded through `upload` (same path as a manual upload);
 * if the upload isn't possible it falls back to a PNG data URI.
 */
export async function convertSvgDataUrisInHtml(
  html: string,
  upload: (file: File) => Promise<string | null>,
): Promise<{ html: string; converted: number }> {
  const found = Array.from(new Set(html.match(/data:image\/svg\+xml[;,][^"')\s]+/gi) || []));
  let converted = 0;
  for (const uri of found) {
    try {
      const comma = uri.indexOf(',');
      const meta = uri.slice(0, comma);
      const payload = uri.slice(comma + 1);
      const text = /;base64$/i.test(meta)
        ? new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)))
        : decodeURIComponent(payload);
      const png = await svgFileToPng(new File([text], 'imagen.svg', { type: 'image/svg+xml' }));
      const url = (await upload(png).catch(() => null)) || (await blobToDataUri(png));
      html = html.split(uri).join(url);
      converted++;
    } catch { /* leave this one as is */ }
  }
  return { html, converted };
}
