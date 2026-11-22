package com.cyclonesafe.app.data;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

public class SessionManager {
    private static final String PREF_NAME = "cyclonesafe_secure_session";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_EMAIL = "user_email";
    private static final String KEY_FULL_NAME = "full_name";
    private static final String KEY_PHONE = "phone";
    private static final String KEY_EMAIL_VERIFIED = "email_verified";

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        SharedPreferences p;
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            p = EncryptedSharedPreferences.create(
                    context,
                    PREF_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception e) {
            p = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        }
        this.prefs = p;
    }

    public void saveSession(String accessToken, String refreshToken, String userId, String email, boolean verified) {
        prefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .putString(KEY_USER_ID, userId)
                .putString(KEY_EMAIL, email)
                .putBoolean(KEY_EMAIL_VERIFIED, verified)
                .apply();
    }

    public void saveProfileMeta(String fullName, String phone) {
        prefs.edit()
                .putString(KEY_FULL_NAME, fullName)
                .putString(KEY_PHONE, phone)
                .apply();
    }

    public String getAccessToken() {
        return prefs.getString(KEY_ACCESS_TOKEN, "");
    }

    public String getRefreshToken() {
        return prefs.getString(KEY_REFRESH_TOKEN, "");
    }

    public String getUserId() {
        return prefs.getString(KEY_USER_ID, "");
    }

    public String getEmail() {
        return prefs.getString(KEY_EMAIL, "");
    }

    public String getFullName() {
        return prefs.getString(KEY_FULL_NAME, "");
    }

    public String getPhone() {
        return prefs.getString(KEY_PHONE, "");
    }

    public boolean isLoggedInAndVerified() {
        return !getAccessToken().isEmpty()
                && !getUserId().isEmpty()
                && prefs.getBoolean(KEY_EMAIL_VERIFIED, false);
    }

    public void clearSession() {
        prefs.edit().clear().apply();
    }
}
