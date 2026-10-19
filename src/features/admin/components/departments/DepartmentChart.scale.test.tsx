import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentChartDto, type DepartmentChartNode, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentChart } from "./DepartmentChart";

/** How many times each department's card was rendered (by id), counted by the stand-in for the card below. */
const renders = new Map<number, number>();

vi.mock(import("./DepartmentCard"), async (importOriginal) => {
  const actual = await importOriginal();
  // Not memoised on purpose: it renders whenever its parent branch does, which is what this file is about. The real card
  // is memoised too, so counting here is the strict side of the check.
  const Counting = (props: Parameters<typeof actual.DepartmentCard>[0]) => {
    renders.set(props.node.id, (renders.get(props.node.id) ?? 0) + 1);
    return <actual.DepartmentCard {...props} />;
  };
  return { ...actual, DepartmentCard: Counting as unknown as typeof actual.DepartmentCard };
});

beforeEach(() => renders.clear());

const TOP = 5;
const MIDDLE_PER_TOP = 3;
const LEAVES_PER_MIDDLE = 12;

/** 5 top-level departments, 3 below each of them, 12 below each of those: 5 + 15 + 180 = 200, three levels deep. */
function bigChart(): DepartmentChartDto {
  const departments: DepartmentChartNode[] = [];
  let next = 1;
  const add = (parentId: number | null, childCount: number) => {
    const id = next++;
    departments.push({
      id, code: `D${id}`, name: `Phòng ${id}`, originalName: `Phòng ${id}`, description: null, parentId, isActive: true,
      memberCount: 3, childCount, headCount: 0, heads: [],
    });
    return id;
  };
  for (let a = 0; a < TOP; a++) {
    const top = add(null, MIDDLE_PER_TOP);
    for (let b = 0; b < MIDDLE_PER_TOP; b++) {
      const middle = add(top, LEAVES_PER_MIDDLE);
      for (let c = 0; c < LEAVES_PER_MIDDLE; c++) add(middle, 0);
    }
  }
  return { organizationName: "Báo Tuổi Trẻ", myDepartmentIds: [], departments };
}

const chart = bigChart();

const everything = [Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update, Permissions.Departments.Delete];

function Harness() {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions: everything,
    }));
    return own;
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Inline callbacks, as DepartmentsAdmin passes them: the chart must not be woken by their identity.
  return (
    <Provider store={store}>
      <DepartmentChart chart={chart} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} onAddChild={() => undefined} onMenuAction={() => undefined} />
    </Provider>
  );
}

const rendersSoFar = () => [...renders.entries()].filter(([, count]) => count > 0);

test("a chart of 200 departments draws every card", async () => {
  expect(chart.departments).toHaveLength(200);
  await render(<Harness />);

  await vi.waitFor(() => expect(document.querySelectorAll("[data-department-id]")).toHaveLength(200));
});

test("selecting a card renders only the card that lost the selection and the one that gained it", async () => {
  const screen = await render(<Harness />);
  await vi.waitFor(() => expect(document.querySelectorAll("[data-department-id]")).toHaveLength(200));

  renders.clear();
  await screen.getByRole("group", { name: "Phòng 30", exact: true }).click();
  await expect.element(screen.getByRole("group", { name: "Phòng 30", exact: true })).toHaveAttribute("aria-current", "true");
  expect(rendersSoFar().map(([id]) => id)).toEqual([30]);

  renders.clear();
  await screen.getByRole("group", { name: "Phòng 120", exact: true }).click();
  await expect.element(screen.getByRole("group", { name: "Phòng 120", exact: true })).toHaveAttribute("aria-current", "true");
  await expect.element(screen.getByRole("group", { name: "Phòng 30", exact: true })).not.toHaveAttribute("aria-current");
  expect(rendersSoFar().map(([id]) => id).sort((a, b) => a - b)).toEqual([30, 120]);
});

test("zooming renders no card at all", async () => {
  const screen = await render(<Harness />);
  await vi.waitFor(() => expect(document.querySelectorAll("[data-department-id]")).toHaveLength(200));

  renders.clear();
  await screen.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect.element(screen.getByText("90 %")).toBeVisible();
  expect(rendersSoFar()).toEqual([]);
});
