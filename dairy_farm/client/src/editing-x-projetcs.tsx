import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './muf-style.css';
import './muf-workbench.css';

/**
 * Development-only MUF visual builder. This local editor is deliberately
 * data-free: it previews approved visual primitives and exports reviewable
 * files. It never writes application source, APIs, or production styles.
 */
type Kind = 'popup' | 'heading' | 'card' | 'button' | 'form';
type Density = 'comfortable' | 'compact';
type Surface = 'surface' | 'surface-alt' | 'primary';
type Accent = 'primary' | 'success' | 'warning' | 'danger';
type Block = {
  id: string;
  kind: Kind;
  title: string;
  subtitle: string;
  body: string;
  size: 'small' | 'large';
  density: Density;
  surface: Surface;
  radius: number;
  padding: number;
  gap: number;
  fontSize: number;
  accent: Accent;
};
type Design = { blocks: Block[] };
type Device = 'phone' | 'tablet' | 'desktop';

const draftKey = 'muf-visual-workbench-draft-v2';
const kindLabels: Record<Kind, string> = {
  popup: 'Popup shell', heading: 'Heading', card: 'Card', button: 'Button', form: 'Form'
};
const surfaceTokens: Record<Surface, string> = {
  surface: 'var(--muf-color-surface, #fffefb)',
  'surface-alt': 'var(--muf-color-surface-alt, #f1f5f9)',
  primary: 'var(--muf-color-primary, #136334)'
};
const accentTokens: Record<Accent, string> = {
  primary: 'var(--muf-color-primary, #136334)',
  success: 'var(--muf-color-success, #16a34a)',
  warning: 'var(--muf-color-warning, #d97706)',
  danger: 'var(--muf-color-danger, #dc2626)'
};
let idCounter = 0;
const newId = (kind: Kind) => `${kind}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
const makeBlock = (kind: Kind): Block => ({
  id: newId(kind), kind,
  title: kind === 'popup' ? 'Popup preview' : kindLabels[kind],
  subtitle: 'MUF shared component',
  body: 'Sample preview content only. This workbench never loads or changes live farm data.',
  size: kind === 'popup' ? 'large' : 'small',
  density: 'comfortable', surface: kind === 'button' ? 'primary' : 'surface',
  radius: 16, padding: 18, gap: 10, fontSize: 14, accent: 'primary'
});
const initialDesign: Design = {
  blocks: [
    { ...makeBlock('heading'), title: 'Component preview', subtitle: 'A small MUF design canvas', body: '' },
    makeBlock('popup'),
    { ...makeBlock('card'), title: 'Summary card', body: 'Edit the visual properties in the inspector. Data here is sample content.' },
    { ...makeBlock('button'), title: 'Save changes', body: 'Preview action only. No application action is connected.' }
  ]
};
const cloneDesign = (value: Design): Design => ({ blocks: value.blocks.map(block => ({ ...block })) });
const isKind = (value: unknown): value is Kind => typeof value === 'string' && value in kindLabels;
const isDesign = (value: unknown): value is Design => {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Design).blocks)) return false;
  return (value as Design).blocks.every(block =>
    block && typeof block.id === 'string' && isKind(block.kind) &&
    typeof block.title === 'string' && typeof block.body === 'string' &&
    ['small', 'large'].includes(block.size) &&
    ['comfortable', 'compact'].includes(block.density) &&
    ['surface', 'surface-alt', 'primary'].includes(block.surface) &&
    ['primary', 'success', 'warning', 'danger'].includes(block.accent)
  );
};
const safeLoadDraft = (): Design => {
  try {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return cloneDesign(initialDesign);
    const parsed: unknown = JSON.parse(saved);
    return isDesign(parsed) ? cloneDesign(parsed) : cloneDesign(initialDesign);
  } catch {
    return cloneDesign(initialDesign);
  }
};

function MUFVisualWorkbench() {
  const [design, setDesign] = useState<Design>(safeLoadDraft);
  const [history, setHistory] = useState<Design[]>(() => [safeLoadDraft()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>(() => safeLoadDraft().blocks[0]?.id || '');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('phone');
  const [baseline, setBaseline] = useState<Design>(() => cloneDesign(safeLoadDraft()));
  const [compare, setCompare] = useState(false);
  const [darkPreview, setDarkPreview] = useState(false);
  const [notice, setNotice] = useState('Changes stay in this browser until you export them.');

  const selected = design.blocks.find(block => block.id === selectedId) || design.blocks[0];
  const commitDesign = (next: Design) => {
    setDesign(next);
    setHistory(old => [...old.slice(0, historyIndex + 1), cloneDesign(next)].slice(-60));
    setHistoryIndex(old => Math.min(old + 1, 59));
    if (!next.blocks.some(block => block.id === selectedId)) setSelectedId(next.blocks[0]?.id || '');
  };
  const updateSelected = (patch: Partial<Block>) => {
    if (!selected) return;
    commitDesign({ blocks: design.blocks.map(block => block.id === selected.id ? { ...block, ...patch } : block) });
  };
  const undo = () => {
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
    setHistoryIndex(index); setDesign(cloneDesign(history[index]));
    setSelectedId(history[index].blocks[0]?.id || '');
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const index = historyIndex + 1;
    setHistoryIndex(index); setDesign(cloneDesign(history[index]));
    setSelectedId(history[index].blocks[0]?.id || '');
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (typing || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(design)); }
    catch { /* Browser storage may be disabled; explicit export remains available. */ }
  }, [design]);

  const addBlock = (kind: Kind) => {
    const block = makeBlock(kind);
    const next = { blocks: [...design.blocks, block] };
    commitDesign(next); setSelectedId(block.id); setNotice(`${kindLabels[kind]} added to the local canvas.`);
  };
  const removeSelected = () => {
    if (!selected) return;
    const next = { blocks: design.blocks.filter(block => block.id !== selected.id) };
    commitDesign(next);
    setSelectedId(next.blocks[Math.max(0, design.blocks.findIndex(block => block.id === selected.id) - 1)]?.id || next.blocks[0]?.id || '');
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: newId(selected.kind), title: `${selected.title} copy` };
    const index = design.blocks.findIndex(block => block.id === selected.id);
    const next = [...design.blocks]; next.splice(index + 1, 0, copy);
    commitDesign({ blocks: next }); setSelectedId(copy.id);
  };
  const moveBlock = (id: string, offset: number) => {
    const from = design.blocks.findIndex(block => block.id === id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= design.blocks.length) return;
    const next = [...design.blocks]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
    commitDesign({ blocks: next });
  };
  const moveBlockBefore = (movingId: string, targetId: string) => {
    if (movingId === targetId) return;
    const next = [...design.blocks];
    const from = next.findIndex(block => block.id === movingId);
    const target = next.findIndex(block => block.id === targetId);
    if (from < 0 || target < 0) return;
    const [item] = next.splice(from, 1);
    const insertion = next.findIndex(block => block.id === targetId);
    next.splice(insertion, 0, item);
    commitDesign({ blocks: next }); setNotice('Canvas order updated.');
  };
  const saveDraft = () => {
    try { localStorage.setItem(draftKey, JSON.stringify(design)); setNotice('Design saved in this browser.'); }
    catch { setNotice('Browser storage is unavailable. Use Export JSON instead.'); }
  };
  const download = (filename: string, type: string, contents: string) => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const exportJson = () => {
    download('muf-workbench-design.json', 'application/json;charset=utf-8', JSON.stringify({ version: 2, source: 'muf-visual-workbench', design }, null, 2));
    setNotice('Design JSON exported. It was not applied to the app.');
  };
  const css = useMemo(() => {
    const escapeComment = (value: string) => value.replace(/[*\\/]/g, '').slice(0, 80);
    return [
      '/* Review this MUF design patch before applying it. Export never changes production files. */',
      ...design.blocks.map((block, index) => {
        const pad = block.density === 'compact' ? Math.max(8, Math.round(block.padding * 0.75)) : block.padding;
        const gap = block.density === 'compact' ? Math.max(4, Math.round(block.gap * 0.75)) : block.gap;
        const width = block.kind === 'popup' ? (block.size === 'small' ? '28rem' : '42rem') : '100%';
        return `.muf-workbench-block--${index + 1} {\n` +
          `  width: min(100%, ${width});\n  box-sizing: border-box;\n  border: 1px solid ${accentTokens[block.accent]};\n` +
          `  border-radius: ${block.radius}px;\n  padding: ${pad}px;\n  gap: ${gap}px;\n  font-size: ${block.fontSize}px;\n` +
          `  background: ${surfaceTokens[block.surface]};\n  overflow-wrap: anywhere;\n}\n/* ${escapeComment(block.title)} */`;
      })
    ].join('\n\n');
  }, [design]);
  const exportCss = () => {
    download('muf-workbench-style-patch.css', 'text/css;charset=utf-8', css);
    setNotice('CSS patch exported for review. No production stylesheet changed.');
  };
  const previewStyle = (block: Block): React.CSSProperties => ({
    '--muf-wb-radius': `${block.radius}px`,
    '--muf-wb-padding': `${block.density === 'compact' ? Math.max(8, Math.round(block.padding * 0.75) : block.padding}px`,
    '--muf-wb-gap': `${block.density === 'compact' ? Math.max(4, Math.round(block.gap * 0.75)) : block.gap}px`,
    '--muf-wb-font-size': `${block.fontSize}px`,
    '--muf-wb-surface': surfaceTokens[block.surface],
    '--muf-wb-accent': accentTokens[block.accent],
    '--muf-wb-max-width': block.kind === 'popup' ? (block.size === 'small' ? '28rem' : '42rem') : '100%'
  } as React.CSSProperties);
  const renderBlock = (block: Block, index: number, isBaseline = false) => (
    <section
      key={`${isBaseline ? 'baseline-' : ''}${block.id}`}
      className={`muf-wb-sample ${block.kind === 'button' ? 'muf-wb-sample--button' : ''} ${!isBaseline && selectedId === block.id ? 'is-selected' : ''}`}
      style={previewStyle(block)}
      aria-label={`${kindLabels[block.kind]} preview`}
      onClick={!isBaseline ? () => setSelectedId(block.id) : undefined}
      role={!isBaseline ? 'button' : undefined}
      tabIndex={!isBaseline ? 0 : undefined}
      onKeyDown={!isBaseline ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(block.id); } } : undefined}
      draggable={!isBaseline}
      onDragStart={!isBaseline ? () => setDraggingId(block.id) : undefined}
      onDragOver={!isBaseline ? event => event.preventDefault() : undefined}
      onDrop={!isBaseline ? event => { event.preventDefault(); if (draggingId) moveBlockBefore(draggingId, block.id); setDraggingId(null); } : undefined}
      onDragEnd={!isBaseline ? () => setDraggingId(null) : undefined}
    >
      <div className="muf-wb-sample__meta">
        <span>{kindLabels[block.kind]}</span>
        {block.kind === 'popup' && <span>{block.size === 'large' ? 'Large shell' : 'Small shell'}</span>}
        <span>{block.density}</span>
      </div>
      {(block.kind === 'popup' || block.kind === 'heading') && <header className="muf-wb-sample__heading">
        <strong>{block.title}</strong>
        {block.kind === 'popup' && <span>{block.subtitle}</span>}
      </header>}
      {block.kind === 'card' && <strong className="muf-wb-sample__title">{block.title}</strong>}
      {(block.kind === 'popup' || block.kind === 'card' || block.kind === 'form') && <p className="muf-wb-sample__body">{block.body}</p>}
      {block.kind === 'form' && <label className="muf-wb-sample__field">Sample field<input placeholder="Preview only" aria-label="Preview-only form field" /></label>}
      {block.kind === 'button' && <button className="muf-wb-sample__action" type="button" onClick={event => { event.stopPropagation(); setNotice('Preview-only button clicked. No application action was executed.'); }}>{block.title || 'Preview action'}</button>}
      {!isBaseline && <div className="muf-wb-sample__reorder">
        <button type="button" aria-label="Move component up" disabled={index === 0} onClick={event => { event.stopPropagation(); moveBlock(block.id, -1); }}>↑</button>
        <button type="button" aria-label="Move component down" disabled={index === design.blocks.length - 1} onClick={event => { event.stopPropagation(); moveBlock(block.id, 1); }}>↓</button>
      </div>}
    </section>
  );
  const deviceWidth: Record<Device, number> = { phone: 360, tablet: 768, desktop: 1120 };

  return <main className={`muf-workbench ${darkPreview ? 'muf-workbench--dark' : ''}`}>
    <div className="muf-wb-layout">
      <header className="muf-wb-topbar muf-panel">
        <div>
          <p className="muf-wb-eyebrow">MU F DESIGN SYSTEM / DEVELOPMENT TOOL</p>
          <h1>Visual workbench</h1>
          <p className="muf-wb-subtext">A local canvas for approved MUF primitives. Nothing here writes to production.</p>
        </div>
        <div className="muf-wb-toolbar">
          <button className="muf-wb-button muf-wb-button--quiet" onClick={undo} disabled={historyIndex <= 0}>Undo</button>
          <button className="muf-wb-button muf-wb-button--quiet" onClick={redo} disabled={historyIndex >= history.length - 1}>Redo</button>
          <button className="muf-wb-button" onClick={saveDraft}>Save draft</button>
          <button className="muf-wb-button" onClick={exportCss}>Export CSS</button>
          <button className="muf-wb-button" onClick={exportJson}>Export JSON</button>
        </div>
      </header>

      <div className="muf-wb-columns">
        <aside className="muf-panel muf-wb-panel">
          <h2>Component library</h2>
          <p className="muf-wb-subtext">Add a preview block to the canvas.</p>
          <div className="muf-wb-palette">
            {(['popup', 'heading', 'card', 'button', 'form'] as const).map(kind =>
              <button key={kind} className="muf-wb-button muf-wb-button--outline" onClick={() => addBlock(kind)}>+ {kindLabels[kind]}</button>
            )}
          </div>
          <div className="muf-wb-divider" />
          <div className="muf-wb-section-title"><h2>Canvas structure</h2><span>{design.blocks.length} blocks</span></div>
          <div className="muf-wb-layer-list">
            {design.blocks.map((block, index) => <button key={block.id} className={`muf-wb-layer ${selected?.id === block.id ? 'is-active' : ''}`} onClick={() => setSelectedId(block.id)}>
              <span className="muf-wb-layer-index">{index + 1}</span><span className="muf-wb-layer-name"><strong>{block.title || kindLabels[block.kind]}</strong><small>{kindLabels[block.kind]}</small></span>
            </button>)}
            {design.blocks.length === 0 && <p className="muf-wb-subtext">Canvas empty. Add a component above.</p>}
          </div>
          {selected && <>
            <div className="muf-wb-divider" />
            <div className="muf-wb-section-title"><h2>Inspector</h2><span>{kindLabels[selected.kind]}</span></div>
            <label className="muf-wb-field">Title<input value={selected.title} onChange={event => updateSelected({ title: event.target.value })} /></label>
            <label className="muf-wb-field">Subtitle<input value={selected.subtitle} onChange={event => updateSelected({ subtitle: event.target.value })} /></label>
            <label className="muf-wb-field">Sample body<textarea rows={3} value={selected.body} onChange={event => updateSelected({ body: event.target.value })} /></label>
            <div className="muf-wb-field-grid">
              <label className="muf-wb-field">Popup size<select value={selected.size} onChange={event => updateSelected({ size: event.target.value as Block['size'] })}><option value="small">Small</option><option value="large">Large</option></select></label>
              <label className="muf-wb-field">Density<select value={selected.density} onChange={event => updateSelected({ density: event.target.value as Density })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
              <label className="muf-wb-field">Surface<select value={selected.surface} onChange={event => updateSelected({ surface: event.target.value as Surface })}><option value="surface">Surface</option><option value="surface-alt">Alternate</option><option value="primary">Primary</option></select></label>
              <label className="muf-wb-field">Accent<select value={selected.accent} onChange={event => updateSelected({ accent: event.target.value as Accent })}><option value="primary">Primary</option><option value="success">Success</option><option value="warning">Warning</option><option value="danger">Danger</option></select></label>
            </div>
            {([
              ['radius', 'Corner radius', 0, 32, 1], ['padding', 'Padding', 8, 32, 2],
              ['gap', 'Gap', 4, 24, 1], ['fontSize', 'Font size', 11, 22, 1]
            ] as const).map(([key, label, min, max, step]) => <label key={key} className="muf-wb-field muf-wb-range">{label}<output>{selected[key]}px</output><input type="range" min={min} max={max} step={step} value={selected[key]} onChange={event => updateSelected({ [key]: Number(event.target.value) } as Partial<Block>)} /></label>)}
            <div className="muf-wb-toolbar">
              <button className="muf-wb-button muf-wb-button--quiet" onClick={duplicateSelected}>Duplicate</button>
              <button className="muf-wb-button muf-wb-button--danger" onClick={removeSelected}>Remove</button>
            </div>
          </>}
        </aside>

        <section className="muf-wb-workspace">
          <div className="muf-panel muf-wb-devicebar">
            <strong>Responsive preview</strong>
            <div className="muf-wb-toolbar">
              {(['phone', 'tablet', 'desktop'] as const).map(value => <button key={value} className={`muf-wb-button ${device === value ? '' : 'muf-wb-button--quiet'}`} onClick={() => setDevice(value)}>{value}</button>)}
              <button className="muf-wb-button muf-wb-button--quiet" onClick={() => setDarkPreview(value => !value)}>{darkPreview ? 'Light preview' : 'Dark preview'}</button>
              <label className="muf-wb-check"><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} /> Compare</label>
              <button className="muf-wb-button muf-wb-button--quiet" onClick={() => { setBaseline(cloneDesign(design)); setNotice('Comparison baseline updated.'); }}>Set baseline</button>
            </div>
          </div>
          <div className="muf-wb-viewport">
            <div className="muf-wb-device" style={{ '--muf-wb-device-width': `${deviceWidth[device]}px` } as React.CSSProperties}>
              <div className="muf-wb-device__label">{device} preview · {deviceWidth[device]}px</div>
              <div className="muf-wb-canvas">{design.blocks.map(renderBlock)}</div>
            </div>
            {compare && <div className="muf-wb-device muf-wb-device--baseline" style={{ '--muf-wb-device-width': `${deviceWidth[device]}px` } as React.CSSProperties}>
              <div className="muf-wb-device__label">baseline</div><div className="muf-wb-canvas">{baseline.blocks.map((block, index) => renderBlock(block, index, true))}</div>
            </div>}
          </div>
          <section className="muf-panel muf-wb-export">
            <div className="muf-wb-section-title"><h2>Export preview</h2><span>Manual review required</span></div>
            <pre>{css}</pre>
            <p role="status" aria-live="polite" className="muf-wb-notice">{notice}</p>
            <p className="muf-wb-subtext">Keyboard shortcuts: Ctrl/⌘+Z undo · Ctrl/⌘+Y or Shift+Z redo. Exports are files only; they are never automatically applied.</p>
          </section>
        </section>
      </div>
    </div>
  </main>;
}

const mount = document.getElementById('muf-workbench-root');
if (mount) createRoot(mount).render(<React.StrictMode><MUFVisualWorkbench /></React.StrictMode>);
export default MUFVisualWorkbench;
