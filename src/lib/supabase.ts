import {createClient, type SupabaseClient} from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || 'https://qpjmzqpomsitvdaxjgou.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const DISASTER_REPORTS_BUCKET = 'disaster-reports';

export async function requireAuthenticatedUserId(
  _fallbackUserId?: string,
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const [{data: sessionData, error: sessionErr}, {data: userData, error: userErr}] =
    await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (sessionErr || userErr) {
    throw new Error(
      sessionErr?.message || userErr?.message || 'Unable to verify Supabase session.',
    );
  }

  const session = sessionData.session;
  const authUser = userData.user;
  if (!session?.access_token || !authUser?.id) {
    throw new Error(
      'Authenticated Supabase session missing or expired. Please sign out and sign in again.',
    );
  }

  return authUser.id;
}

export function formatSupabaseDbError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return `${message}. Execute supabase/schema.sql in your Supabase SQL Editor to create the private "${DISASTER_REPORTS_BUCKET}" bucket and Storage RLS policies.`;
  }
  if (/row-level security policy/i.test(message)) {
    return `${message}. Confirm you are signed in and execute supabase/schema.sql in your Supabase SQL Editor.`;
  }
  if (/permission denied for table/i.test(message)) {
    return `${message}. Execute supabase/schema.sql in your Supabase SQL Editor to apply GRANT and RLS policies.`;
  }
  if (/schema cache/i.test(message)) {
    return `${message}. Execute supabase/schema.sql in your Supabase SQL Editor (including "notify pgrst, 'reload schema';").`;
  }
  return message;
}

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
  status: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  relationship: string;
  phone: string;
  email: string;
  priority: number;
  created_at?: string;
  updated_at?: string;
}

export interface SosAlert {
  id: string;
  user_id: string;
  emergency_type: string;
  emergency_details: string;
  latitude: number;
  longitude: number;
  location: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface DisasterReport {
  id: string;
  user_id: string;
  disaster_category: string;
  locality: string;
  description: string;
  latitude: number;
  longitude: number;
  incident_photo_url: string;
  incident_photo_path: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface UserSettings {
  user_id: string;
  region_mode: string;
  weather_unit: string;
  sos_auto_share_location: boolean;
  alert_notifications_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}
