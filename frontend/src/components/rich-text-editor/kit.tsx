import { DndPlugin } from '@platejs/dnd';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { getPluginTypes, KEYS } from 'platejs';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { AlignKit } from '@/components/editor/plugins/align-kit';
import { BasicNodesKit } from '@/components/editor/plugins/basic-nodes-kit';
import { CodeBlockKit } from '@/components/editor/plugins/code-block-kit';
import { LinkKit } from '@/components/editor/plugins/link-kit';
import { ListKit } from '@/components/editor/plugins/list-kit';
import { MediaKit } from '@/components/editor/plugins/media-kit';
import { TableKit } from '@/components/editor/plugins/table-kit';
import { BlockSelection } from '@/components/ui/block-selection';

function EditorDndProvider({ children }: { children?: React.ReactNode }) {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}

export const RichTextEditorKit = [
  DndPlugin.configure({
    render: {
      aboveSlate: EditorDndProvider,
    },
  }),
  BlockSelectionPlugin.configure(({ editor }) => ({
    options: {
      isSelectable: (element) =>
        !getPluginTypes(editor, [KEYS.column, KEYS.codeLine, KEYS.td]).includes(
          element.type
        ),
    },
    render: {
      belowRootNodes: (props) => {
        const className = [props.className, props.attributes.className]
          .filter(Boolean)
          .join(' ');

        if (!className.includes('slate-selectable')) {
          return null;
        }

        return <BlockSelection {...props} />;
      },
    },
  })),
  ...BasicNodesKit,
  ...CodeBlockKit,
  ...ListKit,
  ...AlignKit,
  ...LinkKit,
  ...MediaKit,
  ...TableKit,
];
