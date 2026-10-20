import "@/app/globals.css";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emptyMeetingDashboard, meetingDashboard } from "./fixtures";
import { MeetingKindsCard } from "./MeetingKindsCard";
import { MeetingRoomsCard } from "./MeetingRoomsCard";
import { MeetingTimesCard } from "./MeetingTimesCard";
import { MeetingTrendCard } from "./MeetingTrendCard";

const text = () => document.body.textContent ?? "";
const width = (el: Element) => el.getBoundingClientRect().width;

afterEach(async () => {
  await page.viewport(1000, 800);
});

describe("the meetings-over-time card", () => {
  test("draws a bar for each step of the period with meetings, labelled by the day each week starts", async () => {
    await render(<MeetingTrendCard trend={meetingDashboard.trend} period="Month" from="2026-10-01" to="2026-10-31" />);

    // The third week had none: no bar, but its place on the axis.
    await vi.waitFor(() => expect(document.querySelectorAll(".recharts-bar-rectangle path")).toHaveLength(3));
    const ticks = [...document.querySelectorAll(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value")].map((tick) => tick.textContent);
    expect(ticks).toEqual(["01/10", "08/10", "15/10", "22/10"]);
    expect(text()).toContain("Số cuộc họp theo thời gian");
    expect(text()).toContain("Tháng này: 01/10/2026 – 31/10/2026");
  });

  test("labels a year's steps by month", async () => {
    const trend = [
      { from: "2026-01-01", to: "2026-01-31", meetingCount: 2, totalHours: 3 },
      { from: "2026-02-01", to: "2026-02-28", meetingCount: 1, totalHours: 1 },
    ];
    await render(<MeetingTrendCard trend={trend} period="Year" from="2026-01-01" to="2026-12-31" />);

    await vi.waitFor(() => expect(text()).toContain("T2"));
    expect(text()).toContain("T1");
  });

  test("says there were no meetings rather than drawing empty bars", async () => {
    await render(<MeetingTrendCard trend={emptyMeetingDashboard.trend} period="Month" from="2026-10-01" to="2026-10-31" />);

    await vi.waitFor(() => expect(text()).toContain("Chưa có cuộc họp nào trong kỳ này."));
    expect(document.querySelector(".recharts-wrapper")).toBeNull();
  });
});

describe("the meetings-by-type card", () => {
  test("lists each type with its meetings and hours, a bar sized by its meetings, and no pie", async () => {
    await render(<MeetingKindsCard kinds={meetingDashboard.byKind} />);

    const rows = await vi.waitUntil(() => {
      const found = [...document.querySelectorAll<HTMLElement>("[data-kind-row]")];
      return found.length === 2 ? found : null;
    });
    expect(rows.map((row) => row.querySelector("[data-slot='name']")?.textContent)).toEqual(["Họp nội bộ", "Họp khách hàng"]);
    expect(rows.map((row) => row.querySelector("[data-slot='count']")?.textContent)).toEqual(["8 cuộc họp", "4 cuộc họp"]);
    expect(rows.map((row) => row.querySelector("[data-slot='hours']")?.textContent)).toEqual(["12 giờ", "6,5 giờ"]);
    const bars = rows.map((row) => row.querySelector<HTMLElement>("[data-slot='bar']")!);
    expect(width(bars[1]) / width(bars[0])).toBeCloseTo(0.5, 1);
    expect(document.querySelector(".recharts-pie, svg circle")).toBeNull();
  });

  test("says there were no meetings when there is no type to list", async () => {
    await render(<MeetingKindsCard kinds={[]} />);
    await vi.waitFor(() => expect(text()).toContain("Chưa có cuộc họp nào trong kỳ này."));
  });
});

describe("the most-used-rooms card", () => {
  test("ranks the rooms with their hours and meetings, a thin bar sized by the hours", async () => {
    await render(<MeetingRoomsCard rooms={meetingDashboard.topRooms} />);

    const rows = await vi.waitUntil(() => {
      const found = [...document.querySelectorAll<HTMLElement>("[data-room-row]")];
      return found.length === 3 ? found : null;
    });
    expect(rows.map((row) => row.querySelector("[data-slot='name']")?.textContent)).toEqual(["Phòng Hà Nội", "Trực tuyến", "Phòng Sài Gòn"]);
    expect(rows.map((row) => row.querySelector("[data-slot='hours']")?.textContent)).toEqual(["10 giờ", "5 giờ", "3,5 giờ"]);
    expect(rows.map((row) => row.querySelector("[data-slot='count']")?.textContent)).toEqual(["6 cuộc họp", "4 cuộc họp", "2 cuộc họp"]);
    const bars = rows.map((row) => row.querySelector<HTMLElement>("[data-slot='bar']")!);
    expect(width(bars[1]) / width(bars[0])).toBeCloseTo(0.5, 1);
    expect(bars[0].getBoundingClientRect().height).toBeLessThanOrEqual(6);
  });

  test("names a meeting without a place rather than leaving a blank row", async () => {
    await render(<MeetingRoomsCard rooms={[{ key: "", name: "", meetingCount: 1, totalHours: 1 }]} />);
    await vi.waitFor(() => expect(document.querySelector("[data-room-row] [data-slot='name']")?.textContent).toBe("Chưa có địa điểm"));
  });

  test("says no meeting booked a room when there is none", async () => {
    await render(<MeetingRoomsCard rooms={[]} />);
    await vi.waitFor(() => expect(text()).toContain("Chưa có cuộc họp nào đặt phòng trong kỳ này."));
  });
});

describe("the busiest-times card", () => {
  const renderTimes = () => render(<MeetingTimesCard weekdays={meetingDashboard.busiestWeekday} hours={meetingDashboard.busiestHour} />);
  const cells = (strip: string) => [...document.querySelectorAll<HTMLElement>(`[data-strip='${strip}'] [data-cell]`)];

  test("has a cell for each day of the week from Monday and each hour of the day, each named with its meetings", async () => {
    await renderTimes();

    await vi.waitFor(() => expect(cells("weekday")).toHaveLength(7));
    expect(cells("hour")).toHaveLength(24);
    expect(cells("weekday")[0].getAttribute("aria-label")).toBe("Thứ Hai: 2 cuộc họp");
    expect(cells("weekday")[6].getAttribute("aria-label")).toBe("Chủ nhật: 0 cuộc họp");
    expect(cells("hour")[9].getAttribute("aria-label")).toBe("09:00–10:00: 4 cuộc họp");
    expect(cells("hour")[23].getAttribute("aria-label")).toBe("23:00–24:00: 0 cuộc họp");
    expect(document.querySelector("[data-strip='weekday']")?.getAttribute("role")).toBe("list");
  });

  test("labels the busiest day and hour, and marks their cells", async () => {
    await renderTimes();

    await vi.waitFor(() => expect(document.querySelector("[data-busiest='weekday']")?.textContent).toBe("Nhiều nhất: Thứ Ba · 5 cuộc họp"));
    expect(document.querySelector("[data-busiest='hour']")?.textContent).toBe("Nhiều nhất: 14:00–15:00 · 5 cuộc họp");
    expect(cells("weekday").filter((cell) => cell.hasAttribute("data-top")).map((cell) => cells("weekday").indexOf(cell))).toEqual([1]);
    expect(cells("hour").filter((cell) => cell.hasAttribute("data-top")).map((cell) => cells("hour").indexOf(cell))).toEqual([14]);
  });

  test("tints a cell the darker the more meetings it has, one hue throughout", async () => {
    await renderTimes();

    await vi.waitFor(() => expect(cells("weekday")).toHaveLength(7));
    const tint = (cell: HTMLElement) => Number(cell.dataset.level);
    const [mon, tue, wed] = cells("weekday");
    expect(tint(tue)).toBeGreaterThan(tint(mon));
    expect(tint(mon)).toBeGreaterThan(tint(wed));
    expect(tint(cells("weekday")[6])).toBe(0);
    expect(getComputedStyle(tue).backgroundColor).not.toBe(getComputedStyle(cells("weekday")[6]).backgroundColor);
  });

  test("fits a phone: the 24 hours in one row, with no sideways scroll", async () => {
    await page.viewport(390, 844);
    await renderTimes();

    await vi.waitFor(() => expect(cells("hour")).toHaveLength(24));
    const tops = new Set(cells("hour").map((cell) => Math.round(cell.getBoundingClientRect().top)));
    expect(tops.size).toBe(1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  test("says there were no meetings when every cell is empty", async () => {
    await render(<MeetingTimesCard weekdays={emptyMeetingDashboard.busiestWeekday} hours={emptyMeetingDashboard.busiestHour} />);
    await vi.waitFor(() => expect(text()).toContain("Chưa có cuộc họp nào trong kỳ này."));
    expect(document.querySelector("[data-cell]")).toBeNull();
  });
});
