'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  List, 
  ListOrdered, 
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Minus,
  WrapText,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo
} from 'lucide-react';
import TextAlign from '@tiptap/extension-text-align';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-2xl shadow-sm',
        },
      }),
      Youtube.configure({
        width: 720,
        height: 405,
        controls: true,
        HTMLAttributes: {
          class: 'rounded-2xl overflow-hidden',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Escribe aquí...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm md:prose-base max-w-none focus:outline-none min-h-[200px] md:min-h-[250px] px-3 md:px-4 py-3',
      },
    },
  });

  // El contenido llega async al editar: hay que sincronizarlo sin pisar lo que está tipeando el usuario
  useEffect(() => {
    if (!editor) return;
    const incoming = content || '';
    if (incoming === editor.getHTML()) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);
    
    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL de imagen:');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const addYoutube = () => {
    const url = window.prompt('URL de YouTube:');
    if (!url) return;
    editor.commands.setYoutubeVideo({ src: url });
  };

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    disabled, 
    title, 
    icon: Icon 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    disabled?: boolean; 
    title: string; 
    icon: typeof Bold;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-2 md:p-2.5 rounded-lg hover:bg-gray-200 transition-colors ${
        isActive ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'text-gray-700'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="border-b bg-gray-50 px-2 py-2 flex flex-wrap gap-1 overflow-x-auto">
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Título 1"
          icon={Heading1}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Título 2"
          icon={Heading2}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Título 3"
          icon={Heading3}
        />

        <div className="w-px h-8 bg-gray-300 mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrita (Ctrl+B)"
          icon={Bold}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Cursiva (Ctrl+I)"
          icon={Italic}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Subrayado (Ctrl+U)"
          icon={UnderlineIcon}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Tachado"
          icon={Strikethrough}
        />

        <div className="w-px h-8 bg-gray-300 mx-1" />

        {/* Text alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Alinear izquierda"
          icon={AlignLeft}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Alinear centro"
          icon={AlignCenter}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Alinear derecha"
          icon={AlignRight}
        />

        <div className="w-px h-8 bg-gray-300 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista con viñetas"
          icon={List}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerada"
          icon={ListOrdered}
        />

        <div className="w-px h-8 bg-gray-300 mx-1" />

        {/* Block formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Cita"
          icon={Quote}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Código inline"
          icon={Code}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Línea horizontal"
          icon={Minus}
        />

        <div className="w-px h-8 bg-gray-300 mx-1" />

        {/* Link */}
        <ToolbarButton
          onClick={addLink}
          isActive={editor.isActive('link')}
          title="Agregar/Editar link"
          icon={LinkIcon}
        />

        <ToolbarButton
          onClick={addImage}
          title="Insertar imagen"
          icon={ImageIcon}
        />
        <ToolbarButton
          onClick={addYoutube}
          title="Insertar video"
          icon={Video}
        />

        {/* Line break */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setHardBreak().run()}
          title="Salto de línea (Shift+Enter)"
          icon={WrapText}
        />

        <div className="w-px h-8 bg-gray-300 mx-1" />

        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer (Ctrl+Z)"
          icon={Undo}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer (Ctrl+Y)"
          icon={Redo}
        />
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

