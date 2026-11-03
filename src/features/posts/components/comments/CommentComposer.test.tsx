import "@/app/globals.css";
import { act, createRef } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { LocaleProvider } from "@/shared/i18n";
import { setStoredLocale } from "@/shared/i18n/locale";
import type { PostCommentDto, PostDto, PostMediaDto } from "@/shared/api/generated/portalApi";
import { commentDrafts } from "../../lib/commentDrafts";
import { makeComment, makePost } from "./comments.testing";
import { CommentComposer, type CommentComposerHandle } from "./CommentComposer";

// The emoji picker reads its names from the network: a button stands in for it, which also takes the focus from the text.
vi.mock("../composer/EmojiButton", async () => {
  const { createElement } = await import("react");
  return {
    EmojiButton: ({ onPick }: { onPick: (emoji: string) => void }) =>
      createElement("button", { type: "button", onClick: () => onPick("😀") }, "Chèn emoji"),
  };
});

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const COLLEAGUE = { userId: 5, fullName: "Lê Văn Cường", avatarUrl: null, assignments: [{ isPrimary: true, positionName: "Kỹ sư" }] };

type Sent = { method: string; path: string; body: Record<string, unknown> | null };

let sent: Sent[] = [];
let answer: (call: Sent) => Response | Promise<Response>;
/** Held until a test lets the colleagues through. */
let profilesGate: Promise<void> | null;

const sentComment = (call: Sent) =>
  makeComment(100, { contentHtml: String(call.body?.contentHtml), parentId: (call.body?.parentId as number | null | undefined) ?? null });

/** Portal.BE answering: colleagues for "@", picture addresses, and whatever `answer` says for a comment sent. */
function serve() {
  sent = [];
  profilesGate = null;
  answer = (call) => Response.json(call.method === "PUT" ? makeComment(Number(call.path.split("/").pop())) : sentComment(call));
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.slice(pathname.indexOf("/api/"));
    if (request.method === "GET") {
      if (path === "/api/Profiles") {
        await profilesGate;
        // Nobody is called "Zz…".
        const items = searchParams.get("Search")?.startsWith("Zz") ? [] : [COLLEAGUE];
        return Response.json({ items, pageNumber: 1, totalPages: 1, totalCount: items.length });
      }
      if (/^\/api\/Posts\/files\/.+\/url$/.test(path)) return Response.json({ url: PIXEL, expiresAt: "2099-01-01T00:00:00Z" });
      return new Response(null, { status: 404 });
    }
    const call = { method: request.method, path, body: await request.clone().json().catch(() => null) };
    sent.push(call);
    return answer(call);
  });
}

const comments = () => sent.filter((call) => call.method === "POST" || call.method === "PUT");

/** The uploads the composer started, held until a test finishes them (the browser's own XHR would ask the test server). */
class FakeUpload {
  static all: FakeUpload[] = [];
  upload = { onprogress: null as unknown };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  responseType = "";
  status = 0;
  response: unknown = null;
  constructor() {
    FakeUpload.all.push(this);
  }
  open() {}
  setRequestHeader() {}
  send() {}
  abort() {}
  finish(file: PostMediaDto) {
    this.status = 200;
    this.response = file;
    this.onload?.();
  }
}

const imageFile = (id: string, fileName: string): PostMediaDto => ({ id, kind: "Image", fileName, contentType: "image/png", size: 1, caption: null });
const png = (name: string, size = 1) => new File([new ArrayBuffer(size)], name, { type: "image/png" });

async function renderComposer(post: PostDto = makePost({ commentCount: 3 })) {
  const handle = createRef<CommentComposerHandle>();
  const store = makeStore();
  const view = await render(
    <Provider store={store}>
      <Toast.Provider />
      <CommentComposer ref={handle} post={post} />
    </Provider>,
  );
  return { handle, ...view };
}

const textbox = () => page.getByRole("textbox");
const sendButton = () => page.getByRole("button", { name: "Gửi", exact: true });
const editorElement = () => textbox().element() as HTMLElement;
const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

async function write(text: string) {
  await userEvent.click(textbox());
  await userEvent.keyboard(text);
}

