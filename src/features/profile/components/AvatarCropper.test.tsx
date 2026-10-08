import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { AvatarCropper } from "./AvatarCropper";

/** A 400×200 PNG: red on the left half, blue on the right. */
async function redBluePicture() {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 200;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ff0000";
  context.fillRect(0, 0, 200, 200);
  context.fillStyle = "#0000ff";
  context.fillRect(200, 0, 200, 200);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  return new File([blob], "picture.png", { type: "image/png" });
}

/** The colour of a pixel of a saved avatar, as "red", "blue" or "other". */
async function colourAt(blob: Blob, x: number, y: number) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0);
  const [r, g, b] = context.getImageData(x, y, 1, 1).data;
  return r > 200 && g < 60 && b < 60 ? "red" : b > 200 && r < 60 && g < 60 ? "blue" : "other";
}

/** A button of the dialog holding `stage` (a closing dialog of an earlier test may still be in the page). */
const button = (stage: HTMLElement, text: string) =>
  [...stage.closest('[role="dialog"]')!.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === text)!;

async function openCropper(onSave = vi.fn(), onCancel = vi.fn()) {
  await render(<AvatarCropper file={await redBluePicture()} isSaving={false} onSave={onSave} onCancel={onCancel} />);
  // The last stage: the one of this test's dialog.
  const stage = await vi.waitUntil(() => [...document.querySelectorAll<HTMLElement>("[data-crop-stage][data-ready]")].at(-1));
  return { stage, onSave, onCancel };
}

describe("the avatar cropper", () => {
  test("saves the centred square as a 512 px picture", async () => {
    const { stage, onSave } = await openCropper();

    await userEvent.click(button(stage, "Lưu ảnh"));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const blob: Blob = onSave.mock.calls[0][0];
    const bitmap = await createImageBitmap(blob);
    expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
    expect(await colourAt(blob, 128, 256)).toBe("red");
    expect(await colourAt(blob, 384, 256)).toBe("blue");
  });

  test("saves where the picture was dragged to", async () => {
    const { stage, onSave } = await openCropper();
    const box = stage.getBoundingClientRect();
    const pointer = (type: string, x: number) =>
      stage.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: box.top + 50, pointerId: 1, button: 0, isPrimary: true }));

    // Far to the right: the picture's left edge comes to the stage's, showing only red.
    pointer("pointerdown", box.left + 50);
    pointer("pointermove", box.left + 50 + box.width);
    pointer("pointerup", box.left + 50 + box.width);

    await userEvent.click(button(stage, "Lưu ảnh"));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const blob: Blob = onSave.mock.calls[0][0];
    expect(await colourAt(blob, 128, 256)).toBe("red");
    expect(await colourAt(blob, 384, 256)).toBe("red");
  });

  test("shows the whole circle, with room around it", async () => {
    const { stage } = await openCropper();
    const box = stage.getBoundingClientRect();
    const circle = stage.querySelector("[data-crop-circle]")!.getBoundingClientRect();

    expect(circle.width).toBeCloseTo(circle.height, 1);
    expect(circle.left).toBeGreaterThanOrEqual(box.left + 8);
    expect(circle.top).toBeGreaterThanOrEqual(box.top + 8);
    expect(circle.right).toBeLessThanOrEqual(box.right - 8);
    expect(circle.bottom).toBeLessThanOrEqual(box.bottom - 8);
  });

  test("saves nothing when cancelled", async () => {
    const { stage, onSave, onCancel } = await openCropper();

    await userEvent.click(button(stage, "Huỷ"));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  test("zooms from the keyboard, the slider following", async () => {
    const { stage } = await openCropper();

    stage.focus();
    await userEvent.keyboard("+++++");

    const slider = stage.closest('[role="dialog"]')!.querySelector<HTMLInputElement>('[aria-label="Thu phóng"] input[type="range"]')!;
    await vi.waitFor(() => expect(Number(slider.value)).toBeCloseTo(1.5, 5));
  });
});
