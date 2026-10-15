import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type OrganizationDto, type PaginatedListOfUserDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { reloadPage } from "../../lib/reload";
import { OrganizationAdmin } from "./OrganizationAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/organization" }));
vi.mock("../../lib/reload", () => ({ reloadPage: vi.fn() }));
beforeEach(() => vi.mocked(reloadPage).mockClear());
afterEach(async () => { vi.restoreAllMocks(); await page.viewport(1000, 800); });

const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const organization: OrganizationDto = {
  name: "Báo Tin Tức", shortName: "BTT", address: null, phoneNumber: null, email: null, website: null, foundedOn: null, heads: [],
};
const person = (id: number, fullName: string): UserDto => ({ id, fullName, userName: `u${id}`, isActive: true } as UserDto);
const users: PaginatedListOfUserDto = {
  items: [person(1, "Quản trị viên"), person(2, "Trần Bình"), person(3, "Lê Chi")],
  pageNumber: 1, totalPages: 1, totalCount: 3, hasPreviousPage: false, hasNextPage: false,
};
const workWeek = { days: [
  { day: "Sunday", start: null, end: null }, { day: "Monday", start: "08:00", end: "17:00" }, { day: "Tuesday", start: "08:00", end: "17:00" },
  { day: "Wednesday", start: "08:00", end: "17:00" }, { day: "Thursday", start: "08:00", end: "17:00" }, { day: "Friday", start: "08:00", end: "17:00" },
  { day: "Saturday", start: null, end: null },
] };

type Write = { method: string; path: string; body: unknown };
/** `me` answers the app reading the signed-in user again (resizing the window can make it), when a test does that. */
function mockOrganization(reply: (write: Write) => Response = () => new Response(null, { status: 204 }), me?: object) {
  const writes: Write[] = [];
  const searches: string[] = [];
  // What a successful save stores is what the next read gets, as on the server.
  let saved: OrganizationDto = organization;
  let week: unknown = workWeek;
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    if (init.method === "GET") {
      if (path === "/api/Auth/me" && me) return Response.json(me);
      if (path === "/api/Organization") return Response.json(saved);
      if (path === "/api/Organization/work-week") return Response.json(week);
      if (path === "/api/Users") { searches.push(search); return Response.json(users); }
      return Response.json({});
    }
    const write = { method: init.method, path, body: init.body ? JSON.parse(init.body) : null };
    writes.push(write);
    const response = reply(write);
    if (response.ok && path === "/api/Organization") saved = { ...saved, ...(write.body as object) };
    if (response.ok && path === "/api/Organization/work-week") week = write.body;
    return response;
  }));
  return { writes, searches };
}

function Harness({ permissions, isAdministrator = false }: { permissions: Permission[]; isAdministrator?: boolean }) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Quản trị viên", isAdministrator } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><OrganizationAdmin /></Provider>;
}

test("without the right to change the organization: no page", async () => {
  mockOrganization();
  const screen = await render(<Harness permissions={[Permissions.Users.View]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
});

test("saves the details, trimmed, the optional ones left empty as none", async () => {
  const { writes } = mockOrganization();
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);
  const name = screen.getByRole("textbox", { name: "Tên tổ chức" });
  await expect.element(name).toHaveValue("Báo Tin Tức");
  await userEvent.fill(name, "  Báo Tin Tức Việt Nam ");
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên viết tắt" }), "");
  await userEvent.fill(screen.getByRole("textbox", { name: "Địa chỉ" }), "5 Lý Thường Kiệt, Hà Nội");
  await userEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await expect.poll(() => writes).toEqual([{
    method: "PUT", path: "/api/Organization",
    body: { name: "Báo Tin Tức Việt Nam", shortName: null, address: "5 Lý Thường Kiệt, Hà Nội", phoneNumber: null, email: null, website: null, foundedOn: null },
  }]);
});

test("the founding date is saved as a day", async () => {
  const { writes } = mockOrganization();
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);
  await expect.element(screen.getByRole("textbox", { name: "Tên tổ chức" })).toHaveValue("Báo Tin Tức");
  await userEvent.fill(screen.getByLabelText("Ngày thành lập"), "1945-09-02");
  await userEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await expect.poll(() => (writes[0]?.body as { foundedOn?: string } | undefined)?.foundedOn).toBe("1945-09-02");
});

