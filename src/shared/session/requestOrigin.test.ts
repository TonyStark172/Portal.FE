import { expect, test } from "vitest";
import { isSameOriginJson } from "./requestOrigin";

// A standalone Headers object accepts Origin, Host and Sec-Fetch-Site, which a browser-built Request would drop.
const headers = (init: Record<string, string>) => new Headers(init);
const json = { "Content-Type": "application/json", "Content-Length": "20" };

test("a same-origin JSON request goes through, behind a proxy too", () => {
  expect(isSameOriginJson(headers({ ...json, Host: "portal.local", Origin: "http://portal.local" }))).toBe(true);
  expect(isSameOriginJson(headers({ ...json, Host: "localhost:3000", "X-Forwarded-Host": "portal.example.com",
    Origin: "https://portal.example.com", "Sec-Fetch-Site": "same-origin" }))).toBe(true);
  // No Origin (a non-browser client), and a body-less request needs no content type.
  expect(isSameOriginJson(headers({ ...json, Host: "portal.local" }))).toBe(true);
  expect(isSameOriginJson(headers({ Host: "portal.local", Origin: "http://portal.local" }))).toBe(true);
});

test("a cross-site or non-JSON request is refused", () => {
  const refused = [
    headers({ ...json, Host: "portal.local", Origin: "https://evil.example" }),
    headers({ ...json, Host: "portal.local", Origin: "null" }),
    headers({ ...json, Host: "localhost:3000", "X-Forwarded-Host": "portal.example.com", Origin: "http://localhost:3000" }),
    headers({ ...json, Host: "portal.local", "Sec-Fetch-Site": "cross-site" }),
    headers({ ...json, Host: "portal.local", "Sec-Fetch-Site": "same-site" }),
    headers({ Host: "portal.local", "Content-Type": "text/plain", "Content-Length": "20" }),
    headers({ Host: "portal.local", "Content-Type": "application/x-www-form-urlencoded", "Transfer-Encoding": "chunked" }),
  ];
  for (const candidate of refused) expect(isSameOriginJson(candidate)).toBe(false);
});
