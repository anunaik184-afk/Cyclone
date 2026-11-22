package com.cyclonesafe.app.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Patterns;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.SupabaseClient;

public class RegisterActivity extends AppCompatActivity {
    private EditText etFullName, etEmail, etPhone, etPassword, etConfirmPassword;
    private Button btnRegister, btnGoogleSignIn;
    private TextView tvError, tvLoginLink;
    private ProgressBar progressBar;
    private SupabaseClient supabase;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);
        supabase = new SupabaseClient(this);

        etFullName = findViewById(R.id.etFullName);
        etEmail = findViewById(R.id.etEmail);
        etPhone = findViewById(R.id.etPhone);
        etPassword = findViewById(R.id.etPassword);
        etConfirmPassword = findViewById(R.id.etConfirmPassword);
        btnGoogleSignIn = findViewById(R.id.btnGoogleSignIn);
        btnRegister = findViewById(R.id.btnRegister);
        tvError = findViewById(R.id.tvError);
        tvLoginLink = findViewById(R.id.tvLoginLink);
        progressBar = findViewById(R.id.progressBar);

        btnGoogleSignIn.setOnClickListener(v -> launchGoogleOAuth());
        btnRegister.setOnClickListener(v -> submitRegistration());
        tvLoginLink.setOnClickListener(v -> finish());
    }

    private void launchGoogleOAuth() {
        tvError.setVisibility(View.GONE);
        String authUrl = supabase.buildGoogleOAuthAuthorizeUrl();
        if (authUrl.isEmpty()) {
            showError("Invalid OAuth configuration: Supabase publishable key is missing.");
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)));
        } catch (Exception e) {
            showError("Unable to open Google Sign-In browser: " + e.getMessage());
        }
    }

    private void submitRegistration() {
        String fullName = etFullName.getText().toString().trim();
        String email = etEmail.getText().toString().trim();
        String phone = etPhone.getText().toString().trim();
        String password = etPassword.getText().toString();
        String confirm = etConfirmPassword.getText().toString();
        tvError.setVisibility(View.GONE);

        if (TextUtils.isEmpty(fullName) || TextUtils.isEmpty(email) || TextUtils.isEmpty(phone)) {
            showError("All fields are required.");
            return;
        }
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            showError("Enter a valid email address.");
            return;
        }
        if (password.length() < 8) {
            showError("Password must be at least 8 characters.");
            return;
        }
        if (!password.equals(confirm)) {
            showError("Passwords do not match.");
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnRegister.setEnabled(false);

        supabase.signUpWithEmailOtp(fullName, email, phone, password, new SupabaseClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String msg) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);
                android.widget.Toast.makeText(RegisterActivity.this, msg, android.widget.Toast.LENGTH_LONG).show();
                Intent intent = new Intent(RegisterActivity.this, OtpVerificationActivity.class);
                intent.putExtra("email", email);
                intent.putExtra("full_name", fullName);
                intent.putExtra("phone", phone);
                intent.putExtra("purpose", "signup");
                intent.putExtra("has_active_otp", true);
                startActivity(intent);
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);
                showError(errorMessage);
            }
        });
    }

    private void showError(String msg) {
        tvError.setText(msg);
        tvError.setVisibility(View.VISIBLE);
    }
}
