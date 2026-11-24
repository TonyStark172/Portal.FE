import { afterEach, describe, expect, test, vi } from "vitest";
import { acquireImage, clearImageCache, MAX_IDLE_IMAGES, peekImage, releaseImage } from "./imageCache";

const login = {};
const blob = () => Promise.resolve(new Blob(["x"]));

afterEach(() => {
  clearImageCache();
  vi.restoreAllMocks();
});

describe("the images of the conversations kept in the page", () => {
  test("are downloaded once, however many places show them", async () => {
    const load = vi.fn(blob);
    const first = await acquireImage(login, "/a", load);
    const second = await acquireImage(login, "/a", load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(peekImage(login, "/a")).toBe(first);
  });

  test("stay after their last user is gone, for the next one", async () => {
    const load = vi.fn(blob);
    const url = await acquireImage(login, "/a", load);
    releaseImage(login, "/a");
    expect(await acquireImage(login, "/a", load)).toBe(url);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("are tried again after a failed download", async () => {
    await expect(acquireImage(login, "/a", () => Promise.reject(new Error("404")))).rejects.toThrow("404");
    expect(peekImage(login, "/a")).toBeUndefined();
    await expect(acquireImage(login, "/a", blob)).resolves.toMatch(/^blob:/);
  });

  test("let go of the least recently used ones nobody shows, never of one in use", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const kept = await acquireImage(login, "/in-use", blob);
    for (let i = 0; i <= MAX_IDLE_IMAGES; i++) {
      await acquireImage(login, `/idle-${i}`, blob);
      releaseImage(login, `/idle-${i}`);
    }
    // One more than fits: the first idle one went.
    expect(peekImage(login, "/idle-0")).toBeUndefined();
    expect(peekImage(login, "/idle-1")).toBeDefined();
    expect(peekImage(login, "/in-use")).toBe(kept);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  test("are all dropped when another account signs in", async () => {
    const url = await acquireImage(login, "/a", blob);
    const other = {};
    expect(peekImage(other, "/a")).toBeUndefined();
    const again = await acquireImage(other, "/a", blob);
    expect(again).not.toBe(url);
    expect(peekImage(login, "/a")).toBeUndefined();
  });
});
