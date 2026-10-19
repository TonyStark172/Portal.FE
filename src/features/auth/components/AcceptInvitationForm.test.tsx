import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { AcceptInvitationForm } from "./AcceptInvitationForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

const preview = {
  organizationName: "Công ty An Phát", email: "binh@congty.com", roleName: "Nhân viên",
  expiresAt: new Date(2026, 9, 21, 14, 30).toISOString(),
};

type Call = { method: string; path: string; body: string };

const problem = (status: number, body: Record<string, unknown>) =>
  Response.json({ status, ...body }, { status, headers: { "Content-Type": "application/problem+json" } });

/** Answers the preview with `previewAnswer` and the accept with `acceptAnswer`; returns every call, in order. */
function mockInvite({
  previewAnswer = () => Response.json(preview),
  acceptAnswer = () => Response.json({ accessToken: "new", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }),
}: { previewAnswer?: () => Response; acceptAnswer?: () => Response } = {}) {
  const calls: Call[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    const path = new URL(request.url).pathname;
    calls.push({ method: request.method, path, body: await request.clone().text() });
    if (path.endsWith("/api/Invitations/accept/abc%2B1")) return previewAnswer();
    if (path === "/api/session/invitation/abc%2B1") return acceptAnswer();
    return Response.json({});
  });
  return calls;
}

async function harness() {
  const store = makeStore();
  const screen = await render(<Provider store={store}><AcceptInvitationForm token="abc+1" /></Provider>);
  return Object.assign(screen, { store });
}

async function fill(screen: Awaited<ReturnType<typeof harness>>, password = "MatKhau123", again = password) {
  await userEvent.fill(screen.getByRole("textbox", { name: "Họ và tên" }), "Lê Bình");
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên đăng nhập" }), "binh.le");
  await userEvent.fill(screen.getByLabelText("Mật khẩu", { exact: true }), password);
  await userEvent.fill(screen.getByLabelText("Nhập lại mật khẩu"), again);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản và đăng nhập" }));
}

test("shows the company, the address, the role and when the invitation runs out", async () => {
  mockInvite();
  const screen = await harness();
  await expect.element(screen.getByRole("heading", { name: "Tham gia Công ty An Phát" })).toBeVisible();
  await expect.element(screen.getByText("binh@congty.com")).toBeVisible();
  await expect.element(screen.getByText("Nhân viên")).toBeVisible();
  await expect.element(screen.getByText("Lời mời hết hạn lúc 14:30 ngày 21/10.")).toBeVisible();
});

test("a token unknown or already used says so, with no form", async () => {
  mockInvite({ previewAnswer: () => problem(404, { code: "not_found", detail: "Không tìm thấy lời mời." }) });
  const screen = await harness();
  await expect.element(screen.getByText("Lời mời không hợp lệ hoặc đã được dùng")).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Họ và tên" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("link", { name: "Đến trang đăng nhập" })).toHaveAttribute("href", "/login");
});

test("an invitation expired or revoked says so", async () => {
  mockInvite({ previewAnswer: () => problem(410, { code: "gone", detail: "Lời mời đã hết hạn." }) });
  const screen = await harness();
  await expect.element(screen.getByText("Lời mời đã hết hạn hoặc bị thu hồi")).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Họ và tên" })).not.toBeInTheDocument();
});

test("the password must be strong and typed twice alike before anything is sent", async () => {
  const calls = mockInvite();
  const screen = await harness();
  await fill(screen, "short", "other");
  await expect.element(screen.getByText("Mật khẩu cần ít nhất 8 ký tự, có chữ và số.")).toBeVisible();
  await expect.element(screen.getByText("Hai mật khẩu chưa khớp.")).toBeVisible();
  expect(calls.filter((call) => call.method === "POST")).toEqual([]);
});

test("accepting creates the account, signs in and opens the home page", async () => {
  const calls = mockInvite();
  const screen = await harness();
  await expect.element(screen.getByRole("heading", { name: "Tham gia Công ty An Phát" })).toBeVisible();
  await fill(screen);
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  const accept = calls.find((call) => call.method === "POST")!;
  expect(accept.path).toBe("/api/session/invitation/abc%2B1");
  expect(JSON.parse(accept.body)).toEqual({ fullName: "Lê Bình", userName: "binh.le", password: "MatKhau123" });
  expect(screen.store.getState().session).toMatchObject({ status: "authenticated", accessToken: "new" });
});

test("the server's validation messages land on their fields", async () => {
  mockInvite({
    acceptAnswer: () => problem(400, { code: "validation_failed", errors: { UserName: ["Tên đăng nhập đã được dùng."] } }),
  });
  const screen = await harness();
  await expect.element(screen.getByRole("heading", { name: "Tham gia Công ty An Phát" })).toBeVisible();
  await fill(screen);
  await expect.element(screen.getByText("Tên đăng nhập đã được dùng.")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("an invitation that ran out while the form was open says so", async () => {
  mockInvite({ acceptAnswer: () => problem(410, { code: "gone", detail: "Lời mời đã hết hạn." }) });
  const screen = await harness();
  await expect.element(screen.getByRole("heading", { name: "Tham gia Công ty An Phát" })).toBeVisible();
  await fill(screen);
  await expect.element(screen.getByText("Lời mời đã hết hạn hoặc bị thu hồi")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});
