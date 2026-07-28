import React, { useEffect, useState } from 'react';
import { settings as settingsApi, auth } from '../lib/api';

export default function Settings({ onLogout }) {
  const [config, setConfig] = useState(null);
  const [pwForm, setPwForm] = useState({ current_password:'', new_password:'', confirm:'' });
  const [pwMsg, setPwMsg] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const res = await settingsApi.get().catch(()=>({data:{}}));
    setConfig(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleLogout = async () => {
    await auth.logout().catch(()=>{});
    onLogout();
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ ok: false, text: 'Password baru tidak sama' }); return;
    }
    const res = await settingsApi.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password }).catch(e=>({data:{message:e?.message||'Error'}}));
    setPwMsg({ ok: !!res.data?.newHash, text: res.data?.message || res.data?.error?.message || 'Gagal' });
    if (res.data?.newHash) {
      setPwForm({ current_password:'', new_password:'', confirm:'' });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await settingsApi.export().catch(()=>null);
    if (res?.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `newsai-config-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* System config */}
      {config && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Konfigurasi Sistem</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Timezone', config.timezone],
              ['Quality Score Threshold', config.qualityScoreThreshold],
              ['E-E-A-T Threshold', config.eeatScoreThreshold],
              ['Humanizer Level', config.humanizerLevel],
              ['Key Warning Threshold', `${config.keyWarningThreshold}%`],
              ['Active Sources', config.activeSources],
              ['Admin Username', config.adminUsername],
              ['Auth Configured', config.authConfigured ? '✓ Ya' : '✗ Belum'],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between bg-gray-50 rounded px-3 py-2">
                <span className="text-gray-600">{k}</span>
                <span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Untuk mengubah nilai, edit environment variables dan restart server.</p>
        </div>
      )}

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Ganti Password Admin</h3>
        {pwMsg && (
          <div className={`mb-3 text-sm rounded-lg px-3 py-2 ${pwMsg.ok?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>
            {pwMsg.text}
          </div>
        )}
        <form onSubmit={handlePwChange} className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Password Saat Ini</label><input type="password" value={pwForm.current_password} onChange={e=>setPwForm(f=>({...f,current_password:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Password Baru (min. 8 karakter)</label><input type="password" value={pwForm.new_password} onChange={e=>setPwForm(f=>({...f,new_password:e.target.value}))} required minLength={8} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Konfirmasi Password Baru</label><input type="password" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Ganti Password</button>
        </form>
      </div>

      {/* Export */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-800 mb-2">Export Konfigurasi</h3>
        <p className="text-sm text-gray-500 mb-4">Export semua config site, sumber, dan prompt templates (tanpa API key atau WP credentials).</p>
        <button onClick={handleExport} disabled={exporting} className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {exporting ? 'Exporting...' : '⬇ Export JSON'}
        </button>
      </div>

      {/* Phase info */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Build Progress</h3>
        <div className="space-y-1 text-sm">
          {[
            ['Phase 0 — Foundation & Infrastructure', true],
            ['Phase 1 — API Key Pool Manager', false],
            ['Phase 2 — Source Intelligence', false],
            ['Phase 3 — Content Pipeline Core', false],
            ['Phase 4 — Writing Standards Engine', false],
            ['Phase 5 — Fotografer & WordPress Publisher', false],
            ['Phase 6 — Scheduler & Full Automation', false],
            ['Phase 7 — Dashboard Full', false],
            ['Phase 8 — Quality & Humanizer Engine', false],
            ['Phase 9 — Rapat Redaksi Engine', false],
            ['Phase 10 — Innovation Layer', false],
            ['Phase 11 — Hardening & Production Ready', false],
          ].map(([label, done]) => (
            <div key={label} className={`flex items-center gap-2 ${done?'text-blue-900 font-medium':'text-blue-400'}`}>
              <span>{done?'✅':'⬜'}</span><span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-2">Session</h3>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg">Logout</button>
      </div>
    </div>
  );
}
