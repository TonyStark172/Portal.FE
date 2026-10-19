/**
 * Dragging is driven with synthetic pointer events (pointerdown on the handle, a first pointermove past the 6 px
 * activation distance, a second one over the target card's centre, pointerup), see `drag` below. They go through
 * dnd-kit's own PointerSensor and collision detection exactly as a mouse does, but are deterministic: the real mouse
 * of the Vitest browser cannot reach cards that are scrolled out of the canvas. One test drives the keyboard sensor's
 * custom coordinate getter instead (Space, arrows, Space).
 */
import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentChartDto, type DepartmentChartNode, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentsAdmin } from "./DepartmentsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/departments" }));
afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, method: string) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, request.method);
  };

const node = (fields: Partial<DepartmentChartNode> & Pick<DepartmentChartNode, "id" | "name">): DepartmentChartNode => ({
  code: `D${fields.id}`, originalName: fields.name, description: null, parentId: null, isActive: true,
  memberCount: 0, childCount: 0, headCount: 0, heads: [], ...fields,
});

const chart: DepartmentChartDto = {
  organizationName: "Báo Tuổi Trẻ",
  myDepartmentIds: [3],
  departments: [
    node({ id: 1, name: "Ban Giám đốc", childCount: 2, memberCount: 3 }),
    node({
      id: 2, name: "Phòng Kỹ thuật", parentId: 1, childCount: 1, memberCount: 7, headCount: 2,
      heads: [{ userId: 11, fullName: "An", avatarUrl: null }],
    }),
    node({ id: 3, name: "Tổ Mạng", parentId: 2, memberCount: 2 }),
    node({ id: 4, name: "Phòng cũ", parentId: 1, isActive: false }),
  ],
};

/** Answers the chart; returns every API path requested, in order. */
function mockChart(body: DepartmentChartDto = chart) {
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url) => {
    const path = new URL(url).pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path);
    if (path === "/api/Departments/chart") return Response.json(body);
    // The details panel's lists: nobody in any group (and nobody to pick).
    if (path === "/api/Users") {
      return Response.json({ items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false });
    }
    if (/^\/api\/Departments\/\d+\/members$/.test(path)) {
      return Response.json({ items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false });
    }
    return Response.json({});
  }));
  return requested;
}

const everything = [Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update, Permissions.Departments.Delete];

function Harness({ permissions }: { permissions: string[] }) {
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
  return <Provider store={store}><Toast.Provider /><DepartmentsAdmin /></Provider>;
}

test("without Departments.View, the no-access alert and no request", async () => {
  const requested = mockChart();
  const screen = await render(<Harness permissions={[Permissions.Users.View]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByText("Báo Tuổi Trẻ")).not.toBeInTheDocument();
  expect(requested).toEqual([]);
});

test("with Departments.View, the page region and no alert", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await expect.element(screen.getByRole("region", { name: "Phòng ban" })).toBeInTheDocument();
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).not.toBeInTheDocument();
});

test("draws the organization and the tree", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByText("Báo Tuổi Trẻ")).toBeVisible();
  const engineering = screen.getByRole("group", { name: "Phòng Kỹ thuật" });
  await expect.element(engineering).toBeVisible();
  await expect.element(engineering.getByText("An", { exact: true })).toBeVisible();
  await expect.element(engineering.getByText("+1")).toBeVisible();
  await expect.element(engineering.getByText("7 nhân viên")).toBeVisible();
  const network = screen.getByRole("group", { name: "Tổ Mạng" });
  await expect.element(network.getByText("Chưa có trưởng phòng")).toBeVisible();
  await expect.element(network.getByText("Phòng của bạn")).toBeVisible();
});

test("collapsing a card hides its sub-departments", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await screen.getByRole("button", { name: "1 phòng ban con" }).click();
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "1 phòng ban con" }).click();
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
});

