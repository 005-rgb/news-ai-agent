import React, { useEffect, useState } from 'react';
import { rapat as rapatApi, calendar as calendarApi, sites as sitesApi } from '../lib/api';

export default function Rapat() {
  const [notes, setNotes] = useState([]);
  const [latest, setLatest] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [sites, setSites] = useState([]);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);

  const load = async () => {
    const [n, l, p, cal, sl] = await Promise.all([
      rapatApi.list().catch(()=>({data:[]})),
      rapatApi.latest().catch(()=>({data:null})),
      rapatApi.predictions().catch(()=>({data:[]})),
      calendarApi.list().catch(()=>({data:[]})),
      sitesApi.list().catch(()=>({data:[]})),
    ]);
    setNotes(n.data || []);
    setLatest(l.data);
    setPredictions(p.data || []);
    setCalendar(cal.data || []);
    setSites(sl.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleTrigger = async () => {
    if (!confirm('Jalankan Rapat Redaksi sekarang?')) return;
    setTriggering(true);
    const res = await rapatApi.trigger().catch(e=>({data:{message:e?.message||'Error'}}));
    setTriggerResult(res.data);
    setTriggering(false);
    load();
  };

  const STATUS_BADGE = { predicted:'bg-blue-100 text-blue-700', confirmed:'bg-green-100 text-green-700', missed:'bg-gray-100 text-gray-500' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Rapat Redaksi</h2>
        <button onClick={handleTrigger} disabled={triggering} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {triggering ? 'Menjalankan...' : '🎙 Trigger Rapat Sekarang'}
        </button>
      </div>

      {triggerResult && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm text-indigo-800">{triggerResult.message}</p>
          {triggerResult.note && <p className="text-xs text-indigo-600 mt-1">{triggerResult.note}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest notulen */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3">Notulen Terbaru</h3>
          {!latest ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm">Belum ada notulen rapat. Trigger rapat pertama untuk memulai.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium">📅 {latest.session_date}</span>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 text-sm whitespace-pre-line">
                {latest.summary || '(tidak ada ringkasan)'}
              </div>
            </div>
          )}

          {/* Archive */}
          {notes.length > 1 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2 text-sm">Archive Notulen</h4>
              <div className="space-y-2">
                {notes.slice(1).map(n => (
                  <div key={n.id} className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="font-medium text-gray-700">{n.session_date}</div>
                    <div className="text-gray-500 text-xs mt-1 line-clamp-2">{n.summary?.slice(0,150)||'—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: predictions + upcoming calendar */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Prediksi Tren</h3>
          {predictions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
              <div className="text-3xl mb-2">🔮</div>
              <p className="text-xs">Belum ada prediksi. Tersedia setelah Phase 9.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {predictions.slice(0,8).map(p => (
                <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-gray-800">{p.topic}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[p.status]||'bg-gray-100'}`}>{p.confidence_score ? `${(p.confidence_score*100).toFixed(0)}%` : p.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{p.category} · Peak: {p.predicted_peak_date||'TBD'}</div>
                </div>
              ))}
            </div>
          )}

          <h3 className="font-semibold text-gray-800 mt-6 mb-3">Content Calendar</h3>
          {calendar.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-xs">Calendar kosong. Buat entri baru atau trigger rapat.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {calendar.slice(0,8).map(c => (
                <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="text-sm font-medium text-gray-800 line-clamp-2">{c.topic}</div>
                  <div className="text-xs text-gray-500 mt-1">{c.site_name} · {c.scheduled_date||'Tanpa tanggal'}</div>
                  <div className="flex gap-1 mt-1">
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{c.format}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${c.status==='planned'?'bg-yellow-100 text-yellow-700':c.status==='done'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
