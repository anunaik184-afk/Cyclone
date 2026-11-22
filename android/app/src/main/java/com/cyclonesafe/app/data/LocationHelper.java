package com.cyclonesafe.app.data;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationManager;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.util.List;
import java.util.Locale;

public class LocationHelper {
    public static final double INDIA_CENTER_LAT = 20.5937;
    public static final double INDIA_CENTER_LNG = 78.9629;

    public interface LocationListener {
        void onLocationUpdated(double lat, double lng, String placeLabel, boolean insideIndia);
        void onLocationError(String reason);
    }

    private final Context context;
    private final FusedLocationProviderClient fusedClient;
    private LocationCallback activeCallback;

    public LocationHelper(Context context) {
        this.context = context.getApplicationContext();
        this.fusedClient = LocationServices.getFusedLocationProviderClient(this.context);
    }

    public boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    public boolean isGpsEnabled() {
        LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    public static boolean isInsideIndia(double lat, double lng) {
        return lat >= 6.5 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
    }

    @SuppressLint("MissingPermission")
    public void startLocationUpdates(LocationListener listener) {
        if (!hasLocationPermission()) {
            listener.onLocationError("Location permission denied. Please grant GPS access.");
            return;
        }
        if (!isGpsEnabled()) {
            listener.onLocationError("Device GPS is disabled. Please enable Location Services.");
            return;
        }

        fusedClient.getLastLocation().addOnSuccessListener(location -> {
            if (location != null) {
                dispatchLocation(location, listener);
            }
        });

        LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15000)
                .setMinUpdateIntervalMillis(8000)
                .build();

        activeCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                Location loc = result.getLastLocation();
                if (loc != null) {
                    dispatchLocation(loc, listener);
                } else {
                    listener.onLocationError("Location currently unavailable from GPS.");
                }
            }
        };

        fusedClient.requestLocationUpdates(req, activeCallback, Looper.getMainLooper());
    }

    public void stopLocationUpdates() {
        if (activeCallback != null) {
            fusedClient.removeLocationUpdates(activeCallback);
            activeCallback = null;
        }
    }

    private void dispatchLocation(Location loc, LocationListener listener) {
        double lat = loc.getLatitude();
        double lng = loc.getLongitude();
        boolean insideIndia = isInsideIndia(lat, lng);
        String label = resolveLabel(lat, lng);
        listener.onLocationUpdated(lat, lng, label, insideIndia);
    }

    private String resolveLabel(double lat, double lng) {
        try {
            Geocoder geocoder = new Geocoder(context, Locale.getDefault());
            List<Address> addresses = geocoder.getFromLocation(lat, lng, 1);
            if (addresses != null && !addresses.isEmpty()) {
                Address a = addresses.get(0);
                String city = a.getLocality() != null ? a.getLocality() : a.getSubAdminArea();
                String state = a.getAdminArea();
                String country = a.getCountryName();
                StringBuilder sb = new StringBuilder();
                if (city != null) sb.append(city);
                if (state != null) {
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(state);
                }
                if (country != null) {
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(country);
                }
                if (sb.length() > 0) return sb.toString();
            }
        } catch (Exception ignored) {
        }
        return String.format(Locale.US, "%.5f, %.5f", lat, lng);
    }
}
