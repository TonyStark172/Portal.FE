/**
 * Local previews (object URLs) of images picked in the composer, so an image shows at once and is not
 * downloaded again after its upload. Keyed by the image node's previewId.
 */
const previews = new Map<string, string>();

export function addPreview(file: File): string {
  const id = crypto.randomUUID();
  previews.set(id, URL.createObjectURL(file));
  return id;
}

export const getPreview = (id: string | null | undefined) => (id ? previews.get(id) : undefined);

export function revokePreviews(ids: Iterable<string>) {
  for (const id of ids) {
    const url = previews.get(id);
    if (url) URL.revokeObjectURL(url);
    previews.delete(id);
  }
}
