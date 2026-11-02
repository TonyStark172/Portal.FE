import "@/app/globals.css";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { MediaDropZone } from "./MediaDropZone";

const LABEL = "Kéo thả ảnh, video vào đây hoặc bấm để chọn";
const LABEL_SINGLE = "Kéo thả 1 ảnh hoặc 1 video vào đây hoặc bấm để chọn";

const file = (name: string, type: string) => new File(["x"], name, { type });
const png = (name: string) => file(name, "image/png");
const mp4 = (name: string) => file(name, "video/mp4");
const pdf = (name: string) => file(name, "application/pdf");

/** The zone, found by the label that names it. */
const zone = () => document.querySelector<HTMLElement>("[data-media-drop-zone]")!;
const pickerInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

function dragEvent(type: string, files: File[]) {
  const dataTransfer = new DataTransfer();
  files.forEach((f) => dataTransfer.items.add(f));
  // A drag from the file manager allows copying and takes a drop effect; a made one allows nothing and ignores both.
  Object.defineProperty(dataTransfer, "effectAllowed", { value: "all" });
  Object.defineProperty(dataTransfer, "dropEffect", { value: "none", writable: true });
  return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
}

/** A drag over the zone, as a pointer would send it. */
async function dragOver(files: File[]) {
  zone().dispatchEvent(dragEvent("dragenter", files));
  zone().dispatchEvent(dragEvent("dragover", files));
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function drop(files: File[]) {
  await dragOver(files);
  zone().dispatchEvent(dragEvent("drop", files));
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("the media drop zone", () => {
  // A made drag has no file system entry behind its files, as the browser gives for a real one.
  beforeEach(() => {
    vi.spyOn(DataTransferItem.prototype, "webkitGetAsEntry").mockReturnValue({ isFile: true, isDirectory: false } as FileSystemEntry);
  });
  afterEach(() => vi.restoreAllMocks());

  test("shows the label, the limits from fileRules and the button", async () => {
    await render(<MediaDropZone onFiles={() => {}} />);

    await expect.element(page.getByText(LABEL)).toBeVisible();
    await expect.element(page.getByText(/5 MB/)).toBeVisible();
    await expect.element(page.getByText(/100 MB/)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Chọn tệp" })).toBeVisible();
  });

  test("says one file when it takes only one", async () => {
    await render(<MediaDropZone onFiles={() => {}} multiple={false} />);

    await expect.element(page.getByText(LABEL_SINGLE)).toBeVisible();
  });

  test("hands over dropped images and videos only", async () => {
    const onFiles = vi.fn();
    await render(<MediaDropZone onFiles={onFiles} />);
    const [a, b, c] = [png("a.png"), mp4("b.mp4"), pdf("c.pdf")];

    await drop([a, b, c]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(["a.png", "b.mp4"]);
  });

  test("takes only the first file when not multiple", async () => {
    const onFiles = vi.fn();
    await render(<MediaDropZone onFiles={onFiles} multiple={false} />);

    await drop([png("a.png"), png("b.png")]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(["a.png"]);
    expect(pickerInput().multiple).toBe(false);
  });

  test("lets the picker take several files by default, only images and videos", async () => {
    await render(<MediaDropZone onFiles={() => {}} />);

    expect(pickerInput().multiple).toBe(true);
    expect(pickerInput().accept).toBe("image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime");
  });

  test("hands over the files picked", async () => {
    const onFiles = vi.fn();
    await render(<MediaDropZone onFiles={onFiles} />);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(png("a.png"));

    pickerInput().files = dataTransfer.files;
    pickerInput().dispatchEvent(new Event("change", { bubbles: true }));

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(["a.png"]);
  });

  test("clicking the area or the button opens the picker once", async () => {
    await render(<MediaDropZone onFiles={() => {}} />);
    const open = vi.spyOn(pickerInput(), "click").mockImplementation(() => {});

    await page.getByText(LABEL).click();
    expect(open).toHaveBeenCalledTimes(1);

    await page.getByRole("button", { name: "Chọn tệp" }).click();
    expect(open).toHaveBeenCalledTimes(2);
  });

  test("Enter on the focused area, or on the button, opens the picker once", async () => {
    await render(<MediaDropZone onFiles={() => {}} />);
    const open = vi.spyOn(pickerInput(), "click").mockImplementation(() => {});

    await userEvent.tab();
    expect(zone().contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(open).toHaveBeenCalledTimes(1);

    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Chọn tệp" }).element());
    await userEvent.keyboard("{Enter}");
    expect(open).toHaveBeenCalledTimes(2);
  });

  test("marks the drop target while dragging over it", async () => {
    await render(<MediaDropZone onFiles={() => {}} />);
    expect(zone()).not.toHaveAttribute("data-drop-target");

    await dragOver([png("a.png")]);
    expect(zone()).toHaveAttribute("data-drop-target");

    zone().dispatchEvent(dragEvent("dragleave", []));
    await vi.waitFor(() => expect(zone()).not.toHaveAttribute("data-drop-target"));
  });

  test("does nothing when disabled", async () => {
    const onFiles = vi.fn();
    await render(<MediaDropZone onFiles={onFiles} isDisabled />);
    const open = vi.spyOn(pickerInput(), "click").mockImplementation(() => {});

    await drop([png("a.png")]);
    await page.getByText(LABEL).click({ force: true });

    expect(onFiles).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    await expect.element(page.getByRole("button", { name: "Chọn tệp" })).toBeDisabled();
  });
});
