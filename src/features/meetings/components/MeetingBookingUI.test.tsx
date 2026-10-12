import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { MeetingCalendar } from "./MeetingCalendar";
import { Toast, toast } from "@heroui/react";
vi.mock("@/features/auth", () => ({ useCurrentUser: () => ({ user: { id: 1 }, hasPermission: () => true }) }));
// The calendar keeps its view and filters in the page URL; here the page has none and nothing reads what it writes.
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: () => {} }) }));
/** Calls `handler` with the URL and init of what RTK Query hands fetch (a Request), as plain fetch calls had them. */
const withRequest = (handler: (url: string, init: { method: string; body: string | null; signal: AbortSignal }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text(), signal: request.signal });
  };


const catalog = [{ id: 1, name: "Họp nội bộ", isActive: true }, { id: 2, name: "Đào tạo", isActive: true }];

afterEach(() => { vi.restoreAllMocks(); toast.clear(); });
test("all-day meetings occupy the time grid without a separate all-day row", async () => {
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async url => {
    const parsed = new URL(String(url), window.location.origin);
    if (!parsed.searchParams.has("FromUtc")) return Response.json([]);
    const start = new Date(parsed.searchParams.get("FromUtc")!);
    start.setUTCDate(start.getUTCDate() + 2);
    return Response.json([{id:501,title:"Họp cổ đông",location:"501",kindId:1,kind:"Nội bộ",organizerId:1,participantIds:[],isAllDay:true,
      startUtc:start.toISOString(),endUtc:new Date(start.getTime()+86400000).toISOString()}]);
  }));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar/></Provider>);
  await expect.poll(() => document.querySelectorAll(".fc-timegrid-event").length).toBe(1);
  expect(document.querySelector(".fc-timegrid-axis-cushion")).toBeNull();
  await expect.element(screen.getByText("Cả ngày",{exact:true})).toBeVisible();
  expect(document.querySelector(".fc-timegrid-event")!.classList.contains("fc-event-draggable")).toBe(false);
});
test("recurrence has one visible label and its divider spans both columns", async () => {
  await page.viewport(1214, 884);
  try {
    await openCreate();
    const recurrence = document.querySelector<HTMLElement>('section[aria-label="Lặp lại"]')!;
    const visibleLabels = [...recurrence.querySelectorAll("h3, span, label")].filter(element =>
      element.textContent === "Lặp lại" && element.getBoundingClientRect().width > 1);
    expect(visibleLabels).toHaveLength(1);
    const time = document.querySelector<HTMLElement>('section[aria-label="Thời gian · UTC+7"]')!.getBoundingClientRect();
    const divider = recurrence.getBoundingClientRect();
    expect(Math.abs(divider.bottom - time.bottom)).toBeLessThan(2);
    expect(Math.abs(divider.top - time.top)).toBeLessThan(2);
  } finally { await page.viewport(1000,800); }
});
test("time and recurrence sit side by side on desktop and stack on mobile", async () => {
  for (const width of [1214, 390]) {
    await page.viewport(width, 884);
    const screen = await openCreate();
    try {
      const time = document.querySelector<HTMLElement>('.meeting-booking-dialog [data-slot="switch"]')!.closest("section")!.getBoundingClientRect();
      const recurrence = (await screen.getByRole("button", {name:/Lặp lại/}).element()).getBoundingClientRect();
      if (width > 1000) {
        expect(recurrence.left).toBeGreaterThanOrEqual(time.right);
        expect(recurrence.top).toBeLessThan(time.bottom);
      } else {
        expect(recurrence.top).toBeGreaterThanOrEqual(time.bottom);
      }
    } finally {
      await screen.unmount();
      vi.restoreAllMocks();
      await page.viewport(1000, 800);
    }
  }
});
test("new booking does not preselect its creator", async () => {
  const screen = await openCreate();
  await expect.element(screen.getByRole("grid", {name:"Người đã chọn"})).not.toBeInTheDocument();
});
test("participant field spans the form above the time section", async () => {
  await page.viewport(1200, 884);
  try {
    await openCreate();
    const title = document.querySelector<HTMLElement>('input[maxlength="200"]')!.getBoundingClientRect();
    const audience = document.querySelector<HTMLElement>('[role="combobox"]')!.getBoundingClientRect();
    const time = document.querySelector<HTMLElement>('.meeting-booking-dialog [data-slot="switch"]')!.getBoundingClientRect();
    expect(audience.width).toBeGreaterThan(title.width * 0.8);
    expect(audience.top).toBeGreaterThan(title.bottom);
    expect(time.top).toBeGreaterThan(audience.bottom);
  } finally { await page.viewport(1000, 800); }
});
async function openCreate() {
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (url) => Response.json(String(url).includes("audience")
    ? { items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 } : [])));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("button", { name: "Thêm cuộc họp", exact: true }));
  return screen;
}
test.each([[390, "@ người · / phòng ban"], [1000, "@ người hoặc tất cả · / phòng ban"]])("at %ipx the participants field shows its whole hint", async (width, hint) => {
  await page.viewport(width, 844);
  try {
    const screen = await openCreate();
    const input = (await screen.getByRole("combobox", { name: "Người tham gia", exact: true }).element()) as HTMLInputElement;
    expect(input.placeholder).toBe(hint);
    const style = getComputedStyle(input);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = style.font;
    const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    expect(context.measureText(input.placeholder).width).toBeLessThanOrEqual(room);
  } finally { await page.viewport(1000, 800); }
});
test("create form exposes all-day, recurrence, and group invitation controls", async () => {
  const screen = await openCreate();
  await expect.element(screen.getByRole("switch", { name: "Cả ngày", exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Lặp lại/ })).toBeVisible();
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "@");
  await expect.element(screen.getByRole("option", { name: /Tất cả nhân viên/ })).toBeVisible();
});
test("all-day toggle removes hour segments and restores them when turned off", async () => {
  const screen = await openCreate();
  const before = document.querySelectorAll('[data-type="hour"]').length;
  expect(before).toBe(2);
  await userEvent.click(screen.getByRole("dialog").getByText("Cả ngày", { exact: true }));
  expect(document.querySelectorAll('[data-type="hour"]').length).toBe(0);
  await userEvent.click(screen.getByRole("dialog").getByText("Cả ngày", { exact: true }));
  expect(document.querySelectorAll('[data-type="hour"]').length).toBe(2);
});

