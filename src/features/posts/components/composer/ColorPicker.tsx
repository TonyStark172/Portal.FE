"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "@gravity-ui/icons";
import { Button, Popover, Tooltip } from "@heroui/react";
import { highlightColors, textColors } from "../../editor/palette";

type Kind = "text" | "highlight";
type Used = { kind: Kind; name: string };

const kinds = {
  text: { title: "Màu chữ", colors: textColors as readonly { name: string; label: string }[], none: "Mặc định" },
  highlight: { title: "Màu nền chữ", colors: highlightColors as readonly { name: string; label: string }[], none: "Không tô" },
};

const RECENT_KEY = "portal.composer.recentColors";
const MAX_RECENT = 5;

/** The colours this viewer used last (a convenience kept in this browser only; empty without storage). */
function readRecent(): Used[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (used): used is Used =>
        (used?.kind === "text" || used?.kind === "highlight") && kinds[used.kind as Kind].colors.some((c) => c.name === used.name),
    );
  } catch {
    return [];
  }
}

function remember(used: Used) {
  try {
    const recent = [used, ...readRecent().filter((r) => r.kind !== used.kind || r.name !== used.name)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // No storage: nothing is remembered.
  }
}

const labelOf = (kind: Kind, name: string | null) =>
  `${kinds[kind].title}: ${name === null ? kinds[kind].none : kinds[kind].colors.find((c) => c.name === name)?.label}`;

/**
 * Text colour and highlight in one button, as in Tiptap's editor: the "A" on it shows both in use; its popover has
 * the colours used last, then the text colours and the highlights, each row starting with the way back to none.
 */
export function ColorPicker({ textColor, highlight, onTextColor, onHighlight }: {
  textColor: string | null;
  highlight: string | null;
  onTextColor: (value: string | null) => void;
  onHighlight: (value: string | null) => void;
}) {
  const [isOpen, setOpen] = useState(false);
  // Read when the popover opens (not while rendering on the server).
  const [recent, setRecent] = useState<Used[]>([]);
  const current = { text: textColor, highlight };

  function apply(kind: Kind, name: string | null) {
    (kind === "text" ? onTextColor : onHighlight)(name);
    if (name) remember({ kind, name });
    setOpen(false);
  }

  const swatch = (kind: Kind, name: string | null) => (
    <Swatch
      key={`${kind}:${name}`}
      kind={kind}
      name={name}
      label={labelOf(kind, name)}
      // Only a colour shows as in use: the default text colour and no highlight are simply what there is otherwise.
      isCurrent={name !== null && current[kind] === name}
      onPress={() => apply(kind, name)}
    />
  );

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) setRecent(readRecent());
        setOpen(open);
      }}
    >
      <Tooltip delay={400}>
        <Button size="sm" variant="ghost" aria-label="Màu" className="min-w-0 gap-1.5 rounded-lg px-2">
          <span
            data-color-preview
            style={{
              color: textColor ? `var(--post-${textColor})` : undefined,
              background: highlight ? `var(--post-mark-${highlight})` : undefined,
            }}
            className="flex size-5 items-center justify-center rounded-full border border-black/15 text-[12px] leading-none font-semibold dark:border-white/20"
          >
            A
          </span>
          <ChevronDown aria-hidden className="size-3 text-muted" />
        </Button>
        <Tooltip.Content>Màu</Tooltip.Content>
      </Tooltip>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Màu" className="flex w-max flex-col gap-3 p-3">
          {recent.length > 0 && (
            <Section title="Dùng gần đây">{recent.map((used) => swatch(used.kind, used.name))}</Section>
          )}
          <Section title={kinds.text.title}>
            {[null, ...kinds.text.colors.map((c) => c.name)].map((name) => swatch("text", name))}
          </Section>
          <Section title={kinds.highlight.title}>
            {[null, ...kinds.highlight.colors.map((c) => c.name)].map((name) => swatch("highlight", name))}
          </Section>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-5 gap-1">{children}</div>
    </div>
  );
}

/**
 * A text colour: a coloured "A" in a ring; a highlight: a filled dot. "None" is a plain A, or a plain dot. The colour in use
 * sits on a light grey square, as in Tiptap's picker.
 */
function Swatch({ kind, name, label, isCurrent, onPress }: {
  kind: Kind;
  name: string | null;
  label: string;
  isCurrent: boolean;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={300}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={isCurrent}
        onClick={onPress}
        className="flex size-8 items-center justify-center rounded-lg outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-default"
      >
        {kind === "text" ? (
          <span
            style={{
              color: name ? `var(--post-${name})` : "var(--foreground)",
              borderColor: name ? "color-mix(in oklab, currentColor 45%, transparent)" : "transparent",
            }}
            className="flex size-6 items-center justify-center rounded-full border text-[13px] leading-none font-semibold"
          >
            A
          </span>
        ) : (
          // A pale dot ringed with a deeper shade of itself; no highlight is a plain dot of the page colour.
          <span
            style={
              name
                ? {
                    background: `var(--post-mark-${name})`,
                    borderColor: `color-mix(in oklab, var(--post-mark-${name}), var(--foreground) 22%)`,
                  }
                : undefined
            }
            className={`size-6 rounded-full border ${name ? "" : "border-border bg-overlay"}`}
          />
        )}
      </button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
