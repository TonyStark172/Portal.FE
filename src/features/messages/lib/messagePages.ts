import type { ChatMessageDto, ChatMessagePage } from "@/shared/api/generated/portalApi";

/**
 * The pages of messages a thread has loaded, as its query keeps them: the newest page first, each newest message first.
 * These functions change them in place (inside the query cache's updater) as single messages come, change and go, so
 * that nothing loaded ever has to be read again as a whole.
 */
export type MessagePages = { pages: ChatMessagePage[]; pageParams: unknown[] };

/** The id of the newest message loaded, or null when none is. */
export function newestLoadedId(data: MessagePages): number | null {
  let newest: number | null = null;
  for (const page of data.pages) for (const item of page.items) if (newest === null || item.id > newest) newest = item.id;
  return newest;
}

/** Whether the pages reach the latest message of the conversation (the newest page has nothing after it). */
export function reachesLatest(data: MessagePages): boolean {
  return data.pages.length > 0 && data.pages[0].nextAfter == null;
}

export function hasMessage(data: MessagePages, id: number): boolean {
  return data.pages.some((page) => page.items.some((item) => item.id === id));
}

/**
 * Puts a message the server returned in its place. One that is loaded is replaced; a new one goes first when the pages
 * reach the latest message (it is the latest now), and is left out of a window further back, which it does not belong to.
 */
export function putMessage(data: MessagePages, message: ChatMessageDto): void {
  for (const page of data.pages) {
    const index = page.items.findIndex((item) => item.id === message.id);
    if (index >= 0) {
      page.items[index] = message;
      return;
    }
  }
  const newest = newestLoadedId(data);
  if (data.pages.length > 0 && reachesLatest(data) && (newest === null || message.id > newest)) data.pages[0].items.unshift(message);
}

/** Takes a message out (removed on the reader's side). */
export function removeMessage(data: MessagePages, id: number): void {
  for (const page of data.pages) {
    const index = page.items.findIndex((item) => item.id === id);
    if (index >= 0) page.items.splice(index, 1);
  }
}

/** Replaces everything loaded by the latest page alone. */
export function resetToLatest(data: MessagePages, latest: ChatMessagePage): void {
  data.pages = [latest];
  data.pageParams = [null];
}

/**
 * Brings pages that reach the latest message up to date with the latest page just read: its messages replace the loaded
 * ones or come in first when new, and loaded messages it should hold but does not (removed on the reader's side
 * elsewhere) go. Returns "gap" without changing anything when the latest page does not reach back to what is loaded:
 * more came in between than a page holds, and joining them would leave a hole.
 */
export function mergeLatest(data: MessagePages, latest: ChatMessagePage): "merged" | "gap" {
  const newest = newestLoadedId(data);
  if (data.pages.length === 0 || newest === null) {
    resetToLatest(data, latest);
    return "merged";
  }
  if (latest.items.length === 0) {
    // Nothing is left to see.
    if (latest.nextBefore == null) resetToLatest(data, latest);
    return "merged";
  }

  const oldestRead = latest.items[latest.items.length - 1].id;
  // It reaches what is loaded when its oldest message is not newer than the newest loaded, or it is the whole conversation.
  if (oldestRead > newest && latest.nextBefore != null) return "gap";

  const read = new Map(latest.items.map((item) => [item.id, item]));
  for (const page of data.pages) {
    page.items = page.items.filter((item) => item.id < oldestRead || read.has(item.id)).map((item) => read.get(item.id) ?? item);
  }
  const added = latest.items.filter((item) => item.id > newest);
  data.pages[0].items.unshift(...added);
  data.pages[0].nextAfter = null;
  return "merged";
}

/** The messages of all the pages, newest first, each once (pages read at different times may overlap). */
export function distinctMessages(pages: { items: ChatMessageDto[] }[] | undefined): ChatMessageDto[] {
  const seen = new Set<number>();
  const messages: ChatMessageDto[] = [];
  for (const message of (pages ?? []).flatMap((page) => page.items)) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    messages.push(message);
  }
  return messages;
}
