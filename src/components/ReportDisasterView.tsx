import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {type GpsLocationState} from '../lib/location';
import {
  deleteDisasterImage,
  resolveReportSignedUrls,
  uploadDisasterImageWithSignedUrl,
  validateDisasterImageFile,
} from '../lib/disasterStorage';
import {
  formatSupabaseDbError,
  requireAuthenticatedUserId,
  supabase,
  type DisasterReport,
} from '../lib/supabase';

interface ReportDisasterViewProps {
  userId: string;
  gps: GpsLocationState;
  onRefreshGps: () => void;
}

const DISASTER_CATEGORIES = [
  'Flood',
  'Cyclone',
  'Earthquake',
  'Landslide',
  'Fire',
  'Tsunami',
  'Other',
];

export function ReportDisasterView({
  userId,
  gps,
  onRefreshGps,
}: ReportDisasterViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState(DISASTER_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [reports, setReports] = useState<DisasterReport[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [loadingReports, setLoadingReports] = useState(true);

  const loadReports = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setLoadingReports(true);
    setErrorMsg(null);
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      const {data, error} = await client
        .from('disaster_reports')
        .select(
          'id, user_id, disaster_category, locality, description, latitude, longitude, incident_photo_url, incident_photo_path, status, created_at, updated_at',
        )
        .eq('user_id', verifiedUserId)
        .order('created_at', {ascending: false});

      if (error) {
        throw new Error(formatSupabaseDbError(error.message));
      }

      const rows = (data as DisasterReport[]) ?? [];
      setReports(rows);

      const {signedUrlMap} = await resolveReportSignedUrls(client, rows, 3600);
      setSignedUrls(signedUrlMap);
      setBrokenImages({});
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load disaster reports.';
      setErrorMsg(formatSupabaseDbError(msg));
    } finally {
      setLoadingReports(false);
    }
  }, [userId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const validationErr = validateDisasterImageFile(file);
      if (validationErr) {
        setErrorMsg(validationErr);
        e.target.value = '';
        return;
      }
    }
    setErrorMsg(null);
    setImageFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const client = supabase;
    if (!client) {
      setErrorMsg('Supabase is not configured.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Enter an incident description.');
      return;
    }

    if (gps.status !== 'ready' || gps.lat === null || gps.lng === null) {
      setErrorMsg(
        'Real GPS coordinates are required to file a disaster report. Allow location access and retry.',
      );
      return;
    }

    setSubmitting(true);
    let uploadedPath = '';
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      let uploadedUrl = '';

      if (imageFile) {
        const uploaded = await uploadDisasterImageWithSignedUrl(
          client,
          verifiedUserId,
          imageFile,
          3600,
        );
        uploadedPath = uploaded.path;
        uploadedUrl = uploaded.signedUrl;
      }

      const nowIso = new Date().toISOString();
      const {data, error} = await client
        .from('disaster_reports')
        .insert({
          user_id: verifiedUserId,
          disaster_category: category,
          locality:
            locationLabel.trim() || `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`,
          description: description.trim(),
          latitude: gps.lat,
          longitude: gps.lng,
          incident_photo_url: uploadedUrl,
          incident_photo_path: uploadedPath,
          status: 'SUBMITTED',
          updated_at: nowIso,
        })
        .select()
        .single();

      if (error || !data) {
        if (uploadedPath) {
          await deleteDisasterImage(client, uploadedPath);
        }
        throw new Error(error?.message || 'Could not save disaster report.');
      }

      setSuccessMsg('Disaster report saved to Supabase.');
      setDescription('');
      setLocationLabel('');
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      await loadReports();
    } catch (err) {
      if (uploadedPath) {
        await deleteDisasterImage(client, uploadedPath);
      }
      const msg = err instanceof Error ? err.message : 'Report submission failed.';
      setErrorMsg(formatSupabaseDbError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Disaster Reporting
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {gps.status === 'ready' && gps.lat !== null && gps.lng !== null
              ? `Current GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
              : 'Waiting for GPS location'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshGps}
          className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 cursor-pointer self-start sm:self-auto"
        >
          Refresh GPS
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-slate-900">
            Submit New Report
          </h2>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Disaster Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {DISASTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Landmark / Locality Name (Optional)
            </label>
            <input
              type="text"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="e.g. Ward 14 Bridge, Near Railway Crossing"
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe severity, blocked routes, water depth, or damage..."
              className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Incident Photo (Supabase Storage)
            </label>
            <label className="flex items-center justify-center gap-2 h-11 px-4 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>{imageFile ? imageFile.name : 'Choose Image File'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Incident preview"
                className="mt-2.5 w-full h-40 object-cover rounded-lg border border-slate-200"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? 'Uploading & Saving...' : 'Submit Disaster Report'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Your Submitted Reports
            </h2>
            <button
              type="button"
              onClick={loadReports}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingReports ? (
            <p className="text-xs text-slate-500 py-6">Loading disaster reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              You have not submitted any disaster reports yet.
            </p>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => {
                const resolvedPhotoUrl = signedUrls[r.id] || '';
                return (
                  <article
                    key={r.id}
                    className="p-4 border border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {r.disaster_category}
                      </span>
                      <span className="text-xs font-mono text-slate-600">
                        {r.status} · {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {r.description}
                    </p>
                    <p className="text-xs font-mono text-slate-500 tabular-nums">
                      {r.locality ? `${r.locality} · ` : ''}
                      {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                    </p>
                    {resolvedPhotoUrl && !brokenImages[r.id] && (
                      <img
                        src={resolvedPhotoUrl}
                        alt={`${r.disaster_category} report`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({...prev, [r.id]: true}))
                        }
                        className="w-full max-h-56 object-cover rounded-lg border border-slate-200 mt-2"
                      />
                    )}
                    {(r.incident_photo_path || r.incident_photo_url) &&
                      (!resolvedPhotoUrl || brokenImages[r.id]) && (
                        <p className="text-xs text-amber-700 mt-1">
                          Private image attached — tap Refresh to renew signed link.
                        </p>
                      )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
