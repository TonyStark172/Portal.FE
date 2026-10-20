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

  const assignment = (overrides: Partial<ProfileDto["assignments"][number]> = {}) =>
    ({
      departmentId: 3,
      departmentName: "CNTT",
      isPrimary: true,
      role: "Member",
      positionId: null,
      positionName: null,
      ...overrides,
    }) as ProfileDto["assignments"][number];

  test("shows only the department when the assignment has no position", async () => {
    await renderDetails(profile({ assignments: [assignment()] }));

    await vi.waitFor(() => expect(rowText("Vị trí chính")).toContain("CNTT"));
    const text = rowText("Vị trí chính");
    expect(text).not.toMatch(/tại/);
    expect(text).not.toMatch(/Trưởng phòng|Phó phòng/);
  });

  test("keeps 'position at department' when there is a position", async () => {
    await renderDetails(profile({ assignments: [assignment({ positionId: 5, positionName: "Kỹ sư" })] }));

    await vi.waitFor(() => expect(rowText("Vị trí chính")).toContain("Kỹ sư tại CNTT"));
  });

  test("shows head and deputy next to their department", async () => {
    await renderDetails(
      profile({
        assignments: [
          assignment({ role: "Head" }),
          assignment({ departmentId: 4, departmentName: "Kế toán", isPrimary: false, role: "Deputy" }),
        ],
      }),
    );

    await vi.waitFor(() => expect(rowText("Vị trí chính")).toContain("Trưởng phòng"));
    expect(rowText("Vị trí chính")).toContain("CNTT");
    expect(rowText("Kiêm nhiệm")).toContain("Kế toán");
    expect(rowText("Kiêm nhiệm")).toContain("Phó phòng");
  });
});
