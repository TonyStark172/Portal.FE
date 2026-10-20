import { Extension } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { columnResizingPluginKey, TableMap } from "@tiptap/pm/tables";
import { MAX_COLUMN_WIDTH, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from "./extensions";

/** The most rows and the most columns of any table in a document. */
function largestTable(doc: PmNode) {
  let rows = 0;
  let columns = 0;
  doc.descendants((node) => {
    if (node.type.spec.tableRole !== "table") return true;
    const map = TableMap.get(node);
    rows = Math.max(rows, map.height);
    columns = Math.max(columns, map.width);
    return false;
  });
  return { rows, columns };
}

/**
 * Whether a change keeps tables within the limits, whatever made it (the "+" bars, the menus, Tab in the last
 * cell, pasting, inserting). A table that was already bigger (written before the limits) may still be edited, but
 * not made bigger still.
 */
function keepsTablesSmall(tr: Transaction, state: EditorState) {
  if (!tr.docChanged) return true;
  const after = largestTable(tr.doc);
  if (after.rows <= MAX_TABLE_ROWS && after.columns <= MAX_TABLE_COLUMNS) return true;
  const before = largestTable(state.doc);
  return after.rows <= Math.max(before.rows, MAX_TABLE_ROWS) && after.columns <= Math.max(before.columns, MAX_TABLE_COLUMNS);
}

/** Brings column widths over the limit (pasted, or from before it) down to it. */
function narrowWideColumns(state: EditorState) {
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    const widths = node.attrs.colwidth as (number | null)[] | null | undefined;
    if (!widths?.some((width) => width !== null && width > MAX_COLUMN_WIDTH)) return true;
    tr.setNodeAttribute(pos, "colwidth", widths.map((width) => (width === null ? null : Math.min(width, MAX_COLUMN_WIDTH))));
    return false;
  });
  return tr.docChanged ? tr : null;
}

/**
 * Holds a column border being dragged (Tiptap's column resizing, which follows the mouse on the window) at the widest
 * a column may be: a mouse event past that point reaches it as if the mouse were on that point.
 */
function holdColumnDrag(view: { state: EditorState; dom: HTMLElement }) {
  const win = view.dom.ownerDocument.defaultView ?? window;
  let redispatching = false;

  const hold = (event: MouseEvent) => {
    if (redispatching) return;
    const dragging = columnResizingPluginKey.getState(view.state)?.dragging;
    if (!dragging) return;
    const limit = dragging.startX + (MAX_COLUMN_WIDTH - dragging.startWidth);
    if (event.clientX <= limit) return;
    event.stopImmediatePropagation();
    redispatching = true;
    win.dispatchEvent(
      new MouseEvent(event.type, {
        bubbles: true,
        clientX: limit,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons,
      }),
    );
    redispatching = false;
  };

  win.addEventListener("mousemove", hold, true);
  win.addEventListener("mouseup", hold, true);
  return {
    destroy() {
      win.removeEventListener("mousemove", hold, true);
      win.removeEventListener("mouseup", hold, true);
    },
  };
}

/**
 * The limits of a post's tables, kept whatever the edit: at most MAX_TABLE_ROWS × MAX_TABLE_COLUMNS, columns at most
 * MAX_COLUMN_WIDTH wide (also while their border is dragged). Portal.BE checks the same limits.
 */
export const TableLimits = Extension.create({
  name: "tableLimits",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tableLimits"),
        filterTransaction: keepsTablesSmall,
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.docChanged) ? narrowWideColumns(state) : null,
        view: holdColumnDrag,
      }),
    ];
  },
});
