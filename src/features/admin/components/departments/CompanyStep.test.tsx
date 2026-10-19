import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentChartDto, type DepartmentChartNode, type OrganizationDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentsAdmin } from "./DepartmentsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/departments" }));
afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

type Write = { method: string; path: string; body: unknown };

const technical: DepartmentChartNode = {
  id: 2, name: "Phòng Kỹ thuật", originalName: "Phòng Kỹ thuật", code: "KT", description: null, parentId: null, isActive: true,
  memberCount: 0, childCount: 0, headCount: 0, heads: [],
};
const chartOf = (organizationName: string, departments: DepartmentChartNode[]): DepartmentChartDto => ({ organizationName, myDepartmentIds: [], departments });
const organization = (fields: Partial<OrganizationDto> = {}): OrganizationDto => ({ name: "", heads: [], ...fields });

/**
 * Answers the chart and the organization the way the server does: the chart carries the organization's name, which a
 * successful `PUT /api/Organization` changes. Records the writes; `reply` may refuse a write instead.
 */
/** A gate that holds back answers from the moment it is closed until it is opened. */
function makeGate() {
  let pending: Promise<void> | null = null;
  let open: () => void = () => {};
  return {
    close() {
      pending = new Promise<void>((resolve) => { open = resolve; });
    },
    open() {
      open();
      pending = null;
    },
    wait: async () => { await pending; },
  };
}

function mockServer(initial: OrganizationDto, reply?: (write: Write) => Response | undefined, departments: DepartmentChartNode[] = [technical]) {
  let current = initial;
  const writes: Write[] = [];
  // Close a gate to hold back the next answers of that read (the page and dialog show what that looks like).
  const chartGate = makeGate();
  const organizationGate = makeGate();
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    const path = new URL(request.url).pathname.replace(/^.*?(?=\/api\/)/, "");
    if (request.method !== "GET") {
      const write = { method: request.method, path, body: JSON.parse((await request.clone().text()) || "null") };
      writes.push(write);
      const refused = reply?.(write);
      if (refused) return refused;
      if (path === "/api/Organization") current = { ...current, ...(write.body as Partial<OrganizationDto>) };
      return new Response(null, { status: 204 });
    }
    if (path === "/api/Departments/chart") {
      await chartGate.wait();
      return Response.json(chartOf(current.name, departments));
    }
    if (path === "/api/Organization") {
      const body = JSON.stringify(current);
      await organizationGate.wait();
      return new Response(body, { headers: { "Content-Type": "application/json" } });
    }
    return Response.json({});
  });
  return { writes, chartGate, organizationGate, setOrganization: (next: OrganizationDto) => { current = next; } };
}

const departmentsView = [Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update];
const withCompanyRight = [...departmentsView, Permissions.Organization.Update];

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

type Screen = Awaited<ReturnType<typeof render>>;
const field = (screen: Screen, name: string) => screen.getByRole("textbox", { name });

