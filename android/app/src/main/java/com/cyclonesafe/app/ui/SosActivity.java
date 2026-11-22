package com.cyclonesafe.app.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.LocationHelper;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class SosActivity extends AppCompatActivity {
    private SupabaseClient supabase;
    private LocationHelper locationHelper;
    private Spinner spinnerType;
    private EditText etMessage;
    private Button btnTriggerSos, btnNotifyContacts;
    private ProgressBar progressBar;
    private TextView tvLocation, tvStatus;
    private LinearLayout llHistoryContainer;

    private double currentLat = Double.NaN;
    private double currentLng = Double.NaN;
    private final List<Models.EmergencyContact> savedContacts = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_sos);

        supabase = new SupabaseClient(this);
        locationHelper = new LocationHelper(this);

        spinnerType = findViewById(R.id.spinnerSosType);
        etMessage = findViewById(R.id.etSosMessage);
        btnTriggerSos = findViewById(R.id.btnTriggerSos);
        btnNotifyContacts = findViewById(R.id.btnNotifyContacts);
        progressBar = findViewById(R.id.progressBar);
        tvLocation = findViewById(R.id.tvSosLocation);
        tvStatus = findViewById(R.id.tvSosStatus);
        llHistoryContainer = findViewById(R.id.llSosHistory);

        String[] types = {"Medical Emergency", "Flood Trapped", "Fire / Rescue", "Earthquake", "Cyclone", "Personal Safety"};
        spinnerType.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, types));

        btnTriggerSos.setOnClickListener(v -> triggerSos());
        btnNotifyContacts.setOnClickListener(v -> composeSmsToContacts());

        locationHelper.startLocationUpdates(new LocationHelper.LocationListener() {
            @Override
            public void onLocationUpdated(double lat, double lng, String placeLabel, boolean insideIndia) {
                currentLat = lat;
                currentLng = lng;
                tvLocation.setText(String.format(Locale.US, "GPS Fix: %s (%.5f, %.5f)", placeLabel, lat, lng));
            }

            @Override
            public void onLocationError(String reason) {
                tvLocation.setText(reason);
            }
        });

        loadSosHistory();
        loadContacts();
    }

    private void triggerSos() {
        if (Double.isNaN(currentLat) || Double.isNaN(currentLng)) {
            Toast.makeText(this, "Waiting for live GPS coordinates before logging SOS.", Toast.LENGTH_LONG).show();
            return;
        }
        String type = spinnerType.getSelectedItem().toString();
        String msg = etMessage.getText().toString().trim();
        if (msg.isEmpty()) msg = "SOS Emergency Alert triggered from CycloneSafe.";

        progressBar.setVisibility(View.VISIBLE);
        btnTriggerSos.setEnabled(false);

        supabase.insertSosAlert(currentLat, currentLng, type, msg, new SupabaseClient.ApiCallback<Models.SosAlert>() {
            @Override
            public void onSuccess(Models.SosAlert alert) {
                progressBar.setVisibility(View.GONE);
                btnTriggerSos.setEnabled(true);
                tvStatus.setText("SOS recorded in cloud database (ID: " + alert.id + "). Use Notify Contacts or call 112 for immediate dispatch.");
                tvStatus.setVisibility(View.VISIBLE);
                loadSosHistory();
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnTriggerSos.setEnabled(true);
                Toast.makeText(SosActivity.this, errorMessage, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void composeSmsToContacts() {
        if (savedContacts.isEmpty()) {
            Toast.makeText(this, "No emergency contacts saved yet. Add contacts in Family Safety.", Toast.LENGTH_LONG).show();
            return;
        }
        StringBuilder numbers = new StringBuilder();
        for (int i = 0; i < savedContacts.size(); i++) {
            if (i > 0) numbers.append(";");
            numbers.append(savedContacts.get(i).phone);
        }
        String coords = Double.isNaN(currentLat) ? "Location pending" :
                String.format(Locale.US, "https://maps.google.com/?q=%.5f,%.5f", currentLat, currentLng);
        String body = "CycloneSafe SOS (" + spinnerType.getSelectedItem().toString() + "): "
                + etMessage.getText().toString().trim() + " Location: " + coords;

        Intent smsIntent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + numbers));
        smsIntent.putExtra("sms_body", body);
        startActivity(smsIntent);
    }

    private void loadContacts() {
        supabase.fetchEmergencyContacts(new SupabaseClient.ApiCallback<List<Models.EmergencyContact>>() {
            @Override
            public void onSuccess(List<Models.EmergencyContact> result) {
                savedContacts.clear();
                if (result != null) savedContacts.addAll(result);
            }

            @Override
            public void onError(String errorMessage) {
            }
        });
    }

    private void loadSosHistory() {
        supabase.fetchSosAlerts(new SupabaseClient.ApiCallback<List<Models.SosAlert>>() {
            @Override
            public void onSuccess(List<Models.SosAlert> alerts) {
                llHistoryContainer.removeAllViews();
                if (alerts == null || alerts.isEmpty()) {
                    TextView empty = new TextView(SosActivity.this);
                    empty.setText("No previous SOS alerts recorded.");
                    llHistoryContainer.addView(empty);
                    return;
                }
                for (Models.SosAlert a : alerts) {
                    TextView row = new TextView(SosActivity.this);
                    row.setPadding(0, 12, 0, 12);
                    row.setText(String.format(Locale.US, "[%s] %s — %s\nCoords: %.5f, %.5f · %s",
                            a.status, a.alert_type, a.alert_message, a.latitude, a.longitude, a.created_at));
                    llHistoryContainer.addView(row);
                }
            }

            @Override
            public void onError(String errorMessage) {
                Toast.makeText(SosActivity.this, errorMessage, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationHelper != null) locationHelper.stopLocationUpdates();
    }
}
