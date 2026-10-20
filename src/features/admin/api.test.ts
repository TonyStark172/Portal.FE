import { afterEach, expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import { portalApi } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import "./api";

afterEach(() => vi.restoreAllMocks());

/** A store with the roles list subscribed to, as the Roles tab does; returns the roles requests made so far. */
async function mountedRoles() {
  const roleReads: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href));
    const path = new URL(request.url).pathname.replace(/^.*\/api\//, "/api/");
    if (request.method === "GET" && path === "/api/Roles") {
      roleReads.push(path);
      return Response.json([]);
    }
    return request.method === "POST" ? Response.json(7) : new Response(null, { status: 204 });
  });
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  store.dispatch(portalApi.endpoints.getRoles.initiate());
  await vi.waitFor(() => expect(roleReads).toHaveLength(1));
  return { store, roleReads };
}

// The Roles tab shows how many people hold each role (and DeleteRoleDialog decides what to ask from it): any change to
// the users has to make it read again.
const userChanges = {
  "creating a user": (store: ReturnType<typeof makeStore>) =>
    store.dispatch(portalApi.endpoints.createUser.initiate({ createUserCommand: { userName: "an", fullName: "An" } as never })),
  "updating a user": (store: ReturnType<typeof makeStore>) =>
    store.dispatch(portalApi.endpoints.updateUser.initiate({ id: 5, updateUserCommand: { fullName: "An" } as never })),
  "deleting a user": (store: ReturnType<typeof makeStore>) => store.dispatch(portalApi.endpoints.deleteUser.initiate({ id: 5 })),
  "deactivating a user": (store: ReturnType<typeof makeStore>) =>
    store.dispatch(portalApi.endpoints.deactivateUser.initiate({ id: 5, deactivateUserCommand: {} as never })),
  "reactivating a user": (store: ReturnType<typeof makeStore>) =>
    store.dispatch(portalApi.endpoints.reactivateUser.initiate({ id: 5, reactivateUserCommand: {} as never })),
};

for (const [name, change] of Object.entries(userChanges)) {
  test(`${name} makes a mounted roles list read again`, async () => {
    const { store, roleReads } = await mountedRoles();
    await change(store);
    await vi.waitFor(() => expect(roleReads).toHaveLength(2));
  });
}

// Departments and users show each other's changes: the chart counts people, the users page lists their assignments.
/** Counts how often each path is fetched; every answer is an empty success. */
function countRequests() {
  const counts: Record<string, number> = {};
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    const path = new URL(request.url).pathname.replace(/^.*?(?=\/api\/)/, "");
    if (request.method === "GET") counts[path] = (counts[path] ?? 0) + 1;
    return Response.json(path.endsWith("/chart") ? { organizationName: "", departments: [], myDepartmentIds: [] } : []);
  });
  return counts;
}

const signedInStore = () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  return store;
};

/** Waits until `path` has been fetched `times` times. */
const untilFetched = (counts: Record<string, number>, path: string, times: number) =>
  expect.poll(() => counts[path] ?? 0).toBe(times);

test("a department mutation refetches the chart and the users list", async () => {
  const counts = countRequests();
  const store = signedInStore();
  const chart = store.dispatch(portalApi.endpoints.getDepartmentChart.initiate());
  const users = store.dispatch(portalApi.endpoints.getUsers.initiate({}));
  await untilFetched(counts, "/api/Departments/chart", 1);
  await untilFetched(counts, "/api/Users", 1);

  await store.dispatch(portalApi.endpoints.moveDepartment.initiate({ id: 3, moveDepartmentCommand: { parentId: null } }));

  await untilFetched(counts, "/api/Departments/chart", 2);
  await untilFetched(counts, "/api/Users", 2);
  chart.unsubscribe();
  users.unsubscribe();
});

