import React, { useEffect, useState } from 'react';
import { sources as sourcesApi } from '../lib/api';

const CATEGORIES = ['politik','bisnis','teknologi','kesehatan','akademik','sains','olahraga','hukum','internasional','lifestyle'];
const TYPES = ['rss','api','scrape'];
const EMPTY_FORM = { name:'', url:'', rss_url:'', type:'rss', categories:[], credibility_score:8.0, fetch_interval_minutes:30 };

export default function Sources() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});

  const load = async () => {
    const res = await sourcesApi.list(filter ? { category: filter } : {}).catch(()=>({data:[]}));
    setList(res.data || []);
  };

  useEffect(() => { load(); }, [filter]);

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name || '',
      url: s.url || '',
      rss_url: s.rss_url || '',
      type: s.type || 'rss',
      categories: s.categories || [],
      credibility_score: s.credibility_score ?? 8.0,
      fetch_interval_minutes: s.fetch_interval_minutes ?? 30,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await sourcesApi.update(editingId, form);
    } else {
      await sourcesApi.create(form);
    }
    closeForm();
    load();
  };

  const handleToggle = async (id) => {
    await sourcesApi.toggle(id);
    load();
  };

  const handleTest = async (id) => {
    setTesting(id);
    const res = await sourcesApi.test(id).catch(e=>({data:{error:e?.message||'Error'}}));
    setTestResult(t=>({...t,[id]:res.data}));
    setTesting(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus sumber ini?')) return;
    await sourcesApi.delete(id);
    load();
  };

  const toggleCat = (cat) => {
    setForm(f => ({...f, categories: f.categories.includes(cat) ? f.categories.filter(c=>c!==cat) : [...f.categories, cat]}));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Sources ({list.length})</h2>
        <div className="flex gap-3">
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Kategori</option>
            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={openAddForm} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Tambah</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">{editingId ? 'Edit Sumber' : 'Tambah Sumber Baru'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Nama *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">URL *</label><input value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">RSS URL</label><input value={form.rss_url} onChange={e=>setForm(f=>({...f,rss_url:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Credibility Score (1-10)</label><input type="number" min="1" max="10" step="0.1" value={form.credibility_score} onChange={e=>setForm(f=>({...f,credibility_score:parseFloat(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Fetch Interval (menit)</label><input type="number" value={form.fetch_interval_minutes} onChange={e=>setForm(f=>({...f,fetch_interval_minutes:parseInt(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-2">Kategori</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat=>(
                  <button type="button" key={cat} onClick={()=>toggleCat(cat)} className={`px-2 py-1 rounded text-xs border ${form.categories.includes(cat)?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>{cat}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">{editingId ? 'Update' : 'Simpan'}</button>
            <button type="button" onClick={closeForm} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-2">📰</div>
            <p className="text-sm">Tidak ada sumber ditemukan.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Nama','URL','Type','Kategori','Credibility','Status','Last Fetched','Aksi'].map(h=><th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(s => (
                <React.Fragment key={s.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-3 py-3 text-gray-500 max-w-32 truncate text-xs"><a href={s.url} target="_blank" rel="noopener" className="hover:text-blue-600">{s.url}</a></td>
                    <td className="px-3 py-3"><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{s.type}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{(s.categories||[]).slice(0,3).map(c=><span key={c} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-xs">{c}</span>)}</div></td>
                    <td className="px-3 py-3 font-medium text-gray-700">{s.credibility_score?.toFixed(1)}</td>
                    <td className="px-3 py-3"><span className={`px-1.5 py-0.5 rounded-full text-xs ${s.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{s.is_active?'Aktif':'Nonaktif'}</span></td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString('id-ID') : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button onClick={()=>handleTest(s.id)} disabled={testing===s.id} className="text-blue-600 hover:text-blue-800 text-xs">{testing===s.id?'...':'Test'}</button>
                        <button onClick={()=>openEditForm(s)} className="text-indigo-600 hover:text-indigo-800 text-xs">Edit</button>
                        <button onClick={()=>handleToggle(s.id)} className="text-yellow-600 hover:text-yellow-800 text-xs">{s.is_active?'Pause':'Aktif'}</button>
                        <button onClick={()=>handleDelete(s.id)} className="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                      </div>
                    </td>
                  </tr>
                  {testResult[s.id] && (
                    <tr><td colSpan={8} className="px-3 pb-2">
                      <div className={`text-xs rounded p-2 ${testResult[s.id].error?'bg-red-50 text-red-700':'bg-green-50 text-green-700'}`}>
                        {testResult[s.id].error ? `✗ ${testResult[s.id].error}` : `✓ ${testResult[s.id].itemCount} artikel ditemukan (${testResult[s.id].latencyMs}ms)`}
                        {testResult[s.id].items?.slice(0,3).map((item,i)=>(
                          <div key={i} className="mt-1 text-xs opacity-80">• {item.title?.slice(0,80)}</div>
                        ))}
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
