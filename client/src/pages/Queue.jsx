import React, { useEffect, useState } from 'react';
import { queue as queueApi, sites as sitesApi } from '../lib/api';

const STATUS_COLORS = { pending:'bg-yellow-100 text-yellow-700', processing:'bg-blue-100 text-blue-700', done:'bg-green-100 text-green-700', failed:'bg-red-100 text-red-700', dead:'bg-gray-100 text-gray-600', retry:'bg-orange-100 text-orange-700' };

export default function Queue({ navigate }) {
  const [jobs, setJobs] = useState([]);
  const [stages, setStages] = useState({});
  const [dead, setDead] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [q, d, s] = await Promise.all([
      queueApi.list().catch(()=>({data:[], stages:{}})),
      queueApi.dead().catch(()=>({data:[]})),
      sitesApi.list().catch(()=>({data:[]})),
    ]);
    setJobs(q.data || []);
    setStages(q.stages || {});
    setDead(d.data || []);
    setSites(s.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const retryDead = async (id) => {
    await queueApi.retryDead(id);
    load();
  };

  const deleteJob = async (id) => {
    if (!confirm('Hapus job ini?')) return;
    await queueApi.deleteJob(id);
    load();
  };

  const STAGES_ORDER = ['researching','writing','editing','qc','imaging','seo','scheduled'];
  const STAGE_LABELS = { researching:'Riset', writing:'Tulis', editing:'Edit', qc:'QC', imaging:'Gambar', seo:'SEO', scheduled:'Terjadwal' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Job Queue</h2>
        <button onClick={load} className="text-sm text-blue-600 hover:text-blue-800">🔄 Refresh</button>
      </div>

      {/* Pipeline Kanban */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Pipeline Status</h3>
        <div className="flex gap-2">
          {STAGES_ORDER.map(s => (
            <div key={s} className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{stages[s] || 0}</div>
              <div className="text-xs text-gray-500 mt-1">{STAGE_LABELS[s]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={()=>setActiveTab('live')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab==='live'?'bg-blue-600 text-white':'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          Live Jobs ({jobs.length})
        </button>
        <button onClick={()=>setActiveTab('dead')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab==='dead'?'bg-red-600 text-white':'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          Dead Queue ({dead.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Memuat...</div>
      ) : activeTab === 'live' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">⚙️</div>
              <p className="text-sm">Tidak ada job aktif saat ini.</p>
              <p className="text-xs mt-1">Buat artikel baru di halaman Articles untuk memulai pipeline.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {['Type','Artikel','Site','Status','Attempt','Started','Aksi'].map(h=><th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map(j=>(
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3"><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">{j.job_type}</span></td>
                    <td className="px-3 py-3 text-gray-700 max-w-xs truncate text-xs">{j.article_title||j.article_id?.slice(0,8)+'...'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.site_name||'—'}</td>
                    <td className="px-3 py-3"><span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_COLORS[j.status]||'bg-gray-100'}`}>{j.status}</span></td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.attempts}/{j.max_attempts}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{j.started_at ? new Date(j.started_at).toLocaleTimeString('id-ID') : '—'}</td>
                    <td className="px-3 py-3"><button onClick={()=>deleteJob(j.id)} className="text-red-500 hover:text-red-700 text-xs">Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dead.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm">Dead queue kosong. Tidak ada job yang gagal total.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {['Type','Artikel','Error','Attempts','Created','Aksi'].map(h=><th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {dead.map(j=>(
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">{j.job_type}</span></td>
                    <td className="px-3 py-3 text-gray-700 text-xs max-w-xs truncate">{j.article_title||j.article_id?.slice(0,8)+'...'}</td>
                    <td className="px-3 py-3 text-red-600 text-xs max-w-xs truncate">{j.error_message||'—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.attempts}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-3 flex gap-2">
                      <button onClick={()=>retryDead(j.id)} className="text-blue-600 hover:text-blue-800 text-xs">Retry</button>
                      <button onClick={()=>deleteJob(j.id)} className="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
