import { useState } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { PermissionChecklist } from "./PermissionChecklist";

const groups = [
  { group: "Users", permissions: ["Users.View", "Users.Create"] },
  { group: "Posts", permissions: ["Posts.Create"] },
];

function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState(initial);
  return (<><PermissionChecklist groups={groups} value={value} onChange={setValue} /><output>{value.join(",")}</output></>);
}

test("a permission is ticked by its plain name", async () => {
  const screen = await render(<Harness />);
  await screen.getByRole("checkbox", { name: "Tạo người dùng", exact: true }).click({ force: true });
  await expect.element(screen.getByRole("status")).toHaveTextContent("Users.Create");
});

test("a group's box ticks the whole group, and again unticks it", async () => {
  const screen = await render(<Harness initial={["Users.View"]} />);
  const all = screen.getByRole("checkbox", { name: "Chọn cả nhóm Người dùng", exact: true });
  await all.click({ force: true });
  await expect.element(screen.getByRole("status")).toHaveTextContent("Users.View,Users.Create");
  await all.click({ force: true });
  await expect.element(screen.getByRole("status")).toHaveTextContent(/^$/);
});

test("the output follows the catalog order, whatever order they were ticked in", async () => {
  const screen = await render(<Harness initial={["Posts.Create"]} />);
  await screen.getByRole("checkbox", { name: "Tạo người dùng", exact: true }).click({ force: true });
  await screen.getByRole("checkbox", { name: "Xem người dùng", exact: true }).click({ force: true });
  await expect.element(screen.getByRole("status")).toHaveTextContent("Users.View,Users.Create,Posts.Create");
});

test("a partly ticked group shows as mixed, not as ticked", async () => {
  const screen = await render(<Harness initial={["Users.View"]} />);
  const all = screen.getByRole("checkbox", { name: "Chọn cả nhóm Người dùng", exact: true });
  await expect.element(all).toBePartiallyChecked();
  await expect.element(screen.getByRole("checkbox", { name: "Chọn cả nhóm Bài viết", exact: true })).not.toBeChecked();
});

test("locked, nothing can be changed", async () => {
  const screen = await render(<PermissionChecklist groups={groups} value={["Users.View"]} onChange={() => {}} isDisabled />);
  await expect.element(screen.getByRole("checkbox", { name: "Xem người dùng", exact: true })).toBeDisabled();
  await expect.element(screen.getByRole("checkbox", { name: "Chọn cả nhóm Người dùng", exact: true })).toBeDisabled();
});
