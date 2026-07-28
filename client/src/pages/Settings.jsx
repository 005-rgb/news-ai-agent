import React, { useEffect, useState, useCallback } from 'react';
import { settings as settingsApi, auth } from '../lib/api';

const TABS = ['Sistem', 'Prompt Templates', 'Keamanan', 'Export'];

export default function Settings({ onLogout }) {
  const [activeTab, setActiveTab] = useState('Sistem');
  const [config, setConfig] = useState(null);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Prompt templates state
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [editingTpl, setEditingTpl] = useState(null); // { id, name, prompt_template, is_champion }
  const [tplMsg, setTplMsg] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: '', agent_type: 'writer', category: 'berita', prompt_template: '' });

  const loadConfig = useCallback(async () => {
    const res = await settingsApi.get().catch(() => ({ data: {} }));
    setConfig(res.data || res);
  }, []);

  const loadTemplates = useCallback(async () => {
    setTplLoading(true);
    const res = await settingsApi.promptTemplates().catch(() => ({ data: [] }));
    setTemplates(Array.isArray(res.data || res) ? (res.data || res) : []);
    setTplLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (activeTab === 'Prompt Templates') loadTemplates(); }, [activeTab, loadTemplates]);

  const handleLogout = async () => {
    await auth.logout().catch(() => {});
    onLogout();
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ ok: false, text: 'Password baru tidak sama' });
      return;
    }
    const res = await settingsApi.changePassword({
      current_password: pwForm.current_password,
      new_password: pwForm.new_password,
    }).catch(err => ({ data: { error: { message: err?.message || 'Error' } } }));
    const data = res.data || res;
    setPwMsg({ ok: !!data?.newHash, text: data?.message || data?.error?.message || 'Gagal' });
    if (data?.newHash) setPwForm({ current_password: '', new_password: '', confirm: '' });
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await settingsApi.export().catch(() => null);
    const data = res?.data || res;
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newsai-config-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  // ── Template actions ────────────────────────────────────────────────────────
  const startEdit = (tpl) => {
    setEditingTpl({ id: tpl.id, name: tpl.name, prompt_template: tpl.prompt_template, is_champion: tpl.is_champion });
    setSelectedTpl(tpl.id);
    setShowNewForm(false);
    setTplMsg(null);
  };

  const cancelEdit = () => { setEditingTpl(null); setSelectedTpl(null); };

  const saveEdit = async () => {
    if (!editingTpl) return;
    setTplMsg(null);
    try {
      await settingsApi.updateTemplate(editingTpl.id, { prompt_template: editingTpl.prompt_template });
      setTplMsg({ ok: true, text: 'Template berhasil disimpan.' });
      setEditingTpl(null);
      setSelectedTpl(null);
      await loadTemplates();
    } catch (err) {
      setTplMsg({ ok: false, text: err?.message || 'Gagal menyimpan' });
    }
  };

  /**
   * Set this template as champion for its format scope.
   * The server handles clearing is_champion on other rows in the same scope.
   */
  const setChampion = async (tpl) => {
    setTplMsg(null);
    try {
      // First activate if inactive
      if (!tpl.is_active) {
        await settingsApi.updateTemplate(tpl.id, { is_active: true });
      }
      await settingsApi.updateTemplate(tpl.id, { is_champion: true });
      setTplMsg({ ok: true, text: `"${tpl.name}" sekarang menjadi Champion untuk format ${tpl.format_key || tpl.category || tpl.agent_type}.` });
      await loadTemplates();
    } catch (err) {
      setTplMsg({ ok: false, text: err?.message || 'Gagal set champion' });
    }
  };

  const unsetChampion = async (tpl) => {
    setTplMsg(null);
    try {
      await settingsApi.updateTemplate(tpl.id, { is_champion: false });
      setTplMsg({ ok: true, text: `"${tpl.name}" tidak lagi menjadi Champion. Sistem akan pakai template default.` });
      await loadTemplates();
    } catch (err) {
      setTplMsg({ ok: false, text: err?.message || 'Gagal' });
    }
  };

  const toggleActive = async (tpl) => {
    try {
      await settingsApi.updateTemplate(tpl.id, { is_active: !tpl.is_active });
      await loadTemplates();
    } catch (err) {
      setTplMsg({ ok: false, text: err?.message || 'Gagal' });
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTpl.name || !newTpl.prompt_template) {
      setTplMsg({ ok: false, text: 'Nama dan isi template wajib diisi.' });
      return;
    }
    const res = await settingsApi.createTemplate(newTpl).catch(err => ({ error: err?.message || 'Gagal' }));
    if (res?.error) {
      setTplMsg({ ok: false, text: res.error });
    } else {
      setTplMsg({ ok: true, text: 'Template baru berhasil dibuat.' });
      setShowNewForm(false);
      setNewTpl({ name: '', agent_type: 'writer', category: 'berita', prompt_template: '' });
      await loadTemplates();
    }
  };

  const CATEGORIES = ['berita', 'akademik', 'feature', 'listicle', 'faq', 'evergreen', 'teknologi', 'bisnis', 'kesehatan', 'olahraga'];
  const AGENT_TYPES = ['writer', 'editor', 'reporter', 'qc'];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Sistem ─────────────────────────────────────────────────────── */}
      {activeTab === 'Sistem' && (
        <div className="space-y-6">
          {config && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Konfigurasi Sistem</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Timezone', config.timezone],
                  ['Quality Score Threshold', config.qualityScoreThreshold],
                  ['E-E-A-T Threshold', config.eeatScoreThreshold],
                  ['Humanizer Level', `Level ${config.humanizerLevel} dari 4`],
                  ['Key Warning Threshold', `${config.keyWarningThreshold}%`],
                  ['Active Sources', config.activeSources],
                  ['Admin Username', config.adminUsername],
                  ['Auth Configured', config.authConfigured ? '✓ Ya' : '✗ Belum'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-gray-50 rounded px-3 py-2">
                    <span className="text-gray-600">{k}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Untuk mengubah nilai, edit environment variables dan restart server.
              </p>
            </div>
          )}

          {/* Build Progress */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-800 mb-4">Build Progress</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Phase 0 — Foundation & Infrastructure', true],
                ['Phase 1 — API Key Pool Manager', true],
                ['Phase 2 — Source Intelligence (68 sumber)', true],
                ['Phase 3 — Content Pipeline Core (5 agent)', true],
                ['Phase 4 — Writing Standards Engine', true],
                ['Phase 5 — Fotografer & WordPress Publisher', false],
                ['Phase 6 — Scheduler & Full Automation', false],
                ['Phase 7 — Dashboard Full', false],
                ['Phase 8 — Quality & Humanizer Engine', false],
                ['Phase 9 — Rapat Redaksi Engine', false],
                ['Phase 10 — Innovation Layer', false],
                ['Phase 11 — Hardening & Production Ready', false],
              ].map(([label, done]) => (
                <div key={label} className={`flex items-center gap-2 ${done ? 'text-blue-900 font-medium' : 'text-blue-400'}`}>
                  <span>{done ? '✅' : '⬜'}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Writing Standards Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">Standar Penulisan (Phase 4)</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>✅ <strong>7 format tersedia</strong>: Berita Singkat, Berita Panjang, Jurnal IMRAD, Feature/Opini, Listicle, FAQ, Evergreen</p>
              <p>✅ <strong>Validation checklist per format</strong>: Editor Agent memverifikasi struktur otomatis</p>
              <p>✅ <strong>Humanizer Level {config?.humanizerLevel || 3}</strong>: Anti-AI detection aktif di setiap artikel</p>
              <p>✅ <strong>DB Template Override</strong>: Champion template di tab Prompt Templates menggantikan default</p>
              <p className="text-xs text-gray-400 mt-2">Untuk mengedit prompt template, buka tab <strong>Prompt Templates</strong>.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Prompt Templates ───────────────────────────────────────────── */}
      {activeTab === 'Prompt Templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Template yang ditandai <span className="text-yellow-600 font-semibold">Champion ★</span> digunakan oleh Writer Agent. Edit template untuk mengubah gaya penulisan.
              </p>
            </div>
            <button
              onClick={() => { setShowNewForm(!showNewForm); setEditingTpl(null); setTplMsg(null); }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              + Template Baru
            </button>
          </div>

          {tplMsg && (
            <div className={`text-sm rounded-lg px-3 py-2 ${tplMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {tplMsg.text}
            </div>
          )}

          {/* New template form */}
          {showNewForm && (
            <div className="bg-white rounded-xl border border-blue-200 p-5">
              <h4 className="font-semibold text-gray-800 mb-3">Buat Template Baru</h4>
              <form onSubmit={handleCreateTemplate} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 block mb-1">Nama Template *</label>
                    <input
                      value={newTpl.name}
                      onChange={e => setNewTpl(f => ({ ...f, name: e.target.value }))}
                      required
                      placeholder="contoh: Berita Singkat v2"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Agent Type</label>
                    <select
                      value={newTpl.agent_type}
                      onChange={e => setNewTpl(f => ({ ...f, agent_type: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Kategori</label>
                  <select
                    value={newTpl.category}
                    onChange={e => setNewTpl(f => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Isi Prompt Template *</label>
                  <textarea
                    value={newTpl.prompt_template}
                    onChange={e => setNewTpl(f => ({ ...f, prompt_template: e.target.value }))}
                    required
                    rows={10}
                    placeholder="Masukkan prompt template... Gunakan {{PERSONA}} dan {{BRIEF}} sebagai placeholder."
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Gunakan {'{{'} PERSONA {'}}'}  dan {'{{'} BRIEF {'}}'}  sebagai placeholder yang akan diisi otomatis.</p>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                    Simpan Template
                  </button>
                  <button type="button" onClick={() => setShowNewForm(false)} className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Template list */}
          {tplLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Memuat template...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Belum ada template. Klik "+ Template Baru" untuk membuat.</div>
          ) : (
            <div className="space-y-3">
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  className={`bg-white rounded-xl border transition-colors ${selectedTpl === tpl.id ? 'border-blue-300 shadow-sm' : 'border-gray-200'}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {tpl.is_champion && (
                        <span className="text-yellow-500 text-sm font-bold shrink-0">★</span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{tpl.name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tpl.agent_type}</span>
                          {tpl.category && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{tpl.category}</span>}
                          {tpl.is_champion && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">Champion</span>}
                          {!tpl.is_active && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">Nonaktif</span>}
                        </div>
                        {tpl.sample_count > 0 && (
                          <span className="text-xs text-gray-400 mt-0.5 block">{tpl.sample_count} artikel menggunakan template ini</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Champion toggle — only for active templates */}
                      {tpl.is_active && !tpl.is_champion && (
                        <button
                          onClick={() => setChampion(tpl)}
                          title="Jadikan Champion — template ini akan dipakai Writer Agent untuk format ini"
                          className="text-xs px-2 py-1 rounded border border-yellow-300 text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                          ☆ Set Champion
                        </button>
                      )}
                      {tpl.is_champion && (
                        <button
                          onClick={() => unsetChampion(tpl)}
                          title="Lepas status Champion — sistem akan pakai template default"
                          className="text-xs px-2 py-1 rounded border border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                        >
                          ★ Champion
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(tpl)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          tpl.is_active
                            ? 'border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {tpl.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        onClick={() => startEdit(tpl)}
                        className="text-xs px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Edit panel */}
                  {editingTpl?.id === tpl.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl">
                      <div className="mb-3">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Isi Prompt Template</label>
                        <textarea
                          value={editingTpl.prompt_template}
                          onChange={e => setEditingTpl(f => ({ ...f, prompt_template: e.target.value }))}
                          rows={16}
                          className="w-full border rounded-lg px-3 py-2 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Placeholder yang tersedia: {'{{PERSONA}}'}, {'{{BRIEF}}'}, {'{{CITATION_STYLE}}'}</p>
                      </div>
                      {tplMsg && (
                        <div className={`text-sm rounded px-3 py-2 mb-3 ${tplMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {tplMsg.text}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                        >
                          Simpan Perubahan
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preview (collapsed) */}
                  {selectedTpl !== tpl.id && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-gray-400 font-mono truncate">
                        {(tpl.prompt_template || '').slice(0, 120)}...
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Keamanan ──────────────────────────────────────────────────── */}
      {activeTab === 'Keamanan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Ganti Password Admin</h3>
            {pwMsg && (
              <div className={`mb-3 text-sm rounded-lg px-3 py-2 ${pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={handlePwChange} className="space-y-3 max-w-md">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Password Saat Ini</label>
                <input type="password" value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Password Baru (min. 8 karakter)</label>
                <input type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required minLength={8} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Konfirmasi Password Baru</label>
                <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                Ganti Password
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Session</h3>
            <p className="text-sm text-gray-500 mb-4">Keluar dari sesi aktif.</p>
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Logout
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Export ────────────────────────────────────────────────────── */}
      {activeTab === 'Export' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Export Konfigurasi</h3>
            <p className="text-sm text-gray-500 mb-4">
              Export semua config site, sumber, dan prompt templates ke JSON.
              <strong> API key dan WP credentials tidak disertakan</strong> (demi keamanan).
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {exporting ? 'Exporting...' : '⬇ Export JSON'}
            </button>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
            <h3 className="font-semibold text-amber-800 mb-2">Informasi Backup</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Export mencakup: sites, sources, prompt templates, article count</li>
              <li>• Tidak mencakup: API keys (terenkripsi di DB), WP credentials, artikel content</li>
              <li>• Gunakan export ini untuk backup konfigurasi atau pindah server</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
