"use client";

import { useState, type Key, type ReactNode } from "react";
import {
  Bold,
  ChevronDown,
  Code,
  Eraser,
  FontCase,
  Italic,
  Link,
  ListOl,
  ListUl,
  Megaphone,
  QuoteOpen,
  Strikethrough,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
  Underline,
} from "@gravity-ui/icons";
import { Button, Dropdown, Input, Kbd, Label, Popover, TextField, ToggleButton, Tooltip } from "@heroui/react";
import type { ResolvedPos } from "@tiptap/pm/model";
import { useEditorState, type Editor } from "@tiptap/react";
import type { Alignment } from "../../editor/extensions";
import { fonts, textSizes } from "../../editor/palette";
import { ColorPicker } from "./ColorPicker";
import { OverflowToolbar } from "./OverflowToolbar";
import { TableInsert } from "./TableTools";

type ToolbarProps = {
  editor: Editor;
  isAnnouncement: boolean;
  onAnnouncementChange: (value: boolean) => void;
};

/**
 * Formatting toolbar of the composer, laid out like the one of a Teams channel post: on one line, the tools that
 * do not fit under "⋮" (OverflowToolbar).
 */
export function Toolbar({ editor, isAnnouncement, onAnnouncementChange }: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      linkHref: (e.getAttributes("link").href as string | undefined) ?? "",
      color: (e.getAttributes("textColor").value as string | undefined) ?? null,
      highlight: (e.getAttributes("highlight").value as string | undefined) ?? null,
      size: (e.getAttributes("textSize").value as string | undefined) ?? null,
      font: (e.getAttributes("fontFamily").value as string | undefined) ?? null,
      align: ((e.getAttributes("paragraph").align as Alignment | null | undefined) ?? "left") as Alignment,
      table: e.isActive("table"),
    }),
  });

  const chain = () => editor.chain().focus();
  const setMark = (mark: string, value: string | null) =>
    onWord(editor, (c) => (value ? c.setMark(mark, { value }) : c.unsetMark(mark)));

  return (
    // Priorities: when room runs out, the tools that matter less go under "⋮" first (font, alignment, clear formatting
    // and link, then the size), so the basics, the table and the announcement switch stay in sight.
    <OverflowToolbar
      label="Định dạng"
      groups={[
        {
          priority: 3,
          tools: [
            <Tool key="bold" label="Đậm (Ctrl+B)" isSelected={state.bold} onToggle={() => chain().toggleBold().run()}>
              <Bold />
            </Tool>,
            <Tool key="italic" label="Nghiêng (Ctrl+I)" isSelected={state.italic} onToggle={() => chain().toggleItalic().run()}>
              <Italic />
            </Tool>,
            <Tool key="underline" label="Gạch chân (Ctrl+U)" isSelected={state.underline} onToggle={() => chain().toggleUnderline().run()}>
              <Underline />
            </Tool>,
            <Tool key="strike" label="Gạch ngang" isSelected={state.strike} onToggle={() => chain().toggleStrike().run()}>
              <Strikethrough />
            </Tool>,
          ],
        },
        {
          priority: 2,
          tools: [
            <ListPicker
              key="list"
              value={state.orderedList ? "ordered" : state.bulletList ? "bullet" : null}
              onPick={(list) => (list === "ordered" ? chain().toggleOrderedList().run() : chain().toggleBulletList().run())}
            />,
          ],
        },
        {
          priority: 2,
          tools: [
            <ColorPicker
              key="color"
              textColor={state.color}
              highlight={state.highlight}
              onTextColor={(value) => setMark("textColor", value)}
              onHighlight={(value) => setMark("highlight", value)}
            />,
            <SizePicker key="size" value={state.size} onPick={(value) => setMark("textSize", value)} />,
          ],
        },
        // Used often: kept in the row as long as the basic styles are.
        {
          priority: 3,
          tools: [
            // No table inside a table; a table is edited from its own handles (TableHandles).
            <TableInsert key="table" editor={editor} isDisabled={state.table} />,
            <Tool
              key="announcement"
              label="Đăng dạng Thông báo"
              isSelected={isAnnouncement}
              onToggle={() => onAnnouncementChange(!isAnnouncement)}
            >
              <Megaphone />
            </Tool>,
          ],
        },
        {
          priority: 0,
          tools: [
            <FontPicker key="font" value={state.font} onPick={(value) => setMark("fontFamily", value)} />,
            <AlignPicker key="align" value={state.align} onPick={(value) => chain().setTextAlign(value).run()} />,
            <Tool key="clear" label="Xoá định dạng" isSelected={false} onToggle={() => clearFormatting(chain())}>
              <Eraser />
            </Tool>,
            <LinkPicker key="link" editor={editor} isActive={state.link} href={state.linkHref} />,
          ],
        },
      ]}
      // Used less often: always under "⋮".
      more={[
        [
          <Tool key="quote" label="Trích dẫn" isSelected={state.blockquote} onToggle={() => chain().toggleBlockquote().run()}>
            <QuoteOpen />
          </Tool>,
          <Tool key="code" label="Đoạn code" isSelected={state.codeBlock} onToggle={() => chain().toggleCodeBlock().run()}>
            <Code />
          </Tool>,
        ],
      ]}
    />
  );
}

