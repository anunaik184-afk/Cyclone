import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Crosshair,
  ExternalLink,
  Navigation,
  Phone,
  RefreshCw,
  Route as RouteIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  haversineDistanceKm,
  INDIA_DEFAULT_CENTER,
  INDIA_DEFAULT_ZOOM,
  type GpsLocationState,
} from '../lib/location';

export type EmergencyCategory =
  | 'hospital'
  | 'clinic'
  | 'emergency_shelter'
  | 'cyclone_shelter'
  | 'police'
  | 'fire_station'
  | 'relief_centre';

interface CategoryConfig {
  id: EmergencyCategory;
  label: string;
  mode: 'nearby' | 'text';
  primaryTypes?: string[];
  textQuery?: string;
  pinBg: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'hospital',
    label: 'Hospitals',
    mode: 'nearby',
    primaryTypes: ['hospital'],
    pinBg: '#DC2626',
  },
  {
    id: 'clinic',
    label: 'Clinics',
    mode: 'text',
    textQuery: 'medical clinic',
    pinBg: '#E11D48',
  },
  {
    id: 'emergency_shelter',
    label: 'Emergency Shelters',
    mode: 'text',
    textQuery: 'emergency shelter',
    pinBg: '#D97706',
  },
  {
    id: 'cyclone_shelter',
    label: 'Cyclone Shelters',
    mode: 'text',
    textQuery: 'cyclone shelter',
    pinBg: '#EA580C',
  },
  {
    id: 'police',
    label: 'Police Stations',
    mode: 'nearby',
    primaryTypes: ['police'],
    pinBg: '#1D4ED8',
  },
  {
    id: 'fire_station',
    label: 'Fire Stations',
    mode: 'nearby',
    primaryTypes: ['fire_station'],
    pinBg: '#B91C1C',
  },
  {
    id: 'relief_centre',
    label: 'Disaster Relief Centres',
    mode: 'text',
    textQuery: 'disaster relief centre',
    pinBg: '#0F766E',
  },
];

interface PlaceItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  googleMapsUri: string | null;
  businessStatus: string | null;
  distanceKm: number | null;
}

interface RouteSummary {
  placeName: string;
  distanceKm: number;
  durationMinutes: number;
}

interface LiveMapViewProps {
  gps: GpsLocationState;
  onRefreshGps: () => void;
  initialCategory?: EmergencyCategory;
}

interface MapsPolylineHandle {
  setMap: (map: ReturnType<typeof useMap> | null) => void;
  setOptions: (opts: {
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
  }) => void;
}

interface MapsPlaceResult {
  id: string;
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: {lat: () => number; lng: () => number} | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  googleMapsURI?: string | null;
  businessStatus?: string | null;
}

