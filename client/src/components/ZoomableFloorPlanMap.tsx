import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';

interface ZoomableFloorPlanMapProps {
  children: ReactNode;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
  /** When set, "Fit path" zooms toward these 0-100% points. */
  focusPoints?: Array<{ x: number; y: number }>;
  /** When this value changes, the map auto-fits the path in view. */
  autoFitKey?: string | number;
  hint?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function ZoomableFloorPlanMap({
  children,
  className = '',
  minZoom = 1,
  maxZoom = 4,
  focusPoints = [],
  autoFitKey,
  hint = 'Scroll or pinch to zoom · drag to pan when zoomed',
}: ZoomableFloorPlanMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const setZoomClamped = useCallback(
    (next: number | ((z: number) => number)) => {
      setZoom((z) => {
        const raw = typeof next === 'function' ? next(z) : next;
        const clamped = clamp(raw, minZoom, maxZoom);
        if (clamped <= 1) setPan({ x: 0, y: 0 });
        return clamped;
      });
    },
    [minZoom, maxZoom]
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitToPath = useCallback(() => {
    if (focusPoints.length < 2) {
      setZoomClamped(1.75);
      return;
    }
    const xs = focusPoints.map((p) => p.x);
    const ys = focusPoints.map((p) => p.y);
    const spanX = Math.max(12, Math.max(...xs) - Math.min(...xs));
    const spanY = Math.max(12, Math.max(...ys) - Math.min(...ys));
    const span = Math.max(spanX, spanY);
    const targetZoom = clamp(95 / span, 2.2, maxZoom);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoomClamped(targetZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const offsetX = rect.width * (0.5 - cx / 100) * targetZoom;
    const offsetY = rect.height * (0.5 - cy / 100) * targetZoom;
    setZoom(targetZoom);
    setPan({ x: offsetX, y: offsetY });
  }, [focusPoints, maxZoom, setZoomClamped]);

  useEffect(() => {
    if (!autoFitKey || focusPoints.length < 2) return;
    const t = window.setTimeout(() => fitToPath(), 200);
    return () => window.clearTimeout(t);
  }, [autoFitKey, focusPoints.length, fitToPath]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setZoomClamped((z) => z + delta);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`fp-zoom-shell ${className}`.trim()}>
      <div className="fp-zoom-toolbar">
        <button type="button" className="fp-zoom-btn" onClick={() => setZoomClamped((z) => z + 0.25)} title="Zoom in">
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="fp-zoom-btn"
          onClick={() => setZoomClamped((z) => z - 0.25)}
          disabled={zoom <= minZoom}
          title="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button type="button" className="fp-zoom-btn" onClick={fitToPath} title="Fit path in view">
          <Maximize2 size={16} />
        </button>
        <button type="button" className="fp-zoom-btn" onClick={resetView} title="Reset zoom">
          <RotateCcw size={16} />
        </button>
        <span className="fp-zoom-label">{Math.round(zoom * 100)}%</span>
      </div>
      <p className="fp-zoom-hint">{hint}</p>
      <div
        ref={viewportRef}
        className={`fp-zoom-viewport ${zoom > 1 ? 'is-pannable' : ''}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="fp-zoom-stage"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