/**
 * Back to plain text, like "Clear formatting" in Word: marks, lists, quotes, code blocks and alignment go;
 * links and mentions stay.
 */
function clearFormatting(chain: ReturnType<Editor["chain"]>) {
  const marks = ["bold", "italic", "underline", "strike", "code", "textColor", "textSize", "fontFamily", "highlight"];
  marks.reduce((c, mark) => c.unsetMark(mark), chain).clearNodes().unsetTextAlign().run();
}

/**
 * Applies a mark change to the selection or, with nothing selected, to the word around the cursor, as Google Docs
 * does: with the cursor in a word, picking a size or a colour changes that word. The cursor stays where it was.
 */
function onWord(editor: Editor, change: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) {
  const { selection } = editor.state;
  const word = selection.empty ? wordAround(selection.$from) : null;
  const chain = editor.chain().focus();
  if (!word) return change(chain).run();
  return change(chain.setTextSelection(word)).setTextSelection(selection.from).run();
}

/** The letters and digits on both sides of a position, or null between words. */
function wordAround($pos: ResolvedPos): { from: number; to: number } | null {
  // One character per leaf node (mentions), so offsets in the text match positions in the paragraph.
  const text = $pos.parent.textBetween(0, $pos.parent.content.size, undefined, "\ufffc");
  const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}_]/u.test(char);
  let start = $pos.parentOffset;
  let end = $pos.parentOffset;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;
  return start < end ? { from: $pos.start() + start, to: $pos.start() + end } : null;
}

