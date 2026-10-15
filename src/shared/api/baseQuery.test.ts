import type { BaseQueryApi } from "@reduxjs/toolkit/query";
import { afterEach, describe, expect, test, vi } from "vitest";
import { baseApi } from "./baseApi";
import { baseQueryWithReauth, serializeParams } from "./baseQuery";

test("arrays become repeated parameters and keep commas inside a value", () => {
  expect(serializeParams({ kindIds: [1, 2], locations: ["PHÒNG 503, TẦNG 2"], mine: true, search: undefined }))
    .toBe("kindIds=1&kindIds=2&locations=PH%C3%92NG+503%2C+T%E1%BA%A6NG+2&mine=true");
});

describe("a request refused because the password must be changed first", () => {
  afterEach(() => vi.restoreAllMocks());

  function callWith(response: Response) {
    vi.spyOn(window, "fetch").mockResolvedValue(response);
    const dispatch = vi.fn((action: unknown) => action);
    const api = {
      signal: new AbortController().signal,
      abort: () => {},
      dispatch,
      getState: () => ({ session: { status: "authenticated", accessToken: "token" } }),
      extra: undefined,
      endpoint: "getMeetings",
      type: "query",
    } as unknown as BaseQueryApi;
    return { dispatch, result: baseQueryWithReauth("/api/Meetings", api, {}) };
  }

  const invalidatedAuth = (dispatch: ReturnType<typeof vi.fn>) =>
    dispatch.mock.calls.some(([action]) => baseApi.util.invalidateTags.match(action) && JSON.stringify(action.payload) === '["Auth"]');

  test("refreshes the signed-in user so the app can send them to the change page", async () => {
    const { dispatch, result } = callWith(Response.json({ status: 403, code: "password_change_required" }, { status: 403 }));
    expect((await result).error?.status).toBe(403);
    expect(invalidatedAuth(dispatch)).toBe(true);
  });

  test("any other refusal leaves the cache alone", async () => {
    const { dispatch, result } = callWith(Response.json({ status: 403, code: "forbidden" }, { status: 403 }));
    expect((await result).error?.status).toBe(403);
    expect(invalidatedAuth(dispatch)).toBe(false);
  });
});