test("clicking the visible all-day track toggles dates, not just clicking its label",async()=>{
  const screen=await openCreate();
  const track=document.querySelector<HTMLElement>('.meeting-booking-dialog [data-slot="switch-control"]')!;
  await userEvent.click(track);
  await expect.element(screen.getByRole("switch",{name:"Cả ngày",exact:true})).toBeChecked();
  expect(document.querySelectorAll('[data-type="hour"]').length).toBe(0);
  await userEvent.click(track);
  await expect.element(screen.getByRole("switch",{name:"Cả ngày",exact:true})).not.toBeChecked();
  expect(document.querySelectorAll('[data-type="hour"]').length).toBe(2);
});
test("wide meeting modal keeps footer visible and fits the viewport", async () => {
  const screen = await openCreate();
  const dialog = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
  expect(dialog.width).toBeGreaterThan(850);
  expect(dialog.width).toBeLessThanOrEqual(window.innerWidth);
  await expect.element(screen.getByRole("button", { name: "Tạo cuộc họp", exact: true })).toBeVisible();
});

test("expanded recurring form keeps footer inside the dialog on desktop and mobile",async()=>{
  for(const viewport of [{width:1214,height:884},{width:390,height:667}]){
    await page.viewport(viewport.width,viewport.height);
    try{
      const screen=await openCreate();
      await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
      await userEvent.click(screen.getByRole("option",{name:"Tùy chỉnh",exact:true}));
      await expect.element(screen.getByRole("spinbutton",{name:"Lặp lại mỗi"})).toBeVisible();
      await expect.element(screen.getByRole("dialog",{name:"Thiết lập lặp lại"})).not.toBeInTheDocument();
      expect(document.querySelectorAll('.modal__dialog').length).toBe(1);
      const dialog=document.querySelector('.meeting-booking-dialog')!.getBoundingClientRect();
      const footer=document.querySelector('.modal__footer')!.getBoundingClientRect();
      expect(footer.bottom).toBeLessThanOrEqual(dialog.bottom);
      expect(footer.bottom).toBeLessThanOrEqual(window.innerHeight);
      expect(footer.top).toBeGreaterThanOrEqual(dialog.top);
      expect(dialog.width).toBeLessThanOrEqual(window.innerWidth);
      await userEvent.click(screen.getByRole("button",{name:"Hủy",exact:true}));
      await screen.unmount();
      vi.restoreAllMocks();
    }finally{await page.viewport(1000,800);}
  }
});

