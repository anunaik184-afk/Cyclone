package com.cyclonesafe.app.model;

import java.util.ArrayList;
import java.util.List;

public class Models {

    public static class UserProfile {
        public String id;
        public String full_name;
        public String email;
        public String phone;
        public String created_at;
        public String updated_at;
    }

    public static class FamilyMember {
        public String id;
        public String user_id;
        public String name;
        public String relationship;
        public String phone;
        public String blood_group;
        public String medical_notes;
        public String safety_status;
        public String created_at;
    }

    public static class EmergencyContact {
        public String id;
        public String user_id;
        public String name;
        public String relationship;
        public String phone;
        public String email;
        public int priority;
        public String created_at;
    }

    public static class SosAlert {
        public String id;
        public String user_id;
        public double latitude;
        public double longitude;
        public String alert_type;
        public String alert_message;
        public String status;
        public String created_at;
    }

    public static class DisasterReport {
        public String id;
        public String user_id;
        public String category;
        public String description;
        public double latitude;
        public double longitude;
        public String location_label;
        public String image_url;
        public String status;
        public String created_at;
    }

    public static class UserSettings {
        public String user_id;
        public String region_mode;
        public String weather_unit;
        public boolean sos_auto_share_location;
        public boolean alert_notifications_enabled;
    }

    public static class EmergencyPlace {
        public String id;
        public String name;
        public String address;
        public double latitude;
        public double longitude;
        public String phoneNumber;
        public String category;
        public double distanceMeters;
        public String googleMapsUri;
        public String businessStatus;
    }

    public static class HourlyForecast {
        public String time;
        public double temperatureC;
        public int weatherCode;
        public double precipitationMm;
    }

    public static class DailyForecast {
        public String date;
        public double maxTempC;
        public double minTempC;
        public double precipitationSumMm;
        public int weatherCode;
    }

    public static class WeatherData {
        public double currentTempC;
        public double feelsLikeC;
        public int humidityPercent;
        public double windSpeedKmh;
        public int windDirectionDeg;
        public double rainfallMm;
        public int weatherCode;
        public String conditionLabel;
        public String lastUpdatedIso;
        public List<HourlyForecast> hourly = new ArrayList<>();
        public List<DailyForecast> daily = new ArrayList<>();
    }
}