/** Chooses `file` in the picker of the picture button (`media`) or the paperclip (`file`). */
async function pick(file: File, picker: "media" | "file" = "media") {
  const input = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[picker === "file" ? 0 : 1];
  const files = new DataTransfer();
  files.items.add(file);
  input.files = files.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const finishUpload = (index: number, file: PostMediaDto) => act(async () => FakeUpload.all[index].finish(file));

const notesFile = (): PostMediaDto => ({ id: "n1", kind: "Attachment", fileName: "notes.pdf", contentType: "application/pdf", size: 5, caption: null });
const pdf = () => new File(["hello"], "notes.pdf", { type: "application/pdf" });

beforeEach(() => {
  [7, 8].forEach((id) => commentDrafts.clear(id));
  FakeUpload.all = [];
  vi.stubGlobal("XMLHttpRequest", FakeUpload);
  serve();
});

test("the paperclip and the picture button are apart, and neither opens a drop zone", async () => {
  await renderComposer();
  const clicked = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

  const [fileInput, mediaInput] = document.querySelectorAll<HTMLInputElement>('input[type="file"]');

  await page.getByRole("button", { name: "Đính kèm tệp" }).click();
  expect(clicked.mock.contexts.at(-1)).toBe(fileInput);
  expect(fileInput.accept).toContain(".pdf");

  await page.getByRole("button", { name: "Thêm ảnh hoặc video" }).click();
  expect(clicked.mock.contexts.at(-1)).toBe(mediaInput);
  expect(mediaInput.accept).toContain("image/png");

  expect(document.querySelectorAll('input[type="file"]').length).toBe(2);
});

test("sends a file as the comment's file, with no text needed", async () => {
  await renderComposer();

  await pick(pdf(), "file");
  await expect.element(page.getByText("notes.pdf")).toBeVisible();
  await finishUpload(0, notesFile());
  await expect.element(page.getByText("Đã tải lên")).toBeVisible();
  await expect.element(sendButton()).toBeEnabled();
  await sendButton().click();

  await vi.waitUntil(() => comments().length === 1);
  expect(comments()[0].body?.fileId).toBe("n1");
  await expect.element(page.getByText("notes.pdf")).not.toBeInTheDocument();
});

test("shows how far a file has uploaded, and waits for it; a failed one has to be retried or removed", async () => {
  await renderComposer();
  await write("Xem tệp");

  await pick(pdf(), "file");
  await vi.waitFor(() => expect(FakeUpload.all).toHaveLength(1));
  await expect.element(sendButton()).toBeDisabled();

  await act(async () => (FakeUpload.all[0].upload.onprogress as (event: Partial<ProgressEvent>) => void)({ lengthComputable: true, loaded: 2, total: 5 }));
  await expect.element(page.getByText("Đang tải lên… 40%")).toBeVisible();
  await expect.element(page.getByRole("progressbar")).toBeVisible();

  await act(async () => FakeUpload.all[0].onerror?.());
  await expect.element(page.getByText("Không tải lên được")).toBeVisible();
  await expect.element(page.getByRole("progressbar")).not.toBeInTheDocument();
  await expect.element(sendButton()).toBeDisabled();

  await page.getByRole("button", { name: "Thử lại" }).click();
  await vi.waitFor(() => expect(FakeUpload.all).toHaveLength(2));
  await finishUpload(1, notesFile());
  await expect.element(sendButton()).toBeEnabled();
});

test("a file dropped into the text is the comment's file", async () => {
  await renderComposer();

  drop(editorElement(), transfer(pdf()));

  await expect.element(page.getByText("notes.pdf")).toBeVisible();
  await vi.waitFor(() => expect(FakeUpload.all).toHaveLength(1));
});

test("a comment has one file: a picture takes the place of a file, and a file of a picture", async () => {
  await renderComposer();

  await pick(pdf(), "file");
  await expect.element(page.getByText("notes.pdf")).toBeVisible();
  await pick(png("anh.png"));
  await expect.element(page.getByText("notes.pdf")).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Bỏ ảnh hoặc video" })).toBeVisible();

  await pick(pdf(), "file");
  await expect.element(page.getByText("notes.pdf")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Bỏ ảnh hoặc video" })).not.toBeInTheDocument();
});

test("refuses a file of a type comments do not take, without an upload", async () => {
  await renderComposer();

  await pick(new File(["x"], "virus.exe", { type: "application/octet-stream" }), "file");

  await expect.element(page.getByText("chỉ đính kèm được", { exact: false })).toBeVisible();
  expect(FakeUpload.all).toHaveLength(0);
});

test("editing a comment with a file shows it, and keeps it when sent", async () => {
  const { handle } = await renderComposer();

  await act(async () => handle.current!.edit(makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true, file: notesFile() })));

  await expect.element(page.getByText("notes.pdf")).toBeVisible();
  await sendButton().click();
  await vi.waitUntil(() => comments().length === 1);
  expect(comments()[0].body?.fileId).toBe("n1");
});

test("a file stays in the draft when the box goes", async () => {
  const first = await renderComposer();
  await pick(pdf(), "file");
  await vi.waitFor(() => expect(FakeUpload.all).toHaveLength(1));
  await finishUpload(0, notesFile());
  await expect.element(sendButton()).toBeEnabled();
  await first.unmount();

  await renderComposer();

  await expect.element(page.getByText("notes.pdf")).toBeVisible();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  toast.clear();
});

