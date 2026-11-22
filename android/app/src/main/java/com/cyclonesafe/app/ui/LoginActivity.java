package com.cyclonesafe.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
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
    private Button btnLogin;
    private TextView tvRegisterLink, tvError;
    private ProgressBar progressBar;
    private SupabaseClient supabase;
    private SessionManager session;

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
        btnLogin = findViewById(R.id.btnLogin);
        tvRegisterLink = findViewById(R.id.tvRegisterLink);
        tvError = findViewById(R.id.tvError);
        progressBar = findViewById(R.id.progressBar);

        btnLogin.setOnClickListener(v -> attemptLogin());
        tvRegisterLink.setOnClickListener(v ->
                startActivity(new Intent(this, RegisterActivity.class)));
    }

    private void attemptLogin() {
        String email = etEmail.getText().toString().trim();
        String password = etPassword.getText().toString();
        tvError.setVisibility(View.GONE);

        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            tvError.setText("Enter both email and password.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnLogin.setEnabled(false);

        supabase.signIn(email, password, new SupabaseClient.ApiCallback<Models.UserProfile>() {
            @Override
            public void onSuccess(Models.UserProfile profile) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                Toast.makeText(LoginActivity.this, "Welcome back, " + profile.full_name, Toast.LENGTH_SHORT).show();
                startActivity(new Intent(LoginActivity.this, MainActivity.class));
                finish();
            }

            @Override
            public void onError(String errorMessage) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                tvError.setText(errorMessage);
                tvError.setVisibility(View.VISIBLE);
            }
        });
    }
}
