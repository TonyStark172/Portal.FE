"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Picture, Xmark } from "@gravity-ui/icons";
import { Button, Modal, TextArea, Tooltip } from "@heroui/react";
import { useLocale } from "@/shared/i18n";
import type { Album, AlbumItem } from "../../hooks/useAlbum";
import { MAX_CAPTION, MAX_MEDIA } from "../../lib/fileRules";
import { DraftThumb } from "./DraftThumb";

type AlbumEditorProps = {
  album: Album;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the file picker to add images or videos. */
  onAdd: () => void;
};

const kindKey = (item: AlbumItem) => (item.kind === "Video" ? "posts.album.video" : "posts.album.image");

/**
 * "Ảnh/Video": every item of the album with its caption; drag a thumbnail (mouse, touch, or Space and the arrow
 * keys) to change the order, ✕ to remove it.
 */
export function AlbumEditor({ album, isOpen, onOpenChange, onAdd }: AlbumEditorProps) {
  const { t } = useLocale();
  // A press-and-hold starts a drag on touch screens, so a swipe still scrolls the list.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const keys = album.items.map((item) => item.key);

  const describe = (id: UniqueIdentifier) => {
    const index = keys.indexOf(String(id));
    return index < 0 ? "" : `${t(kindKey(album.items[index]))} ${index + 1}`;
  };
  const position = (id: UniqueIdentifier) => keys.indexOf(String(id)) + 1;
  const say = (key: string, id: UniqueIdentifier, overId?: UniqueIdentifier) =>
    t(key).replace("{item}", describe(id)).replace("{position}", overId === undefined ? "" : String(position(overId)));
  const announcements: Announcements = {
    onDragStart: ({ active }) => say("posts.album.picked", active.id),
    onDragOver: ({ active, over }) => (over ? say("posts.album.over", active.id, over.id) : say("posts.album.outside", active.id)),
    onDragEnd: ({ active, over }) => (over ? say("posts.album.dropped", active.id, over.id) : say("posts.album.droppedOutside", active.id)),
    onDragCancel: ({ active }) => say("posts.album.cancelled", active.id),
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) album.move(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="sm:max-w-4xl">
          <Modal.CloseTrigger aria-label={t("posts.close")} />
          <Modal.Header>
            <Modal.Heading>{t("posts.album.title")}</Modal.Heading>
            <p className="text-sm text-muted">{t("posts.album.hint")}</p>
          </Modal.Header>
          <Modal.Body>
            {album.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{t("posts.album.empty")}</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                accessibility={{
                  announcements,
                  screenReaderInstructions: {
                    draggable: t("posts.album.instructions"),
                  },
                }}
              >
                <SortableContext items={keys} strategy={rectSortingStrategy}>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {album.items.map((item, index) => (
                      <SortableTile key={item.key} item={item} position={index + 1} album={album} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onAdd} isDisabled={album.items.length >= MAX_MEDIA}>
              <Picture className="size-4" />
              {t("posts.addMedia")}
            </Button>
            <Button slot="close">{t("posts.album.done")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function SortableTile({ item, position, album }: { item: AlbumItem; position: number; album: Album }) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2 rounded-2xl bg-default/60 p-2 ${isDragging ? "relative z-30 shadow-xl" : ""}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-default">
        <DraftThumb item={item} onRetry={() => album.retry(item.key)} />
        {/* The thumbnail is the drag handle; the caption below stays a plain text field. */}
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("posts.album.tile").replace("{kind}", t(kindKey(item))).replace("{position}", String(position)).replace("{name}", item.name)}
          className="absolute inset-0 cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset active:cursor-grabbing"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute start-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white"
        >
          {position}
        </span>
        <Tooltip delay={400}>
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={t("posts.file.remove").replace("{name}", item.name)}
            onPress={() => album.remove(item.key)}
            className="absolute end-2 top-2 z-20 rounded-full shadow-md"
          >
            <Xmark className="size-4" />
          </Button>
          <Tooltip.Content>{t("posts.album.remove")}</Tooltip.Content>
        </Tooltip>
      </div>
      <TextArea
        aria-label={t("posts.album.captionFor").replace("{name}", item.name)}
        placeholder={t("posts.album.caption")}
        variant="secondary"
        fullWidth
        rows={2}
        maxLength={MAX_CAPTION}
        value={item.caption}
        onChange={(event) => album.setCaption(item.key, event.target.value)}
        className="resize-none"
      />
    </li>
  );
}
