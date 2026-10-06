"use client";

import { useState, type Key, type ReactNode } from "react";
import {
  Bold,
  Code,
  Font,
  FontCase,
  Italic,
  Link,
  ListOl,
  ListUl,
  Megaphone,
  Paintbrush,
  QuoteOpen,
  Strikethrough,
  Underline,
} from "@gravity-ui/icons";
import { Button, Dropdown, Input, Label, Popover, Separator, TextField, ToggleButton, Tooltip } from "@heroui/react";
import { useEditorState, type Editor } from "@tiptap/react";
import { highlightColors, textColors, textSizes } from "../../editor/palette";

type ToolbarProps = {
  editor: Editor;
  isAnnouncement: boolean;
  onAnnouncementChange: (value: boolean) => void;
};

/** Formatting toolbar of the composer, laid out like the one of a Teams channel post. */
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
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Định dạng" className="flex flex-wrap items-center gap-0.5">
      <Tool label="Đậm (Ctrl+B)" isSelected={state.bold} onToggle={() => chain().toggleBold().run()}>
        <Bold />
      </Tool>
      <Tool label="Nghiêng (Ctrl+I)" isSelected={state.italic} onToggle={() => chain().toggleItalic().run()}>
        <Italic />
      </Tool>
      <Tool label="Gạch chân (Ctrl+U)" isSelected={state.underline} onToggle={() => chain().toggleUnderline().run()}>
        <Underline />
      </Tool>
      <Tool label="Gạch ngang" isSelected={state.strike} onToggle={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </Tool>

      <Divider />

      <Tool label="Danh sách chấm" isSelected={state.bulletList} onToggle={() => chain().toggleBulletList().run()}>
        <ListUl />
      </Tool>
      <Tool label="Danh sách số" isSelected={state.orderedList} onToggle={() => chain().toggleOrderedList().run()}>
        <ListOl />
      </Tool>

      <Divider />

      <SwatchPicker
        label="Tô nền chữ"
        icon={<Paintbrush />}
        swatches={highlightColors.map((c) => ({ ...c, style: { background: `var(--post-mark-${c.name})` } }))}
        value={state.highlight}
        clearLabel="Bỏ tô"
        onPick={(value) =>
          value ? chain().setMark("highlight", { value }).run() : chain().unsetMark("highlight").run()
        }
      />
      <SwatchPicker
        label="Màu chữ"
        icon={<Font />}
        swatches={textColors.map((c) => ({ ...c, style: { color: `var(--post-${c.name})` }, text: "A" }))}
        value={state.color}
        clearLabel="Màu mặc định"
        onPick={(value) =>
          value ? chain().setMark("textColor", { value }).run() : chain().unsetMark("textColor").run()
        }
      />
      <SizePicker
        value={state.size}
        onPick={(value) => (value ? chain().setMark("textSize", { value }).run() : chain().unsetMark("textSize").run())}
      />

      <Divider />

      <Tool label="Trích dẫn" isSelected={state.blockquote} onToggle={() => chain().toggleBlockquote().run()}>
        <QuoteOpen />
      </Tool>
      <LinkPicker editor={editor} isActive={state.link} href={state.linkHref} />
      <Tool label="Đoạn code" isSelected={state.codeBlock} onToggle={() => chain().toggleCodeBlock().run()}>
        <Code />
      </Tool>

      <Divider />

      <Tool label="Đăng dạng Thông báo" isSelected={isAnnouncement} onToggle={() => onAnnouncementChange(!isAnnouncement)}>
        <Megaphone />
      </Tool>
    </div>
  );
}

function Divider() {
  return <Separator orientation="vertical" className="mx-1 h-5" />;
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
        className="[&_svg]:size-4"
      >
        {children}
      </ToggleButton>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/** A trigger button with a tooltip, for the pickers below. */
function PickerTrigger({ label, isActive, children }: { label: string; isActive: boolean; children: ReactNode }) {
  return (
    <Tooltip delay={400}>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={label}
        className={`[&_svg]:size-4 ${isActive ? "bg-default" : ""}`}
      >
        {children}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

type Swatch = { name: string; label: string; style: React.CSSProperties; text?: string };

function SwatchPicker({ label, icon, swatches, value, clearLabel, onPick }: {
  label: string;
  icon: ReactNode;
  swatches: Swatch[];
  value: string | null;
  clearLabel: string;
  onPick: (value: string | null) => void;
}) {
  const [isOpen, setOpen] = useState(false);

  function pick(name: string | null) {
    onPick(name);
    setOpen(false);
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      <PickerTrigger label={label} isActive={value !== null}>
        {icon}
      </PickerTrigger>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label={label} className="flex flex-col gap-2 p-2">
          <div className="grid grid-cols-7 gap-1">
            {swatches.map((swatch) => (
              <button
                key={swatch.name}
                type="button"
                aria-label={swatch.label}
                aria-pressed={value === swatch.name}
                onClick={() => pick(swatch.name)}
                style={swatch.style}
                className="flex size-7 items-center justify-center rounded-md border border-border text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-focus aria-pressed:ring-2 aria-pressed:ring-accent"
              >
                {swatch.text}
              </button>
            ))}
          </div>
          <Button size="sm" variant="tertiary" onPress={() => pick(null)}>
            {clearLabel}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function SizePicker({ value, onPick }: { value: string | null; onPick: (value: string | null) => void }) {
  return (
    <Dropdown>
      <PickerTrigger label="Cỡ chữ" isActive={value !== null}>
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

/** Adds "https://" when the address has no scheme, so "portal.vn" becomes a working link. */
function normalizeUrl(value: string): string {
  const url = value.trim();
  return /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
}

function LinkPicker({ editor, isActive, href }: { editor: Editor; isActive: boolean; href: string }) {
  const [isOpen, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function open(next: boolean) {
    if (next) setUrl(href);
    setOpen(next);
  }

  function apply() {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!url.trim()) chain.unsetLink().run();
    else if (editor.state.selection.empty && !isActive) {
      const address = normalizeUrl(url);
      chain.insertContent({ type: "text", text: address, marks: [{ type: "link", attrs: { href: address } }] }).run();
    } else chain.setLink({ href: normalizeUrl(url) }).run();
    setOpen(false);
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={open}>
      <PickerTrigger label="Liên kết" isActive={isActive}>
        <Link />
      </PickerTrigger>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Liên kết" className="w-72 p-3">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            <TextField value={url} onChange={setUrl} autoFocus variant="secondary">
              <Label>Địa chỉ liên kết</Label>
              <Input placeholder="vd: https://congty.vn" />
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
              <Button size="sm" type="submit">
                Áp dụng
              </Button>
            </div>
          </form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
