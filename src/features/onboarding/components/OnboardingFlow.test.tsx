import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type ProfileDto, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { OnboardingFlow } from "./OnboardingFlow";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => "/onboarding" }));
afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

const assignments = [
  { departmentId: 3, departmentName: "Phòng Kỹ thuật", positionName: "Lập trình viên", role: "Member", isPrimary: true },
] as UserDto["assignments"];

const user = {
  id: 7, userName: "binh.le", employeeCode: "NV007", fullName: "Lê Bình", email: "binh@congty.com", emailConfirmed: true,
  isActive: true, assignments, roles: [], isAdministrator: false, mustChangePassword: false, needsOnboarding: true,
} as UserDto;

const emptyProfile: ProfileDto = {
  userId: 7, userName: "binh.le", employeeCode: "NV007", fullName: "Lê Bình", email: "binh@congty.com",
  emailConfirmed: true, phoneNumber: null, dateOfBirth: null, gender: null, hometown: null, avatarUrl: null, assignments,
};

type Call = { method: string; path: string; body: string };

const problem = (status: number, body: Record<string, unknown>) =>
  Response.json({ status, ...body }, { status, headers: { "Content-Type": "application/problem+json" } });

/** Answers Portal.BE's profile, profile-save and onboarding calls; returns every call made, in order. */
function mockApi({
  profile = emptyProfile,
  saveAnswer = () => new Response(null, { status: 204 }),
  finishAnswer = () => new Response(null, { status: 204 }),
}: { profile?: ProfileDto; saveAnswer?: () => Response; finishAnswer?: () => Response } = {}) {
  const calls: Call[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    const path = new URL(request.url).pathname.replace(/^\/backend/, "");
    calls.push({ method: request.method, path, body: await request.clone().text() });
    if (path === "/api/Profiles/me" && request.method === "GET") return Response.json(profile);
    if (path === "/api/Profiles/me" && request.method === "PUT") return saveAnswer();
    if (path === "/api/Profiles/me/onboarding") return finishAnswer();
    if (path === "/api/Auth/me") return Response.json({ user: { ...user, needsOnboarding: false }, permissions: [] });
    return new Response(null, { status: 204 });
  });
  return calls;
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== "GET");

async function harness() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user, permissions: [] }));
  const screen = await render(<Provider store={store}><OnboardingFlow /></Provider>);
  return Object.assign(screen, { store });
}
type Screen = Awaited<ReturnType<typeof harness>>;

const continueButton = (screen: Screen) => screen.getByRole("button", { name: "Tiếp tục" });

/** Types a date into the date-of-birth field, segment by segment (whatever order the locale puts them in). */
async function typeBirthDate(day: string, month: string, year: string) {
  const segment = (type: string) =>
    document.querySelector<HTMLElement>(`[data-onboarding-field="dateOfBirth"] [data-type="${type}"]`)!;
  await userEvent.click(segment("day"));
  await userEvent.keyboard(day);
  await userEvent.click(segment("month"));
  await userEvent.keyboard(month);
  await userEvent.click(segment("year"));
  await userEvent.keyboard(year);
}

async function fillRequired(screen: Screen) {
  await userEvent.fill(screen.getByRole("textbox", { name: "Số điện thoại" }), "0912 345 678");
  await typeBirthDate("15", "03", "1995");
  await userEvent.click(screen.getByRole("button", { name: /Giới tính/ }));
  await userEvent.click(screen.getByRole("option", { name: "Nữ" }));
}

