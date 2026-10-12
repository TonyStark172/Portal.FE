import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { MeetingKindDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { MeetingKindsEditor } from "./MeetingKindsEditor";
afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const kinds: MeetingKindDto[] = [
  { id: 1, name: "Nội bộ", originalName: "Nội bộ", englishName: "Internal", sortOrder: 1, isActive: true, isUsed: true },
  { id: 2, name: "Khách hàng", originalName: "Khách hàng", englishName: null, sortOrder: 2, isActive: true, isUsed: false },
  { id: 3, name: "Đào tạo", originalName: "Đào tạo", englishName: "Training", sortOrder: 3, isActive: false, isUsed: false },
];

type Write = { method: string; path: string; body: unknown };
/** Answers the kinds list (in the order last sent), and each write with `reply` (no content by default); returns the writes seen. */
function mockKinds(reply: (write: Write) => Response = () => new Response(null, { status: 204 })) {
  const writes: Write[] = [];
  let list = kinds;
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    // The API path, without the prefix the app reaches the back end through.
    const path = new URL(url).pathname.replace(/^.*?(?=\/api\/)/, "");
    if (!path.startsWith("/api/MeetingKinds")) return Response.json({});
    if (init.method === "GET") return Response.json(list);
    const write = { method: init.method, path, body: init.body ? JSON.parse(init.body) : null };
    writes.push(write);
    const response = reply(write);
    if (response.ok && path === "/api/MeetingKinds/order") list = (write.body as { ids: number[] }).ids.map(id => kinds.find(k => k.id === id)!);
    return response;
  }));
  return writes;
}

function Harness() {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    return own;
  });
  return <Provider store={store}><MeetingKindsEditor /></Provider>;
}

test("each kind shows its Vietnamese and English names", async () => {
  mockKinds();
  const screen = await render(<Harness />);
  const internal = screen.getByRole("listitem", { name: "Nội bộ" });
  await expect.element(internal.getByRole("textbox", { name: "Tên tiếng Việt" })).toHaveValue("Nội bộ");
  await expect.element(internal.getByRole("textbox", { name: "Tên tiếng Anh" })).toHaveValue("Internal");
  await expect.element(screen.getByRole("listitem", { name: "Khách hàng" }).getByRole("textbox", { name: "Tên tiếng Anh" })).toHaveValue("");
  await expect.element(screen.getByRole("listitem", { name: "Đào tạo" })).toHaveTextContent("Đang ẩn");
});

test("a new kind is posted with both names", async () => {
  const writes = mockKinds(() => Response.json(4));
  const screen = await render(<Harness />);
  const add = screen.getByRole("form", { name: "Thêm loại" });
  await userEvent.fill(add.getByRole("textbox", { name: "Tên tiếng Việt" }), "  Phỏng vấn ");
  await userEvent.fill(add.getByRole("textbox", { name: "Tên tiếng Anh" }), "Interview");
  await userEvent.click(add.getByRole("button", { name: "Thêm loại" }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "POST", path: "/api/MeetingKinds", body: { name: "Phỏng vấn", englishName: "Interview" } }]));
  await expect.element(add.getByRole("textbox", { name: "Tên tiếng Việt" })).toHaveValue("");
});

test("renaming a kind puts its names, keeping whether it is shown", async () => {
  const writes = mockKinds();
  const screen = await render(<Harness />);
  const internal = screen.getByRole("listitem", { name: "Nội bộ" });
  await userEvent.fill(internal.getByRole("textbox", { name: "Tên tiếng Việt" }), "Nội bộ công ty");
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/MeetingKinds/1", body: { name: "Nội bộ công ty", englishName: "Internal", isActive: true } },
  ]));
});

test("hiding a kind puts it as inactive, and a hidden one can be shown again", async () => {
  const writes = mockKinds();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Khách hàng" }).getByRole("button", { name: "Ẩn", exact: true }));
  await userEvent.click(screen.getByRole("listitem", { name: "Đào tạo" }).getByRole("button", { name: "Hiện", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/MeetingKinds/2", body: { name: "Khách hàng", englishName: null, isActive: false } },
    { method: "PUT", path: "/api/MeetingKinds/3", body: { name: "Đào tạo", englishName: "Training", isActive: true } },
  ]));
});

test("moving a kind down sends the new order", async () => {
  const writes = mockKinds();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Nội bộ" }).getByRole("button", { name: "Chuyển xuống" }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "PUT", path: "/api/MeetingKinds/order", body: { ids: [2, 1, 3] } }]));
  await expect.element(screen.getByRole("listitem", { name: "Nội bộ" }).getByRole("button", { name: "Chuyển lên" })).toBeEnabled();
  await expect.element(screen.getByRole("listitem", { name: "Khách hàng" }).getByRole("button", { name: "Chuyển lên" })).toBeDisabled();
});

test("a kind meetings use cannot be deleted and says why; an unused one can", async () => {
  const writes = mockKinds();
  const screen = await render(<Harness />);
  const used = screen.getByRole("listitem", { name: "Nội bộ" }).getByRole("button", { name: "Xóa" });
  await expect.element(used).toHaveAttribute("aria-disabled", "true");
  await userEvent.hover(used);
  await expect.element(screen.getByRole("tooltip")).toHaveTextContent("Đã có cuộc họp dùng loại này; hãy ẩn thay vì xóa.");
  // Playwright will not press what is aria-disabled; a click sent anyway must do nothing.
  used.element().dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await userEvent.click(screen.getByRole("listitem", { name: "Khách hàng" }).getByRole("button", { name: "Xóa" }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/MeetingKinds/2", body: null }]));
});

test("a name another kind has is refused under its row", async () => {
  mockKinds(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.", errors: { name: ["Đã có loại cuộc họp này."] },
  }, { status: 400 }));
  const screen = await render(<Harness />);
  const customer = screen.getByRole("listitem", { name: "Khách hàng" });
  await userEvent.fill(customer.getByRole("textbox", { name: "Tên tiếng Việt" }), "Nội bộ");
  await userEvent.keyboard("{Enter}");
  await expect.element(customer.getByRole("alert")).toHaveTextContent("Đã có loại cuộc họp này.");
  await expect.element(customer.getByRole("textbox", { name: "Tên tiếng Việt" })).toHaveValue("Nội bộ");
});

const lastActiveKind = "Phải còn ít nhất một loại cuộc họp đang dùng.";
const lastActiveProblem = (field: string) => Response.json({
  status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.", errors: { [field]: [lastActiveKind] },
}, { status: 400 });

test("hiding the last active kind is refused under its row", async () => {
  mockKinds(() => lastActiveProblem("isActive"));
  const screen = await render(<Harness />);
  const customer = screen.getByRole("listitem", { name: "Khách hàng" });
  await userEvent.click(customer.getByRole("button", { name: "Ẩn", exact: true }));
  await expect.element(customer.getByRole("alert")).toHaveTextContent(lastActiveKind);
});

test("deleting the last active kind is refused under its row", async () => {
  mockKinds(() => lastActiveProblem("id"));
  const screen = await render(<Harness />);
  const customer = screen.getByRole("listitem", { name: "Khách hàng" });
  await userEvent.click(customer.getByRole("button", { name: "Xóa" }));
  await expect.element(customer.getByRole("alert")).toHaveTextContent(lastActiveKind);
});
