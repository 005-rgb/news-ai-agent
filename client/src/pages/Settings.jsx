import React, { useEffect, useState, useCallback } from 'react';
import { settings as settingsApi, auth, apiKeys } from '../lib/api';

const TABS = ['Operasional', 'Prompt Templates', 'Keamanan', 'Sistem', 'Export'];

const TIMEZONES = [
  'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura',
  'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok',
  'UTC', 'Asia/Tokyo', 'Asia/Shanghai',
];

const LLM_PROVIDERS = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];
const LLM_PROVIDER_INFO = {
  gemini:     { name: 'Google Gemini',  desc: 'Primer — model gemini-1.5-flash default' },
  groq:       { name: 'Groq',           desc: 'Llama-3.3-70b, very fast' },
  deepseek:   { name: 'DeepSeek',       desc: 'deepseek-chat, OpenAI-compatible' },
  openrouter: { name: 'OpenRouter',     desc: 'Multi-model gateway' },
  mistral:    { name: 'Mistral AI',     desc: 'mistral-small' },
  together:   { name: 'Together AI',    desc: 'Llama-3 series' },
  cerebras:   { name: 'Cerebras',       desc: 'llama3.1-70b, ultra-fast inference' },
  cohere:     { name: 'Cohere',         desc: 'command-r' },
};

const IMAGE_PROVIDERS = ['ai_generate', 'unsplash', 'pexels', 'placeholder'];
const IMAGE_PROVIDER_INFO = {
  ai_generate:  { name: 'AI Generate (Imagen/DALL-E)', desc: 'Generate gambar AI khusus untuk artikel' },
  unsplash:     { name: 'Unsplash API', desc: 'Foto stok gratis berlisensi Creative Commons' },
  pexels:       { name: 'Pexels API', desc: 'Foto stok gratis berlisensi Pexels' },
  placeholder:  { name: 'Placeholder Branded', desc: 'Gambar placeholder jika semua sumber gagal' },
};

