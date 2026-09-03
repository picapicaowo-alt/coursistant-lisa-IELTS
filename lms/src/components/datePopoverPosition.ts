interface Rect { left: number; right: number; top: number; bottom: number }
interface Size { width: number; height: number }

const GAP = 8;
const EDGE = 12;

/** Keep the edited field unobscured, including short viewports and the mobile keyboard. */
export function datePopoverPosition(anchor: Rect, popover: Size, viewport: Rect) {
  const leftEdge = viewport.left + EDGE;
  const rightEdge = viewport.right - EDGE;
  const topEdge = viewport.top + EDGE;
  const bottomEdge = viewport.bottom - EDGE;
  const width = Math.min(popover.width, rightEdge - leftEdge);
  const fitLeft = (left: number) => Math.max(leftEdge, Math.min(left, rightEdge - width));
  const roomRight = rightEdge - anchor.right - GAP;
  if (roomRight >= width) {
    const maxHeight = Math.max(0, bottomEdge - topEdge);
    return {left: anchor.right + GAP, top: Math.max(topEdge, Math.min(anchor.top, bottomEdge - Math.min(popover.height, maxHeight))), maxHeight};
  }
  const below = Math.max(0, bottomEdge - anchor.bottom - GAP);
  const above = Math.max(0, anchor.top - GAP - topEdge);
  const placeBelow = below >= popover.height || below >= above;
  const maxHeight = placeBelow ? below : above;
  return {
    left: fitLeft(anchor.right - width),
    top: placeBelow ? anchor.bottom + GAP : anchor.top - GAP - Math.min(popover.height, maxHeight),
    maxHeight,
  };
}
