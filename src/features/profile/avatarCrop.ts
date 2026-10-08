/**
 * The maths of the avatar cropper: an image drawn at `scale` with its top-left corner at `offset` inside a square
 * stage of `stage` px, the round avatar being the circle in that square.
 */

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };

/** The scale at which the image just covers the stage (zoom 1): its shorter side fills it. */
export function coverScale(image: Size, stage: number) {
  return Math.max(stage / image.width, stage / image.height);
}

/** The image centred on the stage. */
export function centeredOffset(image: Size, scale: number, stage: number): Offset {
  return { x: (stage - image.width * scale) / 2, y: (stage - image.height * scale) / 2 };
}

/** The offset moved back as little as needed for the image to cover the whole stage. */
export function clampOffset(offset: Offset, image: Size, scale: number, stage: number): Offset {
  return {
    x: Math.max(Math.min(offset.x, 0), stage - image.width * scale),
    y: Math.max(Math.min(offset.y, 0), stage - image.height * scale),
  };
}

/** The offset after zooming from one scale to another, the stage's `point` (its centre) staying on the same spot. */
export function zoomAround(
  offset: Offset,
  image: Size,
  from: number,
  to: number,
  stage: number,
  point: Offset = { x: stage / 2, y: stage / 2 },
): Offset {
  const ratio = to / from;
  return clampOffset(
    { x: point.x - (point.x - offset.x) * ratio, y: point.y - (point.y - offset.y) * ratio },
    image,
    to,
    stage,
  );
}

/** The square of the image the stage shows, in the image's own pixels. */
export function cropSource(offset: Offset, scale: number, stage: number) {
  return { x: (0 - offset.x) / scale, y: (0 - offset.y) / scale, size: stage / scale };
}
