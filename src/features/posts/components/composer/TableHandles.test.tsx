import "@/app/globals.css";
import { useRef } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { tableExtensions } from "../../editor/tableExtensions";
import { TableHandles } from "./TableHandles";

const TABLE =
  "<table><tr><th><p>H1</p></th><th><p>H2</p></th></tr>" +
  "<tr><td><p>a</p></td><td><p>b</p></td></tr>" +
  "<tr><td><p>1</p></td><td><p>2</p></td></tr></table>";

/** The composer's editor and table controls, as PostComposer puts them together (the text scrolls past a height). */
function Composer({ content = TABLE, maxHeight = 600, onReady }: {
  content?: string;
  maxHeight?: number;
  onReady?: (editor: Editor) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, ...tableExtensions],
    content,
    editorProps: { attributes: { class: "post-content px-1 py-2" } },
    onCreate: ({ editor: created }) => onReady?.(created),
  });
  return (
    <div className="w-[600px] p-10">
      <div ref={frame} className="relative">
        <EditorContent editor={editor} className="overflow-y-auto" style={{ maxHeight }} />
        {editor && <TableHandles editor={editor} container={frame} />}
      </div>
    </div>
  );
}

const rows = () => [...document.querySelectorAll<HTMLTableRowElement>(".ProseMirror tr")];
const table = () => document.querySelector(".ProseMirror table")!.getBoundingClientRect();
const bar = (label: string) =>
  document.querySelector(`[aria-label="${label}"]`)!.closest("[data-table-control]")!.getBoundingClientRect();

/** Moves the mouse onto the bottom border of a row, which shows that row's resize bar. */
async function hoverBottomBorder(row: number) {
  const cell = rows()[row].cells[0];
  const r = cell.getBoundingClientRect();
  cell.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.left + 10, clientY: r.bottom - 2 }));
  return vi.waitUntil(() => document.querySelector<HTMLElement>(`[aria-label="Kéo để đổi chiều cao hàng ${row + 1}"]`));
}

function pointer(target: HTMLElement, type: string, x: number, y: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, isPrimary: true }));
}

/** A real drag has frames between its events (React has rendered and run its effects in between). */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

describe("dragging a row taller", () => {
  test("keeps the add-row and add-column bars along the table while the row grows", async () => {
    await render(<Composer />);
    await vi.waitUntil(() => rows().length === 3);

    const resizer = await hoverBottomBorder(1);
    const start = resizer.getBoundingClientRect();
    const x = start.left + 10;
    const y = start.top + start.height / 2;
    const rowBefore = rows()[1].getBoundingClientRect().height;

    pointer(resizer, "pointerdown", x, y);
    for (const dy of [25, 50, 75, 100]) {
      await nextFrame();
      pointer(resizer, "pointermove", x, y + dy);
    }

    // Still dragging (no pointerup): the row has grown, and the bars must have followed the table.
    await vi.waitFor(() => {
      expect(rows()[1].getBoundingClientRect().height).toBeGreaterThan(rowBefore + 90);
      expect(bar("Thêm hàng").top).toBeGreaterThanOrEqual(table().bottom);
      expect(Math.abs(bar("Thêm cột").bottom - table().bottom)).toBeLessThanOrEqual(1);
    });

    pointer(resizer, "pointerup", x, y + 100);
  });

  test("keeps the resize bar on the row's bottom border while the row grows", async () => {
    await render(<Composer />);
    await vi.waitUntil(() => rows().length === 3);

    const resizer = await hoverBottomBorder(1);
    const start = resizer.getBoundingClientRect();
    const x = start.left + 10;
    const y = start.top + start.height / 2;

    pointer(resizer, "pointerdown", x, y);
    for (const dy of [25, 50, 75, 100]) {
      await nextFrame();
      pointer(resizer, "pointermove", x, y + dy);
    }

    await vi.waitFor(() => {
      const bar = resizer.getBoundingClientRect();
      expect(Math.abs(bar.top + bar.height / 2 - rows()[1].getBoundingClientRect().bottom)).toBeLessThanOrEqual(2);
    });

    pointer(resizer, "pointerup", x, y + 100);
  });

  test("stops at 400px however far the mouse goes", async () => {
    await render(<Composer />);
    await vi.waitUntil(() => rows().length === 3);

    const resizer = await hoverBottomBorder(1);
    const start = resizer.getBoundingClientRect();
    const x = start.left + 10;
    const y = start.top + start.height / 2;

    pointer(resizer, "pointerdown", x, y);
    for (const dy of [300, 600, 2000]) {
      await nextFrame();
      pointer(resizer, "pointermove", x, y + dy);
    }
    await nextFrame();
    expect(rows()[1].getBoundingClientRect().height).toBeLessThanOrEqual(400);

    pointer(resizer, "pointerup", x, y + 2000);
    await vi.waitFor(() => expect(rows()[1].style.height).toBe("400px"));
  });
});