test("without a company, a card invites creating one, and there is no chart, no add button and no search", async () => {
  mockServer(organization());
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await expect.element(screen.getByRole("heading", { name: "Bắt đầu bằng việc tạo công ty" })).toBeVisible();
  await expect.element(screen.getByText("Phòng ban được dựng dưới công ty. Hãy nhập thông tin công ty trước.")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Tạo công ty" })).toBeVisible();
  await expect.element(screen.getByRole("region", { name: "Sơ đồ tổ chức" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Tìm trên sơ đồ" })).not.toBeInTheDocument();
  await expect.element(screen.getByText("Chưa có phòng ban nào. Bắt đầu bằng cách thêm phòng ban đầu tiên.")).not.toBeInTheDocument();
});

test("without a company and without Organization.Update, the card sends people to the administrator and has no button", async () => {
  mockServer(organization());
  const screen = await render(<Harness permissions={departmentsView} />);
  await expect.element(screen.getByText("Công ty chưa được thiết lập. Hãy liên hệ quản trị viên.")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Tạo công ty" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban" })).not.toBeInTheDocument();
});

test("creating the company sends the fields, then the chart shows the name and the add button", async () => {
  const { writes } = mockServer(organization());
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Tạo công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Tạo công ty" });
  await expect.element(dialog).toBeVisible();
  await userEvent.fill(field(screen, "Tên công ty"), "Báo Tuổi Trẻ");
  await userEvent.fill(field(screen, "Khẩu hiệu"), "Tiếng nói của tuổi trẻ");
  await userEvent.fill(field(screen, "Tên viết tắt"), "TTO");
  await userEvent.fill(dialog.getByLabelText("Ngày thành lập"), "2003-08-01");
  await userEvent.fill(field(screen, "Địa chỉ"), "60A Hoàng Văn Thụ");
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();

  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes).toEqual([
    {
      method: "PUT", path: "/api/Organization",
      body: {
        name: "Báo Tuổi Trẻ", slogan: "Tiếng nói của tuổi trẻ", shortName: "TTO", foundedOn: "2003-08-01",
        address: "60A Hoàng Văn Thụ", phoneNumber: null, email: null, website: null,
      },
    },
  ]);
  await expect.element(screen.getByText("Đã tạo công ty")).toBeVisible();
  await expect.element(screen.getByRole("region", { name: "Sơ đồ tổ chức" })).toBeVisible();
  await expect.element(screen.getByText("Báo Tuổi Trẻ", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban", exact: true })).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Bắt đầu bằng việc tạo công ty" })).not.toBeInTheDocument();
});

test("an empty name blocks saving: no request", async () => {
  const { writes } = mockServer(organization());
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Tạo công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Tạo công ty" });
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();
  await expect.element(dialog).toBeVisible();
  // Spaces are no name either.
  await userEvent.fill(field(screen, "Tên công ty"), "   ");
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();
  await expect.element(screen.getByText("Nhập tên công ty.")).toBeVisible();
  expect(writes).toEqual([]);
});

test("a server error on a field shows under that field, any other refusal in an alert", async () => {
  let refusal: Response = Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { Email: ["Email không hợp lệ."] },
  }, { status: 400 });
  const { writes } = mockServer(organization(), () => refusal.clone());
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Tạo công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Tạo công ty" });
  await userEvent.fill(field(screen, "Tên công ty"), "Báo Tuổi Trẻ");
  await userEvent.fill(field(screen, "Email"), "sai@dinh-dang");
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();
  await expect.element(screen.getByText("Email không hợp lệ.")).toBeVisible();
  await expect.element(dialog).toBeVisible();
  expect(writes).toHaveLength(1);

  refusal = Response.json({ status: 403, code: "forbidden", detail: "Bạn không được sửa thông tin công ty." }, { status: 403 });
  // The field with an error must change before the form can be sent again.
  await userEvent.fill(field(screen, "Email"), "ban@tto.vn");
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Bạn không được sửa thông tin công ty.");
});

test("the organization card's menu opens the dialog prefilled, and saving sends the edited body", async () => {
  const { writes } = mockServer(organization({
    name: "Báo Tuổi Trẻ", slogan: "Tiếng nói của tuổi trẻ", shortName: "TTO", foundedOn: "2003-08-01",
    address: "60A Hoàng Văn Thụ", phoneNumber: null, email: "ban@tto.vn", website: null,
  }));
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Thao tác với Báo Tuổi Trẻ" }).click();
  await screen.getByRole("menuitem", { name: "Sửa thông tin công ty" }).click();

  const dialog = screen.getByRole("dialog", { name: "Sửa thông tin công ty" });
  await expect.element(field(screen, "Tên công ty")).toHaveValue("Báo Tuổi Trẻ");
  await expect.element(field(screen, "Khẩu hiệu")).toHaveValue("Tiếng nói của tuổi trẻ");
  await expect.element(field(screen, "Tên viết tắt")).toHaveValue("TTO");
  await expect.element(dialog.getByLabelText("Ngày thành lập")).toHaveValue("2003-08-01");
  await expect.element(field(screen, "Địa chỉ")).toHaveValue("60A Hoàng Văn Thụ");
  await expect.element(field(screen, "Điện thoại")).toHaveValue("");
  await expect.element(field(screen, "Email")).toHaveValue("ban@tto.vn");
  await userEvent.fill(field(screen, "Điện thoại"), "0283999999");
  await userEvent.fill(field(screen, "Email"), "");
  await dialog.getByRole("button", { name: "Lưu" }).click();

  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes).toEqual([
    {
      method: "PUT", path: "/api/Organization",
      body: {
        name: "Báo Tuổi Trẻ", slogan: "Tiếng nói của tuổi trẻ", shortName: "TTO", foundedOn: "2003-08-01",
        address: "60A Hoàng Văn Thụ", phoneNumber: "0283999999", email: null, website: null,
      },
    },
  ]);
  await expect.element(screen.getByText("Đã lưu thông tin công ty")).toBeVisible();
});