test("is focused when the popup opens, unless comments are off", async () => {
  const open = await renderComposer();
  await expect.element(textbox()).toHaveFocus();
  await open.unmount();

  await renderComposer(makePost({ commentsDisabled: true }));
  await pause();
  expect(document.activeElement).toBe(document.body);
});

test("asks for the first comment on a post with none", async () => {
  await renderComposer(makePost({ commentCount: 0 }));

  await vi.waitFor(() => expect(editorElement().querySelector("[data-placeholder]")?.getAttribute("data-placeholder")).toBe("Viết bình luận đầu tiên…"));
});

test("an emoji goes in at the cursor", async () => {
  await renderComposer();
  await write("ab{ArrowLeft}");

  await page.getByRole("button", { name: "Chèn emoji" }).click();

  await vi.waitFor(() => expect(editorElement().textContent).toBe("a😀b"));
});

test("sends on Enter and adds a line on Shift+Enter", async () => {
  await renderComposer();

  await write("Xin chào{Enter}");

  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0]).toMatchObject({ method: "POST", path: "/api/Posts/7/comments", body: { parentId: null, contentHtml: "<p>Xin chào</p>", fileId: null } });
  await vi.waitFor(() => expect(editorElement().textContent).toBe(""));
  await expect.element(textbox()).toHaveFocus();

  await userEvent.keyboard("một{Shift>}{Enter}{/Shift}hai");
  await pause();
  expect(comments()).toHaveLength(1);
  expect(editorElement().querySelector("br")).not.toBeNull();

  await sendButton().click();
  await vi.waitFor(() => expect(comments()).toHaveLength(2));
  expect(comments()[1].body?.contentHtml).toBe("<p>một<br>hai</p>");
});

/** Makes this a touch device. */
function touchDevice() {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const result = matchMedia(query);
    if (query === "(pointer: coarse)") Object.defineProperty(result, "matches", { value: true });
    return result;
  });
}

test("adds a line on Enter on a touch device, sending by the button", async () => {
  touchDevice();
  await renderComposer();

  await write("một{Enter}hai");
  await pause();
  expect(comments()).toHaveLength(0);
  expect(editorElement().querySelectorAll("p")).toHaveLength(2);

  await sendButton().click();
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0].body?.contentHtml).toBe("<p>một</p><p>hai</p>");
});

test("Enter while the mention list is open picks the mention and sends nothing", async () => {
  await renderComposer();

  await write("Chào @Cư");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();
  await userEvent.keyboard("{Enter}");

  await vi.waitFor(() => expect(editorElement().querySelector('[data-mention-id="5"]')).not.toBeNull());
  await pause();
  expect(comments()).toHaveLength(0);

  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(String(comments()[0].body?.contentHtml)).toContain('data-mention-id="5"');
});

test("Enter with no colleague to pick does not send the half-typed mention", async () => {
  await renderComposer();

  await write("Chào @Zzz");
  await expect.element(page.getByText("Không tìm thấy đồng nghiệp")).toBeVisible();
  await userEvent.keyboard("{Enter}");

  await pause();
  expect(comments()).toHaveLength(0);
  expect(editorElement().textContent).toBe("Chào @Zzz");
});

test("Enter while the colleagues are still being fetched does not send the half-typed mention", async () => {
  let release!: () => void;
  profilesGate = new Promise<void>((resolve) => (release = resolve));
  await renderComposer();

  await write("@Cư{Enter}");
  await pause();
  expect(comments()).toHaveLength(0);
  expect(editorElement().textContent).toBe("@Cư");

  release();
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();
  expect(comments()).toHaveLength(0);
});

test("Enter during IME composition sends nothing", async () => {
  await renderComposer();
  await write("xin");

  // Telex: the syllable is still being composed when Enter confirms it.
  editorElement().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await userEvent.keyboard("{Enter}");
  await pause();
  expect(comments()).toHaveLength(0);

  editorElement().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "xin" }));
  await pause();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
});

test("a second Enter while sending does not send twice", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  answer = async (call) => {
    await gate;
    return Response.json(sentComment(call));
  };
  await renderComposer();

  await write("Một lần{Enter}{Enter}");
  await pause();
  expect(comments()).toHaveLength(1);

  release();
  await vi.waitFor(() => expect(editorElement().textContent).toBe(""));
  await pause();
  expect(comments()).toHaveLength(1);
});

test("cannot send when blank, while uploading, or over 2000 characters", async () => {
  await renderComposer();
  await expect.element(sendButton()).toBeDisabled();

  await write("   ");
  await expect.element(sendButton()).toBeDisabled();

  await write("Có chữ");
  await expect.element(sendButton()).toBeEnabled();

  // A picture still going up holds the comment back.
  await pick(png("a.png"));
  await expect.element(page.getByRole("progressbar")).toBeVisible();
  await expect.element(sendButton()).toBeDisabled();
  await finishUpload(0, imageFile("f1", "a.png"));
  await expect.element(sendButton()).toBeEnabled();

  await textbox().fill("x".repeat(2000));
  await expect.element(sendButton()).toBeEnabled();
  await textbox().fill("x".repeat(2001));
  await expect.element(sendButton()).toBeDisabled();
  await expect.element(page.getByText("Bình luận tối đa 2000 ký tự")).toBeVisible();
});

