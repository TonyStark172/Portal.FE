/**
 * Whether a tap `reach` px from the control's centre (left, right, above, below) still lands on the control: its
 * effective hit area, which may be larger than its box (a pseudo-element hit area belongs to the control).
 */
export function hitsAround(control: Element, reach: number): boolean {
  const box = control.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return [
    [x - reach, y],
    [x + reach, y],
    [x, y - reach],
    [x, y + reach],
  ].every(([px, py]) => {
    const hit = document.elementFromPoint(px, py);
    return hit !== null && control.contains(hit);
  });
}
