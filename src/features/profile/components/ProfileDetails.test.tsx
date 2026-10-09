import "@/app/globals.css";
import { Provider } from "react-redux";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { ProfileDto } from "@/shared/api/generated/portalApi";
import { ProfileDetails } from "./ProfileDetails";

const profile = (overrides: Partial<ProfileDto> = {}) =>
  ({
    userId: 1,
    userName: "mai.vm",
    fullName: "Mai Văn Minh",
    emailConfirmed: false,
    assignments: [],
    joinedOn: "2026-10-01",
    seniorityDays: 2 * 365 + 70,
    ...overrides,
  }) as ProfileDto;

/** The value of the info row named `label` (its label is only for screen readers). */
const rowText = (label: string) =>
  [...document.querySelectorAll("dt")].find((dt) => dt.textContent === label)?.nextElementSibling?.textContent ?? "";

function renderDetails(p: ProfileDto) {
  return render(
    <Provider store={makeStore()}>
      <ProfileDetails profile={p} organizationName="Công ty Demo" roles={[]} permissionCount={0} />
    </Provider>,
  );
}

describe("the profile details", () => {
  test("shows seniority over every stay, apart from the join date of the latest one", async () => {
    await renderDetails(profile());

    await vi.waitFor(() => expect(rowText("Thâm niên")).toContain("2 năm 2 tháng"));
    // Back on 01/10/2026: the join date alone would only give a few days.
    expect(rowText("Ngày gia nhập")).toContain("1 tháng 10, 2026");
    expect(rowText("Ngày gia nhập")).not.toContain("ngày");
  });

  test("leaves seniority empty when it is unknown", async () => {
    await renderDetails(profile({ joinedOn: null, seniorityDays: null }));

    await vi.waitFor(() => expect(rowText("Thâm niên")).not.toBe(""));
    expect(rowText("Thâm niên")).not.toMatch(/năm|tháng|\d+ ngày/);
  });
});
