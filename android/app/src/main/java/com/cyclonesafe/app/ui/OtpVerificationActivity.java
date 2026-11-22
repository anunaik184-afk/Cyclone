package com.cyclonesafe.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;
import java.util.Locale;

public class OtpVerificationActivity extends AppCompatActivity {
    private static final int OTP_VALIDITY_SECONDS = 120;

    private EditText etOtp;
    private Button btnVerify, btnResend;
    private TextView tvEmailInfo, tvOtpExpiry, tvError;
    private ProgressBar progressBar;
    private SupabaseClient supabase;
    private String email, fullName, phone, purpose;
    private CountDownTimer resendTimer;
    private CountDownTimer expiryTimer;
    private boolean isOtpExpired = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_otp_verification);
        supabase = new SupabaseClient(this);

        email = getIntent().getStringExtra("email");
        fullName = getIntent().getStringExtra("full_name");
        phone = getIntent().getStringExtra("phone");
        purpose = getIntent().getStringExtra("purpose");
        if (TextUtils.isEmpty(purpose)) {
            purpose = "signup";
        }
        boolean skipInitialCooldown = getIntent().getBooleanExtra("skip_initial_cooldown", false);
        boolean hasActiveOtp = getIntent().getBooleanExtra("has_active_otp", !skipInitialCooldown);

        etOtp = findViewById(R.id.etOtp);
        btnVerify = findViewById(R.id.btnVerify);
        btnResend = findViewById(R.id.btnResend);
        tvEmailInfo = findViewById(R.id.tvEmailInfo);
        tvOtpExpiry = findViewById(R.id.tvOtpExpiry);
        tvError = findViewById(R.id.tvError);
        progressBar = findViewById(R.id.progressBar);

        if ("email".equals(purpose)) {
            tvEmailInfo.setText("Confirmation email sent to " + email + ". Please check your inbox and spam folder for the 6-digit login code (valid for 2 minutes).");
        } else {
            tvEmailInfo.setText("Registration successful. Confirmation email sent to " + email + ". Please check your inbox and spam folder for the 6-digit code (valid for 2 minutes).");
        }

        btnVerify.setOnClickListener(v -> verifyCode());
        btnResend.setOnClickListener(v -> resendCode());
        if (!skipInitialCooldown) {
            startCooldown(60);
        }
        if (hasActiveOtp) {
            startExpiryTimer(OTP_VALIDITY_SECONDS);
        }
    }

    private void verifyCode() {
        String code = etOtp.getText().toString().replaceAll("\\s+", "");
        tvError.setVisibility(View.GONE);
        if (TextUtils.isEmpty(email)) {
            tvError.setText("Missing email address for OTP verification.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }
        if (isOtpExpired) {
            tvError.setText("Your 2-minute OTP has expired. Tap Resend OTP to request a new code.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }
        if (!code.matches("\\d{6,8}")) {
            tvError.setText("Enter the 6-digit numeric OTP sent to your email.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnVerify.setEnabled(false);

        supabase.verifyEmailOtp(email, code, purpose, fullName, phone, new SupabaseClient.ApiCallback<Models.UserProfile>() {
            @Override
            public void onSuccess(Models.UserProfile profile) {
                progressBar.setVisibility(View.GONE);
                btnVerify.setEnabled(true);
                Toast.makeText(OtpVerificationActivity.this, "Email verified. Opening dashboard...", Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(OtpVerificationActivity.this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnVerify.setEnabled(!isOtpExpired);
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
            }
        });
    }

    private void resendCode() {
        if (TextUtils.isEmpty(email)) {
            tvError.setText("Missing email address to resend OTP.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }
        tvError.setVisibility(View.GONE);
        btnResend.setEnabled(false);

        supabase.resendOtp(email, purpose, new SupabaseClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String msg) {
                Toast.makeText(OtpVerificationActivity.this, msg + " (valid for 2 minutes)", Toast.LENGTH_SHORT).show();
                startCooldown(60);
                startExpiryTimer(OTP_VALIDITY_SECONDS);
            }

            @Override
            public void onError(String errorMessage) {
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
                int waitSecs = SupabaseClient.extractRateLimitSeconds(errorMessage);
                if (waitSecs > 0) {
                    startCooldown(waitSecs);
                } else {
                    btnResend.setEnabled(true);
                }
            }
        });
    }

    private void startExpiryTimer(int seconds) {
        isOtpExpired = false;
        btnVerify.setEnabled(true);
        tvOtpExpiry.setVisibility(View.VISIBLE);
        tvOtpExpiry.setTextColor(ContextCompat.getColor(this, R.color.brand_slate));
        if (expiryTimer != null) expiryTimer.cancel();
        expiryTimer = new CountDownTimer(seconds * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int remaining = (int) Math.ceil(millisUntilFinished / 1000.0);
                int mins = remaining / 60;
                int secs = remaining % 60;
                tvOtpExpiry.setText(String.format(Locale.US, "OTP expires in %02d:%02d", mins, secs));
                if (remaining <= 30) {
                    tvOtpExpiry.setTextColor(ContextCompat.getColor(OtpVerificationActivity.this, R.color.emergency_red));
                }
            }

            @Override
            public void onFinish() {
                isOtpExpired = true;
                btnVerify.setEnabled(false);
                tvOtpExpiry.setText("OTP expired (2-minute limit). Tap Resend OTP for a new code.");
                tvOtpExpiry.setTextColor(ContextCompat.getColor(OtpVerificationActivity.this, R.color.emergency_red));
            }
        }.start();
    }

    private void startCooldown(int seconds) {
        btnResend.setEnabled(false);
        if (resendTimer != null) resendTimer.cancel();
        resendTimer = new CountDownTimer(seconds * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                btnResend.setText("Resend OTP (" + (long) Math.ceil(millisUntilFinished / 1000.0) + "s)");
            }

            @Override
            public void onFinish() {
                btnResend.setEnabled(true);
                btnResend.setText("Resend OTP");
            }
        }.start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (resendTimer != null) resendTimer.cancel();
        if (expiryTimer != null) expiryTimer.cancel();
    }
}