test("step 1 shows who the account is (read-only) and marks phone, birth date and gender as required", async () => {
  mockApi();
  const screen = await harness();
  await expect.element(screen.getByRole("heading", { name: "Giới thiệu về bạn" })).toBeVisible();
  await expect.element(screen.getByText("Lê Bình", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("binh@congty.com")).toBeVisible();
  await expect.element(screen.getByText("NV007 · Phòng Kỹ thuật · Lập trình viên")).toBeVisible();
  await expect.element(screen.getByText("Do quản trị viên quản lý")).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Số điện thoại" })).toHaveAttribute("aria-required", "true");
  await expect.element(screen.getByRole("textbox", { name: "Số điện thoại" })).toBeVisible();
  await expect.element(screen.getByRole("combobox", { name: "Quê quán" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Chọn ảnh đại diện" })).toBeVisible();
});

test("there is no way to skip onboarding, only to sign out", async () => {
  mockApi();
  const screen = await harness();
  await expect.element(continueButton(screen)).toBeVisible();
  expect(document.body.textContent).not.toMatch(/Bỏ qua|Skip/i);
  await expect.element(screen.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
});

test("the required fields block 'Tiếp tục' with an error under each, and nothing is saved", async () => {
  const calls = mockApi();
  const screen = await harness();
  await userEvent.click(continueButton(screen));

  await expect.element(screen.getByText("Hãy nhập số điện thoại.")).toBeVisible();
  await expect.element(screen.getByText("Hãy nhập ngày sinh.")).toBeVisible();
  await expect.element(screen.getByText("Hãy chọn giới tính.")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Giới thiệu về bạn" })).toBeVisible();
  expect(writes(calls)).toHaveLength(0);

  // A field's error goes once it is filled in.
  await userEvent.fill(screen.getByRole("textbox", { name: "Số điện thoại" }), "0912 345 678");
  await expect.element(screen.getByText("Hãy nhập số điện thoại.")).not.toBeInTheDocument();
  await expect.element(screen.getByText("Hãy chọn giới tính.")).toBeVisible();
});

test("'Tiếp tục' saves what was entered and moves on to step 2", async () => {
  const calls = mockApi();
  const screen = await harness();
  await fillRequired(screen);
  await userEvent.click(continueButton(screen));

  await expect.element(screen.getByRole("heading", { name: "Bạn đã sẵn sàng" })).toBeVisible();
  expect(writes(calls)).toEqual([
    {
      method: "PUT",
      path: "/api/Profiles/me",
      body: JSON.stringify({ phoneNumber: "0912 345 678", dateOfBirth: "1995-03-15", gender: "Female", hometown: null }),
    },
  ]);
  // The summary: who and where.
  await expect.element(screen.getByText("Lập trình viên · Phòng Kỹ thuật")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Bắt đầu" })).toBeVisible();
});

test("a profile already complete and left unchanged is not saved again", async () => {
  const calls = mockApi({ profile: { ...emptyProfile, phoneNumber: "0912345678", dateOfBirth: "1995-03-15", gender: "Male" } });
  const screen = await harness();
  await expect.element(screen.getByRole("textbox", { name: "Số điện thoại" })).toHaveValue("0912345678");
  await userEvent.click(continueButton(screen));

  await expect.element(screen.getByRole("heading", { name: "Bạn đã sẵn sàng" })).toBeVisible();
  expect(writes(calls)).toHaveLength(0);
});

test("a validation error from the server stays on step 1, under its field", async () => {
  const calls = mockApi({
    saveAnswer: () => problem(400, { code: "validation_failed", errors: { PhoneNumber: ["'Phone Number' không hợp lệ."] } }),
  });
  const screen = await harness();
  await fillRequired(screen);
  await userEvent.click(continueButton(screen));

  await expect.element(screen.getByText("'Phone Number' không hợp lệ.")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Giới thiệu về bạn" })).toBeVisible();
  expect(writes(calls).map((c) => c.path)).toEqual(["/api/Profiles/me"]);
});

test("'Bắt đầu' ends onboarding and opens the home page, with the user no longer needing it", async () => {
  const calls = mockApi();
  const screen = await harness();
  await fillRequired(screen);
  await userEvent.click(continueButton(screen));
  await userEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));

  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual(["PUT /api/Profiles/me", "POST /api/Profiles/me/onboarding"]);
  const current = portalApi.endpoints.getCurrentUser.select()(screen.store.getState() as never);
  expect(current.data?.user.needsOnboarding).toBe(false);
});

test("'Quay lại' on step 2 goes back to step 1 with what was entered", async () => {
  mockApi();
  const screen = await harness();
  await fillRequired(screen);
  await userEvent.click(continueButton(screen));
  await userEvent.click(screen.getByRole("button", { name: "Quay lại" }));

  await expect.element(screen.getByRole("heading", { name: "Giới thiệu về bạn" })).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Số điện thoại" })).toHaveValue("0912 345 678");
});

test("if the server still finds a required field missing, 'Bắt đầu' goes back to step 1 and shows it", async () => {
  mockApi({
    finishAnswer: () => problem(400, { code: "validation_failed", errors: { Gender: ["Hãy chọn giới tính."] } }),
  });
  const screen = await harness();
  await fillRequired(screen);
  await userEvent.click(continueButton(screen));
  await userEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));

  await expect.element(screen.getByRole("heading", { name: "Giới thiệu về bạn" })).toBeVisible();
  await expect.element(screen.getByText("Hãy chọn giới tính.")).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

test("signing out leaves for the login page", async () => {
  mockApi();
  const screen = await harness();
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});

test("on a phone the card fills the screen, the button stays in view, and nothing scrolls sideways", async () => {
  mockApi();
  await page.viewport(375, 700);
  try {
    const screen = await harness();
    await expect.element(screen.getByRole("textbox", { name: "Số điện thoại" })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    const button = continueButton(screen).element().getBoundingClientRect();
    expect(button.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(button.top).toBeGreaterThan(window.innerHeight / 2);
  } finally {
    await page.viewport(1000, 800);
  }
});
