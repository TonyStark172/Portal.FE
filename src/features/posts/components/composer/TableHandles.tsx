"use client";

import { useEffect, useRef, useState, type CSSProperties, type Key, type ReactNode, type RefObject } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowShapeDownFromLine,
  ArrowShapeLeftFromLine,
  ArrowShapeRightFromLine,
  ArrowShapeUpFromLine,
  ArrowUp,
  ArrowUpToLine,
  ArrowsExpandVertical,
  Ban,
  Copy,
  Ellipsis,
  EllipsisVertical,
  Eraser,
  LayoutCells,
  LayoutCellsLarge,
  LayoutHeader,
  Minus,
  Palette,
  Plus,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  SquareXmark,
  TrashBin,
} from "@gravity-ui/icons";
import { Button, Dropdown, Label, Separator, Tooltip } from "@heroui/react";
import { CellSelection, columnResizingPluginKey, isInTable, selectionCell } from "@tiptap/pm/tables";
import type { SelectionBookmark, Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import type { Editor } from "@tiptap/react";
import { MAX_ROW_HEIGHT, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from "../../editor/extensions";
import { highlightColors } from "../../editor/palette";
import {
  addColumnAtEnd,
  addRowAtEnd,
  duplicateColumn,
  duplicateRow,
  hasSpans,
  isCurrent,
  moveColumn,
  moveRow,
  cellElement,
  placeOf,
  rowHeight,
  selectColumn,
  selectRow,
  setCellAlign,
  setRowHeight,
  type CellPlace,
} from "../../editor/tableCommands";

type Box = { top: number; left: number; width: number; height: number };

/**
 * The table under the mouse: its visible area, the row and the column hovered (the column's visible part, null when it
 * is scrolled out of sight), and where its wrapper ends below (under the sideways scrollbar, if any).
 */
type Hover = CellPlace & { table: Box; rowBox: Box; colBox: Box | null; bottom: number };

/** The cell holding the cursor, or the selected cells: their outline, within the visible part of the table. */
type Current = CellPlace & { box: Box };

/** The narrowest visible part of a column or selection that still gets a handle. */
const MIN_VISIBLE = 16;

function boxOf(element: Element, origin: DOMRect): Box {
  const r = element.getBoundingClientRect();
  return { top: r.top - origin.top, left: r.left - origin.left, width: r.width, height: r.height };
}

/** How far around a table the mouse may go (towards its "+" bars and handles) before they hide. */
const NEAR = 24;

function isNear(cell: HTMLElement, { x, y }: { x: number; y: number }) {
  const r = (cell.closest(".tableWrapper") ?? cell.closest("table")!).getBoundingClientRect();
  return x >= r.left - NEAR && x <= r.right + NEAR && y >= r.top - NEAR && y <= r.bottom + NEAR;
}

/** The part of the table that is visible when it scrolls sideways in its wrapper. */
function visibleTableBox(cell: HTMLElement, origin: DOMRect): Box {
  const table = cell.closest("table")!.getBoundingClientRect();
  const frame = (cell.closest(".tableWrapper") ?? cell.closest("table")!).getBoundingClientRect();
  const left = Math.max(table.left, frame.left);
  const right = Math.min(table.right, frame.right);
  return { top: table.top - origin.top, left: left - origin.left, width: right - left, height: table.height };
}

/**
 * Table controls over the editor, as in Tiptap's table node: a handle on the left of the row and above the column
 * under the mouse (each opens what can be done to that row or column), a handle on the cell holding the cursor, and
 * "+" bars along the bottom and right edges to add a row or a column.
 */
export function TableHandles({ editor, container }: { editor: Editor; container: RefObject<HTMLDivElement | null> }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  // The column whose border Tiptap's resize line is on (hovered or dragged): where the border is, and its width.
  const [column, setColumn] = useState<{ x: number; top: number; px: number } | null>(null);
  const [openMenus, setOpenMenus] = useState(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  // The cell measured last (by its place: ProseMirror may draw its row anew), kept across menus and row drags.
  const hovered = useRef<CellPlace | null>(null);
  const isMenuOpen = openMenus > 0;

  useEffect(() => {
    const frame = container.current;
    if (!frame) return;

    // An observer telling when a table or one of its cells changes size (a column dragged wider, a row dragged taller,
    // a column added…): Tiptap resizes columns in the DOM directly, without an editor update. The cells count too: a
    // table as wide as the editor keeps its size while a column border moves inside it. Measured right away (the
    // observer runs after layout, before paint), so the handles keep up with a border being dragged rather than
    // catching up once the mouse stops.
    const resize = new ResizeObserver(() => {
      measureHover();
      measureCurrent();
      measureColumn();
    });
    const observeTables = () => {
      resize.disconnect();
      editor.view.dom.querySelectorAll("table, th, td").forEach((element) => resize.observe(element));
    };

    const measureHover = () => {
      const last = hovered.current && isCurrent(editor, hovered.current) ? cellElement(editor, hovered.current) : null;
      let cell: HTMLElement | null;
      if (isMenuOpen) {
        // A menu open or a row being dragged: the hovered cell stays the same wherever the mouse goes, but is
        // measured again, as its table may have changed size meanwhile.
        cell = last;
      } else {
        if (!pointer.current) return;
        const target = document.elementFromPoint(pointer.current.x, pointer.current.y);
        // Over a handle or a "+" bar, or just next to the table on the way to one, keep the cell hovered last.
        // Further away, the controls go.
        const keepLast =
          target?.closest("[data-table-control]") != null || (last !== null && isNear(last, pointer.current));
        cell = target?.closest<HTMLElement>("td, th") ?? (keepLast ? last : null);
      }
      const place = cell && editor.view.dom.contains(cell) ? placeOf(editor, cell) : null;
      if (!cell || !place) {
        if (!isMenuOpen) {
          hovered.current = null;
          setHover(null);
        }
        return;
      }
      hovered.current = place;
      const origin = frame.getBoundingClientRect();
      const table = visibleTableBox(cell, origin);
      const cellBox = boxOf(cell, origin);
      // A column partly scrolled out of the wrapper gets its handle over the part still showing.
      const colLeft = Math.max(cellBox.left, table.left);
      const colRight = Math.min(cellBox.left + cellBox.width, table.left + table.width);
      const wrapper = (cell.closest(".tableWrapper") ?? cell.closest("table")!).getBoundingClientRect();
      setHover({
        ...place,
        table,
        rowBox: boxOf(cell.closest("tr")!, origin),
        colBox:
          colRight - colLeft >= MIN_VISIBLE
            ? { top: table.top, left: colLeft, width: colRight - colLeft, height: table.height }
            : null,
        bottom: Math.max(wrapper.bottom - origin.top, table.top + table.height),
      });
    };

    const measureCurrent = () => {
      const { state, view } = editor;
      if (!isInTable(state)) {
        setCurrent(null);
        return;
      }
      const cell = view.nodeDOM(selectionCell(state).pos) as HTMLElement | null;
      const place = cell && placeOf(editor, cell);
      if (!cell || !place) {
        setCurrent(null);
        return;
      }
      // Several cells selected: the handle goes on the outline of them all, not on the last one.
      const cells: HTMLElement[] = [];
      if (state.selection instanceof CellSelection) {
        state.selection.forEachCell((_, pos) => {
          const dom = view.nodeDOM(pos);
          if (dom instanceof HTMLElement) cells.push(dom);
        });
      }
      const rects = (cells.length > 0 ? cells : [cell]).map((c) => c.getBoundingClientRect());
      const origin = frame.getBoundingClientRect();
      const table = visibleTableBox(cell, origin);
      // Clamped to what shows of the table: a wide table scrolls sideways in its wrapper.
      const left = Math.max(Math.min(...rects.map((r) => r.left)) - origin.left, table.left);
      const right = Math.min(Math.max(...rects.map((r) => r.right)) - origin.left, table.left + table.width);
      if (right - left < MIN_VISIBLE) {
        setCurrent(null);
        return;
      }
      const top = Math.min(...rects.map((r) => r.top)) - origin.top;
      const bottom = Math.max(...rects.map((r) => r.bottom)) - origin.top;
      setCurrent({ ...place, box: { top, left, width: right - left, height: bottom - top } });
    };

    const measureColumn = () => {
      const handle = columnResizingPluginKey.getState(editor.state)?.activeHandle ?? -1;
      const cell = handle >= 0 ? editor.view.nodeDOM(handle) : null;
      if (!(cell instanceof HTMLElement)) {
        setColumn(null);
        return;
      }
      const origin = frame.getBoundingClientRect();
      const box = boxOf(cell, origin);
      setColumn({
        x: box.left + box.width,
        top: visibleTableBox(cell, origin).top,
        px: Math.round(cell.getBoundingClientRect().width),
      });
    };

    // At most one measure per frame; what was asked for adds up, so a mouse move never drops a pending measure of the
    // current cell.
    let frameId = 0;
    const pending = { hover: false, current: false };
    function later(what: { hover?: boolean; current?: boolean }) {
      pending.hover ||= what.hover ?? false;
      pending.current ||= what.current ?? false;
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        const { hover, current } = pending;
        pending.hover = pending.current = false;
        if (hover) measureHover();
        if (current) measureCurrent();
      });
    }
    const onMove = (event: MouseEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      if (!isMenuOpen) later({ hover: true });
    };
    const onLeave = () => {
      pointer.current = null;
      if (!isMenuOpen) setHover(null);
    };
    const onScroll = () => later({ hover: true, current: true });
    const onChange = () => {
      observeTables();
      measureCurrent();
      measureHover();
    };

    observeTables();
    // Once more when a menu opens or closes, or a row drag starts or ends.
    later({ hover: true, current: true });
    frame.addEventListener("mousemove", onMove);
    frame.addEventListener("mouseleave", onLeave);
    frame.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    editor.on("selectionUpdate", onChange);
    editor.on("update", onChange);
    editor.on("focus", onChange);
    // Tiptap shows and drags its column resize line through transactions that change nothing in the document.
    editor.on("transaction", measureColumn);
    return () => {
      cancelAnimationFrame(frameId);
      resize.disconnect();
      frame.removeEventListener("mousemove", onMove);
      frame.removeEventListener("mouseleave", onLeave);
      frame.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      editor.off("selectionUpdate", onChange);
      editor.off("update", onChange);
      editor.off("focus", onChange);
      editor.off("transaction", measureColumn);
    };
  }, [container, editor, isMenuOpen]);

  // What was measured goes stale the moment the document changes (rows deleted, text added above the table…);
  // until the next measure, show nothing rather than act on a table that is no longer there.
  const shownHover = hover && isCurrent(editor, hover) ? hover : null;
  const shownCurrent = current && isCurrent(editor, current) ? current : null;

  // A menu counts as open while it shows, so the handles do not move away from under it (a row drag too).
  const onMenu = (open: boolean) => setOpenMenus((n) => Math.max(n + (open ? 1 : -1), 0));

  return (
    // Over the text's scroll area and cut off at its top and bottom, like the text: a table taller than the area
    // shows its controls only where it shows itself. Left and right stay open for the handles beside the table.
    <div className="pointer-events-none absolute inset-0 overflow-x-visible overflow-y-clip">
      {shownHover && (
        <>
          <RowResizer
            key={`${shownHover.tablePos}:${shownHover.row}`}
            editor={editor}
            place={shownHover}
            style={{
              top: shownHover.rowBox.top + shownHover.rowBox.height - 4,
              left: shownHover.table.left,
              width: shownHover.table.width,
            }}
            size={Math.round(shownHover.rowBox.height)}
            onDragChange={onMenu}
          />
          <Control style={{ top: shownHover.rowBox.top, left: shownHover.table.left - 7, height: shownHover.rowBox.height }} className="w-3.5">
            <RowMenu editor={editor} place={shownHover} onOpenChange={onMenu} />
          </Control>
          {shownHover.colBox && (
            <Control style={{ top: shownHover.table.top - 7, left: shownHover.colBox.left, width: shownHover.colBox.width }} className="h-3.5">
              <ColumnMenu editor={editor} place={shownHover} onOpenChange={onMenu} />
            </Control>
          )}
          <ExtendBar
            label="Thêm hàng"
            isDisabled={shownHover.rows >= MAX_TABLE_ROWS}
            style={{ top: shownHover.bottom + 6, left: shownHover.table.left, width: shownHover.table.width }}
            onPress={() => {
              addRowAtEnd(editor, shownHover.tablePos);
              setHover(null);
            }}
          />
          <ExtendBar
            label="Thêm cột"
            isDisabled={shownHover.cols >= MAX_TABLE_COLUMNS}
            style={{ top: shownHover.table.top, left: shownHover.table.left + shownHover.table.width + 4, height: shownHover.table.height }}
            onPress={() => {
              addColumnAtEnd(editor, shownHover.tablePos);
              setHover(null);
            }}
          />
        </>
      )}
      {column && <SizeLabel px={column.px} style={{ left: column.x + 6, top: column.top + 4 }} />}
      {shownCurrent && (editor.isFocused || isMenuOpen) && (
        <Control
          style={{
            top: shownCurrent.box.top + shownCurrent.box.height / 2 - 8,
            left: shownCurrent.box.left + shownCurrent.box.width - 8,
          }}
          className="size-4"
        >
          <CellMenu editor={editor} onOpenChange={onMenu} />
        </Control>
      )}
    </div>
  );
}

/** An absolutely placed control over the editor, centring what it holds. */
function Control({ style, className, children }: { style: CSSProperties; className: string; children: ReactNode }) {
  return (
    <div
      data-table-control
      style={style}
      className={`pointer-events-auto absolute z-20 flex items-center justify-center ${className}`}
    >
      {children}
    </div>
  );
}

const handleBase = "min-w-0 rounded-full p-0 shadow-sm";

/** Row and column handles: light pills on the table's border, accent while their menu is open. */
const handleClass = `${handleBase} border border-border bg-overlay text-muted hover:bg-default hover:text-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground`;

/** The selected cells' handle: a plain accent dot, ringed with the page colour to stand out on any cell colour. */
const accentHandleClass = `${handleBase} border-2 border-overlay bg-accent hover:scale-125 hover:bg-accent-hover transition-transform`;

/** A thin bar along an edge of the table; hovering shows "+". Disabled once the table is as big as it may be. */
function ExtendBar({ label, isDisabled, style, onPress }: {
  label: string;
  isDisabled: boolean;
  style: CSSProperties;
  onPress: () => void;
}) {
  const isRow = style.width !== undefined;
  return (
    <div data-table-control style={style} className={`pointer-events-auto absolute z-10 ${isRow ? "h-3.5" : "w-3.5"}`}>
      <Tooltip delay={300}>
        <Button
          aria-label={label}
          isDisabled={isDisabled}
          onPress={onPress}
          className="size-full min-w-0 rounded-md bg-default/70 p-0 text-muted opacity-60 transition hover:bg-accent-soft hover:text-accent hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
        >
          <Plus className="size-3" />
        </Button>
        <Tooltip.Content>{label}</Tooltip.Content>
      </Tooltip>
    </div>
  );
}

/** The <tr> showing a row of the table at a position. */
function rowElement(editor: Editor, tablePos: number, row: number) {
  const dom = editor.view.nodeDOM(tablePos);
  if (!(dom instanceof HTMLElement)) return null;
  const table = dom instanceof HTMLTableElement ? dom : dom.querySelector("table");
  return table?.rows[row] ?? null;
}

/**
 * The bottom border of the hovered row, dragged to make the row taller (as in Google Docs). The row follows the mouse
 * through the document (ProseMirror redraws a row whose DOM is changed behind its back), outside the undo history;
 * on release the drag becomes one undo step. Dragged no taller than its content, the row goes back to fitting it.
 * The bar itself stays on the border because the hovered row is measured again as it grows.
 */
function RowResizer({ editor, place, style, size, onDragChange }: {
  editor: Editor;
  place: CellPlace;
  style: CSSProperties;
  /** The row's height, shown while the bar is hovered or dragged. */
  size: number;
  onDragChange: (dragging: boolean) => void;
}) {
  const [isDragging, setDragging] = useState(false);
  const [isHovered, setHovered] = useState(false);
  const drag = useRef<{
    place: CellPlace;
    startY: number;
    startHeight: number;
    original: number | null;
    height: number;
  } | null>(null);

  const shownHeight = (p: CellPlace) => rowElement(editor, p.tablePos, p.row)?.getBoundingClientRect().height ?? 0;

  const finish = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const { tablePos, row } = d.place;
    // The row without a height is as tall as its content: dragged no taller than that, it keeps fitting its content.
    setRowHeight(editor, tablePos, row, null, false);
    const natural = shownHeight(d.place);
    const height = d.height > natural + 1 ? Math.round(d.height) : null;
    // Back to where the drag started, then one step to where it ended: that step is what undo takes back.
    setRowHeight(editor, tablePos, row, d.original, false);
    if (height !== d.original) setRowHeight(editor, tablePos, row, height);
    setDragging(false);
    onDragChange(false);
  };

  return (
    <div
      data-table-control
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Kéo để đổi chiều cao hàng ${place.row + 1}`}
      style={style}
      className="group pointer-events-auto absolute z-10 h-2 cursor-row-resize touch-none"
      onPointerDown={(event) => {
        if (event.button !== 0 || !rowElement(editor, place.tablePos, place.row)) return;
        // Also keeps the mouse events that follow from reaching the editor (no text or cell selection while dragging).
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const height = shownHeight(place);
        drag.current = {
          place,
          startY: event.clientY,
          startHeight: height,
          original: rowHeight(editor, place.tablePos, place.row),
          height,
        };
        setDragging(true);
        onDragChange(true);
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        // No further than the tallest a row may be: past it, the border waits for the mouse to come back.
        d.height = Math.min(Math.max(d.startHeight + event.clientY - d.startY, 1), MAX_ROW_HEIGHT);
        setRowHeight(editor, d.place.tablePos, d.place.row, Math.round(d.height), false);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        data-resize-line
        className={`mt-[3px] h-0.5 bg-accent transition-opacity ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      />
      {(isDragging || isHovered) && <SizeLabel px={size} className="right-1 bottom-full mb-1" />}
    </div>
  );
}

