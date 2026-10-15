import { expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import { permissionDescription, permissionGroupLabel, permissionLabel } from "./permissionLabels";

const t = (key: string) => translate(key, "vi-VN");
const en = (key: string) => translate(key, "en-US");

// Every code the backend's Permissions catalog declares (Portal.BE/src/Domain/Constants/Permissions.cs).
const catalog = [
  "Organization.Update",
  "Departments.View",
  "Departments.Create",
  "Departments.Update",
  "Departments.Delete",
  "Positions.View",
  "Positions.Create",
  "Positions.Update",
  "Positions.Delete",
  "Users.View",
  "Users.Create",
  "Users.Update",
  "Users.Delete",
  "Users.ResetPassword",
  "Posts.Create",
  "Posts.Manage",
  "Meetings.Broadcast",
  "Dashboard.Staff",
];

test("known permissions read in Vietnamese; an unknown one falls back to its code", () => {
  expect(permissionLabel("Users.Update", t)).toBe("Sửa người dùng");
  expect(permissionGroupLabel("Users", t)).toBe("Người dùng");
  expect(permissionLabel("Future.Thing", t)).toBe("Future.Thing");
  expect(permissionGroupLabel("Future", t)).toBe("Future");
});

test("a missing description is empty, a present one is shown", () => {
  expect(permissionDescription("Users.Delete", t)).toBe("");
  expect(permissionDescription("Users.Create", t)).toBe("Tạo tài khoản mới; người mới nhận vai trò mặc định.");
});

// Codes that carry a one-line description (optional: most codes have none).
const described = ["Organization.Update", "Users.View", "Users.Create", "Users.Update", "Users.ResetPassword", "Posts.Manage", "Meetings.Broadcast"];

test("every catalog code, its group and every description has its own en-US text", () => {
  // translate() falls back en-US -> vi-VN -> key, so a missing en-US entry would silently return the Vietnamese text.
  // Asserting the en-US value is neither the key nor the vi-VN value is what detects a missing English entry.
  const keys = [
    ...catalog.map((code) => `permission.${code}`),
    ...catalog.map((code) => `permissionGroup.${code.split(".")[0]}`),
    ...described.map((code) => `permission.${code}.description`),
    "admin.selectGroup",
  ];
  for (const key of keys) {
    const vi = translate(key, "vi-VN");
    const english = translate(key, "en-US");
    expect(vi, `vi-VN ${key}`).not.toBe(key);
    expect(english, `en-US ${key}`).not.toBe(key);
    expect(english, `en-US ${key} must differ from vi-VN`).not.toBe(vi);
  }
  expect(permissionLabel("Users.Update", en)).toBe("Edit users");
});
