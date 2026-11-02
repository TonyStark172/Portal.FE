import "@/app/globals.css";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { PostCommentDto, PostDto } from "@/shared/api/generated/portalApi";
import { makeComment, makePost, makeTombstone } from "./comments.testing";
import { CommentRow } from "./CommentRow";

async function renderRow(comment: PostCommentDto, post: PostDto = makePost(), handlers = { onReply: vi.fn(), onEdit: vi.fn() }) {
  await render(
    <Provider store={makeStore()}>
      <Toast.Provider />
      <CommentRow post={post} comment={comment} {...handlers} />
    </Provider>,
  );
  return handlers;
}

const options = () => page.getByRole("button", { name: "Tuỳ chọn bình luận" });

afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

test("shows author, position, time, tag and edited mark", async () => {
  await renderRow(
    makeComment(1, {
      isPostAuthor: true,
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      editedAt: new Date().toISOString(),
      contentHtml: "<p>Xin chào cả nhà</p>",
    }),
  );

  await expect.element(page.getByText("Trần Thị Bình")).toBeVisible();
  await expect.element(page.getByText("Kế toán")).toBeVisible();
  await expect.element(page.getByText("5 phút trước")).toBeVisible();
  await expect.element(page.getByText("Tác giả", { exact: true })).toBeVisible();
  await expect.element(page.getByText("đã chỉnh sửa")).toBeVisible();
  await expect.element(page.getByText("Xin chào cả nhà")).toBeVisible();
});

test("leaves out the tag and the edited mark when they do not apply", async () => {
  await renderRow(makeComment(1));

  expect(page.getByText("Tác giả", { exact: true }).query()).toBeNull();
  expect(page.getByText("đã chỉnh sửa").query()).toBeNull();
});

test("the owner's row has Trả lời and a menu with Sửa and Xoá", async () => {
  const { onReply, onEdit } = await renderRow(makeComment(1, { canEdit: true, canDelete: true }));

  await page.getByRole("button", { name: "Trả lời" }).click();
  expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));

  await options().click();
  await expect.element(page.getByRole("menuitem", { name: "Sửa" })).toBeVisible();
  await expect.element(page.getByRole("menuitem", { name: "Xoá" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
});

test("the post owner's view of another's comment has Xoá but not Sửa", async () => {
  await renderRow(makeComment(1, { canEdit: false, canDelete: true }));

  await options().click();
  await expect.element(page.getByRole("menuitem", { name: "Xoá" })).toBeVisible();
  expect(page.getByRole("menuitem", { name: "Sửa" }).query()).toBeNull();
});

test("has no menu when the reader can neither edit nor delete", async () => {
  await renderRow(makeComment(1));

  await expect.element(page.getByRole("button", { name: "Trả lời" })).toBeVisible();
  expect(options().query()).toBeNull();
});

test("with comments off there is no Trả lời, but the reaction button stays", async () => {
  await renderRow(makeComment(1), makePost({ commentsDisabled: true }));

  await expect.element(page.getByRole("button", { name: "Bày tỏ cảm xúc" })).toBeVisible();
  expect(page.getByRole("button", { name: "Trả lời" }).query()).toBeNull();
});

test("a tombstone shows only its line", async () => {
  await renderRow(makeTombstone(1, { replyCount: 1, canDelete: false }));

  await expect.element(page.getByText("Bình luận đã bị xoá")).toBeVisible();
  expect(page.getByRole("button").query()).toBeNull();
  expect(page.getByText("Trần Thị Bình").query()).toBeNull();
});

test("shows who reacted in short, and the reader's own reaction on the button", async () => {
  await renderRow(
    makeComment(1, {
      reactions: [
        { kind: "Like", count: 2 },
        { kind: "Love", count: 1 },
      ],
      myReaction: "Like",
    }),
  );

  await expect.element(page.getByRole("button", { name: "Thích" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: /3/ })).toBeVisible();
});

test("confirms before deleting", async () => {
  const fetch = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ tombstoned: false, removedParentId: null }));
  await renderRow(makeComment(5, { canDelete: true }));
  const deletes = () => fetch.mock.calls.filter(([input, init]) => init?.method === "DELETE" || (input instanceof Request && input.method === "DELETE"));

  await options().click();
  await page.getByRole("menuitem", { name: "Xoá" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Xoá bình luận này?" });
  await expect.element(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Huỷ" }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(deletes()).toHaveLength(0);

  await options().click();
  await page.getByRole("menuitem", { name: "Xoá" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();

  await vi.waitFor(() => expect(deletes()).toHaveLength(1));
  const sent = deletes()[0][0];
  expect(new URL(sent instanceof Request ? sent.url : String(sent), window.location.href).pathname).toMatch(/\/api\/Posts\/comments\/5$/);
});

test("says so and keeps the comment when deleting fails", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ status: 500, code: "internal", detail: "Không xoá được." }, { status: 500 }));
  await renderRow(makeComment(5, { canDelete: true }));

  await options().click();
  await page.getByRole("menuitem", { name: "Xoá" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();

  await expect.element(page.getByText("Không xoá được.")).toBeVisible();
  await expect.element(page.getByText("Bình luận 5")).toBeVisible();
});
