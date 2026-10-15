import "@/app/globals.css";
import { afterEach, expect, test, vi } from "vitest";
import { Toast } from "@heroui/react";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";

afterEach(() => vi.restoreAllMocks());

const show = (onOpenChange: (open: boolean) => void = () => {}) =>
  render(
    <>
      <Toast.Provider />
      <TemporaryPasswordDialog password="Abc123xyz456" fullName="Nguyễn Văn An" isOpen onOpenChange={onOpenChange} />
    </>,
  );

test("shows the password once with a copy button", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const screen = await show();
  await expect.element(screen.getByRole("dialog")).toHaveTextContent("Mật khẩu tạm của Nguyễn Văn An");
  await expect.element(screen.getByText("Abc123xyz456")).toBeVisible();
  await expect.element(screen.getByText("Mật khẩu này chỉ hiện một lần. Người dùng sẽ phải đổi ở lần đăng nhập đầu.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Sao chép" }));
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("Abc123xyz456"));
  await expect.element(screen.getByText("Đã sao chép")).toBeVisible();
});

test("when the clipboard cannot be written, an error is shown and the password stays to copy by hand", async () => {
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  const screen = await show();
  await userEvent.click(screen.getByRole("button", { name: "Sao chép" }));
  await expect.element(screen.getByText("Không sao chép được. Hãy chọn mật khẩu và chép bằng tay.")).toBeVisible();
  await expect.element(screen.getByText("Abc123xyz456")).toBeVisible();
});

test("Xong closes it", async () => {
  const onOpenChange = vi.fn();
  const screen = await show(onOpenChange);
  await userEvent.click(screen.getByRole("button", { name: "Xong" }));
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("Escape does not close it: the password would be lost", async () => {
  const onOpenChange = vi.fn();
  const screen = await show(onOpenChange);
  await userEvent.keyboard("{Escape}");
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(onOpenChange).not.toHaveBeenCalled();
  await expect.element(screen.getByText("Abc123xyz456")).toBeVisible();
});