test("saving is disabled while group membership is being resolved",async()=>{
  let resolveMembership:((response:Response)=>void)|undefined;
  vi.spyOn(window,"fetch").mockImplementation(withRequest(async(url)=>{
    if(String(url).includes("/departments"))return Response.json([{id:4,name:"Kinh doanh"}]);
    if(String(url).includes("/preview"))return new Promise<Response>(resolve=>{resolveMembership=resolve;});
    if(String(url).includes("/audience/users"))return Response.json({items:[{userId:3,fullName:"An"}],totalCount:1,missingEmailCount:0,pageNumber:1});
    return Response.json([]);
  }));
  const screen=await render(<Provider store={makeStore()}><MeetingCalendar/></Provider>);
  await userEvent.click(screen.getByRole("button",{name:"Thêm cuộc họp",exact:true}));
  const input=screen.getByRole("combobox",{name:"Người tham gia",exact:true});
  await userEvent.fill(input,"@An");
  await userEvent.click(screen.getByRole("option",{name:/An/}));
  await userEvent.fill(input,"/Kinh");
  await userEvent.click(screen.getByRole("option",{name:/Kinh doanh/}));
  expect(document.querySelector<HTMLButtonElement>('.modal__footer button:last-child')!.disabled).toBe(true);
  resolveMembership!(Response.json({items:[],totalCount:0,missingEmailCount:0,pageNumber:1}));
  await expect.element(screen.getByRole("button",{name:"Tạo cuộc họp",exact:true})).not.toBeDisabled();
});

test("create sends an all-day recurring booking and group sources, not preview members", async () => {
  const writes: Record<string,unknown>[]=[];
  vi.spyOn(window,"fetch").mockImplementation(withRequest(async(url,init)=>{
    if(String(url).includes("/MeetingKinds"))return Response.json(catalog);
    if(String(url).includes("/bookings")){writes.push(JSON.parse(String(init?.body)));return Response.json({meetingId:8,occurrenceCount:10});}
    if(String(url).includes("/departments"))return Response.json([{id:4,name:"Kinh doanh"}]);
    if(String(url).includes("/audience/"))return Response.json({items:[],totalCount:5000,missingEmailCount:2,pageNumber:1});
    return Response.json([]);
  }));
  const screen=await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("button",{name:"Thêm cuộc họp",exact:true}));
  await userEvent.fill(screen.getByRole("textbox",{name:"Tên cuộc họp*"}),"Tập huấn");
  await userEvent.fill(screen.getByRole("textbox",{name:"Phòng họp / địa điểm*"}),"Hội trường");
  await userEvent.click(screen.getByRole("dialog").getByText("Cả ngày",{exact:true}));
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  await userEvent.click(screen.getByRole("option",{name:"Hàng ngày",exact:true}));
  await userEvent.fill(screen.getByRole("combobox",{name:"Người tham gia",exact:true}),"@");
  await userEvent.click(screen.getByRole("option",{name:/Tất cả nhân viên/}));
  await expect.element(screen.getByText("@Tất cả nhân viên",{exact:true})).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Tạo cuộc họp",exact:true}));
  await expect.poll(()=>writes.length).toBe(1);
  expect(writes[0]).toMatchObject({title:"Tập huấn",audience:{allEmployees:true,userIds:[],departmentIds:[]},participantIds:null,schedule:{isAllDay:true,recurrence:{frequency:"Daily",count:null}}});
  expect((writes[0].schedule as {recurrence:{until:string}}).recurrence.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const schedule=writes[0].schedule as {startUtc:string;endUtc:string};
  expect(new Date(schedule.endUtc).getTime()-new Date(schedule.startUtc).getTime()).toBe(86400000);
  expect(schedule.startUtc).toContain("T17:00:00.000Z");
});