test("counts a mention's name toward the 2000 characters, as Portal.BE does", async () => {
  await renderComposer();
  await textbox().fill(`${"x".repeat(1989)} `);
  await userEvent.keyboard("@Cư");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();

  await userEvent.keyboard("{Enter}");

  // "@Lê Văn Cường" is 13 characters.
  await expect.element(page.getByText("Bình luận tối đa 2000 ký tự")).toBeVisible();
  await expect.element(sendButton()).toBeDisabled();
});

test("sends a file with no text", async () => {
  await renderComposer();
  await pick(png("a.png"));
  await finishUpload(0, imageFile("f1", "a.png"));

  await expect.element(sendButton()).toBeEnabled();
  await sendButton().click();

  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0].body).toMatchObject({ parentId: null, contentHtml: "", fileId: "f1" });
  await expect.element(page.getByRole("img", { name: "a.png" })).not.toBeInTheDocument();
});

test("a new pick replaces the file, and a bad file reports without uploading", async () => {
  await renderComposer();
  await pick(png("a.png"));
  await finishUpload(0, imageFile("f1", "a.png"));
  await expect.element(page.getByRole("img", { name: "a.png" })).toBeVisible();

  await pick(png("big.png", 6 * 1024 * 1024));
  await expect.element(page.getByText('Ảnh "big.png" vượt quá 5 MB.')).toBeVisible();
  expect(FakeUpload.all).toHaveLength(1);
  await expect.element(page.getByRole("img", { name: "a.png" })).toBeVisible();

  await pick(png("b.png"));
  await finishUpload(1, imageFile("f2", "b.png"));
  await expect.element(page.getByRole("img", { name: "b.png" })).toBeVisible();
  expect(page.getByRole("img", { name: "a.png" }).query()).toBeNull();

  await page.getByRole("button", { name: "Bỏ ảnh hoặc video" }).click();
  expect(page.getByRole("img", { name: "b.png" }).query()).toBeNull();
});

const root = makeComment(10);
const reply = makeComment(11, { parentId: 10, author: { id: 5, fullName: "Lê Văn Cường", avatarUrl: null, positionName: null } });

test("replying shows the target, and replying to a reply inserts a mention", async () => {
  const { handle } = await renderComposer();

  // To a root: the label, and no mention.
  await act(async () => handle.current!.reply(root));
  await expect.element(page.getByText("Đang trả lời Trần Thị Bình")).toBeVisible();
  expect(editorElement().querySelector("[data-mention-id]")).toBeNull();
  await act(async () => handle.current!.reply(reply));
  await expect.element(page.getByText("Đang trả lời Lê Văn Cường")).toBeVisible();
  expect(editorElement().querySelector('[data-mention-id="5"]')).not.toBeNull();

  await userEvent.keyboard("đồng ý{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0].body).toMatchObject({ parentId: 11 });
  expect(String(comments()[0].body?.contentHtml)).toContain('data-mention-id="5"');
  await vi.waitFor(() => expect(page.getByText(/Đang trả lời/).query()).toBeNull());
  expect(editorElement().textContent).toBe("");

  // Cancelled: the label goes, and so does the mention.
  await act(async () => handle.current!.reply(reply));
  await expect.element(page.getByText("Đang trả lời Lê Văn Cường")).toBeVisible();
  await page.getByRole("button", { name: "Huỷ" }).click();
  expect(page.getByText(/Đang trả lời/).query()).toBeNull();
  expect(editorElement().querySelector("[data-mention-id]")).toBeNull();

  await userEvent.keyboard("riêng{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(2));
  expect(comments()[1].body).toMatchObject({ parentId: null, contentHtml: "<p>riêng</p>" });
});

test("editing fills the composer, sends PUT, and restores the draft after", async () => {
  const { handle } = await renderComposer();
  await write("nháp");

  const own = makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true, file: imageFile("f9", "cu.png") });
  await act(async () => handle.current!.edit(own));
  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();
  await expect.element(page.getByRole("img", { name: "cu.png" })).toBeVisible();
  expect(editorElement().textContent).toBe("Cũ");

  await userEvent.keyboard(" mới{Enter}");

  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0]).toMatchObject({ method: "PUT", path: "/api/Posts/comments/20", body: { contentHtml: "<p>Cũ mới</p>", fileId: "f9" } });
  await vi.waitFor(() => expect(editorElement().textContent).toBe("nháp"));
  expect(page.getByText("Đang sửa bình luận").query()).toBeNull();
  expect(page.getByRole("img", { name: "cu.png" }).query()).toBeNull();

  // Cancelling an edit brings the draft back as well.
  await act(async () => handle.current!.edit(own));
  await page.getByRole("button", { name: "Huỷ" }).click();
  await vi.waitFor(() => expect(editorElement().textContent).toBe("nháp"));
  expect(comments()).toHaveLength(1);
});

