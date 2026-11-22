package com.cyclonesafe.app.ui;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.animation.OvershootInterpolator;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.LocationHelper;
import com.cyclonesafe.app.data.SessionManager;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.data.WeatherRepository;
import com.cyclonesafe.app.model.Models;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private SessionManager session;
    private SupabaseClient supabase;
    private LocationHelper locationHelper;
    private WeatherRepository weatherRepo;

    private TextView tvWelcome, tvLocationStatus, tvOutsideIndiaBanner, tvWeatherSummary, tvAlertsStatus;
    private double currentLat = Double.NaN;
    private double currentLng = Double.NaN;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean fine = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false);
                Boolean coarse = result.getOrDefault(Manifest.permission.ACCESS_COARSE_LOCATION, false);
                if (Boolean.TRUE.equals(fine) || Boolean.TRUE.equals(coarse)) {
                    startLiveLocation();
                } else {
                    tvLocationStatus.setText("Location permission denied. Enable GPS permission to load local services and weather.");
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        session = new SessionManager(this);
        if (!session.isLoggedInAndVerified()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }
        setContentView(R.layout.activity_main);

        supabase = new SupabaseClient(this);
        locationHelper = new LocationHelper(this);
        weatherRepo = new WeatherRepository();

        tvWelcome = findViewById(R.id.tvWelcome);
        tvLocationStatus = findViewById(R.id.tvLocationStatus);
        tvOutsideIndiaBanner = findViewById(R.id.tvOutsideIndiaBanner);
        tvWeatherSummary = findViewById(R.id.tvWeatherSummary);
        tvAlertsStatus = findViewById(R.id.tvAlertsStatus);

        String name = session.getFullName().isEmpty() ? session.getEmail() : session.getFullName();
        tvWelcome.setText("Welcome, " + name);

        supabase.fetchProfile(new SupabaseClient.ApiCallback<Models.UserProfile>() {
            @Override
            public void onSuccess(Models.UserProfile profile) {
                tvWelcome.setText("Welcome, " + profile.full_name);
            }

            @Override
            public void onError(String errorMessage) {
                // Keep cached name
            }
        });

        setupNavigationButtons();
        requestLocationIfNeeded();
    }

    private void setupNavigationButtons() {
        findViewById(R.id.btnSosEmergency).setOnClickListener(v ->
                startActivity(new Intent(this, SosActivity.class)));

        findViewById(R.id.cardLiveMap).setOnClickListener(v -> {
            Intent i = new Intent(this, MapActivity.class);
            i.putExtra("category", "hospital");
            startActivity(i);
        });

        findViewById(R.id.cardNearbyHospitals).setOnClickListener(v -> {
            Intent i = new Intent(this, MapActivity.class);
            i.putExtra("category", "hospital");
            startActivity(i);
        });

        findViewById(R.id.cardNearbyShelters).setOnClickListener(v -> {
            Intent i = new Intent(this, MapActivity.class);
            i.putExtra("category", "shelter");
            startActivity(i);
        });

        findViewById(R.id.cardWeather).setOnClickListener(v ->
                startActivity(new Intent(this, WeatherActivity.class)));

        findViewById(R.id.cardFamilySafety).setOnClickListener(v ->
                startActivity(new Intent(this, FamilySafetyActivity.class)));

        findViewById(R.id.cardDisasterReport).setOnClickListener(v ->
                startActivity(new Intent(this, ReportDisasterActivity.class)));

        findViewById(R.id.cardGuidelines).setOnClickListener(v ->
                startActivity(new Intent(this, GuidelinesActivity.class)));

        findViewById(R.id.cardEmergencyServices).setOnClickListener(v ->
                startActivity(new Intent(this, EmergencyServicesActivity.class)));

        FloatingActionButton fabAiAssistant = findViewById(R.id.fabAiAssistant);
        fabAiAssistant.setScaleX(0f);
        fabAiAssistant.setScaleY(0f);
        fabAiAssistant.animate()
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(350)
                .setStartDelay(200)
                .setInterpolator(new OvershootInterpolator())
                .withEndAction(() -> {
                    ObjectAnimator pulse = ObjectAnimator.ofPropertyValuesHolder(
                            fabAiAssistant,
                            PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.07f, 1f),
                            PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.07f, 1f)
                    );
                    pulse.setDuration(1400);
                    pulse.setRepeatCount(2);
                    pulse.start();
                })
                .start();

        fabAiAssistant.setOnClickListener(v -> {
            AiAssistantBottomSheet sheet = AiAssistantBottomSheet.newInstance(currentLat, currentLng);
            sheet.show(getSupportFragmentManager(), "CycloneSafeAiAssistant");
        });

        Button btnLogout = findViewById(R.id.btnLogout);
        btnLogout.setOnClickListener(v -> supabase.signOut(new SupabaseClient.ApiCallback<Boolean>() {
            @Override
            public void onSuccess(Boolean result) {
                Toast.makeText(MainActivity.this, "Signed out.", Toast.LENGTH_SHORT).show();
                startActivity(new Intent(MainActivity.this, LoginActivity.class));
                finish();
            }

            @Override
            public void onError(String errorMessage) {
                session.clearSession();
                startActivity(new Intent(MainActivity.this, LoginActivity.class));
                finish();
            }
        }));
    }

    private void requestLocationIfNeeded() {
        if (locationHelper.hasLocationPermission()) {
            startLiveLocation();
        } else {
            locationPermissionLauncher.launch(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            });
        }
    }

    private void startLiveLocation() {
        tvLocationStatus.setText("Acquiring live GPS fix...");
        locationHelper.startLocationUpdates(new LocationHelper.LocationListener() {
            @Override
            public void onLocationUpdated(double lat, double lng, String placeLabel, boolean insideIndia) {
                currentLat = lat;
                currentLng = lng;
                tvLocationStatus.setText(String.format(Locale.US, "%s (%.4f, %.4f)", placeLabel, lat, lng));
                tvOutsideIndiaBanner.setVisibility(insideIndia ? View.GONE : View.VISIBLE);
                loadDashboardWeather(lat, lng);
            }

            @Override
            public void onLocationError(String reason) {
                tvLocationStatus.setText(reason);
                tvWeatherSummary.setText("Weather unavailable until GPS location is active.");
            }
        });
    }

    private void loadDashboardWeather(double lat, double lng) {
        weatherRepo.fetchWeather(lat, lng, new WeatherRepository.WeatherCallback() {
            @Override
            public void onSuccess(Models.WeatherData data) {
                tvWeatherSummary.setText(String.format(Locale.US,
                        "%.1f°C · %s · Humidity %d%% · Wind %.1f km/h · Rain %.1f mm",
                        data.currentTempC, data.conditionLabel, data.humidityPercent, data.windSpeedKmh, data.rainfallMm));

                if (data.weatherCode >= 95 || data.rainfallMm >= 15.0 || data.windSpeedKmh >= 50.0) {
                    tvAlertsStatus.setText("High weather advisory detected from live Open-Meteo metrics. Verify official IMD/NDMA bulletins.");
                } else {
                    tvAlertsStatus.setText("No extreme local rainfall/wind threshold detected in live Open-Meteo feed.");
                }
            }

            @Override
            public void onError(String message) {
                tvWeatherSummary.setText("Weather fetch error: " + message);
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationHelper != null) locationHelper.stopLocationUpdates();
    }
}
