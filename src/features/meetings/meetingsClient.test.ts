import { afterEach, expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import { signedIn } from "@/shared/session/sessionSlice";
import { createOccurrenceSaver } from "./calendarEvents";
import { meetingProblem, meetingsClient, mutationKey } from "./meetingsClient";
import type { MeetingWriteRequest } from "./meetingTypes";

const client = () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  return meetingsClient(store.dispatch);
};
const booking: MeetingWriteRequest = {
  title: "A", kindId: 1, location: "503", audience: null, participantIds: [], mutationId: "00000000-0000-0000-0000-000000000001",
  schedule: { startUtc: "2030-01-07T02:00:00Z", endUtc: "2030-01-07T03:00:00Z", isAllDay: false, recurrence: null },
};

afterEach(() => vi.restoreAllMocks());

test("a conflict keeps the occurrences that clash, for the form", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue(Response.json(
    { code: "meetingConflict", detail: "Trùng", totalCount: 1, conflicts: [{ sequence: 1, locationConflict: true }] }, { status: 409 }));

  const failure = await client().create(booking).catch(error => error);

  expect(meetingProblem(failure)).toMatchObject({ status: 409, code: "meetingConflict", totalCount: 1, conflicts: [{ sequence: 1 }] });
});

test("meetings sends the filter as query parameters", async () => {
  const requests: Request[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => { requests.push(input as Request); return Response.json([]); });

  await client().meetings({ fromUtc: "2030-01-01T00:00:00Z", toUtc: "2030-01-08T00:00:00Z", mine: true, kindIds: [3, 4], locations: ["A, B"], search: "giao ban" });

  const { searchParams } = new URL(requests[0].url);
  expect(searchParams.getAll("KindIds")).toEqual(["3", "4"]);
  expect(searchParams.getAll("Locations")).toEqual(["A, B"]);
  expect(searchParams.get("Mine")).toBe("true");
  expect(searchParams.get("Search")).toBe("giao ban");
});

test("a server error shows no stack trace", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue(new Response("System.InvalidOperationException: secret", { status: 500 }));

  const failure = await client().create(booking).catch(error => error);

  expect(meetingProblem(failure).detail).toBe("Đã có lỗi xảy ra. Vui lòng thử lại.");
});

test("aborting one of two identical reads leaves the other one (they do not share a request)", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const signal = (input as Request).signal;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); });
    });
    return Response.json([]);
  });
  const api = client();
  const first = new AbortController();

  const reads = Promise.allSettled([
    api.meetings({ fromUtc: "2030-01-01T00:00:00Z", toUtc: "2030-01-08T00:00:00Z" }, first.signal),
    api.meetings({ fromUtc: "2030-01-01T00:00:00Z", toUtc: "2030-01-08T00:00:00Z" }, new AbortController().signal),
  ]);
  first.abort();

  expect((await reads).map(read => read.status)).toEqual(["rejected", "fulfilled"]);
});

test("aborting one of two identical department reads leaves the other one (React mounts twice in development)", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const signal = (input as Request).signal;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); });
    });
    return Response.json([]);
  });
  const api = client();
  const first = new AbortController();

  const reads = Promise.allSettled([api.departments(undefined, first.signal), api.departments(undefined, new AbortController().signal)]);
  first.abort();

  expect((await reads).map(read => read.status)).toEqual(["rejected", "fulfilled"]);
});

test("retry keeps the mutation id, but a changed draft receives a fresh id", () => {
  const first = mutationKey(null, { title: "A", scope: "Series", expectedVersion: 2 });
  expect(mutationKey(first, { title: "A", scope: "Series", expectedVersion: 2 }).id).toBe(first.id);
  expect(mutationKey(first, { title: "B", scope: "Series", expectedVersion: 2 }).id).not.toBe(first.id);
});

test("an ambiguous drag retry resends the same mutation; another move gets a new one", async () => {
  const bodies: { details: { mutationId: string } }[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    bodies.push(await (input as Request).clone().json());
    throw new TypeError("Failed to fetch");
  });
  const save = createOccurrenceSaver();
  const api = client();
  const moved = { id: "7", start: new Date("2030-01-07T09:15:00Z"), end: new Date("2030-01-07T10:00:00Z"), allDay: false,
    extendedProps: { version: 4, seriesVersion: 9, title: "A", kindId: 1, location: "503" } };

  await expect(save(moved, api)).rejects.toBeTruthy();
  await expect(save(moved, api)).rejects.toBeTruthy();
  await expect(save({ ...moved, end: new Date("2030-01-07T11:00:00Z") }, api)).rejects.toBeTruthy();

  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[2].details.mutationId).not.toBe(bodies[0].details.mutationId);
});