export function LiveMapView({
  gps,
  onRefreshGps,
  initialCategory = 'hospital',
}: LiveMapViewProps) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [category, setCategory] = useState<EmergencyCategory>(initialCategory);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(INDIA_DEFAULT_ZOOM);
  const [center, setCenter] = useState<{lat: number; lng: number}>(
    INDIA_DEFAULT_CENTER,
  );

  const polylinesRef = useRef<MapsPolylineHandle[]>([]);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPolylines();
    };
  }, [clearPolylines]);

  // Center on user GPS automatically when inside India
  useEffect(() => {
    if (gps.status === 'ready' && gps.lat !== null && gps.lng !== null && gps.insideIndia) {
      setCenter({lat: gps.lat, lng: gps.lng});
      setZoom(13);
    }
  }, [gps.status, gps.lat, gps.lng, gps.insideIndia]);

  const checkQuotaError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('OVER_QUERY_LIMIT') ||
      msg.includes('429') ||
      msg.toLowerCase().includes('quota')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    return msg;
  };

  const searchEmergencyPlaces = useCallback(
    async (cat: EmergencyCategory, targetCenter?: {lat: number; lng: number}) => {
      if (!placesLib) return;

      const searchOrigin =
        targetCenter ??
        (gps.status === 'ready' && gps.lat !== null && gps.lng !== null && gps.insideIndia
          ? {lat: gps.lat, lng: gps.lng}
          : map
            ? {
                lat: map.getCenter()?.lat() ?? INDIA_DEFAULT_CENTER.lat,
                lng: map.getCenter()?.lng() ?? INDIA_DEFAULT_CENTER.lng,
              }
            : INDIA_DEFAULT_CENTER);

      const cfg = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];
      setLoadingPlaces(true);
      setPlacesError(null);
      setSelectedPlace(null);
      clearPolylines();
      setRouteSummary(null);

      try {
        const fields = [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'nationalPhoneNumber',
          'internationalPhoneNumber',
          'googleMapsURI',
          'businessStatus',
        ];

        let rawPlaces: MapsPlaceResult[] = [];

        if (cfg.mode === 'nearby' && cfg.primaryTypes) {
          const {places: found} = await placesLib.Place.searchNearby({
            fields,
            locationRestriction: {
              center: searchOrigin,
              radius: 15000,
            },
            includedPrimaryTypes: cfg.primaryTypes,
            maxResultCount: 15,
            rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
            language: 'en',
            region: 'IN',
          });
          rawPlaces = found ?? [];
        } else {
          const {places: found} = await placesLib.Place.searchByText({
            textQuery: cfg.textQuery || cfg.label,
            fields,
            locationBias: {
              center: searchOrigin,
              radius: 25000,
            },
            maxResultCount: 15,
            language: 'en',
            region: 'IN',
          });
          rawPlaces = found ?? [];
        }

        const mapped: PlaceItem[] = rawPlaces
          .filter((p) => p.location != null)
          .map((p) => {
            const pLat = p.location!.lat();
            const pLng = p.location!.lng();
            const dist =
              gps.lat !== null && gps.lng !== null
                ? haversineDistanceKm(gps.lat, gps.lng, pLat, pLng)
                : haversineDistanceKm(searchOrigin.lat, searchOrigin.lng, pLat, pLng);
            return {
              id: p.id,
              name: p.displayName || 'Unnamed Facility',
              address: p.formattedAddress || 'Address unavailable',
              lat: pLat,
              lng: pLng,
              phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
              googleMapsUri: p.googleMapsURI || null,
              businessStatus: p.businessStatus || null,
              distanceKm: dist,
            };
          })
          .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

        setPlaces(mapped);
        if (mapped.length > 0 && map) {
          setSelectedPlace(mapped[0]);
        }
      } catch (err) {
        const msg = checkQuotaError(err);
        setPlacesError(`Could not retrieve places: ${msg}`);
        setPlaces([]);
      } finally {
        setLoadingPlaces(false);
      }
    },
    [placesLib, gps.status, gps.lat, gps.lng, gps.insideIndia, map, clearPolylines],
  );

  useEffect(() => {
    if (placesLib) {
      searchEmergencyPlaces(category);
    }
  }, [placesLib, category, searchEmergencyPlaces]);

  const handleComputeDirections = async (dest: PlaceItem) => {
    if (!routesLib || !map) {
      setRouteError('Routes library or map is still initializing.');
      return;
    }

    const origin =
      gps.status === 'ready' && gps.lat !== null && gps.lng !== null
        ? {lat: gps.lat, lng: gps.lng}
        : {
            lat: map.getCenter()?.lat() ?? INDIA_DEFAULT_CENTER.lat,
            lng: map.getCenter()?.lng() ?? INDIA_DEFAULT_CENTER.lng,
          };

    clearPolylines();
    setRouteError(null);
    setRouteLoading(true);

    try {
      const request = {
        origin,
        destination: {lat: dest.lat, lng: dest.lng},
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      };

      const {routes} = await (
        routesLib.Route as unknown as {
          computeRoutes: (req: unknown) => Promise<{
            routes: Array<{
              createPolylines: () => MapsPolylineHandle[];
              viewport?: Parameters<NonNullable<typeof map>['fitBounds']>[0];
              distanceMeters?: number;
              durationMillis?: number;
            }>;
          }>;
        }
      ).computeRoutes(request);

      if (!routes || routes.length === 0) {
        setRouteError('No driving route returned for this destination.');
        return;
      }

      const primaryRoute = routes[0];
      const newPolylines = primaryRoute.createPolylines();
      newPolylines.forEach((line) => {
        line.setOptions({
          strokeColor: '#DC2626',
          strokeWeight: 5,
          strokeOpacity: 0.9,
        });
        line.setMap(map);
      });
      polylinesRef.current = newPolylines;

      if (primaryRoute.viewport) {
        map.fitBounds(primaryRoute.viewport);
      }

      setRouteSummary({
        placeName: dest.name,
        distanceKm: (primaryRoute.distanceMeters ?? 0) / 1000,
        durationMinutes: Math.round((primaryRoute.durationMillis ?? 0) / 60000),
      });
    } catch (err) {
      const msg = checkQuotaError(err);
      setRouteError(`Route computation error: ${msg}`);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleRecenterOnUser = () => {
    if (gps.status === 'ready' && gps.lat !== null && gps.lng !== null) {
      setCenter({lat: gps.lat, lng: gps.lng});
      setZoom(14);
      if (map) {
        map.panTo({lat: gps.lat, lng: gps.lng});
        map.setZoom(14);
      }
    } else {
      onRefreshGps();
    }
  };

  const handleCenterIndia = () => {
    setCenter(INDIA_DEFAULT_CENTER);
    setZoom(INDIA_DEFAULT_ZOOM);
    if (map) {
      map.panTo(INDIA_DEFAULT_CENTER);
      map.setZoom(INDIA_DEFAULT_ZOOM);
    }
  };

  const activeCategoryConfig =
    CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <div className="space-y-4">
      {gps.status === 'ready' && !gps.insideIndia && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Device GPS is outside India ({gps.lat?.toFixed(4)}, {gps.lng?.toFixed(4)})
              </p>
              <p className="text-amber-900 mt-0.5">
                CycloneSafe is configured for Indian emergency services (112/108/1078). The
                map defaults to India rather than substituting a synthetic local coordinate.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCenterIndia}
            className="px-3 py-1.5 bg-amber-900 text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Focus India Map
          </button>
        </div>
      )}

      {/* Category Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                category === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (map) {
                const c = map.getCenter();
                if (c) {
                  searchEmergencyPlaces(category, {lat: c.lat(), lng: c.lng()});
                  return;
                }
              }
              searchEmergencyPlaces(category);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Search This Area
          </button>
        </div>
      </div>

      {/* Main Map + Results Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden relative min-h-[460px] h-[560px]">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            center={center}
            zoom={zoom}
            onCameraChanged={(ev) => {
              setCenter(ev.detail.center);
              setZoom(ev.detail.zoom);
            }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{width: '100%', height: '100%'}}
          >
            {/* User Real GPS Marker */}
            {gps.status === 'ready' && gps.lat !== null && gps.lng !== null && (
              <AdvancedMarker
                position={{lat: gps.lat, lng: gps.lng}}
                title="Your Live GPS Location"
              >
                <Pin background="#2563EB" borderColor="#1E3A8A" glyphColor="#FFFFFF" />
              </AdvancedMarker>
            )}

            {/* Nearby Emergency Places */}
            {places.map((p) => (
              <AdvancedMarker
                key={p.id}
                position={{lat: p.lat, lng: p.lng}}
                title={p.name}
                onClick={() => setSelectedPlace(p)}
              >
                <Pin
                  background={activeCategoryConfig.pinBg}
                  borderColor="#0F172A"
                  glyphColor="#FFFFFF"
                />
              </AdvancedMarker>
            ))}

            {selectedPlace && (
              <InfoWindow
                position={{lat: selectedPlace.lat, lng: selectedPlace.lng}}
                onCloseClick={() => setSelectedPlace(null)}
              >
                <div className="p-1 max-w-[240px] text-slate-900">
                  <p className="font-semibold text-sm">{selectedPlace.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selectedPlace.address}</p>
                  {selectedPlace.distanceKm !== null && (
                    <p className="text-xs font-mono text-slate-700 mt-1">
                      {selectedPlace.distanceKm.toFixed(2)} km away
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Custom Map Controls (Zoom + Current Location) */}
          <div className="absolute right-3 bottom-6 flex flex-col gap-2 z-10">
            <button
              type="button"
              onClick={handleRecenterOnUser}
              title="Center on Current GPS Location"
              className="w-10 h-10 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = Math.min(20, zoom + 1);
                setZoom(next);
                map?.setZoom(next);
              }}
              title="Zoom In"
              className="w-10 h-10 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = Math.max(3, zoom - 1);
                setZoom(next);
                map?.setZoom(next);
              }}
              title="Zoom Out"
              className="w-10 h-10 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Verified Places List & Directions Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col h-[560px]">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {activeCategoryConfig.label} (Google Places API)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified operational status should be confirmed locally before travel.
            </p>
          </div>

          {routeSummary && (
            <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 font-semibold">
                <RouteIcon className="w-3.5 h-3.5" />
                <span>Route to {routeSummary.placeName}</span>
              </div>
              <p className="font-mono tabular-nums mt-1">
                {routeSummary.distanceKm.toFixed(2)} km · approx.{' '}
                {routeSummary.durationMinutes} min drive
              </p>
            </div>
          )}

          {routeError && (
            <div className="mx-4 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {routeError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
            {loadingPlaces && (
              <div className="p-6 text-center text-xs text-slate-500">
                Querying Google Places API...
              </div>
            )}

            {!loadingPlaces && placesError && (
              <div className="p-4 text-xs text-red-700 bg-red-50 rounded-lg m-2">
                {placesError}
              </div>
            )}

            {!loadingPlaces && !placesError && places.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                No {activeCategoryConfig.label.toLowerCase()} returned in this radius. Try
                panning to an Indian city and clicking Search This Area.
              </div>
            )}

            {!loadingPlaces &&
              places.map((p) => {
                const isSelected = selectedPlace?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-lg transition-colors ${
                      isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlace(p);
                        setCenter({lat: p.lat, lng: p.lng});
                        setZoom(15);
                        map?.panTo({lat: p.lat, lng: p.lng});
                        map?.setZoom(15);
                      }}
                      className="w-full text-left cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{p.address}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                        {p.distanceKm !== null && (
                          <span>{p.distanceKm.toFixed(2)} km</span>
                        )}
                        {p.businessStatus && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{p.businessStatus}</span>
                          </>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 mt-2.5">
                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{p.phone}</span>
                        </a>
                      )}

                      <button
                        type="button"
                        disabled={routeLoading}
                        onClick={() => handleComputeDirections(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>{routeLoading ? 'Routing...' : 'Route'}</span>
                      </button>

                      <a
                        href={
                          p.googleMapsUri ||
                          `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap"
                      >
                        <span>Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
