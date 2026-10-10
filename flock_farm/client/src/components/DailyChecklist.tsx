import { useEffect, useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { CHECKLIST_TASKS, DailyChecklistEntry, Lang } from '../types';
import { t, tChecklistTask } from '../i18n';
import { todayStr } from '../utils/calculations';

interface DailyChecklistProps {
  lang: Lang;
  entries: DailyChecklistEntry[];
  onSave: (entry: DailyChecklistEntry) => void;
  readOnly?: boolean;
}

export default function DailyChecklist({ lang, entries, onSave, readOnly }: DailyChecklistProps) {
  const today = todayStr();
  const entry = entries.find((e) => e.date === today) ?? { date: today, completed: [] };
  const [completed, setCompleted] = useState<string[]>(entry.completed);

  useEffect(() => {
    setCompleted(entry.completed);
  }, [entry.date, entry.completed]);

  const toggle = (taskId: string) => {
    if (readOnly) return;
    const next = completed.includes(taskId)
      ? completed.filter((id) => id !== taskId)
      : [...completed, taskId];
    setCompleted(next);
    onSave({ date: today, completed: next });
  };

  const doneCount = completed.length;
  const total = CHECKLIST_TASKS.length;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{t(lang, 'checklist')}</h3>
        <span className="text-3xs font-mono text-slate-400">{doneCount}/{total}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-600 rounded-full transition-all"
          style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
        />
      </div>
      <ul className="space-y-2">
        {CHECKLIST_TASKS.map((task) => {
          const done = completed.includes(task.id);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => toggle(task.id)}
                disabled={readOnly}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition ${
                  done
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                } ${readOnly ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-green-300'}`}
              >
                {done ? <CheckSquare className="w-4 h-4 shrink-0" /> : <Square className="w-4 h-4 shrink-0" />}
                {tChecklistTask(lang, task)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
