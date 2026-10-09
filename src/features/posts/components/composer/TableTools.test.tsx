import "@/app/globals.css";
import { Button, Popover } from "@heroui/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { tableExtensions } from "../../editor/tableExtensions";
import { TableInsert } from "./TableTools";

/** "Chèn bảng" inside another popover, as under the toolbar's "⋮" (OverflowToolbar). */
function InsertUnderMore() {
  const editor = useEditor({ extensions: [StarterKit, ...tableExtensions], content: "<p>x</p>" });
  if (!editor) return null;
  return (
    <div className="p-10">
      <EditorContent editor={editor} />
      <Popover>
        <Button aria-label="Thêm công cụ">⋮</Button>
        <Popover.Content placement="bottom end">
          <Popover.Dialog aria-label="Công cụ khác">
            <TableInsert editor={editor} isDisabled={false} />
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}

const byLabel = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("the table grid", () => {
  test("stays open when opened from inside another popover", async () => {
    await render(<InsertUnderMore />);

    await userEvent.click(await vi.waitUntil(() => byLabel("Thêm công cụ")));
    await userEvent.click(await vi.waitUntil(() => document.querySelector<HTMLElement>('button[aria-label="Chèn bảng"]')));
    await pause(400);

    expect(byLabel("Kích thước bảng")).not.toBeNull();
    expect(byLabel("Công cụ khác")).not.toBeNull();
  });

  test("starts on 3 × 3 for the keyboard", async () => {
    await render(<InsertUnderMore />);

    await userEvent.click(await vi.waitUntil(() => byLabel("Thêm công cụ")));
    await userEvent.click(await vi.waitUntil(() => document.querySelector<HTMLElement>('button[aria-label="Chèn bảng"]')));

    await vi.waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("3 hàng × 3 cột"));
  });
});
