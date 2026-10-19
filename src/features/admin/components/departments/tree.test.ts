import { expect, test } from "vitest";
import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { ancestorIds, buildChartTree, canDrop, descendantIds, suggestDepartmentCode } from "./tree";

function node(id: number, parentId: number | null | undefined, over: Partial<DepartmentChartNode> = {}): DepartmentChartNode {
  return {
    id, code: `D${id}`, name: `Dept ${id}`, originalName: `Dept ${id}`, parentId, isActive: true,
    memberCount: 0, childCount: 0, headCount: 0, heads: [], ...over,
  };
}

// 1 (top) -> 2 -> 4 -> 5 ; 1 -> 3 ; 6 (second top, inactive)
const nodes = [
  node(1, null), node(2, 1), node(3, 1), node(4, 2), node(5, 4), node(6, undefined, { isActive: false }),
];

test("buildChartTree nests a three-level tree and keeps the input order", () => {
  const roots = buildChartTree(nodes);
  expect(roots.map((r) => r.node.id)).toEqual([1, 6]);
  expect(roots[0].children.map((c) => c.node.id)).toEqual([2, 3]);
  expect(roots[0].children[0].children.map((c) => c.node.id)).toEqual([4]);
  expect(roots[0].children[0].children[0].children.map((c) => c.node.id)).toEqual([5]);
  expect(roots[1].children).toEqual([]);
});

test("buildChartTree makes a node with a missing parent top level", () => {
  const roots = buildChartTree([node(1, null), node(7, 99), node(8, 7)]);
  expect(roots.map((r) => r.node.id)).toEqual([1, 7]);
  expect(roots[1].children.map((c) => c.node.id)).toEqual([8]);
});

test("descendantIds returns every level below a node, not the node itself", () => {
  expect([...descendantIds(nodes, 1)].sort()).toEqual([2, 3, 4, 5]);
  expect([...descendantIds(nodes, 4)]).toEqual([5]);
  expect(descendantIds(nodes, 5).size).toBe(0);
});

test("ancestorIds lists the parents from nearest to the top", () => {
  expect(ancestorIds(nodes, 5)).toEqual([4, 2, 1]);
  expect(ancestorIds(nodes, 1)).toEqual([]);
  expect(ancestorIds(nodes, 999)).toEqual([]);
  expect(ancestorIds([node(7, 99)], 7)).toEqual([]);
});

test("canDrop refuses a grandchild, itself, an inactive card and the current parent", () => {
  expect(canDrop(nodes, 1, 5)).toBe(false); // a descendant
  expect(canDrop(nodes, 2, 5)).toBe(false); // a grandchild
  expect(canDrop(nodes, 2, 2)).toBe(false); // itself
  expect(canDrop(nodes, 2, 6)).toBe(false); // inactive target
  expect(canDrop(nodes, 4, 2)).toBe(false); // current parent
});

test("canDrop allows a different active card and the organization for a non-top card", () => {
  expect(canDrop(nodes, 5, 1)).toBe(true);
  expect(canDrop(nodes, 3, 2)).toBe(true);
  expect(canDrop(nodes, 4, null)).toBe(true);
});

test("canDrop on the organization is a no-op for a top-level card, whether parentId is null or undefined", () => {
  expect(canDrop(nodes, 1, null)).toBe(false);
  expect(canDrop(nodes, 6, null)).toBe(false);
});

test("canDrop refuses an unknown dragged card or an unknown target", () => {
  expect(canDrop(nodes, 999, 1)).toBe(false);
  expect(canDrop(nodes, 3, 999)).toBe(false);
});

test("suggestDepartmentCode takes the initials without diacritics", () => {
  expect(suggestDepartmentCode("Phòng Hành chính Nhân sự")).toBe("PHCNS");
  expect(suggestDepartmentCode("Kế toán")).toBe("KT");
  expect(suggestDepartmentCode("đ")).toBe("D");
  expect(suggestDepartmentCode("Đào tạo")).toBe("DT");
});

test("suggestDepartmentCode ignores punctuation, collapses spaces, caps at 10 and handles empty input", () => {
  expect(suggestDepartmentCode("  Kinh   doanh (miền Bắc) ")).toBe("KDMB");
  expect(suggestDepartmentCode("a b c d e f g h i j k l")).toBe("ABCDEFGHIJ");
  expect(suggestDepartmentCode("Khối 2")).toBe("K2");
  expect(suggestDepartmentCode("")).toBe("");
  expect(suggestDepartmentCode("  -- ")).toBe("");
});
