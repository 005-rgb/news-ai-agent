import React, { useEffect, useState } from 'react';
import { articles as articlesApi, sites as sitesApi, queue as queueApi } from '../lib/api';

const STATUS_COLORS = {
  researching:'bg-blue-100 text-blue-800',
  writing:'bg-indigo-100 text-indigo-800',
  editing:'bg-purple-100 text-purple-800',
  qc:'bg-yellow-100 text-yellow-800',
  imaging:'bg-orange-100 text-orange-800',
  seo:'bg-cyan-100 text-cyan-800',
  scheduled:'bg-teal-100 text-teal-800',
  published:'bg-green-100 text-green-800',
  failed:'bg-red-100 text-red-800',
  draft:'bg-gray-100 text-gray-600',
};

const PIPELINE_STEPS = ['RESEARCH','WRITE','EDIT','QC','IMAGE','SEO'];
const FORMATS = ['berita_singkat','berita_panjang','jurnal_review','feature_opini','listicle','faq_article','evergreen'];
const CATEGORIES = ['umum','teknologi','bisnis','kesehatan','pendidikan','politik','olahraga','hiburan','sains','akademik'];

export default function Articles() {
  const [list, setList]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [sites, setSites]     = useState([]);
  const [filters, setFilters] = useState({ site_id:'', status:'', page:1 });
  const [selected, setSelected] = useState(null);  // full article from GET /articles/:id
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runForm, setRunForm] = useState(false);
  const [runData, setRunData] = useState({ topic:'', site_id:'', category:'umum', format:'berita_singkat' });
  const [runError, setRunError] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [regenStep, setRegenStep] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'brief' | 'scores'

  const load = async () => {
    setLoading(true);
    const [ar, sl] = await Promise.all([
      articlesApi.list({ ...filters, limit: 20 }).catch(() => ({ data: [], pagination: { total: 0 } })),
      sitesApi.list().catch(() => ({ data: [] })),
    ]);
    setList(ar.data || []);
    setTotal(ar.pagination?.total || 0);
    setSites(sl.data || []);
    setLoading(false);
  };

  // Reset page to 1 when changing filters (not when changing page itself)
  const setFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }));
  };

  useEffect(() => { load(); }, [filters.site_id, filters.status, filters.page]);

  const handleSelectArticle = async (row) => {
    setSelected(null);
    setDetailLoading(true);
    setActiveTab('content');
    setContentExpanded(false);
    try {
      const res = await articlesApi.get(row.id);
      setSelected(res.data || row);
    } catch {
      setSelected(row); // fallback to list data
    }
    setDetailLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus artikel ini? Tindakan ini tidak bisa dibatalkan.')) return;
    await articlesApi.delete(id);
    setSelected(null);
    load();
  };

  const handleRun = async (e) => {
    e.preventDefault();
    setRunError('');
    setRunLoading(true);
    try {
      await queueApi.run(runData);
      setRunForm(false);
      setRunData({ topic:'', site_id:'', category:'umum', format:'berita_singkat' });
      load();
    } catch (err) {
      setRunError(err?.message || 'Gagal memulai pipeline. Pastikan ada API key aktif dan site terdaftar.');
    } finally {
      setRunLoading(false);
    }
  };

  const handleRegen = async () => {
    if (!selected || !regenStep) return;
    setRegenLoading(true);
    try {
      await articlesApi.regenerate(selected.id, regenStep);
      // Refresh detail
      const res = await articlesApi.get(selected.id);
      setSelected(res.data || selected);
      load();
    } catch (err) {
      alert(err?.message || 'Regenerasi gagal.');
    } finally {
      setRegenLoading(false);
    }
  };

  const handleForcePublish = async () => {
    try {
      await articlesApi.forcePublish(selected.id);
      const res = await articlesApi.get(selected.id);
      setSelected(res.data || selected);
      load();
    } catch (err) {
      alert(err?.message || 'Force publish gagal.');
    }
  };

  // Extract content to show: prefer content, fallback to content_versions.mainArticle
  const getArticleContent = (art) => {
    if (!art) return '';
    if (art.content) return art.content;
    try {
      const cv = typeof art.content_versions === 'string' ? JSON.parse(art.content_versions) : art.content_versions;
      return cv?.mainArticle || '';
    } catch { return ''; }
  };

  const getBriefData = (art) => {
    if (!art) return null;
    try {
      return typeof art.brief_data === 'string' ? JSON.parse(art.brief_data) : art.brief_data;
    } catch { return null; }
  };

  const getContentVersions = (art) => {
    if (!art) return null;
    try {
      return typeof art.content_versions === 'string' ? JSON.parse(art.content_versions) : art.content_versions;
    } catch { return null; }
  };

  const content = getArticleContent(selected);
  const brief   = getBriefData(selected);
  const cv      = getContentVersions(selected);

  return (
    <div className="flex gap-4 h-full">
      {/* ── List panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Articles ({total})</h2>
          <button
            onClick={() => { setRunForm(s => !s); setRunError(''); }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            ▶ Jalankan Pipeline
          </button>
        </div>

        {/* Run pipeline form */}
        {runForm && (
          <form onSubmit={handleRun} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-blue-800 mb-3">Jalankan Pipeline Baru</h3>
            {runError && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{runError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Topik *</label>
                <input
                  value={runData.topic}
                  onChange={e => setRunData(f => ({ ...f, topic: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: Perkembangan AI dalam dunia pendidikan Indonesia 2026"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Site *</label>
                <select
                  value={runData.site_id}
                  onChange={e => setRunData(f => ({ ...f, site_id: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Kategori</label>
                <select
                  value={runData.category}
                  onChange={e => setRunData(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Format</label>
                <select
                  value={runData.format}
                  onChange={e => setRunData(f => ({ ...f, format: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FORMATS.map(fm => <option key={fm} value={fm}>{fm.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={runLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {runLoading ? 'Memulai...' : '▶ Mulai Pipeline'}
              </button>
              <button
                type="button"
                onClick={() => { setRunForm(false); setRunError(''); }}
                className="bg-white border text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <select
            value={filters.site_id}
            onChange={e => setFilter('site_id', e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua site</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={e => setFilter('status', e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua status</option>
            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={load} className="text-sm text-blue-600 hover:text-blue-800 px-2">🔄</button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📰</div>
              <p className="text-sm">Belum ada artikel.</p>
              <p className="text-xs mt-1">Klik <strong>▶ Jalankan Pipeline</strong> untuk memulai pipeline.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Judul','Site','Format','Status','Quality','E-E-A-T','Dibuat'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map(a => (
                  <tr
                    key={a.id}
                    onClick={() => handleSelectArticle(a)}
                    className={`hover:bg-gray-50 cursor-pointer ${selected?.id === a.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-800 font-medium max-w-xs">
                      <div className="truncate text-xs">{a.title || '(Dalam proses...)'}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{a.site_name || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{a.format?.replace(/_/g,' ') || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-700 text-xs font-medium">
                      {a.quality_score ? `${a.quality_score}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-700 text-xs font-medium">
                      {a.eeat_score ? `${a.eeat_score}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs">
                      {new Date(a.created_at).toLocaleString('id-ID', { dateStyle:'short', timeStyle:'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Pagination */}
          {total > 20 && (
            <div className="flex justify-center gap-2 p-3 border-t border-gray-100">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilter('page', filters.page - 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40"
              >‹ Prev</button>
              <span className="px-3 py-1 text-sm text-gray-500">
                {filters.page} / {Math.ceil(total / 20)}
              </span>
              <button
                disabled={filters.page >= Math.ceil(total / 20)}
                onClick={() => setFilter('page', filters.page + 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40"
              >Next ›</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────────── */}
      {(detailLoading || selected) && (
        <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {detailLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat detail...</div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug flex-1">
                    {selected.title || '(Dalam proses...)'}
                  </h3>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] || 'bg-gray-100'}`}>
                    {selected.status}
                  </span>
                  {selected.format && (
                    <span className="text-xs text-gray-500">{selected.format.replace(/_/g,' ')}</span>
                  )}
                  {selected.category && (
                    <span className="text-xs text-gray-400">#{selected.category}</span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 flex-shrink-0">
                {['content','brief','scores'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-xs font-medium capitalize ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {tab === 'content' ? 'Konten' : tab === 'brief' ? 'Brief Riset' : 'Skor & Meta'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4">

                {/* Content tab */}
                {activeTab === 'content' && (
                  <div>
                    {content ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">
                            Artikel ({cv?.wordCount ? `${cv.wordCount} kata` : `~${Math.round(content.split(/\s+/).length)} kata`})
                          </span>
                          <button
                            onClick={() => setContentExpanded(e => !e)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {contentExpanded ? 'Ringkas' : 'Tampilkan semua'}
                          </button>
                        </div>
                        <div className={`text-xs text-gray-700 leading-relaxed whitespace-pre-wrap ${contentExpanded ? '' : 'line-clamp-12'}`}>
                          {content}
                        </div>

                        {/* Social Caption */}
                        {cv?.socialCaption && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-600 mb-1">Caption Media Sosial</div>
                            <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">{cv.socialCaption}</div>
                          </div>
                        )}

                        {/* Key Takeaways */}
                        {cv?.keyTakeaways?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-600 mb-1">Key Takeaways</div>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {cv.keyTakeaways.map((t, i) => (
                                <li key={i} className="flex gap-1.5"><span className="text-blue-400 flex-shrink-0">•</span>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Image placeholders */}
                        {cv?.imagePlaceholders?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-600 mb-1">Placeholder Gambar</div>
                            {cv.imagePlaceholders.map((p, i) => (
                              <div key={i} className="text-xs text-gray-500 bg-orange-50 rounded px-2 py-1 mb-1">{p}</div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-8">
                        {['researching','writing'].includes(selected.status)
                          ? 'Konten sedang dibuat oleh pipeline...'
                          : 'Konten belum tersedia.'}
                      </div>
                    )}
                  </div>
                )}

                {/* Brief tab */}
                {activeTab === 'brief' && (
                  <div className="space-y-3">
                    {brief ? (
                      <>
                        <div>
                          <span className="text-xs font-medium text-gray-600">Thesis Utama</span>
                          <p className="text-xs text-gray-700 mt-1">{brief.mainThesis || '—'}</p>
                        </div>
                        {brief.facts?.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">Fakta ({brief.facts.length})</span>
                            <ul className="mt-1 space-y-1">
                              {brief.facts.slice(0, 8).map((f, i) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                                  <span className="text-blue-400 flex-shrink-0">{i+1}.</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {brief.quotes?.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">Kutipan ({brief.quotes.length})</span>
                            {brief.quotes.slice(0, 3).map((q, i) => (
                              <div key={i} className="mt-1 bg-gray-50 rounded p-2">
                                <p className="text-xs text-gray-700 italic">"{q.text}"</p>
                                <p className="text-xs text-gray-500 mt-0.5">— {q.speaker}{q.affiliation ? ` (${q.affiliation})` : ''}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {brief.statistics?.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">Statistik</span>
                            {brief.statistics.slice(0, 4).map((s, i) => (
                              <div key={i} className="text-xs text-gray-600 mt-1">
                                <span className="font-medium text-blue-600">{s.figure}</span> — {s.context}
                              </div>
                            ))}
                          </div>
                        )}
                        {brief.sources?.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">Sumber ({brief.sources.length})</span>
                            <div className="mt-1 space-y-0.5">
                              {brief.sources.map((s, i) => (
                                <div key={i} className="text-xs text-gray-500">{s.name} (credibility: {s.credibility})</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {brief.credibilityScore != null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Credibility Score</span>
                            <span className="font-medium">{brief.credibilityScore}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-8">
                        Brief riset belum tersedia (pipeline belum mencapai tahap RESEARCH).
                      </div>
                    )}
                  </div>
                )}

                {/* Scores tab */}
                {activeTab === 'scores' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-800">{selected.quality_score ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Quality Score</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-800">{selected.eeat_score ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">E-E-A-T Score</div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-500">Provider</span><span>{selected.provider_used || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Site</span><span>{selected.site_name || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Dibuat</span><span>{new Date(selected.created_at).toLocaleString('id-ID')}</span></div>
                      {selected.published_at && (
                        <div className="flex justify-between"><span className="text-gray-500">Publish</span><span>{new Date(selected.published_at).toLocaleString('id-ID')}</span></div>
                      )}
                      {selected.wordpress_url && (
                        <div className="pt-1">
                          <a href={selected.wordpress_url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                            Lihat di WordPress ↗
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Change log */}
                    {cv?.changeLog?.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <div className="font-medium text-gray-600 mb-1">Editor Changelog</div>
                        <ul className="space-y-0.5">
                          {cv.changeLog.map((c, i) => (
                            <li key={i} className="text-gray-600 flex gap-1.5"><span className="text-green-500">✓</span>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action footer */}
              <div className="p-4 border-t border-gray-100 flex-shrink-0 space-y-2">
                {/* Regenerate from step */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Regenerasi dari step</label>
                  <div className="flex gap-1.5">
                    <select
                      value={regenStep}
                      onChange={e => setRegenStep(e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Pilih step...</option>
                      {PIPELINE_STEPS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      onClick={handleRegen}
                      disabled={!regenStep || regenLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg"
                    >
                      {regenLoading ? '...' : '↺ Run'}
                    </button>
                  </div>
                </div>
                {/* Other actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleForcePublish}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg"
                  >
                    Force Publish
                  </button>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
