import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
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

afterEach(() => vi.restoreAllMocks());

/** Pressing the item sends what to the server: the bodies of the PUT requests that reach it. */
async function pressToggle(over: Partial<PostDto>, name: string) {
  const sent: unknown[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    if (input instanceof Request && input.method === "PUT" && input.url.endsWith("/api/Posts/1/comments-disabled")) {
      sent.push(await input.clone().json());
    }
    return new Response(null, { status: 204 });
  });
  await openMenu(over);
  await page.getByRole("menuitem", { name }).click();
  await vi.waitUntil(() => sent.length > 0);
  return sent;
}

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

  test.each([
    [{ commentsDisabled: false }, "Tắt bình luận", true],
    [{ commentsDisabled: true }, "Bật bình luận", false],
  ])("pressing it on %o (%s) sends disabled: %s", async (over, name, disabled) => {
    expect(await pressToggle({ canToggleComments: true, ...over }, name)).toEqual([{ disabled }]);
  });
});
