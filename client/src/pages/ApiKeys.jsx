import React, { useEffect, useState, useCallback } from 'react';
import { apiKeys } from '../lib/api';

const PROVIDERS = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];

const PROVIDER_INFO = {
  gemini:     { name: 'Google Gemini',  color: 'blue',   dailyDefault: 1500,  monthlyDefault: 45000,  resetLogic: 'midnight UTC' },
  groq:       { name: 'Groq',           color: 'orange', dailyDefault: 14400, monthlyDefault: 432000, resetLogic: 'rolling 24h' },
  deepseek:   { name: 'DeepSeek',       color: 'teal',   dailyDefault: 500,   monthlyDefault: 15000,  resetLogic: 'midnight UTC' },
  openrouter: { name: 'OpenRouter',     color: 'purple', dailyDefault: 200,   monthlyDefault: 6000,   resetLogic: 'rolling 24h' },
  mistral:    { name: 'Mistral AI',     color: 'pink',   dailyDefault: 500,   monthlyDefault: 15000,  resetLogic: 'midnight UTC' },
  together:   { name: 'Together AI',    color: 'green',  dailyDefault: 1000,  monthlyDefault: 30000,  resetLogic: 'rolling 24h' },
  cerebras:   { name: 'Cerebras',       color: 'red',    dailyDefault: 1000,  monthlyDefault: 30000,  resetLogic: 'rolling 24h' },
  cohere:     { name: 'Cohere',         color: 'indigo', dailyDefault: 1000,  monthlyDefault: 30000,  resetLogic: 'midnight UTC' },
};

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700 ring-1 ring-green-200',
  warning:   'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
  critical:  'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  exhausted: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  paused:    'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
};

const ALERT_STYLES = {
  critical: { bar: 'bg-red-50 border-red-200', text: 'text-red-800', icon: '🔴', badge: 'bg-red-100 text-red-700' },
  warning:  { bar: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', icon: '🟡', badge: 'bg-yellow-100 text-yellow-700' },
  info:     { bar: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: '🔵', badge: 'bg-blue-100 text-blue-700' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function UsageBar({ value, limit, colorize = true }) {
  const pct = limit > 0 ? Math.min((value / limit) * 100, 100) : 0;
  const color = !colorize ? 'bg-blue-400'
    : pct >= 80 ? 'bg-red-500'
    : pct >= 60 ? 'bg-yellow-500'
    : 'bg-green-500';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[48px]">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
        {value.toLocaleString()}/{limit.toLocaleString()}
      </span>
    </div>
  );
}

function FreshnessBar({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 bg-gray-100 rounded-full h-1">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
    </div>
  );
}

function AlertBanner({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null;
  const topAlert = alerts[0];
  const style = ALERT_STYLES[topAlert.severity] || ALERT_STYLES.info;
  return (
    <div className={`border rounded-xl p-4 mb-5 ${style.bar}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span>{style.icon}</span>
            <span className={`font-semibold text-sm ${style.text}`}>
              {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 3).map(a => (
              <div key={a.id} className={`text-xs ${style.text} flex items-center gap-2`}>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ALERT_STYLES[a.severity]?.badge}`}>
                  {a.severity}
                </span>
                <span className="truncate">{a.message}</span>
              </div>
            ))}
            {alerts.length > 3 && (
              <div className={`text-xs ${style.text} opacity-70`}>+{alerts.length - 3} more alerts</div>
            )}
          </div>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">×</button>
      </div>
    </div>
  );
}

