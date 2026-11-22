package com.cyclonesafe.app.ui;

import android.os.Bundle;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;

public class GuidelinesActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_guidelines);

        TextView tvContent = findViewById(R.id.tvGuidelinesBody);
        tvContent.setText(
                "1. FLOODS\n" +
                "- Move immediately to higher ground and avoid walking or driving through floodwater.\n" +
                "- Turn off main electrical switches and gas valves before evacuating.\n" +
                "- Follow NDMA and local municipal evacuation advisories.\n\n" +
                "2. CYCLONES\n" +
                "- Secure loose roof sheets, doors, and windows; keep an emergency kit with torch, power bank, and drinking water.\n" +
                "- Stay indoors away from glass windows during landfall; do not venture out during the calm eye of the storm.\n\n" +
                "3. EARTHQUAKES\n" +
                "- Drop, Cover, and Hold On under a sturdy table away from windows and heavy shelves.\n" +
                "- Do not use elevators; evacuate to an open assembly ground once shaking stops.\n\n" +
                "4. FIRE\n" +
                "- Stay low below smoke, cover nose/mouth with damp cloth, and exit via stairs.\n" +
                "- Dial 101 or 112 immediately."
        );
    }
}
