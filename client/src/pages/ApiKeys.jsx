import React, { useEffect, useState } from 'react';
import { apiKeys } from '../lib/api';

const PROVIDERS = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];

function UsageBar({ today, limit }) {
  const pct = limit ? Math.min((today / limit) * 100, 100) : 0;
  const color = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 flex-shrink-0">{today}/{limit}</span>
    </div>
  );
}

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider:'gemini', label:'', key_value:'', daily_limit:1000, monthly_limit:30000 });
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

  const load = async () => {
    const res = await apiKeys.list().catch(()=>({data:[]}));
    setKeys(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await apiKeys.create(form);
    setShowForm(false);
    setForm({ provider:'gemini', label:'', key_value:'', daily_limit:1000, monthly_limit:30000 });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus API key ini?')) return;
    await apiKeys.delete(id);
    load();
  };

  const handleTest = async (id) => {
    setTesting(id);
    const res = await apiKeys.test(id).catch(e=>({data:{connected:false,error:e?.message}}));
    setTestResults(t=>({...t,[id]:res.data}));
    setTesting(null);
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await apiKeys.update(id, { status: newStatus });
    load();
  };

  const grouped = PROVIDERS.reduce((acc, p) => {
    acc[p] = keys.filter(k => k.provider === p);
    return acc;
  }, {});

  const statusColor = { active:'bg-green-100 text-green-700', warning:'bg-yellow-100 text-yellow-700', critical:'bg-orange-100 text-orange-700', exhausted:'bg-red-100 text-red-700', paused:'bg-gray-100 text-gray-600' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">API Keys ({keys.length})</h2>
        <button onClick={() => setShowForm(s=>!s)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Tambah Key</button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Tambah API Key</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Provider *</label>
              <select value={form.provider} onChange={e=>setForm(f=>({...f,provider:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PROVIDERS.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Label</label>
              <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Gemini Key #1" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">API Key Value *</label>
              <input type="password" value={form.key_value} onChange={e=>setForm(f=>({...f,key_value:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="sk-..." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Daily Limit</label>
              <input type="number" value={form.daily_limit} onChange={e=>setForm(f=>({...f,daily_limit:parseInt(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Monthly Limit</label>
              <input type="number" value={form.monthly_limit} onChange={e=>setForm(f=>({...f,monthly_limit:parseInt(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Simpan</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </form>
      )}

      {keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🔑</div>
          <p className="text-gray-500 text-sm">Belum ada API key. Tambahkan key untuk mulai menggunakan LLM.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {PROVIDERS.filter(p => grouped[p].length > 0).map(provider => (
            <div key={provider} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 capitalize">{provider}</h3>
                <span className="text-xs text-gray-500">{grouped[provider].length} key</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Label','Status','Usage Hari Ini','Error Count','Last Used','Aksi'].map(h=>(
                      <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grouped[provider].map(k => (
                    <tr key={k.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{k.label}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[k.status]||'bg-gray-100'}`}>{k.status}</span></td>
                      <td className="px-4 py-3 w-40"><UsageBar today={k.usage_today} limit={k.daily_limit} /></td>
                      <td className="px-4 py-3 text-gray-500">{k.error_count}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString('id-ID') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          <button onClick={() => handleTest(k.id)} disabled={testing===k.id} className="text-blue-600 hover:text-blue-800 text-xs">
                            {testing===k.id ? 'Testing...' : 'Test'}
                          </button>
                          <button onClick={() => handleToggle(k.id, k.status)} className="text-yellow-600 hover:text-yellow-800 text-xs">
                            {k.status==='active'?'Pause':'Aktifkan'}
                          </button>
                          <button onClick={() => handleDelete(k.id)} className="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                        </div>
                        {testResults[k.id] && (
                          <div className={`mt-1 text-xs ${testResults[k.id].connected?'text-green-600':'text-red-600'}`}>
                            {testResults[k.id].connected ? `✓ OK (${testResults[k.id].latencyMs}ms) — "${testResults[k.id].response}"` : `✗ ${testResults[k.id].error}`}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
