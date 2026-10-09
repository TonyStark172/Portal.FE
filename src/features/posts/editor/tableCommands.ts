import { CellSelection, isInTable, moveTableColumn, moveTableRow, selectionCell, TableMap } from "@tiptap/pm/tables";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { MAX_ROW_HEIGHT } from "./extensions";

/** Where a cell sits: its table (position in the document) and its row and column. */
export type CellPlace = { tablePos: number; row: number; col: number; rows: number; cols: number };

/**
 * The table at a position, or null when there is none any more: a position remembered from the mouse goes stale
 * as soon as the text above changes or the table is deleted.
 */
function tableAt(editor: Editor, tablePos: number) {
  const table = tablePos >= 0 && tablePos < editor.state.doc.content.size ? editor.state.doc.nodeAt(tablePos) : null;
  if (table?.type.spec.tableRole !== "table") return null;
  return { table, map: TableMap.get(table), start: tablePos + 1 };
}

/** Whether a remembered cell still exists: same table, row and column still there. */
export function isCurrent(editor: Editor, place: CellPlace) {
  const found = tableAt(editor, place.tablePos);
  return found !== null && place.row < found.map.height && place.col < found.map.width;
}

/** The table cell a DOM element (td/th) shows, or null outside a table. */
export function placeOf(editor: Editor, element: HTMLElement): CellPlace | null {
  const $pos = editor.state.doc.resolve(editor.view.posAtDOM(element, 0));
  for (let depth = $pos.depth; depth > 1; depth--) {
    const role = $pos.node(depth).type.spec.tableRole;
    if (role !== "cell" && role !== "header_cell") continue;
    const tablePos = $pos.before(depth - 2);
    const found = tableAt(editor, tablePos);
    if (!found) return null;
    const rect = found.map.findCell($pos.before(depth) - found.start);
    return { tablePos, row: rect.top, col: rect.left, rows: found.map.height, cols: found.map.width };
  }
  return null;
}

/** The td/th showing a cell, found again from its place (ProseMirror may have drawn the row anew). */
export function cellElement(editor: Editor, place: CellPlace): HTMLElement | null {
  const found = tableAt(editor, place.tablePos);
  if (!found || place.row >= found.map.height || place.col >= found.map.width) return null;
  const dom = editor.view.nodeDOM(found.start + found.map.positionAt(place.row, place.col, found.table));
  return dom instanceof HTMLElement ? dom : null;
}

/** Whether some cell spans several rows or columns (moving or copying a row or column then has no clear meaning). */
export function hasSpans(editor: Editor, tablePos: number) {
  let spans = false;
  tableAt(editor, tablePos)?.table.descendants((node) => {
    if ((node.attrs.colspan ?? 1) > 1 || (node.attrs.rowspan ?? 1) > 1) spans = true;
    return !spans;
  });
  return spans;
}

function selectCells(editor: Editor, tablePos: number, [r1, c1]: [number, number], [r2, c2]: [number, number]) {
  const found = tableAt(editor, tablePos);
  if (!found) return false;
  const { table, map, start } = found;
  const { doc, tr } = editor.state;
  const anchor = doc.resolve(start + map.positionAt(r1, c1, table));
  const head = doc.resolve(start + map.positionAt(r2, c2, table));
  editor.view.dispatch(tr.setSelection(new CellSelection(anchor, head)));
  return true;
}

/** Selects a whole row, so the table commands (add, delete, colour…) act on it. */
export function selectRow(editor: Editor, tablePos: number, row: number) {
  const found = tableAt(editor, tablePos);
  if (found && row < found.map.height) selectCells(editor, tablePos, [row, 0], [row, found.map.width - 1]);
}

export function selectColumn(editor: Editor, tablePos: number, col: number) {
  const found = tableAt(editor, tablePos);
  if (found && col < found.map.width) selectCells(editor, tablePos, [0, col], [found.map.height - 1, col]);
}

export function moveRow(editor: Editor, tablePos: number, from: number, to: number) {
  if (!tableAt(editor, tablePos)) return;
  moveTableRow({ from, to, pos: tablePos + 1 })(editor.state, editor.view.dispatch);
  editor.view.focus();
}