test("keeps text and file when sending fails", async () => {
  // As for a root deleted while its reply was being written.
  answer = () => Response.json({ status: 404, code: "not_found" }, { status: 404 });
  await renderComposer();
  await write("Giữ lại");
  await pick(png("a.png"));
  await finishUpload(0, imageFile("f1", "a.png"));

  await sendButton().click();

  await expect.element(page.getByText("Gửi không thành công. Bình luận của bạn vẫn còn đây.")).toBeVisible();
  expect(editorElement().textContent).toBe("Giữ lại");
  expect(editorElement().getAttribute("contenteditable")).toBe("true");
  await expect.element(textbox()).toHaveFocus();
  await expect.element(page.getByRole("img", { name: "a.png" })).toBeVisible();
  await expect.element(sendButton()).toBeEnabled();
});

test("keeps the draft for that post across close, and not for another post", async () => {
  const first = await renderComposer();
  await write("Dang dở");
  await pick(png("a.png"));
  await finishUpload(0, imageFile("f1", "a.png"));
  await first.unmount();

  const again = await renderComposer();
  await vi.waitFor(() => expect(editorElement().textContent).toBe("Dang dở"));
  await expect.element(page.getByRole("img", { name: "a.png" })).toBeVisible();

  // Closed with b.png, which replaced it, still going up: only a finished file is kept.
  await pick(png("b.png"));
  await again.unmount();

  const third = await renderComposer();
  await vi.waitFor(() => expect(editorElement().textContent).toBe("Dang dở"));
  await pause();
  expect(page.getByRole("img", { name: /.png$/ }).query()).toBeNull();
  await third.unmount();

  await renderComposer(makePost({ id: 8, commentCount: 3 }));
  await pause();
  expect(editorElement().textContent).toBe("");
  expect(page.getByRole("img", { name: "a.png" }).query()).toBeNull();
});

test("is replaced by the notice when comments are off, but still edits", async () => {
  const { handle } = await renderComposer(makePost({ commentsDisabled: true }));

  await expect.element(page.getByText("Tác giả đã tắt bình luận cho bài viết này")).toBeVisible();
  expect(page.getByRole("textbox").query()).toBeNull();
  expect(sendButton().query()).toBeNull();

  const own: PostCommentDto = makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true });
  await act(async () => handle.current!.edit(own));
  await expect.element(textbox()).toHaveFocus();
  expect(editorElement().textContent).toBe("Cũ");

  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  await expect.element(page.getByText("Tác giả đã tắt bình luận cho bài viết này")).toBeVisible();
});

test("is frozen while a comment is being sent, then empty, editable and focused", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  answer = async (call) => {
    await gate;
    return Response.json(sentComment(call));
  };
  const { handle } = await renderComposer();

  await write("Một{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(editorElement().getAttribute("contenteditable")).toBe("false");
  await userEvent.keyboard("thêm");
  await act(async () => {
    handle.current!.reply(root);
    handle.current!.edit(makeComment(20, { canEdit: true }));
  });
  await pause();
  expect(editorElement().textContent).toBe("Một");
  expect(page.getByText(/Đang trả lời|Đang sửa/).query()).toBeNull();
  await expect.element(page.getByRole("button", { name: "Thêm ảnh hoặc video" })).toBeDisabled();

  release();
  await vi.waitFor(() => expect(editorElement().textContent).toBe(""));
  expect(editorElement().getAttribute("contenteditable")).toBe("true");
  await expect.element(textbox()).toHaveFocus();
  await userEvent.keyboard("tiếp");
  expect(editorElement().textContent).toBe("tiếp");
});

test("undo after a send does not bring the text back", async () => {
  // Answered after the history's grouping time (500 ms), or the clearing would be undone together with the typing.
  answer = async (call) => {
    await pause(700);
    return Response.json(sentComment(call));
  };
  await renderComposer();
  await write("Đã gửi{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  await vi.waitFor(() => expect(editorElement().textContent).toBe(""));
  await expect.element(textbox()).toHaveFocus();

  await userEvent.keyboard("{Control>}z{/Control}");

  await pause();
  expect(editorElement().textContent).toBe("");
});

test("undo in an edit does not bring the draft back", async () => {
  const { handle } = await renderComposer();
  await write("nháp");

  await act(async () => handle.current!.edit(makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true })));
  await expect.element(textbox()).toHaveFocus();
  await userEvent.keyboard("{Control>}z{/Control}");

  await pause();
  expect(editorElement().textContent).toBe("Cũ");
});

