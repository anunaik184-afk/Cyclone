export interface HourlyWeatherPoint {
  time: string;
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
}

export interface DailyWeatherPoint {
  date: string;
  maxTempC: number;
  minTempC: number;
  precipitationSumMm: number;
  weatherCode: number;
}

export interface LiveWeatherData {
  latitude: number;
  longitude: number;
  timezone: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  rainfallMm: number;
  weatherCode: number;
  conditionLabel: string;
  lastUpdatedIso: string;
  hourly: HourlyWeatherPoint[];
  daily: DailyWeatherPoint[];
}

export function mapWmoCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Heavy Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

export function formatCompassDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export async function fetchOpenMeteoWeather(
  lat: number,
  lng: number,
): Promise<LiveWeatherData> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Device appears to be offline. Connect to the internet and retry.');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toFixed(5));
  url.searchParams.set('longitude', lng.toFixed(5));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,rain,weather_code,wind_speed_10m,wind_direction_10m',
  );
  url.searchParams.set('hourly', 'temperature_2m,precipitation,weather_code');
  url.searchParams.set('forecast_hours', '24');
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
  );
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  }

  const json = await response.json();
  const current = json.current;
  if (!current) {
    throw new Error('Weather response missing current conditions.');
  }

  const hourly: HourlyWeatherPoint[] = [];
  if (json.hourly?.time) {
    for (let i = 0; i < json.hourly.time.length; i++) {
      hourly.push({
        time: json.hourly.time[i],
        temperatureC: json.hourly.temperature_2m[i],
        precipitationMm: json.hourly.precipitation[i],
        weatherCode: json.hourly.weather_code[i],
      });
    }
  }

  const daily: DailyWeatherPoint[] = [];
  if (json.daily?.time) {
    for (let i = 0; i < json.daily.time.length; i++) {
      daily.push({
        date: json.daily.time[i],
        maxTempC: json.daily.temperature_2m_max[i],
        minTempC: json.daily.temperature_2m_min[i],
        precipitationSumMm: json.daily.precipitation_sum[i],
        weatherCode: json.daily.weather_code[i],
      });
    }
  }

  return {
    latitude: json.latitude ?? lat,
    longitude: json.longitude ?? lng,
    timezone: json.timezone ?? 'UTC',
    temperatureC: current.temperature_2m,
    feelsLikeC: current.apparent_temperature,
    humidityPercent: current.relative_humidity_2m,
    windSpeedKmh: current.wind_speed_10m,
    windDirectionDeg: current.wind_direction_10m,
    rainfallMm: current.rain,
    weatherCode: current.weather_code,
    conditionLabel: mapWmoCode(current.weather_code),
    lastUpdatedIso: new Date().toISOString(),
    hourly,
    daily,
  };
}
