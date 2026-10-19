import { afterEach, expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import { portalApi } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import "./api";

afterEach(() => vi.restoreAllMocks());

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

test("a user mutation refetches the chart, whose counts move with the users", async () => {
  const counts = countRequests();
  const store = signedInStore();
  const chart = store.dispatch(portalApi.endpoints.getDepartmentChart.initiate());
  await untilFetched(counts, "/api/Departments/chart", 1);

  await store.dispatch(portalApi.endpoints.deactivateUser.initiate({ id: 5, deactivateUserCommand: {} }));

  await untilFetched(counts, "/api/Departments/chart", 2);
  chart.unsubscribe();
});
