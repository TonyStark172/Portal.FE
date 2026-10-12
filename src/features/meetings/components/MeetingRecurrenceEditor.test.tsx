import "@/app/globals.css";
import { useState } from "react";
import { expect,test } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import type { RecurrenceRule } from "../meetingTypes";
import { MeetingRecurrenceEditor } from "./MeetingRecurrenceEditor";
function Harness(){const [value,setValue]=useState<RecurrenceRule|null>(null);return <><MeetingRecurrenceEditor value={value} startDate="2030-01-07" onChange={setValue}/><output aria-label="rule">{JSON.stringify(value)}</output></>;}
test("recurrence expands through intermediate heights instead of jumping", async () => {
  const screen = await render(<Harness/>);
  const editor = document.querySelector<HTMLElement>('[data-slot="select"]')!.parentElement!;
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  const heights: number[] = [];
  let frame = 0;
  const sample = () => { heights.push(Math.round(editor.getBoundingClientRect().height)); frame = requestAnimationFrame(sample); };
  frame = requestAnimationFrame(sample);
  try {
    await userEvent.click(screen.getByRole("option",{name:"Tùy chỉnh",exact:true}));
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(new Set(heights).size).toBeGreaterThan(2);
    expect(heights.at(-1)!).toBeGreaterThan(heights[0]);
    await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
    heights.length = 0;
    await userEvent.click(screen.getByRole("option",{name:"Không lặp lại",exact:true}));
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(new Set(heights).size).toBeGreaterThan(2);
    expect(heights.at(-1)!).toBeLessThan(heights[0]);
  } finally { cancelAnimationFrame(frame); }
});
test("custom preset remains selected while configuring a weekly rule",async()=>{
  const screen=await render(<Harness/>);
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  await userEvent.click(screen.getByRole("option",{name:"Tùy chỉnh",exact:true}));
  await expect.element(screen.getByRole("spinbutton",{name:"Lặp lại mỗi"})).toBeVisible();
  await expect.element(screen.getByRole("dialog",{name:"Thiết lập lặp lại"})).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button",{name:/Mỗi 1 tuần.*Lặp lại/})).toBeVisible();
  await userEvent.fill(screen.getByRole("spinbutton",{name:"Lặp lại mỗi"}), "2");
  await expect.element(screen.getByRole("button",{name:/Mỗi 2 tuần.*Lặp lại/})).toBeVisible();
  await expect.element(screen.getByRole("button",{name:"Áp dụng",exact:true})).not.toBeInTheDocument();
});

test("switching off custom recurrence removes its inline controls",async()=>{
  const screen=await render(<Harness/>);
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  await userEvent.click(screen.getByRole("option",{name:"Tùy chỉnh",exact:true}));
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  await userEvent.click(screen.getByRole("option",{name:"Không lặp lại",exact:true}));
  await expect.element(screen.getByRole("button",{name:"Không lặp lại Lặp lại",exact:true})).toBeVisible();
  await expect.element(screen.getByRole("spinbutton",{name:"Lặp lại mỗi"})).not.toBeInTheDocument();
});

test("new recurrence defaults to an inclusive end date selected using a calendar",async()=>{
  const screen=await render(<Harness/>);
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  await userEvent.click(screen.getByRole("option",{name:"Hàng ngày",exact:true}));
  await expect.element(screen.getByText("Ngày kết thúc lặp",{exact:true})).toBeVisible();
  await expect.element(screen.getByRole("button",{name:"Vào ngày Kết thúc lặp",exact:true})).not.toBeInTheDocument();
  await expect.element(screen.getByRole("spinbutton",{name:"Số buổi (gồm buổi đầu)"})).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText("rule")).toHaveTextContent('"until":"2030-02-07"');
  // The preset list closes (and gives focus back) first: a press during that animation is lost.
  await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Chọn ngày kết thúc lặp"}));
  await expect.element(screen.getByRole("grid",{name:/2030/})).toBeVisible();
});

test("the repeat interval can be cleared and typed again",async()=>{
  const screen=await render(<Harness/>);
  await userEvent.click(screen.getByRole("button",{name:/Lặp lại/}));
  await userEvent.click(screen.getByRole("option",{name:"Tùy chỉnh",exact:true}));
  const interval=screen.getByRole("spinbutton",{name:"Lặp lại mỗi"});
  await userEvent.clear(interval);
  await expect.element(interval).toHaveValue(null);
  await userEvent.type(interval,"12");
  await expect.element(interval).toHaveValue(12);
  await expect.element(screen.getByLabelText("rule")).toHaveTextContent('"interval":12');
});
