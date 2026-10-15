import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import SettingsPage from "./page";
afterEach(() => vi.restoreAllMocks());

function storeFor(permissions: string[]) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  void store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "Quản trị" } as UserDto, permissions }));
  return store;
}

function mockSettings() {
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/Organization/work-week")) return Response.json({ days: [
      { day: "Sunday", start: null, end: null }, { day: "Monday", start: "08:00", end: "17:00" }, { day: "Tuesday", start: "08:00", end: "17:00" },
      { day: "Wednesday", start: "08:00", end: "17:00" }, { day: "Thursday", start: "08:00", end: "17:00" }, { day: "Friday", start: "08:00", end: "17:00" },
      { day: "Saturday", start: null, end: null },
    ] });
    if (url.includes("/api/MeetingKinds")) return Response.json([
      { id: 1, name: "Nội bộ", originalName: "Nội bộ", englishName: null, sortOrder: 1, isActive: true, isUsed: false },
    ]);
    return Response.json({});
  });
}

test("without the right to change the organization, settings stay a placeholder", async () => {
  mockSettings();
  const screen = await render(<Provider store={storeFor([])}><SettingsPage /></Provider>);
  await expect.element(screen.getByText("Chức năng đang được xây dựng.")).toBeVisible();
  await expect.element(screen.getByRole("tab", { name: "Lịch họp" })).not.toBeInTheDocument();
});

test("with it, the meetings tab holds the meeting kinds; the work week moved to Administration", async () => {
  mockSettings();
  const screen = await render(<Provider store={storeFor([Permissions.Organization.Update])}><SettingsPage /></Provider>);
  await expect.element(screen.getByRole("tab", { name: "Lịch họp" })).toHaveAttribute("aria-selected", "true");
  await expect.element(screen.getByRole("heading", { name: "Loại cuộc họp" })).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Tuần làm việc" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("listitem", { name: "Nội bộ" })).toBeVisible();
  await expect.element(screen.getByText("Chức năng đang được xây dựng.")).not.toBeInTheDocument();
});
