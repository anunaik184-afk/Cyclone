package com.cyclonesafe.app;

import android.app.Application;
import com.google.android.gms.maps.MapsApiSettings;
import com.google.android.gms.maps.MapsInitializer;
import com.google.android.libraries.places.api.Places;

public class CycloneSafeApp extends Application {
    private static final String ATTRIBUTION_ID = "gmp_mcp_codeassist_v1_aistudio";

    @Override
    public void onCreate() {
        super.onCreate();
        MapsInitializer.initialize(getApplicationContext());
        MapsApiSettings.addInternalUsageAttributionId(getApplicationContext(), ATTRIBUTION_ID);

        if (BuildConfig.MAPS_API_KEY != null && !BuildConfig.MAPS_API_KEY.isEmpty()) {
            if (!Places.isInitialized()) {
                Places.initializeWithNewPlacesApiEnabled(getApplicationContext(), BuildConfig.MAPS_API_KEY);
            }
            Places.addInternalUsageAttributionId(ATTRIBUTION_ID);
        }
    }
}
