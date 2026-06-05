import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

// ─── Toolbar primitives ───────────────────────────────────────────────────────

function Btn({ active, disabled, onClick, title, children, wide = false }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={[
        "flex items-center justify-center rounded text-sm transition-colors select-none",
        wide ? "h-7 px-2 gap-1" : "h-7 w-7",
        active
          ? "bg-slate-800 text-white"
          : "text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-4 w-px shrink-0 bg-slate-200" />;
}

// ─── Heading dropdown ─────────────────────────────────────────────────────────

const BLOCK_OPTS = [
  { label: "Paragraph", cmd: (e) => e.chain().focus().setParagraph().run(), active: (e) => e.isActive("paragraph") && !e.isActive("heading") },
  { label: "Heading 1", cmd: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive("heading", { level: 1 }) },
  { label: "Heading 2", cmd: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
  { label: "Heading 3", cmd: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
];

function BlockDropdown({ editor }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef = useRef(null);
  const current = BLOCK_OPTS.find((o) => o.active(editor)) ?? BLOCK_OPTS[0];

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      });
    }
  }, [open]);

  return (
    <div className="relative mr-1">
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="flex h-7 items-center gap-1 rounded border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 min-w-[96px] justify-between"
      >
        <span>{current.label}</span>
        <svg className="h-3 w-3 text-slate-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onMouseDown={() => setOpen(false)} />
          <div
            style={menuStyle}
            className="min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
          >
            {BLOCK_OPTS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setOpen(false); opt.cmd(editor); }}
                className={[
                  "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                  opt.active(editor) ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RichEditor({ content = "", onChange, placeholder, minHeight = 140, className = "" }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
    ],
    content: content || "",
    onUpdate({ editor: e }) {
      onChange?.(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rich-editor-content focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  if (!editor) return null;

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/60 px-2 py-1.5">

        <BlockDropdown editor={editor} />
        <Sep />

        {/* Bold */}
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <span className="font-bold">B</span>
        </Btn>
        {/* Italic */}
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <span className="italic font-serif">I</span>
        </Btn>
        {/* Underline */}
        <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <span className="underline">U</span>
        </Btn>
        {/* Strike */}
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <span className="line-through">S</span>
        </Btn>

        <Sep />

        {/* Blockquote */}
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2.5 4a.5.5 0 000 1h3a.5.5 0 000-1h-3zm0 4a.5.5 0 000 1h7a.5.5 0 000-1h-7zm0 4a.5.5 0 000 1h5a.5.5 0 000-1h-5z" clipRule="evenodd" />
            <path d="M9 3.5a1.5 1.5 0 113 0v3a1.5 1.5 0 01-3 0v-3zm6 0a1.5 1.5 0 113 0v3a1.5 1.5 0 01-3 0v-3z" />
          </svg>
        </Btn>
        {/* Bullet list */}
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm.75 4.5a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H6.75zM3 5a1 1 0 100 2 1 1 0 000-2zm0 5a1 1 0 100 2 1 1 0 000-2zm0 5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
          </svg>
        </Btn>
        {/* Ordered list */}
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm.75 4.5a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H6.75zM2.5 4.5a.5.5 0 01.5-.5h.75a.5.5 0 010 1H3.5v.5h.25a.5.5 0 010 1H3.5v.5h.75a.5.5 0 010 1H3a.5.5 0 01-.5-.5v-3zM2.5 10h1.5a.5.5 0 010 1H2.5a.5.5 0 010-1zm0 2.5h1a.5.5 0 010 1H2.5a.5.5 0 010-1z" clipRule="evenodd" />
          </svg>
        </Btn>

        <Sep />

        {/* Undo */}
        <Btn disabled={!canUndo} active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clipRule="evenodd" />
          </svg>
        </Btn>
        {/* Redo */}
        <Btn disabled={!canRedo} active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75H9.25a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.061.025z" clipRule="evenodd" />
          </svg>
        </Btn>
      </div>

      {/* ── Editor area ── */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-4 top-3 select-none text-sm text-slate-300">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
