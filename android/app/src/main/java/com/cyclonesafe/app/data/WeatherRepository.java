package com.cyclonesafe.app.data;

import android.os.Handler;
import android.os.Looper;
import com.cyclonesafe.app.model.Models;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class WeatherRepository {
    private final OkHttpClient client;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface WeatherCallback {
        void onSuccess(Models.WeatherData data);
        void onError(String message);
    }

    public WeatherRepository() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build();
    }

    public void fetchWeather(double lat, double lng, WeatherCallback cb) {
        String url = String.format(Locale.US,
                "https://api.open-meteo.com/v1/forecast?latitude=%.5f&longitude=%.5f" +
                        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,rain,weather_code,wind_speed_10m,wind_direction_10m" +
                        "&hourly=temperature_2m,precipitation,weather_code&forecast_hours=24" +
                        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" +
                        "&timezone=auto",
                lat, lng);

        Request req = new Request.Builder().url(url).get().build();
        client.newCall(req).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> cb.onError("Weather network failure: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    mainHandler.post(() -> cb.onError("Weather API error (HTTP " + response.code() + ")"));
                    return;
                }
                try {
                    JsonObject root = JsonParser.parseString(body).getAsJsonObject();
                    JsonObject current = root.getAsJsonObject("current");
                    Models.WeatherData data = new Models.WeatherData();
                    data.currentTempC = current.get("temperature_2m").getAsDouble();
                    data.feelsLikeC = current.get("apparent_temperature").getAsDouble();
                    data.humidityPercent = current.get("relative_humidity_2m").getAsInt();
                    data.windSpeedKmh = current.get("wind_speed_10m").getAsDouble();
                    data.windDirectionDeg = current.get("wind_direction_10m").getAsInt();
                    data.rainfallMm = current.get("rain").getAsDouble();
                    data.weatherCode = current.get("weather_code").getAsInt();
                    data.conditionLabel = mapWmoCode(data.weatherCode);
                    data.lastUpdatedIso = Instant.now().toString();

                    if (root.has("hourly")) {
                        JsonObject hourly = root.getAsJsonObject("hourly");
                        JsonArray times = hourly.getAsJsonArray("time");
                        JsonArray temps = hourly.getAsJsonArray("temperature_2m");
                        JsonArray precips = hourly.getAsJsonArray("precipitation");
                        JsonArray codes = hourly.getAsJsonArray("weather_code");
                        for (int i = 0; i < times.size(); i++) {
                            Models.HourlyForecast h = new Models.HourlyForecast();
                            h.time = times.get(i).getAsString();
                            h.temperatureC = temps.get(i).getAsDouble();
                            h.precipitationMm = precips.get(i).getAsDouble();
                            h.weatherCode = codes.get(i).getAsInt();
                            data.hourly.add(h);
                        }
                    }

                    if (root.has("daily")) {
                        JsonObject daily = root.getAsJsonObject("daily");
                        JsonArray dates = daily.getAsJsonArray("time");
                        JsonArray maxT = daily.getAsJsonArray("temperature_2m_max");
                        JsonArray minT = daily.getAsJsonArray("temperature_2m_min");
                        JsonArray rainSum = daily.getAsJsonArray("precipitation_sum");
                        JsonArray codes = daily.getAsJsonArray("weather_code");
                        for (int i = 0; i < dates.size(); i++) {
                            Models.DailyForecast d = new Models.DailyForecast();
                            d.date = dates.get(i).getAsString();
                            d.maxTempC = maxT.get(i).getAsDouble();
                            d.minTempC = minT.get(i).getAsDouble();
                            d.precipitationSumMm = rainSum.get(i).getAsDouble();
                            d.weatherCode = codes.get(i).getAsInt();
                            data.daily.add(d);
                        }
                    }

                    mainHandler.post(() -> cb.onSuccess(data));
                } catch (Exception e) {
                    mainHandler.post(() -> cb.onError("Unable to parse weather response."));
                }
            }
        });
    }

    public static String mapWmoCode(int code) {
        if (code == 0) return "Clear Sky";
        if (code <= 3) return "Partly Cloudy";
        if (code == 45 || code == 48) return "Fog";
        if (code >= 51 && code <= 57) return "Drizzle";
        if (code >= 61 && code <= 67) return "Rain";
        if (code >= 71 && code <= 77) return "Snow";
        if (code >= 80 && code <= 82) return "Heavy Rain Showers";
        if (code >= 95) return "Thunderstorm";
        return "Cloudy";
    }
}