test("find me opens the viewer's department", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "1 phòng ban con" }).click();
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Tìm tôi" }).click();
  const mine = screen.getByRole("group", { name: "Tổ Mạng" });
  await expect.element(mine).toBeVisible();
  await expect.element(mine).toHaveAttribute("aria-current", "true");
});

test("an inactive department is faded and has no add button", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  const old = screen.getByRole("group", { name: "Phòng cũ" });
  await expect.element(old).toHaveClass("opacity-60");
  await expect.element(old.getByText("Ngừng hoạt động")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban con vào Phòng cũ" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban con vào Phòng Kỹ thuật" })).toBeVisible();
});

test("without Departments.Create there is no add button anywhere", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View, Permissions.Departments.Update]} />);
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /^Thêm phòng ban/ })).not.toBeInTheDocument();
});

test("zoom shows its level", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByText("100 %")).toBeVisible();
  await screen.getByRole("button", { name: "Phóng to" }).click();
  await expect.element(screen.getByText("110 %")).toBeVisible();
  await screen.getByRole("button", { name: "Thu nhỏ" }).click();
  await screen.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect.element(screen.getByText("90 %")).toBeVisible();
});

test("a menu offers only the actions the viewer may do", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View, Permissions.Departments.Delete]} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await expect.element(screen.getByRole("menuitem", { name: "Xóa phòng ban" })).toBeVisible();
  await expect.element(screen.getByRole("menuitem", { name: "Sửa phòng ban" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
});

test("an empty list says so", async () => {
  mockChart({ organizationName: "Báo Tuổi Trẻ", departments: [], myDepartmentIds: [] });
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByText("Chưa có phòng ban nào. Bắt đầu bằng cách thêm phòng ban đầu tiên.")).toBeVisible();
});

const selectEngineering = async (screen: Awaited<ReturnType<typeof render>>) =>
  screen.getByRole("group", { name: "Phòng Kỹ thuật" }).getByRole("button", { name: "Phòng Kỹ thuật", exact: true }).click();

test("selecting a card opens its details panel and closing it clears the selection", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).not.toBeInTheDocument();
  await selectEngineering(screen);
  const panel = screen.getByRole("complementary", { name: "Chi tiết phòng ban" });
  await expect.element(panel.getByRole("heading", { name: "Phòng Kỹ thuật" })).toBeVisible();
  await expect.element(panel.getByText("Tổng 7 nhân viên")).toBeVisible();
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).toHaveAttribute("aria-current", "true");

  await panel.getByRole("button", { name: "Đóng chi tiết" }).click();
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).not.toHaveAttribute("aria-current");
});

test("the panel's menu offers what the card's does", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  const names = () => screen.getByRole("menuitem").elements().map((item) => item.textContent);
  await expect.element(screen.getByRole("menu")).toBeVisible();
  const cardItems = names();
  await userEvent.keyboard("{Escape}");

  await selectEngineering(screen);
  await screen.getByRole("button", { name: "Thao tác phòng ban" }).click();
  await expect.element(screen.getByRole("menu")).toBeVisible();
  expect(names()).toEqual(cardItems);
  expect(cardItems).toContain("Chuyển nhân viên về phòng này");
});

