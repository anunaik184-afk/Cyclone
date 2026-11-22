package com.cyclonesafe.app.ui;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.LocationHelper;
import com.cyclonesafe.app.model.Models;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.libraries.places.api.Places;
import com.google.android.libraries.places.api.model.CircularBounds;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.api.net.PlacesClient;
import com.google.android.libraries.places.api.net.SearchByTextRequest;
import com.google.android.libraries.places.api.net.SearchNearbyRequest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MapActivity extends AppCompatActivity implements OnMapReadyCallback {
    private GoogleMap googleMap;
    private PlacesClient placesClient;
    private LocationHelper locationHelper;
    private ProgressBar progressBar;
    private TextView tvPlaceDetailName, tvPlaceDetailAddress, tvPlaceDetailMeta, tvIndiaWarning;
    private View detailCard;
    private Button btnCallPlace, btnDirectionsPlace;

    private double userLat = Double.NaN;
    private double userLng = Double.NaN;
    private String selectedCategory = "hospital";
    private final Map<String, Models.EmergencyPlace> markerPlaceMap = new HashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_map);

        selectedCategory = getIntent().getStringExtra("category");
        if (selectedCategory == null) selectedCategory = "hospital";

        locationHelper = new LocationHelper(this);
        placesClient = Places.createClient(this);

        progressBar = findViewById(R.id.progressBar);
        detailCard = findViewById(R.id.detailCard);
        tvPlaceDetailName = findViewById(R.id.tvPlaceDetailName);
        tvPlaceDetailAddress = findViewById(R.id.tvPlaceDetailAddress);
        tvPlaceDetailMeta = findViewById(R.id.tvPlaceDetailMeta);
        tvIndiaWarning = findViewById(R.id.tvIndiaWarning);
        btnCallPlace = findViewById(R.id.btnCallPlace);
        btnDirectionsPlace = findViewById(R.id.btnDirectionsPlace);

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager().findFragmentById(R.id.mapFragment);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }

        findViewById(R.id.chipHospitals).setOnClickListener(v -> searchCategory("hospital"));
        findViewById(R.id.chipClinics).setOnClickListener(v -> searchCategory("clinic"));
        findViewById(R.id.chipEmergencyShelters).setOnClickListener(v -> searchCategory("shelter"));
        findViewById(R.id.chipCycloneShelters).setOnClickListener(v -> searchCategory("cyclone_shelter"));
        findViewById(R.id.chipPolice).setOnClickListener(v -> searchCategory("police"));
        findViewById(R.id.chipFire).setOnClickListener(v -> searchCategory("fire_station"));
        findViewById(R.id.chipRelief).setOnClickListener(v -> searchCategory("relief_centre"));
    }

    @SuppressLint("MissingPermission")
    @Override
    public void onMapReady(@NonNull GoogleMap map) {
        this.googleMap = map;
        map.getUiSettings().setZoomControlsEnabled(true);
        map.getUiSettings().setCompassEnabled(true);

        // Default India camera
        LatLng indiaCenter = new LatLng(LocationHelper.INDIA_CENTER_LAT, LocationHelper.INDIA_CENTER_LNG);
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(indiaCenter, 5f));

        if (locationHelper.hasLocationPermission()) {
            map.setMyLocationEnabled(true);
            map.getUiSettings().setMyLocationButtonEnabled(true);
            locationHelper.startLocationUpdates(new LocationHelper.LocationListener() {
                @Override
                public void onLocationUpdated(double lat, double lng, String placeLabel, boolean insideIndia) {
                    boolean firstFix = Double.isNaN(userLat);
                    userLat = lat;
                    userLng = lng;
                    tvIndiaWarning.setVisibility(insideIndia ? View.GONE : View.VISIBLE);
                    if (firstFix) {
                        map.animateCamera(CameraUpdateFactory.newLatLngZoom(new LatLng(lat, lng), 13f));
                        searchCategory(selectedCategory);
                    }
                }

                @Override
                public void onLocationError(String reason) {
                    Toast.makeText(MapActivity.this, reason, Toast.LENGTH_LONG).show();
                }
            });
        }

        map.setOnMarkerClickListener(marker -> {
            Models.EmergencyPlace place = markerPlaceMap.get(marker.getId());
            if (place != null) {
                showPlaceDetails(place);
            }
            return false;
        });
    }

    private void searchCategory(String category) {
        this.selectedCategory = category;
        if (googleMap == null) return;

        double searchLat = Double.isNaN(userLat) ? LocationHelper.INDIA_CENTER_LAT : userLat;
        double searchLng = Double.isNaN(userLng) ? LocationHelper.INDIA_CENTER_LNG : userLng;
        LatLng center = new LatLng(searchLat, searchLng);

        progressBar.setVisibility(View.VISIBLE);
        googleMap.clear();
        markerPlaceMap.clear();
        detailCard.setVisibility(View.GONE);

        List<Place.Field> fields = Arrays.asList(
                Place.Field.ID,
                Place.Field.DISPLAY_NAME,
                Place.Field.FORMATTED_ADDRESS,
                Place.Field.LOCATION,
                Place.Field.NATIONAL_PHONE_NUMBER,
                Place.Field.GOOGLE_MAPS_URI,
                Place.Field.BUSINESS_STATUS
        );

        if ("hospital".equals(category) || "police".equals(category) || "fire_station".equals(category)) {
            CircularBounds bounds = CircularBounds.newInstance(center, 15000.0);
            SearchNearbyRequest req = SearchNearbyRequest.builder(bounds, fields)
                    .setIncludedPrimaryTypes(Collections.singletonList(category))
                    .setMaxResultCount(15)
                    .setRankPreference(SearchNearbyRequest.RankPreference.DISTANCE)
                    .build();

            placesClient.searchNearby(req)
                    .addOnSuccessListener(resp -> renderPlaces(resp.getPlaces(), searchLat, searchLng, category))
                    .addOnFailureListener(e -> handlePlaceError(e.getMessage()));
        } else {
            String query;
            switch (category) {
                case "clinic": query = "medical clinic"; break;
                case "cyclone_shelter": query = "cyclone shelter"; break;
                case "relief_centre": query = "disaster relief centre"; break;
                default: query = "emergency shelter"; break;
            }
            SearchByTextRequest req = SearchByTextRequest.builder(query, fields)
                    .setLocationBias(CircularBounds.newInstance(center, 25000.0))
                    .setMaxResultCount(15)
                    .setRegionCode("IN")
                    .build();

            placesClient.searchByText(req)
                    .addOnSuccessListener(resp -> renderPlaces(resp.getPlaces(), searchLat, searchLng, category))
                    .addOnFailureListener(e -> handlePlaceError(e.getMessage()));
        }
    }

    private void renderPlaces(List<Place> places, double originLat, double originLng, String category) {
        progressBar.setVisibility(View.GONE);
        if (places == null || places.isEmpty()) {
            Toast.makeText(this, "No verified " + category.replace('_', ' ') + " results found nearby.", Toast.LENGTH_SHORT).show();
            return;
        }
        List<Models.EmergencyPlace> parsed = new ArrayList<>();
        for (Place p : places) {
            if (p.getLocation() == null) continue;
            Models.EmergencyPlace ep = new Models.EmergencyPlace();
            ep.id = p.getId();
            ep.name = p.getDisplayName();
            ep.address = p.getFormattedAddress();
            ep.latitude = p.getLocation().latitude;
            ep.longitude = p.getLocation().longitude;
            ep.phoneNumber = p.getNationalPhoneNumber();
            ep.googleMapsUri = p.getGoogleMapsUri() != null ? p.getGoogleMapsUri().toString() : null;
            ep.businessStatus = p.getBusinessStatus() != null ? p.getBusinessStatus().name() : "";
            float[] dist = new float[1];
            Location.distanceBetween(originLat, originLng, ep.latitude, ep.longitude, dist);
            ep.distanceMeters = dist[0];
            parsed.add(ep);

            Marker marker = googleMap.addMarker(new MarkerOptions()
                    .position(p.getLocation())
                    .title(ep.name)
                    .snippet(ep.address));
            if (marker != null) {
                markerPlaceMap.put(marker.getId(), ep);
            }
        }
        if (!parsed.isEmpty()) {
            showPlaceDetails(parsed.get(0));
        }
    }

    private void showPlaceDetails(Models.EmergencyPlace place) {
        detailCard.setVisibility(View.VISIBLE);
        tvPlaceDetailName.setText(place.name);
        tvPlaceDetailAddress.setText(place.address != null ? place.address : "Address unavailable");
        String distText = String.format(Locale.US, "%.2f km away", place.distanceMeters / 1000.0);
        String phoneText = place.phoneNumber != null ? " · " + place.phoneNumber : " · Phone unavailable";
        tvPlaceDetailMeta.setText(distText + phoneText);

        btnCallPlace.setEnabled(place.phoneNumber != null && !place.phoneNumber.isEmpty());
        btnCallPlace.setOnClickListener(v -> {
            if (place.phoneNumber != null) {
                startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + place.phoneNumber)));
            }
        });

        btnDirectionsPlace.setOnClickListener(v -> {
            Uri uri = Uri.parse(String.format(Locale.US,
                    "google.navigation:q=%f,%f", place.latitude, place.longitude));
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, uri);
            mapIntent.setPackage("com.google.android.apps.maps");
            if (mapIntent.resolveActivity(getPackageManager()) != null) {
                startActivity(mapIntent);
            } else {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(
                        String.format(Locale.US, "https://www.google.com/maps/dir/?api=1&destination=%f,%f",
                                place.latitude, place.longitude))));
            }
        });
    }

    private void handlePlaceError(String msg) {
        progressBar.setVisibility(View.GONE);
        Toast.makeText(this, "Places lookup failed: " + msg, Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationHelper != null) locationHelper.stopLocationUpdates();
    }
}
