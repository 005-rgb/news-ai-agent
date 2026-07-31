import React, { useEffect, useState, useCallback } from 'react';
import { rapat as rapatApi, calendar as calendarApi, sites as sitesApi } from '../lib/api';

const STATUS_BADGE = {
  predicted: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  missed:    'bg-gray-100 text-gray-500',
};

const CAL_STATUS_COLORS = {
  planned:     'bg-blue-50 border-blue-200 text-blue-800',
  in_progress: 'bg-purple-50 border-purple-200 text-purple-800',
  done:        'bg-green-50 border-green-200 text-green-800',
  skipped:     'bg-gray-50 border-gray-200 text-gray-500',
};

const FORMATS = ['berita_singkat','berita_panjang','jurnal_review','feature_opini','listicle','faq_article','evergreen'];
const CATEGORIES = ['umum','teknologi','bisnis','kesehatan','pendidikan','politik','olahraga','hiburan','sains','akademik'];

// Generate next 7 days from today
function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  return `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
}

// Modal to add/edit a calendar entry
function CalendarEntryModal({ entry, sites, onSave, onClose }) {
  const [form, setForm] = useState({
    site_id:        entry?.site_id        || (sites[0]?.id || ''),
    topic:          entry?.topic          || '',
    category:       entry?.category       || 'umum',
    format:         entry?.format         || 'berita_singkat',
    scheduled_date: entry?.scheduled_date || getNext7Days()[0],
    priority:       entry?.priority       || 'normal',
    notes:          entry?.notes          || '',
    status:         entry?.status         || 'planned',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.topic.trim()) { setErr('Topik wajib diisi.'); return; }
    if (!form.site_id) { setErr('Pilih site.'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (ex) {
      setErr(ex?.message || 'Gagal menyimpan.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">{entry ? 'Edit Entri Kalender' : 'Tambah Topik ke Kalender'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="text-sm text-red-700 bg-red-50 rounded px-3 py-2">{err}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Topik *</label>
            <input
              value={form.topic}
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              required placeholder="Judul topik artikel..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Site *</label>
              <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Format</label>
              <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {FORMATS.map(fm => <option key={fm} value={fm}>{fm.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prioritas</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            {entry && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg">
              {saving ? 'Menyimpan...' : entry ? 'Simpan Perubahan' : 'Tambah Topik'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Rapat() {
  const [notes, setNotes]           = useState([]);
  const [latest, setLatest]         = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [calendar, setCalendar]     = useState([]);
  const [sites, setSites]           = useState([]);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);
  const [viewTab, setViewTab]       = useState('notulen'); // 'notulen' | 'calendar'
  const [showModal, setShowModal]   = useState(false);
  const [editEntry, setEditEntry]   = useState(null);
  const [deleting, setDeleting]     = useState(null);

  const load = useCallback(async () => {
    const [n, l, p, cal, sl] = await Promise.all([
      rapatApi.list().catch(() => ({ data: [] })),
      rapatApi.latest().catch(() => ({ data: null })),
      rapatApi.predictions().catch(() => ({ data: [] })),
      calendarApi.list({ limit: 200 }).catch(() => ({ data: [] })),
      sitesApi.list().catch(() => ({ data: [] })),
    ]);
    setNotes(n.data || []);
    setLatest(l.data);
    setPredictions(p.data || []);
    setCalendar(cal.data || []);
    setSites(sl.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async () => {
    if (!confirm('Jalankan Rapat Redaksi sekarang?')) return;
    setTriggering(true);
    const res = await rapatApi.trigger().catch(e => ({ data: { message: e?.message || 'Error' } }));
    setTriggerResult(res.data);
    setTriggering(false);
    load();
  };

  const handleSaveEntry = async (form) => {
    if (editEntry) {
      await calendarApi.update(editEntry.id, form);
    } else {
      await calendarApi.create(form);
    }
    setEditEntry(null);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus topik ini dari kalender?')) return;
    setDeleting(id);
    await calendarApi.delete(id).catch(() => {});
    setDeleting(null);
    await load();
  };

  const handleOpenEdit = (entry) => {
    setEditEntry(entry);
    setShowModal(true);
  };

  const handleOpenAdd = (dateStr, siteId) => {
    setEditEntry(dateStr && siteId ? { scheduled_date: dateStr, site_id: siteId } : null);
    setShowModal(true);
  };

  // Build calendar grid: days × sites
  const days = getNext7Days();

  // Group calendar entries by date + site
  const calGrid = {};
  for (const c of calendar) {
    const date = c.scheduled_date?.slice(0, 10);
    if (!date) continue;
    const key = `${date}|${c.site_id}`;
    if (!calGrid[key]) calGrid[key] = [];
    calGrid[key].push(c);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900">Rapat Redaksi</h2>
        <div className="flex gap-2">
          <button onClick={() => setViewTab(t => t === 'notulen' ? 'calendar' : 'notulen')}
            className="bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg">
            {viewTab === 'notulen' ? '📅 Lihat Kalender' : '📋 Lihat Notulen'}
          </button>
          <button onClick={handleTrigger} disabled={triggering}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {triggering ? 'Menjalankan...' : '🎙 Trigger Rapat Sekarang'}
          </button>
        </div>
      </div>

      {triggerResult && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm text-indigo-800">{triggerResult.message}</p>
          {triggerResult.note && <p className="text-xs text-indigo-600 mt-1">{triggerResult.note}</p>}
        </div>
      )}

      {/* ── Tab: Notulen ─────────────────────────────────────────────────────── */}
      {viewTab === 'notulen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latest notulen */}
          <div className="lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-3">Notulen Terbaru</h3>
            {!latest ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">Belum ada notulen rapat. Trigger rapat pertama untuk memulai.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium">📅 {latest.session_date}</span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 text-sm whitespace-pre-line">
                  {latest.summary || '(tidak ada ringkasan)'}
                </div>
              </div>
            )}

            {/* Archive */}
            {notes.length > 1 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Archive Notulen</h4>
                <div className="space-y-2">
                  {notes.slice(1, 6).map(n => (
                    <div key={n.id} className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                      <div className="font-medium text-gray-700">{n.session_date}</div>
                      <div className="text-gray-500 text-xs mt-1 line-clamp-2">{n.summary?.slice(0, 150) || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: predictions */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Prediksi Tren</h3>
            {predictions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
                <div className="text-3xl mb-2">🔮</div>
                <p className="text-xs">Belum ada prediksi. Tersedia setelah Phase 9.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {predictions.slice(0, 8).map(p => (
                  <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-gray-800">{p.topic}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[p.status] || 'bg-gray-100'}`}>
                        {p.confidence_score ? `${(p.confidence_score * 100).toFixed(0)}%` : p.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{p.category} · Peak: {p.predicted_peak_date || 'TBD'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick calendar list */}
            <h3 className="font-semibold text-gray-800 mt-6 mb-3">Topik Terdekat</h3>
            {calendar.filter(c => c.status === 'planned').length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400">
                <p className="text-xs">Belum ada topik direncanakan.</p>
                <button onClick={() => setShowModal(true)} className="text-blue-600 text-xs mt-1 hover:underline">+ Tambah topik</button>
              </div>
            ) : (
              <div className="space-y-2">
                {calendar.filter(c => c.status === 'planned').slice(0, 6).map(c => (
                  <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-medium text-gray-800 line-clamp-2">{c.topic}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>{c.site_name || '—'}</span>
                      <span>·</span>
                      <span>{c.scheduled_date || 'No date'}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{c.format?.replace(/_/g,' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Calendar Grid ────────────────────────────────────────────────── */}
      {viewTab === 'calendar' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Content Calendar — 7 Hari ke Depan</h3>
            <button
              onClick={() => { setEditEntry(null); setShowModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg"
            >
              + Tambah Topik
            </button>
          </div>

          {sites.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-sm">Belum ada site terdaftar. Tambahkan site terlebih dahulu.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Header row: days */}
                <div className="grid gap-px bg-gray-200 rounded-t-xl overflow-hidden"
                  style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(120px, 1fr))` }}>
                  {/* Corner cell */}
                  <div className="bg-gray-100 px-3 py-2.5 text-xs font-semibold text-gray-600">Site / Hari</div>
                  {days.map(d => (
                    <div key={d} className={`bg-gray-100 px-2 py-2.5 text-xs font-semibold text-center ${d === days[0] ? 'text-blue-700' : 'text-gray-600'}`}>
                      {dayLabel(d)}
                      {d === days[0] && <div className="text-blue-500 text-xs font-normal">Hari ini</div>}
                    </div>
                  ))}
                </div>

                {/* Site rows */}
                <div className="bg-gray-200 rounded-b-xl overflow-hidden">
                  {sites.map((site, sIdx) => (
                    <div key={site.id}
                      className={`grid gap-px ${sIdx < sites.length - 1 ? 'border-b border-gray-300' : ''}`}
                      style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(120px, 1fr))` }}>
                      {/* Site name */}
                      <div className="bg-white px-3 py-3 flex flex-col justify-center">
                        <div className="font-medium text-gray-800 text-xs truncate">{site.name}</div>
                        <div className="text-xs text-gray-400 truncate">{site.niche || '—'}</div>
                        <div className={`mt-0.5 w-2 h-2 rounded-full ${site.status === 'active' ? 'bg-green-400' : 'bg-gray-300'}`} />
                      </div>

                      {/* Day cells */}
                      {days.map(d => {
                        const key = `${d}|${site.id}`;
                        const entries = calGrid[key] || [];
                        return (
                          <div key={d} className="bg-white px-1.5 py-1.5 min-h-20 relative group">
                            {entries.length === 0 ? (
                              /* Empty cell */
                              <button
                                onClick={() => handleOpenAdd(d, site.id)}
                                className="w-full h-full min-h-16 flex items-center justify-center text-gray-200 hover:text-blue-400 hover:bg-blue-50 rounded-lg transition-colors text-lg"
                                title="Tambah topik"
                              >
                                +
                              </button>
                            ) : (
                              /* Entry cells */
                              <div className="space-y-1">
                                {entries.map(entry => (
                                  <div
                                    key={entry.id}
                                    className={`rounded border p-1.5 text-xs cursor-pointer hover:shadow-sm transition-shadow ${CAL_STATUS_COLORS[entry.status] || 'bg-gray-50 border-gray-200'}`}
                                  >
                                    <div className="font-medium line-clamp-2 leading-tight">{entry.topic}</div>
                                    <div className="text-xs opacity-60 mt-0.5 flex items-center gap-1">
                                      <span>{entry.format?.replace(/_/g,' ')}</span>
                                      {entry.priority === 'high' && <span className="text-red-500">●</span>}
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(entry); }}
                                        className="text-xs opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 bg-white/80 rounded hover:bg-blue-100 text-blue-600"
                                      >✏</button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                        disabled={deleting === entry.id}
                                        className="text-xs opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 bg-white/80 rounded hover:bg-red-100 text-red-500 disabled:opacity-50"
                                      >{deleting === entry.id ? '...' : '✕'}</button>
                                    </div>
                                  </div>
                                ))}
                                {/* Add more to same cell */}
                                <button
                                  onClick={() => handleOpenAdd(d, site.id)}
                                  className="w-full text-xs text-gray-300 hover:text-blue-500 py-0.5 text-center"
                                >+ tambah</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <span className="font-medium">Status:</span>
            {Object.entries({ planned: 'Direncanakan', in_progress: 'Sedang Dibuat', done: 'Selesai', skipped: 'Dilewati' }).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded border ${CAL_STATUS_COLORS[k]}`} />
                <span>{v}</span>
              </div>
            ))}
            <span>● = Prioritas tinggi</span>
          </div>

          {/* All entries list below grid */}
          {calendar.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-700 mb-3 text-sm">Semua Entri Kalender ({calendar.length})</h4>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Topik','Site','Tanggal','Format','Status','Prioritas','Aksi'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {calendar.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-800 max-w-xs">
                          <div className="text-xs line-clamp-2">{c.topic}</div>
                          {c.notes && <div className="text-xs text-gray-400 mt-0.5">{c.notes}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{c.site_name || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{c.scheduled_date || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{c.format?.replace(/_/g,' ') || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${CAL_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className={`${c.priority === 'high' ? 'text-red-500 font-medium' : c.priority === 'low' ? 'text-gray-400' : 'text-gray-600'}`}>{c.priority}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5">
                            <button onClick={() => handleOpenEdit(c)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                            <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
                              {deleting === c.id ? '...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CalendarEntryModal
          entry={editEntry}
          sites={sites}
          onSave={handleSaveEntry}
          onClose={() => { setShowModal(false); setEditEntry(null); }}
        />
      )}
    </div>
  );
}