test("the card menu's staff items open the add-people dialog", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await screen.getByRole("menuitem", { name: "Chuyển nhân viên về phòng này" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Chuyển nhân viên về phòng này" })).toBeVisible();
  await screen.getByRole("button", { name: "Huỷ" }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await screen.getByRole("menuitem", { name: "Thêm nhân viên đa phòng ban" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Thêm nhân viên đa phòng ban" })).toBeVisible();
});

test("the wizard opens from the toolbar under the selected department, and from a card's menu in edit mode", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thêm phòng ban", exact: true }).click();
  await expect.element(screen.getByRole("dialog", { name: "Thêm phòng ban" })).toBeVisible();
  // Nothing selected: it hangs from the organization.
  await expect.element(screen.getByRole("region", { name: "Xem trước" }).getByText("Báo Tuổi Trẻ")).toBeVisible();
  await screen.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

  await selectEngineering(screen);
  await screen.getByRole("button", { name: "Thêm phòng ban", exact: true }).click();
  await expect.element(screen.getByRole("region", { name: "Xem trước" }).getByText("Phòng Kỹ thuật")).toBeVisible();
  await screen.getByRole("button", { name: "Đóng", exact: true }).click();

  await screen.getByRole("button", { name: "Thao tác với Tổ Mạng" }).click();
  await screen.getByRole("menuitem", { name: "Sửa phòng ban" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Sửa phòng ban" })).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Tên phòng ban" })).toHaveValue("Tổ Mạng");
});

test("the '+' under the organization opens the wizard, and a saved department is selected", async () => {
  let created = false;
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, method) => {
    const path = new URL(url).pathname.replace(/^.*?(?=\/api\/)/, "");
    if (method === "POST" && path === "/api/Departments") {
      created = true;
      return Response.json(9, { status: 201 });
    }
    if (path === "/api/Departments/chart") {
      return Response.json(created ? { ...chart, departments: [...chart.departments, node({ id: 9, name: "Kế toán", parentId: null })] } : chart);
    }
    if (path === "/api/Users" || /^\/api\/Departments\/\d+\/members$/.test(path)) {
      return Response.json({ items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false });
    }
    return Response.json({});
  }));
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thêm phòng ban con vào Báo Tuổi Trẻ" }).click();
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên phòng ban" }), "Kế toán");
  await screen.getByRole("button", { name: "Tạo phòng ban" }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("group", { name: "Kế toán" })).toHaveAttribute("aria-current", "true");
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).toBeVisible();
});

// ---- Moving, undoing, deactivating and deleting ---------------------------------------------------------------

type Write = { method: string; path: string; body: unknown };
const emptyPage = { items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false };

const withBody = (handler: (url: string, method: string, body: string | null) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, request.method, ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text());
  };

/** Answers the chart and the empty lists; records every write and answers it with `reply` (default: 204). */
function mockWrites(reply: (write: Write) => Response = () => new Response(null, { status: 204 })) {
  const writes: Write[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withBody(async (url, method, body) => {
    const path = new URL(url).pathname.replace(/^.*?(?=\/api\/)/, "");
    if (method !== "GET") {
      const write = { method, path, body: body ? JSON.parse(body) : null };
      writes.push(write);
      return reply(write);
    }
    if (path === "/api/Departments/chart") return Response.json(chart);
    return Response.json(emptyPage);
  }));
  return writes;
}

const problem = (status: number, detail: string) => Response.json({ status, code: status === 409 ? "conflict" : "unknown", detail }, { status });
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const centre = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

type Screen = Awaited<ReturnType<typeof render>>;

/** Lifts a card by its handle and drops it on another card (or the organization card), with pointer events. */
async function drag(screen: Screen, name: string, onto: string) {
  const handle = screen.getByRole("button", { name: `Kéo để chuyển ${name}` }).element();
  const target = onto === "Báo Tuổi Trẻ" ? screen.getByText(onto).element().parentElement! : screen.getByRole("group", { name: onto }).element();
  target.scrollIntoView({ block: "center", inline: "center" });
  const from = centre(handle);
  const to = centre(target);
  const pointer = (type: string, at: { x: number; y: number }) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: at.x, clientY: at.y });
  handle.dispatchEvent(pointer("pointerdown", from));
  document.dispatchEvent(pointer("pointermove", { x: from.x + 10, y: from.y }));
  await frame();
  document.dispatchEvent(pointer("pointermove", to));
  await frame();
  document.dispatchEvent(pointer("pointerup", to));
  await frame();
}

