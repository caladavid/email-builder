<template>
  <!-- FIXME: check all types -->
  <BuildBlockComponent :blocks="READER_DICTIONARY" v-bind="{ ...document[rootBlockId], document }" />
</template>

<script setup lang="ts">
import Avatar, { AvatarPropsSchema } from '@flyhub/email-block-avatar';
import Button, { ButtonPropsSchema } from '@flyhub/email-block-button';
import Divider, { DividerPropsSchema } from '@flyhub/email-block-divider';
import Heading, { HeadingPropsSchema } from '@flyhub/email-block-heading';
import Html, { HtmlPropsSchema } from '@flyhub/email-block-html';
/* import Image, { ImagePropsSchema } from '@flyhub/email-block-image'; */
import ImageReader, { ImagePropsSchema } from '../../../documents/blocks/Image/ImageReader.vue'; 

import Spacer, { SpacerPropsSchema } from '@flyhub/email-block-spacer';
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
    Component: Button,
  },
  Divider: {
    schema: DividerPropsSchema,
    Component: Divider,
  },
  Heading: {
    schema: HeadingPropsSchema,
    Component: Heading,
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
    Component: Spacer,
  },
  Text: {
    schema: TextPropsSchema,
    Component: Text,
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
