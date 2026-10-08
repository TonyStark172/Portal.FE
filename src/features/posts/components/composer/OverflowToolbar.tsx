"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical } from "@gravity-ui/icons";
import { Button, Popover, Separator, Tooltip } from "@heroui/react";

/** A group of tools: a plain list, or a list with a priority (higher stays in the row longer; 0 by default). */
export type ToolGroup = ReactNode[] | { tools: ReactNode[]; priority?: number };

type Entry = { kind: "tool"; node: ReactNode; priority: number; group: number } | { kind: "divider"; group: number };

/** The groups' tools in order, each group after the first opened by a divider. */
function entriesOf(groups: ToolGroup[]): Entry[] {
  return groups.flatMap((group, g) => {
    const { tools, priority = 0 } = Array.isArray(group) ? { tools: group } : group;
    return [
      ...(g > 0 ? [{ kind: "divider" as const, group: g }] : []),
      ...tools.map((node) => ({ kind: "tool" as const, node, priority, group: g })),
    ];
  });
}

/**
 * The positions (in `entries`) to draw, in order: the tools `isShown` keeps, with a divider only between two groups
 * that both still have tools there.
 */
function arrange(entries: Entry[], isShown: (index: number) => boolean) {
  const positions: number[] = [];
  let lastGroup: number | null = null;
  entries.forEach((entry, index) => {
    if (entry.kind !== "tool" || !isShown(index)) return;
    if (lastGroup !== null && entry.group !== lastGroup) {
      positions.push(entries.findIndex((e) => e.kind === "divider" && e.group === entry.group));
    }
    positions.push(index);
    lastGroup = entry.group;
  });
  return positions;
}

const GAP = 2; // gap-0.5
const MORE_WIDTH = 32; // the ⋮ button (size-8)

/**
 * A toolbar on one line, as in Tiptap's editor: the tools that fit stay in the row, the rest go under a "⋮" button
 * at its end, followed by the `more` groups, which are always there (tools used less often). When room runs out,
 * the lowest-priority tools go first (the rightmost of them first); the row keeps its order. Each tool's width is
 * measured once, while the whole row shows, and the split is worked out again whenever the toolbar changes width.
 */
export function OverflowToolbar({ label, groups, more = [] }: { label: string; groups: ToolGroup[]; more?: ToolGroup[] }) {
  const entries = entriesOf(groups);
  const moreEntries = entriesOf(more);
  const hasMore = moreEntries.length > 0;
  const row = useRef<HTMLDivElement>(null);
  const widths = useRef<number[]>([]);
  // The tools under ⋮ (null: not measured yet, so all show, out of sight).
  const [hidden, setHidden] = useState<number[] | null>(null);
  // What the measuring depends on: the tools and their priorities (not the tools' state).
  const layout = entries.map((e) => (e.kind === "tool" ? e.priority : "|")).join(",");

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const all = entriesOf(groups);

    const fit = () => {
      // Entries in the row now: their width as drawn (the first time, all of them).
      element.querySelectorAll<HTMLElement>("[data-entry]").forEach((entry) => {
        widths.current[Number(entry.dataset.entry)] = entry.offsetWidth;
      });
      const available = element.clientWidth;
      const rowWidth = (positions: number[]) =>
        positions.reduce((sum, p) => sum + (widths.current[p] ?? 0), 0) + GAP * Math.max(positions.length - 1, 0);

      // Lowest priority first, and among equals the rightmost first.
      const order = all
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.kind === "tool")
        .sort((a, b) => (a.entry.kind === "tool" && b.entry.kind === "tool" ? a.entry.priority - b.entry.priority : 0) || b.index - a.index)
        .map(({ index }) => index);

      const off = new Set<number>();
      const fits = () => {
        const needsMore = hasMore || off.size > 0;
        return rowWidth(arrange(all, (i) => !off.has(i))) + (needsMore ? GAP + MORE_WIDTH : 0) <= available;
      };
      for (const index of order) {
        if (fits()) break;
        off.add(index);
      }
      setHidden([...off].sort((a, b) => a - b));
    };

    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
    // `groups` changes on every render (new elements); what matters for the split is `layout`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, hasMore]);

  const off = new Set(hidden ?? []);
  const inRow = arrange(entries, (i) => !off.has(i));
  const underMore = arrange(entries, (i) => off.has(i));
  const moreShown = arrange(moreEntries, () => true);

  const render = (entry: Entry) =>
    entry.kind === "divider" ? <Separator orientation="vertical" className="mx-1 h-5" /> : entry.node;

  return (
    <div
      ref={row}
      role="toolbar"
      aria-label={label}
      className={`flex flex-nowrap items-center gap-0.5 overflow-hidden ${hidden === null ? "invisible" : ""}`}
    >
      {inRow.map((position) => (
        <div key={position} data-entry={position} className="flex shrink-0 items-center">
          {render(entries[position])}
        </div>
      ))}
      {(underMore.length > 0 || moreShown.length > 0) && (
        <Popover>
          <Tooltip delay={400}>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Thêm công cụ" className="ms-auto shrink-0 rounded-lg">
              <EllipsisVertical className="size-4" />
            </Button>
            <Tooltip.Content>Thêm công cụ</Tooltip.Content>
          </Tooltip>
          <Popover.Content placement="bottom end">
            <Popover.Dialog aria-label="Công cụ khác" className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-0.5 p-1">
              {underMore.map((position) => (
                <Fragment key={position}>{render(entries[position])}</Fragment>
              ))}
              {underMore.length > 0 && moreShown.length > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
              {moreShown.map((position) => (
                <Fragment key={`more-${position}`}>{render(moreEntries[position])}</Fragment>
              ))}
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      )}
    </div>
  );
}
