import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { ProfileDto } from "@/shared/api/generated/portalApi";
import { AvatarEditor, type AvatarChange } from "./AvatarEditor";

const profile = (avatarUrl: string | null) => ({ fullName: "Nguyễn Văn An", avatarUrl }) as ProfileDto;

async function picture() {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 200;
  canvas.getContext("2d")!.fillRect(0, 0, 300, 200);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  return new File([blob], "picture.png", { type: "image/png" });
}

/** The editor as the profile form holds it: the change is the form's until it is saved. */
function Editor({ avatarUrl = null, onChange }: { avatarUrl?: string | null; onChange: (change: AvatarChange | null) => void }) {
  const [change, setChange] = useState<AvatarChange | null>(null);
  return (
    <Provider store={makeStore()}>
      <AvatarEditor
        profile={profile(avatarUrl)}
        change={change}
        onChange={(next) => {
          setChange(next);
          onChange(next);
        }}
      />
    </Provider>
  );
}

const dialogButton = (dialog: Element, text: string) =>
  [...dialog.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === text)!;

/** Requests to Portal.BE: there must be none before the profile form is saved. */
function watchRequests() {
  const fetches = vi.spyOn(window, "fetch");
  const sends = vi.spyOn(XMLHttpRequest.prototype, "send");
  return () => fetches.mock.calls.length + sends.mock.calls.length;
}

afterEach(() => vi.restoreAllMocks());

describe("the avatar editor", () => {
  test("keeps a fitted picture for the form to save, uploading nothing", async () => {
    const onChange = vi.fn();
    await render(<Editor onChange={onChange} />);
    const requests = watchRequests();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const files = new DataTransfer();
    files.items.add(await picture());
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const stage = await vi.waitUntil(() => [...document.querySelectorAll<HTMLElement>("[data-crop-stage][data-ready]")].at(-1));
    await userEvent.click(dialogButton(stage.closest('[role="dialog"]')!, "Lưu ảnh"));

    // Saving encodes a JPEG, which can take over 1 s while the whole suite runs (see AvatarCropper.test.tsx).
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "set" })), { timeout: 5000 });
    const change = onChange.mock.calls[0][0] as Extract<AvatarChange, { kind: "set" }>;
    expect(change.avatar.type).toBe("image/jpeg");
    // The header shows the picture waiting to be saved.
    await vi.waitFor(() => expect(document.querySelector<HTMLImageElement>(`img[src="${change.preview}"]`)).not.toBeNull());
    expect(requests()).toBe(0);
  });

  test("marks the avatar for removal once confirmed, removing nothing yet", async () => {
    const onChange = vi.fn();
    await render(<Editor avatarUrl="/api/Profiles/me/avatar" onChange={onChange} />);
    const requests = watchRequests();

    await userEvent.click(await vi.waitUntil(() => document.querySelector<HTMLElement>('[aria-label="Xoá ảnh"]')));
    const confirm = await vi.waitUntil(() => document.querySelector('[role="alertdialog"]'));
    await userEvent.click(dialogButton(confirm, "Xoá ảnh"));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ kind: "remove" }));
    expect(requests()).toBe(0);
  });
});
