import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Marker {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  building: { id: string; name: string };
}

interface Building {
  id: string;
  name: string;
  code: string;
  floors: number;
}

interface Props {
  markers: Marker[];
  buildings: Building[];
}

const TYPE_COLORS: Record<string, string> = {
  HALL: '#3b82f6',
  OFFICE: '#8b5cf6',
  LAB: '#10b981',
  AMENITY: '#f59e0b',
  ENTRANCE: '#ef4444',
};

function createIcon(color: string) {
  return L.divIcon({
    className: 'map-marker-icon',
    html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function MapPreview({ markers, buildings: _buildings }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
    }

    const map = L.map(mapRef.current).setView([7.29, 80.63], 16);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const markerGroup = L.layerGroup().addTo(map);

    markers.forEach((m) => {
      const color = TYPE_COLORS[m.type] || '#6b7280';
      const icon = createIcon(color);
      const latlng: [number, number] = [m.y, m.x];

      L.marker(latlng, { icon })
        .addTo(markerGroup)
        .bindPopup(`
          <div style="font-size:13px">
            <strong>${m.label}</strong><br/>
            <span style="color:${color};font-weight:600">${m.type}</span><br/>
            <span style="color:#6b7280">${m.building.name}</span><br/>
            <span style="color:#9ca3af;font-size:11px">(${m.x.toFixed(4)}, ${m.y.toFixed(4)})</span>
          </div>
        `);
    });

    if (markers.length > 0) {
      const latlngs = markers.map((m) => [m.y, m.x] as [number, number]);
      map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [markers]);

  return (
    <div className="map-preview-container">
      {markers.length === 0 ? (
        <div className="empty-text">No markers to display. Add markers to see them on the map.</div>
      ) : (
        <>
          <div className="map-legend">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="legend-item">
                <span className="legend-dot" style={{ background: color }} />
                {type}
              </span>
            ))}
          </div>
          <div ref={mapRef} className="map-leaflet" />
        </>
      )}
    </div>
  );
}
