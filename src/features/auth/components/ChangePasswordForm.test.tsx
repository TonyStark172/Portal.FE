import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { ChangePasswordForm } from "./ChangePasswordForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

async function harness() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: true } as UserDto, permissions: [] }));
  const screen = await render(<Provider store={store}><ChangePasswordForm /></Provider>);
  return Object.assign(screen, { store });
}

async function fillAndSubmit(screen: Awaited<ReturnType<typeof harness>>, current: string, next: string, again: string) {
  await userEvent.fill(screen.getByLabelText("Mật khẩu hiện tại"), current);
  await userEvent.fill(screen.getByLabelText("Mật khẩu mới", { exact: true }), next);
  await userEvent.fill(screen.getByLabelText("Nhập lại mật khẩu mới"), again);
  await userEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
}

test("the new password must be confirmed and strong before anything is sent", async () => {
  const fetch = vi.spyOn(window, "fetch");
  const screen = await harness();
  await fillAndSubmit(screen, "Temp12345abc", "short", "other");
  await expect.element(screen.getByText("Mật khẩu cần ít nhất 8 ký tự, có chữ và số.")).toBeVisible();
  await expect.element(screen.getByText("Hai mật khẩu chưa khớp.")).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

test("changing it signs in again with the new password and opens the home page", async () => {
  const calls: { url: string; body: string }[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = request?.url ?? String(input);
    calls.push({ url, body: request ? await request.clone().text() : String(init?.body ?? "") });
    if (url.includes("/api/Auth/change-password")) return new Response(null, { status: 204 });
    if (url.endsWith("/api/session")) return Response.json({ accessToken: "new", accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
    return Response.json({ user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: false }, permissions: [] });
  });
  const screen = await harness();
  await fillAndSubmit(screen, "Temp12345abc", "NewPassword9", "NewPassword9");
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(calls.some((call) => call.url.includes("/api/Auth/change-password"))).toBe(true);
  const signIn = calls.find((call) => call.url.endsWith("/api/session"));
  expect(JSON.parse(signIn!.body)).toEqual({ userName: "an.nv", password: "NewPassword9" });
});

test("the server's refusal is shown and nothing else happens", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/Auth/change-password"))
      return Response.json({ status: 400, code: "invalid_credentials", detail: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    return Response.json({ user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: true }, permissions: [] });
  });
  const screen = await harness();
  await fillAndSubmit(screen, "Wrong12345abc", "NewPassword9", "NewPassword9");
  await expect.element(screen.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("the server's validation messages land on their fields", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/Auth/change-password"))
      return Response.json({ status: 400, code: "validation_failed", errors: { NewPassword: ["Mật khẩu mới phải khác mật khẩu cũ."] } }, { status: 400 });
    return Response.json({ user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: true }, permissions: [] });
  });
  const screen = await harness();
  await fillAndSubmit(screen, "Temp12345abc", "NewPassword9", "NewPassword9");
  await expect.element(screen.getByText("Mật khẩu mới phải khác mật khẩu cũ.")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("the home page opens only once the signed-in user no longer has to change the password", async () => {
  // The user query never answers: whatever the store says at navigation time comes from the form itself.
  const flagAtNavigation: (boolean | undefined)[] = [];
  vi.spyOn(window, "fetch").mockImplementation((input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/Auth/change-password")) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.endsWith("/api/session")) return Promise.resolve(Response.json({ accessToken: "new", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    return new Promise(() => {});
  });
  const screen = await harness();
  replace.mockImplementation(() => {
    flagAtNavigation.push(portalApi.endpoints.getCurrentUser.select()(screen.store.getState() as never).data?.user.mustChangePassword);
  });
  await fillAndSubmit(screen, "Temp12345abc", "NewPassword9", "NewPassword9");
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(flagAtNavigation).toEqual([false]);
});

test("when signing in again fails the form stays, says so, and offers the normal sign-out", async () => {
  const calls: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = request?.url ?? String(input);
    const method = request?.method ?? init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    if (url.includes("/api/Auth/change-password")) return new Response(null, { status: 204 });
    if (url.endsWith("/api/session") && method === "POST") return Response.json({ status: 500, code: "unknown" }, { status: 500 });
    if (url.endsWith("/api/session") && method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({ user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: true }, permissions: [] });
  });
  const screen = await harness();
  await fillAndSubmit(screen, "Temp12345abc", "NewPassword9", "NewPassword9");
  await expect.element(screen.getByText("Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.")).toBeVisible();
  expect(screen.store.getState().session.status).toBe("authenticated");
  expect(replace).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  expect(calls.some((call) => call.startsWith("DELETE ") && call.endsWith("/api/session"))).toBe(true);
  expect(screen.store.getState().session.status).toBe("anonymous");
});

test("the form cannot be submitted before the signed-in user is known", async () => {
  const fetch = vi.spyOn(window, "fetch").mockReturnValue(new Promise(() => {}));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(<Provider store={store}><ChangePasswordForm /></Provider>);
  await expect.element(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("the form posts to its own page, so a submit before the page is hydrated never puts the passwords in the URL", async () => {
  const screen = await harness();
  const form = screen.container.querySelector("form")!;
  expect(form.getAttribute("method")?.toLowerCase()).toBe("post");
  expect(form.hasAttribute("action")).toBe(false);
});

test("the user can always sign out, even while still holding a temporary password", async () => {
  const calls: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = request?.url ?? String(input);
    const method = request?.method ?? init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    if (url.endsWith("/api/session") && method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({ user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: true }, permissions: [] });
  });
  const screen = await harness();
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  expect(calls.some((call) => call.startsWith("DELETE ") && call.endsWith("/api/session"))).toBe(true);
  expect(screen.store.getState().session.status).toBe("anonymous");
});

test("when the signed-in user cannot be loaded the form says so and offers a retry next to the sign-out", async () => {
  let answer: Response = Response.json({ status: 500, code: "unknown" }, { status: 500 });
  const fetch = vi.spyOn(window, "fetch").mockImplementation(async () => answer.clone());
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(<Provider store={store}><ChangePasswordForm /></Provider>);
  await expect.element(screen.getByText("Không tải được hồ sơ. Vui lòng thử lại.")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();
  await expect.element(screen.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  const before = fetch.mock.calls.length;

  answer = Response.json({ user: { id: 1, fullName: "An", userName: "an.nv", mustChangePassword: true }, permissions: [] });
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));

  await vi.waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(before));
  await expect.element(screen.getByText("Không tải được hồ sơ. Vui lòng thử lại.")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeEnabled();
});
