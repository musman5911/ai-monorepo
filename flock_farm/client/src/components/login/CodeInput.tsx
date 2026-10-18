import React from 'react';

export function CodeInput({ value, refs, onChange, onKey }: {
  value: string;
  setter: (v: string) => void;
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onChange: (idx: number, val: string) => void;
  onKey: (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const digits = value.split('');
  while (digits.length < 6) digits.push('');
  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-12 h-14 text-center text-2xl font-bold font-mono border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:border-farm-400 focus:ring-2 focus:ring-farm-100 dark:focus:ring-farm-900/40 focus:outline-none transition"
        />
      ))}
    </div>
  );
}
