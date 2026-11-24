/**
 * The images of the conversations already downloaded in this page, as object URLs: a picture seen in a bubble is not
 * downloaded again for the shared-media grid, the preview, or when its message scrolls back into view. An image in use
 * (by a mounted <img>) is never let go; of those nobody uses, the most recently used are kept.
 */
type Entry = { promise: Promise<string>; url?: string; users: number };

/** How many images nobody shows any more stay in memory (thumbnails are ~30–60 KB each). */
export const MAX_IDLE_IMAGES = 200;

let owner: object | null = null;
// In order of last use, the least recent first.
const entries = new Map<string, Entry>();

/** Drops everything, e.g. when another account signs in on the page. */
export function clearImageCache(): void {
  for (const entry of entries.values()) if (entry.url) URL.revokeObjectURL(entry.url);
  entries.clear();
}

/** The object URL of an image downloaded already, without waiting. */
export function peekImage(login: object, key: string): string | undefined {
  return owner === login ? entries.get(key)?.url : undefined;
}

/**
 * Starts using an image: downloads it with `load` unless it is there (or on its way) already. Every call needs a
 * `releaseImage` once the image is no longer shown. A failed download is forgotten, so a later use tries again.
 */
export function acquireImage(login: object, key: string, load: () => Promise<Blob>): Promise<string> {
  if (owner !== login) {
    clearImageCache();
    owner = login;
  }
  let entry = entries.get(key);
  if (entry) {
    entries.delete(key);
  } else {
    const created: Entry = {
      users: 0,
      promise: load().then(
        (blob) => (created.url = URL.createObjectURL(blob)),
        (failure) => {
          if (entries.get(key) === created) entries.delete(key);
          throw failure;
        },
      ),
    };
    // Nobody may be listening by the time it fails.
    created.promise.catch(() => {});
    entry = created;
  }
  entry.users++;
  entries.set(key, entry);
  return entry.promise;
}

/** Stops using an image; the least recently used of those nobody uses are let go beyond `MAX_IDLE_IMAGES`. */
export function releaseImage(login: object, key: string): void {
  if (owner !== login) return;
  const entry = entries.get(key);
  if (!entry) return;
  entry.users = Math.max(0, entry.users - 1);

  let idle = 0;
  for (const other of entries.values()) if (other.users === 0 && other.url) idle++;
  for (const [otherKey, other] of entries) {
    if (idle <= MAX_IDLE_IMAGES) break;
    if (other.users > 0 || !other.url) continue;
    URL.revokeObjectURL(other.url);
    entries.delete(otherKey);
    idle--;
  }
}
