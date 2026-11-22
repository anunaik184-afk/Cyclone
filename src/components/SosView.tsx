import React, {useCallback, useEffect, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {type GpsLocationState} from '../lib/location';
import {
  supabase,
  type EmergencyContact,
  type SosAlert,
} from '../lib/supabase';

interface SosViewProps {
  userId: string;
  gps: GpsLocationState;
  onRefreshGps: () => void;
}

const ALERT_TYPES = [
  'Medical Emergency',
  'Flood Trapped',
  'Fire / Rescue',
  'Earthquake',
  'Cyclone',
  'Personal Safety',
];

export function SosView({userId, gps, onRefreshGps}: SosViewProps) {
  const [alertType, setAlertType] = useState(ALERT_TYPES[0]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<SosAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoadingHistory(true);
    try {
      const [sosRes, contactsRes] = await Promise.all([
        supabase
          .from('sos_alerts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', {ascending: false}),
        supabase
          .from('emergency_contacts')
          .select('*')
          .eq('user_id', userId)
          .order('priority', {ascending: true}),
      ]);

      if (sosRes.error) throw new Error(sosRes.error.message);
      setHistory((sosRes.data as SosAlert[]) ?? []);
      setContacts((contactsRes.data as EmergencyContact[]) ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load SOS history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTriggerSos = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusNotice(null);

    if (!supabase) {
      setErrorMsg('Supabase is not configured.');
      return;
    }

    if (gps.status !== 'ready' || gps.lat === null || gps.lng === null) {
      setErrorMsg(
        'Real GPS coordinates are required before recording an SOS alert. Enable location access and retry.',
      );
      return;
    }

    const finalMessage =
      message.trim() || `Emergency SOS (${alertType}) triggered by user.`;

    setSubmitting(true);
    try {
      const {data, error} = await supabase
        .from('sos_alerts')
        .insert({
          user_id: userId,
          latitude: gps.lat,
          longitude: gps.lng,
          alert_type: alertType,
          alert_message: finalMessage,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Database did not confirm SOS insertion.');
      }

      setStatusNotice(
        `SOS alert logged to Supabase (ID: ${(data as SosAlert).id}). Note: CycloneSafe does not automatically dispatch public responders — dial 112 or notify your emergency contacts directly below.`,
      );
      setMessage('');
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'SOS insertion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const buildMapsLink = () =>
    gps.lat !== null && gps.lng !== null
      ? `https://maps.google.com/?q=${gps.lat.toFixed(5)},${gps.lng.toFixed(5)}`
      : 'GPS pending';

  const buildSmsHref = (phone: string) => {
    const body = encodeURIComponent(
      `CycloneSafe SOS (${alertType}): ${
        message.trim() || 'Need immediate assistance.'
      } Location: ${buildMapsLink()}`,
    );
    return `sms:${phone}?body=${body}`;
  };

  const buildMailtoHref = (email: string) => {
    const subject = encodeURIComponent(`CycloneSafe SOS Alert: ${alertType}`);
    const body = encodeURIComponent(
      `Emergency SOS recorded.\nType: ${alertType}\nMessage: ${
        message.trim() || 'Immediate help requested.'
      }\nGPS Coordinates: ${gps.lat ?? 'N/A'}, ${gps.lng ?? 'N/A'}\nMap: ${buildMapsLink()}`,
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            SOS Emergency System
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {gps.status === 'ready' && gps.lat !== null && gps.lng !== null
              ? `Live GPS Fix: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
              : 'Live GPS location required for SOS logging'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshGps}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            Refresh GPS
          </button>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call 112 Now</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleTriggerSos}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-slate-900">
            Record Cloud SOS Alert
          </h2>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusNotice}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Emergency Type
            </label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Emergency Details
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe people trapped, injuries, floor/landmark, or hazards..."
              className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{submitting ? 'Saving SOS to Supabase...' : 'Record SOS Alert'}</span>
          </button>

          <div className="pt-3 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-900 mb-2">
              Notify Saved Emergency Contacts
            </h3>
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-500">
                No emergency contacts saved yet. Add contacts in Family Safety.
              </p>
            ) : (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {c.name} · {c.relationship}
                      </p>
                      <p className="text-xs font-mono text-slate-600">{c.phone}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={buildSmsHref(c.phone)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 hover:bg-slate-100"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>SMS</span>
                      </a>
                      {c.email && (
                        <a
                          href={buildMailtoHref(c.email)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 hover:bg-slate-100"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Email</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              SOS Alert History (Supabase)
            </h2>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingHistory ? (
            <p className="text-xs text-slate-500 py-6">Loading SOS history...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              No SOS alerts have been recorded for this account.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div key={item.id} className="py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {item.alert_type}
                    </span>
                    <span className="text-xs font-mono font-semibold text-red-700">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">{item.alert_message}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)} ·{' '}
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
