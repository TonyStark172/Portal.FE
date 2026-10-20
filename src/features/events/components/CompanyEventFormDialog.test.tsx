import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { signedIn } from "@/shared/session/sessionSlice";
import { fromCompanyEvent, newCompanyEventForm } from "../eventForm";
import type { CompanyEvent, CompanyEventFormValue } from "../eventTypes";
import { CompanyEventFormDialog } from "./CompanyEventFormDialog";

const event: CompanyEvent = {
  id: 4, title: "Team building", description: null, location: "Vũng Tàu", startUtc: "2026-10-23T17:00:00.000Z",
  endUtc: "2026-10-25T17:00:00.000Z", isAllDay: true, category: "TeamBuilding", departments: [{ id: 3, name: "Kỹ thuật" }],
  createdById: 1, canManage: true,
};
const departments = [{ id: 3, name: "Kỹ thuật", parentId: null }, { id: 5, name: "Kinh doanh", parentId: null }];
type Sent = { method: string; path: string; body: unknown };

/** Answers the departments list and the event writes (as the server would, or with `failure`); records the writes. */
function serve(failure?: Response) {
  const sent: Sent[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href));
    const url = new URL(request.url);
    if (url.pathname.endsWith("/audience/departments")) {
      const search = (url.searchParams.get("Search") ?? "").toLowerCase();
      return Response.json(departments.filter(department => department.name.toLowerCase().includes(search)));
    }
    const body = request.method === "GET" ? null : JSON.parse(await request.text());
    sent.push({ method: request.method, path: url.pathname, body });
    if (failure) return failure.clone();
    return Response.json({ ...event, ...(body as object), id: 4, departments: [] }, { status: request.method === "POST" ? 201 : 200 });
  });
  return sent;
}

async function open(initial: CompanyEventFormValue) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const screen = await render(<Provider store={store}><CompanyEventFormDialog initial={initial} session={1} onClose={onClose} onSaved={onSaved} /></Provider>);
  return { screen, onSaved, onClose };
}

afterEach(() => vi.restoreAllMocks());

test("a new event needs a title; nothing is sent until it has one", async () => {
  const sent = serve();
  const { screen } = await open(newCompanyEventForm(new Date("2026-10-20T02:05:00Z")));
  await expect.element(screen.getByRole("dialog", { name: "Thêm sự kiện" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Tạo sự kiện" }));
  await expect.element(screen.getByText("Bắt buộc, tối đa 200 ký tự.")).toBeVisible();
  expect(sent).toHaveLength(0);
});

test("a new event is created with its category, time, place and description, for the whole company", async () => {
  const sent = serve();
  const { screen, onSaved } = await open(newCompanyEventForm(new Date("2026-10-20T02:05:00Z")));
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên sự kiện" }), "Đào tạo an toàn");
  await userEvent.fill(screen.getByRole("textbox", { name: "Địa điểm" }), "Hội trường");
  await userEvent.fill(screen.getByRole("textbox", { name: "Mô tả" }), "Mang theo thẻ.");
  await userEvent.click(screen.getByRole("button", { name: /Loại sự kiện/ }));
  await userEvent.click(screen.getByRole("option", { name: "Đào tạo" }));
  await userEvent.click(screen.getByRole("button", { name: "Tạo sự kiện" }));
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(sent).toEqual([{ method: "POST", path: "/backend/api/Events", body: {
    title: "Đào tạo an toàn", description: "Mang theo thẻ.", location: "Hội trường", startUtc: "2026-10-20T02:15:00.000Z", endUtc: "2026-10-20T03:15:00.000Z",
    isAllDay: false, category: "Training", departmentIds: [],
  } }]);
});

test("the category picker offers the company's kinds of event, 'Khác' by default", async () => {
  serve();
  const { screen } = await open(newCompanyEventForm(new Date("2026-10-20T02:05:00Z")));
  const picker = screen.getByRole("button", { name: /Loại sự kiện/ });
  await expect.element(picker).toHaveTextContent("Khác");
  await userEvent.click(picker);
  const names = [...document.querySelectorAll('[role="option"]')].map(option => option.textContent?.trim());
  expect(names).toEqual(["Tiệc", "Thể thao", "Team building", "Đào tạo", "Khác"]);
});

test("chosen departments need one at least, and are sent by id", async () => {
  const sent = serve();
  const { screen, onSaved } = await open({ ...newCompanyEventForm(new Date("2026-10-20T02:05:00Z")), title: "Họp phòng" });
  await userEvent.click(screen.getByText("Một số phòng ban", { exact: true }));
  await expect.element(screen.getByRole("radio", { name: "Một số phòng ban" })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Tạo sự kiện" }));
  await expect.element(screen.getByText("Chọn ít nhất một phòng ban.")).toBeVisible();
  expect(sent).toHaveLength(0);
  await userEvent.click(screen.getByText("Chọn phòng ban", { exact: true }));
  await userEvent.click(screen.getByRole("option", { name: "Kinh doanh" }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Tạo sự kiện" }));
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(sent[0].body).toMatchObject({ departmentIds: [5] });
});

test("an event is edited in place: its days, its departments, and the whole of it is sent again", async () => {
  const sent = serve();
  const { screen, onSaved } = await open(fromCompanyEvent(event));
  await expect.element(screen.getByRole("dialog", { name: "Chỉnh sửa sự kiện" })).toBeVisible();
  await expect.element(screen.getByRole("row", { name: "Kỹ thuật" })).toBeVisible();
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên sự kiện" }), "Team building 2026");
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(sent).toEqual([{ method: "PUT", path: "/backend/api/Events/4", body: {
    title: "Team building 2026", description: null, location: "Vũng Tàu", startUtc: event.startUtc, endUtc: event.endUtc,
    isAllDay: true, category: "TeamBuilding", departmentIds: [3],
  } }]);
});

test("the server's objection is shown at its field, and the form stays open", async () => {
  serve(Response.json({ status: 400, code: "validation_failed", detail: "Dữ liệu không hợp lệ.", errors: { EndUtc: ["Sự kiện dài tối đa 31 ngày."] } }, { status: 400 }));
  const { screen, onSaved } = await open({ ...newCompanyEventForm(new Date("2026-10-20T02:05:00Z")), title: "Hội thao" });
  await userEvent.click(screen.getByRole("button", { name: "Tạo sự kiện" }));
  await expect.element(screen.getByText("Sự kiện dài tối đa 31 ngày.")).toBeVisible();
  expect(onSaved).not.toHaveBeenCalled();
});
