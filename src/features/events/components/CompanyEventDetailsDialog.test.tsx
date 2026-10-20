import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import type { CompanyEvent } from "../eventTypes";
import { CompanyEventDetailsDialog } from "./CompanyEventDetailsDialog";

const event: CompanyEvent = {
  id: 4, title: "Đào tạo an toàn", description: "Mang theo thẻ nhân viên.", location: "Hội trường", startUtc: "2030-01-07T02:00:00Z",
  endUtc: "2030-01-07T04:00:00Z", isAllDay: false, category: "Training", departments: [{ id: 3, name: "Kỹ thuật" }, { id: 5, name: "Kinh doanh" }],
  createdById: 1, canManage: true,
};
const requestOf = (input: RequestInfo | URL) => input instanceof Request ? input : new Request(new URL(String(input), location.href));

async function show({ permissions = ["Events.Manage"], shown = event, now = Date.parse("2026-10-14T03:00:00Z") }: { permissions?: string[]; shown?: CompanyEvent; now?: number } = {}) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người xem" } as UserDto, permissions }));
  const onEdit = vi.fn();
  const onDeleted = vi.fn();
  const screen = await render(<Provider store={store}>
    <CompanyEventDetailsDialog event={shown} now={now} busy={false} onClose={vi.fn()} onEdit={onEdit} onDeleted={onDeleted} />
  </Provider>);
  return { screen, onEdit, onDeleted };
}

afterEach(() => vi.restoreAllMocks());

test("an event shows its title, time, place, category, audience and description", async () => {
  const { screen } = await show({ permissions: [] });
  const dialog = screen.getByRole("dialog", { name: "Đào tạo an toàn" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText(/07\/01\/2030 · 09:00 – 11:00/)).toBeVisible();
  await expect.element(dialog.getByText("Hội trường")).toBeVisible();
  await expect.element(dialog.getByText("Đào tạo", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText("Kỹ thuật, Kinh doanh")).toBeVisible();
  await expect.element(dialog.getByText("Mang theo thẻ nhân viên.")).toBeVisible();
});

test("an event for everyone says so; one under way or over says that too", async () => {
  await show({ permissions: [], shown: { ...event, departments: [], location: null, description: null }, now: Date.parse("2030-01-07T03:00:00Z") });
  const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
  await vi.waitFor(() => expect(dialog.textContent).toContain("Toàn công ty"));
  expect(dialog.textContent).toContain("Đang diễn ra");
});

test("without Events.Manage there is nothing to edit or delete", async () => {
  const { screen } = await show({ permissions: [] });
  await expect.element(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByRole("button", { name: "Chỉnh sửa sự kiện" }).query()).toBeNull();
  expect(screen.getByRole("button", { name: "Xoá sự kiện" }).query()).toBeNull();
});

test("a manager edits the event from its details", async () => {
  const { screen, onEdit } = await show();
  await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa sự kiện" }));
  expect(onEdit).toHaveBeenCalledWith(event);
});

test("deleting asks first, then deletes the event for good", async () => {
  const requests: Request[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => { requests.push(requestOf(input)); return new Response(null, { status: 204 }); });
  const { screen, onDeleted } = await show();
  await userEvent.click(screen.getByRole("button", { name: "Xoá sự kiện" }));
  // Nothing is sent until it is confirmed; keeping it closes the question.
  const question = screen.getByRole("alertdialog", { name: "Xoá sự kiện này?" });
  await expect.element(question).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Không xoá" }));
  await expect.element(question).not.toBeInTheDocument();
  expect(requests).toHaveLength(0);

  await userEvent.click(screen.getByRole("button", { name: "Xoá sự kiện" }));
  await userEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));
  await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
  expect(requests.map(request => [request.method, new URL(request.url).pathname])).toEqual([["DELETE", "/backend/api/Events/4"]]);
});

test("a failed delete says why and keeps the event", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ status: 404, code: "not_found", detail: "Không tìm thấy sự kiện." }, { status: 404 }));
  const { screen, onDeleted } = await show();
  await userEvent.click(screen.getByRole("button", { name: "Xoá sự kiện" }));
  await userEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Không tìm thấy sự kiện.");
  expect(onDeleted).not.toHaveBeenCalled();
});

test("a place in plain text opens a Google Maps search for it, in a new tab", async () => {
  const { screen } = await show({ permissions: [] });
  const place = screen.getByRole("link", { name: "Hội trường (mở trong thẻ mới)" });
  await expect.element(place).toBeVisible();
  await expect.element(place).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=H%E1%BB%99i%20tr%C6%B0%E1%BB%9Dng");
  await expect.element(place).toHaveAttribute("target", "_blank");
  await expect.element(place).toHaveAttribute("rel", "noopener noreferrer");
});

test("a pasted map link opens itself in a new tab, named 'Google Maps' rather than shown whole", async () => {
  const link = "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A1t+L%E1%BB%9Bn/@21.0242,105.8574,17z/data=!3m1!4b1!4m6!3m5";
  const { screen } = await show({ permissions: [], shown: { ...event, location: link } });
  const place = screen.getByRole("link", { name: "Google Maps (mở trong thẻ mới)" });
  await expect.element(place).toBeVisible();
  await expect.element(place).toHaveAttribute("href", link);
  await expect.element(place).toHaveAttribute("target", "_blank");
  await expect.element(place).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByRole("dialog").element().textContent).not.toContain("/maps/place");
});
