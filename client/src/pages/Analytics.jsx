import React, { useEffect, useState } from 'react';
import { analytics } from '../lib/api';

const TABS = ['Produksi','E-E-A-T Mingguan','Provider','Prompt Evolution','Evergreen','Key Usage','Error Rate','System Logs'];

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

  const load = async () => {
    setLoading(true);
    const [prod, prov, eeat, pr, ev, ku, er, l] = await Promise.all([
      analytics.production({ days: 14 }).catch(() => ({ data: [] })),
      analytics.providers().catch(() => ({ data: [] })),
      analytics.eeAtWeekly().catch(() => ({ data: [] })),
      analytics.prompts().catch(() => ({ data: [] })),
      analytics.evergreen().catch(() => ({ data: [] })),
      analytics.keyUsage().catch(() => ({ data: [], history: [] })),
      analytics.errorRate().catch(() => ({ data: [] })),
      analytics.logs({ level: logFilter.level, search: logFilter.search, agent: logFilter.agent, limit: 50, page: logsPage }).catch(() => ({ data: [], pagination: { total: 0 } })),
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
    setLoading(false);
  };

  useEffect(() => { load(); }, [logsPage, logFilter.level]);

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
              <h3 className="font-semibold text-gray-800 mb-4">Produksi Artikel (14 Hari Terakhir)</h3>
              {production.length === 0 ? (
                <p className="text-gray-400 text-sm">Belum ada artikel yang dipublikasikan.</p>
              ) : (
                <div className="flex items-end gap-1 h-36">
                  {production.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-gray-500">{parseInt(d.count)}</div>
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height: `${Math.max((parseInt(d.count) / maxProd) * 100, 4)}%` }}
                        title={`${d.date}: ${d.count} artikel`}
                      />
                      <div className="text-xs text-gray-400">{d.date?.slice(5)}</div>
                    </div>
                  ))}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
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

        </div>
      )}
    </div>
  );
}
