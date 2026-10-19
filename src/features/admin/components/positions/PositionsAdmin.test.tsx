import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type PositionDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { PositionsAdmin } from "./PositionsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/positions" }));
afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

// Deliberately not in level order: the page sorts them.
const positions: PositionDto[] = [
  { id: 3, code: "NV", name: "Nhân viên", originalName: "Nhân viên", level: 5, description: null, isActive: true },
  { id: 1, code: "GD", name: "Giám đốc", originalName: "Giám đốc", level: 1, description: "Điều hành chung", isActive: true },
  { id: 2, code: "KTT", name: "Kế toán trưởng", originalName: "Kế toán trưởng", level: 3, description: null, isActive: true },
  { id: 4, code: "TTS", name: "Thực tập sinh", originalName: "Thực tập sinh", level: 9, description: null, isActive: false },
];

type Write = { method: string; path: string; body: unknown };
/**
 * Answers the list as the server would (filtered by IsActive and Search), and each write with `reply` (no content by
 * default, after `gate` if given); returns the writes and every path requested, with its query string.
 */
function mockPositions(
  reply: (write: Write) => Response = () => new Response(null, { status: 204 }),
  list: PositionDto[] = positions,
  /** Holds every write's answer back until it settles: a slow server. */
  gate?: Promise<void>,
) {
  const writes: Write[] = [];
  const requested: string[] = [];
  const failing = { value: false };
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (url, init) => {
    const { pathname, search, searchParams } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path + search);
    if (path === "/api/Positions" && init.method === "GET") {
      if (failing.value) return new Response(null, { status: 500 });
      const isActive = searchParams.get("IsActive");
      const text = (searchParams.get("Search") ?? "").toLowerCase();
      return Response.json(list.filter((p) => (isActive === null || String(p.isActive) === isActive) && p.name.toLowerCase().includes(text)));
    }
    if (path.startsWith("/api/Positions")) {
      const write = { method: init.method, path: path + search, body: init.body ? JSON.parse(init.body) : null };
      writes.push(write);
      await gate;
      return reply(write);
    }
    return Response.json({});
  }));
  return { writes, requested, failing };
}

// The server shows the name in the viewer's language; originalName is what is stored and what a write must send back.
const translated: PositionDto[] = [
  { id: 6, code: "TL", name: "Assistant", originalName: "Trợ lý", level: 4, description: null, isActive: true },
  { id: 7, code: "CV", name: "Specialist", originalName: "Chuyên viên", level: 6, description: "Chuyên môn", isActive: false },
];

const everyRight = [
  Permissions.Positions.View, Permissions.Positions.Create, Permissions.Positions.Update, Permissions.Positions.Delete,
];

function Harness({ permissions = [Permissions.Positions.View] }: { permissions?: string[] }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><Toast.Provider /><PositionsAdmin /></Provider>;
}

type Screen = Awaited<ReturnType<typeof render>>;
const positionRequests = (requested: string[]) => requested.filter((path) => path.startsWith("/api/Positions"));
const rowOf = (screen: Screen, name: RegExp | string) => screen.getByRole("row", { name });

/** Opens the menu of the row named `name`; returns the names of its items. */
async function openRowMenu(screen: Screen, name: string) {
  await userEvent.click(screen.getByRole("button", { name: `Thao tác · ${name}` }));
  await expect.element(screen.getByRole("menu")).toBeVisible();
  return screen.getByRole("menuitem").elements().map((item) => item.textContent);
}

test("without the right to view positions, the no-access alert and no request", async () => {
  const { requested } = mockPositions();
  const screen = await render(<Harness permissions={[]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByRole("searchbox", { name: "Tìm chức vụ" })).not.toBeInTheDocument();
  expect(requested).toEqual([]);
});

test("lists the positions by level with code, level and status; the discontinued ones are hidden by default", async () => {
  const { requested } = mockPositions();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("heading", { name: "Chức vụ" })).toBeVisible();
  const director = rowOf(screen, /Giám đốc/);
  await expect.element(director).toHaveTextContent("GD");
  await expect.element(director).toHaveTextContent("Điều hành chung");
  await expect.element(director).toHaveTextContent("Đang dùng");

  // Level first, then name: the list came in another order.
  await expect.element(rowOf(screen, /Nhân viên/)).toBeVisible();
  const rows = screen.getByRole("row").elements().slice(1);
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining("Giám đốc"),
    expect.stringContaining("Kế toán trưởng"),
    expect.stringContaining("Nhân viên"),
  ]);
  expect(rows[1].textContent).toContain("KTT");
  expect(rows[1].textContent).toContain("3");
  await expect.element(rowOf(screen, /Thực tập sinh/)).not.toBeInTheDocument();
  expect(positionRequests(requested)).toEqual(["/api/Positions?IsActive=true"]);
  // The number of positions shown.
  await expect.element(screen.getByTestId("positions-count")).toHaveTextContent("3");
});