function ChainEditor({ chain, allProviders, providerInfo, onChange, title, desc }) {
  const move = (idx, dir) => {
    const c = [...chain];
    const t = idx + dir;
    if (t < 0 || t >= c.length) return;
    [c[idx], c[t]] = [c[t], c[idx]];
    onChange(c);
  };
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="divide-y divide-gray-100">
        {chain.map((provider, idx) => {
          const info = providerInfo[provider];
          return (
            <div key={provider} className="flex items-center px-4 py-2.5 bg-white hover:bg-gray-50">
              <span className="w-6 text-xs text-gray-400 font-mono">{idx + 1}</span>
              <div className="flex-1 ml-3">
                <div className="text-sm font-medium text-gray-800">{info?.name || provider}</div>
                {info?.desc && <div className="text-xs text-gray-400">{info.desc}</div>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 text-sm"
                >↑</button>
                <button
                  onClick={() => move(idx, 1)} disabled={idx === chain.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 text-sm"
                >↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings({ onLogout }) {
  const [activeTab, setActiveTab] = useState('Operasional');

  // ── Operasional state ──────────────────────────────────────────────────────
  const [sysConfig, setSysConfig] = useState(null);
  const [sysForm, setSysForm] = useState({});
  const [imageChain, setImageChain] = useState(IMAGE_PROVIDERS);
  const [llmChain, setLlmChain] = useState(LLM_PROVIDERS);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysMsg, setSysMsg] = useState(null);
  const [imageChainDirty, setImageChainDirty] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
  const [llmChainDirty, setLlmChainDirty] = useState(false);
  const [llmChainSaving, setLlmChainSaving] = useState(false);

  // ── Prompt templates state ─────────────────────────────────────────────────
  const [config, setConfig] = useState(null);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [editingTpl, setEditingTpl] = useState(null);
  const [tplMsg, setTplMsg] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: '', agent_type: 'writer', category: 'berita', prompt_template: '' });

  const loadSysConfig = useCallback(async () => {
    setSysLoading(true);
    const [res, chainRes, llmOrderRes] = await Promise.all([
      settingsApi.systemConfig().catch(() => ({ data: {} })),
      settingsApi.imageChain().catch(() => ({ data: { chain: IMAGE_PROVIDERS } })),
      apiKeys.order().catch(() => ({ data: { chain: LLM_PROVIDERS } })),
    ]);
    const data = res.data || res;
    setSysConfig(data);
    setSysForm({
      humanizer_level: data.humanizer_level ?? 3,
      quality_score_threshold: data.quality_score_threshold ?? 75,
      eeat_score_threshold: data.eeat_score_threshold ?? 80,
      key_warning_threshold: data.key_warning_threshold ?? 80,
      human_review_enabled: data.human_review_enabled ?? false,
      timezone: data.timezone ?? 'Asia/Jakarta',
    });
    setImageChain(chainRes.data?.chain || IMAGE_PROVIDERS);
    setLlmChain(llmOrderRes.data?.chain || LLM_PROVIDERS);
    setSysLoading(false);
  }, []);

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
  useEffect(() => {
    if (activeTab === 'Operasional') loadSysConfig();
    else if (activeTab === 'Prompt Templates') loadTemplates();
    else if (activeTab === 'Sistem') loadConfig();
  }, [activeTab]);

  // ── System config save ─────────────────────────────────────────────────────
  const handleSysConfig = async (e) => {
    e.preventDefault();
    setSysSaving(true);
    setSysMsg(null);
    try {
      await settingsApi.updateSystemConfig({
        humanizer_level: parseInt(sysForm.humanizer_level),
        quality_score_threshold: parseInt(sysForm.quality_score_threshold),
        eeat_score_threshold: parseInt(sysForm.eeat_score_threshold),
        key_warning_threshold: parseInt(sysForm.key_warning_threshold),
        human_review_enabled: sysForm.human_review_enabled,
        timezone: sysForm.timezone,
      });
      setSysMsg({ ok: true, text: 'Konfigurasi berhasil disimpan.' });
      await loadSysConfig();
    } catch (err) {
      setSysMsg({ ok: false, text: err?.message || 'Gagal menyimpan konfigurasi.' });
    }
    setSysSaving(false);
  };

  const handleSaveImageChain = async () => {
    setImageSaving(true);
    try {
      await settingsApi.saveImageChain(imageChain);
      setSysMsg({ ok: true, text: 'Urutan provider gambar berhasil disimpan.' });
      setImageChainDirty(false);
    } catch (err) {
      setSysMsg({ ok: false, text: err?.message || 'Gagal menyimpan.' });
    }
    setImageSaving(false);
  };

  const handleSaveLlmChain = async () => {
    setLlmChainSaving(true);
    try {
      await apiKeys.saveOrder(llmChain);
      setSysMsg({ ok: true, text: 'Urutan provider LLM berhasil disimpan.' });
      setLlmChainDirty(false);
    } catch (err) {
      setSysMsg({ ok: false, text: err?.message || 'Gagal menyimpan urutan LLM.' });
    }
    setLlmChainSaving(false);
  };

  // ── Auth / export ──────────────────────────────────────────────────────────
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
      a.href = url; a.download = `newsai-config-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  // ── Template actions ───────────────────────────────────────────────────────
  const startEdit = (tpl) => { setEditingTpl({ ...tpl }); setSelectedTpl(tpl.id); setShowNewForm(false); setTplMsg(null); };
  const cancelEdit = () => { setEditingTpl(null); setSelectedTpl(null); };

  const saveEdit = async () => {
    if (!editingTpl) return;
    setTplMsg(null);
    try {
      await settingsApi.updateTemplate(editingTpl.id, { prompt_template: editingTpl.prompt_template });
      setTplMsg({ ok: true, text: 'Template berhasil disimpan.' });
      setEditingTpl(null); setSelectedTpl(null);
      await loadTemplates();
    } catch (err) { setTplMsg({ ok: false, text: err?.message || 'Gagal menyimpan' }); }
  };

  const setChampion = async (tpl) => {
    setTplMsg(null);
    try {
      if (!tpl.is_active) await settingsApi.updateTemplate(tpl.id, { is_active: true });
      await settingsApi.updateTemplate(tpl.id, { is_champion: true });
      setTplMsg({ ok: true, text: `"${tpl.name}" sekarang Champion.` });
      await loadTemplates();
    } catch (err) { setTplMsg({ ok: false, text: err?.message || 'Gagal' }); }
  };

  const unsetChampion = async (tpl) => {
    setTplMsg(null);
    try {
      await settingsApi.updateTemplate(tpl.id, { is_champion: false });
      setTplMsg({ ok: true, text: `"${tpl.name}" tidak lagi Champion.` });
      await loadTemplates();
    } catch (err) { setTplMsg({ ok: false, text: err?.message || 'Gagal' }); }
  };

  const toggleActive = async (tpl) => {
    try {
      await settingsApi.updateTemplate(tpl.id, { is_active: !tpl.is_active });
      await loadTemplates();
    } catch (err) { setTplMsg({ ok: false, text: err?.message || 'Gagal' }); }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTpl.name || !newTpl.prompt_template) { setTplMsg({ ok: false, text: 'Nama dan isi template wajib.' }); return; }
    const res = await settingsApi.createTemplate(newTpl).catch(err => ({ error: err?.message || 'Gagal' }));
    if (res?.error) { setTplMsg({ ok: false, text: res.error }); }
    else {
      setTplMsg({ ok: true, text: 'Template baru dibuat.' });
      setShowNewForm(false);
      setNewTpl({ name: '', agent_type: 'writer', category: 'berita', prompt_template: '' });
      await loadTemplates();
    }
  };

  const CATEGORIES = ['berita', 'akademik', 'feature', 'listicle', 'faq', 'evergreen', 'teknologi', 'bisnis', 'kesehatan', 'olahraga'];
  const AGENT_TYPES = ['writer', 'editor', 'reporter', 'qc'];

  const HUMANIZER_LABELS = {
    1: 'Level 1 — Struktur: variasi panjang paragraf dan kalimat',
    2: 'Level 2 — Bahasa: ganti frasa klise AI, tambah konjungsi natural',
    3: 'Level 3 — Konten: referensi waktu/lokasi, pertanyaan retoris (Recommended)',
    4: 'Level 4 — Advanced: minor imprecision, variasi atribusi kutipan',
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Operasional ─────────────────────────────────────────────────── */}
      {activeTab === 'Operasional' && (
        <div className="space-y-6">
          {sysLoading ? (
            <div className="text-gray-400 text-sm text-center py-8">Memuat konfigurasi...</div>
          ) : (
            <>
              {sysMsg && (
                <div className={`text-sm rounded-lg px-3 py-2 ${sysMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {sysMsg.text}
                </div>
              )}

              {/* Quality & Thresholds */}
              <form onSubmit={handleSysConfig} className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-5">Threshold Kualitas & Operasional</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* Humanizer Level */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Humanizer Level: <span className="text-blue-700 font-bold">Level {sysForm.humanizer_level}</span>
                    </label>
                    <input
                      type="range" min="1" max="4" step="1"
                      value={sysForm.humanizer_level || 3}
                      onChange={e => setSysForm(f => ({ ...f, humanizer_level: parseInt(e.target.value) }))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1 — Minimal</span>
                      <span>2</span>
                      <span>3 — Default</span>
                      <span>4 — Advanced</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 bg-blue-50 rounded px-3 py-1.5">
                      {HUMANIZER_LABELS[sysForm.humanizer_level] || HUMANIZER_LABELS[3]}
                    </p>
                  </div>

                  {/* Quality Score Threshold */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Quality Score Minimum (Editor Gate)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="100"
                        value={sysForm.quality_score_threshold || 75}
                        onChange={e => setSysForm(f => ({ ...f, quality_score_threshold: parseInt(e.target.value) }))}
                        className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">/ 100 — Artikel dengan skor di bawah ini akan di-revisi oleh Editor Agent</span>
                    </div>
                  </div>

                  {/* E-E-A-T Threshold */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      E-E-A-T Score Minimum (QC Gate)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="100"
                        value={sysForm.eeat_score_threshold || 80}
                        onChange={e => setSysForm(f => ({ ...f, eeat_score_threshold: parseInt(e.target.value) }))}
                        className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">/ 100 — Artikel dengan E-E-A-T di bawah ini akan dikembalikan ke Editor</span>
                    </div>
                  </div>

                  {/* Key Warning Threshold */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Alert Threshold API Key (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="100"
                        value={sysForm.key_warning_threshold || 80}
                        onChange={e => setSysForm(f => ({ ...f, key_warning_threshold: parseInt(e.target.value) }))}
                        className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">% limit harian — Alert muncul jika key melebihi threshold ini</span>
                    </div>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Timezone</label>
                    <select
                      value={sysForm.timezone || 'Asia/Jakarta'}
                      onChange={e => setSysForm(f => ({ ...f, timezone: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">⚠️ Perubahan timezone efektif setelah server restart.</p>
                  </div>

                  {/* Human Review Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Human Review Mode</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSysForm(f => ({ ...f, human_review_enabled: !f.human_review_enabled }))}
                        className={`relative inline-flex w-12 h-6 rounded-full transition-colors focus:outline-none ${sysForm.human_review_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sysForm.human_review_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-xs text-gray-600">
                        {sysForm.human_review_enabled ? '✓ Aktif — artikel menunggu persetujuan manusia sebelum publish' : 'Nonaktif — artikel dipublish otomatis setelah lolos QC'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="submit"
                    disabled={sysSaving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg"
                  >
                    {sysSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                  </button>
                  <button
                    type="button"
                    onClick={loadSysConfig}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg"
                  >
                    Reset
                  </button>
                </div>
              </form>

              {/* LLM Fallback Chain */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-2">LLM Provider Fallback Chain</h3>
                <p className="text-xs text-gray-500 mb-4">Urutan provider LLM untuk semua agent. Jika provider pertama exhausted, sistem otomatis fallback ke provider berikutnya.</p>
                <ChainEditor
                  chain={llmChain}
                  allProviders={LLM_PROVIDERS}
                  providerInfo={LLM_PROVIDER_INFO}
                  title="Urutan Provider LLM"
                  desc="↑↓ untuk ubah prioritas. Urutan ini sama dengan di halaman API Keys."
                  onChange={(c) => { setLlmChain(c); setLlmChainDirty(true); }}
                />
                {llmChainDirty && (
                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      onClick={() => { setLlmChain(LLM_PROVIDERS); setLlmChainDirty(false); }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg"
                    >Reset</button>
                    <button
                      onClick={handleSaveLlmChain}
                      disabled={llmChainSaving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
                    >
                      {llmChainSaving ? 'Menyimpan...' : 'Simpan Urutan LLM'}
                    </button>
                  </div>
                )}
              </div>

              {/* Image Fallback Chain */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-2">Image Provider Fallback Chain</h3>
                <p className="text-xs text-gray-500 mb-4">Urutan provider gambar untuk Fotografer Agent. Sistem mencoba provider pertama yang tersedia.</p>
                <ChainEditor
                  chain={imageChain}
                  allProviders={IMAGE_PROVIDERS}
                  providerInfo={IMAGE_PROVIDER_INFO}
                  title="Urutan Provider Gambar"
                  desc="Drag tombol ↑↓ untuk mengubah urutan prioritas"
                  onChange={(c) => { setImageChain(c); setImageChainDirty(true); }}
                />
                {imageChainDirty && (
                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      onClick={() => { setImageChain(IMAGE_PROVIDERS); setImageChainDirty(false); }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg"
                    >Reset</button>
                    <button
                      onClick={handleSaveImageChain}
                      disabled={imageSaving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
                    >
                      {imageSaving ? 'Menyimpan...' : 'Simpan Urutan'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Prompt Templates ─────────────────────────────────────────────── */}
      {activeTab === 'Prompt Templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Template <span className="text-yellow-600 font-semibold">Champion ★</span> digunakan oleh Writer Agent.
            </p>
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
                      required placeholder="contoh: Berita Singkat v2"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Agent Type</label>
                    <select value={newTpl.agent_type} onChange={e => setNewTpl(f => ({ ...f, agent_type: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Kategori</label>
                  <select value={newTpl.category} onChange={e => setNewTpl(f => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Isi Prompt Template *</label>
                  <textarea
                    value={newTpl.prompt_template}
                    onChange={e => setNewTpl(f => ({ ...f, prompt_template: e.target.value }))}
                    required rows={10}
                    placeholder="Masukkan prompt template... Gunakan {{PERSONA}} dan {{BRIEF}} sebagai placeholder."
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Simpan Template</button>
                  <button type="button" onClick={() => setShowNewForm(false)} className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border">Batal</button>
                </div>
              </form>
            </div>
          )}

          {tplLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Memuat template...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Belum ada template.</div>
          ) : (
            <div className="space-y-3">
              {templates.map(tpl => (
                <div key={tpl.id} className={`bg-white rounded-xl border transition-colors ${selectedTpl === tpl.id ? 'border-blue-300 shadow-sm' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {tpl.is_champion && <span className="text-yellow-500 text-sm font-bold shrink-0">★</span>}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{tpl.name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tpl.agent_type}</span>
                          {tpl.category && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{tpl.category}</span>}
                          {tpl.is_champion && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">Champion</span>}
                          {!tpl.is_active && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">Nonaktif</span>}
                        </div>
                        {tpl.sample_count > 0 && <span className="text-xs text-gray-400 mt-0.5 block">{tpl.sample_count} artikel</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tpl.is_active && !tpl.is_champion && (
                        <button onClick={() => setChampion(tpl)} className="text-xs px-2 py-1 rounded border border-yellow-300 text-yellow-600 hover:bg-yellow-50">☆ Champion</button>
                      )}
                      {tpl.is_champion && (
                        <button onClick={() => unsetChampion(tpl)} className="text-xs px-2 py-1 rounded border border-yellow-400 text-yellow-700 bg-yellow-50">★ Champion</button>
                      )}
                      <button onClick={() => toggleActive(tpl)} className={`text-xs px-2 py-1 rounded border ${tpl.is_active ? 'border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {tpl.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button onClick={() => startEdit(tpl)} className="text-xs px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200">Edit</button>
                    </div>
                  </div>

                  {editingTpl?.id === tpl.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl">
                      <label className="text-xs font-medium text-gray-600 block mb-1">Isi Prompt Template</label>
                      <textarea
                        value={editingTpl.prompt_template}
                        onChange={e => setEditingTpl(f => ({ ...f, prompt_template: e.target.value }))}
                        rows={16}
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Placeholder: {'{{PERSONA}}'}, {'{{BRIEF}}'}, {'{{CITATION_STYLE}}'}</p>
                      {tplMsg && <div className={`text-sm rounded px-3 py-2 my-2 ${tplMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{tplMsg.text}</div>}
                      <div className="flex gap-2 mt-2">
                        <button onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Simpan</button>
                        <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border">Batal</button>
                      </div>
                    </div>
                  )}

                  {selectedTpl !== tpl.id && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-gray-400 font-mono truncate">{(tpl.prompt_template || '').slice(0, 120)}...</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Keamanan ─────────────────────────────────────────────────────── */}
      {activeTab === 'Keamanan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Ganti Password Admin</h3>
            {pwMsg && <div className={`mb-3 text-sm rounded-lg px-3 py-2 ${pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{pwMsg.text}</div>}
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
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Ganti Password</button>
            </form>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Session</h3>
            <p className="text-sm text-gray-500 mb-4">Keluar dari sesi aktif.</p>
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg">Logout</button>
          </div>
        </div>
      )}

      {/* ── Tab: Sistem ───────────────────────────────────────────────────────── */}
      {activeTab === 'Sistem' && (
        <div className="space-y-6">
          {config && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Konfigurasi Server (Read-only)</h3>
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
              <p className="text-xs text-gray-400 mt-3">Nilai di atas dari env variables. Gunakan tab <strong>Operasional</strong> untuk override melalui UI.</p>
            </div>
          )}

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-800 mb-4">Build Progress</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Phase 0 — Foundation & Infrastructure', true],
                ['Phase 1 — API Key Pool Manager', true],
                ['Phase 2 — Source Intelligence (68 sumber)', true],
                ['Phase 3 — Content Pipeline Core (5 agent)', true],
                ['Phase 4 — Writing Standards Engine', true],
                ['Phase 5 — Fotografer & WordPress Publisher', true],
                ['Phase 6 — Scheduler & Full Automation', true],
                ['Phase 7 — Dashboard Full (semua menu real)', true],
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
        </div>
      )}

      {/* ── Tab: Export ────────────────────────────────────────────────────────── */}
      {activeTab === 'Export' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Export Konfigurasi</h3>
            <p className="text-sm text-gray-500 mb-4">
              Export semua config site, sumber, dan prompt templates ke JSON.
              <strong> API key dan WP credentials tidak disertakan</strong> (demi keamanan).
            </p>
            <button
              onClick={handleExport} disabled={exporting}
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