test("the work week is set here", async () => {
  mockOrganization();
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);
  await expect.element(screen.getByRole("heading", { name: "Tuần làm việc", level: 2 })).toBeVisible();
});

test("handing administration over is for the administrator only", async () => {
  mockOrganization();
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);
  await expect.element(screen.getByRole("textbox", { name: "Tên tổ chức" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Chuyển giao quyền quản trị" })).not.toBeInTheDocument();
});

test("the administrator hands over to someone else, confirming with their password, then the page reloads", async () => {
  // Once handed over the app forgets what it read and reads the (now ordinary) user again.
  const { writes, searches } = mockOrganization(undefined, {
    user: { id: 1, fullName: "Quản trị viên", isAdministrator: false },
    permissions: [],
  });
  const screen = await render(<Harness permissions={Object.values(Permissions).flatMap(group => Object.values(group))} isAdministrator />);
  await userEvent.click(screen.getByRole("button", { name: "Chuyển giao quyền quản trị" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("combobox", { name: "Người nhận" }), "B");
  await expect.element(screen.getByRole("option", { name: "Trần Bình" })).toBeVisible();
  // The administrator is not offered to themself.
  await expect.element(screen.getByRole("option", { name: "Quản trị viên" })).not.toBeInTheDocument();
  expect(searches.every(search => search.includes("IsActive=true"))).toBe(true);
  await userEvent.click(screen.getByRole("option", { name: "Trần Bình" }));
  await userEvent.fill(dialog.getByLabelText("Mật khẩu của bạn"), "secret-1");
  await userEvent.click(dialog.getByRole("button", { name: "Chuyển giao" }));
  await expect.poll(() => vi.mocked(reloadPage).mock.calls.length).toBe(1);
  expect(writes).toEqual([{ method: "POST", path: "/api/Organization/hand-over", body: { recipientId: 2, password: "secret-1" } }]);
});

test("a wrong password shows under the field, and nothing reloads", async () => {
  mockOrganization(() => Response.json({
    title: "Validation", status: 400, code: "validation_failed", errors: { Password: ["Mật khẩu không đúng."] },
  }, { status: 400 }));
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} isAdministrator />);
  await userEvent.click(screen.getByRole("button", { name: "Chuyển giao quyền quản trị" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("combobox", { name: "Người nhận" }), "Lê");
  await userEvent.click(screen.getByRole("option", { name: "Lê Chi" }));
  await userEvent.fill(dialog.getByLabelText("Mật khẩu của bạn"), "wrong-1");
  await userEvent.click(dialog.getByRole("button", { name: "Chuyển giao" }));
  await expect.element(dialog.getByText("Mật khẩu không đúng.")).toBeVisible();
  expect(reloadPage).not.toHaveBeenCalled();
});

test("nothing is sent before a recipient is chosen", async () => {
  const { writes } = mockOrganization();
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} isAdministrator />);
  await userEvent.click(screen.getByRole("button", { name: "Chuyển giao quyền quản trị" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("button", { name: "Chuyển giao" })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("on a wide screen each part is a row: what it is on the left, its fields on the right, no boxes", async () => {
  await page.viewport(1440, 900);
  mockOrganization(undefined, {
    user: { id: 1, fullName: "Quản trị viên", isAdministrator: true },
    permissions: [Permissions.Organization.Update],
  });
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} isAdministrator />);

  const parts = [
    { title: "Thông tin tổ chức", hint: "Tên và thông tin liên hệ", field: screen.getByRole("textbox", { name: "Tên tổ chức" }) },
    { title: "Tuần làm việc", hint: "Chỉ để hiển thị trên lịch họp", field: screen.getByRole("button", { name: "Lưu", exact: true }) },
    { title: "Vùng nguy hiểm", hint: "quản trị", field: screen.getByRole("button", { name: "Chuyển giao quyền quản trị" }) },
  ];
  for (const { title, hint, field } of parts) {
    const part = screen.getByRole("region", { name: title });
    await expect.element(part).toBeVisible();
    await expect.element(part).toHaveTextContent(hint);
    await expect.element(field).toBeVisible();
    const heading = part.getByRole("heading", { name: title, level: 2 }).element().getBoundingClientRect();
    const content = field.element().getBoundingClientRect();
    // Side by side: the fields start right of the title column.
    expect(content.left).toBeGreaterThan(heading.right);
    // A thin line between parts, not a card around each.
    expect(getComputedStyle(part.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  }

  // Level: the first field of the details starts on the title's line, not under it.
  const details = screen.getByRole("heading", { name: "Thông tin tổ chức" }).element().getBoundingClientRect();
  expect(screen.getByRole("textbox", { name: "Tên tổ chức" }).element().getBoundingClientRect().top).toBeLessThan(details.bottom + 40);

  // The details' save button sits at the right of the fields, as in a settings page.
  const address = screen.getByRole("textbox", { name: "Địa chỉ" }).element().getBoundingClientRect();
  const save = screen.getByRole("button", { name: "Lưu thông tin" }).element().getBoundingClientRect();
  expect(Math.round(save.right)).toBe(Math.round(address.right));
});

test("on a wide screen the details fill their rows, and both saves sit at the right", async () => {
  await page.viewport(1440, 900);
  mockOrganization(undefined, {
    user: { id: 1, fullName: "Quản trị viên", isAdministrator: false },
    permissions: [Permissions.Organization.Update],
  });
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);
  const box = (name: string) => screen.getByRole("textbox", { name }).element().getBoundingClientRect();
  await expect.element(screen.getByRole("textbox", { name: "Tên tổ chức" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu", exact: true })).toBeVisible();

  const name = box("Tên tổ chức"), shortName = box("Tên viết tắt"), address = box("Địa chỉ");
  const founded = screen.getByLabelText("Ngày thành lập").element().getBoundingClientRect();
  const phone = box("Số điện thoại"), email = box("Email"), website = box("Website");
  // The name and its short form share a row, the name the wider.
  expect(shortName.top).toBe(name.top);
  expect(name.width).toBeGreaterThan(shortName.width);
  // Then the founding date and the address, the address the wider; both rows end at the same edge.
  expect(address.top).toBe(founded.top);
  expect(founded.top).toBeGreaterThan(name.top);
  expect(Math.round(founded.left)).toBe(Math.round(name.left));
  expect(address.width).toBeGreaterThan(founded.width);
  expect(Math.round(address.right)).toBe(Math.round(shortName.right));
  // Phone, email and website share the last row, filling it.
  expect([email.top, website.top]).toEqual([phone.top, phone.top]);
  expect(phone.top).toBeGreaterThan(address.top);
  expect(Math.round(phone.left)).toBe(Math.round(name.left));
  expect(Math.round(website.right)).toBe(Math.round(address.right));

  // The work week's save sits at the right too, under the details' one.
  const saveDetails = screen.getByRole("button", { name: "Lưu thông tin" }).element().getBoundingClientRect();
  const saveWeek = screen.getByRole("button", { name: "Lưu", exact: true }).element().getBoundingClientRect();
  expect(Math.round(saveWeek.right)).toBe(Math.round(saveDetails.right));
});

test("on a wide screen each part has its summary at the right, on its own row, showing what is saved", async () => {
  // About the room the page has on a 1440px screen, once the app's side rail and margins are taken.
  await page.viewport(1330, 900);
  mockOrganization(undefined, {
    user: { id: 1, fullName: "Quản trị viên", isAdministrator: false },
    permissions: [Permissions.Organization.Update],
  });
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);

  const details = screen.getByRole("complementary", { name: "Tổ chức" });
  const week = screen.getByRole("complementary", { name: "Tuần làm việc" });
  await expect.element(details).toHaveTextContent("Báo Tin Tức");
  await expect.element(details).toHaveTextContent("Chưa có ngày thành lập");
  await expect.element(week).toHaveTextContent("T2–T6 08:00–17:00 · Nghỉ T7, CN");
  const box = (element: Element) => element.getBoundingClientRect();
  // Each beside its own part: past the fields, level with the part's title.
  const fields = box(screen.getByRole("textbox", { name: "Địa chỉ" }).element());
  for (const [summary, title] of [[details, "Thông tin tổ chức"], [week, "Tuần làm việc"]] as const) {
    expect(box(summary.element()).left).toBeGreaterThan(fields.right);
    const heading = box(screen.getByRole("heading", { name: title, level: 2 }).element());
    expect(Math.abs(box(summary.element()).top - heading.top)).toBeLessThan(8);
  }
  // Both in the same column.
  expect(Math.round(box(week.element()).left)).toBe(Math.round(box(details.element()).left));
  // With the summaries beside them, the work days and the hours still share one row.
  const days = box(screen.getByRole("group", { name: "Ngày làm việc" }).element());
  const end = box(screen.getByRole("button", { name: /Giờ kết thúc/ }).element());
  expect(end.left).toBeGreaterThan(days.right);
  expect(Math.abs(end.bottom - days.bottom)).toBeLessThan(6);
  // The week's summary lives there, not beside its save.
  expect(screen.getByText("T2–T6 08:00–17:00 · Nghỉ T7, CN").elements()).toHaveLength(1);

  // Typing changes nothing there until it is saved.
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên tổ chức" }), "Báo Tin Tức Việt Nam");
  await userEvent.fill(screen.getByLabelText("Ngày thành lập"), "1945-09-02");
  await expect.element(details).not.toHaveTextContent("Việt Nam");
  await userEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await expect.element(details).toHaveTextContent("Báo Tin Tức Việt Nam");
  await expect.element(details).toHaveTextContent("2 tháng 9, 1945");

  // Saving the week shows the new one there.
  await userEvent.click(screen.getByRole("button", { name: "T7", exact: true }));
  await expect.element(week).toHaveTextContent("Nghỉ T7, CN");
  await userEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(week).toHaveTextContent("T2–T7 08:00–17:00 · Nghỉ CN");
});

test("on a wide screen the work week lines up with the details above it, in fields that look the same", async () => {
  await page.viewport(1330, 900);
  mockOrganization(undefined, {
    user: { id: 1, fullName: "Quản trị viên", isAdministrator: false },
    permissions: [Permissions.Organization.Update],
  });
  const screen = await render(<Harness permissions={[Permissions.Organization.Update]} />);
  const start = screen.getByRole("button", { name: /Giờ bắt đầu/ });
  await expect.element(start).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
  const box = (element: Element) => element.getBoundingClientRect();
  const days = box(screen.getByRole("group", { name: "Ngày làm việc" }).element());
  const end = screen.getByRole("button", { name: /Giờ kết thúc/ }).element();
  const phone = screen.getByRole("textbox", { name: "Số điện thoại" }).element();
  const email = screen.getByRole("textbox", { name: "Email" }).element();
  const website = screen.getByRole("textbox", { name: "Website" }).element();

  // The same three columns: the days across the first two (under the phone and the email, on one line), the two
  // hours sharing the third (under the website).
  expect(Math.round(days.left)).toBe(Math.round(box(phone).left));
  expect(days.right).toBeLessThanOrEqual(box(email).right + 1);
  expect(Math.round(box(start.element()).left)).toBe(Math.round(box(website).left));
  expect(Math.round(box(end).right)).toBe(Math.round(box(website).right));
  expect(box(end).top).toBe(box(start.element()).top);
  const chips = screen.getByRole("group", { name: "Ngày làm việc" }).getByRole("button").elements().map((chip) => box(chip).top);
  expect(new Set(chips).size).toBe(1);
  // On one line, the chips level with the fields.
  expect(Math.abs(days.bottom - box(end).bottom)).toBeLessThan(6);
  // The hours look like the fields above them.
  expect(getComputedStyle(end).backgroundColor).toBe(getComputedStyle(website).backgroundColor);
});