function Tool({ label, isSelected, onToggle, children }: {
  label: string;
  isSelected: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={400}>
      <ToggleButton
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={label}
        isSelected={isSelected}
        onChange={onToggle}
        className="rounded-lg [&_svg]:size-4"
      >
        {children}
      </ToggleButton>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/** A trigger button with a tooltip, for the pickers below. */
/** A toolbar button opening a picker; `menu` adds ▾ when it offers several choices (as in Tiptap's toolbar). */
function PickerTrigger({ label, isActive, menu = false, children }: {
  label: string;
  isActive: boolean;
  menu?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={400}>
      <Button
        isIconOnly={!menu}
        size="sm"
        variant="ghost"
        aria-label={label}
        className={`rounded-lg ${menu ? "min-w-0 gap-1.5 px-2" : ""} ${isActive ? "bg-default" : ""}`}
      >
        <span className="flex [&>svg]:size-4">{children}</span>
        {menu && <ChevronDown aria-hidden className="size-3 text-muted" />}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

type ListKind = "bullet" | "ordered";

const lists: { value: ListKind; label: string; icon: ReactNode }[] = [
  { value: "bullet", label: "Danh sách chấm", icon: <ListUl /> },
  { value: "ordered", label: "Danh sách số", icon: <ListOl /> },
];

/** Bulleted or numbered list in one button; picking the current kind again turns the list off. */
function ListPicker({ value, onPick }: { value: ListKind | null; onPick: (value: ListKind) => void }) {
  const current = lists.find((l) => l.value === value);
  return (
    <Dropdown>
      <PickerTrigger label={current ? current.label : "Danh sách"} isActive={value !== null} menu>
        {(current ?? lists[0]).icon}
      </PickerTrigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label="Danh sách"
          selectionMode="single"
          selectedKeys={value ? [value] : []}
          onAction={(key: Key) => onPick(key as ListKind)}
        >
          {lists.map((list) => (
            <Dropdown.Item key={list.value} id={list.value} textValue={list.label}>
              <span aria-hidden className="text-muted [&_svg]:size-4">
                {list.icon}
              </span>
              <Label>{list.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function SizePicker({ value, onPick }: { value: string | null; onPick: (value: string | null) => void }) {
  return (
    <Dropdown>
      <PickerTrigger label="Cỡ chữ" isActive={value !== null} menu>
        <FontCase />
      </PickerTrigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label="Cỡ chữ"
          selectionMode="single"
          selectedKeys={[value ?? "normal"]}
          onAction={(key: Key) => onPick(key === "normal" ? null : String(key))}
        >
          {textSizes.map((size) => (
            <Dropdown.Item key={size.name ?? "normal"} id={size.name ?? "normal"} textValue={size.label}>
              <Label>{size.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function FontPicker({ value, onPick }: { value: string | null; onPick: (value: string | null) => void }) {
  const current = fonts.find((f) => f.name === value) ?? fonts[0];
  return (
    <Dropdown>
      <Tooltip delay={400}>
        <Button size="sm" variant="ghost" aria-label={`Phông chữ: ${current.label}`} className="gap-1.5 rounded-lg px-2">
          <span data-font={current.name ?? undefined} className="w-16 truncate text-start text-sm">
            {current.label}
          </span>
          <ChevronDown aria-hidden className="size-3 text-muted" />
        </Button>
        <Tooltip.Content>Phông chữ</Tooltip.Content>
      </Tooltip>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label="Phông chữ"
          selectionMode="single"
          selectedKeys={[value ?? "default"]}
          onAction={(key: Key) => onPick(key === "default" ? null : String(key))}
        >
          {fonts.map((font) => (
            <Dropdown.Item key={font.name ?? "default"} id={font.name ?? "default"} textValue={font.label}>
              <Label data-font={font.name ?? undefined}>{font.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const alignments: { value: Alignment; label: string; shortcut: string; icon: ReactNode }[] = [
  { value: "left", label: "Căn trái", shortcut: "Ctrl+Shift+L", icon: <TextAlignLeft /> },
  { value: "center", label: "Căn giữa", shortcut: "Ctrl+Shift+E", icon: <TextAlignCenter /> },
  { value: "right", label: "Căn phải", shortcut: "Ctrl+Shift+R", icon: <TextAlignRight /> },
  { value: "justify", label: "Căn đều hai bên", shortcut: "Ctrl+Shift+J", icon: <TextAlignJustify /> },
];

/** Alignment of the selected paragraphs; the button shows the current one. */
function AlignPicker({ value, onPick }: { value: Alignment; onPick: (value: Alignment) => void }) {
  const current = alignments.find((a) => a.value === value) ?? alignments[0];
  return (
    <Dropdown>
      <PickerTrigger label={`Căn lề: ${current.label}`} isActive={value !== "left"} menu>
        {current.icon}
      </PickerTrigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label="Căn lề"
          selectionMode="single"
          selectedKeys={[value]}
          onAction={(key: Key) => onPick(key as Alignment)}
        >
          {alignments.map((a) => (
            <Dropdown.Item key={a.value} id={a.value} textValue={a.label}>
              <span aria-hidden className="text-muted [&_svg]:size-4">
                {a.icon}
              </span>
              <Label>{a.label}</Label>
              <Kbd className="ms-auto">{a.shortcut}</Kbd>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** Adds "https://" when the address has no scheme, so "portal.vn" becomes a working link. */
function normalizeUrl(value: string): string {
  const url = value.trim();
  return /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
}

/**
 * A link with its own text: "Bộ UI của Tiptap" that opens https://tiptap.dev/…. The text starts as the selected
 * words (or the whole link being edited); left empty, the address itself is shown.
 */
function LinkPicker({ editor, isActive, href }: { editor: Editor; isActive: boolean; href: string }) {
  const [isOpen, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [initialText, setInitialText] = useState("");

  function open(next: boolean) {
    if (next) {
      // Editing a link edits all of it, not only the part under the cursor.
      if (isActive) editor.chain().extendMarkRange("link").run();
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, " ");
      setUrl(href);
      setText(selected);
      setInitialText(selected);
    }
    setOpen(next);
  }

  function apply() {
    const chain = editor.chain().focus();
    if (!url.trim()) {
      chain.extendMarkRange("link").unsetLink().run();
    } else if (text === initialText && initialText !== "") {
      // Same words: only the address changes, their other formatting stays.
      chain.extendMarkRange("link").setLink({ href: normalizeUrl(url) }).run();
    } else {
      const address = normalizeUrl(url);
      chain
        .insertContent({ type: "text", text: text.trim() || address, marks: [{ type: "link", attrs: { href: address } }] })
        .unsetMark("link")
        .run();
    }
    setOpen(false);
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={open}>
      <PickerTrigger label="Liên kết" isActive={isActive}>
        <Link />
      </PickerTrigger>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Liên kết" className="w-80 p-3">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            <TextField value={text} onChange={setText} variant="secondary">
              <Label>Văn bản hiển thị</Label>
              <Input placeholder="Văn bản hiển thị" />
            </TextField>
            <TextField value={url} onChange={setUrl} autoFocus variant="secondary">
              <Label>Địa chỉ liên kết</Label>
              <Input placeholder="https://abc.vn" />
            </TextField>
            <div className="flex justify-end gap-2">
              {isActive && (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    editor.chain().focus().extendMarkRange("link").unsetLink().run();
                    setOpen(false);
                  }}
                >
                  Gỡ liên kết
                </Button>
              )}
              <Button size="sm" type="submit" isDisabled={!url.trim()}>
                Áp dụng
              </Button>
            </div>
          </form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