test("removing the file of the comment being edited sends no file, and replacing it sends the new one", async () => {
  const { handle } = await renderComposer();
  const own = makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true, file: imageFile("f9", "cu.png") });

  await act(async () => handle.current!.edit(own));
  await page.getByRole("button", { name: "Bỏ ảnh hoặc video" }).click();
  await userEvent.click(textbox());
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0]).toMatchObject({ method: "PUT", body: { fileId: null } });
  await expect.element(textbox()).toHaveFocus();

  await act(async () => handle.current!.edit(own));
  await pick(png("n.png"));
  await finishUpload(0, imageFile("f10", "n.png"));
  await expect.element(page.getByRole("img", { name: "n.png" })).toBeVisible();
  expect(page.getByRole("img", { name: "cu.png" }).query()).toBeNull();
  await userEvent.click(textbox());
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(2));
  expect(comments()[1]).toMatchObject({ method: "PUT", body: { fileId: "f10" } });
});

test("remembers who is being answered across an edit and across close", async () => {
  const { handle, unmount } = await renderComposer();
  await act(async () => handle.current!.reply(reply));

  await act(async () => handle.current!.edit(makeComment(20, { canEdit: true })));
  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();
  expect(page.getByText(/Đang trả lời/).query()).toBeNull();
  await page.getByRole("button", { name: "Huỷ" }).click();
  await expect.element(page.getByText("Đang trả lời Lê Văn Cường")).toBeVisible();
  expect(editorElement().querySelector('[data-mention-id="5"]')).not.toBeNull();

  await unmount();
  await renderComposer();
  await expect.element(page.getByText("Đang trả lời Lê Văn Cường")).toBeVisible();
  expect(editorElement().querySelector('[data-mention-id="5"]')).not.toBeNull();
});

test("a deleted comment that is being edited ends the edit, and the draft comes back", async () => {
  const { handle } = await renderComposer();
  await write("nháp");
  await act(async () => handle.current!.edit(makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true })));
  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();

  await act(async () => handle.current!.commentDeleted(21));
  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();

  await act(async () => handle.current!.commentDeleted(20));
  await expect.element(page.getByText("Đang sửa bình luận")).not.toBeInTheDocument();
  expect(editorElement().textContent).toBe("nháp");
  await expect.element(textbox()).toHaveFocus();
});

test("a deleted comment that is being answered stops being answered, keeping the text", async () => {
  const { handle } = await renderComposer();
  await act(async () => handle.current!.reply(reply));
  await expect.element(textbox()).toHaveFocus();
  await userEvent.keyboard("đồng ý");

  await act(async () => handle.current!.commentDeleted(10));
  await expect.element(page.getByText("Đang trả lời Lê Văn Cường")).toBeVisible();

  await act(async () => handle.current!.commentDeleted(11));
  await expect.element(page.getByText(/Đang trả lời/)).not.toBeInTheDocument();
  expect(editorElement().querySelector("[data-mention-id]")).toBeNull();
  expect(editorElement().textContent).toBe("đồng ý");

  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0].body).toMatchObject({ parentId: null });
});

test("a deleted comment is dropped from the draft that waits behind an edit", async () => {
  const { handle } = await renderComposer();
  await act(async () => handle.current!.reply(root));
  await act(async () => handle.current!.edit(makeComment(20, { canEdit: true })));

  await act(async () => handle.current!.commentDeleted(10));
  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();

  await page.getByRole("button", { name: "Huỷ" }).click();
  await expect.element(page.getByText("Đang sửa bình luận")).not.toBeInTheDocument();
  expect(page.getByText(/Đang trả lời/).query()).toBeNull();
});

test("with comments off, deleting the comment being edited leaves the notice, with the focus on it", async () => {
  const { handle } = await renderComposer(makePost({ commentsDisabled: true }));
  await act(async () => handle.current!.edit(makeComment(20, { canEdit: true })));
  await expect.element(textbox()).toHaveFocus();

  await act(async () => handle.current!.commentDeleted(20));

  await expect.element(page.getByRole("status")).toHaveFocus();
  expect(page.getByRole("textbox").query()).toBeNull();
});

/** Holds Portal.BE's answer to the comment sent until the function returned is called. */
function holdAnswer(respond: (call: Sent) => Response = (call) => Response.json(call.method === "PUT" ? makeComment(20) : sentComment(call))) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  answer = async (call) => {
    await gate;
    return respond(call);
  };
  return release;
}

