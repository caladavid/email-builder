<template>
  <!-- FIXME: check all types -->
  <BuildBlockComponent :blocks="READER_DICTIONARY" v-bind="{ ...document[rootBlockId], document }" />
</template>

<script setup lang="ts">
import Avatar, { AvatarPropsSchema } from '@flyhub/email-block-avatar';
import ButtonReader, { ButtonPropsSchema } from '../blocks/Button/ButtonReader.vue';
import Divider, { DividerPropsSchema } from '@flyhub/email-block-divider';
import HeadingReader, { HeadingPropsSchema } from '../blocks/Heading/HeadingReader.vue';
import Html, { HtmlPropsSchema } from '@flyhub/email-block-html';
/* import Image, { ImagePropsSchema } from '@flyhub/email-block-image'; */
import ImageReader, { ImagePropsSchema } from '../../../documents/blocks/Image/ImageReader.vue'; 

import SpacerReader, { SpacerPropsSchema } from '../blocks/Space/SpacerReader.vue';
/* import Spacer, { SpacerPropsSchema } from '@flyhub/email-block-spacer'; */
import Text, { TextPropsSchema } from '@flyhub/email-block-text';

import EmailLayoutReader, { EmailLayoutPropsSchema } from '../blocks/EmailLayout';
import ColumnsContainerReader, { ColumnsContainerPropsSchema } from '../blocks/ColumnsContainer';
import ContainerReader, { ContainerPropsSchema } from '../blocks/Container';

import { BuildBlockComponent } from '@flyhub/email-document-core';
import type { TReaderProps } from '..';
import TableReader, { TablePropsSchema } from '../blocks/Table';
import TableRowReader, { TableRowPropsSchema } from '../blocks/TableRow';
import TableCellReader, { TableCellPropsSchema } from '../blocks/TableCell';
import TableSectionReader from '../blocks/TableSection/TableSectionReader.vue';
import { TableSectionPropsSchema } from '../../../documents/blocks/TableSection/TableSectionPropsSchema';
import TextReader from '../blocks/Text/TextReader.vue';



defineProps<TReaderProps>()



// FIXME: use function buildblockconfigdictionary
const READER_DICTIONARY = {
  ColumnsContainer: {
    schema: ColumnsContainerPropsSchema,
    Component: ColumnsContainerReader,
  },
  Container: {
    schema: ContainerPropsSchema,
    Component: ContainerReader,
  },
  EmailLayout: {
    schema: EmailLayoutPropsSchema,
    Component: EmailLayoutReader,
  },
  Avatar: {
    schema: AvatarPropsSchema,
    Component: Avatar,
  },
  Button: {
    schema: ButtonPropsSchema,
    Component: ButtonReader,
  },
  Divider: {
    schema: DividerPropsSchema,
    Component: Divider,
  },
  Heading: {
    schema: HeadingPropsSchema,
    Component: HeadingReader,
  },
  Html: {
    schema: HtmlPropsSchema,
    Component: Html,
  },
  Image: {
    schema: ImagePropsSchema,
    Component: ImageReader,
  },
  Spacer: {
    schema: SpacerPropsSchema,
    Component: SpacerReader,
  },
  Text: {
    schema: TextPropsSchema,
    Component: TextReader,
  },
   Table: {  
    schema: TablePropsSchema,  
    Component: TableReader 
  },  
  TableRow: {  
    schema: TableRowPropsSchema,  
    Component: TableRowReader  
  },  
  TableCell: {  
    schema: TableCellPropsSchema,  
    Component: TableCellReader  
  }, 
  TableSection: {
    schema: TableSectionPropsSchema,
    Component: TableSectionReader
  }
};

</script>
