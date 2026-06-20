/**
 * Student route map ÔÇö same DOM structure as admin IndoorNavGraphEditor.
 *
 * The floor plan image uses height:auto (no object-contain letterboxing).
 * This means the fp-map-canvas element IS the image content box ÔÇö no empty
 * horizontal/vertical strips.  x,y % coordinates therefore always map 1:1 to
 * actual floor-plan pixels regardless of the container width, so the path
 * rendered here EXACTLY matches the nodes placed in the admin Walking Paths
 * editor.
 */
import type { ReactNode } from 'react';
import {
  buildNavNodeSets,
  isEdgeVisibleOnFloorPlan,
  NAV_NODE_COLORS,
  type NavGraphEdgeLite,
  type NavGraphNodeLite,
} from '@utils/navGraphDisplay';

export interface FloorPlanPlaceMarker {
  markerId: string;
  navNodeId: string | null;
  label: string;
  x: number;
  y: number;
}

export interface RouteEndpointPin {
  x: number;
  y: number;
  label: string;
}

interface FloorPlanRouteMapProps {
  imageUrl: string;
  imageAlt: string;
  nodes: NavGraphNodeLite[];
  edges: NavGraphEdgeLite[];
  routePath: Array<{ x: number; y: number }>;
  routePathTraveled?: Array<{ x: number; y: number }>;
  placeMarkers?: FloorPlanPlaceMarker[];
  routeStart?: RouteEndpointPin | null;
  routeEnd?: RouteEndpointPin | null;
  children?: ReactNode;
}

export default function FloorPlanRouteMap({
  imageUrl,
  imageAlt,
  nodes,
  edges,
  routePath,
  routePathTraveled = [],
  placeMarkers = [],
  routeStart = null,
  routeEnd = null,
  children,
}: FloorPlanRouteMapProps) {
  const nodePos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const { placeNavNodeIds, pathNodeIds } = buildNavNodeSets(nodes);

  const visibleEdges = edges.filter((e) =>
    isEdgeVisibleOnFloorPlan(e, placeNavNodeIds, pathNodeIds)
  );

  const traveledPoints =
    routePathTraveled.length > 1
      ? routePathTraveled.map((p) => `${p.x},${p.y}`).join(' ')
      : '';
  const routePoints =
    routePath.length > 1 ? routePath.map((p) => `${p.x},${p.y}`).join(' ') : '';
  const progressPoint =
    traveledPoints && routePoints
      ? routePathTraveled[routePathTraveled.length - 1]
      : null;

  const hasEndpoints = routeStart || routeEnd;

  return (
    <div className="fp-map-panel path-only-mode">
      {hasEndpoints && (
        <div className="fp-route-endpoints-bar" aria-label="Route endpoints">
          {routeStart && (
            <div className="fp-route-endpoint-card fp-route-endpoint-start">
              <span className="fp-route-badge fp-route-badge-start" aria-hidden>A</span>
              <div className="fp-route-endpoint-text">
                <span className="fp-route-pin-kind">Start</span>
                <span className="fp-route-pin-name">{routeStart.label}</span>
              </div>
            </div>
          )}
          {routeStart && routeEnd && (
            <span className="fp-route-endpoints-arrow" aria-hidden>ÔåÆ</span>
          )}
          {routeEnd && (
            <div className="fp-route-endpoint-card fp-route-endpoint-end">
              <span className="fp-route-badge fp-route-badge-end" aria-hidden>B</span>
              <div className="fp-route-endpoint-text">
                <span className="fp-route-pin-kind">Destination</span>
                <span className="fp-route-pin-name">{routeEnd.label}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Same structure as admin fp-map-canvas: img + absolute-inset-0 SVG + pins */}
      <div className="fp-map-canvas fp-route-canvas">
        <img
          src={imageUrl}
          alt={imageAlt}
          draggable={false}
          className="fp-route-img"
        />

        {/* SVG overlay ÔÇö absolute inset-0, same coordinate space as admin */}
        <svg
          className="fp-map-overlay indoor-nav-edges"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {visibleEdges.map((edge) => {
            const from = nodePos.get(edge.fromNodeId);
            const to = nodePos.get(edge.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from.x} y1={from.y}
                x2={to.x}   y2={to.y}
                className="nav-edge"
              />
            );
          })}
          {traveledPoints && (
            <polyline className="nav-edge-traveled" fill="none" points={traveledPoints} />
          )}
          {routePoints && (
            <polyline className="nav-edge-test" fill="none" points={routePoints} />
          )}
        </svg>

        {/* Place markers */}
        {placeMarkers.map((p) => (
          <span
            key={p.markerId}
            className="nav-place-dot"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            title={p.label}
          />
        ))}

        {/* Route A / B pins */}
        {routeStart && (
          <span
            className="fp-route-dot fp-route-dot-start"
            style={{ left: `${routeStart.x}%`, top: `${routeStart.y}%` }}
            aria-label={`Start: ${routeStart.label}`}
          >
            A
          </span>
        )}
        {routeEnd && (
          <span
            className="fp-route-dot fp-route-dot-end"
            style={{ left: `${routeEnd.x}%`, top: `${routeEnd.y}%` }}
            aria-label={`Destination: ${routeEnd.label}`}
          >
            B
          </span>
        )}
        {progressPoint && (
          <span
            className="fp-route-progress-dot"
            style={{ left: `${progressPoint.x}%`, top: `${progressPoint.y}%` }}
            aria-label="Current position on route"
          />
        )}
        {children}
      </div>
    </div>
  );
}
