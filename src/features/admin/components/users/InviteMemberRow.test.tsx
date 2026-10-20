import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { InviteMemberRow } from "./InviteMemberRow";

afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

const roles: RoleDto[] = [
  { id: 1, name: "Administrator", description: null, isAdmin: true, isDefault: false, permissions: [], userCount: 1 },
  { id: 2, name: "Nhân viên", description: null, isAdmin: false, isDefault: true, permissions: [], userCount: 5 },
  { id: 4, name: "Trưởng phòng", description: null, isAdmin: false, isDefault: false, permissions: [], userCount: 2 },
];

type Sent = { method: string; path: string; body: unknown };

/** Answers availability and roles, and the invitation POST with `answer`; returns what was sent, in order. */
function mockInvitations({ canSendEmail = true, answer = () => Response.json(7, { status: 201 }) }: {
  canSendEmail?: boolean;
  answer?: () => Response;
} = {}) {
  const sent: Sent[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    const path = new URL(request.url).pathname.replace(/^.*?(?=\/api\/)/, "");
    const text = await request.text();
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
    if (path === "/api/Invitations/availability") return Response.json({ canSendEmail });
    if (path === "/api/Invitations" && request.method === "POST") return answer();
    if (/^\/api\/Invitations\/\d+\/resend$/.test(path)) return new Response(null, { status: 204 });
    if (path === "/api/Invitations") return Response.json([]);
    if (path === "/api/Roles") return Response.json(roles);
    return Response.json({});
  });
  return sent;
}

const posted = (sent: Sent[]) => sent.filter((request) => request.method === "POST");

function Harness({ isAdministrator = false }: { isAdministrator?: boolean }) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator } as UserDto,
      permissions: [Permissions.Users.View, Permissions.Users.Create],
    }));
    return own;
  });
  return <Provider store={store}><Toast.Provider /><InviteMemberRow /></Provider>;
}

const problem = (status: number, body: Record<string, unknown>) =>
  Response.json({ status, ...body }, { status, headers: { "Content-Type": "application/problem+json" } });

test("without a mail server the form is hidden and a note says why", async () => {
  mockInvitations({ canSendEmail: false });
  const screen = await render(<Harness isAdministrator />);
  await expect.element(screen.getByText(/Chưa cấu hình máy chủ gửi thư/)).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Địa chỉ email" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Gửi lời mời" })).not.toBeInTheDocument();
});

test("the administrator picks the role; the invitation is sent and the field emptied", async () => {
  const sent = mockInvitations();
  const screen = await render(<Harness isAdministrator />);
  await expect.element(screen.getByRole("heading", { name: "Mời thành viên" })).toBeVisible();
  await expect.element(screen.getByText("Người được mời sẽ vào với vai trò bạn chọn ở đây. Bạn có thể đổi sau ở tab Người dùng.")).toBeVisible();
  const email = screen.getByRole("textbox", { name: "Địa chỉ email" });
  await expect.element(email).toHaveAttribute("placeholder", "ten@congty.com");
  // The default role is chosen to begin with; the administrator role is not offered.
  const role = screen.getByRole("button", { name: /Vai trò/ });
  await expect.element(role).toHaveTextContent("Nhân viên");
  await userEvent.click(role);
  expect(screen.getByRole("option").elements().map((option) => option.textContent)).toEqual(["Nhân viên", "Trưởng phòng"]);
  await userEvent.click(screen.getByRole("option", { name: "Trưởng phòng" }));

  await userEvent.fill(email, "binh@congty.com");
  await userEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
  await vi.waitFor(() => expect(posted(sent)).toEqual([
    { method: "POST", path: "/api/Invitations", body: { email: "binh@congty.com", roleId: 4 } },
  ]));
  await expect.element(screen.getByText("Đã gửi lời mời tới binh@congty.com")).toBeVisible();
  await expect.element(email).toHaveValue("");
});

test("anyone else invites with the default role: the select is locked and the server picks", async () => {
  const sent = mockInvitations();
  const screen = await render(<Harness />);
  const role = screen.getByRole("button", { name: /Vai trò/ });
  await expect.element(role).toHaveTextContent("Nhân viên");
  await expect.element(role).toBeDisabled();
  await userEvent.fill(screen.getByRole("textbox", { name: "Địa chỉ email" }), "binh@congty.com");
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(posted(sent).map((request) => request.body)).toEqual([{ email: "binh@congty.com", roleId: null }]));
});

test("a refused address says why under the field", async () => {
  mockInvitations({
    answer: () => problem(400, { code: "validation_failed", detail: "Kiểm tra lại.", errors: { Email: ["Email này đã có tài khoản."] } }),
  });
  const screen = await render(<Harness isAdministrator />);
  const email = screen.getByRole("textbox", { name: "Địa chỉ email" });
  await userEvent.fill(email, "an@congty.com");
  await userEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
  await expect.element(screen.getByText("Email này đã có tài khoản.")).toBeVisible();
  await expect.element(email).toHaveAttribute("aria-invalid", "true");
  await expect.element(email).toHaveValue("an@congty.com");
});

test("an address already invited asks to send again, which resends that invitation", async () => {
  const sent = mockInvitations({
    answer: () => problem(409, { code: "conflict", detail: "Địa chỉ này đang có lời mời chờ.", invitationId: 7 }),
  });
  const screen = await render(<Harness isAdministrator />);
  await userEvent.fill(screen.getByRole("textbox", { name: "Địa chỉ email" }), "binh@congty.com");
  await userEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
  const dialog = screen.getByRole("alertdialog", { name: "Gửi lại lời mời?" });
  await expect.element(dialog).toBeVisible();
  await userEvent.click(dialog.getByRole("button", { name: "Gửi lại" }));
  await vi.waitFor(() => expect(posted(sent).map((request) => request.path)).toEqual(["/api/Invitations", "/api/Invitations/7/resend"]));
  await expect.element(screen.getByText("Đã gửi lại lời mời tới binh@congty.com")).toBeVisible();
  await expect.element(dialog).not.toBeInTheDocument();
});

test("declining to send again sends nothing more and keeps the address", async () => {
  const sent = mockInvitations({
    answer: () => problem(409, { code: "conflict", detail: "Địa chỉ này đang có lời mời chờ.", invitationId: 7 }),
  });
  const screen = await render(<Harness isAdministrator />);
  const email = screen.getByRole("textbox", { name: "Địa chỉ email" });
  await userEvent.fill(email, "binh@congty.com");
  await userEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(posted(sent)).toHaveLength(1);
  await expect.element(email).toHaveValue("binh@congty.com");
});
