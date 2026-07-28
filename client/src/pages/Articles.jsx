import React, { useEffect, useState } from 'react';
import { articles as articlesApi, sites as sitesApi, queue as queueApi } from '../lib/api';

const STATUS_COLORS = { researching:'bg-blue-100 text-blue-800', writing:'bg-indigo-100 text-indigo-800', editing:'bg-purple-100 text-purple-800', qc:'bg-yellow-100 text-yellow-800', imaging:'bg-orange-100 text-orange-800', seo:'bg-cyan-100 text-cyan-800', scheduled:'bg-teal-100 text-teal-800', published:'bg-green-100 text-green-800', failed:'bg-red-100 text-red-800', draft:'bg-gray-100 text-gray-600' };

export default function Articles({ navigate }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({ site_id:'', status:'', page:1 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runForm, setRunForm] = useState(false);
  const [runData, setRunData] = useState({ topic:'', site_id:'', category:'umum', format:'berita_singkat' });

  const load = async () => {
    setLoading(true);
    const [ar, sl] = await Promise.all([
      articlesApi.list({ ...filters, limit:20 }).catch(()=>({data:[], pagination:{total:0}})),
      sitesApi.list().catch(()=>({data:[]})),
    ]);
    setList(ar.data || []);
    setTotal(ar.pagination?.total || 0);
    setSites(sl.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters.site_id, filters.status, filters.page]);

  const handleDelete = async (id) => {
    if (!confirm('Hapus artikel ini?')) return;
    await articlesApi.delete(id);
    setSelected(null); load();
  };

  const handleRun = async (e) => {
    e.preventDefault();
    const res = await queueApi.run(runData);
    setRunForm(false);
    if (res.data?.articleId) setFilters(f=>({...f}));
    load();
  };

  const FORMATS = ['berita_singkat','berita_panjang','jurnal_review','feature_opini','listicle','faq_article','evergreen'];

  return (
    <div className="flex gap-4 h-full">
      {/* List panel */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Articles ({total})</h2>
          <button onClick={() => setRunForm(s=>!s)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">▶ Jalankan Pipeline</button>
        </div>

        {runForm && (
          <form onSubmit={handleRun} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-blue-800 mb-3">Jalankan Pipeline Baru</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs font-medium text-gray-600 block mb-1">Topik *</label><input value={runData.topic} onChange={e=>setRunData(f=>({...f,topic:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="AI dalam pendidikan Indonesia" /></div>
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Site *</label>
                <select value={runData.site_id} onChange={e=>setRunData(f=>({...f,site_id:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih site</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 block mb-1">Format</label>
                <select value={runData.format} onChange={e=>setRunData(f=>({...f,format:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FORMATS.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">▶ Mulai</button>
              <button type="button" onClick={() => setRunForm(false)} className="bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg">Batal</button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <select value={filters.site_id} onChange={e=>setFilters(f=>({...f,site_id:e.target.value,page:1}))} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Site</option>
            {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value,page:1}))} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Status</option>
            {Object.keys(STATUS_COLORS).map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div> :
           list.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p className="text-sm">Belum ada artikel. Klik "Jalankan Pipeline" untuk membuat artikel pertama.</p>
            </div>
           ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {['Judul','Site','Format','Status','Score QE','Score EEAT','Created','Aksi'].map(h=><th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {list.map(a => (
                  <tr key={a.id} className={`hover:bg-gray-50 cursor-pointer ${selected?.id===a.id?'bg-blue-50':''}`} onClick={()=>setSelected(a)}>
                    <td className="px-3 py-3 font-medium text-gray-800 max-w-xs truncate">{a.title || '(tanpa judul)'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{a.site_name||'—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{a.format||'—'}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[a.status]||'bg-gray-100 text-gray-600'}`}>{a.status}</span></td>
                    <td className="px-3 py-3 text-gray-700">{a.quality_score?.toFixed(0)||'—'}</td>
                    <td className="px-3 py-3 text-gray-700">{a.eeat_score?.toFixed(0)||'—'}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-3 py-3">
                      {a.wordpress_url && <a href={a.wordpress_url} target="_blank" rel="noopener" className="text-blue-600 hover:text-blue-800 text-xs mr-2">WP ↗</a>}
                      <button onClick={e=>{e.stopPropagation();handleDelete(a.id)}} className="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           )
          }
          {/* Pagination */}
          {total > 20 && (
            <div className="flex justify-center gap-2 p-3 border-t border-gray-100">
              <button disabled={filters.page<=1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))} className="px-3 py-1 text-sm border rounded disabled:opacity-40">‹ Prev</button>
              <span className="px-3 py-1 text-sm text-gray-500">{filters.page} / {Math.ceil(total/20)}</span>
              <button disabled={filters.page>=Math.ceil(total/20)} onClick={()=>setFilters(f=>({...f,page:f.page+1}))} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next ›</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Detail Artikel</h3>
            <button onClick={()=>setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <h4 className="font-medium text-gray-800 mb-2 text-sm">{selected.title || '(tanpa judul)'}</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-1.5 py-0.5 rounded-full ${STATUS_COLORS[selected.status]||'bg-gray-100'}`}>{selected.status}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Format</span><span>{selected.format||'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Kategori</span><span>{selected.category||'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Quality Score</span><span className="font-medium">{selected.quality_score||'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">E-E-A-T Score</span><span className="font-medium">{selected.eeat_score||'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Provider</span><span>{selected.provider_used||'—'}</span></div>
            {selected.wordpress_url && <div><a href={selected.wordpress_url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">Lihat di WordPress ↗</a></div>}
          </div>
          {selected.content && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-600 mb-1">Konten (preview)</div>
              <div className="text-xs text-gray-500 line-clamp-6">{selected.content.slice(0,300)}...</div>
            </div>
          )}
          <div className="flex gap-2 mt-4 flex-wrap">
            <button onClick={()=>articlesApi.forcePublish(selected.id).then(()=>load())} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg">Force Publish</button>
            <button onClick={()=>handleDelete(selected.id)} className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg">Hapus</button>
          </div>
        </div>
      )}
    </div>
  );
}
