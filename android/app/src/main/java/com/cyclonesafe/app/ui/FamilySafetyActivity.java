package com.cyclonesafe.app.ui;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.SupabaseClient;
import com.cyclonesafe.app.model.Models;
import java.util.List;

public class FamilySafetyActivity extends AppCompatActivity {
    private SupabaseClient supabase;
    private LinearLayout llFamilyList, llContactsList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_family_safety);
        supabase = new SupabaseClient(this);

        llFamilyList = findViewById(R.id.llFamilyList);
        llContactsList = findViewById(R.id.llContactsList);

        findViewById(R.id.btnAddFamily).setOnClickListener(v -> showFamilyDialog(null));
        findViewById(R.id.btnAddContact).setOnClickListener(v -> showContactDialog(null));

        loadFamilyMembers();
        loadEmergencyContacts();
    }

    private void loadFamilyMembers() {
        supabase.fetchFamilyMembers(new SupabaseClient.ApiCallback<List<Models.FamilyMember>>() {
            @Override
            public void onSuccess(List<Models.FamilyMember> members) {
                llFamilyList.removeAllViews();
                if (members == null || members.isEmpty()) {
                    TextView empty = new TextView(FamilySafetyActivity.this);
                    empty.setText("No family members saved yet.");
                    llFamilyList.addView(empty);
                    return;
                }
                for (Models.FamilyMember m : members) {
                    View row = LayoutInflater.from(FamilySafetyActivity.this).inflate(R.layout.item_safety_row, llFamilyList, false);
                    ((TextView) row.findViewById(R.id.tvRowTitle)).setText(m.name + " (" + m.relationship + ")");
                    ((TextView) row.findViewById(R.id.tvRowSub)).setText(m.phone + " · Blood: " + m.blood_group + " · Status: " + m.status);
                    row.findViewById(R.id.btnRowEdit).setOnClickListener(v -> showFamilyDialog(m));
                    row.findViewById(R.id.btnRowDelete).setOnClickListener(v ->
                            supabase.deleteFamilyMember(m.id, new SupabaseClient.ApiCallback<Boolean>() {
                                @Override public void onSuccess(Boolean res) {
                                    Toast.makeText(FamilySafetyActivity.this, "Family member deleted.", Toast.LENGTH_SHORT).show();
                                    loadFamilyMembers();
                                }
                                @Override public void onError(String err) { Toast.makeText(FamilySafetyActivity.this, err, Toast.LENGTH_LONG).show(); }
                            }));
                    llFamilyList.addView(row);
                }
            }

            @Override
            public void onError(String errorMessage) {
                Toast.makeText(FamilySafetyActivity.this, errorMessage, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void loadEmergencyContacts() {
        supabase.fetchEmergencyContacts(new SupabaseClient.ApiCallback<List<Models.EmergencyContact>>() {
            @Override
            public void onSuccess(List<Models.EmergencyContact> contacts) {
                llContactsList.removeAllViews();
                if (contacts == null || contacts.isEmpty()) {
                    TextView empty = new TextView(FamilySafetyActivity.this);
                    empty.setText("No emergency contacts saved yet.");
                    llContactsList.addView(empty);
                    return;
                }
                for (Models.EmergencyContact c : contacts) {
                    View row = LayoutInflater.from(FamilySafetyActivity.this).inflate(R.layout.item_safety_row, llContactsList, false);
                    ((TextView) row.findViewById(R.id.tvRowTitle)).setText(c.contact_name + " (Priority " + c.priority + ")");
                    ((TextView) row.findViewById(R.id.tvRowSub)).setText(c.relationship + " · " + c.phone);
                    row.findViewById(R.id.btnRowEdit).setOnClickListener(v -> showContactDialog(c));
                    row.findViewById(R.id.btnRowDelete).setOnClickListener(v ->
                            supabase.deleteEmergencyContact(c.id, new SupabaseClient.ApiCallback<Boolean>() {
                                @Override public void onSuccess(Boolean res) {
                                    Toast.makeText(FamilySafetyActivity.this, "Emergency contact deleted.", Toast.LENGTH_SHORT).show();
                                    loadEmergencyContacts();
                                }
                                @Override public void onError(String err) { Toast.makeText(FamilySafetyActivity.this, err, Toast.LENGTH_LONG).show(); }
                            }));
                    llContactsList.addView(row);
                }
            }

            @Override
            public void onError(String errorMessage) {
                Toast.makeText(FamilySafetyActivity.this, errorMessage, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showFamilyDialog(Models.FamilyMember existing) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 24, 48, 24);

        EditText etName = new EditText(this); etName.setHint("Full Name");
        EditText etRel = new EditText(this); etRel.setHint("Relationship (e.g. Mother)");
        EditText etPhone = new EditText(this); etPhone.setHint("Phone Number");
        EditText etBlood = new EditText(this); etBlood.setHint("Blood Group (e.g. O+)");
        EditText etStatus = new EditText(this); etStatus.setHint("Safety Status (Safe / Needs Check-in)");

        if (existing != null) {
            etName.setText(existing.name);
            etRel.setText(existing.relationship);
            etPhone.setText(existing.phone);
            etBlood.setText(existing.blood_group);
            etStatus.setText(existing.status);
        }
        layout.addView(etName); layout.addView(etRel); layout.addView(etPhone); layout.addView(etBlood); layout.addView(etStatus);

        new AlertDialog.Builder(this)
                .setTitle(existing == null ? "Add Family Member" : "Edit Family Member")
                .setView(layout)
                .setPositiveButton("Save", (d, w) -> {
                    String name = etName.getText().toString().trim();
                    String rel = etRel.getText().toString().trim();
                    String phone = etPhone.getText().toString().trim();
                    if (name.isEmpty() || rel.isEmpty() || phone.isEmpty()) {
                        Toast.makeText(FamilySafetyActivity.this, "Name, relationship, and phone are required.", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    Models.FamilyMember m = existing != null ? existing : new Models.FamilyMember();
                    m.name = name;
                    m.relationship = rel;
                    m.phone = phone;
                    m.blood_group = etBlood.getText().toString().trim();
                    m.status = etStatus.getText().toString().trim().isEmpty() ? "Safe" : etStatus.getText().toString().trim();
                    supabase.saveFamilyMember(m, existing != null, new SupabaseClient.ApiCallback<Models.FamilyMember>() {
                        @Override public void onSuccess(Models.FamilyMember res) {
                            Toast.makeText(FamilySafetyActivity.this, existing != null ? "Family member updated." : "Family member saved.", Toast.LENGTH_SHORT).show();
                            loadFamilyMembers();
                        }
                        @Override public void onError(String err) { Toast.makeText(FamilySafetyActivity.this, err, Toast.LENGTH_LONG).show(); }
                    });
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void showContactDialog(Models.EmergencyContact existing) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 24, 48, 24);

        EditText etName = new EditText(this); etName.setHint("Contact Name");
        EditText etRel = new EditText(this); etRel.setHint("Relationship");
        EditText etPhone = new EditText(this); etPhone.setHint("Phone Number");
        EditText etEmail = new EditText(this); etEmail.setHint("Email (optional)");

        if (existing != null) {
            etName.setText(existing.contact_name);
            etRel.setText(existing.relationship);
            etPhone.setText(existing.phone);
            etEmail.setText(existing.email);
        }
        layout.addView(etName); layout.addView(etRel); layout.addView(etPhone); layout.addView(etEmail);

        new AlertDialog.Builder(this)
                .setTitle(existing == null ? "Add Emergency Contact" : "Edit Emergency Contact")
                .setView(layout)
                .setPositiveButton("Save", (d, w) -> {
                    String name = etName.getText().toString().trim();
                    String rel = etRel.getText().toString().trim();
                    String phone = etPhone.getText().toString().trim();
                    if (name.isEmpty() || rel.isEmpty() || phone.isEmpty()) {
                        Toast.makeText(FamilySafetyActivity.this, "Name, relationship, and phone are required.", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    Models.EmergencyContact c = existing != null ? existing : new Models.EmergencyContact();
                    c.contact_name = name;
                    c.relationship = rel;
                    c.phone = phone;
                    c.email = etEmail.getText().toString().trim();
                    c.priority = 1;
                    supabase.saveEmergencyContact(c, existing != null, new SupabaseClient.ApiCallback<Models.EmergencyContact>() {
                        @Override public void onSuccess(Models.EmergencyContact res) {
                            Toast.makeText(FamilySafetyActivity.this, existing != null ? "Emergency contact updated." : "Emergency contact saved.", Toast.LENGTH_SHORT).show();
                            loadEmergencyContacts();
                        }
                        @Override public void onError(String err) { Toast.makeText(FamilySafetyActivity.this, err, Toast.LENGTH_LONG).show(); }
                    });
                })
                .setNegativeButton("Cancel", null)
                .show();
    }
}
