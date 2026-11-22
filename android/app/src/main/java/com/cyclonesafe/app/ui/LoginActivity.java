package com.cyclonesafe.app.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.text.TextUtils;
import android.util.Patterns;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.SessionManager;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;

public class LoginActivity extends AppCompatActivity {
    private EditText etEmail, etPassword;
    private Button btnLogin, btnOtpLogin, btnGoogleSignIn;
    private TextView tvRegisterLink, tvError, tvVerifyPendingLink;
    private ProgressBar progressBar;
    private SupabaseClient supabase;
    private SessionManager session;
    private CountDownTimer otpCooldownTimer;
    private int otpCooldownSeconds = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        session = new SessionManager(this);
        if (session.isLoggedInAndVerified()) {
            startActivity(new Intent(this, MainActivity.class));
            finish();
            return;
        }
        setContentView(R.layout.activity_login);
        supabase = new SupabaseClient(this);

        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        btnGoogleSignIn = findViewById(R.id.btnGoogleSignIn);
        btnLogin = findViewById(R.id.btnLogin);
        btnOtpLogin = findViewById(R.id.btnOtpLogin);
        tvRegisterLink = findViewById(R.id.tvRegisterLink);
        tvVerifyPendingLink = findViewById(R.id.tvVerifyPendingLink);
        tvError = findViewById(R.id.tvError);
        progressBar = findViewById(R.id.progressBar);

        btnGoogleSignIn.setOnClickListener(v -> launchGoogleOAuth());
        btnOtpLogin.setOnClickListener(v -> sendPasswordlessLoginOtp());
        btnLogin.setOnClickListener(v -> attemptPasswordLogin());
        tvRegisterLink.setOnClickListener(v ->
                startActivity(new Intent(this, RegisterActivity.class)));
        tvVerifyPendingLink.setOnClickListener(v -> openPendingSignupOtp());

        handleOAuthIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOAuthIntent(intent);
    }

    private void launchGoogleOAuth() {
        tvError.setVisibility(View.GONE);
        String authUrl = supabase.buildGoogleOAuthAuthorizeUrl();
        if (authUrl.isEmpty()) {
            tvError.setText("Invalid OAuth configuration: Supabase publishable key is missing.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)));
        } catch (Exception e) {
            tvError.setText("Unable to open Google Sign-In browser: " + e.getMessage());
            tvError.setVisibility(View.VISIBLE);
        }
    }

    private void handleOAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"cyclonesafe".equals(data.getScheme()) || !"auth".equals(data.getHost())) return;
        progressBar.setVisibility(View.VISIBLE);
        btnGoogleSignIn.setEnabled(false);
        supabase.completeGoogleOAuthCallback(data, new SupabaseClient.ApiCallback<Models.UserProfile>() {
            @Override
            public void onSuccess(Models.UserProfile profile) {
                progressBar.setVisibility(View.GONE);
                btnGoogleSignIn.setEnabled(true);
                Toast.makeText(LoginActivity.this, "Welcome, " + profile.full_name, Toast.LENGTH_SHORT).show();
                Intent main = new Intent(LoginActivity.this, MainActivity.class);
                main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(main);
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnGoogleSignIn.setEnabled(true);
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
            }
        });
    }

    private void sendPasswordlessLoginOtp() {
        String email = etEmail.getText().toString().trim();
        tvError.setVisibility(View.GONE);
        tvVerifyPendingLink.setVisibility(View.GONE);

        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tvError.setText("Enter a valid registered email address.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }
        if (otpCooldownSeconds > 0) {
            tvError.setText("Please wait " + otpCooldownSeconds + "s before requesting another OTP.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnOtpLogin.setEnabled(false);
        btnLogin.setEnabled(false);

        supabase.sendLoginEmailOtp(email, new SupabaseClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String message) {
                progressBar.setVisibility(View.GONE);
                btnOtpLogin.setEnabled(true);
                btnLogin.setEnabled(true);
                Toast.makeText(LoginActivity.this, message, Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(LoginActivity.this, OtpVerificationActivity.class);
                intent.putExtra("email", email);
                intent.putExtra("purpose", "email");
                intent.putExtra("has_active_otp", true);
                startActivity(intent);
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);

                int waitSecs = SupabaseClient.extractRateLimitSeconds(errorMessage);
                if (waitSecs > 0) {
                    startOtpCooldown(waitSecs);
                } else {
                    btnOtpLogin.setEnabled(true);
                }
            }
        });
    }

    private void attemptPasswordLogin() {
        String email = etEmail.getText().toString().trim();
        String password = etPassword.getText().toString();
        tvError.setVisibility(View.GONE);
        tvVerifyPendingLink.setVisibility(View.GONE);

        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            tvError.setText("Enter both email and password.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnLogin.setEnabled(false);
        btnOtpLogin.setEnabled(false);

        supabase.signIn(email, password, new SupabaseClient.ApiCallback<Models.UserProfile>() {
            @Override
            public void onSuccess(Models.UserProfile profile) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                btnOtpLogin.setEnabled(otpCooldownSeconds == 0);
                Toast.makeText(LoginActivity.this, "Welcome back, " + profile.full_name, Toast.LENGTH_SHORT).show();
                startActivity(new Intent(LoginActivity.this, MainActivity.class));
                finish();
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                btnOtpLogin.setEnabled(otpCooldownSeconds == 0);
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
                if (errorMessage != null && errorMessage.toLowerCase().contains("not confirmed")) {
                    tvVerifyPendingLink.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    private void openPendingSignupOtp() {
        String email = etEmail.getText().toString().trim();
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tvError.setText("Enter your registered email address first.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }
        Intent intent = new Intent(this, OtpVerificationActivity.class);
        intent.putExtra("email", email);
        intent.putExtra("purpose", "signup");
        intent.putExtra("skip_initial_cooldown", true);
        intent.putExtra("has_active_otp", false);
        startActivity(intent);
    }

    private void startOtpCooldown(int seconds) {
        otpCooldownSeconds = seconds;
        btnOtpLogin.setEnabled(false);
        if (otpCooldownTimer != null) otpCooldownTimer.cancel();
        otpCooldownTimer = new CountDownTimer(seconds * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                otpCooldownSeconds = (int) Math.ceil(millisUntilFinished / 1000.0);
                btnOtpLogin.setText("Wait (" + otpCooldownSeconds + "s)");
            }

            @Override
            public void onFinish() {
                otpCooldownSeconds = 0;
                btnOtpLogin.setEnabled(true);
                btnOtpLogin.setText("Sign In with 6-Digit Email OTP");
            }
        }.start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (otpCooldownTimer != null) otpCooldownTimer.cancel();
    }
}