test("searching asks the server; the status filter can show the discontinued ones, or all", async () => {
  const { requested } = mockPositions();
  const screen = await render(<Harness />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();

  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm chức vụ" }), "kế");
  await vi.waitFor(() => expect(positionRequests(requested).at(-1)).toBe("/api/Positions?IsActive=true&Search=k%E1%BA%BF"));
  await userEvent.clear(screen.getByRole("searchbox", { name: "Tìm chức vụ" }));

  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
  await vi.waitFor(() => expect(positionRequests(requested).at(-1)).toBe("/api/Positions?IsActive=false"));
  await expect.element(rowOf(screen, /Thực tập sinh/)).toHaveTextContent("Ngừng sử dụng");

  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Tất cả" }));
  await vi.waitFor(() => expect(positionRequests(requested).at(-1)).toBe("/api/Positions"));
  await expect.element(rowOf(screen, /Thực tập sinh/)).toBeVisible();
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
});

test("a failed load offers a retry", async () => {
  const { failing } = mockPositions();
  failing.value = true;
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Không tải được danh sách chức vụ.")).toBeVisible();
  failing.value = false;
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
});

test("no positions yet: the empty notice, with the add button for whoever may add", async () => {
  mockPositions(undefined, []);
  const viewer = await render(<Harness />);
  await expect.element(viewer.getByText("Chưa có chức vụ nào.")).toBeVisible();
  await expect.element(viewer.getByRole("button", { name: "Thêm chức vụ" })).not.toBeInTheDocument();
  await viewer.unmount();

  const creator = await render(<Harness permissions={[Permissions.Positions.View, Permissions.Positions.Create]} />);
  await expect.element(creator.getByText("Chưa có chức vụ nào.")).toBeVisible();
  await expect.element(creator.getByRole("button", { name: "Thêm chức vụ" }).first()).toBeVisible();
});

test("creating: the code follows the name until it is typed, and an empty description is sent as null", async () => {
  const { writes, requested } = mockPositions(() => Response.json(7, { status: 201 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
  const listings = () => positionRequests(requested).filter((path) => path.startsWith("/api/Positions?")).length;
  const before = listings();

  await userEvent.click(screen.getByRole("button", { name: "Thêm chức vụ" }));
  const dialog = screen.getByRole("dialog", { name: "Thêm chức vụ" });
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Trưởng phòng");
  await expect.element(dialog.getByRole("textbox", { name: /^Mã/ })).toHaveValue("TP");
  await expect.element(dialog.getByText("1 là cao nhất")).toBeVisible();
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "2");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));

  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Positions", body: { code: "TP", name: "Trưởng phòng", level: 2, description: null } },
  ]));
  await expect.element(screen.getByText("Đã thêm chức vụ")).toBeVisible();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  // The new position is in the list: it was asked for again.
  await vi.waitFor(() => expect(listings()).toBeGreaterThan(before));
});

test("a code typed by hand stays put when the name changes", async () => {
  const { writes } = mockPositions(() => Response.json(7, { status: 201 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chức vụ" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Trưởng phòng");
  await userEvent.fill(dialog.getByRole("textbox", { name: /^Mã/ }), "TRUONGPHONG");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Phó phòng");
  await expect.element(dialog.getByRole("textbox", { name: /^Mã/ })).toHaveValue("TRUONGPHONG");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "4");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Mô tả" }), "  Giúp trưởng phòng ");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Positions", body: { code: "TRUONGPHONG", name: "Phó phòng", level: 4, description: "Giúp trưởng phòng" } },
  ]));
});

test("the name, the code and a level from 1 to 100 are required before anything is sent", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everyRight} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chức vụ" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await expect.element(dialog.getByText("Nhập tên chức vụ.")).toBeVisible();
  await expect.element(dialog.getByText("Nhập mã chức vụ.")).toBeVisible();
  await expect.element(dialog.getByText("Cấp bậc là số nguyên từ 1 đến 100.")).toBeVisible();

  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Trưởng phòng");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "101");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await expect.element(dialog.getByText("Cấp bậc là số nguyên từ 1 đến 100.")).toBeVisible();
  expect(writes).toEqual([]);
});

