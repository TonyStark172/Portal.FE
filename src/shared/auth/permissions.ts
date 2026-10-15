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
  Users: {
    View: "Users.View",
    Create: "Users.Create",
    Update: "Users.Update",
    Delete: "Users.Delete",
    ResetPassword: "Users.ResetPassword",
  },
  Posts: { Create: "Posts.Create", Manage: "Posts.Manage" },
  /** Broadcast: invite the whole company, or more than 200 people, to a meeting. */
  Meetings: { Broadcast: "Meetings.Broadcast" },
  /** One per dashboard tab. */
  Dashboard: { Staff: "Dashboard.Staff" },
} as const;

type ValuesOf<T> = T[keyof T];
export type Permission = ValuesOf<{ [Group in keyof typeof Permissions]: ValuesOf<(typeof Permissions)[Group]> }>;
