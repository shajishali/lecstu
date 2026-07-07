import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapContainer,
  Marker,
  Popup,
  ImageOverlay,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api, { showApiErrorToast } from '@services/api';
import { useAuthStore } from '@store/authStore';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';

// Fix Leaflet default icon in bundled env
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
import { showToast } from '@components/Toast';
import {
  formatMarkerTypeLabel,
  MAP_MARKER_TYPES,
  MARKER_TYPE_COLORS,
  markerTypeLinksToHall,
  markerTypeLinksToOffice,
} from '@constants/mapMarkerTypes';
import { Search, X, Pencil, Trash2, Navigation, MapPin, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

// Faculty of Computing and Technology, University of Kelaniya (exact location)
const CAMPUS_CENTER: [number, number] = [6.9701646, 79.9051604];
const DEFAULT_ZOOM = 16;
const MIN_ZOOM = 14;
const MAX_ZOOM = 20;

const HALL_STATUS_COLORS = {
  free: '#22c55e',
  occupied: '#ef4444',
};

interface MapBuilding {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  floors: number;
  floorPlans: { id: string; floor: number; imagePath: string; bounds: unknown }[];
}

interface MapMarkerItem {
  id: string;
  buildingId: string;
  floor: number;
  type: string;
  label: string;
  x: number;
  y: number;
  building: { id: string; name: string; latitude: number; longitude: number };
  hall: { id: string; name: string } | null;
  office: {
    id: string;
    roomNumber: string;
    lecturer: {
      id: string;
      firstName: string;
      lastName: string;
      department?: { name: string } | null;
    };
  } | null;
}

interface MapSearchResult {
  kind: 'building' | 'hall' | 'office' | 'marker';
  id: string;
  label: string;
  sublabel?: string;
  latitude: number;
  longitude: number;
  buildingId?: string;
  floor?: number;
  markerId?: string;
  hallId?: string;
  lecturerId?: string;
}

type RouteStepItem = string | { instruction: string; floor?: number };

interface GuidedRouteData {
  found: boolean;
  destinationLabel?: string;
  startLabel?: string;
  message?: string;
  steps?: RouteStepItem[];
  polyline?: { x: number; y: number; floor: number; label?: string }[];
  building?: { id: string; name: string; code: string };
  distanceMeters?: number;
  estimatedMinutes?: number;
  pathfindingAlgorithm?: string;
}

function createPinIcon(color: string, label: string, size = 18) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div><span style="margin-top:2px;font-size:10px;font-weight:700;color:${color};text-shadow:0 0 2px white">${label}</span></div>`,
    iconSize: [size + 8, size + 20],
    iconAnchor: [(size + 8) / 2, size / 2],
  });
}

function routeStepText(step: RouteStepItem): string {
  if (typeof step === 'string') return step;
  return step.instruction;
}

function routeStepFloor(step: RouteStepItem): number | undefined {
  if (typeof step === 'string') return undefined;
  return step.floor;
}

function percentToLatLng(
  x: number,
  y: number,
  bounds: [[number, number], [number, number]]
): [number, number] {
  const [[south, west], [north, east]] = bounds;
  const lat = south + ((north - south) * y) / 100;
  const lng = west + ((east - west) * x) / 100;
  return [lat, lng];
}

interface LiveStatus {
  hallStatus: Record<string, { free: boolean; nextSlot?: { startTime: string; endTime: string } }>;
  officeStatus: Record<string, { available: boolean }>;
}

function createIcon(color: string, size = 14) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

interface DropdownData {
  buildings: { id: string; name: string; code: string; floors: number }[];
  halls: { id: string; name: string }[];
  offices: { id: string; roomNumber: string; lecturer: { firstName: string; lastName: string } }[];
}

const OFFSET = 0.00003;

function MapController({
  mapRef,
  flyTarget,
  fitBoundsTarget,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>;
  flyTarget: { lat: number; lng: number; zoom?: number } | null;
  fitBoundsTarget: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
  useEffect(() => {
    if (fitBoundsTarget) {
      map.fitBounds(fitBoundsTarget, { padding: [48, 48], maxZoom: 20, animate: true });
      const t = setTimeout(() => map.invalidateSize(), 200);
      return () => clearTimeout(t);
    }
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lng], flyTarget.zoom ?? 17, { duration: 0.5 });
    }
  }, [flyTarget, fitBoundsTarget, map]);
  return null;
}

/** Leaflet often renders at 0×0 when the map panel is in a grid/flex layout - remeasure when shown. */
function MapInvalidateSize({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 400);
    const onResize = () => fix();
    window.addEventListener('resize', onResize);
    const parent = map.getContainer()?.parentElement;
    let ro: ResizeObserver | undefined;
    if (parent && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fix());
      ro.observe(parent);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [active, map]);
  return null;
}

function MapClickHandler({
  editMode,
  selectedBuildingId,
  selectedFloor,
  buildings,
  activeFloorPlan,
  getMarkerBounds,
  onPlaceMarker,
}: {
  editMode: boolean;
  selectedBuildingId: string | null;
  selectedFloor: number;
  buildings: MapBuilding[];
  activeFloorPlan: { floor: number; bounds: unknown } | undefined;
  getMarkerBounds: (b: unknown) => [[number, number], [number, number]] | null;
  onPlaceMarker: (buildingId: string, floor: number, x: number, y: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (!editMode || !selectedBuildingId) return;
      const building = buildings.find((b) => b.id === selectedBuildingId);
      if (!building) return;

      const { lat, lng } = e.latlng;
      const bounds = activeFloorPlan ? getMarkerBounds(activeFloorPlan.bounds) : null;

      let x: number;
      let y: number;
      if (bounds) {
        const [[south, west], [north, east]] = bounds;
        y = ((lat - south) / (north - south)) * 100;
        x = ((lng - west) / (east - west)) * 100;
      } else {
        y = 50 + (lat - building.latitude) / OFFSET;
        x = 50 + (lng - building.longitude) / OFFSET;
      }
      onPlaceMarker(selectedBuildingId, selectedFloor, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    },
  });
  return null;
}

export default function CampusMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Record<string, unknown>>({});

  const [buildings, setBuildings] = useState<MapBuilding[]>([]);
  const [markers, setMarkers] = useState<MapMarkerItem[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<MapSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [fitBoundsTarget, setFitBoundsTarget] = useState<[[number, number], [number, number]] | null>(
    null
  );
  const [highlightMarkerId, setHighlightMarkerId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [dropdowns, setDropdowns] = useState<DropdownData | null>(null);
  const [placeMarkerForm, setPlaceMarkerForm] = useState<{
    buildingId: string;
    floor: number;
    x: number;
    y: number;
  } | null>(null);
  const [markerForm, setMarkerForm] = useState({
    type: 'HALL',
    label: '',
    hallId: '',
    officeId: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteMarkerTarget, setDeleteMarkerTarget] = useState<MapMarkerItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mobilePopupMarker, setMobilePopupMarker] = useState<MapMarkerItem | null>(null);
  const [guidedRoute, setGuidedRoute] = useState<GuidedRouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const floorPlans = selectedBuilding?.floorPlans || [];
  const activeFloorPlan = floorPlans.find((fp) => fp.floor === selectedFloor);
  const getMarkerBounds = useCallback((bounds: unknown): [[number, number], [number, number]] | null => {
    let raw = bounds;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    if (!raw || !Array.isArray(raw)) return null;
    const b = raw as number[][];
    if (b.length >= 2 && b[0].length >= 2 && b[1].length >= 2) {
      return [b[0] as [number, number], b[1] as [number, number]];
    }
    return null;
  }, []);

  const indoorBounds = activeFloorPlan ? getMarkerBounds(activeFloorPlan.bounds) : null;
  const isIndoorView = Boolean(selectedBuildingId && indoorBounds);

  const resolveFloorWithBounds = useCallback(
    (plans: MapBuilding['floorPlans'], preferredFloor?: number): number => {
      if (preferredFloor !== undefined) {
        const preferred = plans.find((p) => p.floor === preferredFloor);
        if (preferred && getMarkerBounds(preferred.bounds)) return preferredFloor;
      }
      const firstWithBounds = plans.find((p) => getMarkerBounds(p.bounds));
      if (firstWithBounds) return firstWithBounds.floor;
      return plans[0]?.floor ?? 0;
    },
    [getMarkerBounds]
  );

  const openBuildingFloorView = useCallback(
    (b: MapBuilding, preferredFloor?: number) => {
      setSelectedBuildingId(b.id);
      const plans = b.floorPlans || [];
      const floor = resolveFloorWithBounds(plans, preferredFloor);
      setSelectedFloor(floor);

      const fp = plans.find((p) => p.floor === floor) ?? plans[0];
      const bounds = fp ? getMarkerBounds(fp.bounds) : null;

      if (bounds) {
        setFitBoundsTarget(bounds);
        setFlyTarget(null);
      } else {
        setFitBoundsTarget(null);
        setFlyTarget(null);
        if (plans.length === 0) {
          showToast('info', `No floor maps for ${b.name} yet. Upload in Admin → Buildings.`);
        } else {
          showToast('info', `Set map bounds for ${floorLabel(floor)} in Admin → Buildings.`);
        }
      }

      mapRef.current?.closePopup();
    },
    [getMarkerBounds, resolveFloorWithBounds]
  );

  useEffect(() => {
    if (!selectedBuildingId || !activeFloorPlan) return;
    const bounds = getMarkerBounds(activeFloorPlan.bounds);
    if (bounds) {
      setFitBoundsTarget(bounds);
    }
  }, [selectedBuildingId, selectedFloor, activeFloorPlan, getMarkerBounds]);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await api.get('/map/buildings');
      setBuildings(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load buildings');
    }
  }, []);

  const fetchMarkers = useCallback(
    async (buildingId?: string, floor?: number, types?: string[]) => {
      try {
        const params: Record<string, string> = {};
        if (buildingId) params.buildingId = buildingId;
        if (floor !== undefined) params.floor = String(floor);
        if (types?.length) params.type = types.join(',');
        const res = await api.get('/map/markers', { params });
        setMarkers(res.data.data || []);
      } catch (err) {
        showApiErrorToast(err, 'Failed to load markers');
      }
    },
    []
  );

  const fetchLiveStatus = useCallback(async () => {
    try {
      const res = await api.get('/map/live-status');
      setLiveStatus(res.data.data || { hallStatus: {}, officeStatus: {} });
    } catch {
      setLiveStatus({ hallStatus: {}, officeStatus: {} });
    }
  }, []);

  const fetchDropdowns = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/admin/markers/dropdowns');
      setDropdowns(res.data.data);
    } catch { /* ignore */ }
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchBuildings(), fetchMarkers(), fetchLiveStatus(), fetchDropdowns()]).finally(() =>
      setLoading(false)
    );
  }, [fetchBuildings, fetchMarkers, fetchLiveStatus, fetchDropdowns]);

  useEffect(() => {
    if (selectedBuildingId) {
      fetchMarkers(selectedBuildingId, selectedFloor);
    } else {
      setMarkers([]);
    }
  }, [selectedBuildingId, selectedFloor, fetchMarkers]);

  useEffect(() => {
    const t = setTimeout(fetchLiveStatus, 60000);
    return () => clearTimeout(t);
  }, [fetchLiveStatus]);

  useEffect(() => {
    if (highlightMarkerId) {
      const ref = markerRefs.current[highlightMarkerId] as unknown;
      const marker = ref && typeof ref === 'object' && 'leafletElement' in ref
        ? (ref as { leafletElement: L.Marker }).leafletElement
        : ref as L.Marker | undefined;
      marker?.openPopup?.();
      const t = setTimeout(() => setHighlightMarkerId(null), 500);
      return () => clearTimeout(t);
    }
  }, [highlightMarkerId]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout>>(0);
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/map/search', { params: { q: searchQuery } });
        setSearchResults(res.data.data || []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery]);

  const loadGuidedRoute = useCallback(async (r: MapSearchResult) => {
    if (!r.buildingId) return;
    if (r.kind === 'building') {
      setGuidedRoute(null);
      return;
    }
    setRouteLoading(true);
    setGuidedRoute(null);
    setGuideStepIndex(0);
    try {
      const params: Record<string, string | number> = { buildingId: r.buildingId };
      if (r.floor !== undefined) params.floor = r.floor;
      if (r.markerId) params.toMarkerId = r.markerId;
      else if (r.kind === 'hall') params.toHallId = r.id;
      else if (r.hallId) params.toHallId = r.hallId;
      else return;

      try {
        const sessionRes = await api.get('/indoor-nav/session/active', {
          params: { buildingId: r.buildingId },
        });
        const currentNodeId = sessionRes.data.data?.currentNodeId as string | undefined;
        if (currentNodeId) params.fromNodeId = currentNodeId;
      } catch {
        /* no active session */
      }

      const res = await api.get('/map/nav-route', { params });
      const data = res.data.data as GuidedRouteData;
      if (data.found) {
        setGuidedRoute(data);
        showToast('success', `Walking route to ${data.destinationLabel || r.label}`);
      } else {
        setGuidedRoute(data);
        showToast('info', data.message || 'Walking paths not set up yet. Ask admin to draw routes.');
      }
    } catch (err) {
      showApiErrorToast(err, 'Could not calculate indoor route');
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const showLocationOnMap = useCallback(
    (r: MapSearchResult) => {
      if (r.buildingId) {
        const b = buildings.find((x) => x.id === r.buildingId);
        if (b) openBuildingFloorView(b, r.floor);
      }
      if (r.markerId) setHighlightMarkerId(r.markerId);
    },
    [buildings, openBuildingFloorView]
  );

  const clearLocationSelection = useCallback(() => {
    setSelectedLocation(null);
    setGuidedRoute(null);
    setGuideStepIndex(0);
    setHighlightMarkerId(null);
    setSearchQuery('');
    setSelectedBuildingId(null);
    setFitBoundsTarget(null);
  }, []);

  const handleSearchSelect = useCallback(
    (r: MapSearchResult) => {
      setSelectedLocation(r);
      setSearchQuery(r.label);
      setSearchOpen(false);
      setSearchResults([]);
      setGuidedRoute(null);
      setGuideStepIndex(0);
      showLocationOnMap(r);
    },
    [showLocationOnMap]
  );

  const handleGuideMe = useCallback(() => {
    if (!selectedLocation) return;
    void loadGuidedRoute(selectedLocation);
  }, [selectedLocation, loadGuidedRoute]);

  const routeLatLngs = useMemo(() => {
    if (!guidedRoute?.found || !guidedRoute.polyline?.length || !activeFloorPlan) return [];
    const bounds = getMarkerBounds(activeFloorPlan.bounds);
    if (!bounds) return [];
    return guidedRoute.polyline
      .filter((p) => p.floor === selectedFloor)
      .map((p) => percentToLatLng(p.x, p.y, bounds));
  }, [guidedRoute, activeFloorPlan, selectedFloor, getMarkerBounds]);

  const activeRouteLatLngs = useMemo(() => {
    if (routeLatLngs.length < 2 || !guidedRoute?.steps?.length) return routeLatLngs;
    const progress = guideStepIndex / Math.max(1, guidedRoute.steps.length - 1);
    const count = Math.max(2, Math.ceil(routeLatLngs.length * progress));
    return routeLatLngs.slice(0, count);
  }, [routeLatLngs, guideStepIndex, guidedRoute?.steps?.length]);

  const routeStartEnd = useMemo(() => {
    if (routeLatLngs.length === 0) return { start: null as [number, number] | null, end: null as [number, number] | null };
    return { start: routeLatLngs[0], end: routeLatLngs[routeLatLngs.length - 1] };
  }, [routeLatLngs]);

  useEffect(() => {
    if (!guidedRoute?.found || !guidedRoute.steps?.length) return;
    const step = guidedRoute.steps[guideStepIndex];
    const floor = routeStepFloor(step);
    if (floor !== undefined && floor !== selectedFloor) {
      setSelectedFloor(floor);
    }
  }, [guideStepIndex, guidedRoute, selectedFloor]);

  useEffect(() => {
    if (searchParams.get('today') === '1') {
      navigate(`/map/guide?${searchParams.toString()}`, { replace: true });
      return;
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    const guideLabel =
      searchParams.get('guide') || searchParams.get('destination') || searchParams.get('q');
    const buildingId = searchParams.get('buildingId');
    const markerId = searchParams.get('markerId');
    const hallId = searchParams.get('hallId');
    const floor = searchParams.get('floor');
    if (!buildingId || (!markerId && !hallId) || buildings.length === 0) return;
    const b = buildings.find((x) => x.id === buildingId);
    if (!b) return;
    const floorNum = floor != null ? parseInt(floor, 10) : undefined;
    openBuildingFloorView(b, floorNum);
    const fakeResult: MapSearchResult = {
      kind: markerId ? 'marker' : 'hall',
      id: markerId || hallId || '',
      label: guideLabel || 'Destination',
      latitude: b.latitude,
      longitude: b.longitude,
      buildingId,
      floor: floorNum,
      markerId: markerId || undefined,
      hallId: hallId || undefined,
    };
    setSelectedLocation(fakeResult);
    setSearchQuery(fakeResult.label);
    void loadGuidedRoute(fakeResult);
    setSearchParams({}, { replace: true });
  }, [buildings, loadGuidedRoute, openBuildingFloorView, searchParams, setSearchParams]);

  const deepLinkSearchHandled = useRef(false);
  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (!q || loading || buildings.length === 0 || deepLinkSearchHandled.current) return;
    deepLinkSearchHandled.current = true;
    setSearchQuery(q);
    void (async () => {
      try {
        const res = await api.get('/map/search', { params: { q } });
        const results: MapSearchResult[] = res.data.data || [];
        if (results.length > 0) {
          const r = results[0];
          setSelectedLocation(r);
          showLocationOnMap(r);
          void loadGuidedRoute(r);
        }
      } catch {
        showToast('info', `No results for "${q}". Try another room or hall name.`);
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
  }, [
    loading,
    buildings,
    searchParams,
    showLocationOnMap,
    loadGuidedRoute,
    setSearchParams,
  ]);

  const getMarkerPositionOnFloor = (
    m: MapMarkerItem,
    bounds: [[number, number], [number, number]]
  ): [number, number] => {
    const [[south, west], [north, east]] = bounds;
    const lat = south + ((north - south) * m.y) / 100;
    const lng = west + ((east - west) * m.x) / 100;
    return [lat, lng];
  };

  const visibleMarkers = isIndoorView
    ? markers.filter((m) => m.building.id === selectedBuildingId && m.floor === selectedFloor)
    : [];

  const handlePlaceMarker = useCallback((buildingId: string, floor: number, x: number, y: number) => {
    setPlaceMarkerForm({ buildingId, floor, x, y });
    setMarkerForm({ type: 'HALL', label: '', hallId: '', officeId: '' });
  }, []);

  const handleSaveNewMarker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeMarkerForm) return;
    setSaving(true);
    try {
      await api.post('/admin/markers', {
        buildingId: placeMarkerForm.buildingId,
        floor: placeMarkerForm.floor,
        type: markerForm.type,
        label: markerForm.label,
        x: placeMarkerForm.x,
        y: placeMarkerForm.y,
        hallId: markerForm.hallId || null,
        officeId: markerForm.officeId || null,
      });
      showToast('success', 'Marker created');
      setPlaceMarkerForm(null);
      fetchMarkers(selectedBuildingId || undefined, selectedFloor);
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMarker = async () => {
    if (!deleteMarkerTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/markers/${deleteMarkerTarget.id}`);
      showToast('success', 'Marker deleted');
      setDeleteMarkerTarget(null);
      setMobilePopupMarker(null);
      fetchMarkers(selectedBuildingId || undefined, selectedFloor);
    } catch (err) {
      showApiErrorToast(err, 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkerDragEnd = useCallback(
    async (m: MapMarkerItem, e: L.LeafletEvent) => {
      const marker = (e as L.DragEndEvent).target;
      const { lat, lng } = marker.getLatLng();
      const building = m.building;
      const bounds = activeFloorPlan ? getMarkerBounds(activeFloorPlan.bounds) : null;

      let x: number;
      let y: number;
      if (bounds) {
        const [[south, west], [north, east]] = bounds;
        y = ((lat - south) / (north - south)) * 100;
        x = ((lng - west) / (east - west)) * 100;
      } else {
        y = 50 + (lat - building.latitude) / OFFSET;
        x = 50 + (lng - building.longitude) / OFFSET;
      }
      try {
        await api.patch(`/admin/markers/${m.id}`, { x, y });
        setMarkers((prev) =>
          prev.map((mr) => (mr.id === m.id ? { ...mr, x, y } : mr))
        );
      } catch (err) {
        showApiErrorToast(err, 'Failed to update position');
      }
    },
    [activeFloorPlan, getMarkerBounds]
  );

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading campus map...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campus Map</h1>
          <p className="mt-0.5 text-slate-500">Search for a room, then view it on the map and tap Guide me</p>
        </div>
        <Link
          to="/map/scan"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-[var(--color-primary)]"
        >
          <QrCode size={16} />
          Scan QR location
        </Link>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <input
                type="checkbox"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Pencil size={16} className="text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Edit mode</span>
            </label>
            {editMode && !selectedBuildingId && (
              <span className="text-xs text-amber-600">Select a building, then click the map to place</span>
            )}
          </div>
        )}
      </div>

      <div className="campus-map-body">
        <aside className="campus-map-guide-panel guided-steps-panel lg:!max-w-none">
          <div className="relative">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Search location</label>
            <div className="flex rounded-lg border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 focus-within:ring-[var(--color-primary)]">
              <Search size={18} className="ml-3 shrink-0 self-center text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) setSearchOpen(true);
                }}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                placeholder="e.g. ELV ROOM, Lecture Theatre…"
                className="flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
                aria-label="Search faculty location"
              />
              {searchLoading && (
                <div className="mr-3 flex items-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
                </div>
              )}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {searchResults.map((r) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-0"
                    onClick={() => handleSearchSelect(r)}
                  >
                    <span className="font-medium text-slate-900">{r.label}</span>
                    {r.sublabel && <span className="text-xs text-slate-500">{r.sublabel}</span>}
                  </button>
                ))}
              </div>
            )}
            {searchOpen && searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                No locations found.
              </div>
            )}
          </div>

          {selectedLocation ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-2">
                <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{selectedLocation.label}</p>
                  {selectedLocation.sublabel && (
                    <p className="text-xs text-slate-500">{selectedLocation.sublabel}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedLocation.kind !== 'building' && (
                  <button
                    type="button"
                    onClick={handleGuideMe}
                    disabled={routeLoading}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                  >
                    <Navigation size={16} />
                    {routeLoading ? 'Guiding…' : 'Guide me'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearLocationSelection}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Search for a hall, lab, or office. The map on the left updates when you pick a result.
            </p>
          )}

          {routeLoading && (
            <div className="flex items-center gap-2 text-sm text-emerald-800">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
              Calculating walking directions…
            </div>
          )}

          {!routeLoading && guidedRoute?.found && guidedRoute.steps && guidedRoute.steps.length > 0 && (
            <>
              <p className="guided-step-counter">
                Step {guideStepIndex + 1} of {guidedRoute.steps.length}
              </p>
              <p className="guided-current-step">{routeStepText(guidedRoute.steps[guideStepIndex])}</p>
              {(guidedRoute.distanceMeters != null || guidedRoute.estimatedMinutes != null) && (
                <p className="mb-2 text-xs text-slate-500">
                  {guidedRoute.distanceMeters != null && `~${guidedRoute.distanceMeters} m`}
                  {guidedRoute.distanceMeters != null && guidedRoute.estimatedMinutes != null && ' · '}
                  {guidedRoute.estimatedMinutes != null && `~${guidedRoute.estimatedMinutes} min walk`}
                </p>
              )}
              <ol className="guided-step-list max-h-[min(40vh,280px)]">
                {guidedRoute.steps.map((step, i) => (
                  <li
                    key={i}
                    className={i === guideStepIndex ? 'active' : ''}
                    onClick={() => setGuideStepIndex(i)}
                  >
                    <span className="guided-step-num">{i + 1}</span>
                    {routeStepText(step)}
                  </li>
                ))}
              </ol>
              {guidedRoute.steps.length > 1 && (
                <div className="guided-step-nav">
                  <button
                    type="button"
                    disabled={guideStepIndex <= 0}
                    onClick={() => setGuideStepIndex((i) => Math.max(0, i - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={guideStepIndex >= guidedRoute.steps.length - 1}
                    onClick={() =>
                      setGuideStepIndex((i) => Math.min(guidedRoute.steps!.length - 1, i + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              )}
              <button
                type="button"
                className="text-xs font-medium text-emerald-700 underline"
                onClick={() => {
                  setGuidedRoute(null);
                  setGuideStepIndex(0);
                }}
              >
                Clear route
              </button>
            </>
          )}

          {!routeLoading && guidedRoute && !guidedRoute.found && (
            <p className="guided-error">{guidedRoute.message}</p>
          )}
        </aside>

        <div className="campus-map-canvas-wrap">
        {isIndoorView && activeFloorPlan && indoorBounds && (
          <img
            src={
              activeFloorPlan.imagePath.startsWith('/')
                ? `${window.location.origin}${activeFloorPlan.imagePath}`
                : activeFloorPlan.imagePath
            }
            alt={floorLabel(selectedFloor)}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
          />
        )}
        {!isIndoorView && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-100 px-6 text-center">
            <Search size={32} className="text-slate-300" />
            <p className="text-sm font-medium text-slate-700">
              {selectedLocation ? 'Floor plan not available for this building.' : 'Search for a location above'}
            </p>
            <p className="max-w-md text-xs text-slate-500">
              {selectedLocation
                ? 'Try another room or ask an administrator to upload the indoor map.'
                : 'Find a hall, lab, or office, then use Guide me for walking directions.'}
            </p>
          </div>
        )}
        <MapContainer
          center={CAMPUS_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={isIndoorView ? 17 : MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          maxBounds={indoorBounds ?? undefined}
          maxBoundsViscosity={isIndoorView ? 1 : 0}
          className={`campus-map-indoor relative z-[1] h-full w-full ${!isIndoorView ? 'opacity-0' : ''}`}
          scrollWheelZoom
        >
          <MapController mapRef={mapRef} flyTarget={flyTarget} fitBoundsTarget={fitBoundsTarget} />
          <MapInvalidateSize active={isIndoorView} />
          {isAdmin && editMode && isIndoorView && (
            <MapClickHandler
              editMode={editMode}
              selectedBuildingId={selectedBuildingId}
              selectedFloor={selectedFloor}
              buildings={buildings}
              activeFloorPlan={activeFloorPlan}
              getMarkerBounds={getMarkerBounds}
              onPlaceMarker={handlePlaceMarker}
            />
          )}

          {activeFloorPlan && (() => {
            const bounds = getMarkerBounds(activeFloorPlan.bounds);
            if (!bounds) return null;
            const imageUrl = activeFloorPlan.imagePath.startsWith('/')
              ? `${window.location.origin}${activeFloorPlan.imagePath}`
              : activeFloorPlan.imagePath;
            return <ImageOverlay url={imageUrl} bounds={bounds} opacity={0.92} zIndex={250} />;
          })()}

          {routeLatLngs.length > 1 && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: '#cbd5e1', weight: 4, opacity: 0.7, dashArray: '6 8' }}
            />
          )}

          {activeRouteLatLngs.length > 1 && (
            <Polyline
              positions={activeRouteLatLngs}
              pathOptions={{ color: '#ca8a04', weight: 6, opacity: 0.95 }}
            />
          )}

          {routeStartEnd.start && (
            <Marker position={routeStartEnd.start} icon={createPinIcon('#16a34a', 'Start')} zIndexOffset={600} />
          )}
          {routeStartEnd.end && (
            <Marker position={routeStartEnd.end} icon={createPinIcon('#dc2626', 'Dest')} zIndexOffset={600} />
          )}

          {isIndoorView && (
          <MarkerClusterGroup>
          {visibleMarkers.map((m) => {
            const baseColor = MARKER_TYPE_COLORS[m.type] || '#6b7280';
            const hallStatusEntry = m.hall && liveStatus ? liveStatus.hallStatus[m.hall.id] : null;
            const hallColor =
              markerTypeLinksToHall(m.type) && hallStatusEntry
                ? hallStatusEntry.free
                  ? HALL_STATUS_COLORS.free
                  : HALL_STATUS_COLORS.occupied
                : baseColor;

            const color = hallColor;
            const bounds = indoorBounds!;
            const pos = getMarkerPositionOnFloor(m, bounds);

            const officeStatusEntry =
              m.office && liveStatus ? liveStatus.officeStatus[m.office.id] : null;

            const linkedInfo = m.hall
              ? `Hall: ${m.hall.name}`
              : m.office
                ? `Office: ${m.office.roomNumber} - ${m.office.lecturer.firstName} ${m.office.lecturer.lastName}`
                : null;

            const popupContent = (
              <div className="min-w-[180px]">
                <strong className="text-base">{m.label}</strong>
                <p className="mt-1 text-xs font-medium" style={{ color: baseColor }}>
                  {m.type}
                </p>
                <p className="text-sm text-slate-600">
                  {m.building.name}, {floorLabel(m.floor)}
                </p>
                {linkedInfo && (
                  <p className="mt-1 text-xs text-slate-500">{linkedInfo}</p>
                )}

                {markerTypeLinksToHall(m.type) && hallStatusEntry && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p
                      className={`text-xs font-medium ${
                        hallStatusEntry.free ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {hallStatusEntry.free ? '🟢 Free now' : '🔴 Occupied now'}
                    </p>
                    {!hallStatusEntry.free && hallStatusEntry.nextSlot && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Next available: {hallStatusEntry.nextSlot.startTime}-
                        {hallStatusEntry.nextSlot.endTime}
                      </p>
                    )}
                    {hallStatusEntry.free && hallStatusEntry.nextSlot && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Until {hallStatusEntry.nextSlot.endTime}
                      </p>
                    )}
                  </div>
                )}

                {m.type === 'OFFICE' && m.office && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-xs text-slate-600">
                      {m.office.lecturer.firstName} {m.office.lecturer.lastName}
                      {m.office.lecturer.department?.name &&
                        ` • ${m.office.lecturer.department.name}`}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-medium ${
                        officeStatusEntry?.available ? 'text-green-600' : 'text-slate-500'
                      }`}
                    >
                      {officeStatusEntry?.available
                        ? 'Available for appointments'
                        : 'Currently in a meeting'}
                    </p>
                    <button
                      type="button"
                      className="mt-2 w-full rounded px-2 py-1.5 text-xs text-white [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                      onClick={() => navigate(`/appointments/book/${m.office!.lecturer.id}`)}
                    >
                      Book Appointment
                    </button>
                  </div>
                )}

                {editMode && isAdmin && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 hover:bg-red-100"
                      onClick={() => {
                        setDeleteMarkerTarget(m);
                        setMobilePopupMarker(null);
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );

            return (
              <Marker
                key={m.id}
                position={pos}
                icon={createIcon(color)}
                draggable={editMode && isAdmin}
                ref={(el) => {
                  if (el) markerRefs.current[m.id] = el;
                }}
                eventHandlers={{
                  ...(editMode && isAdmin ? { dragend: (e) => handleMarkerDragEnd(m, e) } : {}),
                  click: () => isMobile && setMobilePopupMarker(m),
                }}
              >
                {!isMobile && <Popup>{popupContent}</Popup>}
              </Marker>
            );
          })}
          </MarkerClusterGroup>
          )}
        </MapContainer>
        </div>
      </div>

      {/* Place new marker modal (admin edit mode) */}
      <Modal
        open={!!placeMarkerForm}
        onClose={() => setPlaceMarkerForm(null)}
        title="Place new marker"
        width="420px"
      >
        {placeMarkerForm && dropdowns && (
          <form onSubmit={handleSaveNewMarker} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select
                value={markerForm.type}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, type: e.target.value, hallId: '', officeId: '' })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {MAP_MARKER_TYPES.map((t) => (
                  <option key={t} value={t}>{formatMarkerTypeLabel(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Label</label>
              <input
                value={markerForm.label}
                onChange={(e) => setMarkerForm({ ...markerForm, label: e.target.value })}
                placeholder="e.g. Main Entrance"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {markerTypeLinksToHall(markerForm.type) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Linked Hall</label>
                <select
                  value={markerForm.hallId}
                  onChange={(e) => setMarkerForm({ ...markerForm, hallId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {dropdowns.halls.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
            {markerTypeLinksToOffice(markerForm.type) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Linked Office</label>
                <select
                  value={markerForm.officeId}
                  onChange={(e) => setMarkerForm({ ...markerForm, officeId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {dropdowns.offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.roomNumber} ({o.lecturer.firstName} {o.lecturer.lastName})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlaceMarkerForm(null)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 [background-color:var(--color-primary-hover)] hover:[background-color:var(--color-primary)]"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteMarkerTarget}
        title="Delete marker"
        message={deleteMarkerTarget ? `Delete marker "${deleteMarkerTarget.label}"?` : ''}
        confirmLabel="Delete"
        onConfirm={handleDeleteMarker}
        onCancel={() => setDeleteMarkerTarget(null)}
        loading={deleting}
      />

      {/* Mobile bottom sheet for popup content */}
      {isMobile && mobilePopupMarker && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white shadow-xl"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <span className="font-semibold text-slate-900">{mobilePopupMarker.label}</span>
            <button
              type="button"
              onClick={() => setMobilePopupMarker(null)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium" style={{ color: MARKER_TYPE_COLORS[mobilePopupMarker.type] || '#6b7280' }}>
              {mobilePopupMarker.type}
            </p>
            <p className="text-sm text-slate-600">
              {mobilePopupMarker.building.name}, {floorLabel(mobilePopupMarker.floor)}
            </p>
            {mobilePopupMarker.hall && (
              <>
                <p className="mt-1 text-xs text-slate-500">Hall: {mobilePopupMarker.hall.name}</p>
                {liveStatus?.hallStatus[mobilePopupMarker.hall.id] && (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      liveStatus.hallStatus[mobilePopupMarker.hall.id].free ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {liveStatus.hallStatus[mobilePopupMarker.hall.id].free ? '🟢 Free now' : '🔴 Occupied now'}
                    {liveStatus.hallStatus[mobilePopupMarker.hall.id].nextSlot &&
                      ` - Next: ${liveStatus.hallStatus[mobilePopupMarker.hall.id].nextSlot!.startTime}-${liveStatus.hallStatus[mobilePopupMarker.hall.id].nextSlot!.endTime}`}
                  </p>
                )}
              </>
            )}
            {mobilePopupMarker.office && (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  Office: {mobilePopupMarker.office.roomNumber} - {mobilePopupMarker.office.lecturer.firstName}{' '}
                  {mobilePopupMarker.office.lecturer.lastName}
                </p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg px-4 py-2 text-sm text-white [background-color:var(--color-primary)]"
                  onClick={() => {
                    navigate(`/appointments/book/${mobilePopupMarker!.office!.lecturer.id}`);
                    setMobilePopupMarker(null);
                  }}
                >
                  Book Appointment
                </button>
              </>
            )}
            {editMode && isAdmin && (
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
                onClick={() => {
                  setDeleteMarkerTarget(mobilePopupMarker);
                  setMobilePopupMarker(null);
                }}
              >
                <Trash2 size={14} /> Delete marker
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
