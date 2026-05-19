'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

type AcademicYear = {
  id: string;
  year_label: string;
  is_current: boolean;
};

type TermRow = {
  id: string;
  year_id: string;
  term_number: number;
  start_date: string;
  end_date: string;
  status: string;
};

type ClassRow = { id: string; name: string; next_class_id: string | null };

type CanPromote = {
  can_promote?: boolean;
  reason?: string;
  term_3_end?: string;
  today?: string;
};

export default function AcademicManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'terms' | 'promotion' | 'timetables'>('terms');

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [canPromote, setCanPromote] = useState<CanPromote | null>(null);
  const [termDrafts, setTermDrafts] = useState<Record<string, { start_date: string; end_date: string }>>({});

  const [promotionLoading, setPromotionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [saveAllLoading, setSaveAllLoading] = useState(false);
  const [addYearLoading, setAddYearLoading] = useState(false);
  const [newYearLabel, setNewYearLabel] = useState('');

  const [timetables, setTimetables] = useState<Record<string, unknown>[]>([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttUploading, setTtUploading] = useState(false);
  const [ttClassId, setTtClassId] = useState('');
  const [ttStreamId, setTtStreamId] = useState<string | null>('');
  const [ttYear, setTtYear] = useState('');
  const [allStreams, setAllStreams] = useState<any[]>([]);
  const [ttStreams, setTtStreams] = useState<any[]>([]);

  const selectedYear = useMemo(
    () => (selectedYearId ? years.find((y) => y.id === selectedYearId) : undefined),
    [years, selectedYearId]
  );

  const termsForSelectedYear = useMemo(() => {
    if (!selectedYearId) return [];
    return terms.filter((t) => t.year_id === selectedYearId).sort((a, b) => a.term_number - b.term_number);
  }, [terms, selectedYearId]);

  const currentYear = useMemo(() => years.find((y) => y.is_current), [years]);

  const nextYearLabel = useMemo(() => {
    if (!currentYear) return null;
    const n = parseInt(currentYear.year_label, 10);
    if (Number.isNaN(n)) return null;
    return String(n + 1);
  }, [currentYear]);

  const nextYearExists = useMemo(() => {
    if (!nextYearLabel) return false;
    return years.some((y) => y.year_label === nextYearLabel);
  }, [years, nextYearLabel]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/academic/overview');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load');
      }
      const yList = (json.academic_years || []) as AcademicYear[];
      setYears(yList);
      setTerms(json.terms || []);
      setClasses(json.classes || []);
      setCanPromote(json.can_promote || null);
      
      const streamsRes = await fetch('/api/classes');
      const streamsJson = await streamsRes.json();
      setAllStreams(streamsJson.data?.streams || []);

      const drafts: Record<string, { start_date: string; end_date: string }> = {};
      (json.terms as TermRow[]).forEach((t) => {
        drafts[t.id] = { start_date: t.start_date?.slice(0, 10), end_date: t.end_date?.slice(0, 10) };
      });
      setTermDrafts(drafts);

      const cy = yList.find((y) => y.is_current);
      setSelectedYearId((prev) => {
        if (prev && yList.some((y) => y.id === prev)) return prev;
        return cy?.id ?? yList[0]?.id ?? null;
      });

      setTtYear((prev) => prev || cy?.year_label || yList[0]?.year_label || '');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Could not load academic data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadTimetables = async () => {
    setTtLoading(true);
    try {
      const res = await fetch('/api/academic/timetables');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setTimetables(json.timetables || []);
      if (json.warning) toast.message(json.warning);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load timetables');
    } finally {
      setTtLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'timetables') loadTimetables();
  }, [activeTab]);

  const saveTerm = async (termId: string) => {
    const d = termDrafts[termId];
    if (!d) return;
    if (d.start_date > d.end_date) {
      toast.error('Beginning date must be on or before end date');
      return;
    }
    try {
      const res = await fetch(`/api/academic/terms/${termId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: d.start_date, end_date: d.end_date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(`Term saved`);
      if (json.sync_warning) toast.message(json.sync_warning);
      await loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const saveAllTermsForYear = async () => {
    if (termsForSelectedYear.length === 0) return;
    for (const t of termsForSelectedYear) {
      const d = termDrafts[t.id];
      if (d && d.start_date > d.end_date) {
        toast.error(`Term ${t.term_number}: beginning must be before end`);
        return;
      }
    }
    setSaveAllLoading(true);
    try {
      for (const t of termsForSelectedYear) {
        const d = termDrafts[t.id];
        if (!d) continue;
        const res = await fetch(`/api/academic/terms/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: d.start_date, end_date: d.end_date }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Term ${t.term_number} failed`);
      }
      toast.success('All term dates saved');
      await loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaveAllLoading(false);
    }
  };

  const createAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newYearLabel.trim();
    if (!/^\d{4}$/.test(label)) {
      toast.error('Enter a 4-digit year (e.g. 2028)');
      return;
    }
    setAddYearLoading(true);
    try {
      const res = await fetch('/api/academic/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year_label: label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not create year');
      toast.success(json.message || `Year ${label} added`);
      setNewYearLabel('');
      await loadOverview();
      if (json.academic_year?.id) setSelectedYearId(json.academic_year.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create year');
    } finally {
      setAddYearLoading(false);
    }
  };

  const runSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/academic/sync-terms', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      toast.success('Term statuses updated from dates (Africa/Kampala)');
      await loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const runPromote = async () => {
    if (!canPromote?.can_promote) {
      toast.error(canPromote?.reason || 'Promotion not allowed');
      return;
    }
    if (!nextYearExists) {
      toast.error(`Create academic year ${nextYearLabel} below first (Term dates tab), then promote.`);
      return;
    }
    if (!confirm('Close the current academic year and promote all students? This cannot be undone.')) return;

    setPromotionLoading(true);
    try {
      const res = await fetch('/api/academic/promote', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.details?.reason || 'Promotion failed');
      const r = json.result as Record<string, unknown> | undefined;
      const desc = r
        ? `Closed ${r.closed_year} → opened ${r.opened_year}. Archived ${r.archived_rows}, promoted ${r.promoted_rows}, graduated ${r.graduated_rows}.` 
        : undefined;
      toast.success('Academic year closed and students promoted.', { description: desc });
      await loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Promotion failed');
    } finally {
      setPromotionLoading(false);
    }
  };

  const handleTtClassChange = (classId: string) => {
    setTtClassId(classId);
    setTtStreamId('');
    if (classId) {
      const filtered = allStreams.filter(s => s.class_id === classId);
      setTtStreams(filtered);
    } else {
      setTtStreams([]);
    }
  };

  const uploadTimetable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ttClassId || !ttYear) {
      toast.error('Class and academic year are required');
      return;
    }
    const input = (e.target as HTMLFormElement).elements.namedItem('file') as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      toast.error('Choose a file');
      return;
    }
    setTtUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('class_id', ttClassId);
      fd.append('academic_year', ttYear);
      if (ttStreamId) fd.append('stream_id', ttStreamId);
      const res = await fetch('/api/academic/timetables', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.hint ? `${json.error} — ${json.hint}` : json.error || 'Upload failed');
      toast.success('Timetable uploaded');
      input.value = '';
      await loadTimetables();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTtUploading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex">
      {/* Sidebar - Fixed Position */}
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 h-full overflow-y-auto transition-all duration-300 pt-16 lg:pt-0 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Academic calendar</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Choose the school year, set the beginning and end of each term, then sync statuses. Dates use the school
              calendar (validation uses Africa/Kampala).
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading academic data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Academic Years Section */}
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Academic year</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-4xl md:text-5xl font-bold text-[#1a237e] tabular-nums">
                        {selectedYear?.year_label ?? '—'}
                      </span>
                      {selectedYear?.is_current && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Current year
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {years.length === 0
                        ? 'No years in the database yet — add one below.'
                        : 'Switch year to edit that year\'s term table.'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div>
                      <label htmlFor="year-select" className="block text-xs font-medium text-gray-600 mb-1">
                        Switch year
                      </label>
                      <select
                        id="year-select"
                        value={selectedYearId || ''}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                      >
                        {years.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.year_label}
                            {y.is_current ? ' (current)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <form onSubmit={createAcademicYear} className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="new-year" className="block text-xs font-medium text-gray-600 mb-1">
                      Add a new academic year
                    </label>
                    <input
                      id="new-year"
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="e.g. 2028"
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-32"
                      value={newYearLabel}
                      onChange={(e) => setNewYearLabel(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addYearLoading || newYearLabel.length !== 4}
                    className="px-4 py-2.5 rounded-lg bg-[#1a237e] text-white text-sm font-medium hover:bg-[#283593] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addYearLoading ? 'Creating…' : 'Create year & 3 terms'}
                  </button>
                  <p className="text-xs text-gray-500 w-full sm:w-auto sm:flex-1">
                    Creates placeholder term dates you can edit in the table. Use a 4-digit label (e.g. 2027).
                  </p>
                </form>
              </div>

              {currentYear && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm text-amber-950">
                  <strong>Promotion:</strong> next school year in the system:{' '}
                  <span className="font-mono">{nextYearLabel}</span>{' '}
                  {nextYearExists ? (
                    <span className="text-emerald-800">(ready)</span>
                  ) : (
                    <span className="text-amber-900">— create it above before year-end promotion.</span>
                  )}
                </div>
              )}

              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex flex-wrap gap-4">
                  {(
                    [
                      ['terms', 'Term dates'],
                      ['overview', 'Overview'],
                      ['promotion', 'Promotion'],
                      ['timetables', 'Timetables'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              {activeTab === 'terms' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Term beginning & end</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Year <span className="font-mono font-medium text-gray-800">{selectedYear?.year_label}</span> — edit
                        the table, then save.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveAllTermsForYear}
                        disabled={saveAllLoading || termsForSelectedYear.length === 0}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saveAllLoading ? 'Saving…' : 'Save all terms'}
                      </button>
                      <button
                        type="button"
                        onClick={runSync}
                        disabled={syncLoading}
                        className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900 disabled:opacity-50"
                      >
                        {syncLoading ? 'Syncing…' : 'Sync statuses from dates'}
                      </button>
                    </div>
                  </div>

                  {termsForSelectedYear.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      No terms for this year. Create the year above (adds Term 1–3) or run SQL migrations.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Term</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Beginning</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">End</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {termsForSelectedYear.map((t) => {
                            const d = termDrafts[t.id];
                            return (
                              <tr key={t.id} className="hover:bg-gray-50/80">
                                <td className="py-3 px-4 font-medium text-gray-900">Term {t.term_number}</td>
                                <td className="py-3 px-4">
                                  <input
                                    type="date"
                                    className="border border-gray-300 rounded-md px-2 py-1.5 text-gray-900"
                                    value={d?.start_date ?? ''}
                                    onChange={(e) =>
                                      setTermDrafts((prev) => ({
                                        ...prev,
                                        [t.id]: {
                                          start_date: e.target.value,
                                          end_date: prev[t.id]?.end_date ?? t.end_date?.slice(0, 10) ?? '',
                                        },
                                      }))
                                    }
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="date"
                                    className="border border-gray-300 rounded-md px-2 py-1.5 text-gray-900"
                                    value={d?.end_date ?? ''}
                                    onChange={(e) =>
                                      setTermDrafts((prev) => ({
                                        ...prev,
                                        [t.id]: {
                                          end_date: e.target.value,
                                          start_date: prev[t.id]?.start_date ?? t.start_date?.slice(0, 10) ?? '',
                                        },
                                      }))
                                    }
                                  />
                                </td>
                                <td className="py-3 px-4 text-gray-600">{t.status}</td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => saveTerm(t.id)}
                                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                                  >
                                    Save row
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Class progression</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Each class points to the next via <code className="bg-gray-100 px-1 rounded">next_class_id</code>. Final
                      class (S6) has no next — those students become Alumni on promotion.
                    </p>
                    <ul className="text-sm space-y-1 font-mono text-gray-800">
                      {classes.map((c) => (
                        <li key={c.id}>
                          {c.name} →{' '}
                          {c.next_class_id ? classes.find((x) => x.id === c.next_class_id)?.name || c.next_class_id : 'Alumni'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Promotion rules</h3>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li>Term statuses follow the dates you set (Africa/Kampala when syncing).</li>
                      <li>
                        <strong>Close year &amp; promote</strong> runs only after Term 3&apos;s end date has passed.
                      </li>
                      <li>
                        Term 3 snapshot uses <strong>final_score</strong> when set, otherwise <strong>score</strong>.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'promotion' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Close academic year &amp; promote</h3>

                  {canPromote && (
                    <div
                      className={`border-l-4 p-4 rounded-r ${
                        canPromote.can_promote ? 'bg-emerald-50 border-emerald-500' : 'bg-amber-50 border-amber-500'
                      }`}
                    >
                      <p className={`text-sm ${canPromote.can_promote ? 'text-emerald-900' : 'text-amber-900'}`}>
                        <strong>{canPromote.can_promote ? 'Ready' : 'Blocked'}:</strong> {canPromote.reason}
                      </p>
                      {canPromote.term_3_end && (
                        <p className="text-xs mt-1 text-gray-600">
                          Term 3 ends: {canPromote.term_3_end} · Today (Kampala): {canPromote.today}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={runPromote}
                    disabled={!canPromote?.can_promote || !nextYearExists || promotionLoading}
                    className={`w-full py-3 px-4 rounded-lg font-medium ${
                      canPromote?.can_promote && nextYearExists && !promotionLoading
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {promotionLoading ? 'Running promotion…' : 'Close academic year & promote all students'}
                  </button>
                </div>
              )}

              {activeTab === 'timetables' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Timetable files</h3>
                  <p className="text-sm text-gray-600">
                    Upload PDF or images to the Storage bucket <code className="bg-gray-100 px-1 rounded">timetables</code>.
                  </p>

                  <form
                    onSubmit={uploadTimetable}
                    className="flex flex-col md:flex-row md:flex-wrap gap-4 items-end border border-gray-200 rounded-lg p-4"
                  >
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Academic year label</label>
                      <input
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm w-36"
                        value={ttYear}
                        onChange={(e) => setTtYear(e.target.value)}
                        placeholder="2026"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[8rem]"
                        value={ttClassId}
                        onChange={(e) => handleTtClassChange(e.target.value)}
                      >
                        <option value="">Select Class…</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Stream (Optional)</label>
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[8rem]"
                        value={ttStreamId || ''}
                        onChange={(e) => setTtStreamId(e.target.value)}
                        disabled={!ttClassId}
                      >
                        <option value="">Select Stream…</option>
                        {ttStreams.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">File</label>
                      <input name="file" type="file" accept=".pdf,image/*" className="text-sm" />
                    </div>
                    <button
                      type="submit"
                      disabled={ttUploading}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {ttUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </form>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Uploaded</h4>
                    {ttLoading ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : timetables.length === 0 ? (
                      <p className="text-sm text-gray-500">None yet.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                        {timetables.map((row: Record<string, unknown>) => (
                          <li key={String(row.id)} className="px-4 py-3 text-sm flex flex-wrap justify-between gap-2">
                            <span>
                              {String(row.academic_year)} · class {String(row.class_id)}
                              {row.stream_id ? ` · ${String(row.stream_id)}` : ''}
                            </span>
                            <a
                              href={String(row.file_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              {String(row.file_name || 'Open')}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