test("dropping a department on another moves it under it", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  // The inactive department is not a drop target.
  await drag(screen, "Tổ Mạng", "Phòng cũ");
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(writes).toEqual([]);

  await drag(screen, "Tổ Mạng", "Ban Giám đốc");
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "PUT", path: "/api/Departments/3/parent", body: { parentId: 1 } });
  await expect.element(screen.getByText("Đã chuyển Tổ Mạng vào Ban Giám đốc")).toBeVisible();
});

test("dropping on the organization card moves a department to the top level", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await drag(screen, "Tổ Mạng", "Báo Tuổi Trẻ");
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "PUT", path: "/api/Departments/3/parent", body: { parentId: null } });
  await expect.element(screen.getByText("Đã chuyển Tổ Mạng vào Báo Tuổi Trẻ")).toBeVisible();
});

test("a drop on its own sub-department sends nothing", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await drag(screen, "Phòng Kỹ thuật", "Tổ Mạng");
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(writes).toEqual([]);
});

test("undo moves it back", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await drag(screen, "Tổ Mạng", "Ban Giám đốc");
  await screen.getByRole("button", { name: "Hoàn tác" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toEqual({ method: "PUT", path: "/api/Departments/3/parent", body: { parentId: 2 } });
  await expect.element(screen.getByText("Đã hoàn tác.")).toBeVisible();
});

test("a move the server refuses says why", async () => {
  const writes = mockWrites(() => problem(409, "Không thể chuyển phòng ban vào phòng ban con của chính nó."));
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await drag(screen, "Tổ Mạng", "Ban Giám đốc");
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByText("Không thể chuyển phòng ban vào phòng ban con của chính nó.")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Hoàn tác" })).not.toBeInTheDocument();
});

test("the keyboard sensor lifts a card with Space, steers with the arrows and drops with Space", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  screen.getByRole("button", { name: "Kéo để chuyển Tổ Mạng" }).element().focus();
  await userEvent.keyboard(" ");
  // Tổ Mạng hangs from Phòng Kỹ thuật, which hangs from Ban Giám đốc: the nearest card above is Phòng Kỹ thuật (its
  // own parent, no move), the next one up is Ban Giám đốc.
  await userEvent.keyboard("{ArrowUp}");
  await userEvent.keyboard("{ArrowUp}");
  await userEvent.keyboard(" ");
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toEqual({ parentId: 1 });
});

test("nobody without Departments.Update sees a drag handle", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View, Permissions.Departments.Create]} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /^Kéo để chuyển/ })).not.toBeInTheDocument();
});

test("deactivating asks first, then sends isActive false", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await screen.getByRole("menuitem", { name: "Ngừng hoạt động" }).click();
  // (A toast is an alertdialog too, so the dialog is found by its title.)
  const dialog = screen.getByRole("alertdialog", { name: "Ngừng hoạt động Phòng Kỹ thuật?" });
  await expect.element(dialog).toBeVisible();
  expect(writes).toEqual([]);
  await dialog.getByRole("button", { name: "Ngừng hoạt động" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "PUT", path: "/api/Departments/2/active", body: { isActive: false } });
  await expect.element(dialog).not.toBeInTheDocument();
});

test("reactivating an inactive department sends isActive true, and a refusal is a toast", async () => {
  const writes = mockWrites(() => problem(409, "Hãy kích hoạt lại phòng ban cha trước."));
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng cũ" }).click();
  await screen.getByRole("menuitem", { name: "Kích hoạt lại" }).click();
  const dialog = screen.getByRole("alertdialog", { name: "Kích hoạt lại Phòng cũ?" });
  await dialog.getByRole("button", { name: "Kích hoạt lại" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "PUT", path: "/api/Departments/4/active", body: { isActive: true } });
  await expect.element(screen.getByText("Hãy kích hoạt lại phòng ban cha trước.")).toBeVisible();
  await expect.element(dialog).not.toBeInTheDocument();
});

