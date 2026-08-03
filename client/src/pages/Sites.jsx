import React, { useEffect, useState } from 'react';
import { sites as sitesApi } from '../lib/api';

const NICHES = ['politik','bisnis','teknologi','kesehatan','akademik','lifestyle','olahraga','hukum','umum'];
const CITATION_STYLES = ['APA','IEEE','Harvard'];
const SEO_PLUGINS = ['yoast','rankmath'];
const FORMATS = ['berita_singkat','berita_panjang','jurnal_review','feature_opini','listicle','faq_article','evergreen'];
const ALL_PROVIDERS = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere','huggingface'];

function PersonaModal({ site, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Persona Memory — {site.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Deskripsi Persona</div>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
            {site.persona_description || <em className="text-gray-400">Belum ada deskripsi persona.</em>}
          </p>
        </div>
        {site.persona_memory && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Persona Memory (Kumulatif AI)</div>
            <div className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3 whitespace-pre-wrap max-h-56 overflow-y-auto">
              {site.persona_memory}
            </div>
          </div>
        )}
        {!site.persona_memory && (
          <p className="text-xs text-gray-400 italic">Persona memory akan terisi otomatis setelah artikel-artikel diterbitkan ke site ini.</p>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg">Tutup</button>
        </div>
      </div>
    </div>
  );
}

function SiteForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name:'', url:'', wordpress_api_url:'', wordpress_username:'',
    niche:'teknologi', persona_description:'', citation_style:'APA',
    seo_plugin:'yoast', human_review_required:false, default_author:'',
    competitor_sites:[], preferred_providers:[],
    content_format:'berita_singkat',
    articles_per_day:3, time_slots:'07:00,12:00,19:00', random_delay_minutes:30,
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const toggleProvider = (p) => setForm(f => ({
    ...f,
    preferred_providers: f.preferred_providers?.includes(p)
      ? f.preferred_providers.filter(x => x !== p)
      : [...(f.preferred_providers||[]), p],
  }));
  const toggleCompetitor = () => {};

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      articles_per_day: parseInt(form.articles_per_day) || 3,
      random_delay_minutes: parseInt(form.random_delay_minutes) || 30,
      competitor_sites: form.competitor_sites.filter(Boolean),
      preferred_providers: form.preferred_providers,
    };
    await onSave(payload);
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="font-semibold text-gray-800 mb-4">{initial ? 'Edit Site' : 'Tambah Site Baru'}</h3>

      {/* Section: Basic */}
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Informasi Dasar</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
      </div>

      {/* Section: Content Config */}
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Konfigurasi Konten</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Format Konten Default</label>
          <select value={form.content_format||'berita_singkat'} onChange={e=>set('content_format',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {FORMATS.map(f=><option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Gaya Sitasi</label>
          <select value={form.citation_style||'APA'} onChange={e=>set('citation_style',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CITATION_STYLES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">SEO Plugin</label>
          <select value={form.seo_plugin||'yoast'} onChange={e=>set('seo_plugin',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {SEO_PLUGINS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Author Default</label>
          <input value={form.default_author||''} onChange={e=>set('default_author',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tim Redaksi" />
        </div>
      </div>

      {/* Section: Posting Schedule */}
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Jadwal Posting</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Artikel per Hari</label>
          <input type="number" min="1" max="10" value={form.articles_per_day||3} onChange={e=>set('articles_per_day',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 block mb-1">Slot Waktu (pisah koma)</label>
          <input value={form.time_slots||''} onChange={e=>set('time_slots',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="07:00, 12:00, 19:00" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Random Delay (menit)</label>
          <input type="number" min="0" max="120" value={form.random_delay_minutes||30} onChange={e=>set('random_delay_minutes',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Section: LLM Providers */}
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Provider LLM Preferred</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {ALL_PROVIDERS.map(p => (
          <button key={p} type="button" onClick={() => toggleProvider(p)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              form.preferred_providers?.includes(p)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {p}
          </button>
        ))}
      </div>

      {/* Section: Competitors */}
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Site Kompetitor (untuk Gap Analysis)</div>
      <div className="mb-4 space-y-2">
        {(form.competitor_sites||['']).map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={c}
              onChange={e => setForm(f => ({
                ...f,
                competitor_sites: f.competitor_sites.map((x, j) => j === i ? e.target.value : x),
              }))}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://kompetitor.com"
            />
            <button type="button" onClick={() => setForm(f => ({...f, competitor_sites: f.competitor_sites.filter((_, j) => j !== i)}))}
              className="text-red-500 hover:text-red-700 text-sm px-2">Hapus</button>
          </div>
        ))}
        <button type="button" onClick={() => setForm(f => ({...f, competitor_sites: [...(f.competitor_sites||[]), '']}))}
          className="text-blue-600 hover:text-blue-800 text-xs">+ Tambah kompetitor</button>
      </div>

      {/* Section: Persona + Human Review */}
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Persona & Review</div>
      <div className="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Deskripsi Persona Site</label>
          <textarea value={form.persona_description||''} onChange={e=>set('persona_description',e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Media teknologi dengan pendekatan edukatif, bahasa lugas, target pembaca mahasiswa dan profesional muda" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.human_review_required||false} onChange={e=>set('human_review_required',e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700">Wajibkan Human Review sebelum publish</span>
          </label>
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
  const [toggling, setToggling] = useState(null);
  const [personaSite, setPersonaSite] = useState(null);

  const load = async () => {
    const res = await sitesApi.list().catch(()=>({data:[]}));
    setSiteList(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    const config = {
      ...(form.config || {}),
      posting_schedule: {
        articles_per_day: parseInt(form.articles_per_day) || 3,
        time_slots: (form.time_slots || '').split(',').map(s => s.trim()).filter(Boolean),
        random_delay_minutes: parseInt(form.random_delay_minutes) || 30,
      },
      content_format: form.content_format || 'berita_singkat',
    };
    const payload = { ...form, config };
    delete payload.articles_per_day; delete payload.time_slots; delete payload.random_delay_minutes; delete payload.content_format;
    if (editSite) { await sitesApi.update(editSite.id, payload); }
    else { await sitesApi.create(payload); }
    setShowForm(false); setEditSite(null); load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus site ini? Semua artikel terkait akan tetap ada.')) return;
    await sitesApi.delete(id);
    load();
  };

  const handleTest = async (id) => {
    setTesting(id);
    const res = await sitesApi.test(id).catch(e=>({data:{connected:false,message:e?.message||'Error'}}));
    setTestResult(t=>({...t,[id]:res.data}));
    setTesting(null);
  };

  const handleToggleStatus = async (site) => {
    setToggling(site.id);
    const newStatus = site.status === 'active' ? 'paused' : 'active';
    await sitesApi.update(site.id, { status: newStatus }).catch(()=>{});
    await load();
    setToggling(null);
  };

  const handlePersonaPreview = async (site) => {
    // Fetch full site data (includes persona_memory)
    const res = await sitesApi.get(site.id).catch(()=>({ data: site }));
    setPersonaSite(res.data || site);
  };

  return (
    <div>
      {personaSite && <PersonaModal site={personaSite} onClose={() => setPersonaSite(null)} />}

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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(site)}
                        disabled={toggling === site.id}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                          site.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        } ${toggling === site.id ? 'opacity-50' : ''}`}
                        title={site.status === 'active' ? 'Klik untuk Pause' : 'Klik untuk Aktifkan'}
                      >
                        {toggling === site.id ? '...' : site.status === 'active' ? '● Aktif' : '○ Paused'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => {
                          const cfg = typeof site.config === 'string' ? JSON.parse(site.config||'{}') : (site.config||{});
                          const ps = cfg.posting_schedule || {};
                          setEditSite({
                            ...site,
                            content_format: cfg.content_format || site.content_format || 'berita_singkat',
                            articles_per_day: ps.articles_per_day || 3,
                            time_slots: (ps.time_slots || []).join(', '),
                            random_delay_minutes: ps.random_delay_minutes || 30,
                            competitor_sites: site.competitor_sites || [''],
                          });
                          setShowForm(true);
                        }} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                        <button onClick={() => handlePersonaPreview(site)} className="text-purple-600 hover:text-purple-800 text-xs">Persona</button>
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
