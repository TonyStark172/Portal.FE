import { TableKit } from "@tiptap/extension-table";
import { PostTableCell, PostTableHeader, PostTableRow } from "./extensions";
import { TableLimits } from "./tableLimits";

/**
 * Everything a post's tables need in the editor: columns resized by dragging their border (Portal.BE keeps the
 * widths), rows with a height, cells with a background and an alignment, and the limits of a table's size.
 */
export const tableExtensions = [
  TableKit.configure({ table: { resizable: true }, tableCell: false, tableHeader: false, tableRow: false }),
  PostTableRow,
  PostTableCell,
  PostTableHeader,
  TableLimits,
];
