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
        try {
            JsonObject obj = JsonParser.parseString(body).getAsJsonObject();
            if (obj.has("msg")) return obj.get("msg").getAsString();
            if (obj.has("error_description")) return obj.get("error_description").getAsString();
            if (obj.has("message")) return obj.get("message").getAsString();
            if (obj.has("error")) return obj.get("error").getAsString();
        } catch (Exception ignored) {
        }
        return "Request failed (HTTP " + code + ")";
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
                session.saveProfileMeta(fullName, phone);
                postSuccess(cb, "Verification OTP sent to " + email);
            }
        });
    }

    // 2. VERIFY EMAIL OTP VIA SUPABASE AUTH
    public void verifyEmailOtp(String email, String token, String fullName, String phone, ApiCallback<Models.UserProfile> cb) {
        if (!isConfigured()) {
            postError(cb, "Supabase publishable key is missing in local.properties");
            return;
        }
        JsonObject payload = new JsonObject();
        payload.addProperty("type", "signup");
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
                    String accessToken = obj.has("access_token") ? obj.get("access_token").getAsString() : "";
                    String refreshToken = obj.has("refresh_token") ? obj.get("refresh_token").getAsString() : "";
                    JsonObject userObj = obj.getAsJsonObject("user");
                    String userId = userObj.get("id").getAsString();
                    boolean emailConfirmed = userObj.has("email_confirmed_at") && !userObj.get("email_confirmed_at").isJsonNull();

                    if (accessToken.isEmpty() || !emailConfirmed) {
                        postError(cb, "Email verification incomplete. Please enter a valid OTP.");
                        return;
                    }

                    session.saveSession(accessToken, refreshToken, userId, email, true);
                    upsertProfile(userId, fullName, email, phone, cb);
                } catch (Exception e) {
                    postError(cb, "Failed to parse verification response.");
                }
            }
        });
    }

    // 3. RESEND EMAIL OTP
    public void resendSignupOtp(String email, ApiCallback<String> cb) {
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
                postSuccess(cb, "A new OTP has been sent to " + email);
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
                        postError(cb, "Email not verified. Please complete OTP verification.");
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

    // 6. PROFILE UPSERT & FETCH
    public void upsertProfile(String userId, String fullName, String email, String phone, ApiCallback<Models.UserProfile> cb) {
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
                .addHeader("Prefer", "resolution=merge-duplicates,return=representation")
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

    // 7. SOS ALERTS (INSERT & SELECT)
    public void insertSosAlert(double lat, double lng, String alertType, String message, ApiCallback<Models.SosAlert> cb) {
        JsonObject payload = new JsonObject();
        payload.addProperty("user_id", session.getUserId());
        payload.addProperty("latitude", lat);
        payload.addProperty("longitude", lng);
        payload.addProperty("alert_type", alertType);
        payload.addProperty("alert_message", message);
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

    public void fetchSosAlerts(ApiCallback<List<Models.SosAlert>> cb) {
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/sos_alerts?user_id=eq." + session.getUserId() + "&order=created_at.desc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();

        executeListRequest(request, new TypeToken<List<Models.SosAlert>>() {}.getType(), cb);
    }

    // 8. DISASTER IMAGE UPLOAD + REPORT INSERT + SELECT
    public void uploadDisasterImage(byte[] imageBytes, String fileName, String mimeType, ApiCallback<String> cb) {
        String objectPath = session.getUserId() + "/" + System.currentTimeMillis() + "_" + fileName;
        Request request = new Request.Builder()
                .url(baseUrl() + "/storage/v1/object/disaster-images/" + objectPath)
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", mimeType)
                .post(RequestBody.create(imageBytes, MediaType.parse(mimeType)))
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
                    postError(cb, parseErrorBody(body, response.code()));
                    return;
                }
                String publicUrl = baseUrl() + "/storage/v1/object/public/disaster-images/" + objectPath;
                postSuccess(cb, publicUrl);
            }
        });
    }

    public void insertDisasterReport(String category, String description, double lat, double lng, String locationLabel, String imageUrl, ApiCallback<Models.DisasterReport> cb) {
        JsonObject payload = new JsonObject();
        payload.addProperty("user_id", session.getUserId());
        payload.addProperty("category", category);
        payload.addProperty("description", description);
        payload.addProperty("latitude", lat);
        payload.addProperty("longitude", lng);
        payload.addProperty("location_label", locationLabel);
        payload.addProperty("image_url", imageUrl == null ? "" : imageUrl);
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
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/disaster_reports?user_id=eq." + session.getUserId() + "&order=created_at.desc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();

        executeListRequest(request, new TypeToken<List<Models.DisasterReport>>() {}.getType(), cb);
    }

    // 9. FAMILY MEMBERS CRUD
    public void fetchFamilyMembers(ApiCallback<List<Models.FamilyMember>> cb) {
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/family_members?user_id=eq." + session.getUserId() + "&order=created_at.desc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();
        executeListRequest(request, new TypeToken<List<Models.FamilyMember>>() {}.getType(), cb);
    }

    public void saveFamilyMember(Models.FamilyMember member, boolean isUpdate, ApiCallback<Models.FamilyMember> cb) {
        JsonObject payload = new JsonObject();
        payload.addProperty("user_id", session.getUserId());
        payload.addProperty("name", member.name);
        payload.addProperty("relationship", member.relationship);
        payload.addProperty("phone", member.phone);
        payload.addProperty("blood_group", member.blood_group == null ? "" : member.blood_group);
        payload.addProperty("medical_notes", member.medical_notes == null ? "" : member.medical_notes);
        payload.addProperty("safety_status", member.safety_status == null ? "Unknown" : member.safety_status);

        Request.Builder builder = new Request.Builder()
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation");

        if (isUpdate && member.id != null) {
            builder.url(baseUrl() + "/rest/v1/family_members?id=eq." + member.id + "&user_id=eq." + session.getUserId())
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
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/family_members?id=eq." + id + "&user_id=eq." + session.getUserId())
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .delete()
                .build();
        executeDeleteRequest(request, cb);
    }

    // 10. EMERGENCY CONTACTS CRUD
    public void fetchEmergencyContacts(ApiCallback<List<Models.EmergencyContact>> cb) {
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/emergency_contacts?user_id=eq." + session.getUserId() + "&order=priority.asc")
                .addHeader("apikey", publishableKey())
                .addHeader("Authorization", "Bearer " + session.getAccessToken())
                .get()
                .build();
        executeListRequest(request, new TypeToken<List<Models.EmergencyContact>>() {}.getType(), cb);
    }

    public void saveEmergencyContact(Models.EmergencyContact contact, boolean isUpdate, ApiCallback<Models.EmergencyContact> cb) {
        JsonObject payload = new JsonObject();
        payload.addProperty("user_id", session.getUserId());
        payload.addProperty("name", contact.name);
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
            builder.url(baseUrl() + "/rest/v1/emergency_contacts?id=eq." + contact.id + "&user_id=eq." + session.getUserId())
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
        Request request = new Request.Builder()
                .url(baseUrl() + "/rest/v1/emergency_contacts?id=eq." + id + "&user_id=eq." + session.getUserId())
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
