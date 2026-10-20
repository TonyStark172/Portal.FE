import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type PaginatedListOfStaffEmployeeDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { StaffEmployees } from "./StaffEmployees";

const employee = (userId: number, fullName: string) => ({
  userId,
  employeeCode: String(userId).padStart(5, "0"),
  fullName,
  email: null,
  avatarUrl: null,
  positionName: null,
  departmentName: null,
  dateOfBirth: null,
  seniorityDays: null,
  gender: null,
  phoneNumber: null,
  hometown: null,
});

const firstPage: PaginatedListOfStaffEmployeeDto = {
  items: [employee(3, "Nguyễn Văn An"), employee(4, "Mai Văn Minh")],
  pageNumber: 1,
  totalPages: 3,
  totalCount: 25,
  hasPreviousPage: false,
  hasNextPage: true,
};

async function signedInStore(permissions: string[]) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Nguyễn Văn An" } as UserDto,
      permissions,
    }),
  );
  return store;
}

/** URLs requested from Portal.BE, each answered with the first page of staff. */
function watchRequests() {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json(firstPage));
  return () => fetches.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
}

async function renderPeople(permissions: string[] = [Permissions.Dashboard.Staff]) {
  const store = await signedInStore(permissions);
  return render(
    <Provider store={store}>
      <StaffEmployees />
    </Provider>,
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear(); // the chosen columns are remembered in this browser
  await page.viewport(1000, 800);
});

describe("the HR page", () => {
  test("is titled Nhân sự with the number of staff, above the table", async () => {
    watchRequests();
    const screen = await renderPeople();

    await expect.element(screen.getByRole("heading", { level: 1, name: /Nhân sự/ })).toBeVisible();
    await expect.element(screen.getByText("Mai Văn Minh")).toBeVisible();
    expect(document.querySelector("h1")?.parentElement?.textContent).toContain("25");
    expect(document.body.textContent).not.toContain("Danh bạ");
  });

  test("searches the back end once typing pauses, from the first page", async () => {
    const requests = watchRequests();
    const screen = await renderPeople();
    await expect.element(screen.getByText("Mai Văn Minh")).toBeVisible();

    await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm nhân sự" }), "minh");

    await vi.waitFor(() => expect(requests().some((url) => /\/employees\?.*search=minh/i.test(url))).toBe(true));
    expect(requests().find((url) => /search=minh/i.test(url))).toMatch(/pageNumber=1/i);
  });

  test("moves to the next page", async () => {
    const requests = watchRequests();
    const screen = await renderPeople();
    await expect.element(screen.getByText("Mai Văn Minh")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Sau" }));

    await vi.waitFor(() => expect(requests().some((url) => /\/employees\?.*pageNumber=2/i.test(url))).toBe(true));
  });

  test("lets the columns be chosen", async () => {
    watchRequests();
    const screen = await renderPeople();
    await expect.element(screen.getByRole("columnheader", { name: "Thâm niên" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Cột/ }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Thâm niên" }));

    await vi.waitFor(() => expect(document.querySelector('[role="columnheader"][data-column="Seniority"]')).toBeNull());
    expect([...document.querySelectorAll('[role="columnheader"]')].some((h) => h.textContent?.includes("Thâm niên"))).toBe(false);
  });

  test("on a phone, sorts the staff by the column header tapped with a single request", async () => {
    await page.viewport(390, 844);
    const requests = watchRequests();
    const screen = await renderPeople();

    await userEvent.click(screen.getByRole("columnheader", { name: "Thâm niên" }));

    await vi.waitFor(() => expect(requests().some((url) => /\/employees\?.*sortBy=Seniority/i.test(url))).toBe(true));
    expect(requests().filter((url) => /\/employees\?.*sortBy=Seniority/i.test(url))).toHaveLength(1);
  });

  test("tells a user without Dashboard.Staff they may not see it, without asking for the staff list", async () => {
    const requests = watchRequests();
    await renderPeople([Permissions.Posts.Create]);

    await vi.waitFor(() => expect(document.body.textContent).toContain("Bạn không có quyền xem mục này"));
    expect(document.querySelector("table, [role='grid']")).toBeNull();
    expect(requests().some((url) => url.includes("/employees"))).toBe(false);
  });
});
