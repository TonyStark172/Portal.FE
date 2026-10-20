import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ChartCard } from "./ChartCard";

const text = () => document.body.textContent ?? "";

describe("the chart card", () => {
  test("shows the title, description, header actions and the chart", async () => {
    await render(
      <ChartCard title="Cơ cấu giới tính" description="Nhân sự đang làm việc" actions={<span>Chú thích</span>}>
        <p>Biểu đồ</p>
      </ChartCard>,
    );

    await vi.waitFor(() => expect(text()).toContain("Cơ cấu giới tính"));
    expect(text()).toContain("Nhân sự đang làm việc");
    expect(text()).toContain("Chú thích");
    expect(text()).toContain("Biểu đồ");
  });

  test("shows a placeholder while loading instead of the chart", async () => {
    await render(
      <ChartCard title="Biến động" isLoading>
        <p>Biểu đồ</p>
      </ChartCard>,
    );

    await vi.waitFor(() => expect(document.querySelector('[role="status"]')).not.toBeNull());
    expect(text()).not.toContain("Biểu đồ");
  });

  test("offers a retry when loading failed", async () => {
    const onRetry = vi.fn();
    await render(
      <ChartCard title="Biến động" isError onRetry={onRetry}>
        <p>Biểu đồ</p>
      </ChartCard>,
    );

    const retry = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Thử lại")),
    );
    await userEvent.click(retry);

    expect(onRetry).toHaveBeenCalledOnce();
    expect(text()).toContain("Không tải được dữ liệu");
    expect(text()).not.toContain("Biểu đồ");
  });

  test("says there is nothing to show when empty", async () => {
    await render(
      <ChartCard title="Biến động" isEmpty emptyMessage="Không có biến động trong kỳ này.">
        <p>Biểu đồ</p>
      </ChartCard>,
    );

    await vi.waitFor(() => expect(text()).toContain("Không có biến động trong kỳ này."));
    expect(text()).not.toContain("Biểu đồ");
  });
});
