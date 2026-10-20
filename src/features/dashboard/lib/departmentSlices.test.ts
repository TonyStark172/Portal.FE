import { describe, expect, test } from "vitest";
import { toDepartmentSlices } from "./departmentSlices";

const department = (departmentId: number, name: string, count: number) => ({ departmentId, name, count });

describe("department slices", () => {
  test("gives each department its share of all the seats, largest first", () => {
    const slices = toDepartmentSlices({
      items: [department(1, "Phòng A", 30), department(2, "Phòng B", 10)],
      withoutDepartment: 0,
    });

    expect(slices.map((s) => [s.name, s.count, s.percent])).toEqual([
      ["Phòng A", 30, 75],
      ["Phòng B", 10, 25],
    ]);
    expect(new Set(slices.map((s) => s.color)).size).toBe(2);
  });

  test("groups the departments past the five largest as 'Khác'", () => {
    const slices = toDepartmentSlices({
      items: [10, 9, 8, 7, 6, 3, 2].map((count, i) => department(i + 1, `Phòng ${i + 1}`, count)),
      withoutDepartment: 0,
    });

    expect(slices.map((s) => [s.name, s.count])).toEqual([
      ["Phòng 1", 10],
      ["Phòng 2", 9],
      ["Phòng 3", 8],
      ["Phòng 4", 7],
      ["Phòng 5", 6],
      ["Khác (2 phòng ban)", 5],
    ]);
  });

  test("keeps people without a department as a slice of their own, last", () => {
    const slices = toDepartmentSlices({ items: [department(1, "Phòng A", 3)], withoutDepartment: 1 });

    expect(slices.map((s) => [s.name, s.count, s.percent])).toEqual([
      ["Phòng A", 3, 75],
      ["Chưa có phòng ban", 1, 25],
    ]);
  });

  test("leaves out departments nobody works in", () => {
    const slices = toDepartmentSlices({
      items: [department(1, "Phòng A", 3), department(2, "Phòng trống", 0)],
      withoutDepartment: 0,
    });

    expect(slices.map((s) => s.name)).toEqual(["Phòng A"]);
  });
});
