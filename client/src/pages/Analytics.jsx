import React, { useEffect, useState } from 'react';
import { analytics, sites as sitesApi } from '../lib/api';

const TABS = ['Produksi','E-E-A-T Mingguan','Provider','Prompt Evolution','Evergreen','Key Usage','Error Rate','System Logs','Smart Timing','Link Network','Evergreen Updates','Persona'];

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
        active
          ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

// Simple bar chart component
function BarChart({ data, valueKey, labelKey, colorFn, height = 120 }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Belum ada data.</p>;
  }
  const max = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const val = parseFloat(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        const color = colorFn ? colorFn(val, d) : 'bg-blue-500';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="text-xs text-gray-500 truncate">{val}</div>
            <div
              className={`w-full rounded-t transition-all ${color}`}
              style={{ height: `${Math.max(pct, 3)}%` }}
              title={`${d[labelKey]}: ${val}`}
            />
            <div className="text-xs text-gray-400 truncate w-full text-center" style={{ maxWidth: 48 }}>
              {String(d[labelKey] || '').slice(-5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('Produksi');
  const [production, setProduction] = useState([]);
  const [prodDays, setProdDays] = useState(14);
  const [prodSiteId, setProdSiteId] = useState('');
  const [sitesList, setSitesList] = useState([]);
  const [providers, setProviders] = useState([]);
  const [eeAtWeekly, setEeAtWeekly] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [evergreen, setEvergreen] = useState([]);
  const [keyUsage, setKeyUsage] = useState([]);
  const [errorRate, setErrorRate] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState({ level: '', search: '', agent: '' });
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // Phase 10
  const [smartTiming, setSmartTiming] = useState([]);
  const [linkNetwork, setLinkNetwork] = useState({ stats: {}, topArticles: [] });
  const [evergreenUpdates, setEvergreenUpdates] = useState([]);
  const [personaSiteId, setPersonaSiteId] = useState('');
  const [personaData, setPersonaData] = useState(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [promptAction, setPromptAction] = useState({ id: null, status: '' });

  const load = async () => {
    setLoading(true);
    const [prod, prov, eeat, pr, ev, ku, er, l, sitesRes, st, ln, eu] = await Promise.all([
      analytics.production({ days: prodDays, ...(prodSiteId ? { site_id: prodSiteId } : {}) }).catch(() => ({ data: [] })),
      analytics.providers().catch(() => ({ data: [] })),
      analytics.eeAtWeekly().catch(() => ({ data: [] })),
      analytics.prompts().catch(() => ({ data: [] })),
      analytics.evergreen().catch(() => ({ data: [] })),
      analytics.keyUsage().catch(() => ({ data: [], history: [] })),
      analytics.errorRate().catch(() => ({ data: [] })),
      analytics.logs({ level: logFilter.level, search: logFilter.search, agent: logFilter.agent, limit: 50, page: logsPage }).catch(() => ({ data: [], pagination: { total: 0 } })),
      sitesApi.list().catch(() => ({ data: [] })),
      // Phase 10
      analytics.smartTiming().catch(() => ({ data: [] })),
      analytics.linkNetwork().catch(() => ({ stats: {}, topArticles: [] })),
      analytics.evergreenUpdates().catch(() => ({ data: [] })),
    ]);
    setProduction(prod.data || []);
    setProviders(prov.data || []);
    setEeAtWeekly(eeat.data || []);
    setPrompts(pr.data || []);
    setEvergreen(ev.data || []);
    setKeyUsage(ku.data || []);
    setErrorRate(er.data || []);
    setLogs(l.data || []);
    setLogsTotal(l.pagination?.total || 0);
    setSitesList(sitesRes.data || []);
    // Phase 10
    setSmartTiming(st.data || []);
    setLinkNetwork({ stats: ln.stats || {}, topArticles: ln.topArticles || [] });
    setEvergreenUpdates(eu.data || []);
    setLoading(false);
  };

  const handlePromptAction = async (id, action) => {
    setPromptAction({ id, status: 'loading' });
    try {
      if (action === 'promote')      await analytics.promotePrompt(id);
      if (action === 'deprecate')    await analytics.deprecatePrompt(id);
      if (action === 'experimental') await analytics.experimentalPrompt(id);
      setPromptAction({ id, status: 'done' });
      await load();
    } catch (e) {
      setPromptAction({ id, status: 'error' });
    }
  };

  useEffect(() => { load(); }, [logsPage, logFilter.level, prodDays, prodSiteId]);

  const maxProd = Math.max(...production.map(p => parseInt(p.count) || 0), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <button onClick={load} className="text-sm text-blue-600 hover:text-blue-800">🔄 Refresh</button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <TabBtn key={t} label={t} active={activeTab === t} onClick={() => setActiveTab(t)} />
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-12">Memuat data analytics...</div>
      ) : (

        <div className="space-y-6">

          {/* ── Tab: Produksi ──────────────────────────────────────────────── */}
          {activeTab === 'Produksi' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-gray-800">Produksi Artikel</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={prodDays}
                    onChange={e => setProdDays(parseInt(e.target.value))}
                    className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[7, 14, 30, 60, 90].map(d => (
                      <option key={d} value={d}>{d} hari terakhir</option>
                    ))}
                  </select>
                  <select
                    value={prodSiteId}
                    onChange={e => setProdSiteId(e.target.value)}
                    className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Semua site</option>
                    {sitesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">
                    Total: {production.reduce((s, d) => s + (parseInt(d.count) || 0), 0)} artikel
                  </span>
                </div>
              </div>
              {production.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Belum ada artikel yang dipublikasikan dalam rentang ini.</p>
              ) : (
                <div className="flex items-end gap-1 h-36 overflow-x-auto">
                  {production.map(d => {
                    const val = parseInt(d.count) || 0;
                    return (
                      <div key={d.date} className="flex-1 min-w-6 flex flex-col items-center gap-1">
                        <div className="text-xs text-gray-500">{val > 0 ? val : ''}</div>
                        <div
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                          style={{ height: `${Math.max((val / maxProd) * 100, val > 0 ? 4 : 1)}%` }}
                          title={`${d.date}: ${val} artikel`}
                        />
                        <div className="text-xs text-gray-400" style={{ writingMode: prodDays > 30 ? 'vertical-rl' : 'horizontal-tb' }}>
                          {d.date?.slice(prodDays > 30 ? 5 : 5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: E-E-A-T Mingguan ────────────────────────────────────── */}
          {activeTab === 'E-E-A-T Mingguan' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Rata-rata Skor E-E-A-T & Quality per Minggu</h3>
              <p className="text-xs text-gray-500 mb-4">Target: E-E-A-T ≥ 80, Quality ≥ 75 (batas hijau)</p>
              {eeAtWeekly.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Belum ada data. Data akan muncul setelah artikel dipublikasikan.</p>
              ) : (
                <>
                  <div className="flex gap-4 mb-4 text-xs">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" /> E-E-A-T Score</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded" /> Quality Score</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Minggu','Artikel','Avg E-E-A-T','Avg Quality','Trend E-E-A-T'].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {eeAtWeekly.map((w, i) => {
                          const prev = eeAtWeekly[i - 1];
                          const trend = prev ? parseFloat(w.avg_eeat) - parseFloat(prev.avg_eeat) : null;
                          return (
                            <tr key={w.week_start} className="hover:bg-gray-50">
                              <td className="px-3 py-3 text-gray-600 text-xs">{w.week_start}</td>
                              <td className="px-3 py-3 text-gray-700">{w.article_count}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-gray-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${parseFloat(w.avg_eeat) >= 80 ? 'bg-emerald-500' : 'bg-yellow-400'}`} style={{ width: `${Math.min(parseFloat(w.avg_eeat) || 0, 100)}%` }} />
                                  </div>
                                  <span className={`font-medium text-xs ${parseFloat(w.avg_eeat) >= 80 ? 'text-emerald-700' : 'text-yellow-700'}`}>{w.avg_eeat || '—'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-gray-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${parseFloat(w.avg_quality) >= 75 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(parseFloat(w.avg_quality) || 0, 100)}%` }} />
                                  </div>
                                  <span className={`font-medium text-xs ${parseFloat(w.avg_quality) >= 75 ? 'text-blue-700' : 'text-orange-700'}`}>{w.avg_quality || '—'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-xs">
                                {trend !== null ? (
                                  <span className={trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-gray-400'}>
                                    {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Provider Performance ─────────────────────────────────── */}
          {activeTab === 'Provider' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Provider Performance</h3>
              {providers.length === 0 ? (
                <p className="text-gray-400 text-sm">Belum ada data provider. Mulai buat artikel dengan API key untuk melihat statistik.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Provider','Artikel','Avg Quality','Avg E-E-A-T','Rating'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {providers.map(p => {
                      const quality = parseFloat(p.avg_quality_score) || 0;
                      const eeat = parseFloat(p.avg_eeat_score) || 0;
                      const rating = quality >= 75 && eeat >= 80 ? '⭐ Excellent' : quality >= 70 ? '✓ Good' : '⚠ Below Target';
                      return (
                        <tr key={p.provider} className="hover:bg-gray-50">
                          <td className="px-3 py-3 font-medium text-gray-800 capitalize">{p.provider}</td>
                          <td className="px-3 py-3 text-gray-600">{p.articles_generated}</td>
                          <td className="px-3 py-3">
                            <span className={`font-medium ${quality >= 75 ? 'text-green-600' : 'text-yellow-600'}`}>{p.avg_quality_score || '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`font-medium ${eeat >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>{p.avg_eeat_score || '—'}</span>
                          </td>
                          <td className="px-3 py-3 text-xs">{p.avg_quality_score ? rating : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Tab: Prompt Evolution ─────────────────────────────────────── */}
          {activeTab === 'Prompt Evolution' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Prompt Evolution & A/B Testing</h3>
              <p className="text-xs text-gray-500 mb-4">Template yang ditandai Champion ★ digunakan Writer Agent. Versi dengan skor lebih tinggi akan otomatis dipromosikan.</p>
              {prompts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Belum ada data prompt. Buat template di halaman Settings → Prompt Templates.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Template','Agent','Format','Status','Sampel','Avg Quality','Avg E-E-A-T'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {prompts.map(p => (
                      <tr key={p.id} className={`hover:bg-gray-50 ${p.is_champion ? 'bg-yellow-50' : ''}`}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {p.is_champion && <span className="text-yellow-500 text-xs">★</span>}
                            <span className="font-medium text-gray-800 text-xs">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{p.agent_type}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{p.format_key || p.category || '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            p.is_champion ? 'bg-yellow-100 text-yellow-700' :
                            p.status === 'experimental' ? 'bg-purple-100 text-purple-700' :
                            p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {p.is_champion ? 'champion' : p.status || 'active'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-xs">{p.real_sample_count || p.sample_count || 0}</td>
                        <td className="px-3 py-3 text-xs">
                          <span className={p.avg_quality >= 75 ? 'text-green-600 font-medium' : p.avg_quality ? 'text-yellow-600' : 'text-gray-400'}>
                            {p.avg_quality || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className={p.avg_eeat >= 80 ? 'text-green-600 font-medium' : p.avg_eeat ? 'text-yellow-600' : 'text-gray-400'}>
                            {p.avg_eeat || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {!p.is_champion && (
                              <button
                                onClick={() => handlePromptAction(p.id, 'promote')}
                                disabled={promptAction.id === p.id && promptAction.status === 'loading'}
                                className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
                                title="Set sebagai Champion"
                              >★ Champion</button>
                            )}
                            {p.status !== 'experimental' && !p.is_champion && (
                              <button
                                onClick={() => handlePromptAction(p.id, 'experimental')}
                                disabled={promptAction.id === p.id && promptAction.status === 'loading'}
                                className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                                title="Set sebagai A/B Experimental"
                              >A/B</button>
                            )}
                            {p.status !== 'deprecated' && !p.is_champion && (
                              <button
                                onClick={() => handlePromptAction(p.id, 'deprecate')}
                                disabled={promptAction.id === p.id && promptAction.status === 'loading'}
                                className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                                title="Deprecate prompt"
                              >Dep.</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {prompts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Evaluasi otomatis setiap Minggu 23:00 WIB. 10% artikel menggunakan prompt <span className="bg-purple-100 text-purple-700 px-1 rounded">A/B Experimental</span></p>
                  <button
                    onClick={async () => { await analytics.runPromptEvolution(); await load(); }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium"
                  >▶ Jalankan Evaluasi Manual</button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Evergreen Candidates ─────────────────────────────────── */}
          {activeTab === 'Evergreen' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Evergreen Update Candidates</h3>
              <p className="text-xs text-gray-500 mb-4">Artikel yang diterbitkan lebih dari 30 hari lalu dengan format evergreen/feature. Kandidat untuk di-update agar tetap relevan.</p>
              {evergreen.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Tidak ada kandidat evergreen saat ini.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Judul','Site','Format','Quality','E-E-A-T','Hari Sejak Publish','Aksi'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {evergreen.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 max-w-xs">
                          <div className="text-gray-800 text-xs font-medium line-clamp-2">{a.title || '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{a.site_name || '—'}</td>
                        <td className="px-3 py-3 text-xs">
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">{a.format?.replace(/_/g,' ') || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-xs font-medium">{a.quality_score || '—'}</td>
                        <td className="px-3 py-3 text-xs font-medium">{a.eeat_score || '—'}</td>
                        <td className="px-3 py-3 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${a.days_since_publish > 90 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {a.days_since_publish} hari
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5">
                            {a.wordpress_url && (
                              <a href={a.wordpress_url} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">Lihat ↗</a>
                            )}
                            <button onClick={async () => {
                              try { await analytics.scheduleEvergreen(a.id); setEvergreen(prev => prev.map(x => x.id === a.id ? {...x, _scheduled: true} : x)); }
                              catch(e){ console.error(e); }
                            }} className="text-xs text-green-600 hover:text-green-800 font-medium">
                              {a._scheduled ? 'Terkirim ✓' : 'Schedule Update'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Tab: Key Usage ────────────────────────────────────────────── */}
          {activeTab === 'Key Usage' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-2">Penggunaan API Key Saat Ini</h3>
                <p className="text-xs text-gray-500 mb-4">Agregasi penggunaan hari ini per provider.</p>
                {keyUsage.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">Belum ada penggunaan API key hari ini.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Provider','Keys','Total Penggunaan Hari Ini','Total Limit Harian','% Terpakai'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {keyUsage.map(k => {
                        const pct = k.total_limit > 0 ? Math.round((k.total_usage / k.total_limit) * 100) : 0;
                        return (
                          <tr key={k.provider} className="hover:bg-gray-50">
                            <td className="px-3 py-3 font-medium text-gray-800 capitalize">{k.provider}</td>
                            <td className="px-3 py-3 text-gray-600 text-xs">{k.key_count}</td>
                            <td className="px-3 py-3 text-gray-700">{(k.total_usage || 0).toLocaleString()}</td>
                            <td className="px-3 py-3 text-gray-500">{(k.total_limit || 0).toLocaleString()}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-100 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${pct >= 80 ? 'text-red-600' : pct >= 60 ? 'text-yellow-600' : 'text-green-600'}`}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Error Rate ────────────────────────────────────────────── */}
          {activeTab === 'Error Rate' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Error Rate per Stage Pipeline (7 Hari Terakhir)</h3>
              <p className="text-xs text-gray-500 mb-4">Persentase job yang gagal per tipe. Error rate tinggi menandakan masalah pada agent atau API key.</p>
              {errorRate.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Belum ada data job dalam 7 hari terakhir.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Stage','Total Job','Sukses','Gagal','Error Rate'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {errorRate.map(e => {
                      const rate = parseFloat(e.error_rate_pct) || 0;
                      return (
                        <tr key={e.job_type} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">{e.job_type}</span>
                          </td>
                          <td className="px-3 py-3 text-gray-600">{e.total_count}</td>
                          <td className="px-3 py-3 text-green-600 font-medium">{e.success_count}</td>
                          <td className="px-3 py-3 text-red-600 font-medium">{e.failed_count}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-100 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${rate >= 30 ? 'bg-red-500' : rate >= 10 ? 'bg-yellow-400' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${rate >= 30 ? 'text-red-600' : rate >= 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {rate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Tab: System Logs ──────────────────────────────────────────── */}
          {activeTab === 'System Logs' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-semibold text-gray-800">System Logs ({logsTotal})</h3>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={logFilter.level}
                    onChange={e => { setLogFilter(f => ({ ...f, level: e.target.value })); setLogsPage(1); }}
                    className="border rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="">Semua Level</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                    <option value="critical">Critical</option>
                  </select>
                  <input
                    value={logFilter.agent}
                    onChange={e => setLogFilter(f => ({ ...f, agent: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && load()}
                    placeholder="Filter agent..."
                    className="border rounded px-2 py-1 text-xs focus:outline-none w-28"
                  />
                  <input
                    value={logFilter.search}
                    onChange={e => setLogFilter(f => ({ ...f, search: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && load()}
                    placeholder="Cari pesan..."
                    className="border rounded px-2 py-1 text-xs focus:outline-none w-36"
                  />
                  <button onClick={load} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-200">Cari</button>
                </div>
              </div>
              {logs.length === 0 ? (
                <p className="text-gray-400 text-sm">Tidak ada log ditemukan.</p>
              ) : (
                <>
                  <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                    {logs.map(l => (
                      <div key={l.id} className={`flex items-start gap-2 p-1.5 rounded ${l.level === 'error' || l.level === 'critical' ? 'bg-red-50' : l.level === 'warn' ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${l.level === 'error' || l.level === 'critical' ? 'bg-red-200 text-red-800' : l.level === 'warn' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-700'}`}>
                          {l.level}
                        </span>
                        <span className="flex-shrink-0 text-gray-400">[{l.agent}]</span>
                        <span className="text-gray-700 flex-1 break-all">{l.message}</span>
                        <span className="flex-shrink-0 text-gray-400 whitespace-nowrap">{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    ))}
                  </div>
                  {logsTotal > 50 && (
                    <div className="flex justify-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">‹ Prev</button>
                      <span className="px-3 py-1 text-xs text-gray-500">{logsPage} / {Math.ceil(logsTotal / 50)}</span>
                      <button disabled={logsPage >= Math.ceil(logsTotal / 50)} onClick={() => setLogsPage(p => p + 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">Next ›</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Phase 10 Tab: Smart Timing ─────────────────────────────── */}
          {activeTab === 'Smart Timing' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">Smart Timing Learner</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Jam posting optimal per kategori per site, dipelajari otomatis dari data performa. Diperbarui setiap Sabtu 22:00 WIB.</p>
                  </div>
                  <button
                    onClick={async () => { await analytics.runSmartTiming(); await load(); }}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium"
                  >▶ Analisis Sekarang</button>
                </div>
                {smartTiming.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Belum ada data smart timing. Butuh minimal 10 artikel published per kategori untuk analisis.</p>
                ) : (
                  <div className="space-y-4 mt-4">
                    {smartTiming.map(site => (
                      <div key={site.siteId} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-800 text-sm">{site.siteName}</h4>
                          {site.lastUpdated && (
                            <span className="text-xs text-gray-400">
                              Update: {new Date(site.lastUpdated).toLocaleDateString('id-ID')}
                            </span>
                          )}
                        </div>
                        {site.categories.length === 0 ? (
                          <p className="text-xs text-gray-400">Belum cukup data untuk site ini.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {site.categories.map(cat => (
                              <div key={cat.category} className={`rounded-lg p-3 border ${cat.confidence >= 0.8 ? 'bg-green-50 border-green-200' : cat.confidence >= 0.6 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-medium text-gray-700 capitalize">{cat.category}</div>
                                <div className="text-xl font-bold text-gray-900 mt-1">{String(cat.best_hour).padStart(2,'0')}:00</div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-gray-500">{cat.samples} sampel</span>
                                  <span className={`text-xs font-medium ${cat.confidence >= 0.8 ? 'text-green-600' : 'text-blue-600'}`}>
                                    {Math.round(cat.confidence * 100)}% conf.
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Phase 10 Tab: Link Network ──────────────────────────────── */}
          {activeTab === 'Link Network' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-1">Link Intelligence Network</h3>
                <p className="text-xs text-gray-500 mb-4">Statistik jaringan link lintas-site yang dibuat oleh SEO Agent. Termasuk cross-site linking untuk otoritas topik.</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Total Link (30 hari)', val: linkNetwork.stats.total_links || 0, color: 'text-gray-800' },
                    { label: 'Cross-Site', val: linkNetwork.stats.cross_site_links || 0, color: 'text-blue-600' },
                    { label: 'Same-Site', val: linkNetwork.stats.same_site_links || 0, color: 'text-green-600' },
                    { label: 'Artikel Sumber', val: linkNetwork.stats.source_articles || 0, color: 'text-purple-600' },
                    { label: 'Artikel Target', val: linkNetwork.stats.target_articles || 0, color: 'text-orange-600' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className={`text-2xl font-bold ${item.color}`}>{item.val}</div>
                      <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
                <h4 className="font-medium text-gray-700 text-sm mb-3">Artikel Paling Banyak Menerima Link (Authority Pages)</h4>
                {linkNetwork.topArticles.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">Belum ada data link network. Data akan muncul setelah artikel dipublish dengan SEO Agent aktif.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Artikel','Site','Incoming Links','Avg E-E-A-T'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {linkNetwork.topArticles.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 max-w-xs">
                            <div className="text-gray-800 text-xs font-medium line-clamp-2">{a.title}</div>
                            {a.wordpress_url && (
                              <a href={a.wordpress_url} target="_blank" rel="noopener" className="text-xs text-blue-500 hover:underline">Lihat ↗</a>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{a.site_name}</td>
                          <td className="px-3 py-3">
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{a.incoming_links}</span>
                          </td>
                          <td className="px-3 py-3 text-xs font-medium">{a.avg_eeat || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Phase 10 Tab: Evergreen Updates ────────────────────────── */}
          {activeTab === 'Evergreen Updates' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Riwayat Evergreen Updates</h3>
              <p className="text-xs text-gray-500 mb-4">Artikel yang sudah diperbarui otomatis oleh Evergreen Engine. Cron berjalan setiap malam 02:00 WIB.</p>
              {evergreenUpdates.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">🌱</div>
                  <p className="text-gray-500 text-sm font-medium">Belum ada evergreen update</p>
                  <p className="text-gray-400 text-xs mt-1">Evergreen Engine akan berjalan otomatis setiap malam 02:00 WIB pada artikel yang &gt;30 hari.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Judul','Site','Format','Diperbarui','Ringkasan Update','Aksi'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {evergreenUpdates.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 max-w-xs">
                          <div className="text-gray-800 text-xs font-medium line-clamp-2">{a.title}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{a.site_name}</td>
                        <td className="px-3 py-3">
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">{a.format?.replace(/_/g,' ') || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {a.last_updated_at ? new Date(a.last_updated_at).toLocaleDateString('id-ID') : '—'}
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-xs max-w-xs">
                          <span className="line-clamp-2">{a.update_info?.summary || '—'}</span>
                        </td>
                        <td className="px-3 py-3">
                          {a.wordpress_url ? (
                            <a href={a.wordpress_url} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">Lihat ↗</a>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Phase 10 Tab: Persona ───────────────────────────────────── */}
          {activeTab === 'Persona' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Persona Memory Builder</h3>
              <p className="text-xs text-gray-500 mb-4">
                Profil gaya penulisan setiap site, dibangun otomatis dari artikel yang dipublish. 
                Writer Agent menggunakan persona ini agar setiap artikel konsisten dengan identitas editorial site.
              </p>
              <div className="flex gap-3 mb-5">
                <select
                  value={personaSiteId}
                  onChange={e => { setPersonaSiteId(e.target.value); setPersonaData(null); }}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                >
                  <option value="">— Pilih site —</option>
                  {sitesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  onClick={async () => {
                    if (!personaSiteId) return;
                    setPersonaLoading(true);
                    try {
                      const res = await analytics.persona(personaSiteId);
                      setPersonaData(res.data);
                    } catch (e) {}
                    setPersonaLoading(false);
                  }}
                  disabled={!personaSiteId || personaLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {personaLoading ? 'Memuat...' : 'Lihat Persona'}
                </button>
              </div>
              {personaData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-800">{personaData.name}</h4>
                    <span className="text-xs text-gray-400">
                      Update: {personaData.updated_at ? new Date(personaData.updated_at).toLocaleDateString('id-ID') : '—'}
                    </span>
                  </div>
                  {personaData.persona_memory ? (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-blue-600 text-lg">🧠</span>
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Persona Memory (dibangun dari artikel)</span>
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-[inherit]">
                        {personaData.persona_memory}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-gray-500 text-sm">Persona Memory belum dibangun untuk site ini.</p>
                      <p className="text-gray-400 text-xs mt-1">Akan diperbarui otomatis setelah artikel pertama dipublish ke WordPress.</p>
                    </div>
                  )}
                  {personaData.persona_description && (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Deskripsi Manual (dari pengaturan site)</div>
                      <p className="text-sm text-gray-700">{personaData.persona_description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-3">🧠</div>
                  <p className="text-sm">Pilih site untuk melihat persona memorynya.</p>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