describe("a row height saved before", () => {
  test("is brought down to 400px", async () => {
    await render(<Composer content={'<table><tr style="height: 2000px"><td><p>a</p></td></tr></table>'} />);
    await vi.waitUntil(() => rows().length === 1);

    expect(rows()[0].style.height).toBe("400px");
  });
});

describe("a table followed by text", () => {
  test("keeps the add-row bar clear of the text below", async () => {
    await render(<Composer content={`${TABLE}<p>aaaaaaaaaaaa</p>`} />);
    await vi.waitUntil(() => rows().length === 3);

    const cell = rows()[2].cells[0];
    const r = cell.getBoundingClientRect();
    cell.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 }));
    await vi.waitUntil(() => document.querySelector('[aria-label="Thêm hàng"]'));

    const addRow = document.querySelector('[aria-label="Thêm hàng"]')!.closest("[data-table-control]")!.getBoundingClientRect();
    const text = document.querySelector(".ProseMirror > p:last-child")!.getBoundingClientRect();
    expect(addRow.bottom).toBeLessThanOrEqual(text.top);
  });
});

describe("a table as wide as the text area", () => {
  test("keeps the add-column bar clear of the text's scrollbar", async () => {
    // Columns wider than the area, and enough text below for the area to scroll (and show its scrollbar).
    const content =
      '<table><tr><td colwidth="300"><p>a</p></td><td colwidth="300"><p>b</p></td><td colwidth="300"><p>c</p></td></tr></table>' +
      "<p>…</p>".repeat(30);
    await render(<Composer content={content} maxHeight={200} />);
    await vi.waitUntil(() => rows().length === 1);

    const scroller = document.querySelector(".ProseMirror")!.parentElement!;
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);

    const cell = rows()[0].cells[0];
    const r = cell.getBoundingClientRect();
    cell.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 }));
    await vi.waitUntil(() => document.querySelector('[aria-label="Thêm cột"]'));

    // Where the text ends and the scrollbar begins.
    const box = scroller.getBoundingClientRect();
    const textRight = box.left + scroller.clientLeft + scroller.clientWidth;
    const addColumn = document.querySelector('[aria-label="Thêm cột"]')!.closest("[data-table-control]")!;
    expect(addColumn.getBoundingClientRect().right).toBeLessThanOrEqual(textRight);
  });
});

describe("a table taller than the text area", () => {
  test("shows no table control outside the text's scroll area", async () => {
    // Rows 100px tall: the table runs well past the 150px the text shows before it scrolls.
    const tall = (cells: string) => `<tr style="height: 100px">${cells}</tr>`;
    const content =
      "<table>" +
      tall("<td><p>a</p></td><td><p>b</p></td>") +
      tall("<td><p>c</p></td><td><p>d</p></td>") +
      tall("<td><p>e</p></td><td><p>f</p></td>") +
      "</table>";
    await render(<Composer content={content} maxHeight={150} />);
    await vi.waitUntil(() => rows().length === 3);

    const cell = rows()[0].cells[0];
    const r = cell.getBoundingClientRect();
    cell.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 }));
    await vi.waitUntil(() => document.querySelector('[aria-label="Thêm hàng"]'));

    const scrollArea = document.querySelector(".ProseMirror")!.parentElement!.getBoundingClientRect();
    const addRow = document.querySelector('[aria-label="Thêm hàng"]')!;
    const addColumn = document.querySelector('[aria-label="Thêm cột"]')!;
    const below = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: Math.max(box.top + 2, scrollArea.bottom + 5) };
    };
    // The bars run past the bottom of the scroll area: there, nothing of them may show or catch the mouse.
    const rowPoint = below(addRow);
    const columnPoint = below(addColumn);
    expect(addRow.getBoundingClientRect().top).toBeGreaterThan(scrollArea.bottom);
    expect(addRow.contains(document.elementFromPoint(rowPoint.x, rowPoint.y))).toBe(false);
    expect(addColumn.contains(document.elementFromPoint(columnPoint.x, columnPoint.y))).toBe(false);
  });
});

/** A table of rows × columns, every cell with some text. */
function tableOf(rowCount: number, columnCount: number, cellAttributes = "") {
  const row = (r: number) =>
    "<tr>" + Array.from({ length: columnCount }, (_, c) => `<td${cellAttributes}><p>${r + 1}.${c + 1}</p></td>`).join("") + "</tr>";
  return "<table>" + Array.from({ length: rowCount }, (_, r) => row(r)).join("") + "</table>";
}

