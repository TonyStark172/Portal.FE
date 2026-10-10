import "@/app/globals.css";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { ParticipantPicker } from "./ParticipantPicker";
import { Provider } from "react-redux";
import { makeStore } from "@/core/store";

const an = { userId: 3, fullName: "Nguyễn Văn An", avatarUrl: null, emailConfirmed: false, gender: null, assignments: [{ isPrimary: true, positionName: "Trưởng phòng" }] };
function Harness({ initial = [] }: { initial?: number[] }) {
  const [ids, setIds] = useState(initial);
  return <Provider store={makeStore()}><div style={{ width: 320, padding: 16, minHeight: 600 }}><ParticipantPicker value={ids} onChange={setIds} token="test-token" /><output aria-label="Selected IDs">{ids.join(",")}</output></div></Provider>;
}
afterEach(() => vi.restoreAllMocks());

test("searches invitation lookup rather than permission-restricted HR profiles", async () => {
  const requests = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [an], totalCount:1, missingEmailCount:0, pageNumber:1 }));
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia" }), "@An");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  expect(requests.mock.calls.some(([url]) => String(url).includes("/api/Meetings/audience/users"))).toBe(true);
});

test("Escape closes the suggestions and resets the query", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [an] }));
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia" }), "@An");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("combobox", { name: "Người tham gia" })).toHaveValue("");
  await expect.element(screen.getByRole("combobox", { name: "Người tham gia" })).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => document.querySelector('[role="listbox"]')).toBeNull();
});

test("searches after @, picks a colleague as a tag and removes that colleague", async () => {
  const requests = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [an] }));
  const screen = await render(<Harness />);
  expect(document.querySelector('[role="combobox"]')).not.toBeNull();
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia" }), "@An");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  await userEvent.click(screen.getByRole("option", { name: /Nguyễn Văn An/ }));
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("3");
  await expect.element(screen.getByText("@Nguyễn Văn An", { exact: true })).toBeVisible();
  expect(requests.mock.calls.some(([url]) => String(url).includes("Search=An"))).toBe(true);
  const remove = document.querySelector<HTMLButtonElement>('[data-slot="tag-remove-button"]');
  expect(remove).not.toBeNull();
  await userEvent.click(remove!);
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("");
});

test("supports keyboard selection and excludes a colleague already selected", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [an] }));
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia" }), "@");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("3");
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia" }), "@An");
  await expect.element(screen.getByText("Không tìm thấy người phù hợp hoặc đã chọn")).toBeVisible();
  expect(document.querySelector('[role="option"][data-key="3"]')).toBeNull();
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("3");
});

test("resolves existing participant IDs to names without dropping them", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items:[an], totalCount:1, missingEmailCount:0, pageNumber:1 }));
  const screen = await render(<Harness initial={[3]} />);
  expect(document.body.textContent).toContain("Người tham gia");
  await expect.element(screen.getByText("@Nguyễn Văn An", { exact: true })).toBeVisible();
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("3");
});

test("keeps selected IDs when their profiles cannot be loaded and offers retry", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => new Response("failure", { status: 500 }));
  const screen = await render(<Harness initial={[3]} />);
  expect(document.body.textContent).toContain("Người tham gia");
  await expect.element(screen.getByRole("button", { name: "Tải lại tên" })).toBeVisible();
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("3");
});

test("missing invitation lookup records do not leave names loading forever",async()=>{
  vi.spyOn(window,"fetch").mockImplementation(async()=>Response.json({items:[],totalCount:0,missingEmailCount:0,pageNumber:1}));
  const screen=await render(<Harness initial={[3]}/>);
  await expect.element(screen.getByRole("button",{name:"Tải lại tên",exact:true})).toBeVisible();
  await expect.element(screen.getByLabelText("Selected IDs")).toHaveTextContent("3");
});
