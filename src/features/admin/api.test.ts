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
