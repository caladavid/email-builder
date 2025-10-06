import type { TEditorBlock } from "../../editor/core";

type TButtonProps = {
  label: string;
  icon: string;
  block: () => TEditorBlock;
};
export const BUTTONS: TButtonProps[] = [
  {
    label: 'Encabezado',
    icon: 'material-symbols:h-mobiledata-badge-outline',
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
    block: () => ({
      type: 'Spacer',
      data: {},
    }),
  },
  {
    label: 'Html',
    icon: 'material-symbols:html',
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
    label: 'Columnas',
    icon: 'material-symbols:view-column-outline',
    block: () => ({
      type: 'ColumnsContainer',
      data: {
        props: {
          columnsGap: 16,
          columnsCount: 3,
          columns: [{ childrenIds: [] }, { childrenIds: [] }, { childrenIds: [] }],
        },
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  },
  {
    label: 'Contenedor',
    icon: 'material-symbols:library-add-outline',
    block: () => ({
      type: 'Container',
      data: {
        style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
      },
    }),
  },
];

