package com.cyclonesafe.app.ui;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.LocationHelper;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;

public class ReportDisasterActivity extends AppCompatActivity {
    private SupabaseClient supabase;
    private LocationHelper locationHelper;
    private Spinner spinnerCategory;
    private EditText etDescription;
    private TextView tvCoords;
    private ImageView ivPreview;
    private Button btnPickImage, btnSubmit;
    private ProgressBar progressBar;
    private LinearLayout llReportsContainer;

    private Uri selectedImageUri;
    private double currentLat = Double.NaN, currentLng = Double.NaN;
    private String currentLabel = "";

    private final ActivityResultLauncher<String> pickImageLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) {
                    selectedImageUri = uri;
                    ivPreview.setVisibility(View.VISIBLE);
                    ivPreview.setImageURI(uri);
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_report_disaster);

        supabase = new SupabaseClient(this);
        locationHelper = new LocationHelper(this);

        spinnerCategory = findViewById(R.id.spinnerCategory);
        etDescription = findViewById(R.id.etDescription);
        tvCoords = findViewById(R.id.tvReportCoords);
        ivPreview = findViewById(R.id.ivPreview);
        btnPickImage = findViewById(R.id.btnPickImage);
        btnSubmit = findViewById(R.id.btnSubmitReport);
        progressBar = findViewById(R.id.progressBar);
        llReportsContainer = findViewById(R.id.llReportsHistory);

        String[] categories = {"Flood", "Cyclone", "Earthquake", "Landslide", "Fire", "Storm", "Other"};
        spinnerCategory.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, categories));

        btnPickImage.setOnClickListener(v -> pickImageLauncher.launch("image/*"));
        btnSubmit.setOnClickListener(v -> submitReport());

        locationHelper.startLocationUpdates(new LocationHelper.LocationListener() {
            @Override
            public void onLocationUpdated(double lat, double lng, String placeLabel, boolean insideIndia) {
                currentLat = lat;
                currentLng = lng;
                currentLabel = placeLabel;
                tvCoords.setText(String.format(Locale.US, "%s (%.5f, %.5f)", placeLabel, lat, lng));
            }

            @Override
            public void onLocationError(String reason) {
                tvCoords.setText(reason);
            }
        });

        loadReports();
    }

    private void submitReport() {
        String category = spinnerCategory.getSelectedItem().toString();
        String description = etDescription.getText().toString().trim();
        if (description.isEmpty()) {
            Toast.makeText(this, "Enter a description of the incident.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (Double.isNaN(currentLat)) {
            Toast.makeText(this, "Waiting for live GPS coordinates.", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnSubmit.setEnabled(false);

        if (selectedImageUri != null) {
            try {
                byte[] bytes = readUriBytes(selectedImageUri);
                String mime = getContentResolver().getType(selectedImageUri);
                if (mime == null) mime = "image/jpeg";
                supabase.uploadDisasterImage(bytes, "report.jpg", mime, new SupabaseClient.ApiCallback<String>() {
                    @Override
                    public void onSuccess(String imageUrl) {
                        saveReportRecord(category, description, imageUrl);
                    }

                    @Override
                    public void onError(String errorMessage) {
                        progressBar.setVisibility(View.GONE);
                        btnSubmit.setEnabled(true);
                        Toast.makeText(ReportDisasterActivity.this, errorMessage, Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception e) {
                progressBar.setVisibility(View.GONE);
                btnSubmit.setEnabled(true);
                Toast.makeText(this, "Failed to read image: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        } else {
            saveReportRecord(category, description, "");
        }
    }

    private void saveReportRecord(String category, String description, String imageUrl) {
        supabase.insertDisasterReport(category, description, currentLat, currentLng, currentLabel, imageUrl,
                new SupabaseClient.ApiCallback<Models.DisasterReport>() {
                    @Override
                    public void onSuccess(Models.DisasterReport report) {
                        progressBar.setVisibility(View.GONE);
                        btnSubmit.setEnabled(true);
                        etDescription.setText("");
                        selectedImageUri = null;
                        ivPreview.setVisibility(View.GONE);
                        Toast.makeText(ReportDisasterActivity.this, "Disaster report saved.", Toast.LENGTH_SHORT).show();
                        loadReports();
                    }

                    @Override
                    public void onError(String errorMessage) {
                        progressBar.setVisibility(View.GONE);
                        btnSubmit.setEnabled(true);
                        Toast.makeText(ReportDisasterActivity.this, errorMessage, Toast.LENGTH_LONG).show();
                    }
                });
    }

    private byte[] readUriBytes(Uri uri) throws Exception {
        try (InputStream is = getContentResolver().openInputStream(uri);
             ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] data = new byte[8192];
            int nRead;
            while ((nRead = is.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            return buffer.toByteArray();
        }
    }

    private void loadReports() {
        supabase.fetchDisasterReports(new SupabaseClient.ApiCallback<List<Models.DisasterReport>>() {
            @Override
            public void onSuccess(List<Models.DisasterReport> reports) {
                llReportsContainer.removeAllViews();
                if (reports == null || reports.isEmpty()) {
                    TextView empty = new TextView(ReportDisasterActivity.this);
                    empty.setText("No disaster reports submitted yet.");
                    llReportsContainer.addView(empty);
                    return;
                }
                for (Models.DisasterReport r : reports) {
                    TextView row = new TextView(ReportDisasterActivity.this);
                    row.setPadding(0, 12, 0, 12);
                    row.setText(String.format(Locale.US, "[%s] %s\n%s\nLocation: %.4f, %.4f · %s",
                            r.category, r.status, r.description, r.latitude, r.longitude, r.created_at));
                    llReportsContainer.addView(row);
                }
            }

            @Override
            public void onError(String errorMessage) {
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationHelper != null) locationHelper.stopLocationUpdates();
    }
}
