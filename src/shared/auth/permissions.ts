/**
 * Permission codes, mirroring src/Domain/Constants/Permissions.cs in Portal.BE.
 * Used to show or hide features; the back end enforces them on every request.
 */
export const Permissions = {
  Organization: { Update: "Organization.Update" },
  Departments: {
    View: "Departments.View",
    Create: "Departments.Create",
    Update: "Departments.Update",
    Delete: "Departments.Delete",
  },
  Positions: {
    View: "Positions.View",
    Create: "Positions.Create",
    Update: "Positions.Update",
    Delete: "Positions.Delete",
  },
  Roles: {
    View: "Roles.View",
    Create: "Roles.Create",
    Update: "Roles.Update",
    Delete: "Roles.Delete",
  },
  Users: {
    View: "Users.View",
    Create: "Users.Create",
    Update: "Users.Update",
    Delete: "Users.Delete",
    ResetPassword: "Users.ResetPassword",
  },
} as const;

type ValuesOf<T> = T[keyof T];
export type Permission = ValuesOf<{ [Group in keyof typeof Permissions]: ValuesOf<(typeof Permissions)[Group]> }>;
