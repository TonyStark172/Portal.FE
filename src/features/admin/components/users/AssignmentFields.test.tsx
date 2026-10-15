import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentDto, type PositionDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { AssignmentFields, type AssignmentValue } from "./AssignmentFields";

afterEach(() => vi.restoreAllMocks());

// The lists are asked for active ones only (the server filters), so an inactive department or position is not in them.
const departments: DepartmentDto[] = [
  { id: 3, code: "IT", name: "CNTT", originalName: "CNTT", parentId: null, parentName: null, isActive: true },
];
const positions: PositionDto[] = [
  { id: 5, code: "SPEC", name: "Chuyên viên", originalName: "Chuyên viên", level: 5, isActive: true },
];

function mockLists() {
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    const path = new URL(request.url).pathname;
    if (path.endsWith("/api/Departments")) return Response.json(departments);
    if (path.endsWith("/api/Positions")) return Response.json(positions);
    return Response.json({});
  });
}

function Harness({ initial, current, onValue }: {
  initial: AssignmentValue;
  current?: Parameters<typeof AssignmentFields>[0]["current"];
  onValue?: (value: AssignmentValue) => void;
}) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions: [Permissions.Departments.View, Permissions.Positions.View],
    }));
    return own;
  });
  const [value, setValue] = useState(initial);
  return (
    <Provider store={store}>
      <AssignmentFields value={value} current={current} onChange={(next) => { setValue(next); onValue?.(next); }} />
    </Provider>
  );
}

test("a department and a position that are no longer active stay shown and selectable for the person who has them", async () => {
  mockLists();
  const screen = await render(
    <Harness
      initial={{ departmentId: 4, positionId: 6 }}
      current={{ department: { id: 4, name: "Phòng cũ" }, position: { id: 6, name: "Chức vụ cũ" } }}
    />,
  );
  // Without `current` the select would show nothing for an id that is not among the active options.
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).toHaveTextContent("Phòng cũ");
  await expect.element(screen.getByRole("button", { name: /Chức vụ/ })).toHaveTextContent("Chức vụ cũ");

  // They are among the options (with the active ones), so a change can be undone.
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await expect.element(screen.getByRole("option", { name: "Phòng cũ" })).toBeVisible();
  await expect.element(screen.getByRole("option", { name: "CNTT" })).toBeVisible();
});

test("a current department that is active is listed once", async () => {
  mockLists();
  const screen = await render(
    <Harness initial={{ departmentId: 3, positionId: 5 }} current={{ department: { id: 3, name: "CNTT" }, position: { id: 5, name: "Chuyên viên" } }} />,
  );
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).toHaveTextContent("CNTT");
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await expect.element(screen.getByRole("option", { name: "CNTT" })).toBeVisible();
  expect(screen.getByRole("option", { name: "CNTT" }).elements()).toHaveLength(1);
});

test("changing away from an inactive department reports the new one", async () => {
  mockLists();
  const onValue = vi.fn();
  const screen = await render(
    <Harness initial={{ departmentId: 4, positionId: 5 }} current={{ department: { id: 4, name: "Phòng cũ" } }} onValue={onValue} />,
  );
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "CNTT" }));
  expect(onValue).toHaveBeenLastCalledWith({ departmentId: 3, positionId: 5 });
});
