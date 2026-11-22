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
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;

public class OtpVerificationActivity extends AppCompatActivity {
    private EditText etOtp;
    private Button btnVerify, btnResend;
    private TextView tvEmailInfo, tvError;
    private ProgressBar progressBar;
    private SupabaseClient supabase;
    private String email, fullName, phone;
    private CountDownTimer resendTimer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_otp_verification);
        supabase = new SupabaseClient(this);

        email = getIntent().getStringExtra("email");
        fullName = getIntent().getStringExtra("full_name");
        phone = getIntent().getStringExtra("phone");

        etOtp = findViewById(R.id.etOtp);
        btnVerify = findViewById(R.id.btnVerify);
        btnResend = findViewById(R.id.btnResend);
        tvEmailInfo = findViewById(R.id.tvEmailInfo);
        tvError = findViewById(R.id.tvError);
        progressBar = findViewById(R.id.progressBar);

        tvEmailInfo.setText("Enter the 6-digit verification code sent to " + email);

        btnVerify.setOnClickListener(v -> verifyCode());
        btnResend.setOnClickListener(v -> resendCode());
        startCooldown();
    }

    private void verifyCode() {
        String code = etOtp.getText().toString().trim();
        tvError.setVisibility(View.GONE);
        if (TextUtils.isEmpty(code) || code.length() < 6) {
            tvError.setText("Enter the full verification code from your email.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnVerify.setEnabled(false);

        supabase.verifyEmailOtp(email, code, fullName, phone, new SupabaseClient.ApiCallback<Models.UserProfile>() {
            @Override
            public void onSuccess(Models.UserProfile profile) {
                progressBar.setVisibility(View.GONE);
                btnVerify.setEnabled(true);
                Toast.makeText(OtpVerificationActivity.this, "Email verified and profile saved.", Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(OtpVerificationActivity.this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnVerify.setEnabled(true);
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
            }
        });
    }

    private void resendCode() {
        btnResend.setEnabled(false);
        supabase.resendSignupOtp(email, new SupabaseClient.ApiCallback<String>() {
            @Override
            public void onSuccess(String msg) {
                Toast.makeText(OtpVerificationActivity.this, msg, Toast.LENGTH_SHORT).show();
                startCooldown();
            }

            @Override
            public void onError(String errorMessage) {
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
                btnResend.setEnabled(true);
            }
        });
    }

    private void startCooldown() {
        btnResend.setEnabled(false);
        if (resendTimer != null) resendTimer.cancel();
        resendTimer = new CountDownTimer(60000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                btnResend.setText("Resend OTP (" + (millisUntilFinished / 1000) + "s)");
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
    }
}
