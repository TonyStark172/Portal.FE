import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { RequireAuth } from "./RequireAuth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/meetings" }));
afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

async function renderWith(user: Partial<UserDto>, allowPasswordChange = false, onboarding = false) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "An", ...user } as UserDto, permissions: [] }));
  return render(
    <Provider store={store}>
      <RequireAuth allowPasswordChange={allowPasswordChange} onboarding={onboarding}><p>Nội dung</p></RequireAuth>
    </Provider>,
  );
}

test("someone with a temporary password is sent to the change page and sees nothing else", async () => {
  const screen = await renderWith({ mustChangePassword: true });
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/change-password"));
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
});

test("the change page itself shows its content without redirecting", async () => {
  const screen = await renderWith({ mustChangePassword: true }, true);
  await expect.element(screen.getByText("Nội dung")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("everyone else sees the content", async () => {
  const screen = await renderWith({ mustChangePassword: false });
  await expect.element(screen.getByText("Nội dung")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("a new account that still needs onboarding is sent to it and sees nothing else", async () => {
  const screen = await renderWith({ needsOnboarding: true });
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
});

test("a temporary password comes before onboarding", async () => {
  const screen = await renderWith({ mustChangePassword: true, needsOnboarding: true });
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/change-password"));
  expect(replace).not.toHaveBeenCalledWith("/onboarding");
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
});

test("the change-password page is not sent on to onboarding", async () => {
  const screen = await renderWith({ mustChangePassword: true, needsOnboarding: true }, true);
  await expect.element(screen.getByText("Nội dung")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("the onboarding page shows its content to someone who needs it", async () => {
  const screen = await renderWith({ needsOnboarding: true }, false, true);
  await expect.element(screen.getByText("Nội dung")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("the onboarding page still sends a temporary password to be changed first", async () => {
  const screen = await renderWith({ mustChangePassword: true, needsOnboarding: true }, false, true);
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/change-password"));
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
});

test("the onboarding page sends someone who no longer needs it home", async () => {
  const screen = await renderWith({ needsOnboarding: false }, false, true);
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
});

test("the onboarding page waits for the current user before deciding", async () => {
  vi.spyOn(window, "fetch").mockReturnValue(new Promise(() => {}));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(
    <Provider store={store}>
      <RequireAuth onboarding><p>Nội dung</p></RequireAuth>
    </Provider>,
  );
  await expect.element(screen.getByLabelText("Đang tải")).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(replace).not.toHaveBeenCalled();
});

test("nothing is shown while the current user is still loading, so a forced password change cannot flash the page", async () => {
  vi.spyOn(window, "fetch").mockReturnValue(new Promise(() => {}));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(
    <Provider store={store}>
      <RequireAuth><p>Nội dung</p></RequireAuth>
    </Provider>,
  );
  await expect.element(screen.getByLabelText("Đang tải")).toBeVisible();
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

test("a failed current-user request does not block the page forever", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue(Response.json({ status: 500, code: "unknown" }, { status: 500 }));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(
    <Provider store={store}>
      <RequireAuth><p>Nội dung</p></RequireAuth>
    </Provider>,
  );
  await expect.element(screen.getByText("Nội dung")).toBeVisible();
});

test("once the user has been known, reloading it from scratch (a language switch) keeps the page mounted", async () => {
  function Draft() {
    const [text, setText] = useState("");
    return <input aria-label="Bản nháp" value={text} onChange={(event) => setText(event.target.value)} />;
  }
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "An", mustChangePassword: false } as UserDto, permissions: [] }));
  const screen = await render(
    <Provider store={store}>
      <RequireAuth><Draft /></RequireAuth>
    </Provider>,
  );
  await userEvent.fill(screen.getByLabelText("Bản nháp"), "đang viết dở");

  // The reload never answers: the user is "loading" again, as right after resetApiState.
  vi.spyOn(window, "fetch").mockReturnValue(new Promise(() => {}));
  store.dispatch(portalApi.util.resetApiState());

  await new Promise((resolve) => setTimeout(resolve, 200));
  await expect.element(screen.getByLabelText("Bản nháp")).toHaveValue("đang viết dở");
});

test("on a hard reload nothing is shown from the moment the session is found until the first current user arrives", async () => {
  // The session starts "unknown" and the user query is skipped: that must not count as "the user is known".
  vi.spyOn(window, "fetch").mockReturnValue(new Promise(() => {}));
  const store = makeStore();
  const screen = await render(
    <Provider store={store}>
      <RequireAuth><p>Nội dung</p></RequireAuth>
    </Provider>,
  );
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));

  await expect.element(screen.getByLabelText("Đang tải")).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await expect.element(screen.getByText("Nội dung")).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
