import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { signedIn } from "@/shared/session/sessionSlice";
import { useParticipantProfiles } from "./useParticipantProfiles";

const person = (userId: number) => ({ userId, fullName: `Người ${userId}`, employeeCode: null, avatarUrl: null, positionName: null });
const urlOf = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input), location.href);

function Names({ ids }: { ids: number[] }) {
  const { profiles, failed, retry } = useParticipantProfiles(ids);
  return (
    <div>
      <output aria-label="names">{ids.map(id => profiles[id]?.fullName ?? "?").join(",")}</output>
      {failed && <button onClick={retry}>retry</button>}
    </div>
  );
}

async function show(ids: number[]) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  return render(<Provider store={store}><Names ids={ids} /></Provider>);
}

afterEach(() => vi.restoreAllMocks());

test("names the people picked, asking for at most 50 at a time", async () => {
  const asked: number[][] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const ids = (urlOf(input).searchParams.get("Ids") ?? "").split(",").map(Number);
    asked.push(ids);
    return Response.json({ items: ids.map(person), totalCount: ids.length, missingEmailCount: 0, pageNumber: 1 });
  });
  const ids = Array.from({ length: 60 }, (_, i) => i + 1);

  const screen = await show(ids);

  await expect.element(screen.getByLabelText("names")).toHaveTextContent(ids.map(id => `Người ${id}`).join(","));
  expect(asked.map(batch => batch.length).sort()).toEqual([10, 50]);
});

test("keeps the people whose names cannot be loaded, and offers to try again", async () => {
  let fail = true;
  vi.spyOn(window, "fetch").mockImplementation(async () =>
    fail ? new Response(null, { status: 500 }) : Response.json({ items: [person(3)], totalCount: 1, missingEmailCount: 0, pageNumber: 1 }));

  const screen = await show([3]);

  await expect.element(screen.getByRole("button", { name: "retry" })).toBeVisible();
  expect(screen.getByLabelText("names").element().textContent).toBe("?");
  fail = false;
  await screen.getByRole("button", { name: "retry" }).click();
  await expect.element(screen.getByLabelText("names")).toHaveTextContent("Người 3");
});

test("someone the lookup does not know does not leave the name loading forever", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));

  const screen = await show([404]);

  await expect.element(screen.getByRole("button", { name: "retry" })).toBeVisible();
});
