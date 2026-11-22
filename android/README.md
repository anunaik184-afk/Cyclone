# CycloneSafe — Android (Java + XML) Configuration & Testing Guide

## 1. Prerequisites
- Android Studio Jellyfish / Ladybug or newer with JDK 17.
- Android device or emulator with Google Play Services & GPS enabled.
- Your existing Supabase project: `https://qpjmzqpomsitvdaxjgou.supabase.co`

## 2. Configure `local.properties`
Copy `android/local.properties.example` to `android/local.properties` and set:
```properties
sdk.dir=/path/to/your/Android/Sdk
SUPABASE_URL=https://qpjmzqpomsitvdaxjgou.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your_supabase_publishable_or_anon_key>
MAPS_API_KEY=<your_google_maps_android_api_key>
```
> **Security Note:** Never put `service_role` or secret keys inside `local.properties`, `BuildConfig`, or client source files.

## 3. Supabase Database & Storage Setup
1. Open the SQL Editor in your Supabase dashboard (`https://qpjmzqpomsitvdaxjgou.supabase.co`).
2. Execute the full script at `../supabase/schema.sql`. This provisions all 6 tables (`profiles`, `family_members`, `emergency_contacts`, `sos_alerts`, `disaster_reports`, `user_settings`), enables Row Level Security (`auth.uid()` ownership policies for SELECT, INSERT, UPDATE, DELETE), and creates the `disaster-images` Storage bucket with authenticated upload policies.

## 4. Real Email OTP Configuration (Supabase SMTP)
1. In Supabase Dashboard -> **Authentication** -> **Providers** -> **Email**:
   - Enable **Confirm email**.
   - Ensure the **Confirm signup** email template includes the 6-digit OTP token: `{{ .Token }}` (e.g., `Your CycloneSafe verification code is: {{ .Token }}`).
2. In Supabase Dashboard -> **Project Settings** -> **Authentication** -> **SMTP Settings**:
   - Enable **Custom SMTP** (e.g., Resend, Postmark, SendGrid, AWS SES, or Gmail App Password SMTP) so real verification OTP codes are delivered reliably to any user's registration email address without rate-limit blocks.

## 5. Google Cloud Console Setup
Enable the following APIs for `MAPS_API_KEY`:
- **Maps SDK for Android**
- **Places API (New)**
Restrict the Android key by SHA-1 fingerprint and package name `com.cyclonesafe.app`.
