/**
 * Coordinate helpers for indoor floor plan overlays.
 *
 * Admin stores node/marker positions as % of the full <img> element bounding
 * box (including any object-contain letterbox). All overlays must use the same
 * reference — i.e. absolute inset-0 on the img element, not the content rect.
 */

export function clientToImagePercent(
  clientX: number,
  clientY: number,
  container: HTMLElement | null,
  img: HTMLImageElement | null
): { x: number; y: number } {
  // Use the img element rect directly — same reference as when coordinates were stored.
  const rect = img?.getBoundingClientRect() ?? container?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return { x: 50, y: 50 };
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
  };
}

/** Pin position % — same coordinate space as admin. */
export function pinStyleFromImagePercent(x: number, y: number) {
  return { left: `${x}%`, top: `${y}%` };
}
