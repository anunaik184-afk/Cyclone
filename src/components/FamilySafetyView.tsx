import React, {useCallback, useEffect, useState} from 'react';
import {AlertTriangle, CheckCircle2, Pencil, Plus, Trash2} from 'lucide-react';
import {
  formatSupabaseDbError,
  requireAuthenticatedUserId,
  supabase,
  type EmergencyContact,
  type FamilyMember,
} from '../lib/supabase';

interface FamilySafetyViewProps {
  userId: string;
}

export function FamilySafetyView({userId}: FamilySafetyViewProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Family form
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [mName, setMName] = useState('');
  const [mRel, setMRel] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mBlood, setMBlood] = useState('');
  const [mStatus, setMStatus] = useState('Safe');

  // Contact form
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cRel, setCRel] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cPriority, setCPriority] = useState(1);

  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      const [famRes, conRes] = await Promise.all([
        supabase
          .from('family_members')
          .select(
            'id, user_id, name, relationship, phone, blood_group, status, notes, created_at, updated_at',
          )
          .eq('user_id', verifiedUserId)
          .order('created_at', {ascending: false}),
        supabase
          .from('emergency_contacts')
          .select(
            'id, user_id, contact_name, relationship, phone, email, priority, created_at, updated_at',
          )
          .eq('user_id', verifiedUserId)
          .order('priority', {ascending: true}),
      ]);
      if (famRes.error) {
        throw new Error(formatSupabaseDbError(famRes.error.message));
      }
      if (conRes.error) {
        throw new Error(formatSupabaseDbError(conRes.error.message));
      }
      setMembers((famRes.data as FamilyMember[]) ?? []);
      setContacts((conRes.data as EmergencyContact[]) ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load family data.';
      setErrorMsg(formatSupabaseDbError(msg));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setMName('');
    setMRel('');
    setMPhone('');
    setMBlood('');
    setMStatus('Safe');
  };

  const resetContactForm = () => {
    setEditingContactId(null);
    setCName('');
    setCRel('');
    setCPhone('');
    setCPriority(1);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = mName.trim();
    const cleanRel = mRel.trim();
    const cleanPhone = mPhone.trim();
    if (!cleanName || !cleanRel || !cleanPhone) {
      setErrorMsg('Full name, relationship, and phone number are required.');
      return;
    }

    setSaving(true);
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      const nowIso = new Date().toISOString();

      if (editingMemberId) {
        const {data, error} = await supabase
          .from('family_members')
          .update({
            name: cleanName,
            relationship: cleanRel,
            phone: cleanPhone,
            blood_group: mBlood.trim(),
            status: mStatus,
            updated_at: nowIso,
          })
          .eq('id', editingMemberId)
          .eq('user_id', verifiedUserId)
          .select()
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Could not update family member.');
        }
        setSuccessMsg(`Updated family member "${cleanName}" in Supabase.`);
      } else {
        const {data, error} = await supabase
          .from('family_members')
          .insert({
            user_id: verifiedUserId,
            name: cleanName,
            relationship: cleanRel,
            phone: cleanPhone,
            blood_group: mBlood.trim(),
            status: mStatus,
            notes: '',
            updated_at: nowIso,
          })
          .select()
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Could not save family member.');
        }
        setSuccessMsg(`Added family member "${cleanName}" to Supabase.`);
      }

      resetMemberForm();
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save family member.';
      setErrorMsg(formatSupabaseDbError(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!supabase) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      const {error} = await supabase
        .from('family_members')
        .delete()
        .eq('id', id)
        .eq('user_id', verifiedUserId);
      if (error) {
        throw new Error(error.message);
      }
      setSuccessMsg('Family member deleted from Supabase.');
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete family member.';
      setErrorMsg(formatSupabaseDbError(msg));
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = cName.trim();
    const cleanRel = cRel.trim();
    const cleanPhone = cPhone.trim();
    if (!cleanName || !cleanRel || !cleanPhone) {
      setErrorMsg('Contact name, relationship, and phone number are required.');
      return;
    }

    setSaving(true);
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      const nowIso = new Date().toISOString();

      if (editingContactId) {
        const {data, error} = await supabase
          .from('emergency_contacts')
          .update({
            contact_name: cleanName,
            relationship: cleanRel,
            phone: cleanPhone,
            priority: cPriority,
            updated_at: nowIso,
          })
          .eq('id', editingContactId)
          .eq('user_id', verifiedUserId)
          .select()
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Could not update emergency contact.');
        }
        setSuccessMsg(`Updated emergency contact "${cleanName}" in Supabase.`);
      } else {
        const {data, error} = await supabase
          .from('emergency_contacts')
          .insert({
            user_id: verifiedUserId,
            contact_name: cleanName,
            relationship: cleanRel,
            phone: cleanPhone,
            email: '',
            priority: cPriority,
            updated_at: nowIso,
          })
          .select()
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Could not save emergency contact.');
        }
        setSuccessMsg(`Added emergency contact "${cleanName}" to Supabase.`);
      }

      resetContactForm();
      await loadAll();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not save emergency contact.';
      setErrorMsg(formatSupabaseDbError(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!supabase) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const verifiedUserId = await requireAuthenticatedUserId(userId);
      const {error} = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id)
        .eq('user_id', verifiedUserId);
      if (error) {
        throw new Error(error.message);
      }
      setSuccessMsg('Emergency contact deleted from Supabase.');
      await loadAll();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not delete emergency contact.';
      setErrorMsg(formatSupabaseDbError(msg));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Family Safety &amp; Emergency Contacts
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          All records are persisted in Supabase PostgreSQL with Row Level Security.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Family Members Section */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Family Members
          </h2>

          <form onSubmit={handleSaveMember} className="space-y-3 pb-4 border-b border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="Full Name"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                value={mRel}
                onChange={(e) => setMRel(e.target.value)}
                placeholder="Relationship (e.g. Mother)"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="tel"
                required
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
                placeholder="Phone (+91...)"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={mBlood}
                onChange={(e) => setMBlood(e.target.value)}
                placeholder="Blood Group (e.g. O+)"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <select
                value={mStatus}
                onChange={(e) => setMStatus(e.target.value)}
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Safe">Status: Safe</option>
                <option value="Needs Check-in">Status: Needs Check-in</option>
                <option value="Assistance Needed">Status: Assistance Needed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingMemberId ? 'Update Member' : 'Add Family Member'}</span>
              </button>
              {editingMemberId && (
                <button
                  type="button"
                  onClick={resetMemberForm}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <p className="text-xs text-slate-500">Loading family members...</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-slate-500">No family members saved yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((m) => (
                <div key={m.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {m.name} · {m.relationship}
                    </p>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {m.phone}
                      {m.blood_group ? ` · Blood ${m.blood_group}` : ''} · {m.status}
                    </p>
                    {m.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{m.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMemberId(m.id);
                        setMName(m.name);
                        setMRel(m.relationship);
                        setMPhone(m.phone);
                        setMBlood(m.blood_group || '');
                        setMStatus(m.status || 'Safe');
                      }}
                      title="Edit"
                      className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMember(m.id)}
                      title="Delete"
                      className="p-1.5 text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Emergency Contacts Section */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Emergency Contacts
          </h2>

          <form onSubmit={handleSaveContact} className="space-y-3 pb-4 border-b border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Contact Name"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                value={cRel}
                onChange={(e) => setCRel(e.target.value)}
                placeholder="Relationship"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="tel"
                required
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
                placeholder="Phone (+91...)"
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg"
              />
              <select
                value={cPriority}
                onChange={(e) => setCPriority(Number(e.target.value))}
                className="h-9 px-3 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value={1}>Priority 1 (Primary)</option>
                <option value={2}>Priority 2 (Secondary)</option>
                <option value={3}>Priority 3 (Backup)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingContactId ? 'Update Contact' : 'Add Emergency Contact'}</span>
              </button>
              {editingContactId && (
                <button
                  type="button"
                  onClick={resetContactForm}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <p className="text-xs text-slate-500">Loading emergency contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-slate-500">No emergency contacts saved yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <div key={c.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {c.contact_name} · Priority {c.priority}
                    </p>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {c.relationship} · {c.phone}
                      {c.email ? ` · ${c.email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContactId(c.id);
                        setCName(c.contact_name);
                        setCRel(c.relationship);
                        setCPhone(c.phone);
                        setCPriority(c.priority || 1);
                      }}
                      title="Edit"
                      className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      title="Delete"
                      className="p-1.5 text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
