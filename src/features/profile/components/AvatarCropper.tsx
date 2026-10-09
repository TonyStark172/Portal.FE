"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MagnifierMinus, MagnifierPlus } from "@gravity-ui/icons";
import { Button, Modal, Slider } from "@heroui/react";
import { centeredOffset, clampOffset, coverScale, cropSource, zoomAround, type Offset, type Size } from "../avatarCrop";

/** The circle of the avatar (px): what is saved is the square around it. */
const STAGE = 256;
/** Room around the circle, where the rest of the picture shows dimmed, so the whole circle stays in sight. */
const MARGIN = 20;
/** The saved avatar (px, square). */
const OUTPUT = 512;
const MAX_ZOOM = 3;
const STEP_PX = 10;

type Picture = { element: HTMLImageElement; size: Size; url: string };

/**
 * Fitting a picked picture into the round avatar before it is uploaded, as Facebook does: the picture is dragged
 * (mouse, finger or arrow keys) and zoomed (slider, wheel or +/−) behind a circle, always covering it; "Lưu ảnh"
 * saves the square around the circle as a 512 px JPEG.
 */
export function AvatarCropper({ file, isSaving, onSave, onCancel }: {
  file: File | null;
  isSaving: boolean;
  onSave: (avatar: Blob) => void;
  onCancel: () => void;
}) {
  const [picture, setPicture] = useState<Picture | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: Offset } | null>(null);

  // The picked file as an image (a new cropper per file: the parent keys it).
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const element = new Image();
    let isCurrent = true;
    element.onload = () => {
      if (!isCurrent) return;
      const size = { width: element.naturalWidth, height: element.naturalHeight };
      setPicture({ element, size, url });
      setOffset(centeredOffset(size, coverScale(size, STAGE), STAGE));
    };
    element.src = url;
    return () => {
      isCurrent = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const base = picture ? coverScale(picture.size, STAGE) : 1;
  const scale = base * zoom;

  function zoomTo(next: number, point?: Offset) {
    if (!picture) return;
    const to = Math.min(Math.max(next, 1), MAX_ZOOM);
    setOffset((current) => zoomAround(current, picture.size, scale, base * to, STAGE, point));
    setZoom(to);
  }

  function moveBy(dx: number, dy: number) {
    if (!picture) return;
    setOffset((current) => clampOffset({ x: current.x + dx, y: current.y + dy }, picture.size, scale, STAGE));
  }

  function onKeyDown(event: KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-STEP_PX, 0],
      ArrowRight: [STEP_PX, 0],
      ArrowUp: [0, -STEP_PX],
      ArrowDown: [0, STEP_PX],
    };
    if (moves[event.key]) moveBy(...moves[event.key]);
    else if (event.key === "+" || event.key === "=") zoomTo(zoom + 0.1);
    else if (event.key === "-") zoomTo(zoom - 0.1);
    else return;
    event.preventDefault();
  }

  function save() {
    if (!picture) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext("2d")!;
    // JPEG has no transparency: a transparent picture stands on white rather than black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, OUTPUT, OUTPUT);
    context.imageSmoothingQuality = "high";
    const source = cropSource(offset, scale, STAGE);
    context.drawImage(picture.element, source.x, source.y, source.size, source.size, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob((blob) => blob && onSave(blob), "image/jpeg", 0.9);
  }

  return (
    <Modal.Backdrop isOpen={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <Modal.Container placement="center">
        <Modal.Dialog className="sm:max-w-sm">
          <Modal.CloseTrigger aria-label="Đóng" />
          <Modal.Header>
            <Modal.Heading>Chỉnh ảnh đại diện</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col items-center gap-4">
            <div
              data-crop-stage
              data-ready={picture ? "" : undefined}
              role="group"
              aria-label="Vùng chỉnh ảnh: kéo để di chuyển, dùng phím mũi tên hoặc + và −"
              tabIndex={0}
              style={{ width: STAGE + 2 * MARGIN, height: STAGE + 2 * MARGIN }}
              className="relative cursor-grab touch-none overflow-hidden rounded-xl bg-default outline-none select-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, y: event.clientY, from: offset };
              }}
              onPointerMove={(event) => {
                const d = drag.current;
                if (!d || !picture) return;
                setOffset(
                  clampOffset(
                    { x: d.from.x + event.clientX - d.x, y: d.from.y + event.clientY - d.y },
                    picture.size,
                    scale,
                    STAGE,
                  ),
                );
              }}
              onPointerUp={(event) => {
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                zoomTo(zoom * (1 - event.deltaY * 0.001), {
                  x: event.clientX - box.left - MARGIN,
                  y: event.clientY - box.top - MARGIN,
                });
              }}
              onKeyDown={onKeyDown}
            >
              {picture && (
                // eslint-disable-next-line @next/next/no-img-element -- an object URL of the picked file
                <img
                  src={picture.url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none"
                  style={{
                    left: MARGIN + offset.x,
                    top: MARGIN + offset.y,
                    width: picture.size.width * scale,
                    height: picture.size.height * scale,
                  }}
                />
              )}
              {/* Outside the circle dims: what stays bright is the avatar. */}
              <div
                aria-hidden
                data-crop-circle
                style={{ inset: MARGIN }}
                className="pointer-events-none absolute rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 ring-white/80"
              />
            </div>
            <div className="flex w-full items-center gap-3">
              <MagnifierMinus aria-hidden className="size-4 shrink-0 text-muted" />
              <Slider
                aria-label="Thu phóng"
                minValue={1}
                maxValue={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(value) => zoomTo(Array.isArray(value) ? value[0] : value)}
                isDisabled={!picture}
                className="w-full"
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
              <MagnifierPlus aria-hidden className="size-4 shrink-0 text-muted" />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onCancel}>
              Huỷ
            </Button>
            <Button isPending={isSaving} isDisabled={!picture} onPress={save}>
              Lưu ảnh
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
