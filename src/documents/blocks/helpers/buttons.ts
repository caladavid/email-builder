import type { TEditorBlock } from "../../editor/core";

type TButtonProps = {
  label: string;
  icon: string;
  block: () => TEditorBlock;
  htmlTemplate: string;
};

// 1. Placeholder punteado para el interior de las columnas
const emptyPlaceholder = `<div data-block-type="placeholder" style="margin:0 auto;width:100%;min-height:60px;border:2px dashed #c7d8f5;border-radius:6px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;"><svg width="24" height="24" viewBox="0 0 40 40" fill="none" style="pointer-events:none;"><path d="M20 11v18M11 20h18" stroke="#0045B0" stroke-width="2.5" stroke-linecap="round"/></svg></div>`;

// 2. Función maestra para crear el HTML de la tabla con N columnas exactas
function createColumnsTemplate(count: number) {
  // table-layout:fixed es crucial para que respeten los anchos porcentuales
  const percentage = (100 / count).toFixed(2) + '%';
  let tds = '';
  
  for (let i = 0; i < count; i++) {
    tds += `<td width="${percentage}" style="padding:8px; vertical-align:top; border: 1px dashed transparent;">${emptyPlaceholder}</td>`;
  }
  
  return `<table data-block-type="Columnas" style="width:100%;max-width:600px;border-collapse:collapse;margin:0 auto;background:#ffffff;table-layout:fixed;"><tbody><tr>${tds}</tr></tbody></table>`;
}

// 3. Función auxiliar para cumplir con el tipo TEditorBlock (Retro-compatibilidad)
function createColumnsBlock(count: number): () => TEditorBlock {
  return () => ({
    type: 'ColumnsContainer',
    data: {
      props: {
        columnsGap: 16,
        columnsCount: count,
        columns: Array.from({ length: count }, () => ({ childrenIds: [] })),
      },
      style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
    },
  });
}

