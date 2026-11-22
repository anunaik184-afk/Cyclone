import {createClient, type SupabaseClient} from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://qpjmzqpomsitvdaxjgou.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at?: string;
  updated_at?: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  phone: string;
  blood_group: string;
  medical_notes: string;
  safety_status: string;
  created_at?: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  priority: number;
  created_at?: string;
}

export interface SosAlert {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  alert_type: string;
  alert_message: string;
  status: string;
  created_at: string;
}

export interface DisasterReport {
  id: string;
  user_id: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  location_label: string;
  image_url: string;
  status: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  region_mode: string;
  weather_unit: string;
  sos_auto_share_location: boolean;
  alert_notifications_enabled: boolean;
}
