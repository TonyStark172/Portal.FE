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

const kindLabel = (item: AlbumItem) => (item.kind === "Video" ? "Video" : "Ảnh");

/**
 * "Ảnh/Video": every item of the album with its caption; drag a thumbnail (mouse, touch, or Space and the arrow
 * keys) to change the order, ✕ to remove it.
 */
export function AlbumEditor({ album, isOpen, onOpenChange, onAdd }: AlbumEditorProps) {
  // A press-and-hold starts a drag on touch screens, so a swipe still scrolls the list.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const keys = album.items.map((item) => item.key);

  const describe = (id: UniqueIdentifier) => {
    const index = keys.indexOf(String(id));
    return index < 0 ? "" : `${kindLabel(album.items[index])} ${index + 1}`;
  };
  const position = (id: UniqueIdentifier) => keys.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã nhấc ${describe(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.id)} đang ở vị trí ${position(over.id)}.` : `${describe(active.id)} đang ở ngoài danh sách.`,
    onDragEnd: ({ active, over }) =>
      over ? `Đã thả ${describe(active.id)} vào vị trí ${position(over.id)}.` : `Đã thả ${describe(active.id)}.`,
    onDragCancel: ({ active }) => `Đã huỷ di chuyển ${describe(active.id)}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) album.move(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="sm:max-w-4xl">
          <Modal.CloseTrigger aria-label="Đóng" />
          <Modal.Header>
            <Modal.Heading>Ảnh/Video</Modal.Heading>
            <p className="text-sm text-muted">Kéo để đổi thứ tự, mục đầu tiên hiện lớn nhất trên bảng tin.</p>
          </Modal.Header>
          <Modal.Body>
            {album.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có ảnh hoặc video nào.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                accessibility={{
                  announcements,
                  screenReaderInstructions: {
                    draggable:
                      "Nhấn Space hoặc Enter để nhấc. Dùng phím mũi tên để di chuyển, Space hoặc Enter để thả, Esc để huỷ.",
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
              Thêm ảnh/video
            </Button>
            <Button slot="close">Xong</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function SortableTile({ item, position, album }: { item: AlbumItem; position: number; album: Album }) {
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
          aria-label={`${kindLabel(item)} ${position}: ${item.name}. Kéo để đổi vị trí`}
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
            aria-label={`Bỏ ${item.name}`}
            onPress={() => album.remove(item.key)}
            className="absolute end-2 top-2 z-20 rounded-full shadow-md"
          >
            <Xmark className="size-4" />
          </Button>
          <Tooltip.Content>Bỏ</Tooltip.Content>
        </Tooltip>
      </div>
      <TextArea
        aria-label={`Chú thích cho ${item.name}`}
        placeholder="Chú thích"
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