/**
 * The size a resize line stands at ("120 px"), as Google Docs shows it, so columns or rows can be given the same
 * size by eye.
 */
function SizeLabel({ px, className = "", style }: { px: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      data-resize-size
      style={style}
      className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[11px] leading-4 font-medium text-background tabular-nums shadow-sm ${className}`}
    >
      {px} px
    </span>
  );
}

/** Runs the action of a menu key; the submenu triggers (background, alignment) have none. */
function runAction(key: Key, actions: Record<string, () => unknown>) {
  actions[String(key)]?.();
}

type MenuItem = { id: string; label: string; icon: ReactNode; isDisabled?: boolean; isDanger?: boolean };

function itemsOf(items: (MenuItem | false)[]) {
  return items.filter((item): item is MenuItem => item !== false);
}

function MenuItems({ items }: { items: MenuItem[] }) {
  return items.map((item) => (
    <Dropdown.Item
      key={item.id}
      id={item.id}
      textValue={item.label}
      isDisabled={item.isDisabled}
      variant={item.isDanger ? "danger" : undefined}
    >
      <span aria-hidden className="text-muted [&_svg]:size-4">
        {item.icon}
      </span>
      <Label>{item.label}</Label>
    </Dropdown.Item>
  ));
}

function RowMenu({ editor, place, onOpenChange }: { editor: Editor; place: CellPlace; onOpenChange: (open: boolean) => void }) {
  const { tablePos, row, rows } = place;
  // As many rows as a table may have: none can be added.
  const full = rows >= MAX_TABLE_ROWS;
  const spans = hasSpans(editor, tablePos);
  const chain = () => editor.chain().focus();
  const run = (key: Key) =>
    runAction(key, {
      header: () => chain().toggleHeaderRow().run(),
      above: () => chain().addRowBefore().run(),
      below: () => chain().addRowAfter().run(),
      up: () => moveRow(editor, tablePos, row, row - 1),
      down: () => moveRow(editor, tablePos, row, row + 1),
      duplicate: () => duplicateRow(editor, tablePos, row),
      autoHeight: () => setRowHeight(editor, tablePos, row, null),
      clear: () => chain().deleteSelection().run(),
      delete: () => chain().deleteRow().run(),
      deleteTable: () => chain().deleteTable().run(),
    });

  return (
    <HandleMenu
      label={`Hàng ${row + 1}`}
      icon={<EllipsisVertical className="size-3" />}
      className="h-6 w-3.5"
      onOpen={() => selectRow(editor, tablePos, row)}
      formatsWhat="hàng"
      onOpenChange={onOpenChange}
      onAction={run}
      editor={editor}
      top={itemsOf([
        row === 0 && { id: "header", label: "Hàng tiêu đề", icon: <LayoutHeader /> },
        { id: "above", label: "Thêm hàng phía trên", icon: <ArrowShapeUpFromLine />, isDisabled: full },
        { id: "below", label: "Thêm hàng phía dưới", icon: <ArrowShapeDownFromLine />, isDisabled: full },
        { id: "up", label: "Di chuyển lên", icon: <ArrowUp />, isDisabled: row === 0 || spans },
        { id: "down", label: "Di chuyển xuống", icon: <ArrowDown />, isDisabled: row === rows - 1 || spans },
        { id: "duplicate", label: "Nhân bản hàng", icon: <Copy />, isDisabled: spans || full },
        {
          id: "autoHeight",
          label: "Chiều cao tự động",
          icon: <ArrowsExpandVertical />,
          isDisabled: rowHeight(editor, tablePos, row) === null,
        },
      ])}
      bottom={[
        { id: "clear", label: "Xoá nội dung hàng", icon: <Eraser /> },
        { id: "delete", label: "Xoá hàng", icon: <TrashBin />, isDanger: true },
        { id: "deleteTable", label: "Xoá bảng", icon: <SquareXmark />, isDanger: true },
      ]}
    />
  );
}

function ColumnMenu({ editor, place, onOpenChange }: { editor: Editor; place: CellPlace; onOpenChange: (open: boolean) => void }) {
  const { tablePos, col, cols } = place;
  // As many columns as a table may have: none can be added.
  const full = cols >= MAX_TABLE_COLUMNS;
  const spans = hasSpans(editor, tablePos);
  const chain = () => editor.chain().focus();
  const run = (key: Key) =>
    runAction(key, {
      header: () => chain().toggleHeaderColumn().run(),
      left: () => chain().addColumnBefore().run(),
      right: () => chain().addColumnAfter().run(),
      moveLeft: () => moveColumn(editor, tablePos, col, col - 1),
      moveRight: () => moveColumn(editor, tablePos, col, col + 1),
      duplicate: () => duplicateColumn(editor, tablePos, col),
      clear: () => chain().deleteSelection().run(),
      delete: () => chain().deleteColumn().run(),
      deleteTable: () => chain().deleteTable().run(),
    });

  return (
    <HandleMenu
      label={`Cột ${col + 1}`}
      icon={<Ellipsis className="size-3" />}
      className="h-3.5 w-6"
      onOpen={() => selectColumn(editor, tablePos, col)}
      formatsWhat="cột"
      onOpenChange={onOpenChange}
      onAction={run}
      editor={editor}
      top={itemsOf([
        col === 0 && { id: "header", label: "Cột tiêu đề", icon: <LayoutHeader className="-rotate-90" /> },
        { id: "left", label: "Thêm cột bên trái", icon: <ArrowShapeLeftFromLine />, isDisabled: full },
        { id: "right", label: "Thêm cột bên phải", icon: <ArrowShapeRightFromLine />, isDisabled: full },
        { id: "moveLeft", label: "Di chuyển sang trái", icon: <ArrowLeft />, isDisabled: col === 0 || spans },
        { id: "moveRight", label: "Di chuyển sang phải", icon: <ArrowRight />, isDisabled: col === cols - 1 || spans },
        { id: "duplicate", label: "Nhân bản cột", icon: <Copy />, isDisabled: spans || full },
      ])}
      bottom={[
        { id: "clear", label: "Xoá nội dung cột", icon: <Eraser /> },
        { id: "delete", label: "Xoá cột", icon: <TrashBin />, isDanger: true },
        { id: "deleteTable", label: "Xoá bảng", icon: <SquareXmark />, isDanger: true },
      ]}
    />
  );
}

function CellMenu({ editor, onOpenChange }: { editor: Editor; onOpenChange: (open: boolean) => void }) {
  const chain = () => editor.chain().focus();
  const run = (key: Key) =>
    runAction(key, {
      merge: () => chain().mergeCells().run(),
      split: () => chain().splitCell().run(),
      clear: () => chain().deleteSelection().run(),
    });

  return (
    <HandleMenu
      label="Ô đang chọn"
      icon={null}
      className="size-4"
      accent
      onOpenChange={onOpenChange}
      onAction={run}
      editor={editor}
      top={[]}
      bottom={[
        { id: "merge", label: "Gộp ô đã chọn", icon: <LayoutCellsLarge />, isDisabled: !editor.can().mergeCells() },
        { id: "split", label: "Tách ô", icon: <LayoutCells />, isDisabled: !editor.can().splitCell() },
        { id: "clear", label: "Xoá nội dung", icon: <Eraser /> },
      ]}
    />
  );
}

type HandleMenuProps = {
  label: string;
  icon: ReactNode;
  className: string;
  /** The selected cell's look rather than a row or column handle's. */
  accent?: boolean;
  editor: Editor;
  /**
   * Selects what the menu acts on, before it opens. The cursor goes back where it was when the menu closes, so the
   * row or column does not stay selected (what the cell's menu does next would apply to all of it).
   */
  onOpen?: () => void;
  /** What "Màu nền" and "Căn lề" apply to ("hàng", "cột"), when not the selected cells. */
  formatsWhat?: string;
  onOpenChange: (open: boolean) => void;
  onAction: (key: Key) => void;
  top: MenuItem[];
  bottom: MenuItem[];
};

/** A handle and its menu: the given actions, then the selected cells' background colour and alignment. */
function HandleMenu(props: HandleMenuProps) {
  const { label, icon, className, accent = false, editor, onOpen, formatsWhat, onOpenChange, onAction, top, bottom } = props;
  // The cursor when the menu opened, mapped through what the menu then changes (rows added, moved, deleted…).
  const cursor = useRef<{ bookmark: SelectionBookmark; mapping: Mapping; stop: () => void } | null>(null);

  const keepCursor = () => {
    const mapping = new Mapping();
    const track = ({ transaction }: { transaction: Transaction }) => mapping.appendMapping(transaction.mapping);
    editor.on("transaction", track);
    cursor.current = { bookmark: editor.state.selection.getBookmark(), mapping, stop: () => editor.off("transaction", track) };
  };

  const giveCursorBack = () => {
    const kept = cursor.current;
    if (!kept) return;
    kept.stop();
    cursor.current = null;
    editor.view.dispatch(editor.state.tr.setSelection(kept.bookmark.map(kept.mapping).resolve(editor.state.doc)));
  };

  return (
    <Dropdown
      onOpenChange={(open) => {
        if (open && onOpen) {
          keepCursor();
          onOpen();
        }
        if (!open) giveCursorBack();
        onOpenChange(open);
      }}
    >
      <Button aria-label={`${label}: tuỳ chọn`} className={`${accent ? accentHandleClass : handleClass} ${className}`}>
        {icon}
      </Button>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu aria-label={label} onAction={onAction}>
          {top.length > 0 && (
            <Dropdown.Section>
              <MenuItems items={top} />
            </Dropdown.Section>
          )}
          {top.length > 0 && <Separator />}
          <Dropdown.Section>
            <CellFormatSubmenus editor={editor} what={formatsWhat} />
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section>
            <MenuItems items={bottom} />
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const aligns = [
  { value: "left", label: "Căn trái", icon: <TextAlignLeft /> },
  { value: "center", label: "Căn giữa", icon: <TextAlignCenter /> },
  { value: "right", label: "Căn phải", icon: <TextAlignRight /> },
];

const vAligns = [
  { value: "top", label: "Căn trên", icon: <ArrowUpToLine /> },
  { value: "middle", label: "Căn giữa theo chiều dọc", icon: <Minus /> },
  { value: "bottom", label: "Căn dưới", icon: <ArrowDownToLine /> },
];

/** "Màu nền ▸" and "Căn lề ▸" for the selected cells (the defaults — no colour, left, top — store nothing). */
function CellFormatSubmenus({ editor, what }: { editor: Editor; what?: string }) {
  const named = (label: string) => (what ? `${label} ${what}` : label);
  const cell = editor.isActive("tableHeader") ? editor.getAttributes("tableHeader") : editor.getAttributes("tableCell");
  const set = (name: "background" | "valign", value: string | null) =>
    editor.chain().focus().setCellAttribute(name, value).run();

  return (
    <>
      <Dropdown.SubmenuTrigger>
        <Dropdown.Item id="background" textValue={named("Màu nền")}>
          <span aria-hidden className="text-muted [&_svg]:size-4">
            <Palette />
          </span>
          <Label>{named("Màu nền")}</Label>
          <Dropdown.SubmenuIndicator />
        </Dropdown.Item>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label="Màu nền"
            selectionMode="single"
            selectedKeys={[(cell.background as string | null) ?? "none"]}
            onAction={(key: Key) => set("background", key === "none" ? null : String(key))}
          >
            <Dropdown.Item id="none" textValue="Không màu">
              <span aria-hidden className="text-muted [&_svg]:size-4">
                <Ban />
              </span>
              <Label>Không màu</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
            {highlightColors.map((color) => (
              <Dropdown.Item key={color.name} id={color.name} textValue={color.label}>
                <span
                  aria-hidden
                  className="size-4 rounded-full border border-black/10 dark:border-white/15"
                  style={{ background: `var(--post-mark-${color.name})` }}
                />
                <Label>{color.label}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.SubmenuTrigger>
      <Dropdown.SubmenuTrigger>
        <Dropdown.Item id="alignment" textValue={named("Căn lề")}>
          <span aria-hidden className="text-muted [&_svg]:size-4">
            <TextAlignLeft />
          </span>
          <Label>{named("Căn lề")}</Label>
          <Dropdown.SubmenuIndicator />
        </Dropdown.Item>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label="Căn lề"
            selectionMode="multiple"
            selectedKeys={[(cell.align as string | null) ?? "left", (cell.valign as string | null) ?? "top"]}
            onAction={(key: Key) => {
              const value = String(key);
              if (aligns.some((a) => a.value === value)) setCellAlign(editor, value === "left" ? null : value);
              else set("valign", value === "top" ? null : value);
            }}
          >
            <Dropdown.Section>
              {aligns.map((a) => (
                <Dropdown.Item key={a.value} id={a.value} textValue={a.label}>
                  <span aria-hidden className="text-muted [&_svg]:size-4">
                    {a.icon}
                  </span>
                  <Label>{a.label}</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
            <Separator />
            <Dropdown.Section>
              {vAligns.map((a) => (
                <Dropdown.Item key={a.value} id={a.value} textValue={a.label}>
                  <span aria-hidden className="text-muted [&_svg]:size-4">
                    {a.icon}
                  </span>
                  <Label>{a.label}</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.SubmenuTrigger>
    </>
  );
}
