import React, { useEffect, useState } from 'react';
import { analytics, sites as sitesApi, alerts as alertsApi } from '../lib/api';

function StatCard({ label, value, color = 'blue', icon }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red:    'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-3xl font-bold">{value ?? '—'}</div>
      <div className="text-sm mt-1 opacity-75">{label}</div>
    </div>
  );
}

const SEVERITY_STYLE = {
  critical: { bar: 'bg-red-100 border-red-200', badge: 'bg-red-100 text-red-700', dot: '🔴' },
  warning:  { bar: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: '🟡' },
};

export default function Overview({ navigate }) {
  const [stats, setStats]           = useState(null);
  const [pipeline, setPipeline]     = useState({});
  const [activity, setActivity]     = useState([]);
  const [alertList, setAlertList]   = useState([]);
  const [siteList, setSiteList]     = useState([]);
  const [production, setProduction] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [resolving, setResolving]   = useState({});

  const load = async () => {
    try {
      const [s, p, act, al, sl, prod] = await Promise.all([
        analytics.overview(),
        analytics.pipeline(),
        analytics.activity(),
        alertsApi.list({ include_resolved: 'false', limit: 20 }),
        sitesApi.list(),
        analytics.production({ days: 7 }),
      ]);
      setStats(s.data);
      setPipeline(p.data || {});
      setActivity(act.data || []);
      setAlertList(al.data || []);
      setSiteList(sl.data || []);
      setProduction(prod.data || []);
    } catch (err) {
      console.error('Overview load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const handleResolve = async (alertId) => {
    setResolving(r => ({ ...r, [alertId]: true }));
    try {
      await alertsApi.resolve(alertId);
      setAlertList(list => list.filter(a => a.id !== alertId));
      setStats(s => s ? { ...s, activeAlerts: Math.max(0, (s.activeAlerts || 1) - 1) } : s);
    } catch (err) {
      console.error('Resolve alert error:', err);
    }
    setResolving(r => ({ ...r, [alertId]: false }));
  };

  const handleResolveAll = async () => {
    try {
      await alertsApi.resolveAll();
      setAlertList([]);
      setStats(s => s ? { ...s, activeAlerts: 0 } : s);
    } catch (err) {
      console.error('Resolve all error:', err);
    }
  };

  const STAGES = ['researching','writing','editing','qc','imaging','seo','scheduled','published'];
  const STAGE_LABELS = {
    researching: 'Riset',
    writing:     'Tulis',
    editing:     'Edit',
    qc:          'QC',
    imaging:     'Gambar',
    seo:         'SEO',
    scheduled:   'Terjadwal',
    published:   'Publish',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Overview</h2>
        <button onClick={load} className="text-sm text-blue-600 hover:text-blue-800">🔄 Refresh</button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Memuat data...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="📰" label="Artikel hari ini"  value={stats?.articlesPublishedToday} color="green" />
            <StatCard icon="⚙️" label="Job dalam queue"   value={stats?.jobsInQueue}            color="blue" />
            <StatCard icon="🔑" label="API key aktif"     value={stats?.activeApiKeys}          color="yellow" />
            <StatCard icon="🚨" label="Alert aktif"       value={alertList.length}              color={alertList.length > 0 ? 'red' : 'green'} />
          </div>

          {/* Alert Panel */}
          {alertList.length > 0 && (
            <div className="mb-6 rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-200">
                <h3 className="font-semibold text-red-800 text-sm">
                  🚨 Alert Aktif ({alertList.length})
                </h3>
                <button
                  onClick={handleResolveAll}
                  className="text-xs text-red-600 hover:text-red-800 border border-red-300 rounded px-2 py-1 hover:bg-red-100"
                >
                  ✓ Resolve Semua
                </button>
              </div>
              <div className="divide-y divide-red-100 max-h-64 overflow-y-auto">
                {alertList.map(a => {
                  const sty = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.warning;
                  return (
                    <div key={a.id} className={`flex items-start gap-3 px-4 py-3 ${sty.bar}`}>
                      <span className="flex-shrink-0 text-sm mt-0.5">{sty.dot}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${sty.badge}`}>
                            {a.type?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate">{a.title}</span>
                        </div>
                        {a.message && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{a.message}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(a.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleResolve(a.id)}
                        disabled={resolving[a.id]}
                        className="flex-shrink-0 text-xs text-gray-500 hover:text-green-700 border border-gray-300 hover:border-green-400 rounded px-2 py-1 disabled:opacity-50 transition-colors"
                      >
                        {resolving[a.id] ? '...' : '✓'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Production chart — 7 hari */}
          {production.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Produksi Artikel (7 Hari Terakhir)</h3>
                <span className="text-xs text-gray-400">
                  {production.reduce((s, d) => s + (parseInt(d.count) || 0), 0)} total
                </span>
              </div>
              <div className="flex items-end gap-1.5 h-20">
                {production.map((d) => {
                  const val = parseInt(d.count) || 0;
                  const maxVal = Math.max(...production.map(x => parseInt(x.count) || 0), 1);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-gray-400">{val > 0 ? val : ''}</div>
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height: `${Math.max((val / maxVal) * 100, val > 0 ? 8 : 2)}%` }}
                        title={`${d.date}: ${val} artikel`}
                      />
                      <div className="text-xs text-gray-400 truncate w-full text-center">
                        {String(d.date || '').slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pipeline funnel */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Pipeline Artikel</h3>
            <div className="flex gap-2 flex-wrap">
              {STAGES.map(s => (
                <div key={s} className="flex-1 min-w-16 text-center bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-800">{pipeline[s] || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">{STAGE_LABELS[s]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sites grid */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Sites ({siteList.length})</h3>
              <button onClick={() => navigate('sites')} className="text-sm text-blue-600 hover:text-blue-800">
                Kelola →
              </button>
            </div>
            {siteList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">🌐</div>
                <p className="text-sm">
                  Belum ada site.{' '}
                  <button onClick={() => navigate('sites')} className="text-blue-600 hover:underline">
                    Tambah site pertama
                  </button>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {siteList.map(site => (
                  <div key={site.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800 text-sm truncate">{site.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {site.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{site.niche || 'Umum'}</div>
                    <div className="text-xs text-gray-400 truncate mt-1">{site.url}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Activity Log Terbaru</h3>
            {activity.length === 0 ? (
              <p className="text-gray-400 text-sm">Belum ada aktivitas.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity.map(a => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      a.level === 'error' || a.level === 'critical' ? 'bg-red-100 text-red-700'  :
                      a.level === 'warn'                            ? 'bg-yellow-100 text-yellow-700' :
                                                                      'bg-gray-100 text-gray-600'
                    }`}>
                      {a.level}
                    </span>
                    <span className="text-gray-500 flex-shrink-0 text-xs">[{a.agent}]</span>
                    <span className="text-gray-700 flex-1 truncate">{a.message}</span>
                    <span className="text-gray-400 text-xs flex-shrink-0">
                      {new Date(a.created_at).toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
