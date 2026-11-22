import React from 'react';
import {
  AlertCircle,
  CloudRain,
  Compass,
  Droplets,
  RefreshCw,
  Thermometer,
  Wind,
} from 'lucide-react';
import {type GpsLocationState} from '../lib/location';
import {
  formatCompassDirection,
  mapWmoCode,
  type LiveWeatherData,
} from '../lib/weather';

interface WeatherViewProps {
  gps: GpsLocationState;
  weather: LiveWeatherData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefreshGps: () => void;
}

export function WeatherView({
  gps,
  weather,
  loading,
  error,
  onRetry,
  onRefreshGps,
}: WeatherViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Live Weather &amp; Forecast
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {gps.status === 'ready' && gps.lat !== null && gps.lng !== null
              ? `GPS Coordinates: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
              : 'Waiting for real device GPS coordinates'}
            {weather && ` · Last updated ${new Date(weather.lastUpdatedIso).toLocaleTimeString()}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshGps}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            Refresh GPS
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Weather</span>
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-950">
        Forecast data is sourced live from Open-Meteo for your GPS coordinates. Weather
        forecasts are informational and distinct from official disaster warnings issued by
        IMD (India Meteorological Department) and NDMA.
      </div>

      {gps.status !== 'ready' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-950 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">GPS Location Required for Live Weather</p>
              <p className="text-xs text-amber-900 mt-1">
                {gps.errorMessage ||
                  'Enable browser location permission so CycloneSafe can fetch real Open-Meteo conditions for your exact coordinates.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshGps}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-900 text-white rounded-lg shrink-0 cursor-pointer"
          >
            Allow Location
          </button>
        </div>
      )}

      {loading && !weather && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="text-xs text-red-800">
            <p className="font-semibold">Unable to fetch live weather</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {weather && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2">
              <p className="text-xs text-slate-500">Current Condition</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                  {weather.temperatureC.toFixed(1)}°C
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {weather.conditionLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Timezone: {weather.timezone}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Feels Like</span>
                <Thermometer className="w-3.5 h-3.5" />
              </div>
              <p className="font-display text-xl font-bold text-slate-900 mt-2 tabular-nums">
                {weather.feelsLikeC.toFixed(1)}°C
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Humidity</span>
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <p className="font-display text-xl font-bold text-slate-900 mt-2 tabular-nums">
                {weather.humidityPercent}%
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Wind</span>
                <Wind className="w-3.5 h-3.5" />
              </div>
              <p className="font-display text-xl font-bold text-slate-900 mt-2 tabular-nums">
                {weather.windSpeedKmh.toFixed(1)} km/h
              </p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-mono tabular-nums">
                <Compass className="w-3 h-3" />
                <span>
                  {formatCompassDirection(weather.windDirectionDeg)} (
                  {weather.windDirectionDeg}°)
                </span>
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Rainfall</span>
                <CloudRain className="w-3.5 h-3.5" />
              </div>
              <p className="font-display text-xl font-bold text-slate-900 mt-2 tabular-nums">
                {weather.rainfallMm.toFixed(1)} mm
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-semibold text-slate-900 mb-3">
                Next 24 Hours Forecast
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="py-2 font-medium">Time</th>
                      <th className="py-2 font-medium">Condition</th>
                      <th className="py-2 font-medium text-right">Temp</th>
                      <th className="py-2 font-medium text-right">Rain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weather.hourly.slice(0, 12).map((h) => (
                      <tr key={h.time} className="hover:bg-slate-50">
                        <td className="py-2 font-mono tabular-nums text-slate-700">
                          {h.time.replace('T', ' ')}
                        </td>
                        <td className="py-2 text-slate-800">
                          {mapWmoCode(h.weatherCode)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                          {h.temperatureC.toFixed(1)}°C
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                          {h.precipitationMm.toFixed(1)} mm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-semibold text-slate-900 mb-3">
                7-Day Daily Forecast
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium">Condition</th>
                      <th className="py-2 font-medium text-right">Min / Max</th>
                      <th className="py-2 font-medium text-right">Rain Sum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weather.daily.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50">
                        <td className="py-2 font-mono tabular-nums text-slate-700">
                          {d.date}
                        </td>
                        <td className="py-2 text-slate-800">
                          {mapWmoCode(d.weatherCode)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                          {d.minTempC.toFixed(1)}° / {d.maxTempC.toFixed(1)}°C
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                          {d.precipitationSumMm.toFixed(1)} mm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
