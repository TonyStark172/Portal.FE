import { expect, test } from "vitest";
import { ErrorCodes, type ApiProblem } from "@/shared/api/problem";
import { splitValidationErrors } from "./validationErrors";

const validation = (errors: Record<string, string[]>): ApiProblem => ({
  status: 400, code: ErrorCodes.validationFailed, detail: "Vui lòng kiểm tra lại các trường được báo lỗi.", errors,
});

test("errors on shown fields go to the fields, with the key in the form's own spelling", () => {
  const result = splitValidationErrors(validation({ UserName: ["Đã tồn tại."], FullName: ["Trống."] }), ["userName", "fullName"]);
  expect(result).toEqual({ fieldErrors: { userName: ["Đã tồn tại."], fullName: ["Trống."] }, leftover: [] });
});

test("errors on keys no field shows are kept as messages, not dropped", () => {
  const result = splitValidationErrors(
    validation({ UserName: ["Đã tồn tại."], RoleIds: ["Có vai trò không tồn tại."], Assignments: ["Phải chọn đúng một vị trí chính.", "Lặp."] }),
    ["userName"],
  );
  expect(result.fieldErrors).toEqual({ userName: ["Đã tồn tại."] });
  expect(result.leftover).toEqual(["Có vai trò không tồn tại.", "Phải chọn đúng một vị trí chính.", "Lặp."]);
});

test("any other kind of problem has nothing to split: the caller uses its detail", () => {
  const conflict: ApiProblem = { status: 409, code: ErrorCodes.conflict, detail: "Không thể xoá quản trị viên." };
  expect(splitValidationErrors(conflict, ["fullName"])).toEqual({ fieldErrors: {}, leftover: [] });
});

test("a validation problem without messages has nothing to split either", () => {
  expect(splitValidationErrors({ status: 400, code: ErrorCodes.validationFailed }, ["fullName"])).toEqual({ fieldErrors: {}, leftover: [] });
});
