import React, { useEffect, useState } from 'react';
import { sites as sitesApi } from '../lib/api';

const NICHES = ['politik','bisnis','teknologi','kesehatan','akademik','lifestyle','olahraga','hukum','umum'];

function SiteForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name:'', url:'', wordpress_api_url:'', wordpress_username:'', niche:'teknologi', persona_description:'' });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async (e) => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="font-semibold text-gray-800 mb-4">{initial ? 'Edit Site' : 'Tambah Site Baru'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Nama Site *</label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Berita Teknologi Indonesia" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">URL Site *</label>
          <input value={form.url} onChange={e=>set('url',e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://teknologiindo.com" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">WordPress API URL</label>
          <input value={form.wordpress_api_url||''} onChange={e=>set('wordpress_api_url',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://teknologiindo.com/wp-json/wp/v2" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">WP Username</label>
          <input value={form.wordpress_username||''} onChange={e=>set('wordpress_username',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">WP Application Password</label>
          <input type="password" onChange={e=>set('wordpress_app_password',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="xxxx xxxx xxxx xxxx" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Niche</label>
          <select value={form.niche||'umum'} onChange={e=>set('niche',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {NICHES.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 block mb-1">Deskripsi Persona Site</label>
          <textarea value={form.persona_description||''} onChange={e=>set('persona_description',e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Media teknologi dengan pendekatan edukatif, bahasa lugas, target pembaca mahasiswa dan profesional muda" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Simpan</button>
        <button type="button" onClick={onCancel} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg">Batal</button>
      </div>
    </form>
  );
}

export default function Sites() {
  const [siteList, setSiteList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});

  const load = async () => {
    const res = await sitesApi.list().catch(()=>({data:[]}));
    setSiteList(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editSite) { await sitesApi.update(editSite.id, form); }
    else { await sitesApi.create(form); }
    setShowForm(false); setEditSite(null); load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus site ini?')) return;
    await sitesApi.delete(id);
    load();
  };

  const handleTest = async (id) => {
    setTesting(id);
    const res = await sitesApi.test(id).catch(e=>({data:{connected:false,message:e?.message||'Error'}}));
    setTestResult(t=>({...t,[id]:res.data}));
    setTesting(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Sites ({siteList.length}/8)</h2>
        <button onClick={() => { setShowForm(true); setEditSite(null); }} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Tambah Site</button>
      </div>

      {(showForm && !editSite) && <SiteForm onSave={handleSave} onCancel={() => setShowForm(false)} />}

      {siteList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🌐</div>
          <p className="text-gray-500">Belum ada site. Klik "+ Tambah Site" untuk memulai.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nama','URL','Niche','Status','Aksi'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {siteList.map(site => (
                <React.Fragment key={site.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{site.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate"><a href={site.url} target="_blank" rel="noopener" className="hover:text-blue-600">{site.url}</a></td>
                    <td className="px-4 py-3"><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">{site.niche||'umum'}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${site.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{site.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditSite(site); setShowForm(true); }} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                        <button onClick={() => handleTest(site.id)} disabled={testing===site.id} className="text-green-600 hover:text-green-800 text-xs">
                          {testing===site.id ? 'Testing...' : 'Test WP'}
                        </button>
                        <button onClick={() => handleDelete(site.id)} className="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                      </div>
                      {testResult[site.id] && (
                        <div className={`mt-1 text-xs ${testResult[site.id].connected?'text-green-600':'text-red-600'}`}>
                          {testResult[site.id].connected ? `✓ Terhubung (${testResult[site.id].latencyMs}ms)` : `✗ ${testResult[site.id].message||testResult[site.id].error}`}
                        </div>
                      )}
                    </td>
                  </tr>
                  {editSite?.id === site.id && showForm && (
                    <tr><td colSpan={5} className="px-4 pb-4"><SiteForm initial={editSite} onSave={handleSave} onCancel={() => { setShowForm(false); setEditSite(null); }} /></td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
