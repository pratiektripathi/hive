import * as React from 'react';

import {
  BoldIcon,
  Code2Icon,
  ItalicIcon,
  SquareCodeIcon,
  UnderlineIcon,
} from 'lucide-react';
import { KEYS, type Value } from 'platejs';
import {
  Plate,
  useEditorRef,
  useEditorSelector,
  usePlateEditor,
} from 'platejs/react';
import { Toaster } from 'sonner';

import { AlignToolbarButton } from '@/components/ui/align-toolbar-button';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import {
  RedoToolbarButton,
  UndoToolbarButton,
} from '@/components/ui/history-toolbar-button';
import { LinkToolbarButton } from '@/components/ui/link-toolbar-button';
import {
  BulletedListToolbarButton,
  NumberedListToolbarButton,
} from '@/components/ui/list-toolbar-button';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { MediaToolbarButton } from '@/components/ui/media-toolbar-button';
import { TableToolbarButton } from '@/components/ui/table-toolbar-button';
import { ToolbarButton, ToolbarGroup } from '@/components/ui/toolbar';
import { cn } from '@/lib/utils';

import { RichTextEditorKit } from './kit';

export type RichTextValue = Value;

export interface RichTextEditorProps {
  value?: RichTextValue;
  onChange?: (value: RichTextValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_PLACEHOLDER = 'Enter reminders for yourself for this section';

function createEmptyValue(): RichTextValue {
  return [{ type: 'p', children: [{ text: '' }] }];
}

function getInitialValue(value?: RichTextValue): RichTextValue {
  if (!value || value.length === 0) {
    return createEmptyValue();
  }

  return value;
}

function CodeBlockToolbarButton() {
  const editor = useEditorRef();
  const pressed = useEditorSelector(
    (currentEditor) =>
      currentEditor.api.some({ match: { type: KEYS.codeBlock } }),
    []
  );

  return (
    <ToolbarButton
      pressed={pressed}
      tooltip="Code block"
      onClick={() => {
        editor.tf.toggleBlock(KEYS.codeBlock);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <SquareCodeIcon />
    </ToolbarButton>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const lastEmittedValueRef = React.useRef<RichTextValue | undefined>(value);

  const editor = usePlateEditor({
    plugins: RichTextEditorKit,
    value: getInitialValue(value),
  });

  React.useEffect(() => {
    if (value === undefined) {
      return;
    }

    if (value === lastEmittedValueRef.current) {
      return;
    }

    lastEmittedValueRef.current = value;
    editor.tf.setValue(getInitialValue(value));
  }, [editor, value]);

  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-md border border-border bg-background text-foreground shadow-xs',
        disabled && 'opacity-60',
        className
      )}
    >
      <Plate
        editor={editor}
        readOnly={disabled}
        onChange={({ value: nextValue }) => {
          lastEmittedValueRef.current = nextValue;
          onChange?.(nextValue);
        }}
      >
        <FixedToolbar
          className={cn(
            'flex h-auto min-h-10 w-full flex-wrap items-center justify-start gap-y-0.5 overflow-visible rounded-none border-b border-border bg-muted/50 p-1',
            disabled && 'pointer-events-none'
          )}
        >
          <ToolbarGroup>
            <UndoToolbarButton />
            <RedoToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
              <ItalicIcon />
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip="Underline (⌘+U)"
            >
              <UnderlineIcon />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
              <Code2Icon />
            </MarkToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <BulletedListToolbarButton />
            <NumberedListToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <AlignToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <LinkToolbarButton />
            <MediaToolbarButton nodeType={KEYS.img} />
            <TableToolbarButton />
            <CodeBlockToolbarButton />
          </ToolbarGroup>
        </FixedToolbar>

        <EditorContainer className="min-h-[220px]">
          <Editor
            variant="none"
            className="min-h-[220px] px-3 py-2 text-sm"
            placeholder={placeholder}
            disabled={disabled}
          />
        </EditorContainer>
      </Plate>

      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'border-border bg-background text-foreground',
          },
        }}
      />
    </div>
  );
}
