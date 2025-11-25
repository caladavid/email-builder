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
import InlineTextEditor from '../blocks/InlineTextEditor/InlineTextEditor.vue';
import InlineHeadingEditor from '../blocks/InlineHeadingEditor/InlineHeadingEditor.vue';
import InlineButtonEditor from '../blocks/InlineButtonEditor/InlineButtonEditor.vue';

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
      
      // Con processedProps, se muestran los valores de la key, ejm: {hello} = hola
      const processedProps = {
        ...data,
        props: {
          ...data.props,
          text: processDocumentVariables(data.props?.text ?? '', inspectorDrawer.globalVariables)
        }
      };
      return (
        // Cambiar ...data por ...processedProps, para obtener su value
        <EditorBlockWrapper>
          <InlineButtonEditor 
            text={data.props?.text || ""}  
            style={data.style ?? undefined}  
            buttonTextColor={data.props?.buttonTextColor ?? undefined}  
            buttonBackgroundColor={data.props?.buttonBackgroundColor ?? undefined}  
            buttonStyle={data.props?.buttonStyle ?? undefined}  
            size={data.props?.size ?? undefined}  
            url={data.props?.url ?? undefined}   
            fullWidth={data.props?.fullWidth ?? undefined}  
          />
          {/* <Button {...data} /> */}
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
      // Con processedProps, se muestran los valores de la key, ejm: {hello} = hola
      const processedProps = {
        ...data,
        props: {
          ...data.props,
          text: processDocumentVariables(data.props?.text ?? '', inspectorDrawer.globalVariables)
        }
      };
      // Cambiar ...data por ...processedProps, para obtener su value
      return (
        <EditorBlockWrapper>
          {/* <Heading {...data} /> */}
          <InlineHeadingEditor 
            text={data.props?.text || ""}    
            style={data.style ?? undefined} 
            level={data.props?.level || "h2"}
          />
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
      // Cambiar ...data por ...processedProps, para obtener su value
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
      // Con processedProps, se muestran los valores de la key, ejm: {hello} = hola
      const processedProps = {
        ...data,
        props: {
          ...data.props,
          text: processDocumentVariables(data.props?.text ?? '', inspectorDrawer.globalVariables)
        }
      };
      // Cambiar ...data por ...processedProps, para obtener su value
      return (
        <EditorBlockWrapper>
          {/* <Text {...data} /> */}
           <InlineTextEditor     
            text={data.props?.text || ""}    
            style={data.style ?? undefined}     
          />
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
