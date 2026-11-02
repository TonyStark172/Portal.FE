import "@/app/globals.css";
import { Provider } from "react-redux";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { PostDto } from "@/shared/api/generated/portalApi";
import { PostActions } from "./PostActions";

const post = {
  id: 1,
  canPin: false,
  canEdit: true,
  canDelete: false,
  commentCount: 0,
  commentsDisabled: false,
  canToggleComments: false,
} as PostDto;

async function openMenu(over: Partial<PostDto>) {
  await render(
    <Provider store={makeStore()}>
      <PostActions post={{ ...post, ...over }} onEdit={() => {}} />
    </Provider>,
  );
  await page.getByRole("button", { name: "Tuỳ chọn bài viết" }).click();
}

describe("the comments item of the post menu", () => {
  test("offers turning comments off only with canToggleComments", async () => {
    await openMenu({ canToggleComments: true });
    await expect.element(page.getByRole("menuitem", { name: "Tắt bình luận" })).toBeVisible();
  });

  test("is absent without canToggleComments", async () => {
    await openMenu({ canToggleComments: false });
    await expect.element(page.getByRole("menuitem", { name: "Sửa" })).toBeVisible();
    expect(page.getByRole("menuitem", { name: /bình luận/ }).query()).toBeNull();
  });

  test("offers turning them back on once they are off", async () => {
    await openMenu({ canToggleComments: true, commentsDisabled: true });
    await expect.element(page.getByRole("menuitem", { name: "Bật bình luận" })).toBeVisible();
  });

  test("is the only item of a menu for someone who can do nothing else", async () => {
    await openMenu({ canToggleComments: true, canEdit: false });
    await expect.element(page.getByRole("menuitem", { name: "Tắt bình luận" })).toBeVisible();
  });
});