/** Opens the delete dialog of a department from its card menu; returns the dialog (found by its title, as toasts are alertdialogs too). */
const openDelete = async (screen: Screen, name: string) => {
  await screen.getByRole("button", { name: `Thao tác với ${name}` }).click();
  await screen.getByRole("menuitem", { name: "Xóa phòng ban" }).click();
  return screen.getByRole("alertdialog", { name: `Xóa phòng ban ${name}?` });
};

test("deleting a department with nothing in it confirms and deletes", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  const dialog = await openDelete(screen, "Tổ Mạng");
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Xoá" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "DELETE", path: "/api/Departments/3", body: null });
  await expect.element(dialog).not.toBeInTheDocument();
});

test("deleting the selected department clears the panel", async () => {
  mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await selectEngineering(screen);
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).toBeVisible();
  await screen.getByRole("button", { name: "Thao tác phòng ban" }).click();
  await screen.getByRole("menuitem", { name: "Xóa phòng ban" }).click();
  await screen.getByRole("alertdialog", { name: "Xóa phòng ban Phòng Kỹ thuật?" }).getByRole("button", { name: "Xoá" }).click();
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).not.toBeInTheDocument();
});

test("deleting a department where only people who left remain offers deactivating", async () => {
  const detail = "Phòng ban đang có 2 người đã nghỉ việc. Hãy chuyển họ đi hoặc ngừng hoạt động phòng ban.";
  const writes = mockWrites((write) => (write.method === "DELETE" ? problem(409, detail) : new Response(null, { status: 204 })));
  const screen = await render(<Harness permissions={everything} />);
  const dialog = await openDelete(screen, "Phòng Kỹ thuật");
  await dialog.getByRole("button", { name: "Xoá" }).click();
  await expect.element(dialog.getByText(detail)).toBeVisible();
  await dialog.getByRole("button", { name: "Ngừng hoạt động" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toEqual({ method: "PUT", path: "/api/Departments/2/active", body: { isActive: false } });
  await expect.element(dialog).not.toBeInTheDocument();
});

test("a delete refused for sub-departments offers no deactivating", async () => {
  const detail = "Phòng ban đang có phòng ban con. Hãy chuyển hoặc xóa chúng trước.";
  mockWrites(() => problem(409, detail));
  const screen = await render(<Harness permissions={everything} />);
  const dialog = await openDelete(screen, "Phòng Kỹ thuật");
  await dialog.getByRole("button", { name: "Xoá" }).click();
  await expect.element(dialog.getByText(detail)).toBeVisible();
  await expect.element(dialog.getByRole("button", { name: "Ngừng hoạt động" })).not.toBeInTheDocument();
});

test("a deactivation the delete dialog offered shows the server's reason when refused", async () => {
  const writes = mockWrites((write) =>
    write.method === "DELETE" ? problem(409, "Phòng ban đang có 3 nhân sự.") : problem(409, "Hãy ngừng hoạt động các phòng ban con trước."));
  const screen = await render(<Harness permissions={everything} />);
  const dialog = await openDelete(screen, "Phòng Kỹ thuật");
  await dialog.getByRole("button", { name: "Xoá" }).click();
  await dialog.getByRole("button", { name: "Ngừng hoạt động" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  await expect.element(dialog.getByText("Hãy ngừng hoạt động các phòng ban con trước.")).toBeVisible();
});

test("the menu moves a department without dragging", async () => {
  const writes = mockWrites();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Tổ Mạng" }).click();
  await screen.getByRole("menuitem", { name: "Sửa phòng ban" }).click();
  await screen.getByRole("button", { name: /Phòng ban cha/ }).click();
  await screen.getByRole("option", { name: "Ban Giám đốc" }).click();
  await screen.getByRole("button", { name: "Nhân sự" }).click();
  await screen.getByRole("button", { name: "Lưu" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toMatchObject({ method: "PUT", path: "/api/Departments/3", body: { parentId: 1 } });
});