test("closing while a comment is being sent does not keep it as a draft", async () => {
  const release = holdAnswer();
  const first = await renderComposer();
  await write("Đã gửi{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  await first.unmount();

  release();
  await pause();

  await renderComposer();
  await pause();
  expect(editorElement().textContent).toBe("");
});

test("closing while an edit is being sent keeps the draft behind it", async () => {
  const release = holdAnswer();
  const first = await renderComposer();
  await write("nháp");
  await act(async () => first.handle.current!.edit(makeComment(20, { contentHtml: "<p>Cũ</p>", canEdit: true })));
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  await first.unmount();

  release();
  await pause();

  await renderComposer();
  await vi.waitFor(() => expect(editorElement().textContent).toBe("nháp"));
});

test("a comment that fails after closing says so, and stays as the draft", async () => {
  const danger = vi.spyOn(toast, "danger");
  const release = holdAnswer(() => new Response(null, { status: 500 }));
  const first = await renderComposer();
  await write("Giữ lại{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  await first.unmount();
  await pause(); // the editor goes a moment after the box

  release();

  await vi.waitFor(() => expect(danger).toHaveBeenCalledWith("Không gửi được bình luận của bạn."));
  await renderComposer();
  await vi.waitFor(() => expect(editorElement().textContent).toBe("Giữ lại"));
});

test("Enter sends after leaving a half-typed mention and coming back", async () => {
  await renderComposer();
  await write("Chào @Cư");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();

  editorElement().blur();
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).not.toBeInTheDocument();
  await userEvent.click(textbox());
  await userEvent.keyboard("{Enter}");

  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(comments()[0].body?.contentHtml).toBe("<p>Chào @Cư</p>");

  // Sending frozen and failing changes nothing: the next Enter sends as well.
  await vi.waitFor(() => expect(editorElement().textContent).toBe(""));
  answer = () => new Response(null, { status: 500 });
  await write("@Cư");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();
  editorElement().blur();
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).not.toBeInTheDocument();
  await userEvent.click(textbox());
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByText("Gửi không thành công. Bình luận của bạn vẫn còn đây.")).toBeVisible();
  await expect.element(textbox()).toHaveFocus();
  expect(page.getByRole("option", { name: /Lê Văn Cường/ }).query()).toBeNull();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(3));
});

test("typing more after leaving a half-typed mention brings the list back, and Enter picks from it", async () => {
  await renderComposer();
  await write("Chào @Cư");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();

  editorElement().blur();
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).not.toBeInTheDocument();
  await userEvent.click(textbox());
  await pause();
  expect(page.getByRole("option", { name: /Lê Văn Cường/ }).query()).toBeNull();
  await userEvent.keyboard("ờng");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();
  await userEvent.keyboard("{Enter}");

  await vi.waitFor(() => expect(editorElement().querySelector('[data-mention-id="5"]')).not.toBeNull());
  expect(editorElement().textContent?.trim()).toBe("Chào @Lê Văn Cường");
  await pause();
  expect(comments()).toHaveLength(0);

  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(String(comments()[0].body?.contentHtml)).toContain('data-mention-id="5"');
});

test("colleagues who arrive after leaving a half-typed mention do not open the list", async () => {
  let release!: () => void;
  profilesGate = new Promise<void>((resolve) => (release = resolve));
  await renderComposer();
  await write("@Cư");

  editorElement().blur();
  release();
  await pause();

  expect(page.getByRole("option", { name: /Lê Văn Cường/ }).query()).toBeNull();
});

test("Esc keeps the list closed while typing on, also after leaving and coming back", async () => {
  await renderComposer();
  await write("@C");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();

  editorElement().blur();
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).not.toBeInTheDocument();
  await userEvent.click(textbox());
  await userEvent.keyboard("ư");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).toBeVisible();

  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).not.toBeInTheDocument();
  await userEvent.keyboard("ờ");
  await pause();
  expect(page.getByRole("option", { name: /Lê Văn Cường/ }).query()).toBeNull();

  // Leaving a list already closed by Esc does not undo the Esc.
  editorElement().blur();
  editorElement().focus();
  await userEvent.keyboard("n");
  await pause();
  expect(page.getByRole("option", { name: /Lê Văn Cường/ }).query()).toBeNull();
  expect(editorElement().textContent).toBe("@Cườn");
});

test("a mention picked with the mouse goes in, sends nothing, and leaves the cursor in the box", async () => {
  await renderComposer();
  await write("Chào @Cư");

  await page.getByRole("option", { name: /Lê Văn Cường/ }).click();

  await vi.waitFor(() => expect(editorElement().querySelector('[data-mention-id="5"]')).not.toBeNull());
  await expect.element(page.getByRole("option", { name: /Lê Văn Cường/ })).not.toBeInTheDocument();
  await expect.element(textbox()).toHaveFocus();
  await pause();
  expect(comments()).toHaveLength(0);

  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(comments()).toHaveLength(1));
  expect(String(comments()[0].body?.contentHtml)).toContain('data-mention-id="5"');
});

