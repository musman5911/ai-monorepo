// muf shared global search — one box, find anything (muf-search does the ranking).
// Apps pass either pre-built `items` (prop-driven) or a lazy `loadItems` loader;
// `onPick` routes the click (tab switch or detail popup — app-specific).
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { mufSearch, type MufSearchItem } from './muf-search';
import { mufUr } from './muf-urdu';

interface MufHeaderSearchProps {
  lang: 'en' | 'ur' | 'roman';
  /** Pre-built search items (recomputed by the app on each render). */
  items?: MufSearchItem[];
  /** Lazy loader for apps that fetch their own index (called once, on first focus). */
  loadItems?: () => Promise<MufSearchItem[]>;
  /** What happens when a result is clicked (app routes: tab or popup). */
  onPick: (item: MufSearchItem) => void;
}

export default function HeaderSearch({ lang, items, loadItems, onPick }: MufHeaderSearchProps) {
  const L = (en: string, ur?: string) => (lang === 'ur' ? (ur || mufUr(en)) : en);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteItems, setRemoteItems] = useState<MufSearchItem[]>([]);
  const loaded = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const allItems = items !== undefined ? items : remoteItems;

  function ensureLoaded() {
    if (items !== undefined || loaded.current || !loadItems) return;
    loaded.current = true;
    loadItems().then(setRemoteItems).catch(() => { /* search simply shows nothing */ });
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const results = mufSearch(allItems, query);

  function pick(item: MufSearchItem) {
    setOpen(false);
    setMobile(false);
    setQuery('');
    onPick(item);
  }

  const resultsList = (
    <>
      {results.length === 0 && <p className="p-3 text-xs text-slate-400">{L('Nothing found.')}</p>}
      {results.map((r) => (
        <button key={`${r.type}-${r.id}`} onClick={() => pick(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition">
          <span>{r.emoji}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{r.label}</span>
          <span className="text-slate-400 truncate ml-auto">{r.sub}</span>
        </button>
      ))}
    </>
  );

  return (
    <div ref={boxRef} className="relative">
      {/* Desktop: inline search box beside the theme toggle */}
      <div className="hidden sm:flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white/70 dark:bg-slate-900/70">
        <Search size={15} className="text-slate-400 shrink-0" />
        <input
          value={query}
          onFocus={() => { setOpen(true); ensureLoaded(); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={L('Search…')}
          className="w-28 lg:w-40 bg-transparent outline-none text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
        />
      </div>
      {open && query && (
        <div className="hidden sm:block absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-[300]">
          {resultsList}
        </div>
      )}

      {/* Mobile: search icon opens a full-width panel under the header.
          Wrapped in a plain sm:hidden div — .muf-icon-button sets its own
          display and would override sm:hidden on the button itself. */}
      <div className="sm:hidden">
      <button
        type="button"
        onClick={() => { setMobile(!mobile); setOpen(true); ensureLoaded(); }}
        className="muf-icon-button"
        aria-label={L('Search…')}
      >
        <Search size={17} />
      </button>
      {mobile && (
        <div className="sm:hidden fixed left-2 right-2 top-16 z-[var(--muf-z-search)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L('Search…')}
              className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            <button type="button" onClick={() => { setMobile(false); setQuery(''); }} className="text-slate-400 text-lg leading-none px-1" aria-label="Close">✕</button>
          </div>
          {query && <div className="max-h-72 overflow-y-auto">{resultsList}</div>}
        </div>
      )}
      </div>
    </div>
  );
}