test("editing sends the position's own name as originalName, with the edited fields", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
  expect(await openRowMenu(screen, "Giám đốc")).toEqual(["Sửa", "Ngừng sử dụng", "Xoá"]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Sửa" }));

  const dialog = screen.getByRole("dialog", { name: "Sửa chức vụ" });
  await expect.element(dialog.getByRole("textbox", { name: "Tên chức vụ" })).toHaveValue("Giám đốc");
  await expect.element(dialog.getByRole("textbox", { name: /^Mã/ })).toHaveValue("GD");
  await expect.element(dialog.getByRole("spinbutton", { name: "Cấp bậc" })).toHaveValue(1);
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Tổng giám đốc");
  // An existing position keeps its code when the name changes.
  await expect.element(dialog.getByRole("textbox", { name: /^Mã/ })).toHaveValue("GD");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "2");
  await userEvent.clear(dialog.getByRole("textbox", { name: "Mô tả" }));
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));

  await vi.waitFor(() => expect(writes).toEqual([{
    method: "PUT",
    path: "/api/Positions/1",
    body: { code: "GD", name: "Tổng giám đốc", originalName: "Tổng giám đốc", level: 2, description: null, isActive: true },
  }]));
  await expect.element(screen.getByText("Đã lưu chức vụ")).toBeVisible();
});

test("ngừng sử dụng sends the row's fields with isActive false; kích hoạt lại sends true", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();

  await openRowMenu(screen, "Giám đốc");
  await userEvent.click(screen.getByRole("menuitem", { name: "Ngừng sử dụng" }));
  await vi.waitFor(() => expect(writes).toEqual([{
    method: "PUT",
    path: "/api/Positions/1",
    body: { code: "GD", name: "Giám đốc", originalName: "Giám đốc", level: 1, description: "Điều hành chung", isActive: false },
  }]));
  await expect.element(screen.getByText("Đã ngừng sử dụng chức vụ")).toBeVisible();

  // The discontinued ones are under the status filter.
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
  await expect.element(rowOf(screen, /Thực tập sinh/)).toBeVisible();
  expect(await openRowMenu(screen, "Thực tập sinh")).toEqual(["Sửa", "Kích hoạt lại", "Xoá"]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Kích hoạt lại" }));
  await vi.waitFor(() => expect(writes.at(-1)).toEqual({
    method: "PUT",
    path: "/api/Positions/4",
    body: { code: "TTS", name: "Thực tập sinh", originalName: "Thực tập sinh", level: 9, description: null, isActive: true },
  }));
  await expect.element(screen.getByText("Đã kích hoạt lại chức vụ")).toBeVisible();
});

