package com.cyclonesafe.app.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;

public class EmergencyServicesActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_emergency_services);

        findViewById(R.id.btnDial112).setOnClickListener(v -> dial("112"));
        findViewById(R.id.btnDial108).setOnClickListener(v -> dial("108"));
        findViewById(R.id.btnDial100).setOnClickListener(v -> dial("100"));
        findViewById(R.id.btnDial101).setOnClickListener(v -> dial("101"));
        findViewById(R.id.btnDial1078).setOnClickListener(v -> dial("1078"));
        findViewById(R.id.btnDial1070).setOnClickListener(v -> dial("1070"));
    }

    private void dial(String number) {
        startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number)));
    }
}
