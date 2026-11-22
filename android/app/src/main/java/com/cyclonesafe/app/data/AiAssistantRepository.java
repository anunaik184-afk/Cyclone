package com.cyclonesafe.app.data;

import android.os.Handler;
import android.os.Looper;
import com.cyclonesafe.app.BuildConfig;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AiAssistantRepository {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private final OkHttpClient httpClient;
    private final Gson gson = new Gson();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static class ChatTurn {
        public final String role; // "user" or "model"
        public final String text;

        public ChatTurn(String role, String text) {
            this.role = role;
            this.text = text;
        }
    }

    public interface AssistantCallback {
        void onSuccess(String reply);
        void onError(String errorMessage);
    }

    public AiAssistantRepository() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(35, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();
    }

    public void sendMessage(
            String message,
            List<ChatTurn> history,
            double lat,
            double lng,
            AssistantCallback callback
    ) {
        String baseUrl = BuildConfig.ASSISTANT_API_URL;
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            mainHandler.post(() -> callback.onError("ASSISTANT_API_URL is not configured in local.properties."));
            return;
        }
        String normalizedBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;

        JsonObject payload = new JsonObject();
        payload.addProperty("message", message);

        JsonArray historyArray = new JsonArray();
        if (history != null) {
            for (ChatTurn turn : history) {
                JsonObject obj = new JsonObject();
                obj.addProperty("role", turn.role);
                obj.addProperty("text", turn.text);
                historyArray.add(obj);
            }
        }
        payload.add("history", historyArray);

        if (!Double.isNaN(lat) && !Double.isNaN(lng)) {
            JsonObject loc = new JsonObject();
            loc.addProperty("lat", lat);
            loc.addProperty("lng", lng);
            loc.addProperty("insideIndia", LocationHelper.isInsideIndia(lat, lng));
            payload.add("location", loc);
        }

        Request request = new Request.Builder()
                .url(normalizedBase + "/api/assistant")
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(gson.toJson(payload), JSON))
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error contacting CycloneSafe AI server: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String body = response.body() != null ? response.body().string() : "";
                try {
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    if (!response.isSuccessful()) {
                        String errMsg = json.has("error") ? json.get("error").getAsString() : ("HTTP " + response.code());
                        mainHandler.post(() -> callback.onError(errMsg));
                        return;
                    }
                    String reply = json.has("reply") ? json.get("reply").getAsString() : "";
                    if (reply.isEmpty()) {
                        mainHandler.post(() -> callback.onError("Empty assistant reply received."));
                    } else {
                        mainHandler.post(() -> callback.onSuccess(reply));
                    }
                } catch (Exception parseErr) {
                    mainHandler.post(() -> callback.onError("Invalid server response (HTTP " + response.code() + ")."));
                }
            }
        });
    }
}
