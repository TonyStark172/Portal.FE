import { describe, expect, test } from "vitest";
import { layoutSpans } from "./gridLayout";

describe("dashboard grid layout", () => {
  test("pairs half-width cards side by side", () => {
    expect(layoutSpans(["half", "half"])).toEqual(["half", "half"]);
  });

  test("stretches a half card left alone at the end of a row", () => {
    expect(layoutSpans(["half"])).toEqual(["full"]);
    expect(layoutSpans(["half", "half", "half"])).toEqual(["half", "half", "full"]);
  });

  test("stretches a half card left alone before a full one", () => {
    expect(layoutSpans(["half", "full", "half", "half"])).toEqual(["full", "full", "half", "half"]);
  });

  test("keeps full cards full", () => {
    expect(layoutSpans(["full", "half", "half"])).toEqual(["full", "half", "half"]);
  });
});
