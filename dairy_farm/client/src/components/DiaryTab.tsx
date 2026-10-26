import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays, Mic, Square } from 'lucide-react';
import { api } from '../api';
import { L } from '../i18n';
import { notify } from '../muf/core/muf-confirm';
import { isVoiceSupported, startVoiceRecording, MAX_VOICE_SECONDS, type VoiceRecorder } from '../muf/data/muf-voice';
import type { ChecklistItem } from '../types';
import { useDebouncedSave } from '../useDebouncedSave';
import SaveIndicator from './SaveIndicator';
import MufDiaryMedia, { compressDiaryPhoto, type DiaryPhoto } from '../muf/ui/muf-diary-media';
import { todayStr, shiftDate } from '../utils/date';

const DEFAULT_CHECKLIST: Omit<ChecklistItem, 'done'>[] = [
  { id: 'morning-milking', text: 'Morning milking done' },
  { id: 'evening-milking', text: 'Evening milking done' },
  { id: 'feed-given',      text: 'Feed given' },
  { id: 'water-checked',   text: 'Water checked / refilled' },
  { id: 'health-check',    text: 'Checked for signs of illness' },
  { id: 'cleaning',        text: 'Shed cleaned' },
];

function newItemId(): string {
  return 'item-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface DiaryTabProps { checklistOnly?: boolean; }

export default function DiaryTab({ checklistOnly = false }: DiaryTabProps) {
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [newItemText, setNewItemText] = useState('');
  interface VoiceNote { id: string; base64: string; createdAt: string; }
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [photos, setPhotos] = useState<DiaryPhoto[]>([]);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  // Load the log whenever the selected date changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getDailyLog(date).then((log) => {
      if (cancelled) return;
      if (!log.checklist || log.checklist.length === 0) {
        setChecklist(DEFAULT_CHECKLIST.map(i => ({ ...i, done: false })));
      } else {
        setChecklist(log.checklist);
      }
      setNotes(log.notes || '');
      setVoiceNotes(log.voiceNotes || []);
      setPhotos(log.photos || []);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [date]);

  // Combine checklist + notes into one payload for autosave
  const payload = useMemo(() => ({ checklist, notes, voiceNotes, photos }), [checklist, notes, voiceNotes, photos]);

  const saveFn = useCallback((p: { checklist: ChecklistItem[]; notes: string; voiceNotes: VoiceNote[]; photos: DiaryPhoto[] }) => {
    return api.saveDailyLog(date, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const status = useDebouncedSave(payload, saveFn, 800);

  function toggleItem(id: string) {
    setChecklist(list => list.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }

  function removeItem(id: string) {
    setChecklist(list => list.filter(i => i.id !== id));
  }

  function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    setChecklist(list => [...list, { id: newItemId(), text, done: false }]);
    setNewItemText('');
  }

  async function handleRecordToggle() {
    if (recording && recorder) {
      try {
        const base64 = await recorder.stop();
        setVoiceNotes((v) => [...v, { id: `vn-${Date.now()}`, base64, createdAt: new Date().toISOString() }]);
        notify(L('Voice note saved.'));
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Recording failed', 'error');
      } finally {
        setRecorder(null);
        setRecording(false);
      }
      return;
    }
    if (!isVoiceSupported()) { notify(L('This browser cannot record audio.'), 'error'); return; }
    if (voiceNotes.length >= 3) { notify(L('Maximum 3 voice notes per day.'), 'error'); return; }
    try {
      const r = await startVoiceRecording(() => setRecording(false));
      setRecorder(r);
      setRecording(true);
    } catch {
      notify(L('Microphone permission is needed to record.'), 'error');
    }
  }

  function shiftDateLocal(days: number) {
    setDate(d => shiftDate(d, days));
  }

  const doneCount = checklist.filter(i => i.done).length;

  return (
    <div className="space-y-6 tab-panel">
      {/* Date navigation + save status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDateLocal(-1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            onClick={() => shiftDateLocal(1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {date !== todayStr() && (
            <button
              onClick={() => setDate(todayStr())}
              className="text-xs font-medium text-farm-600 hover:text-farm-700 px-2"
            >
              {L('Today')}
            </button>
          )}
        </div>
        <SaveIndicator status={status} />
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">{L('Loading...')}</div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${checklistOnly ? '' : 'lg:grid-cols-2 lg:gap-6'}`}>
          {/* Checklist */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{L('Daily Checklist')}</h3>
              <span className="text-xs text-slate-400">{doneCount}/{checklist.length} done</span>
            </div>

            <div className="space-y-2">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-3 group">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 accent-farm-600 shrink-0"
                  />
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="text-sm text-slate-400 py-4 text-center">No checklist items — add one below.</p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                placeholder={L('Add a task...')}
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
              />
              <button
                onClick={addItem}
                className="bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {!checklistOnly && (
          <>
          {/* Legacy Notes editor remains available in the original tab only. */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">{L('Notes / Diary')}</h3>
            <textarea
              rows={12}
              placeholder="Anything worth remembering about today — weather, a cow acting off, a visitor, feed delivery, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-2">{L('Saves automatically as you type.')}</p>
            <MufDiaryMedia date={date} photos={photos} onChange={setPhotos} uploadPhoto={async (file) => { const compressed = await compressDiaryPhoto(file); const saved = await api.uploadPhoto(compressed.data); return saved.path; }} resolvePhotoUrl={api.getPhotoObjectUrl} />

            {/* ── Voice notes (Urdu-friendly) — record instead of typing ── */}
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🎙️ {L('Voice notes')} <span className="text-slate-400 font-normal">({voiceNotes.length}/3 · {L('max {MAX_VOICE_SECONDS}s each', { MAX_VOICE_SECONDS: MAX_VOICE_SECONDS })})</span></p>
                <button
                  onClick={handleRecordToggle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition ${recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-farm-600 hover:bg-farm-700'}`}
                >
                  {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {recording ? L('Stop & save') : L('Record')}
                </button>
              </div>
              {voiceNotes.map((v) => (
                <div key={v.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <audio controls src={v.base64} className="flex-1 h-9" />
                  <button onClick={() => setVoiceNotes((list) => list.filter((x) => x.id !== v.id))} className="p-1.5 rounded text-slate-400 hover:text-red-500 transition" aria-label={L('Delete voice note')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {voiceNotes.length === 0 && !recording && (
                <p className="text-[11px] text-slate-400 italic">{L('Press Record and speak in any language — easier than typing.')}</p>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
