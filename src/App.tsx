import React, {useCallback, useEffect, useRef, useState} from 'react';
import {APIProvider} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  BookOpen,
  CloudSun,
  FileWarning,
  Home,
  Hospital,
  LogOut,
  MapPin,
  PhoneCall,
  RefreshCw,
  Settings,
  ShieldAlert,
  Tent,
  Users,
} from 'lucide-react';
import {AuthGate} from './components/AuthGate';
import {FamilySafetyView} from './components/FamilySafetyView';
import {FloatingAiAssistant} from './components/FloatingAiAssistant';
import {GuidelinesServicesView} from './components/GuidelinesServicesView';
import {type EmergencyCategory, LiveMapView} from './components/LiveMapView';
import {ReportDisasterView} from './components/ReportDisasterView';
import {SosView} from './components/SosView';
import {WeatherView} from './components/WeatherView';
import {isInsideIndia, type GpsLocationState} from './lib/location';
import {supabase, type UserProfile, type UserSettings} from './lib/supabase';
import {fetchOpenMeteoWeather, type LiveWeatherData} from './lib/weather';

type NavTab =
  | 'dashboard'
  | 'map'
  | 'weather'
  | 'sos'
  | 'report'
  | 'family'
  | 'guidelines'
  | 'services'
  | 'settings';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Auth & Profile state
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicTab, setPublicTab] = useState<
    'auth' | 'map' | 'weather' | 'services' | 'guidelines'
  >('auth');

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mapCategory, setMapCategory] = useState<EmergencyCategory>('hospital');

  // Real GPS state
  const [gps, setGps] = useState<GpsLocationState>({
    status: 'idle',
    lat: null,
    lng: null,
    accuracyMeters: null,
    insideIndia: true,
    errorMessage: null,
    updatedAt: null,
  });

  // Live Open-Meteo Weather state
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const lastWeatherCoordsRef = useRef<{lat: number; lng: number} | null>(null);

  // User settings state (Supabase user_settings)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Load authenticated Supabase session & profile
  const syncSession = useCallback(async () => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    try {
      const {data} = await supabase.auth.getSession();
      const session = data.session;
      if (session?.user && session.user.email_confirmed_at) {
        setUserId(session.user.id);
        const [profRes, setRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle(),
          supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ]);

        const resolvedProfile: UserProfile = (profRes.data as UserProfile) ?? {
          id: session.user.id,
          full_name:
            (session.user.user_metadata?.full_name as string) ||
            session.user.email ||
            'Verified User',
          email: session.user.email || '',
          phone: (session.user.user_metadata?.phone as string) || '',
        };
        setProfile(resolvedProfile);
        setUserSettings(
          (setRes.data as UserSettings) ?? {
            user_id: session.user.id,
            region_mode: 'IN',
            weather_unit: 'celsius',
            sos_auto_share_location: true,
            alert_notifications_enabled: true,
          },
        );
      } else {
        setUserId(null);
        setProfile(null);
      }
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    syncSession();
    if (!supabase) return;
    const {data: sub} = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.user.email_confirmed_at) {
        syncSession();
      } else {
        setUserId(null);
        setProfile(null);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [syncSession]);

  // Real GPS acquisition & watch
  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGps({
        status: 'unsupported',
        lat: null,
        lng: null,
        accuracyMeters: null,
        insideIndia: true,
        errorMessage: 'Browser geolocation is not supported on this device.',
        updatedAt: null,
      });
      return;
    }

    setGps((prev) => ({...prev, status: 'loading', errorMessage: null}));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGps({
          status: 'ready',
          lat,
          lng,
          accuracyMeters: pos.coords.accuracy,
          insideIndia: isInsideIndia(lat, lng),
          errorMessage: null,
          updatedAt: new Date().toISOString(),
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setGps({
          status: denied ? 'denied' : 'unavailable',
          lat: null,
          lng: null,
          accuracyMeters: null,
          insideIndia: true,
          errorMessage: denied
            ? 'Location permission denied. Grant GPS access in browser settings to load local weather and emergency services.'
            : 'GPS signal unavailable. Ensure device Location Services are enabled and retry.',
          updatedAt: null,
        });
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  }, []);

  useEffect(() => {
    requestGps();
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGps({
          status: 'ready',
          lat,
          lng,
          accuracyMeters: pos.coords.accuracy,
          insideIndia: isInsideIndia(lat, lng),
          errorMessage: null,
          updatedAt: new Date().toISOString(),
        });
      },
      () => {
        // Keep current state on transient watch failures
      },
      {enableHighAccuracy: true, maximumAge: 30000, timeout: 20000},
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [requestGps]);

  const loadWeatherForCoords = useCallback(async (lat: number, lng: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const data = await fetchOpenMeteoWeather(lat, lng);
      setWeather(data);
      lastWeatherCoordsRef.current = {lat, lng};
    } catch (err) {
      setWeatherError(
        err instanceof Error ? err.message : 'Unable to fetch weather.',
      );
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gps.status !== 'ready' || gps.lat === null || gps.lng === null) return;
    const prev = lastWeatherCoordsRef.current;
    if (
      !prev ||
      Math.abs(prev.lat - gps.lat) > 0.01 ||
      Math.abs(prev.lng - gps.lng) > 0.01
    ) {
      loadWeatherForCoords(gps.lat, gps.lng);
    }
  }, [gps.status, gps.lat, gps.lng, loadWeatherForCoords]);

  const handleRetryWeather = () => {
    if (gps.status === 'ready' && gps.lat !== null && gps.lng !== null) {
      loadWeatherForCoords(gps.lat, gps.lng);
    } else {
      requestGps();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId || !userSettings) return;
    setSettingsSaving(true);
    setSettingsNotice(null);
    const {error} = await supabase.from('user_settings').upsert(
      {
        ...userSettings,
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      {onConflict: 'user_id'},
    );
    setSettingsSaving(false);
    setSettingsNotice(
      error ? `Save failed: ${error.message}` : 'Settings saved to Supabase.',
    );
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserId(null);
    setProfile(null);
    setActiveTab('dashboard');
    setPublicTab('auth');
  };

  const openMapWithCategory = (cat: EmergencyCategory) => {
    setMapCategory(cat);
    setActiveTab('map');
  };

  const renderMapWrapper = (cat: EmergencyCategory) => {
    if (!MAPS_API_KEY) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-950">
          Google Maps API key is not configured. Ensure{' '}
          <span className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</span> is set in
          environment secrets.
        </div>
      );
    }
    return (
      <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
        <LiveMapView
          gps={gps}
          onRefreshGps={requestGps}
          initialCategory={cat}
        />
      </APIProvider>
    );
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Restoring verified CycloneSafe session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!userId ? (
        publicTab === 'auth' ? (
          <AuthGate
            onAuthenticated={(uid, prof) => {
              setUserId(uid);
              setProfile(prof);
              setActiveTab('dashboard');
            }}
            onOpenPublicTab={(tab) => setPublicTab(tab)}
          />
        ) : (
          <div className="min-h-screen flex flex-col">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-6">
              <button
                type="button"
                onClick={() => setPublicTab('auth')}
                className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
              >
                <img
                  src="/assets/aistudio/WhatsApp_Image_2026-11-13_at_9.51.49_PM-removebg-preview_1b7152e3.png"
                  alt="CycloneSafe Logo"
                  className="w-9 h-9 object-contain shrink-0"
                />
                <span className="font-display text-lg font-bold text-slate-900 whitespace-nowrap">
                  CycloneSafe
                </span>
              </button>

              <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
                <button
                  type="button"
                  onClick={() => setPublicTab('map')}
                  className={`whitespace-nowrap cursor-pointer ${
                    publicTab === 'map' ? 'text-slate-900 font-semibold' : ''
                  }`}
                >
                  Live Map
                </button>
                <button
                  type="button"
                  onClick={() => setPublicTab('weather')}
                  className={`whitespace-nowrap cursor-pointer ${
                    publicTab === 'weather' ? 'text-slate-900 font-semibold' : ''
                  }`}
                >
                  Weather
                </button>
                <button
                  type="button"
                  onClick={() => setPublicTab('services')}
                  className={`whitespace-nowrap cursor-pointer ${
                    publicTab === 'services' ? 'text-slate-900 font-semibold' : ''
                  }`}
                >
                  India Helplines
                </button>
                <button
                  type="button"
                  onClick={() => setPublicTab('guidelines')}
                  className={`whitespace-nowrap cursor-pointer ${
                    publicTab === 'guidelines' ? 'text-slate-900 font-semibold' : ''
                  }`}
                >
                  Safety Guidelines
                </button>
              </nav>

              <button
                type="button"
                onClick={() => setPublicTab('auth')}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign In / Verify OTP
              </button>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-20">
              {publicTab === 'map' && renderMapWrapper('hospital')}
              {publicTab === 'weather' && (
                <WeatherView
                  gps={gps}
                  weather={weather}
                  loading={weatherLoading}
                  error={weatherError}
                  onRetry={handleRetryWeather}
                  onRefreshGps={requestGps}
                />
              )}
              {publicTab === 'services' && <GuidelinesServicesView mode="services" />}
              {publicTab === 'guidelines' && (
                <GuidelinesServicesView mode="guidelines" />
              )}
            </main>
          </div>
        )
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r border-slate-200 p-4 justify-between shrink-0">
            <div className="space-y-6">
              <div className="flex items-center gap-2.5 px-2 pt-1">
                <img
                  src="/assets/aistudio/WhatsApp_Image_2026-11-13_at_9.51.49_PM-removebg-preview_1b7152e3.png"
                  alt="CycloneSafe Logo"
                  className="w-10 h-10 object-contain shrink-0"
                />
                <span className="font-display text-lg font-bold text-slate-900 tracking-tight">
                  CycloneSafe
                </span>
              </div>

              <nav className="space-y-1">
                {(
                  [
                    {id: 'dashboard', label: 'Dashboard', icon: Home},
                    {id: 'sos', label: 'SOS Emergency', icon: ShieldAlert},
                    {id: 'map', label: 'Live Map & Places', icon: MapPin},
                    {id: 'weather', label: 'Weather Forecast', icon: CloudSun},
                    {id: 'report', label: 'Disaster Reports', icon: FileWarning},
                    {id: 'family', label: 'Family Safety', icon: Users},
                    {id: 'guidelines', label: 'Safety Guidelines', icon: BookOpen},
                    {id: 'services', label: 'Emergency Helplines', icon: PhoneCall},
                    {id: 'settings', label: 'Settings', icon: Settings},
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? item.id === 'sos'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="px-2">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {profile?.full_name || 'Verified User'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{profile?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>

          {/* Main Content Viewport */}
          <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
            <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
                <img
                  src="/assets/aistudio/WhatsApp_Image_2026-11-13_at_9.51.49_PM-removebg-preview_1b7152e3.png"
                  alt="CycloneSafe Logo"
                  className="w-7 h-7 object-contain shrink-0 lg:hidden"
                />
                <span className="font-semibold text-slate-900 lg:hidden">
                  CycloneSafe
                </span>
                <span className="hidden lg:inline font-medium text-slate-500">
                  CycloneSafe /
                </span>
                <span className="font-semibold text-slate-900 capitalize truncate">
                  {activeTab}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('sos')}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                >
                  SOS Alert
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="lg:hidden px-3 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Hero Welcome + Primary SOS Action */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-500">
                        Verified Session · India Emergency Preparedness
                      </p>
                      <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                        Welcome, {profile?.full_name || 'Responder'}
                      </h1>
                      <p className="text-xs font-mono text-slate-600 tabular-nums">
                        {gps.status === 'ready' && gps.lat !== null && gps.lng !== null
                          ? `Live GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} (±${Math.round(gps.accuracyMeters ?? 0)}m)`
                          : gps.errorMessage || 'Acquiring live GPS fix...'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={requestGps}
                        className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh GPS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sos')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        <ShieldAlert className="w-5 h-5" />
                        <span>TRIGGER SOS EMERGENCY</span>
                      </button>
                    </div>
                  </div>

                  {gps.status === 'ready' && !gps.insideIndia && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          Location Outside India Detected
                        </p>
                        <p className="mt-0.5">
                          Your device GPS is currently outside India. CycloneSafe is
                          configured for Indian emergency services (112, 108, 1078) and
                          will never display fabricated local coordinates.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Weather & Alert Threshold Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <h2 className="font-display text-sm font-semibold text-slate-900">
                            Live Weather Summary (Open-Meteo)
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('weather')}
                            className="text-xs font-semibold text-slate-900 underline cursor-pointer"
                          >
                            Full Forecast
                          </button>
                        </div>
                        {weather ? (
                          <div className="mt-3">
                            <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                              {weather.temperatureC.toFixed(1)}°C ·{' '}
                              {weather.conditionLabel}
                            </p>
                            <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
                              Feels {weather.feelsLikeC.toFixed(1)}°C · Humidity{' '}
                              {weather.humidityPercent}% · Wind{' '}
                              {weather.windSpeedKmh.toFixed(1)} km/h · Rain{' '}
                              {weather.rainfallMm.toFixed(1)} mm
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-3">
                            {weatherLoading
                              ? 'Loading live weather for GPS coordinates...'
                              : weatherError || 'Enable GPS to view live weather.'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
                      <div>
                        <h2 className="font-display text-sm font-semibold text-slate-900">
                          Disaster Weather Threshold Monitor
                        </h2>
                        {weather ? (
                          weather.weatherCode >= 95 ||
                          weather.rainfallMm >= 15 ||
                          weather.windSpeedKmh >= 50 ? (
                            <p className="text-xs text-red-700 font-medium mt-3 leading-relaxed">
                              Elevated rainfall, wind, or thunderstorm conditions observed
                              in live Open-Meteo data. Verify official warnings on IMD and
                              NDMA channels.
                            </p>
                          ) : (
                            <p className="text-xs text-emerald-800 mt-3 leading-relaxed">
                              No severe local rain or wind spike detected in current
                              Open-Meteo telemetry. Always cross-check official IMD/NDMA
                              bulletins during monsoon or cyclone seasons.
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-slate-500 mt-3">
                            Waiting for live meteorological readings from GPS location.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Navigation Grid (Every item opens its real screen) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => openMapWithCategory('hospital')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <MapPin className="w-5 h-5 text-slate-900 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Live Emergency Map
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Interactive map centered on India with GPS &amp; routes
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => openMapWithCategory('hospital')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <Hospital className="w-5 h-5 text-red-600 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Nearby Hospitals
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Real hospitals &amp; clinics via Google Places API
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => openMapWithCategory('emergency_shelter')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <Tent className="w-5 h-5 text-amber-600 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Nearby Shelters
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Emergency, cyclone shelters &amp; relief centres
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('family')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <Users className="w-5 h-5 text-slate-900 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Family Safety &amp; Contacts
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Manage family members &amp; emergency contacts
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('report')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <FileWarning className="w-5 h-5 text-slate-900 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Disaster Reports
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Submit GPS incident reports with photo upload
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('guidelines')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-5 h-5 text-slate-900 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Safety Guidelines
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        NDMA action protocols for flood, cyclone &amp; fire
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <PhoneCall className="w-5 h-5 text-red-600 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Emergency Services
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Direct India helplines: 112, 108, 1078, 100, 101
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('weather')}
                      className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <CloudSun className="w-5 h-5 text-sky-600 mb-2" />
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Live Weather Forecast
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Hourly &amp; 7-day Open-Meteo conditions for your GPS
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'map' && renderMapWrapper(mapCategory)}
              {activeTab === 'weather' && (
                <WeatherView
                  gps={gps}
                  weather={weather}
                  loading={weatherLoading}
                  error={weatherError}
                  onRetry={handleRetryWeather}
                  onRefreshGps={requestGps}
                />
              )}
              {activeTab === 'sos' && (
                <SosView userId={userId} gps={gps} onRefreshGps={requestGps} />
              )}
              {activeTab === 'report' && (
                <ReportDisasterView
                  userId={userId}
                  gps={gps}
                  onRefreshGps={requestGps}
                />
              )}
              {activeTab === 'family' && <FamilySafetyView userId={userId} />}
              {activeTab === 'guidelines' && (
                <GuidelinesServicesView mode="guidelines" />
              )}
              {activeTab === 'services' && <GuidelinesServicesView mode="services" />}

              {activeTab === 'settings' && userSettings && (
                <div className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h1 className="font-display text-xl font-bold text-slate-900">
                      User Settings
                    </h1>
                    <p className="text-xs text-slate-600 mt-1">
                      Preferences saved to <span className="font-mono">user_settings</span>{' '}
                      in Supabase PostgreSQL.
                    </p>
                  </div>

                  {settingsNotice && (
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800">
                      {settingsNotice}
                    </div>
                  )}

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Emergency Region Mode
                      </label>
                      <select
                        value={userSettings.region_mode}
                        onChange={(e) =>
                          setUserSettings({
                            ...userSettings,
                            region_mode: e.target.value,
                          })
                        }
                        className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="IN">India (Default Emergency Network)</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userSettings.sos_auto_share_location}
                        onChange={(e) =>
                          setUserSettings({
                            ...userSettings,
                            sos_auto_share_location: e.target.checked,
                          })
                        }
                      />
                      <span>Attach live GPS coordinates to SOS alerts</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userSettings.alert_notifications_enabled}
                        onChange={(e) =>
                          setUserSettings({
                            ...userSettings,
                            alert_notifications_enabled: e.target.checked,
                          })
                        }
                      />
                      <span>Monitor Open-Meteo weather threshold advisories</span>
                    </label>

                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </form>
                </div>
              )}
            </main>
          </div>

          {/* Mobile Bottom Navigation (within 15% sticky height cap) */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-14">
            {(
              [
                {id: 'dashboard', label: 'Home', icon: Home},
                {id: 'map', label: 'Map', icon: MapPin},
                {id: 'sos', label: 'SOS', icon: ShieldAlert},
                {id: 'weather', label: 'Weather', icon: CloudSun},
                {id: 'family', label: 'Family', icon: Users},
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center text-[10px] font-semibold cursor-pointer ${
                    active
                      ? item.id === 'sos'
                        ? 'text-red-600'
                        : 'text-slate-900'
                      : 'text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <FloatingAiAssistant gps={gps} />
    </div>
  );
}
