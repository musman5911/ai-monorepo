import { useEffect, useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { BookOpen, Save, Mic, Square, Trash2 } from 'lucide-react';
import { isVoiceSupported, startVoiceRecording, MAX_VOICE_SECONDS, VoiceRecorder } from '../muf/data/muf-voice';
import { notify } from '../muf/core/muf-confirm';
import { DiaryEntry, Lang } from '../types';
import { t } from '../i18n';
import { todayStr } from '../utils/calculations';
import MufDiaryMedia, { type DiaryPhoto } from '../muf/ui/muf-diary-media';
import { uploadImage } from '../api';

interface DiaryNotesProps {
  lang: Lang;
  entries: DiaryEntry[];
  onSave: (entry: DiaryEntry) => void;
  readOnly?: boolean;
}

export default function DiaryNotes({ lang, entries, onSave, readOnly }: DiaryNotesProps) {
  const today = todayStr();
  const existing = entries.find((e) => e.date === today);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [voiceBase64, setVoiceBase64] = useState<string | undefined>(existing?.voiceBase64);
  const [photos, setPhotos] = useState<DiaryPhoto[]>(existing?.photos || []);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);

  useEffect(() => {
    const found = entries.find((e) => e.date === date);
    setNote(found?.note ?? '');
    setVoiceBase64(found?.voiceBase64);
    setPhotos(found?.photos || []);
  }, [entries, date]);

  const loadDate = (d: string) => {
    setDate(d);
    const found = entries.find((e) => e.date === d);
    setNote(found?.note ?? '');
    setVoiceBase64(found?.voiceBase64);
    setPhotos(found?.photos || []);
  };

  const handleSave = () => {
    if (!note.trim() && !voiceBase64 && photos.length === 0) return;
    onSave({ date, note: note.trim(), voiceBase64, photos });
  };

  const handleRecordToggle = async () => {
    if (recording && recorder) {
      try {
        const base64 = await recorder.stop();
        setVoiceBase64(base64);
        onSave({ date, note: note.trim(), voiceBase64: base64, photos });
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
    try {
      const r = await startVoiceRecording(() => setRecording(false));
      setRecorder(r);
      setRecording(true);
    } catch {
      notify(L('Microphone permission is needed to record.'), 'error');
    }
  };

  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <BookOpen className="w-4 h-4" /> {t(lang, 'diary')}
      </h3>
      <div>
        <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">{L('Date')}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => loadDate(e.target.value)}
          className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl"
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={readOnly}
        placeholder={L('Weather, issues, observations…')}
        className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl h-24 resize-none"
      />
      <MufDiaryMedia date={date} photos={photos} canEdit={!readOnly} uploadPhoto={(file) => uploadImage(file, 'diary')} onChange={(next) => { setPhotos(next); onSave({ date, note: note.trim(), voiceBase64, photos: next }); }} />
      {/* ── Voice note (Urdu-friendly) — speak instead of typing ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-3xs font-bold text-slate-400 uppercase">🎙️ {L('Voice note')} <span className="normal-case font-normal">({L('max {MAX_VOICE_SECONDS}s', { MAX_VOICE_SECONDS: MAX_VOICE_SECONDS })})</span></p>
          {!readOnly && (
            <button
              type="button"
              onClick={handleRecordToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-3xs font-bold transition ${recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-farm-600 hover:bg-farm-700'}`}
            >
              {recording ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              {recording ? L('Stop & save') : (voiceBase64 ? L('Re-record') : L('Record'))}
            </button>
          )}
        </div>
        {voiceBase64 && (
          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <audio controls src={voiceBase64} className="flex-1 h-9" />
            {!readOnly && (
              <button
                type="button"
                onClick={() => { setVoiceBase64(undefined); onSave({ date, note: note.trim(), voiceBase64: undefined }); }}
                className="p-1.5 rounded text-slate-400 hover:text-red-500 transition"
                aria-label={L('Delete voice note')}
              ><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-xs font-semibold rounded-xl"
        >
          <Save className="w-4 h-4" /> {t(lang, 'save')}
        </button>
      )}
      {recent.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-3xs font-bold text-slate-400 uppercase">{L('Recent')}</p>
          {recent.map((e) => (
            <button
              key={e.date}
              type="button"
              onClick={() => loadDate(e.date)}
              className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-3xs"
            >
              <span className="font-mono text-slate-500">{e.date}</span>
              <p className="text-slate-700 dark:text-slate-200 truncate mt-0.5">{e.voiceBase64 ? '🎙️ ' : ''}{e.note || (e.voiceBase64 ? L('Voice note') : '')}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