export const BUTTONS: TButtonProps[] = [
  {
    label: 'Encabezado',
    icon: 'material-symbols:h-mobiledata-badge-outline',
    htmlTemplate: '<h2 data-block-type="Encabezado" style="font-family:inherit;font-size:24px;font-weight:bold;padding:16px 24px;color:inherit;margin:0 auto;max-width:600px;display:block;background:#ffffff;word-break:break-word;overflow-wrap:break-word;">Encabezado</h2>',
    block: () => ({
      type: 'Heading',
      data: {
        props: { text: 'Encabezado' },
        style: {
          padding: { top: 16, bottom: 16, left: 24, right: 24 },
        },
      },
    }),
  },
  {
    label: 'Texto',
    icon: 'material-symbols:notes',
    htmlTemplate: '<p data-block-type="Texto" style="font-family:inherit;font-size:16px;line-height:1.5;padding:16px 24px;color:inherit;margin:0 auto;max-width:600px;background:#ffffff;word-break:break-word;overflow-wrap:break-word;">Escribe tu texto aquí.</p>',
    block: () => ({
      type: 'Text',
      data: {
        props: { text: 'Mi nuevo bloque de texto' },
        style: {
          padding: { top: 16, bottom: 16, left: 24, right: 24 },
          fontWeight: 'normal',
        },
      },
    }),
  },
  {
    label: 'Botón',
    icon: 'material-symbols:smart-button',
    htmlTemplate: '<div data-block-type="Botón" style="padding:16px 24px;text-align:center;max-width:600px;margin:0 auto;background:#ffffff;"><a href="#" style="display:inline-block;background:#007bff;color:#ffffff;font-family:inherit;font-size:16px;font-weight:bold;padding:12px 20px;border-radius:4px;text-decoration:none;">Botón</a></div>',
    block: () => ({
      type: 'Button',
      data: {
        props: {
          text: 'Botón',
          url: 'https://www.celcomlatam.com/',
        },
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  },
  {
    label: 'Imagen',
    icon: 'material-symbols:image-outline',
    htmlTemplate: '<div data-block-type="Imagen" style="padding:16px 24px;text-align:center;max-width:600px;margin:0 auto;background:#ffffff;"><img src="https://placehold.co/600x200/F8F8F8/CCC?text=Imagen" alt="Imagen" style="max-width:100%;height:auto;display:block;margin:0 auto;" /></div>',
    block: () => ({
      type: 'Image',
      data: {
        props: {
          url: 'https://assets.usewaypoint.com/sample-image.jpg',
          alt: 'Producto de Ejemplo',
          contentAlignment: 'middle',
          linkHref: null,
        },
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  },
  {
    label: 'Avatar',
    icon: 'material-symbols:account-circle-outline',
    htmlTemplate: '<div data-block-type="Avatar" style="padding:16px 24px;text-align:center;max-width:600px;margin:0 auto;background:#ffffff;"><img src="https://ui-avatars.com/api/?size=128&background=0079CC&color=fff" alt="Avatar" style="width:64px;height:64px;border-radius:50%;display:inline-block;" /></div>',
    block: () => ({
      type: 'Avatar',
      data: {
        props: {
          imageUrl: 'https://ui-avatars.com/api/?size=128',
          shape: 'circle',
        },
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  },
  {
    label: 'Separador',
    icon: 'material-symbols:horizontal-rule',
    htmlTemplate: '<div data-block-type="Separador" style="padding:16px 0;max-width:600px;margin:0 auto;background:#ffffff;"><hr style="border:none;border-top:1px solid #CCCCCC;margin:0;" /></div>',
    block: () => ({
      type: 'Divider',
      data: {
        style: { padding: { top: 16, right: 0, bottom: 16, left: 0 } },
        props: {
          lineColor: '#CCCCCC',
        },
      },
    }),
  },
  {
    label: 'Espaciador',
    icon: 'material-symbols:crop-3-2-outline',
    htmlTemplate: '<div data-block-type="Espaciador" style="height:32px;line-height:32px;display:block;max-width:600px;margin:0 auto;background:#ffffff;">&nbsp;</div>',
    block: () => ({
      type: 'Spacer',
      data: {},
    }),
  },
  {
    label: 'Html',
    icon: 'material-symbols:html',
    htmlTemplate: '<div data-block-type="Html" style="padding:16px 24px;font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff;"><strong>HTML personalizado</strong></div>',
    block: () => ({
      type: 'Html',
      data: {
        props: { contents: '<strong>Hola mundo</strong>' },
        style: {
          fontSize: 16,
          textAlign: null,
          padding: { top: 16, bottom: 16, left: 24, right: 24 },
        },
      },
    }),
  },
  {
    label: '2 Columnas',
    icon: 'material-symbols:view-column-2-outline',
    htmlTemplate: createColumnsTemplate(2),
    block: createColumnsBlock(2),
  },
  {
    label: '3 Columnas',
    icon: 'material-symbols:view-column-outline',
    htmlTemplate: createColumnsTemplate(3),
    block: createColumnsBlock(3),
  },
  {
    label: '4 Columnas',
    icon: 'material-symbols:view-week-outline',
    htmlTemplate: createColumnsTemplate(4),
    block: createColumnsBlock(4),
  },
  {
    label: '5 Columnas',
    icon: 'material-symbols:view-week-outline',
    htmlTemplate: createColumnsTemplate(5),
    block: createColumnsBlock(5),
  },
  {
    label: '6 Columnas',
    icon: 'material-symbols:view-week-outline',
    htmlTemplate: createColumnsTemplate(6),
    block: createColumnsBlock(6),
  },
  /* {
    label: 'Custom',
    icon: 'material-symbols:dashboard-customize-outline',
    // Usamos table-layout: auto para que las celdas se adapten libremente al contenido o al ancho manual que le pongan
    htmlTemplate: `<table data-block-type="Columnas" style="width:100%;max-width:600px;border-collapse:collapse;margin:0 auto;background:#ffffff;table-layout:auto;"><tbody><tr><td style="width:100%;padding:8px; vertical-align:top; border: 1px dashed transparent;">${emptyPlaceholder}</td></tr></tbody></table>`,
    block: createColumnsBlock(1),
  }, */
  /* {
    label: 'Columnas',
    icon: 'material-symbols:view-column-outline',
    htmlTemplate: '<table data-block-type="Columnas" style="width:100%;max-width:600px;border-collapse:collapse;margin:0 auto;background:#ffffff;"><tbody><tr><td style="width:33.33%;padding:8px;vertical-align:top;">Columna 1</td><td style="width:33.33%;padding:8px;vertical-align:top;">Columna 2</td><td style="width:33.33%;padding:8px;vertical-align:top;">Columna 3</td></tr></tbody></table>',
    block: () => ({
      type: 'ColumnsContainer',
      data: {
        props: {
          columnsGap: 16,
          columnsCount: 3,
          columns: Array.from({ length: 3 }, () => ({ childrenIds: [] })),
        },
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  }, */
  {
    label: 'Contenedor',
    icon: 'material-symbols:library-add-outline',
    htmlTemplate: `<div data-block-type="Contenedor" style="padding:16px 24px;background:#ffffff;border:1px dashed #cccccc;max-width:600px;margin:0 auto;"><p style="margin:0;color:#999;font-size:14px;font-family:inherit;text-align:center;">${emptyPlaceholder}</p></div>`,
    block: () => ({
      type: 'Container',
      data: {
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  },
  /* {
    label: 'Enlace',
    icon: 'material-symbols:link',
    htmlTemplate: '<div data-block-type="Enlace" style="padding:16px 24px;max-width:600px;margin:0 auto;background:#ffffff;"><a href="#" style="display:inline-block;color:#007bff;font-family:inherit;font-size:14px;text-decoration:underline;">Texto del enlace</a></div>',
    block: () => ({
      type: 'RichTextLink',
      data: {
        props: { text: 'Texto del enlace', url: '#' },
        style: {},
      },
    }),
  }, */
  /* {
    label: 'Table',
    icon: 'material-symbols:table',
    htmlTemplate: '<table data-block-type="Table" style="width:100%;max-width:600px;border-collapse:collapse;font-family:sans-serif;font-size:14px;margin:0 auto;background:#ffffff;"><tbody><tr><td style="padding:8px;border:1px solid #cccccc;">Celda 1</td><td style="padding:8px;border:1px solid #cccccc;">Celda 2</td></tr><tr><td style="padding:8px;border:1px solid #cccccc;">Celda 3</td><td style="padding:8px;border:1px solid #cccccc;">Celda 4</td></tr></tbody></table>',
    block: () => ({
      type: 'Table',
      data: {
        props: {
          rows: [
            { cells: [{ text: 'Celda 1' }, { text: 'Celda 2' }] },
            { cells: [{ text: 'Celda 3' }, { text: 'Celda 4' }] }
          ],
          borderWidth: 1,
          borderColor: '#cccccc',
          cellPadding: 8
        },
        style: { width: '100%' }
      }
    })
  }, */
];