async function renderEditor(content: string) {
  let editor: Editor | undefined;
  await render(<Composer content={content} onReady={(created) => (editor = created)} />);
  await vi.waitUntil(() => editor);
  return editor!;
}

/** The first table of the document, as JSON (undefined without one). */
const tableJSON = (editor: Editor): JSONContent | undefined =>
  editor.getJSON().content?.find((node: JSONContent) => node.type === "table");

function tableSize(editor: Editor) {
  const table = tableJSON(editor);
  return table ? { rows: table.content!.length, columns: table.content![0].content!.length } : null;
}

/** Puts the cursor in a cell of the table (row and column from 0). */
function placeCursor(editor: Editor, row: number, column: number) {
  const cell = rows()[row].cells[column];
  editor.chain().focus().setTextSelection(editor.view.posAtDOM(cell.querySelector("p")!, 0)).run();
}

async function hoverCell(row: number, column: number) {
  const cell = rows()[row].cells[column];
  const r = cell.getBoundingClientRect();
  cell.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 }));
  await vi.waitUntil(() => document.querySelector('[aria-label="Thêm hàng"]'));
}

const isDisabled = (label: string) => document.querySelector(`[aria-label="${label}"]`)!.hasAttribute("disabled");

describe("a table at its size limits", () => {
  test("gets no 11th column", async () => {
    const editor = await renderEditor(tableOf(1, 10));
    await hoverCell(0, 0);
    expect(isDisabled("Thêm cột")).toBe(true);

    placeCursor(editor, 0, 9);
    editor.commands.addColumnAfter();
    expect(tableSize(editor)).toEqual({ rows: 1, columns: 10 });
  });

  test("gets no 51st row, by command or by Tab in the last cell", async () => {
    const editor = await renderEditor(tableOf(50, 1));
    await hoverCell(0, 0);
    expect(isDisabled("Thêm hàng")).toBe(true);

    placeCursor(editor, 49, 0);
    editor.commands.addRowAfter();
    editor.commands.keyboardShortcut("Tab");
    expect(tableSize(editor)).toEqual({ rows: 50, columns: 1 });
  });

  test("still lets a smaller table grow", async () => {
    const editor = await renderEditor(tableOf(2, 2));
    await hoverCell(0, 0);
    expect(isDisabled("Thêm hàng")).toBe(false);
    expect(isDisabled("Thêm cột")).toBe(false);

    placeCursor(editor, 1, 1);
    editor.commands.addRowAfter();
    editor.commands.addColumnAfter();
    expect(tableSize(editor)).toEqual({ rows: 3, columns: 3 });
  });

  test("cannot be pasted or inserted bigger", async () => {
    const editor = await renderEditor("<p>x</p>");
    editor.commands.insertContent(tableOf(51, 1));
    editor.commands.insertContent(tableOf(1, 11));
    expect(tableSize(editor)).toBeNull();
  });
});

describe("a column", () => {
  test("is stored at most 600px wide", async () => {
    const editor = await renderEditor(tableOf(1, 2));
    placeCursor(editor, 0, 0);
    editor.commands.setCellAttribute("colwidth", [900]);

    const cell = tableJSON(editor)!.content![0].content![0];
    expect(cell.attrs!.colwidth).toEqual([600]);
  });

  test("stops at 600px however far its border is dragged", async () => {
    const editor = await renderEditor(tableOf(1, 2));
    const cell = rows()[0].cells[0];
    const r = cell.getBoundingClientRect();
    const x = r.right - 2;
    const y = r.top + r.height / 2;
    const mouse = (target: EventTarget, type: string, clientX: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY: y, button: 0, buttons: 1 }));

    // Over the border (Tiptap's resize handle), press, drag 2000px to the right, release.
    mouse(cell, "mousemove", x);
    await nextFrame();
    mouse(cell, "mousedown", x);
    mouse(window, "mousemove", x + 2000);
    await nextFrame();
    expect(rows()[0].cells[0].getBoundingClientRect().width).toBeLessThanOrEqual(601);

    mouse(window, "mouseup", x + 2000);
    const first = tableJSON(editor)!.content![0].content![0];
    expect(first.attrs!.colwidth).toEqual([600]);
  });
});

/** The size label shown by a resize line ("120 px"), or null. */
const sizeLabel = () => document.querySelector("[data-resize-size]")?.textContent ?? null;