test("without Organization.Update the organization card has no menu", async () => {
  mockServer(organization({ name: "Báo Tuổi Trẻ" }));
  const screen = await render(<Harness permissions={departmentsView} />);
  await expect.element(screen.getByText("Báo Tuổi Trẻ", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thao tác với Báo Tuổi Trẻ" })).not.toBeInTheDocument();
});

test("a company without departments still shows its card with the menu, and the add button", async () => {
  mockServer(organization({ name: "Báo Tuổi Trẻ" }), undefined, []);
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await expect.element(screen.getByText("Chưa có phòng ban nào. Bắt đầu bằng cách thêm phòng ban đầu tiên.")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban", exact: true }).first()).toBeVisible();
  await screen.getByRole("button", { name: "Thao tác với Báo Tuổi Trẻ" }).click();
  await screen.getByRole("menuitem", { name: "Sửa thông tin công ty" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Sửa thông tin công ty" })).toBeVisible();
});

test("clearing the founding date sends null", async () => {
  const { writes } = mockServer(organization({ name: "Báo Tuổi Trẻ", foundedOn: "2003-08-01" }));
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Thao tác với Báo Tuổi Trẻ" }).click();
  await screen.getByRole("menuitem", { name: "Sửa thông tin công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Sửa thông tin công ty" });
  await expect.element(dialog.getByLabelText("Ngày thành lập")).toHaveValue("2003-08-01");
  await userEvent.fill(dialog.getByLabelText("Ngày thành lập"), "");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes[0].body).toMatchObject({ name: "Báo Tuổi Trẻ", foundedOn: null });
});

test("a server error on the founding date shows under Ngày thành lập", async () => {
  mockServer(organization(), () => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { FoundedOn: ["Ngày thành lập phải từ năm 1900 đến hôm nay."] },
  }, { status: 400 }));
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Tạo công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Tạo công ty" });
  await userEvent.fill(field(screen, "Tên công ty"), "Báo Tuổi Trẻ");
  await userEvent.fill(dialog.getByLabelText("Ngày thành lập"), "2003-08-01");
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();
  await expect.element(screen.getByText("Ngày thành lập phải từ năm 1900 đến hôm nay.")).toBeVisible();
  await expect.element(dialog).toBeVisible();
});

test("the organization card shows the slogan under the name", async () => {
  mockServer(organization({ name: "Báo Tuổi Trẻ", slogan: "Tiếng nói của tuổi trẻ" }));
  const screen = await render(<Harness permissions={departmentsView} />);
  await expect.element(screen.getByText("Báo Tuổi Trẻ", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Tiếng nói của tuổi trẻ")).toBeVisible();
});

test("the empty state's organization card shows the slogan too", async () => {
  mockServer(organization({ name: "Báo Tuổi Trẻ", slogan: "Tiếng nói của tuổi trẻ" }), undefined, []);
  const screen = await render(<Harness permissions={departmentsView} />);
  await expect.element(screen.getByText("Tiếng nói của tuổi trẻ")).toBeVisible();
});

test("the root card appears with its slogan at once, not name first", async () => {
  const { organizationGate } = mockServer(organization({ name: "Báo Tuổi Trẻ", slogan: "Tiếng nói của tuổi trẻ" }));
  organizationGate.close();
  const screen = await render(<Harness permissions={departmentsView} />);
  // The chart is in; the company is not: nothing of the card is drawn yet.
  await expect.element(screen.getByRole("region", { name: "Phòng ban" })).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await expect.element(screen.getByText("Báo Tuổi Trẻ", { exact: true })).not.toBeInTheDocument();
  organizationGate.open();
  await expect.element(screen.getByText("Báo Tuổi Trẻ", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Tiếng nói của tuổi trẻ")).toBeVisible();
});

test("after creating the company, the setup card does not come back while the chart is read again", async () => {
  const { chartGate } = mockServer(organization());
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await screen.getByRole("button", { name: "Tạo công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Tạo công ty" });
  await userEvent.fill(field(screen, "Tên công ty"), "Báo Tuổi Trẻ");
  chartGate.close();
  await dialog.getByRole("button", { name: "Tạo công ty" }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  // The chart answer is still pending: neither the setup card nor the chart is on the page.
  await new Promise((resolve) => setTimeout(resolve, 300));
  await expect.element(screen.getByRole("heading", { name: "Bắt đầu bằng việc tạo công ty" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("region", { name: "Sơ đồ tổ chức" })).not.toBeInTheDocument();
  chartGate.open();
  await expect.element(screen.getByRole("region", { name: "Sơ đồ tổ chức" })).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Bắt đầu bằng việc tạo công ty" })).not.toBeInTheDocument();
});

test("after a save, the root card never shows the new name with the old slogan", async () => {
  const { organizationGate } = mockServer(organization({ name: "Báo Tuổi Trẻ", slogan: "Khẩu hiệu cũ" }));
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await expect.element(screen.getByText("Khẩu hiệu cũ")).toBeVisible();
  await screen.getByRole("button", { name: "Thao tác với Báo Tuổi Trẻ" }).click();
  await screen.getByRole("menuitem", { name: "Sửa thông tin công ty" }).click();
  const dialog = screen.getByRole("dialog", { name: "Sửa thông tin công ty" });
  await expect.element(field(screen, "Tên công ty")).toHaveValue("Báo Tuổi Trẻ");
  await userEvent.fill(field(screen, "Tên công ty"), "Tuổi Trẻ Online");
  await userEvent.fill(field(screen, "Khẩu hiệu"), "Khẩu hiệu mới");
  // The chart is read first, the company later.
  organizationGate.close();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await expect.element(screen.getByText("Tuổi Trẻ Online", { exact: true })).not.toBeInTheDocument();
  organizationGate.open();
  await expect.element(screen.getByText("Tuổi Trẻ Online", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Khẩu hiệu mới")).toBeVisible();
  await expect.element(screen.getByText("Khẩu hiệu cũ")).not.toBeInTheDocument();
});

test("the edit dialog waits for a fresh read instead of showing the cached company first", async () => {
  const { organizationGate, setOrganization } = mockServer(organization({ name: "Báo Tuổi Trẻ", address: "Địa chỉ cũ" }));
  const screen = await render(<Harness permissions={withCompanyRight} />);
  await expect.element(screen.getByText("Báo Tuổi Trẻ", { exact: true })).toBeVisible();
  // Someone else changed the address since the page read the company.
  setOrganization(organization({ name: "Báo Tuổi Trẻ", address: "Địa chỉ mới" }));
  organizationGate.close();
  await screen.getByRole("button", { name: "Thao tác với Báo Tuổi Trẻ" }).click();
  await screen.getByRole("menuitem", { name: "Sửa thông tin công ty" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Sửa thông tin công ty" })).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await expect.element(field(screen, "Địa chỉ")).not.toBeInTheDocument();
  organizationGate.open();
  await expect.element(field(screen, "Địa chỉ")).toHaveValue("Địa chỉ mới");
});
