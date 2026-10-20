"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LayoutCells } from "@gravity-ui/icons";
import { Button, Popover, Tooltip } from "@heroui/react";
import type { Editor } from "@tiptap/react";

const GRID = 8;

/**
 * "Chèn bảng": hover (or move with the arrow keys over) a grid to choose the size, click (or Enter) to insert a
 * table whose first row is the header, as in Word or Google Docs.
 */
export function TableInsert({ editor, isDisabled }: { editor: Editor; isDisabled: boolean }) {
  const [isOpen, setOpen] = useState(false);
  const [size, setSize] = useState({ rows: 3, cols: 3 });
  const cells = useRef<(HTMLButtonElement | null)[]>([]);

  // Once the popover is open (set up as a child of any popover around it), the keyboard starts on 3 × 3.
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => cells.current[2 * GRID + 2]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  function insert(rows: number, cols: number) {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
  }

  function move(event: KeyboardEvent, row: number, col: number) {
    const next = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    const [rows, cols] = next.map((n) => Math.min(Math.max(n, 1), GRID));
    setSize({ rows, cols });
    cells.current[(rows - 1) * GRID + cols - 1]?.focus();
  }

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) setSize({ rows: 3, cols: 3 });
        setOpen(open);
      }}
    >
      <Tooltip delay={400}>
        <Button isIconOnly size="sm" variant="ghost" aria-label="Chèn bảng" isDisabled={isDisabled} className="rounded-lg">
          <LayoutCells className="size-4" />
        </Button>
        <Tooltip.Content>Chèn bảng</Tooltip.Content>
      </Tooltip>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Chèn bảng" className="p-2">
          <div role="group" aria-label="Kích thước bảng" className="grid grid-cols-[repeat(8,1.25rem)] gap-1">
            {Array.from({ length: GRID * GRID }, (_, i) => {
              const row = Math.floor(i / GRID) + 1;
              const col = (i % GRID) + 1;
              const isInside = row <= size.rows && col <= size.cols;
              const isFocusable = row === size.rows && col === size.cols;
              return (
                <button
                  key={i}
                  ref={(element) => {
                    cells.current[i] = element;
                  }}
                  type="button"
                  // No autoFocus: focusing a cell before the popover is set up would close a popover around this
                  // one (the toolbar's "⋮"); the effect above focuses 3 × 3 once it is open.
                  tabIndex={isFocusable ? 0 : -1}
                  aria-label={`${row} hàng × ${col} cột`}
                  onMouseEnter={() => setSize({ rows: row, cols: col })}
                  onFocus={() => setSize({ rows: row, cols: col })}
                  onKeyDown={(event) => move(event, row, col)}
                  onClick={() => insert(row, col)}
                  className={`size-5 rounded-[4px] border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                    isInside ? "border-accent bg-accent-soft" : "border-border bg-transparent"
                  }`}
                />
              );
            })}
          </div>
          <p aria-live="polite" className="mt-2 text-center text-xs font-medium text-muted tabular-nums">
            {size.rows} × {size.cols}
          </p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