test("network retries preserve the draft and mutation key; editing it replaces the key",async()=>{
  const writes:{mutationId:string;title:string}[]=[];
  vi.spyOn(window,"fetch").mockImplementation(withRequest(async(url,init)=>{
    if(String(url).includes("/MeetingKinds"))return Response.json(catalog);
    if(String(url).includes("/bookings")){writes.push(JSON.parse(String(init?.body)));throw new TypeError("Failed to fetch");}
    if(String(url).includes("/departments"))return Response.json([]);
    if(String(url).includes("/audience/"))return Response.json({items:[],totalCount:0,missingEmailCount:0,pageNumber:1});
    return Response.json([]);
  }));
  const screen=await render(<Provider store={makeStore()}><Toast.Provider /><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("button",{name:"Thêm cuộc họp",exact:true}));
  await userEvent.fill(screen.getByRole("textbox",{name:"Tên cuộc họp*"}),"Bản nháp");
  await userEvent.fill(screen.getByRole("textbox",{name:"Phòng họp / địa điểm*"}),"503");
  for(let i=1;i<=2;i++){
    await userEvent.click(screen.getByRole("button",{name:"Tạo cuộc họp",exact:true}));
    await expect.poll(()=>writes.length).toBe(i);
    await expect.element(screen.getByRole("alertdialog")).toHaveTextContent("Không kết nối");
  }
  expect(writes[0].mutationId).toBe(writes[1].mutationId);
  await expect.element(screen.getByRole("textbox",{name:"Tên cuộc họp*"})).toHaveValue("Bản nháp");
  await userEvent.fill(screen.getByRole("textbox",{name:"Tên cuộc họp*"}),"Đổi tên");
  await userEvent.click(screen.getByRole("button",{name:"Tạo cuộc họp",exact:true}));
  await expect.poll(()=>writes.length).toBe(3);
  expect(writes[2].mutationId).not.toBe(writes[0].mutationId);
});

test("a structured conflict keeps the draft and explains the conflicting occurrence",async()=>{
  vi.spyOn(window,"fetch").mockImplementation(withRequest(async(url)=>{
    if(String(url).includes("/MeetingKinds"))return Response.json(catalog);
    if(String(url).includes("/bookings"))return Response.json({status:409,code:"meetingConflict",detail:"Chưa lưu thay đổi nào.",totalCount:1,conflicts:[{sequence:2,startUtc:"2030-01-07T02:00:00Z",endUtc:"2030-01-07T03:00:00Z",locationConflict:true,participantConflict:false}]},{status:409});
    if(String(url).includes("/departments"))return Response.json([]);
    return Response.json([]);
  }));
  const screen=await render(<Provider store={makeStore()}><MeetingCalendar/></Provider>);
  await userEvent.click(screen.getByRole("button",{name:"Thêm cuộc họp",exact:true}));
  await userEvent.fill(screen.getByRole("textbox",{name:"Tên cuộc họp*"}),"Giữ bản nháp");
  await userEvent.fill(screen.getByRole("textbox",{name:"Phòng họp / địa điểm*"}),"503");
  await userEvent.click(screen.getByRole("button",{name:"Tạo cuộc họp",exact:true}));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Chưa lưu thay đổi nào.");
  await expect.element(screen.getByRole("textbox",{name:"Tên cuộc họp*"})).toHaveValue("Giữ bản nháp");
  await expect.element(screen.getByText(/Buổi 3/)).toBeVisible();
});

