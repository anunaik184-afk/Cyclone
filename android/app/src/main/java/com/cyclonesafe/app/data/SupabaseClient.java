package com.cyclonesafe.app.data;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.cyclonesafe.app.BuildConfig;
import com.cyclonesafe.app.model.Models;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;
import java.io.IOException;
import java.lang.reflect.Type;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class SupabaseClient {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private final OkHttpClient httpClient;
    private final Gson gson;
    private final SessionManager session;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface ApiCallback<T> {
        void onSuccess(T result);
        void onError(String errorMessage);
    }

    public SupabaseClient(Context context) {
        this.session = new SessionManager(context);
        this.gson = new Gson();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(25, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    private String baseUrl() {
        return BuildConfig.SUPABASE_URL;
    }

    private String publishableKey() {
        return BuildConfig.SUPABASE_PUBLISHABLE_KEY;
    }

    private boolean isConfigured() {
        return baseUrl() != null && !baseUrl().isEmpty()
                && publishableKey() != null && !publishableKey().isEmpty();
    }

    private <T> void postSuccess(ApiCallback<T> cb, T data) {
        mainHandler.post(() -> cb.onSuccess(data));
    }

    private <T> void postError(ApiCallback<T> cb, String message) {
        mainHandler.post(() -> cb.onError(message));
    }

    private String parseErrorBody(String body, int code) {
        String extracted = "";
        try {
            JsonObject obj = JsonParser.parseString(body).getAsJsonObject();
            if (obj.has("msg") && !obj.get("msg").isJsonNull()) {
                extracted = obj.get("msg").getAsString();
            } else if (obj.has("error_description") && !obj.get("error_description").isJsonNull()) {
                extracted = obj.get("error_description").getAsString();
            } else if (obj.has("message") && !obj.get("message").isJsonNull()) {
                extracted = obj.get("message").getAsString();
            } else if (obj.has("error") && !obj.get("error").isJsonNull()) {
                extracted = obj.get("error").getAsString();
            }
            if (obj.has("error_code") && !obj.get("error_code").isJsonNull() && !extracted.isEmpty()) {
                String errorCode = obj.get("error_code").getAsString();
                if (!extracted.toLowerCase().contains(errorCode.toLowerCase())) {
                    extracted = extracted + " [" + errorCode + "]";
                }
            }
        } catch (Exception ignored) {
        }
        String lower = extracted.toLowerCase();
        if (code >= 500 || lower.contains("sending confirmation") || lower.contains("535")
                || lower.contains("5.7.8") || lower.contains("username and password not accepted")
                || lower.contains("smtp") || lower.contains("unexpected_failure")) {
            String detail = extracted.isEmpty() ? ("HTTP " + code) : extracted;
            return "Email sending failed. Supabase Custom SMTP authentication or delivery failed (" + detail
                    + "). Check Custom SMTP credentials in Supabase Dashboard → Authentication → SMTP Settings.";
        }
        if (lower.contains("otp_expired") || lower.contains("expired") || lower.contains("invalid")) {
            return "Invalid or expired confirmation link or OTP. Please resend a new confirmation email. (" + extracted + ")";
        }
        if (!extracted.isEmpty()) {
            return extracted;
        }
        if (code == 429) {
            return "Email rate limit exceeded (HTTP 429). Please wait before requesting another confirmation email.";
        }
        return "Request failed (HTTP " + code + ")";
    }

    public static int extractRateLimitSeconds(String errorMessage) {
        if (errorMessage == null) return 0;
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(?:after|in|wait)\\s+(\\d+)\\s+second", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(errorMessage);
        if (m.find()) {
            try {
                int secs = Integer.parseInt(m.group(1));
                if (secs > 0) return Math.min(Math.max(secs, 5), 300);
            } catch (NumberFormatException ignored) {
            }
        }
        String lower = errorMessage.toLowerCase();
        if (lower.contains("429") || lower.contains("rate limit") || lower.contains("too many requests") || lower.contains("over_email_send_rate_limit")) {
            return 60;
        }
        return 0;
    }

    // 1. REGISTER & SEND REAL EMAIL OTP
    public void signUpWithEmailOtp(String fullName, String email, String phone, String password, ApiCallback<String> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        JsonObject metadata = new JsonObject();
        metadata.addProperty("full_name", fullName);
        metadata.addProperty("phone", phone);

        JsonObject payload = new JsonObject();
        payload.addProperty("email", email);
        payload.addProperty("password", password);
        payload.add("data", metadata);

        Request request = new Request.Builder()
                .url(baseUrl() + "/auth/v1/signup")
                .addHeader("apikey", publishableKey())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                try {
                    JsonObject obj = JsonParser.parseString(body).getAsJsonObject();
                    if (obj.has("access_token") && !obj.get("access_token").isJsonNull()
                            && !obj.get("access_token").getAsString().isEmpty()) {
                        postError(cb, "Email confirmation must remain enabled in Supabase Auth. Cannot auto-verify accounts.");
                        return;
                    }
                    JsonObject userObj = obj.has("user") && obj.get("user").isJsonObject()
                            ? obj.getAsJsonObject("user")
                            : obj;
                    if (userObj.has("identities") && userObj.get("identities").isJsonArray()
                            && userObj.getAsJsonArray("identities").size() == 0) {
                        postError(cb, "An account with this email already exists. Use Sign In or Passwordless Email OTP Login.");
                        return;
                    }
                } catch (Exception e) {
                    postError(cb, "Unexpected signup response from Supabase.");
                    return;
                }
                session.saveProfileMeta(fullName, phone);
                postSuccess(cb, "Registration successful. Confirmation email sent to " + email + ". Please check your inbox and spam folder.");
            }
        });
    }

    // 1B. SEND PASSWORDLESS LOGIN OTP FOR EXISTING REGISTERED USERS
    public void sendLoginEmailOtp(String email, ApiCallback<String> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        JsonObject payload = new JsonObject();
        payload.addProperty("email", email);
        payload.addProperty("create_user", false);

        Request request = new Request.Builder()
                .url(baseUrl() + "/auth/v1/otp")
                .addHeader("apikey", publishableKey())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                postSuccess(cb, "6-digit login OTP sent to " + email);
            }
        });
    }

    // 2. VERIFY EMAIL OTP VIA SUPABASE AUTH (signup or email login)
    public void verifyEmailOtp(String email, String token, String fullName, String phone, ApiCallback<Models.UserProfile> cb) {
        verifyEmailOtp(email, token, "signup", fullName, phone, cb);
    }

    public void verifyEmailOtp(String email, String token, String otpType, String fullName, String phone, ApiCallback<Models.UserProfile> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        String resolvedType = ("email".equals(otpType)) ? "email" : "signup";
        JsonObject payload = new JsonObject();
        payload.addProperty("type", resolvedType);
        payload.addProperty("email", email);
        payload.addProperty("token", token);

        Request request = new Request.Builder()
                .url(baseUrl() + "/auth/v1/verify")
                .addHeader("apikey", publishableKey())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                try {
                    JsonObject obj = JsonParser.parseString(body).getAsJsonObject();
                    String accessToken = obj.has("access_token") && !obj.get("access_token").isJsonNull()
                            ? obj.get("access_token").getAsString()
                            : "";
                    String refreshToken = obj.has("refresh_token") && !obj.get("refresh_token").isJsonNull()
                            ? obj.get("refresh_token").getAsString()
                            : "";
                    JsonObject userObj = obj.getAsJsonObject("user");
                    String userId = userObj.get("id").getAsString();
                    String confirmedEmail = userObj.has("email") && !userObj.get("email").isJsonNull()
                            ? userObj.get("email").getAsString()
                            : email;
                    boolean emailConfirmed = userObj.has("email_confirmed_at") && !userObj.get("email_confirmed_at").isJsonNull();

                    if (accessToken.isEmpty() || !emailConfirmed) {
                        postError(cb, "Email verification incomplete. Please enter a valid OTP.");
                        return;
                    }

                    String metaName = "";
                    String metaPhone = "";
                    if (userObj.has("user_metadata") && userObj.get("user_metadata").isJsonObject()) {
                        JsonObject meta = userObj.getAsJsonObject("user_metadata");
                        if (meta.has("full_name") && !meta.get("full_name").isJsonNull()) {
                            metaName = meta.get("full_name").getAsString();
                        }
                        if (meta.has("phone") && !meta.get("phone").isJsonNull()) {
                            metaPhone = meta.get("phone").getAsString();
                        }
                    }

                    String fallbackName = (fullName != null && !fullName.trim().isEmpty())
                            ? fullName.trim()
                            : (!metaName.isEmpty() ? metaName : confirmedEmail);
                    String fallbackPhone = (phone != null && !phone.trim().isEmpty())
                            ? phone.trim()
                            : metaPhone;

                    session.saveSession(accessToken, refreshToken, userId, confirmedEmail, true);
                    resolveOrCreateProfile(userId, fallbackName, confirmedEmail, fallbackPhone, cb);
                } catch (Exception e) {
                    postError(cb, "Failed to parse verification response.");
                }
            }
        });
    }

    // 3. RESEND EMAIL OTP (signup or passwordless email login)
    public void resendSignupOtp(String email, ApiCallback<String> cb) {
        resendOtp(email, "signup", cb);
    }

    public void resendOtp(String email, String otpType, ApiCallback<String> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        if ("email".equals(otpType)) {
            sendLoginEmailOtp(email, cb);
            return;
        }

        JsonObject payload = new JsonObject();
        payload.addProperty("type", "signup");
        payload.addProperty("email", email);

        Request request = new Request.Builder()
                .url(baseUrl() + "/auth/v1/resend")
                .addHeader("apikey", publishableKey())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                postSuccess(cb, "Confirmation email sent to " + email + ". Please check your inbox and spam folder.");
            }
        });
    }

    // 4. LOGIN WITH EMAIL & PASSWORD
    public void signIn(String email, String password, ApiCallback<Models.UserProfile> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        JsonObject payload = new JsonObject();
        payload.addProperty("email", email);
        payload.addProperty("password", password);

        Request request = new Request.Builder()
                .url(baseUrl() + "/auth/v1/token?grant_type=password")
                .addHeader("apikey", publishableKey())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                try {
                    JsonObject obj = JsonParser.parseString(body).getAsJsonObject();
                    String accessToken = obj.get("access_token").getAsString();
                    String refreshToken = obj.get("refresh_token").getAsString();
                    JsonObject userObj = obj.getAsJsonObject("user");
                    String userId = userObj.get("id").getAsString();
                    boolean emailConfirmed = userObj.has("email_confirmed_at") && !userObj.get("email_confirmed_at").isJsonNull();

                    if (!emailConfirmed) {
                        postError(cb, "Email not confirmed. Please complete OTP verification.");
                        return;
                    }
                    session.saveSession(accessToken, refreshToken, userId, email, true);
                    fetchProfile(cb);
                } catch (Exception e) {
                    postError(cb, "Unable to parse login session.");
                }
            }
        });
    }

    // 4B. GOOGLE OAUTH VIA SUPABASE AUTH (NO OTP REQUIRED)
    public String buildGoogleOAuthAuthorizeUrl() {
        if (!isConfigured()) {
            return "";
        }
        String redirect = URLEncoder.encode("cyclonesafe://auth/callback", StandardCharsets.UTF_8);
        return baseUrl() + "/auth/v1/authorize?provider=google&redirect_to=" + redirect + "&prompt=select_account";
    }

    public void completeGoogleOAuthCallback(android.net.Uri callbackUri, ApiCallback<Models.UserProfile> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        if (callbackUri == null) {
            postError(cb, "Google authentication failed: missing callback URI.");
            return;
        }
        String fragment = callbackUri.getEncodedFragment();
        android.net.Uri fragmentUri = fragment != null && !fragment.isEmpty()
                ? android.net.Uri.parse("cyclonesafe://callback?" + fragment)
                : null;

        String err = callbackUri.getQueryParameter("error");
        if (err == null && fragmentUri != null) err = fragmentUri.getQueryParameter("error");
        String errDesc = callbackUri.getQueryParameter("error_description");
        if (errDesc == null && fragmentUri != null) errDesc = fragmentUri.getQueryParameter("error_description");

        if (err != null && !err.isEmpty()) {
            String lower = (err + " " + (errDesc == null ? "" : errDesc)).toLowerCase();
            if (lower.contains("access_denied") || lower.contains("cancel")) {
                postError(cb, "Google authentication cancelled. Tap Continue with Google to try again.");
            } else if (lower.contains("invalid_client") || lower.contains("provider") || lower.contains("redirect")) {
                postError(cb, "Invalid OAuth configuration: " + (errDesc != null ? errDesc : err));
            } else {
                postError(cb, "Google authentication failed: " + (errDesc != null ? errDesc : err));
            }
            return;
        }

        String accessToken = fragmentUri != null ? fragmentUri.getQueryParameter("access_token") : null;
        String refreshToken = fragmentUri != null ? fragmentUri.getQueryParameter("refresh_token") : "";
        if (accessToken == null || accessToken.isEmpty()) {
            accessToken = callbackUri.getQueryParameter("access_token");
        }
        if (refreshToken == null) refreshToken = "";

        if (accessToken == null || accessToken.isEmpty()) {
            postError(cb, "Google authentication failed: no active session token returned.");
            return;
        }

        final String resolvedAccess = accessToken;
        final String resolvedRefresh = refreshToken;
        Request userReq = new Request.Builder()
                .url(baseUrl() + "/auth/v1/user")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + resolvedAccess)
                .get()
                .build();

        httpClient.newCall(userReq).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Network connection problem: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, "Google authentication failed: " + parseErrorBody(body, response.code()));
                    return;
                }
                try {
                    JsonObject userObj = JsonParser.parseString(body).getAsJsonObject();
                    String userId = userObj.get("id").getAsString();
                    String email = userObj.has("email") && !userObj.get("email").isJsonNull()
                            ? userObj.get("email").getAsString()
                            : "";
                    String displayName = email;
                    if (userObj.has("user_metadata") && userObj.get("user_metadata").isJsonObject()) {
                        JsonObject meta = userObj.getAsJsonObject("user_metadata");
                        if (meta.has("full_name") && !meta.get("full_name").isJsonNull()) {
                            displayName = meta.get("full_name").getAsString();
                        } else if (meta.has("name") && !meta.get("name").isJsonNull()) {
                            displayName = meta.get("name").getAsString();
                        }
                    }
                    session.saveSession(resolvedAccess, resolvedRefresh, userId, email, true);
                    resolveOrCreateProfile(userId, displayName, email, "", cb);
                } catch (Exception e) {
                    postError(cb, "Unable to verify Google account session.");
                }
            }
        });
    }

    // 5. LOGOUT
    public void signOut(ApiCallback<Boolean> cb) {
        String token = session.getAccessToken();
        if (token.isEmpty()) {
            session.clearSession();
            postSuccess(cb, true);
            return;
        }
        Request request = new Request.Builder()
                .url(baseUrl() + "/auth/v1/logout")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + token)
                .post(RequestBody.create("", JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                session.clearSession();
                postSuccess(cb, true);
            }

            @Override
            public void onResponse(Call call, Response response) {
                session.clearSession();
                postSuccess(cb, true);
            }
        });
    }

    // 6. PROFILE RESOLVE (PRESERVES EXISTING RECORD) & INSERT IF MISSING
    public void resolveOrCreateProfile(String userId, String fallbackName, String email, String fallbackPhone, ApiCallback<Models.UserProfile> cb) {
        Request fetchReq = new Request.Builder()
                .url(baseUrl() + "/rest/v1/profiles?id=eq." + URLEncoder.encode(userId, StandardCharsets.UTF_8) + "&select=*")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();

        httpClient.newCall(fetchReq).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Failed to verify existing profile: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.UserProfile>>() {}.getType();
                List<Models.UserProfile> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) {
                    Models.UserProfile existing = list.get(0);
                    session.saveProfileMeta(existing.full_name, existing.phone);
                    postSuccess(cb, existing);
                    return;
                }
                insertProfile(userId, fallbackName, email, fallbackPhone, cb);
            }
        });
    }

    private void insertProfile(String userId, String fullName, String email, String phone, ApiCallback<Models.UserProfile> cb) {
        JsonObject payload = new JsonObject();
        payload.addProperty("id", userId);
        payload.addProperty("full_name", fullName);
        payload.addProperty("email", email);
        payload.addProperty("phone", phone);

        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/profiles")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Failed to save profile: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.UserProfile>>() {}.getType();
                List<Models.UserProfile> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) {
                    session.saveProfileMeta(list.get(0).full_name, list.get(0).phone);
                    postSuccess(cb, list.get(0));
                } else {
                    postError(cb, "Profile save returned empty result.");
                }
            }
        });
    }

    public void fetchProfile(ApiCallback<Models.UserProfile> cb) {
        String userId = session.getUserId();
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/profiles?id=eq." + URLEncoder.encode(userId, StandardCharsets.UTF_8) + "&select=*")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.UserProfile>>() {}.getType();
                List<Models.UserProfile> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) {
                    session.saveProfileMeta(list.get(0).full_name, list.get(0).phone);
                    postSuccess(cb, list.get(0));
                } else {
                    postError(cb, "Profile not found.");
                }
            }
        });
    }

    // 7. SOS ALERTS (INSERT, UPDATE STATUS & SELECT)
    public void insertSosAlert(double lat, double lng, String emergencyType, String details, String locationLabel, ApiCallback<Models.SosAlert> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String locationText = (locationLabel != null && !locationLabel.trim().isEmpty())
                ? locationLabel.trim()
                : String.format(java.util.Locale.US, "%.5f, %.5f", lat, lng);

        JsonObject payload = new JsonObject();
        payload.addProperty("user_id", session.getUserId());
        payload.addProperty("emergency_type", emergencyType);
        payload.addProperty("emergency_details", details);
        payload.addProperty("latitude", lat);
        payload.addProperty("longitude", lng);
        payload.addProperty("location", locationText);
        payload.addProperty("status", "ACTIVE");

        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/sos_alerts")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "SOS failed: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.SosAlert>>() {}.getType();
                List<Models.SosAlert> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) {
                    postSuccess(cb, list.get(0));
                } else {
                    postError(cb, "SOS alert was not persisted.");
                }
            }
        });
    }

    public void resolveSosAlert(String alertId, ApiCallback<Models.SosAlert> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        JsonObject payload = new JsonObject();
        payload.addProperty("status", "RESOLVED");

        String encodedId = URLEncoder.encode(alertId, StandardCharsets.UTF_8);
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);

        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/sos_alerts?id=eq." + encodedId + "&user_id=eq." + encodedUserId)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .patch(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Update failed: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.SosAlert>>() {}.getType();
                List<Models.SosAlert> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) {
                    postSuccess(cb, list.get(0));
                } else {
                    postError(cb, "SOS alert update returned empty result.");
                }
            }
        });
    }

    public void fetchSosAlerts(ApiCallback<List<Models.SosAlert>> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/sos_alerts?user_id=eq." + encodedUserId + "&order=created_at.desc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();

        executeListRequest(request, new TypeToken<List<Models.SosAlert>>() {}.getType(), cb);
    }

    // 8. DISASTER IMAGE UPLOAD (disaster-reports bucket) + SIGNED URL + REPORT INSERT + SELECT
    public void uploadDisasterImage(byte[] imageBytes, String fileName, String mimeType, ApiCallback<String[]> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        if (imageBytes == null || imageBytes.length == 0) {
            postError(cb, "Selected image file is empty.");
            return;
        }
        if (imageBytes.length > 5 * 1024 * 1024) {
            postError(cb, "Incident photo must be 5 MB or smaller.");
            return;
        }
        String safeMime = (mimeType != null && mimeType.startsWith("image/")) ? mimeType : "image/jpeg";
        String safeFile = (fileName == null || fileName.trim().isEmpty() ? "incident.jpg" : fileName.trim())
                .replaceAll("[^a-zA-Z0-9._-]", "_");
        String objectPath = session.getUserId() + "/" + System.currentTimeMillis() + "_" + safeFile;
        Request request = new Request.Builder()
                .url(baseUrl() + "/storage/v1/object/disaster-reports/" + objectPath)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", safeMime)
                .addHeader("x-upsert", "false")
                .post(RequestBody.create(imageBytes, MediaType.parse(safeMime)))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Image upload failed: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, "Image upload failed: " + parseErrorBody(body, response.code()));
                    return;
                }
                createSignedReportImageUrl(objectPath, new ApiCallback<String[]>() {
                    @Override
                    public void onSuccess(String[] result) {
                        postSuccess(cb, result);
                    }

                    @Override
                    public void onError(String errorMessage) {
                        deleteDisasterImage(objectPath);
                        postError(cb, errorMessage);
                    }
                });
            }
        });
    }

    public void createSignedReportImageUrl(String objectPath, ApiCallback<String[]> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required to access private report images.");
            return;
        }
        if (objectPath == null || objectPath.trim().isEmpty()) {
            postError(cb, "Missing disaster image path.");
            return;
        }
        String cleanPath = objectPath.trim().replaceFirst("^/+", "").replaceFirst("^disaster-reports/", "");
        JsonObject signPayload = new JsonObject();
        signPayload.addProperty("expiresIn", 3600);
        Request signRequest = new Request.Builder()
                .url(baseUrl() + "/storage/v1/object/sign/disaster-reports/" + cleanPath)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(signPayload), JSON))
                .build();

        httpClient.newCall(signRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, "Signed URL request failed: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, "Could not sign private image URL: " + parseErrorBody(body, response.code()));
                    return;
                }
                try {
                    JsonObject obj = JsonParser.parseString(body).getAsJsonObject();
                    String signedPath = obj.has("signedURL") && !obj.get("signedURL").isJsonNull()
                            ? obj.get("signedURL").getAsString()
                            : "";
                    if (signedPath.isEmpty()) {
                        postError(cb, "Supabase did not return a signedURL.");
                        return;
                    }
                    String normalizedSigned = signedPath.startsWith("/") ? signedPath : "/" + signedPath;
                    String fullSignedUrl = signedPath.startsWith("http")
                            ? signedPath
                            : baseUrl() + "/storage/v1" + normalizedSigned;
                    postSuccess(cb, new String[]{cleanPath, fullSignedUrl});
                } catch (Exception ex) {
                    postError(cb, "Invalid signed URL response: " + ex.getMessage());
                }
            }
        });
    }

    public void deleteDisasterImage(String objectPath) {
        if (!hasActiveAuthSession() || objectPath == null || objectPath.trim().isEmpty()) {
            return;
        }
        String cleanPath = objectPath.trim().replaceFirst("^/+", "").replaceFirst("^disaster-reports/", "");
        Request request = new Request.Builder()
                .url(baseUrl() + "/storage/v1/object/disaster-reports/" + cleanPath)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .delete()
                .build();
        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
            }

            @Override
            public void onResponse(Call call, Response response) {
                response.close();
            }
        });
    }

    public void insertDisasterReport(String category, String description, double lat, double lng, String locality, String photoUrl, String photoPath, ApiCallback<Models.DisasterReport> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        JsonObject payload = new JsonObject();
        payload.addProperty("user_id", session.getUserId());
        payload.addProperty("disaster_category", category);
        payload.addProperty("locality", locality == null ? "" : locality);
        payload.addProperty("description", description);
        payload.addProperty("latitude", lat);
        payload.addProperty("longitude", lng);
        payload.addProperty("incident_photo_url", photoUrl == null ? "" : photoUrl);
        payload.addProperty("incident_photo_path", photoPath == null ? "" : photoPath);
        payload.addProperty("status", "SUBMITTED");

        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/disaster_reports")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.DisasterReport>>() {}.getType();
                List<Models.DisasterReport> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) {
                    postSuccess(cb, list.get(0));
                } else {
                    postError(cb, "Report insertion failed.");
                }
            }
        });
    }

    public void fetchDisasterReports(ApiCallback<List<Models.DisasterReport>> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/disaster_reports?user_id=eq." + encodedUserId + "&order=created_at.desc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();

        executeListRequest(request, new TypeToken<List<Models.DisasterReport>>() {}.getType(), cb);
    }

    private boolean hasActiveAuthSession() {
        return isConfigured()
                && session.isLoggedInAndVerified()
                && !session.getAccessToken().isEmpty()
                && !session.getUserId().isEmpty();
    }

    // 9. FAMILY MEMBERS CRUD
    public void fetchFamilyMembers(ApiCallback<List<Models.FamilyMember>> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/family_members?user_id=eq." + encodedUserId + "&order=created_at.desc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();
        executeListRequest(request, new TypeToken<List<Models.FamilyMember>>() {}.getType(), cb);
    }

    public void saveFamilyMember(Models.FamilyMember member, boolean isUpdate, ApiCallback<Models.FamilyMember> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String userId = session.getUserId();
        JsonObject payload = new JsonObject();
        if (!isUpdate) {
            payload.addProperty("user_id", userId);
            payload.addProperty("notes", member.notes == null ? "" : member.notes);
        }
        payload.addProperty("name", member.name);
        payload.addProperty("relationship", member.relationship);
        payload.addProperty("phone", member.phone);
        payload.addProperty("blood_group", member.blood_group == null ? "" : member.blood_group);
        payload.addProperty("status", member.status == null ? "Safe" : member.status);

        Request.Builder builder = new Request.Builder()
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation");

        if (isUpdate && member.id != null) {
            String encodedId = URLEncoder.encode(member.id, StandardCharsets.UTF_8);
            String encodedUserId = URLEncoder.encode(userId, StandardCharsets.UTF_8);
            builder.url(baseUrl() + "/rest/v1/family_members?id=eq." + encodedId + "&user_id=eq." + encodedUserId)
                    .patch(RequestBody.create(gson.toJson(payload), JSON));
        } else {
            builder.url(baseUrl() + "/rest/v1/family_members")
                    .post(RequestBody.create(gson.toJson(payload), JSON));
        }

        httpClient.newCall(builder.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.FamilyMember>>() {}.getType();
                List<Models.FamilyMember> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) postSuccess(cb, list.get(0));
                else postError(cb, "Operation failed.");
            }
        });
    }

    public void deleteFamilyMember(String id, ApiCallback<Boolean> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String encodedId = URLEncoder.encode(id, StandardCharsets.UTF_8);
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/family_members?id=eq." + encodedId + "&user_id=eq." + encodedUserId)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .delete()
                .build();
        executeDeleteRequest(request, cb);
    }

    // 10. EMERGENCY CONTACTS CRUD
    public void fetchEmergencyContacts(ApiCallback<List<Models.EmergencyContact>> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/emergency_contacts?user_id=eq." + encodedUserId + "&order=priority.asc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();
        executeListRequest(request, new TypeToken<List<Models.EmergencyContact>>() {}.getType(), cb);
    }

    public void saveEmergencyContact(Models.EmergencyContact contact, boolean isUpdate, ApiCallback<Models.EmergencyContact> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String userId = session.getUserId();
        JsonObject payload = new JsonObject();
        if (!isUpdate) {
            payload.addProperty("user_id", userId);
        }
        payload.addProperty("contact_name", contact.contact_name);
        payload.addProperty("relationship", contact.relationship);
        payload.addProperty("phone", contact.phone);
        payload.addProperty("email", contact.email == null ? "" : contact.email);
        payload.addProperty("priority", contact.priority <= 0 ? 1 : contact.priority);

        Request.Builder builder = new Request.Builder()
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation");

        if (isUpdate && contact.id != null) {
            String encodedId = URLEncoder.encode(contact.id, StandardCharsets.UTF_8);
            String encodedUserId = URLEncoder.encode(userId, StandardCharsets.UTF_8);
            builder.url(baseUrl() + "/rest/v1/emergency_contacts?id=eq." + encodedId + "&user_id=eq." + encodedUserId)
                    .patch(RequestBody.create(gson.toJson(payload), JSON));
        } else {
            builder.url(baseUrl() + "/rest/v1/emergency_contacts")
                    .post(RequestBody.create(gson.toJson(payload), JSON));
        }

        httpClient.newCall(builder.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                Type listType = new TypeToken<List<Models.EmergencyContact>>() {}.getType();
                List<Models.EmergencyContact> list = gson.fromJson(body, listType);
                if (list != null && !list.isEmpty()) postSuccess(cb, list.get(0));
                else postError(cb, "Operation failed.");
            }
        });
    }

    public void deleteEmergencyContact(String id, ApiCallback<Boolean> cb) {
        if (!hasActiveAuthSession()) {
            postError(cb, "Authenticated Supabase session required. Please sign in with verified Email OTP.");
            return;
        }
        String encodedId = URLEncoder.encode(id, StandardCharsets.UTF_8);
        String encodedUserId = URLEncoder.encode(session.getUserId(), StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/emergency_contacts?id=eq." + encodedId + "&user_id=eq." + encodedUserId)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .delete()
                .build();
        executeDeleteRequest(request, cb);
    }

    private <T> void executeListRequest(Request request, Type listType, ApiCallback<List<T>> cb) {
        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                List<T> items = gson.fromJson(body, listType);
                postSuccess(cb, items);
            }
        });
    }

    private void executeDeleteRequest(Request request, ApiCallback<Boolean> cb) {
        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postError(cb, e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                postSuccess(cb, true);
            }
        });
    }
}