test("deleting asks first, then removes the position", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Nhân viên/)).toBeVisible();
  await openRowMenu(screen, "Nhân viên");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog.getByText("Xoá chức vụ \"Nhân viên\"?")).toBeVisible();
  expect(writes).toEqual([]);
  await userEvent.click(dialog.getByRole("button", { name: "Xoá" }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Positions/3", body: null }]));
  await expect.element(screen.getByText("Đã xoá chức vụ")).toBeVisible();
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

const heldDetail = "Chức danh đang có người giữ. Hãy chuyển họ sang chức danh khác, hoặc ngừng sử dụng chức danh này thay vì xoá.";

test("a position people hold cannot be deleted: the reason is shown, with Ngừng sử dụng instead", async () => {
  const { writes } = mockPositions((write) =>
    write.method === "DELETE" ? Response.json({ status: 409, code: "conflict", detail: heldDetail }, { status: 409 }) : new Response(null, { status: 204 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Nhân viên/)).toBeVisible();
  await openRowMenu(screen, "Nhân viên");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Xoá" }));

  const refusal = screen.getByRole("alertdialog");
  await expect.element(refusal.getByText(heldDetail)).toBeVisible();
  await userEvent.click(refusal.getByRole("button", { name: "Ngừng sử dụng" }));
  await vi.waitFor(() => expect(writes.at(-1)).toEqual({
    method: "PUT",
    path: "/api/Positions/3",
    body: { code: "NV", name: "Nhân viên", originalName: "Nhân viên", level: 5, description: null, isActive: false },
  }));
  await expect.element(screen.getByText("Đã ngừng sử dụng chức vụ")).toBeVisible();
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

test("a refused delete without the right to discontinue only says why, with a Close button", async () => {
  mockPositions((write) =>
    write.method === "DELETE" ? Response.json({ status: 409, code: "conflict", detail: heldDetail }, { status: 409 }) : new Response(null, { status: 204 }));
  const screen = await render(<Harness permissions={[Permissions.Positions.View, Permissions.Positions.Delete]} />);
  await expect.element(rowOf(screen, /Nhân viên/)).toBeVisible();
  await openRowMenu(screen, "Nhân viên");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Xoá" }));
  const refusal = screen.getByRole("alertdialog");
  await expect.element(refusal.getByText(heldDetail)).toBeVisible();
  await expect.element(refusal.getByRole("button", { name: "Ngừng sử dụng" })).not.toBeInTheDocument();
  await expect.element(refusal.getByRole("button", { name: "Xoá" })).not.toBeInTheDocument();
  await userEvent.click(refusal.getByRole("button", { name: "Đóng" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

test("a refused delete of a position already discontinued says why and offers nothing else", async () => {
  mockPositions((write) =>
    write.method === "DELETE" ? Response.json({ status: 409, code: "conflict", detail: heldDetail }, { status: 409 }) : new Response(null, { status: 204 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
  await expect.element(rowOf(screen, /Thực tập sinh/)).toBeVisible();
  await openRowMenu(screen, "Thực tập sinh");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Xoá" }));
  const refusal = screen.getByRole("alertdialog");
  await expect.element(refusal.getByText(heldDetail)).toBeVisible();
  await expect.element(refusal.getByRole("button", { name: "Ngừng sử dụng" })).not.toBeInTheDocument();
  await expect.element(refusal.getByRole("button", { name: "Đóng" })).toBeVisible();
});

test("when discontinuing instead fails, the dialog stays and the reason is toasted", async () => {
  mockPositions((write) =>
    write.method === "DELETE" ? Response.json({ status: 409, code: "conflict", detail: heldDetail }, { status: 409 })
      : Response.json({ status: 500, code: "server_error", detail: "Máy chủ gặp sự cố." }, { status: 500 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Nhân viên/)).toBeVisible();
  await openRowMenu(screen, "Nhân viên");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Ngừng sử dụng" }));
  await expect.element(screen.getByText("Máy chủ gặp sự cố.")).toBeVisible();
  await expect.element(screen.getByRole("alertdialog").getByText(heldDetail)).toBeVisible();
});

test("each right shows its own control, and none shows none", async () => {
  mockPositions();
  const viewer = await render(<Harness />);
  await expect.element(rowOf(viewer, /Giám đốc/)).toBeVisible();
  await expect.element(viewer.getByRole("button", { name: "Thêm chức vụ" })).not.toBeInTheDocument();
  await expect.element(viewer.getByRole("button", { name: /Thao tác/ })).not.toBeInTheDocument();
  await viewer.unmount();

  const creator = await render(<Harness permissions={[Permissions.Positions.View, Permissions.Positions.Create]} />);
  await expect.element(creator.getByRole("button", { name: "Thêm chức vụ" })).toBeVisible();
  await expect.element(creator.getByRole("button", { name: /Thao tác/ })).not.toBeInTheDocument();
  await creator.unmount();

  const updater = await render(<Harness permissions={[Permissions.Positions.View, Permissions.Positions.Update]} />);
  await expect.element(rowOf(updater, /Giám đốc/)).toBeVisible();
  await expect.element(updater.getByRole("button", { name: "Thêm chức vụ" })).not.toBeInTheDocument();
  expect(await openRowMenu(updater, "Giám đốc")).toEqual(["Sửa", "Ngừng sử dụng"]);
  await updater.unmount();

  const remover = await render(<Harness permissions={[Permissions.Positions.View, Permissions.Positions.Delete]} />);
  await expect.element(rowOf(remover, /Giám đốc/)).toBeVisible();
  expect(await openRowMenu(remover, "Giám đốc")).toEqual(["Xoá"]);
});

test("a field error from the server shows under that field", async () => {
  const { writes } = mockPositions(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { Code: ["Mã 'TP' đã tồn tại."] },
  }, { status: 400 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chức vụ" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Trưởng phòng");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "2");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));

  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(dialog.getByText("Mã 'TP' đã tồn tại.")).toBeVisible();
  // Said under the field, not twice.
  await expect.element(dialog.getByText("Vui lòng kiểm tra lại các trường được báo lỗi.")).not.toBeInTheDocument();
  await expect.element(dialog.getByRole("textbox", { name: /^Mã/ })).toBeInvalid();
});

test("a refusal that is not about a field shows in an alert in the dialog", async () => {
  mockPositions(() => Response.json({ status: 500, code: "server_error", detail: "Máy chủ gặp sự cố." }, { status: 500 }));
  const screen = await render(<Harness permissions={everyRight} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chức vụ" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức vụ" }), "Trưởng phòng");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "2");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Máy chủ gặp sự cố.");
});

test("a position shown in another language is written back under its own name, as name and originalName", async () => {
  const { writes } = mockPositions(undefined, translated);
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Assistant/)).toBeVisible();

  // Discontinue: the stored name goes, not the shown one.
  await openRowMenu(screen, "Assistant");
  await userEvent.click(screen.getByRole("menuitem", { name: "Ngừng sử dụng" }));
  await vi.waitFor(() => expect(writes).toEqual([{
    method: "PUT",
    path: "/api/Positions/6",
    body: { code: "TL", name: "Trợ lý", originalName: "Trợ lý", level: 4, description: null, isActive: false },
  }]));

  // Reactivate.
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
  await expect.element(rowOf(screen, /Specialist/)).toBeVisible();
  await openRowMenu(screen, "Specialist");
  await userEvent.click(screen.getByRole("menuitem", { name: "Kích hoạt lại" }));
  await vi.waitFor(() => expect(writes.at(-1)).toEqual({
    method: "PUT",
    path: "/api/Positions/7",
    body: { code: "CV", name: "Chuyên viên", originalName: "Chuyên viên", level: 6, description: "Chuyên môn", isActive: true },
  }));
});

test("the edit dialog starts from the stored name and sends it back", async () => {
  const { writes } = mockPositions(undefined, translated);
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Assistant/)).toBeVisible();
  await openRowMenu(screen, "Assistant");
  await userEvent.click(screen.getByRole("menuitem", { name: "Sửa" }));
  const dialog = screen.getByRole("dialog", { name: "Sửa chức vụ" });
  await expect.element(dialog.getByRole("textbox", { name: "Tên chức vụ" })).toHaveValue("Trợ lý");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "3");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([{
    method: "PUT",
    path: "/api/Positions/6",
    body: { code: "TL", name: "Trợ lý", originalName: "Trợ lý", level: 3, description: null, isActive: true },
  }]));
});

test("editing a discontinued position keeps it discontinued", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
  await expect.element(rowOf(screen, /Thực tập sinh/)).toBeVisible();
  await openRowMenu(screen, "Thực tập sinh");
  await userEvent.click(screen.getByRole("menuitem", { name: "Sửa" }));
  const dialog = screen.getByRole("dialog", { name: "Sửa chức vụ" });
  await userEvent.fill(dialog.getByRole("textbox", { name: "Mô tả" }), "Học việc");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([{
    method: "PUT",
    path: "/api/Positions/4",
    body: { code: "TTS", name: "Thực tập sinh", originalName: "Thực tập sinh", level: 9, description: "Học việc", isActive: false },
  }]));
});

test("a second pick of Ngừng sử dụng while the first is on its way sends nothing more", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { writes } = mockPositions(undefined, positions, gate);
  const screen = await render(<Harness permissions={everyRight} />);
  await expect.element(rowOf(screen, /Giám đốc/)).toBeVisible();
  await openRowMenu(screen, "Giám đốc");
  await userEvent.click(screen.getByRole("menuitem", { name: "Ngừng sử dụng" }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await openRowMenu(screen, "Giám đốc");
  await userEvent.click(screen.getByRole("menuitem", { name: "Ngừng sử dụng" }));
  release();
  await expect.element(screen.getByText("Đã ngừng sử dụng chức vụ")).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("the name, the code and the level are marked as required", async () => {
  mockPositions();
  const screen = await render(<Harness permissions={everyRight} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chức vụ" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("textbox", { name: "Tên chức vụ" })).toBeRequired();
  await expect.element(dialog.getByRole("textbox", { name: /^Mã/ })).toBeRequired();
  await expect.element(dialog.getByRole("spinbutton", { name: "Cấp bậc" })).toBeRequired();
  await expect.element(dialog.getByRole("textbox", { name: "Mô tả" })).not.toBeRequired();
});