test("the kind is chosen from the catalog", async () => {
  const writes: { kindId: number }[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (url, init) => {
    if (url.includes("/MeetingKinds")) return Response.json(catalog);
    if (url.includes("/bookings")) { writes.push(JSON.parse(init.body!)); return Response.json({ meetingId: 8, occurrenceCount: 1 }); }
    if (url.includes("/audience/")) return Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 });
    return Response.json([]);
  }));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("button", { name: "Thêm cuộc họp", exact: true }));
  await expect.element(screen.getByRole("button", { name: /Loại cuộc họp/ })).toHaveTextContent("Họp nội bộ");
  await userEvent.click(screen.getByRole("button", { name: /Loại cuộc họp/ }));
  await userEvent.click(screen.getByRole("option", { name: "Đào tạo", exact: true }));
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên cuộc họp*" }), "Tập huấn");
  await userEvent.fill(screen.getByRole("textbox", { name: "Phòng họp / địa điểm*" }), "503");
  await userEvent.click(screen.getByRole("button", { name: "Tạo cuộc họp", exact: true }));
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].kindId).toBe(2);
});

test("editing keeps a hidden kind", async () => {
  const start = new Date(); start.setHours(10, 0, 0, 0);
  const meeting = { id: 7, version: 1, isAllDay: false, title: "Họp cũ", kindId: 9, kind: "Cũ", location: "Phòng B", startUtc: start.toISOString(),
    endUtc: new Date(start.getTime() + 3600000).toISOString(), organizerId: 1, participantCount: 0 };
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async url => {
    if (url.includes("/MeetingKinds")) return Response.json(new URL(url).searchParams.has("includeHidden") && new URL(url).searchParams.get("includeHidden") === "true"
      ? [...catalog, { id: 9, name: "Cũ", isActive: false }] : catalog);
    if (url.includes("/7/audience")) return Response.json({ userIds: [], departmentIds: [], allEmployees: false, excludedUserIds: [] });
    if (url.includes("/audience/") || url.includes("/participants")) return Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 });
    return Response.json(url.includes("FromUtc") ? [meeting] : []);
  }));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByText("Họp cũ · Phòng B", { exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa cuộc họp", exact: true }));
  await expect.element(screen.getByRole("button", { name: /Loại cuộc họp/ })).toHaveTextContent("Cũ (đã ẩn)");
});

test("a failed kinds read is retried with the toast, so a booking can still be made", async () => {
  const writes: { kindId: number }[] = [];
  let kindReads = 0;
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (url, init) => {
    if (url.includes("/MeetingKinds")) return ++kindReads === 1 ? new Response(null, { status: 500 }) : Response.json(catalog);
    if (url.includes("/bookings")) { writes.push(JSON.parse(init.body!)); return Response.json({ meetingId: 8, occurrenceCount: 1 }); }
    if (url.includes("/audience/")) return Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 });
    return Response.json([]);
  }));
  const screen = await render(<Provider store={makeStore()}><Toast.Provider /><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await expect.poll(() => kindReads).toBe(2);
  await userEvent.click(screen.getByRole("button", { name: "Thêm cuộc họp", exact: true }));
  await expect.element(screen.getByRole("button", { name: /Loại cuộc họp/ })).toHaveTextContent("Họp nội bộ");
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên cuộc họp*" }), "Tập huấn");
  await userEvent.fill(screen.getByRole("textbox", { name: "Phòng họp / địa điểm*" }), "503");
  await userEvent.click(screen.getByRole("button", { name: "Tạo cuộc họp", exact: true }));
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].kindId).toBe(1);
});
