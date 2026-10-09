import { describe, expect, test } from "vitest";
import { centeredOffset, clampOffset, coverScale, cropSource, zoomAround } from "./avatarCrop";

// A 800×400 image on a 300 px stage: at zoom 1 it is 600×300, its height filling the stage.
const image = { width: 800, height: 400 };
const stage = 300;
const scale = coverScale(image, stage);

describe("cropping an avatar", () => {
  test("starts with the image just covering the stage, centred", () => {
    expect(scale).toBe(0.75);
    expect(centeredOffset(image, scale, stage)).toEqual({ x: -150, y: 0 });
  });

  test("never lets the image leave part of the stage empty", () => {
    expect(clampOffset({ x: 40, y: 10 }, image, scale, stage)).toEqual({ x: 0, y: 0 });
    expect(clampOffset({ x: -500, y: -30 }, image, scale, stage)).toEqual({ x: -300, y: 0 });
  });

  test("zooms around the centre of the stage", () => {
    // Twice as large: the stage's centre (150, 150) shows the same point of the image before and after.
    const before = centeredOffset(image, scale, stage);
    const after = zoomAround(before, image, scale, scale * 2, stage);
    const pointBefore = { x: (150 - before.x) / scale, y: (150 - before.y) / scale };
    const pointAfter = { x: (150 - after.x) / (scale * 2), y: (150 - after.y) / (scale * 2) };
    expect(pointAfter).toEqual(pointBefore);
  });

  test("crops the part of the image the stage shows, in the image's pixels", () => {
    expect(cropSource({ x: -150, y: 0 }, scale, stage)).toEqual({ x: 200, y: 0, size: 400 });
    expect(cropSource({ x: -300, y: -150 }, scale * 2, stage)).toEqual({ x: 200, y: 100, size: 200 });
  });
});