test("on a touch device a deleted comment leaves the focus by the box, not in it, so no keyboard opens", async () => {
  const { handle } = await renderComposer();
  await write("nháp");
  touchDevice();
  editorElement().blur();

  await act(async () => handle.current!.commentDeleted(20));

  await vi.waitFor(() => expect(document.activeElement).not.toBe(document.body));
  expect(document.activeElement?.contains(editorElement())).toBe(true);
  await pause();
  expect(document.activeElement).not.toBe(editorElement());
});

const transfer = (...files: File[]) => {
  const data = new DataTransfer();
  files.forEach((file) => data.items.add(file));
  return data;
};

/** Lets `data` go over `element`, as a drop; says whether the browser's own handling was stopped. */
function drop(element: Element, data: DataTransfer) {
  const { left, top } = element.getBoundingClientRect();
  return !element.dispatchEvent(new DragEvent("drop", { dataTransfer: data, clientX: left + 8, clientY: top + 8, bubbles: true, cancelable: true }));
}

test("a pasted picture goes up, and takes the place of the file there is", async () => {
  await renderComposer();
  await pick(png("a.png"));
  await finishUpload(0, imageFile("f1", "a.png"));

  editorElement().dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer(png("anh.png")), bubbles: true, cancelable: true }));

  await vi.waitFor(() => expect(FakeUpload.all).toHaveLength(2));
  await finishUpload(1, imageFile("f2", "anh.png"));
  await expect.element(page.getByRole("img", { name: "anh.png" })).toBeVisible();
  expect(page.getByRole("img", { name: "a.png" }).query()).toBeNull();
  expect(editorElement().textContent).toBe("");
});

test("a picture let go on the box goes up, the first of many, and a file too big is refused", async () => {
  await renderComposer();

  expect(drop(editorElement(), transfer(png("big.png", 6 * 1024 * 1024)))).toBe(true);
  await expect.element(page.getByText('Ảnh "big.png" vượt quá 5 MB.')).toBeVisible();
  expect(FakeUpload.all).toHaveLength(0);

  expect(drop(editorElement(), transfer(png("a.png"), png("b.png")))).toBe(true);
  await vi.waitFor(() => expect(FakeUpload.all).toHaveLength(1));
  await finishUpload(0, imageFile("f1", "a.png"));
  await expect.element(page.getByRole("img", { name: "a.png" })).toBeVisible();
});

test("a file let go anywhere does not make the browser leave the draft, and frozen the box takes none", async () => {
  const release = holdAnswer();
  await renderComposer();
  const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });

  expect(drop(document.body, transfer(pdf))).toBe(true);
  expect(drop(document.body, transfer(png("a.png")))).toBe(true);
  expect(FakeUpload.all).toHaveLength(0);

  await write("Một{Enter}");
  await vi.waitFor(() => expect(editorElement().getAttribute("contenteditable")).toBe("false"));
  expect(drop(editorElement(), transfer(png("a.png")))).toBe(true);
  await pause();
  expect(FakeUpload.all).toHaveLength(0);
  release();
});

test("text carried along with a picture pastes as text, and dragged text is left alone", async () => {
  await renderComposer();
  const data = transfer(png("excel.png"));
  data.setData("text/plain", "Ô trong Excel");

  editorElement().dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));

  await vi.waitFor(() => expect(editorElement().textContent).toBe("Ô trong Excel"));
  expect(FakeUpload.all).toHaveLength(0);

  const text = new DataTransfer();
  text.setData("text/plain", "chữ");
  const away = new DragEvent("drop", { dataTransfer: text, bubbles: true, cancelable: true });
  document.body.dispatchEvent(away);
  expect(away.defaultPrevented).toBe(false);
});

test("speaks the reader's language", async () => {
  setStoredLocale("en-US");
  const danger = vi.spyOn(toast, "danger");
  try {
    await render(
      <Provider store={makeStore()}>
        <LocaleProvider>
          <Toast.Provider />
          <CommentComposer post={makePost({ commentCount: 3 })} />
        </LocaleProvider>
      </Provider>,
    );

    // The list is drawn from outside this tree (ReactRenderer), and still follows the language.
    await write("@Zzz");
    await expect.element(page.getByText("No colleague found")).toBeVisible();
    await userEvent.keyboard("{Escape}");

    await page.getByRole("button", { name: "Add an image or video" }).click();
    await pick(png("big.png", 6 * 1024 * 1024));
    await vi.waitFor(() => expect(danger).toHaveBeenCalledWith('Image "big.png" is larger than 5 MB.'));

    await pick(png("a.png"));
    await expect.element(page.getByRole("progressbar", { name: "Uploading a.png" })).toBeVisible();
    await act(async () => FakeUpload.all[0].onerror?.());
    await expect.element(page.getByText("Upload failed")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Retry" })).toBeVisible();
  } finally {
    localStorage.clear();
  }
});