function EditKeyModal({ keyData, onSave, onClose }) {
  const [form, setForm] = useState({
    label:         keyData.label || '',
    daily_limit:   keyData.daily_limit || 1000,
    monthly_limit: keyData.monthly_limit || 30000,
    reset_at:      keyData.reset_at ? keyData.reset_at.slice(0, 16) : '',
    key_value:     '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      label:         form.label,
      daily_limit:   Number(form.daily_limit),
      monthly_limit: Number(form.monthly_limit),
    };
    if (form.reset_at) payload.reset_at = new Date(form.reset_at).toISOString();
    if (form.key_value) payload.key_value = form.key_value;
    await onSave(keyData.id, payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">Edit API Key</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Provider</label>
            <div className="px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-500 capitalize">
              {keyData.provider}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Label</label>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Gemini Primary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Daily Limit</label>
              <input
                type="number" min="1"
                value={form.daily_limit}
                onChange={e => setForm(f => ({ ...f, daily_limit: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Limit</label>
              <input
                type="number" min="1"
                value={form.monthly_limit}
                onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Reset At <span className="font-normal text-gray-400">(next quota reset)</span>
            </label>
            <input
              type="datetime-local"
              value={form.reset_at}
              onChange={e => setForm(f => ({ ...f, reset_at: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              New Key Value <span className="font-normal text-gray-400">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={form.key_value}
              onChange={e => setForm(f => ({ ...f, key_value: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="sk-... (only to rotate key)"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FallbackChainEditor({ chain, onChange }) {
  const move = (idx, dir) => {
    const newChain = [...chain];
    const target = idx + dir;
    if (target < 0 || target >= newChain.length) return;
    [newChain[idx], newChain[target]] = [newChain[target], newChain[idx]];
    onChange(newChain);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Provider Fallback Chain</h3>
        <p className="text-xs text-gray-500 mt-0.5">Order providers — system tries first provider with available quota</p>
      </div>
      <div className="divide-y divide-gray-100">
        {chain.map((provider, idx) => {
          const info = PROVIDER_INFO[provider];
          return (
            <div key={provider} className="flex items-center px-4 py-2.5 hover:bg-gray-50">
              <span className="w-6 text-xs text-gray-400 font-mono">{idx + 1}</span>
              <div className="flex-1 ml-3">
                <span className="text-sm font-medium text-gray-800">{info?.name || provider}</span>
                <span className="ml-2 text-xs text-gray-400">{info?.resetLogic}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >↑</button>
                <button
                  onClick={() => move(idx, 1)} disabled={idx === chain.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ApiKeys() {
  const [keys, setKeys]               = useState([]);
  const [alerts, setAlerts]           = useState([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [stats, setStats]             = useState(null);
  const [chain, setChain]             = useState(PROVIDERS);
  const [chainDirty, setChainDirty]   = useState(false);
  const [chainSaving, setChainSaving] = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [showChain, setShowChain]     = useState(false);
  const [editKey, setEditKey]         = useState(null);
  const [testing, setTesting]         = useState(null);
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [form, setForm] = useState({
    provider: 'gemini', label: '', key_value: '',
    daily_limit: 1500, monthly_limit: 45000,
  });

  // ── Load data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [keysRes, alertsRes, statsRes, orderRes] = await Promise.all([
        apiKeys.list().catch(() => ({ data: [] })),
        apiKeys.alerts().catch(() => ({ data: { alerts: [] } })),
        apiKeys.stats().catch(() => ({ data: null })),
        apiKeys.order().catch(() => ({ data: { chain: PROVIDERS } })),
      ]);
      setKeys(keysRes.data || []);
      setAlerts((alertsRes.data?.alerts) || []);
      setStats(statsRes.data || null);
      setChain((orderRes.data?.chain) || PROVIDERS);
      setError(null);
    } catch (err) {
      setError('Failed to load API keys. Check server connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleProviderChange = (provider) => {
    const info = PROVIDER_INFO[provider] || {};
    setForm(f => ({
      ...f, provider,
      daily_limit:   info.dailyDefault  || 1000,
      monthly_limit: info.monthlyDefault || 30000,
    }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    await apiKeys.create(form);
    setShowForm(false);
    setForm({ provider: 'gemini', label: '', key_value: '', daily_limit: 1500, monthly_limit: 45000 });
    load();
  };

  const handleEdit = async (id, payload) => {
    await apiKeys.update(id, payload);
    setEditKey(null);
    load();
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`Hapus key "${label}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await apiKeys.delete(id);
    load();
  };

  const handleTest = async (id) => {
    setTesting(id);
    setTestResults(t => ({ ...t, [id]: null }));
    try {
      const res = await apiKeys.test(id);
      setTestResults(t => ({ ...t, [id]: res.data }));
    } catch (err) {
      setTestResults(t => ({ ...t, [id]: { connected: false, error: err?.message || 'Unknown error' } }));
    }
    setTesting(null);
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await apiKeys.update(id, { status: newStatus });
    load();
  };

  const handleChainChange = (newChain) => {
    setChain(newChain);
    setChainDirty(true);
  };

  const handleSaveChain = async () => {
    setChainSaving(true);
    await apiKeys.saveOrder(chain);
    setChainDirty(false);
    setChainSaving(false);
    load();
  };

  // ── Grouped by provider ───────────────────────────────────────────────────
  const grouped = PROVIDERS.reduce((acc, p) => {
    acc[p] = keys.filter(k => k.provider === p);
    return acc;
  }, {});

  const totalActive   = keys.filter(k => k.status === 'active').length;
  const totalExhausted = keys.filter(k => k.status === 'exhausted').length;
  const totalWarning  = keys.filter(k => ['warning','critical'].includes(k.status)).length;
  const activeAlerts  = alerts.filter(a => !alertsDismissed);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Memuat API Keys...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Alerts ── */}
      {!alertsDismissed && activeAlerts.length > 0 && (
        <AlertBanner alerts={activeAlerts} onDismiss={() => setAlertsDismissed(true)} />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
          {error}
        </div>
      )}

      {/* ── Stats bar ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Keys', value: stats.total, color: 'text-gray-900' },
            { label: 'Active', value: stats.active, color: 'text-green-700' },
            { label: 'Warning/Critical', value: (parseInt(stats.warning)||0) + (parseInt(stats.critical)||0), color: 'text-yellow-700' },
            { label: 'Exhausted', value: stats.exhausted, color: 'text-red-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">
          API Keys
          <span className="ml-2 text-sm font-normal text-gray-500">{keys.length} key</span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowChain(s => !s); }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            ⛓ Fallback Chain
            {chainDirty && <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />}
          </button>
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            + Tambah Key
          </button>
        </div>
      </div>

      {/* ── Fallback Chain Editor ── */}
      {showChain && (
        <div className="mb-6">
          <FallbackChainEditor chain={chain} onChange={handleChainChange} />
          {chainDirty && (
            <div className="mt-2 flex gap-2 justify-end">
              <button
                onClick={() => { setChain(PROVIDERS); setChainDirty(false); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg"
              >
                Reset
              </button>
              <button
                onClick={handleSaveChain} disabled={chainSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                {chainSaving ? 'Menyimpan...' : 'Simpan Urutan'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Add Key Form ── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Tambah API Key Baru</h3>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Provider *</label>
                <select
                  value={form.provider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PROVIDERS.map(p => (
                    <option key={p} value={p}>{PROVIDER_INFO[p]?.name || p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Label</label>
                <input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${PROVIDER_INFO[form.provider]?.name} Key #1`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">API Key Value *</label>
                <input
                  type="password"
                  value={form.key_value}
                  onChange={e => setForm(f => ({ ...f, key_value: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-... atau AIza..."
                />
                <p className="text-xs text-gray-400 mt-1">Nilai key dienkripsi (AES-256-GCM) sebelum disimpan ke database.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Daily Limit <span className="font-normal text-gray-400">(default: {PROVIDER_INFO[form.provider]?.dailyDefault?.toLocaleString()})</span>
                </label>
                <input
                  type="number" min="1"
                  value={form.daily_limit}
                  onChange={e => setForm(f => ({ ...f, daily_limit: parseInt(e.target.value) || 1000 }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Monthly Limit <span className="font-normal text-gray-400">(default: {PROVIDER_INFO[form.provider]?.monthlyDefault?.toLocaleString()})</span>
                </label>
                <input
                  type="number" min="1"
                  value={form.monthly_limit}
                  onChange={e => setForm(f => ({ ...f, monthly_limit: parseInt(e.target.value) || 30000 }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                Simpan Key
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-5 py-2 rounded-lg transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ── */}
      {keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="text-5xl mb-4">🔑</div>
          <p className="text-gray-700 font-medium mb-1">Belum ada API Key</p>
          <p className="text-gray-500 text-sm mb-5">Tambahkan key dari 8 provider LLM yang tersedia untuk mulai menggunakan sistem.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg"
          >
            + Tambah Key Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {PROVIDERS.filter(p => grouped[p].length > 0).map(provider => {
            const providerKeys = grouped[provider];
            const info = PROVIDER_INFO[provider];
            const anyActive = providerKeys.some(k => k.status === 'active');

            return (
              <div key={provider} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Provider header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${anyActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <h3 className="font-semibold text-gray-800">{info?.name || provider}</h3>
                    <span className="text-xs text-gray-400">{providerKeys.length} key</span>
                  </div>
                  <div className="text-xs text-gray-400">Reset: {info?.resetLogic}</div>
                </div>

                {/* Keys table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Label', 'Status', 'Daily Usage', 'Monthly Usage', 'Freshness', 'Errors', 'Last Used', 'Reset At', 'Aksi'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50/50">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {providerKeys.map(k => {
                        const testResult = testResults[k.id];
                        const isTesting  = testing === k.id;

                        return (
                          <React.Fragment key={k.id}>
                            <tr className="hover:bg-gray-50/80 transition-colors">
                              {/* Label */}
                              <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px]">
                                <div className="truncate" title={k.label}>{k.label}</div>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[k.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {k.status}
                                </span>
                              </td>

                              {/* Daily Usage */}
                              <td className="px-4 py-3 w-36">
                                <UsageBar value={k.usage_today} limit={k.daily_limit} />
                              </td>

                              {/* Monthly Usage */}
                              <td className="px-4 py-3 w-36">
                                <UsageBar value={k.usage_this_month} limit={k.monthly_limit} colorize={false} />
                              </td>

                              {/* Freshness */}
                              <td className="px-4 py-3">
                                <FreshnessBar score={k.freshness_score || 0} />
                              </td>

                              {/* Error count */}
                              <td className="px-4 py-3 text-center">
                                {k.error_count > 0 ? (
                                  <span className="text-red-600 font-semibold text-xs" title={k.last_error}>
                                    {k.error_count}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">0</span>
                                )}
                              </td>

                              {/* Last used */}
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                {k.last_used_at
                                  ? new Date(k.last_used_at).toLocaleString('id-ID', {
                                      day: '2-digit', month: '2-digit',
                                      hour: '2-digit', minute: '2-digit',
                                    })
                                  : '—'}
                              </td>

                              {/* Reset at */}
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                {k.reset_at
                                  ? new Date(k.reset_at).toLocaleString('id-ID', {
                                      day: '2-digit', month: '2-digit',
                                      hour: '2-digit', minute: '2-digit',
                                    })
                                  : '—'}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => handleTest(k.id)}
                                    disabled={isTesting}
                                    className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors disabled:opacity-50"
                                  >
                                    {isTesting ? '⏳' : '▶ Test'}
                                  </button>
                                  <button
                                    onClick={() => setEditKey(k)}
                                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                                  >
                                    ✏ Edit
                                  </button>
                                  <button
                                    onClick={() => handleToggle(k.id, k.status)}
                                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                      k.status === 'active'
                                        ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700'
                                        : 'bg-green-50 hover:bg-green-100 text-green-700'
                                    }`}
                                  >
                                    {k.status === 'active' ? '⏸ Pause' : '▶ Aktifkan'}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(k.id, k.label)}
                                    className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Test result row */}
                            {testResult !== undefined && testResult !== null && (
                              <tr>
                                <td colSpan={9} className="px-4 pb-3 pt-0">
                                  <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${
                                    testResult.connected
                                      ? 'bg-green-50 text-green-700 border border-green-100'
                                      : 'bg-red-50 text-red-700 border border-red-100'
                                  }`}>
                                    {testResult.connected ? (
                                      <>
                                        <span className="font-bold">✓ Terhubung</span>
                                        <span>·</span>
                                        <span>{testResult.latencyMs}ms</span>
                                        <span>·</span>
                                        <span className="font-mono">{testResult.model}</span>
                                        <span>·</span>
                                        <span>{testResult.tokensUsed} tokens</span>
                                        {testResult.response && (
                                          <>
                                            <span>·</span>
                                            <span className="italic opacity-80">"{testResult.response}"</span>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <span className="font-bold">✗ Gagal</span>
                                        <span>·</span>
                                        <span>{testResult.error}</span>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editKey && (
        <EditKeyModal
          keyData={editKey}
          onSave={handleEdit}
          onClose={() => setEditKey(null)}
        />
      )}
    </div>
  );
}
