import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { LocaleProvider, useLocale } from "./LocaleProvider";
import { setStoredLocale } from "./locale";
import { useParticipantProfiles } from "@/features/meetings/components/useParticipantProfiles";
import { signedIn } from "@/shared/session/sessionSlice";
import { Provider } from "react-redux";
import { makeStore } from "@/core/store";
import { LocaleCacheSync } from "./LocaleCacheSync";
import { useGetMyProfileQuery } from "@/shared/api/generated/portalApi";

function Harness() {
  const { setLocale } = useLocale();
  const { profiles } = useParticipantProfiles([7]);
  return <><button onClick={() => setLocale("en-US")}>English</button><output>{profiles[7]?.positionName ?? "Loading"}</output></>;
}
afterEach(() => { vi.restoreAllMocks(); setStoredLocale("vi-VN"); });

/** The language a request asks for (RTK Query hands fetch a Request). */
const languageOf = (input: RequestInfo | URL, init?: RequestInit) =>
  (input instanceof Request ? input.headers : new Headers(init?.headers)).get("Accept-Language");
function signedInStore() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  return store;
}

test("participant profile cache refetches by locale and ignores an old response", async () => {
  setStoredLocale("vi-VN");
  let finishVietnamese: (value: Response) => void = () => {};
  const fetcher = vi.spyOn(window, "fetch").mockImplementation((_url, init) => {
    const locale = languageOf(_url, init);
    if (locale === "en-US") return Promise.resolve(Response.json({ items: [{ userId: 7, fullName: "Nguyễn An", employeeCode: "00007", avatarUrl: null, positionName: "Manager" }], totalCount: 1, missingEmailCount: 0, pageNumber: 1 }));
    return new Promise(resolve => { finishVietnamese = resolve; });
  });
  const screen = await render(<Provider store={signedInStore()}><LocaleProvider><Harness /></LocaleProvider></Provider>);
  await expect.poll(() => fetcher.mock.calls.length).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "English" }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Manager");
  finishVietnamese(Response.json({ items: [{ userId: 7, fullName: "Nguyễn An", positionName: "Trưởng phòng" }] }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Manager");
  expect(fetcher.mock.calls.length).toBe(2);
});

test("completed participant cache reloads titles after a locale change", async () => {
  setStoredLocale("vi-VN");
  vi.spyOn(window, "fetch").mockImplementation(async (_url, init) => Response.json({
    items: [{ userId: 7, fullName: "Nguyễn An", employeeCode: "00007", avatarUrl: null,
      positionName: languageOf(_url, init) === "en-US" ? "Manager" : "Trưởng phòng" }],
    totalCount: 1, missingEmailCount: 0, pageNumber: 1,
  }));
  const screen = await render(<Provider store={signedInStore()}><LocaleProvider><Harness /></LocaleProvider></Provider>);
  await expect.element(screen.getByRole("status")).toHaveTextContent("Trưởng phòng");
  await userEvent.click(screen.getByRole("button", { name: "English" }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Manager");
});

function QueryHarness() {
  const { setLocale } = useLocale();
  const { data } = useGetMyProfileQuery();
  return <><button onClick={() => setLocale("en-US")}>English</button><output>{data?.assignments[0]?.positionName ?? "Loading"}</output></>;
}

test("active RTK profile query refetches on locale changes and ignores its previous pending response", async () => {
  setStoredLocale("vi-VN");
  let finishVietnamese: (value: Response) => void = () => {};
  const fetcher = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const headers = input instanceof Request ? input.headers : new Headers(init?.headers);
    if (headers.get("Accept-Language") === "en-US") return Promise.resolve(Response.json({
      userId: 7, fullName: "Nguyễn An", assignments: [{ departmentId: 3, departmentName: "Training", positionId: 2, positionName: "Manager", positionLevel: 1, isPrimary: true }],
    }));
    return new Promise(resolve => { finishVietnamese = resolve; });
  });
  const screen = await render(<Provider store={makeStore()}><LocaleProvider><LocaleCacheSync /><QueryHarness /></LocaleProvider></Provider>);
  await expect.poll(() => fetcher.mock.calls.length).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "English" }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Manager");
  finishVietnamese(Response.json({ userId: 7, fullName: "Nguyễn An", assignments: [{ positionName: "Trưởng phòng" }] }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Manager");
  expect(fetcher.mock.calls.length).toBe(2);
});