test("a department mutation also refetches a person's profile and the staff dashboard", async () => {
  const counts = countRequests();
  const store = signedInStore();
  const profile = store.dispatch(portalApi.endpoints.getProfile.initiate({ userId: 5 }));
  const dashboard = store.dispatch(portalApi.endpoints.getStaffDashboard.initiate({}));
  await untilFetched(counts, "/api/Profiles/5", 1);
  await untilFetched(counts, "/api/Dashboard/staff", 1);

  await store.dispatch(
    portalApi.endpoints.addDepartmentMembers.initiate({
      id: 3,
      addDepartmentMembersCommand: { userIds: [5], role: "Member", placement: "Transfer" },
    }),
  );

  await untilFetched(counts, "/api/Profiles/5", 2);
  await untilFetched(counts, "/api/Dashboard/staff", 2);
  profile.unsubscribe();
  dashboard.unsubscribe();
});

test("a user mutation refetches the chart, whose counts move with the users", async () => {
  const counts = countRequests();
  const store = signedInStore();
  const chart = store.dispatch(portalApi.endpoints.getDepartmentChart.initiate());
  await untilFetched(counts, "/api/Departments/chart", 1);

  await store.dispatch(portalApi.endpoints.deactivateUser.initiate({ id: 5, deactivateUserCommand: {} }));

  await untilFetched(counts, "/api/Departments/chart", 2);
  chart.unsubscribe();
});

test("saving the organization refetches the chart, which draws its name", async () => {
  const counts = countRequests();
  const store = signedInStore();
  const chart = store.dispatch(portalApi.endpoints.getDepartmentChart.initiate());
  await untilFetched(counts, "/api/Departments/chart", 1);

  await store.dispatch(portalApi.endpoints.updateOrganization.initiate({ updateOrganizationCommand: { name: "Báo Tuổi Trẻ" } }));

  await untilFetched(counts, "/api/Departments/chart", 2);
  chart.unsubscribe();
});

test("a position mutation refetches the department members, the users list and the positions list", async () => {
  const counts = countRequests();
  const store = signedInStore();
  const members = store.dispatch(portalApi.endpoints.getDepartmentMembers.initiate({ id: 3 }));
  const users = store.dispatch(portalApi.endpoints.getUsers.initiate({}));
  const positions = store.dispatch(portalApi.endpoints.getPositions.initiate({}));
  await untilFetched(counts, "/api/Departments/3/members", 1);
  await untilFetched(counts, "/api/Users", 1);
  await untilFetched(counts, "/api/Positions", 1);

  await store.dispatch(
    portalApi.endpoints.updatePosition.initiate({
      id: 4,
      updatePositionCommand: { code: "TP", name: "Trưởng phòng", level: 2, isActive: true },
    }),
  );

  await untilFetched(counts, "/api/Departments/3/members", 2);
  await untilFetched(counts, "/api/Users", 2);
  await untilFetched(counts, "/api/Positions", 2);
  members.unsubscribe();
  users.unsubscribe();
  positions.unsubscribe();
});

const positionChanges = {
  "creating a position": (store: ReturnType<typeof makeStore>) =>
    store.dispatch(portalApi.endpoints.createPosition.initiate({ createPositionCommand: { code: "TP", name: "Trưởng phòng", level: 2 } })),
  "deleting a position": (store: ReturnType<typeof makeStore>) => store.dispatch(portalApi.endpoints.deletePosition.initiate({ id: 4 })),
};

for (const [name, change] of Object.entries(positionChanges)) {
  test(`${name} refetches the users list and the department members`, async () => {
    const counts = countRequests();
    const store = signedInStore();
    const members = store.dispatch(portalApi.endpoints.getDepartmentMembers.initiate({ id: 3 }));
    const users = store.dispatch(portalApi.endpoints.getUsers.initiate({}));
    await untilFetched(counts, "/api/Departments/3/members", 1);
    await untilFetched(counts, "/api/Users", 1);

    await change(store);

    await untilFetched(counts, "/api/Departments/3/members", 2);
    await untilFetched(counts, "/api/Users", 2);
    members.unsubscribe();
    users.unsubscribe();
  });
}
