import { expect, test } from "vitest";
import type { DepartmentTreeNode } from "@/shared/api/generated/portalApi";
import { canDrop, findNode, flatten, parentOf, subtreeIds } from "./departmentTree";

const node = (id: number, name: string, children: DepartmentTreeNode[] = []): DepartmentTreeNode =>
  ({ id, code: `D${id}`, name, isActive: true, children });

/** Board(1) > [Editorial(2) > [Desk(4)], IT(3)]; Union(5) at the top too. */
const tree = [node(1, "Ban giám đốc", [node(2, "Ban biên tập", [node(4, "Tổ thư ký")]), node(3, "Phòng IT")]), node(5, "Công đoàn")];

test("a subtree holds the node and everything under it", () => {
  expect([...subtreeIds(tree, 1)].sort()).toEqual([1, 2, 3, 4]);
  expect([...subtreeIds(tree, 2)].sort()).toEqual([2, 4]);
  expect([...subtreeIds(tree, 99)]).toEqual([]);
});

test("finds a node and its parent anywhere", () => {
  expect(findNode(tree, 4)?.name).toBe("Tổ thư ký");
  expect(parentOf(tree, 4)).toBe(2);
  expect(parentOf(tree, 1)).toBeNull();
  expect(parentOf(tree, 99)).toBeUndefined();
});

test("flattens depth first with the depth of each node", () => {
  expect(flatten(tree).map(({ node, depth }) => `${depth}:${node.id}`)).toEqual(["0:1", "1:2", "2:4", "1:3", "0:5"]);
});

test("a drop that changes nothing or makes a cycle is not allowed", () => {
  expect(canDrop(tree, 1, 1)).toBe(false); // onto itself
  expect(canDrop(tree, 1, 4)).toBe(false); // onto a grandchild
  expect(canDrop(tree, 4, 2)).toBe(false); // onto its own parent
  expect(canDrop(tree, 1, null)).toBe(false); // already at the top
});

test("a drop onto another branch or to the top is allowed", () => {
  expect(canDrop(tree, 3, 2)).toBe(true);
  expect(canDrop(tree, 4, null)).toBe(true);
  expect(canDrop(tree, 5, 4)).toBe(true);
});
