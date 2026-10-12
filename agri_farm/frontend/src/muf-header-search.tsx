// muf shared global search — one box, find anything (muf-search does the ranking).
// Apps pass either pre-built `items` (prop-driven) or a lazy `loadItems` loader;
// `onPick` routes the click (tab switch or detail popup — app-specific).
// Keyboard: ↓ / ↑ move through results, Enter opens the highlighted one, Esc closes.
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { mufSearch, type MufSearchItem } from './muf-search';
import { mufL } from './muf-urdu';

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
  const L = (en: string) => mufL(lang, en);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
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
    function onDoc(e: Event) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  const results = mufSearch(allItems, query);
  const safeActive = Math.min(active, Math.max(0, results.length - 1));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  function closeAll() {
    setOpen(false);
    setMobile(false);
    setQuery('');
  }

  function pick(item: MufSearchItem) {
    closeAll();
    onPick(item);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); closeAll(); return; }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((safeActive + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive((safeActive - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && query) { e.preventDefault(); pick(results[safeActive]); }
  }

  const resultsList = (
    <div id={listId} role="listbox" aria-label={L('Search')}>
      {results.length === 0 && <p className="muf-search-empty" role="status">{L('Nothing found.')}</p>}
      {results.map((r, i) => (
        <button
          key={`${r.type}-${r.id}`}
          id={optionId(i)}
          role="option"
          aria-selected={i === safeActive}
          type="button"
          tabIndex={-1}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(r)}
          className={`muf-search-option ${i === safeActive ? 'is-active' : ''}`}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="muf-search-option-label">{r.label}</span>
          <span className="muf-search-option-sub">{r.sub}</span>
        </button>
      ))}
    </div>
  );

  const comboProps = {
    role: 'combobox' as const,
    'aria-expanded': open && !!query,
    'aria-controls': listId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': results.length && query ? optionId(safeActive) : undefined,
  };

  return (
    <div ref={boxRef} className="relative">
      {/* Desktop: inline search box beside the theme toggle */}
      <div className="muf-search-box hidden sm:flex">
        <Search size={15} className="muf-search-icon" aria-hidden="true" />
        <input
          {...comboProps}
          value={query}
          onFocus={() => { setOpen(true); ensureLoaded(); }}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={L('Search')}
          aria-label={L('Search')}
          className="muf-search-input"
        />
      </div>
      {open && query && (
        <div className="muf-search-dropdown hidden sm:block">
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
          aria-label={L('Search')}
          aria-expanded={mobile}
        >
          <Search size={17} />
        </button>
        {mobile && (
          <div className="muf-search-mobile sm:hidden">
            <div className="muf-search-mobile-bar">
              <Search size={16} className="muf-search-icon" aria-hidden="true" />
              <input
                {...comboProps}
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder={L('Search')}
                aria-label={L('Search')}
                className="muf-search-input muf-search-input-mobile"
              />
              <button type="button" onClick={closeAll} className="muf-icon-plain" aria-label={L('Close')}>
                <X size={16} />
              </button>
            </div>
            {query && <div className="muf-search-mobile-list">{resultsList}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
