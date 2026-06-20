/**
 * Floor plan coordinate helpers.
 *
 * Positions are stored as 0–100 % of the map image element. Admin and Find My Way
 * share the same fixed-size fp-map-canvas (see index.css) so coordinates align.
 */

/** Set --fp-ar-w / --fp-ar-h on the canvas from a loaded floor plan image. */
export function setFloorPlanCanvasAspect(
  canvas: HTMLElement | null,
  img: HTMLImageElement | null
): void {
  if (!canvas || !img?.naturalWidth || !img?.naturalHeight) return;
  canvas.style.setProperty('--fp-ar-w', String(img.naturalWidth));
  canvas.style.setProperty('--fp-ar-h', String(img.naturalHeight));
}

export function clientToImagePercent(
  clientX: number,
  clientY: number,
  container: HTMLElement | null,
  img: HTMLImageElement | null
): { x: number; y: number } {
  const rect = img?.getBoundingClientRect() ?? container?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return { x: 50, y: 50 };
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
  };
}

export function pinStyleFromImagePercent(x: number, y: number) {
  return { left: `${x}%`, top: `${y}%` };
}

export function polylineFromPercents(points: Array<{ x: number; y: number }>): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
