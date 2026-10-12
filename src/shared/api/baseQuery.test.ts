import { expect, test } from "vitest";
import { serializeParams } from "./baseQuery";

test("arrays become repeated parameters and keep commas inside a value", () => {
  expect(serializeParams({ kindIds: [1, 2], locations: ["PHÒNG 503, TẦNG 2"], mine: true, search: undefined }))
    .toBe("kindIds=1&kindIds=2&locations=PH%C3%92NG+503%2C+T%E1%BA%A6NG+2&mine=true");
});
