import { expect, test } from "vitest";
import { overlapLayout } from "./overlapLayout";

test("twenty simultaneous meetings retain a wide front card and distinct exposed strips", () => {
  const events = Array.from({length:20}, (_,i) => ({id:String(i),start:100,end:200}));
  const layout = overlapLayout(events);
  expect(layout.get("0")).toEqual({left:0,width:40,layer:1});
  expect(layout.get("19")).toEqual({left:60,width:40,layer:20});
  expect(new Set([...layout.values()].map(item=>item.left)).size).toBe(20);
});
test("touching intervals do not overlap and chained overlaps form one stack", () => {
  const layout = overlapLayout([{id:"a",start:0,end:100},{id:"b",start:50,end:150},{id:"c",start:100,end:200},{id:"d",start:200,end:300}]);
  expect(layout.get("a")).toEqual({left:0,width:82,layer:1});
  expect(layout.get("b")).toEqual({left:18,width:82,layer:2});
  // c starts when a ends: it takes a's column again instead of being pushed further right.
  expect(layout.get("c")).toEqual({left:0,width:82,layer:1});
  expect(layout.get("d")).toEqual({left:0,width:100,layer:1});
});
test("meetings that do not overlap each other share a column, even when a long one spans both", () => {
  const layout = overlapLayout([{id:"long",start:0,end:1000},{id:"morning",start:0,end:100},{id:"afternoon",start:500,end:600}]);
  expect(layout.get("long")).toEqual({left:0,width:82,layer:1});
  expect(layout.get("morning")).toEqual({left:18,width:82,layer:2});
  expect(layout.get("afternoon")).toEqual({left:18,width:82,layer:2});
});