describe("resizing shows the size in px", () => {
  test("of a row, while its border is dragged", async () => {
    await render(<Composer />);
    await vi.waitUntil(() => rows().length === 3);

    const resizer = await hoverBottomBorder(1);
    const start = resizer.getBoundingClientRect();
    const x = start.left + 10;
    const y = start.top + start.height / 2;
    pointer(resizer, "pointerdown", x, y);
    for (const dy of [20, 40, 61]) {
      await nextFrame();
      pointer(resizer, "pointermove", x, y + dy);
    }

    await vi.waitFor(() => expect(sizeLabel()).toBe(`${Math.round(rows()[1].getBoundingClientRect().height)} px`));
    pointer(resizer, "pointerup", x, y + 61);
  });

  test("of a column, over its border and while it is dragged", async () => {
    await render(<Composer />);
    await vi.waitUntil(() => rows().length === 3);

    const cell = rows()[1].cells[0];
    const r = cell.getBoundingClientRect();
    const x = r.right - 2;
    const y = r.top + r.height / 2;
    const mouse = (target: EventTarget, type: string, clientX: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY: y, button: 0, buttons: 1 }));
    const width = () => `${Math.round(rows()[1].cells[0].getBoundingClientRect().width)} px`;

    mouse(cell, "mousemove", x);
    await vi.waitFor(() => expect(sizeLabel()).toBe(width()));

    mouse(cell, "mousedown", x);
    mouse(window, "mousemove", x + 57);
    await vi.waitFor(() => expect(sizeLabel()).toBe(width()));
    expect(rows()[1].cells[0].getBoundingClientRect().width).toBeGreaterThan(r.width + 50);
    mouse(window, "mouseup", x + 57);
  });
});

describe("the column and row resize lines", () => {
  test("look alike", async () => {
    await render(<Composer />);
    await vi.waitUntil(() => rows().length === 3);

    const resizer = await hoverBottomBorder(1);
    const rowLine = getComputedStyle(resizer.querySelector("[data-resize-line]")!);

    const cell = rows()[1].cells[0];
    const r = cell.getBoundingClientRect();
    cell.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.right - 2, clientY: r.top + r.height / 2 }));
    const columnLine = getComputedStyle(await vi.waitUntil(() => document.querySelector(".column-resize-handle")!));

    expect(columnLine.width).toBe(rowLine.height);
    expect(columnLine.backgroundColor).toBe(rowLine.backgroundColor);
  });
});

/** Opens a row or column handle's menu with real clicks, after hovering a cell of that row or column. */
async function openHandleMenu(label: string) {
  const handle = await vi.waitUntil(() => document.querySelector<HTMLElement>(`[aria-label="${label}"]`));
  await userEvent.click(handle);
  return vi.waitUntil(() => document.querySelector<HTMLElement>('[role="menu"]'));
}

describe("a row's menu", () => {
  test("gives the cursor back when it closes", async () => {
    const editor = await renderEditor(TABLE);
    placeCursor(editor, 1, 1);
    const cursor = editor.state.selection.from;
    await hoverCell(1, 0);

    await openHandleMenu("Hàng 2: tuỳ chọn");
    expect(editor.state.selection.toJSON().type).toBe("cell");
    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() => expect(editor.state.selection.toJSON()).toEqual({ type: "text", anchor: cursor, head: cursor }));
  });

  test("colours the whole row, then the cell menu colours one cell again", async () => {
    const editor = await renderEditor(TABLE);
    placeCursor(editor, 1, 1);
    await hoverCell(1, 0);

    await openHandleMenu("Hàng 2: tuỳ chọn");
    await userEvent.click(await vi.waitUntil(() => document.querySelector<HTMLElement>('[role="menuitem"][data-key="background"]')));
    await userEvent.click(await vi.waitUntil(() => document.querySelector<HTMLElement>('[role="menuitemradio"][data-key="yellow"]')));
    await vi.waitFor(() => expect(document.querySelectorAll(".ProseMirror [data-bg]").length).toBe(2));

    // The cursor is back in one cell: what the cell menu does now stays in that cell.
    await vi.waitFor(() => expect(editor.state.selection.toJSON().type).toBe("text"));
    placeCursor(editor, 2, 1);
    editor.chain().focus().setCellAttribute("background", "blue").run();
    expect([...document.querySelectorAll(".ProseMirror [data-bg='blue']")].length).toBe(1);
  });
});

describe("the handles' menus", () => {
  test("give every item its own icon", async () => {
    await renderEditor(TABLE);
    await hoverCell(1, 1);
    const icons = (menu: HTMLElement) =>
      [...menu.querySelectorAll(":scope [role='menuitem'], :scope [role='menuitemradio']")].map(
        (item) => item.querySelector("span[aria-hidden]")?.innerHTML ?? "",
      );

    for (const label of ["Hàng 2: tuỳ chọn", "Cột 2: tuỳ chọn"]) {
      const menu = await openHandleMenu(label);
      const all = icons(menu);
      expect(new Set(all).size, `${label}: ${all.length} items`).toBe(all.length);
      await userEvent.keyboard("{Escape}");
      await vi.waitUntil(() => !document.querySelector('[role="menu"]'));
      await hoverCell(1, 1);
    }
  });
});
