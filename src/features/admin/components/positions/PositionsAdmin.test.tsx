import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type PositionDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { PositionsAdmin } from "./PositionsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/positions" }));
afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const position = (fields: Partial<PositionDto> & Pick<PositionDto, "id" | "name" | "level">): PositionDto => ({
  code: `P${fields.id}`, originalName: fields.name, description: null, isActive: true, holderCount: 0, canDelete: true, ...fields,
});
const positions: PositionDto[] = [
  // Sent out of order: the page sorts by level.
  position({ id: 2, name: "Reporter", originalName: "Phóng viên", level: 5, holderCount: 12, canDelete: false }),
  position({ id: 1, name: "Tổng biên tập", level: 1, holderCount: 1, canDelete: false, description: "Đứng đầu tòa soạn" }),
  position({ id: 3, name: "Cộng tác viên", level: 9, isActive: false }),
];

type Write = { method: string; path: string; body: unknown };
function mockPositions(reply: (write: Write) => Response = () => new Response(null, { status: 204 })) {
  const writes: Write[] = [];
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path);
    if (path === "/api/Positions" && init.method === "GET") return Response.json(positions);
    if (path.startsWith("/api/Positions")) {
      const write = { method: init.method, path, body: init.body ? JSON.parse(init.body) : null };
      writes.push(write);
      return reply(write);
    }
    return Response.json({});
  }));
  return { writes, requested };
}

function Harness({ permissions }: { permissions: Permission[] }) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "An", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><PositionsAdmin /></Provider>;
}

const everything = [Permissions.Positions.View, Permissions.Positions.Create, Permissions.Positions.Update, Permissions.Positions.Delete];

test("without the right to view positions: no page, nothing asked", async () => {
  const { requested } = mockPositions();
  const screen = await render(<Harness permissions={[]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  expect(requested.filter(path => path.startsWith("/api/Positions"))).toEqual([]);
});

test("lists the positions by level, with how many hold each", async () => {
  mockPositions();
  const screen = await render(<Harness permissions={[Permissions.Positions.View]} />);
  await expect.element(screen.getByRole("row", { name: /Tổng biên tập/ })).toBeVisible();
  const rows = screen.getByRole("row").elements().slice(1).map(row => row.textContent ?? "");
  expect(rows[0]).toContain("Tổng biên tập");
  expect(rows[1]).toContain("Reporter");
  expect(rows[2]).toContain("Cộng tác viên");
  await expect.element(screen.getByRole("row", { name: /Reporter/ })).toHaveTextContent("12");
  await expect.element(screen.getByRole("row", { name: /Cộng tác viên/ })).toHaveTextContent("Ngừng sử dụng");
});

test("viewing only: nothing to add, change or delete", async () => {
  mockPositions();
  const screen = await render(<Harness permissions={[Permissions.Positions.View]} />);
  await expect.element(screen.getByRole("row", { name: /Tổng biên tập/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm chức danh" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Sửa" }).first()).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Xoá" }).first()).not.toBeInTheDocument();
});

test("a new position gets a code suggested from its title", async () => {
  const { writes } = mockPositions(() => Response.json(4, { status: 201 }));
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chức danh" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên chức danh" }), "Trưởng phòng");
  await expect.element(dialog.getByRole("textbox", { name: "Mã" })).toHaveValue("TP");
  await userEvent.fill(dialog.getByRole("spinbutton", { name: "Cấp bậc" }), "3");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes).toEqual([{ method: "POST", path: "/api/Positions", body: { code: "TP", name: "Trưởng phòng", level: 3, description: null } }]);
});

test("editing sends the original name, not the translation shown", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(screen.getByRole("row", { name: /Reporter/ }).getByRole("button", { name: "Sửa" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("textbox", { name: "Tên chức danh" })).toHaveValue("Phóng viên");
  await expect.element(dialog.getByRole("textbox", { name: "Mã" })).toHaveValue("P2");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes).toEqual([{
    method: "PUT", path: "/api/Positions/2",
    body: { code: "P2", name: "Phóng viên", originalName: "Phóng viên", level: 5, description: null, isActive: true },
  }]);
});

test("a held position is not deleted: it can stop being used instead", async () => {
  const { writes } = mockPositions();
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(screen.getByRole("row", { name: /Reporter/ }).getByRole("button", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("có người giữ");
  await expect.element(dialog.getByRole("button", { name: "Xoá" })).not.toBeInTheDocument();
  await userEvent.click(dialog.getByRole("button", { name: "Ngừng sử dụng" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(writes).toEqual([{
    method: "PUT", path: "/api/Positions/2",
    body: { code: "P2", name: "Phóng viên", originalName: "Phóng viên", level: 5, description: null, isActive: false },
  }]);
});

test("a free position is deleted once confirmed; a refusal stays in the dialog", async () => {
  const { writes } = mockPositions(() => Response.json(
    { title: "Conflict", status: 409, code: "conflict", detail: "Chức danh đang có người giữ." }, { status: 409 }));
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(screen.getByRole("row", { name: /Cộng tác viên/ }).getByRole("button", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá" }));
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Chức danh đang có người giữ.");
  expect(writes).toEqual([{ method: "DELETE", path: "/api/Positions/3", body: null }]);
});
