import React, { useEffect, useState } from 'react';
import { analytics } from '../lib/api';

export default function Analytics() {
  const [production, setProduction] = useState([]);
  const [providers, setProviders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState({ level:'', search:'' });
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [prod, prov, l] = await Promise.all([
      analytics.production({ days: 14 }).catch(()=>({data:[]})),
      analytics.providers().catch(()=>({data:[]})),
      analytics.logs({ level: logFilter.level, search: logFilter.search, limit: 50 }).catch(()=>({data:[], pagination:{total:0}})),
    ]);
    setProduction(prod.data || []);
    setProviders(prov.data || []);
    setLogs(l.data || []);
    setLogsTotal(l.pagination?.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [logFilter.level]);

  const maxProd = Math.max(...production.map(p=>parseInt(p.count)||0), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <button onClick={load} className="text-sm text-blue-600 hover:text-blue-800">🔄 Refresh</button>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Memuat...</div> : (
        <div className="space-y-6">
          {/* Production chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Produksi Artikel (14 Hari Terakhir)</h3>
            {production.length === 0 ? (
              <p className="text-gray-400 text-sm">Belum ada artikel yang dipublikasikan.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {production.map(d=>(
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-gray-500">{parseInt(d.count)}</div>
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${Math.max((parseInt(d.count)/maxProd)*100,4)}%` }}
                      title={`${d.date}: ${d.count} artikel`}
                    />
                    <div className="text-xs text-gray-400 rotate-45 origin-left">{d.date?.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provider performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Provider Performance</h3>
            {providers.length === 0 ? (
              <p className="text-gray-400 text-sm">Belum ada data provider. Mulai buat artikel dengan API key untuk melihat statistik.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  {['Provider','Artikel Generated','Avg Quality Score','Avg E-E-A-T'].map(h=><th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {providers.map(p=>(
                    <tr key={p.provider} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-800 capitalize">{p.provider}</td>
                      <td className="px-3 py-3 text-gray-600">{p.articles_generated}</td>
                      <td className="px-3 py-3"><span className={`font-medium ${parseFloat(p.avg_quality_score||0)>=75?'text-green-600':'text-yellow-600'}`}>{p.avg_quality_score||'—'}</span></td>
                      <td className="px-3 py-3"><span className={`font-medium ${parseFloat(p.avg_eeat_score||0)>=80?'text-green-600':'text-yellow-600'}`}>{p.avg_eeat_score||'—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* System logs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">System Logs ({logsTotal})</h3>
              <div className="flex gap-2">
                <select value={logFilter.level} onChange={e=>setLogFilter(f=>({...f,level:e.target.value}))} className="border rounded px-2 py-1 text-xs focus:outline-none">
                  <option value="">Semua Level</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
                <input value={logFilter.search} onChange={e=>setLogFilter(f=>({...f,search:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Cari..." className="border rounded px-2 py-1 text-xs focus:outline-none" />
                <button onClick={load} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-200">Cari</button>
              </div>
            </div>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm">Tidak ada log ditemukan.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                {logs.map(l=>(
                  <div key={l.id} className={`flex items-start gap-2 p-1.5 rounded ${l.level==='error'||l.level==='critical'?'bg-red-50':l.level==='warn'?'bg-yellow-50':'hover:bg-gray-50'}`}>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${l.level==='error'||l.level==='critical'?'bg-red-200 text-red-800':l.level==='warn'?'bg-yellow-200 text-yellow-800':'bg-gray-200 text-gray-700'}`}>{l.level}</span>
                    <span className="flex-shrink-0 text-gray-400">[{l.agent}]</span>
                    <span className="text-gray-700 flex-1">{l.message}</span>
                    <span className="flex-shrink-0 text-gray-400">{new Date(l.created_at).toLocaleTimeString('id-ID')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
