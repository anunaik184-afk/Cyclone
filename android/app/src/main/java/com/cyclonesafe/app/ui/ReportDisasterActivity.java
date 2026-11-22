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
import com.bumptech.glide.Glide;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.LocationHelper;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;

public class ReportDisasterActivity extends AppCompatActivity {
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
                    String mime = getContentResolver().getType(uri);
                    if (mime != null && !mime.startsWith("image/")) {
                        Toast.makeText(this, "Please select a valid image file.", Toast.LENGTH_SHORT).show();
                        return;
                    }
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

        String[] categories = {"Flood", "Cyclone", "Earthquake", "Landslide", "Fire", "Tsunami", "Other"};
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
                if (bytes.length == 0) {
                    progressBar.setVisibility(View.GONE);
                    btnSubmit.setEnabled(true);
                    Toast.makeText(this, "Selected image file is empty.", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (bytes.length > MAX_IMAGE_BYTES) {
                    progressBar.setVisibility(View.GONE);
                    btnSubmit.setEnabled(true);
                    Toast.makeText(this, "Incident photo must be 5 MB or smaller.", Toast.LENGTH_SHORT).show();
                    return;
                }
                String mime = getContentResolver().getType(selectedImageUri);
                if (mime == null || !mime.startsWith("image/")) mime = "image/jpeg";
                String ext = "jpg";
                if ("image/png".equalsIgnoreCase(mime)) ext = "png";
                else if ("image/webp".equalsIgnoreCase(mime)) ext = "webp";
                String fileName = "report." + ext;

                supabase.uploadDisasterImage(bytes, fileName, mime, new SupabaseClient.ApiCallback<String[]>() {
                    @Override
                    public void onSuccess(String[] uploadResult) {
                        saveReportRecord(category, description, uploadResult[1], uploadResult[0]);
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
            saveReportRecord(category, description, "", "");
        }
    }

    private void saveReportRecord(String category, String description, String photoUrl, String photoPath) {
        supabase.insertDisasterReport(category, description, currentLat, currentLng, currentLabel, photoUrl, photoPath,
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
                        if (photoPath != null && !photoPath.isEmpty()) {
                            supabase.deleteDisasterImage(photoPath);
                        }
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

    private String resolveStoragePath(Models.DisasterReport r) {
        if (r.incident_photo_path != null && !r.incident_photo_path.trim().isEmpty()) {
            return r.incident_photo_path.trim();
        }
        if (r.incident_photo_url != null && r.incident_photo_url.contains("/disaster-reports/")) {
            int idx = r.incident_photo_url.indexOf("/disaster-reports/") + "/disaster-reports/".length();
            String rest = r.incident_photo_url.substring(idx);
            int qIdx = rest.indexOf('?');
            return qIdx >= 0 ? rest.substring(0, qIdx) : rest;
        }
        return "";
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
                int imgHeightPx = (int) (180 * getResources().getDisplayMetrics().density);
                for (Models.DisasterReport r : reports) {
                    TextView row = new TextView(ReportDisasterActivity.this);
                    row.setPadding(0, 12, 0, 8);
                    row.setText(String.format(Locale.US, "[%s] %s\n%s\nLocation: %.4f, %.4f · %s",
                            r.disaster_category, r.status, r.description, r.latitude, r.longitude, r.created_at));
                    llReportsContainer.addView(row);

                    String storagePath = resolveStoragePath(r);
                    if (!storagePath.isEmpty()) {
                        ImageView reportImage = new ImageView(ReportDisasterActivity.this);
                        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT, imgHeightPx);
                        lp.bottomMargin = 16;
                        reportImage.setLayoutParams(lp);
                        reportImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
                        reportImage.setVisibility(View.GONE);
                        llReportsContainer.addView(reportImage);

                        supabase.createSignedReportImageUrl(storagePath, new SupabaseClient.ApiCallback<String[]>() {
                            @Override
                            public void onSuccess(String[] signedResult) {
                                if (!isFinishing() && !isDestroyed() && signedResult.length >= 2 && signedResult[1].startsWith("http")) {
                                    reportImage.setVisibility(View.VISIBLE);
                                    Glide.with(ReportDisasterActivity.this)
                                            .load(signedResult[1])
                                            .centerCrop()
                                            .into(reportImage);
                                }
                            }

                            @Override
                            public void onError(String errorMessage) {
                                reportImage.setVisibility(View.GONE);
                            }
                        });
                    }
                }
            }

            @Override
            public void onError(String errorMessage) {
                Toast.makeText(ReportDisasterActivity.this, errorMessage, Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationHelper != null) locationHelper.stopLocationUpdates();
    }
}