export function moveColumn(editor: Editor, tablePos: number, from: number, to: number) {
  if (!tableAt(editor, tablePos)) return;
  moveTableColumn({ from, to, pos: tablePos + 1 })(editor.state, editor.view.dispatch);
  editor.view.focus();
}

/** Position of a row in the document. */
function rowPos(found: NonNullable<ReturnType<typeof tableAt>>, row: number) {
  let pos = found.start;
  for (let i = 0; i < row; i++) pos += found.table.child(i).nodeSize;
  return pos;
}

/** The height a row was dragged to, or null when it is as tall as its content. */
export function rowHeight(editor: Editor, tablePos: number, row: number): number | null {
  const found = tableAt(editor, tablePos);
  if (!found || row >= found.table.childCount) return null;
  return (found.table.child(row).attrs.height as number | null) ?? null;
}

/**
 * Sets a row's height in pixels, at most MAX_ROW_HEIGHT (null: back to the height of its content). While a border is
 * being dragged, the steps stay out of the undo history (addToHistory false), so that undoing a drag takes one step.
 */
export function setRowHeight(editor: Editor, tablePos: number, row: number, height: number | null, addToHistory = true) {
  const found = tableAt(editor, tablePos);
  if (!found || row >= found.table.childCount) return;
  const capped = height === null ? null : Math.min(height, MAX_ROW_HEIGHT);
  const tr = editor.state.tr.setNodeAttribute(rowPos(found, row), "height", capped);
  if (!addToHistory) tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/** Inserts a copy of the row below it. */
export function duplicateRow(editor: Editor, tablePos: number, row: number) {
  const found = tableAt(editor, tablePos);
  if (!found || row >= found.table.childCount) return;
  let pos = found.start;
  for (let i = 0; i <= row; i++) pos += found.table.child(i).nodeSize;
  const copy = found.table.child(row);
  editor.view.dispatch(editor.state.tr.insert(pos, copy.type.create(copy.attrs, copy.content)));
  editor.view.focus();
}

/** Inserts a copy of the column on its right (tables without merged cells). */
export function duplicateColumn(editor: Editor, tablePos: number, col: number) {
  const found = tableAt(editor, tablePos);
  if (!found || col >= found.map.width) return;
  const { table, map, start } = found;
  const tr = editor.state.tr;
  // From the last row up, so the positions of the rows above stay valid.
  for (let row = map.height - 1; row >= 0; row--) {
    const pos = start + map.positionAt(row, col, table);
    const cell = tr.doc.nodeAt(pos) as PmNode;
    tr.insert(pos + cell.nodeSize, cell.type.create(cell.attrs, cell.content));
  }
  editor.view.dispatch(tr);
  editor.view.focus();
}

/**
 * Aligns the selected cells (null: left, the default). Their paragraphs' own alignment, set from the toolbar, is
 * dropped: it would otherwise win over the cell's, and picking an alignment would seem to do nothing.
 */
export function setCellAlign(editor: Editor, align: string | null) {
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const cells: { node: PmNode; pos: number }[] = [];
      if (state.selection instanceof CellSelection) state.selection.forEachCell((node, pos) => cells.push({ node, pos }));
      else if (isInTable(state)) {
        const $cell = selectionCell(state);
        if ($cell.nodeAfter) cells.push({ node: $cell.nodeAfter, pos: $cell.pos });
      }
      // Attributes only: no position moves, so the cells' positions stay valid throughout.
      for (const { node, pos } of cells) {
        node.descendants((child, offset) => {
          if (child.type.name === "paragraph" && child.attrs.align) tr.setNodeAttribute(pos + 1 + offset, "align", null);
        });
      }
      return true;
    })
    .setCellAttribute("align", align)
    .run();
}

/** A new empty row at the bottom of the table. */
export function addRowAtEnd(editor: Editor, tablePos: number) {
  const found = tableAt(editor, tablePos);
  if (!found) return;
  const last = found.map.height - 1;
  if (selectCells(editor, tablePos, [last, 0], [last, 0])) editor.chain().focus().addRowAfter().run();
}

/** A new empty column on the right of the table. */
export function addColumnAtEnd(editor: Editor, tablePos: number) {
  const found = tableAt(editor, tablePos);
  if (!found) return;
  const last = found.map.width - 1;
  if (selectCells(editor, tablePos, [0, last], [0, last])) editor.chain().focus().addColumnAfter().run();
}
