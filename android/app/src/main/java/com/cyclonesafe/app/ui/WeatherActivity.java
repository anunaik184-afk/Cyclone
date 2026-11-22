package com.cyclonesafe.app.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.LocationHelper;
import com.cyclonesafe.app.data.WeatherRepository;
import com.cyclonesafe.app.model.Models;
import java.util.Locale;

public class WeatherActivity extends AppCompatActivity {
    private LocationHelper locationHelper;
    private WeatherRepository weatherRepo;
    private ProgressBar progressBar;
    private TextView tvError, tvTemp, tvCondition, tvMetrics, tvLastUpdated, tvCoords;
    private LinearLayout llHourlyContainer, llDailyContainer;
    private Button btnRetry;
    private double lastLat = Double.NaN, lastLng = Double.NaN;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_weather);

        locationHelper = new LocationHelper(this);
        weatherRepo = new WeatherRepository();

        progressBar = findViewById(R.id.progressBar);
        tvError = findViewById(R.id.tvError);
        tvTemp = findViewById(R.id.tvTemp);
        tvCondition = findViewById(R.id.tvCondition);
        tvMetrics = findViewById(R.id.tvMetrics);
        tvLastUpdated = findViewById(R.id.tvLastUpdated);
        tvCoords = findViewById(R.id.tvCoords);
        llHourlyContainer = findViewById(R.id.llHourlyContainer);
        llDailyContainer = findViewById(R.id.llDailyContainer);
        btnRetry = findViewById(R.id.btnRetry);

        btnRetry.setOnClickListener(v -> {
            if (!Double.isNaN(lastLat)) {
                loadWeather(lastLat, lastLng);
            } else {
                startLocation();
            }
        });

        startLocation();
    }

    private void startLocation() {
        progressBar.setVisibility(View.VISIBLE);
        tvError.setVisibility(View.GONE);
        btnRetry.setVisibility(View.GONE);

        locationHelper.startLocationUpdates(new LocationHelper.LocationListener() {
            @Override
            public void onLocationUpdated(double lat, double lng, String placeLabel, boolean insideIndia) {
                boolean changed = Double.isNaN(lastLat) || Math.abs(lastLat - lat) > 0.01 || Math.abs(lastLng - lng) > 0.01;
                lastLat = lat;
                lastLng = lng;
                tvCoords.setText(String.format(Locale.US, "%s (%.4f, %.4f)", placeLabel, lat, lng));
                if (changed) {
                    loadWeather(lat, lng);
                }
            }

            @Override
            public void onLocationError(String reason) {
                progressBar.setVisibility(View.GONE);
                tvError.setText(reason);
                tvError.setVisibility(View.VISIBLE);
                btnRetry.setVisibility(View.VISIBLE);
            }
        });
    }

    private void loadWeather(double lat, double lng) {
        progressBar.setVisibility(View.VISIBLE);
        tvError.setVisibility(View.GONE);
        btnRetry.setVisibility(View.GONE);

        weatherRepo.fetchWeather(lat, lng, new WeatherRepository.WeatherCallback() {
            @Override
            public void onSuccess(Models.WeatherData data) {
                progressBar.setVisibility(View.GONE);
                tvTemp.setText(String.format(Locale.US, "%.1f°C", data.currentTempC));
                tvCondition.setText(data.conditionLabel);
                tvMetrics.setText(String.format(Locale.US,
                        "Feels like: %.1f°C  ·  Humidity: %d%%\nWind: %.1f km/h (%d°)  ·  Rainfall: %.1f mm",
                        data.feelsLikeC, data.humidityPercent, data.windSpeedKmh, data.windDirectionDeg, data.rainfallMm));
                tvLastUpdated.setText("Last updated: " + data.lastUpdatedIso);

                llHourlyContainer.removeAllViews();
                int hourlyLimit = Math.min(data.hourly.size(), 12);
                for (int i = 0; i < hourlyLimit; i++) {
                    Models.HourlyForecast h = data.hourly.get(i);
                    TextView row = new TextView(WeatherActivity.this);
                    row.setPadding(0, 8, 0, 8);
                    row.setText(String.format(Locale.US, "%s  —  %.1f°C · %s · %.1f mm rain",
                            h.time.replace("T", " "), h.temperatureC, WeatherRepository.mapWmoCode(h.weatherCode), h.precipitationMm));
                    llHourlyContainer.addView(row);
                }

                llDailyContainer.removeAllViews();
                for (Models.DailyForecast d : data.daily) {
                    TextView row = new TextView(WeatherActivity.this);
                    row.setPadding(0, 8, 0, 8);
                    row.setText(String.format(Locale.US, "%s  —  %.1f°C / %.1f°C · %s · %.1f mm",
                            d.date, d.minTempC, d.maxTempC, WeatherRepository.mapWmoCode(d.weatherCode), d.precipitationSumMm));
                    llDailyContainer.addView(row);
                }
            }

            @Override
            public void onError(String message) {
                progressBar.setVisibility(View.GONE);
                tvError.setText(message);
                tvError.setVisibility(View.VISIBLE);
                btnRetry.setVisibility(View.VISIBLE);
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationHelper != null) locationHelper.stopLocationUpdates();
    }
}
