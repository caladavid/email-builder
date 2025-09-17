import { z } from 'zod';

import Heading, { HeadingPropsSchema } from '@flyhub/email-block-heading';
import Text, { TextPropsSchema } from '@flyhub/email-block-text';
import Button, { ButtonPropsSchema } from '@flyhub/email-block-button';
import Image, { ImagePropsSchema } from '@flyhub/email-block-image';
import Avatar, { AvatarPropsSchema } from '@flyhub/email-block-avatar';
import Divider, { DividerPropsSchema } from '@flyhub/email-block-divider';
import Spacer, { SpacerPropsSchema } from '@flyhub/email-block-spacer';
import Html, { HtmlPropsSchema } from '@flyhub/email-block-html';

import { buildBlockConfigurationDictionary, buildBlockConfigurationSchema } from '@flyhub/email-document-core/builders';

import ColumnsContainerEditor from '../blocks/ColumnsContainer/ColumnsContainerEditor.vue'
import ColumnsContainerPropsSchema from '../blocks/ColumnsContainer/ColumnsContainerPropsSchema'
import ContainerEditor from '../blocks/Container/ContainerEditor.vue'
import ContainerPropsSchema from '../blocks/Container/ContainerPropsSchema'
import EmailLayoutEditor from '../blocks/EmailLayout/EmailLayoutEditor.vue';
import EmailLayoutPropsSchema from '../blocks/EmailLayout/EmailLayoutPropsSchema';
import EditorBlockWrapper from '../blocks/helpers/block-wrappers/EditorBlockWrapper.vue';
import { processDocumentVariables } from '../../utils/documentProcessor';
import { ref } from 'vue';
import { useInspectorDrawer } from './editor.store';
import RichTextLinkPropsSchema from '../blocks/RichTextLink/RichTextLinkPropsSchema';
import RichTextLinkEditor from '../blocks/RichTextLink/RichTextLinkEditor.vue';

/* const globalVariables = ref<Record<string, string>>({
  // Variables de ejemplo  
  userName: 'John Doe',
  companyName: 'Acme Corp',
  currentDate: new Date().toLocaleDateString()
}); */


export const EDITOR_DICTIONARY = buildBlockConfigurationDictionary({
  Avatar: {
    schema: AvatarPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper>
        <Avatar {...props} />
      </EditorBlockWrapper>
    ),
  },
  Button: {
    schema: ButtonPropsSchema,
    Component: (data) => {
      const inspectorDrawer = useInspectorDrawer()
      const processedProps = {
        ...data,
        props: {
          ...data.props,
          text: processDocumentVariables(data.props?.text ?? '', inspectorDrawer.globalVariables)
        }
      };
      return (
        <EditorBlockWrapper>
          <Button {...processedProps} />
        </EditorBlockWrapper>
      );
    },
  },
  RichTextLink: {  
    schema: RichTextLinkPropsSchema,  
    Component: (props) => (  
      <EditorBlockWrapper>  
        <RichTextLinkEditor {...props} />  
      </EditorBlockWrapper>  
    ),  
  },  
  Container: {
    schema: ContainerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper>
        <ContainerEditor {...props} />
      </EditorBlockWrapper>
    ),
  },
  ColumnsContainer: {
    schema: ColumnsContainerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper>
        <ColumnsContainerEditor {...props} />
      </EditorBlockWrapper>
    ),
  },
  Heading: {
    schema: HeadingPropsSchema,
    Component: (data) => {
      const inspectorDrawer = useInspectorDrawer()
      const processedProps = {
        ...data,
        props: {
          ...data.props,
          text: processDocumentVariables(data.props?.text ?? '', inspectorDrawer.globalVariables)
        }
      };
      return (
        <EditorBlockWrapper>
          <Heading {...processedProps} />
        </EditorBlockWrapper>
      );
    },
  },
  Html: {
    schema: HtmlPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper>
        <Html {...props} />
      </EditorBlockWrapper>
    ),
  },
  Image: {
    schema: ImagePropsSchema,
    Component: (data) => {
      const props = {
        ...data,
        props: {
          ...data.props,
          url: data.props?.url ?? 'https://placehold.co/600x400@2x/F8F8F8/CCC?text=Your%20image',
        },
      };
      return (
        <EditorBlockWrapper>
          <Image {...props} />
        </EditorBlockWrapper>
      );
    },
  },
  Text: {
    schema: TextPropsSchema,
    Component: (data) => {
      const inspectorDrawer = useInspectorDrawer()
      const processedProps = {
        ...data,
        props: {
          ...data.props,
          text: processDocumentVariables(data.props?.text ?? '', inspectorDrawer.globalVariables)
        }
      };
      return (
        <EditorBlockWrapper>
          <Text {...processedProps} />
        </EditorBlockWrapper>
      );
    },
  },
  EmailLayout: {
    schema: EmailLayoutPropsSchema,
    Component: (p) => <EmailLayoutEditor {...p} />,
  },
  Spacer: {
    schema: SpacerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper>
        <Spacer {...props} />
      </EditorBlockWrapper>
    ),
  },
  Divider: {
    schema: DividerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper>
        <Divider {...props} />
      </EditorBlockWrapper>
    ),
  },
});

export const EditorBlockSchema = buildBlockConfigurationSchema(EDITOR_DICTIONARY)
export const EditorConfigurationSchema = z.record(EditorBlockSchema)

export type TEditorBlock = z.infer<typeof EditorBlockSchema>
export type TEditorConfiguration = Record<string, TEditorBlock>
