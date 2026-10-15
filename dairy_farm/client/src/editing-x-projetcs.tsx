import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './muf-style.css';

/**
 * Development-only MUF visual workbench. It edits a constrained style schema,
 * never application data or production source. Drafts stay in this browser;
 * exports are reviewable CSS/token patches and are never auto-applied.
 */
type Kind = 'popup' | 'heading' | 'card' | 'button' | 'form';
type Spec = {
  kind: Kind;
  title: string;
  subtitle: string;
  body: string;
  size: 'small' | 'large';
  density: 'comfortable' | 'compact';
  surface: 'surface' | 'surface-alt' | 'primary';
  radius: number;
  padding: number;
  gap: number;
  fontSize: number;
  accent: 'primary' | 'success' | 'warning' | 'danger';
};
type Snapshot = { label: string; spec: Spec };
const initial: Spec = {
  kind: 'popup', title: 'Popup preview', subtitle: 'MUF shared component', body: 'Use real app data in production. This workbench contains only sample preview text.', size: 'large',
  density: 'comfortable', surface: 'surface', radius: 16, padding: 18, gap: 10, fontSize: 14, accent: 'primary'
};
const accentTokens: Record<Spec['accent'], string> = {
  primary: 'var(--muf-color-primary)', success: 'var(--muf-color-success)',
  warning: 'var(--muf-color-warning)', danger: 'var(--muf-color-danger)'
};
const surfaceTokens: Record<Spec['surface'], string> = {
  surface: 'var(--muf-color-surface, #fffefb)',
  'surface-alt': 'var(--muf-color-surface-alt, #f1f5f9)',
  primary: 'var(--muf-color-primary, #136334)'
};
const clone = (s: Spec): Spec => ({ ...s });
const draftKey = 'muf-visual-workbench-draft-v1';

function MUFVisualWorkbench() {
  const [spec, setSpec] = useState<Spec>(() => {
    try { const raw = localStorage.getItem(draftKey); return raw ? { ...initial, ...JSON.parse(raw) } : clone(initial); }
    catch { return clone(initial); }
  });
  const [history, setHistory] = useState<Spec[]>([clone(spec)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('phone');
  const [compare, setCompare] = useState(false);
  const [baseline, setBaseline] = useState<Spec>(() => clone(initial));
  const [notice, setNotice] = useState('Draft stays local until you export it.');
  const update = (patch: Partial<Spec>) => {
    const next = { ...spec, ...patch };
    setSpec(next);
    setHistory((old) => [...old.slice(0, historyIndex + 1), clone(next)].slice(-60));
    setHistoryIndex((old) => Math.min(old + 1, 59));
  };
  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex); setSpec(clone(history[nextIndex]));
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex); setSpec(clone(history[nextIndex]));
  };
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(spec)); } catch { /* Private browsing may block storage. */ } }, [spec]);
  const css = useMemo(() => {
    const className = 'muf-workbench-preview';
    const padding = spec.density === 'compact' ? Math.max(8, Math.round(spec.padding * 0.75)) : spec.padding;
    const gap = spec.density === 'compact' ? Math.max(4, Math.round(spec.gap * 0.75)) : spec.gap;
    const width = spec.kind === 'popup' ? (spec.size === 'small' ? '28rem' : '42rem') : '100%';
    return `/* Review this patch before applying it to muf-style.css. */\n.${className} {\n  width: min(100%, ${width});\n  border-radius: ${spec.radius}px;\n  padding: ${padding}px;\n  gap: ${gap}px;\n  font-size: ${spec.fontSize}px;\n  background: ${surfaceTokens[spec.surface]};\n  border-color: ${accentTokens[spec.accent]};\n}\n`;
  }, [spec]);
  const saveDraft = () => { try { localStorage.setItem(draftKey, JSON.stringify(spec)); setNotice('Draft saved in this browser.'); } catch { setNotice('Browser storage is unavailable; use Export CSS instead.'); } };
  const exportCss = () => {
    const blob = new Blob([css], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'muf-workbench-patch.css'; link.click();
    URL.revokeObjectURL(url); setNotice('CSS patch exported. Nothing was applied automatically.');
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, kind: spec.kind, spec }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'muf-workbench-draft.json'; link.click();
    URL.revokeObjectURL(url); setNotice('Design draft exported as JSON.');
  };
  const preview = (value: Spec, label?: string) => {
    const cardStyle: React.CSSProperties = {
      boxSizing: 'border-box', width: '100%', maxWidth: value.kind === 'popup' ? (value.size === 'small' ? '28rem' : '42rem') : '100%', minWidth: 0,
      padding: value.density === 'compact' ? Math.max(8, Math.round(value.padding * 0.75)) : value.padding,
      display: 'flex', flexDirection: 'column', gap: value.density === 'compact' ? Math.max(4, Math.round(value.gap * 0.75)) : value.gap, borderRadius: value.radius, alignSelf: 'center',
      border: `1px solid ${accentTokens[value.accent]}`, background: surfaceTokens[value.surface],
      color: value.surface === 'primary' ? '#ffffff' : 'var(--muf-color-text, #1e293b)',
      fontSize: value.fontSize, boxShadow: 'var(--muf-shadow, 0 12px 32px rgba(15,23,42,.12))',
      overflowWrap: 'anywhere'
    };
    return <section key={label || value.kind} style={cardStyle} aria-label={label || 'Component preview'}>
      {label && <small style={{ opacity: .65, fontWeight: 800, letterSpacing: '.08em' }}>{label}</small>}
      {(value.kind === 'popup' || value.kind === 'heading') && <header style={{ borderBottom: '1px solid var(--muf-color-border, #e6e6de)', paddingBottom: value.gap, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: value.fontSize + 3, lineHeight: 1.25 }}>{value.title}</strong>
        {value.kind === 'popup' && <span style={{ opacity: .7, fontSize: Math.max(11, value.fontSize - 2) }}>{value.subtitle}</span>}
      </header>}
      {value.kind === 'card' && <strong>{value.title}</strong>}
      {(value.kind === 'popup' || value.kind === 'card' || value.kind === 'form') && <p style={{ margin: 0, lineHeight: 1.5 }}>{value.body}</p>}
      {value.kind === 'form' && <div style={{ display: 'grid', gap: 6 }}>
        <label style={{ fontSize: 12 }}>Sample field</label><input aria-label="Sample field" placeholder="Preview only" style={{ width: '100%', boxSizing: 'border-box', minHeight: 36, padding: 8, borderRadius: 8, border: '1px solid var(--muf-color-border, #e6e6de)', background: 'var(--muf-color-surface, #fffefb)', color: 'var(--muf-color-text, #1e293b)' }} />
      </div>}
      {value.kind === 'button' && <button type="button" className="muf-primary-action" style={{ alignSelf: 'flex-start', background: accentTokens[value.accent] }} onClick={() => setNotice('Preview button only. No application action was run.')}>Preview action</button>}
      {value.kind !== 'button' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, background: 'var(--muf-color-surface-alt, #f1f5f9)' }}>{value.size === 'large' ? 'Large shell' : 'Small shell'}</span>
        <span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, background: 'var(--muf-color-surface-alt, #f1f5f9)' }}>{value.density} density</span>
      </div>}
    </section>;
  };
  const deviceWidth = device === 'phone' ? 360 : device === 'tablet' ? 768 : 1120;
  return <main style={{ minHeight: '100dvh', background: 'var(--muf-color-page, #f8fafc)', color: 'var(--muf-color-text, #1e293b)', padding: 16, fontFamily: 'inherit' }}>
    <div style={{ maxWidth: 1440, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header className="muf-panel" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div><p style={{ margin: 0, color: 'var(--muf-color-primary)', fontWeight: 800, fontSize: 11, letterSpacing: '.1em' }}>MUF DESIGN SYSTEM / DEV TOOL</p><h1 style={{ margin: '6px 0', fontSize: 24 }}>Visual workbench</h1><p style={{ margin: 0, opacity: .7, fontSize: 13 }}>Preview-only components. No APIs, business data, or production styles are changed.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="muf-detail-btn" style={{ flex: '0 0 auto', padding: '8px 12px' }} onClick={undo} disabled={historyIndex <= 0}>Undo</button>
          <button className="muf-detail-btn" style={{ flex: '0 0 auto', padding: '8px 12px' }} onClick={redo} disabled={historyIndex >= history.length - 1}>Redo</button>
          <button className="muf-primary-action" style={{ minHeight: 36 }} onClick={saveDraft}>Save draft</button>
          <button className="muf-primary-action" style={{ minHeight: 36 }} onClick={exportCss}>Export CSS</button>
          <button className="muf-primary-action" style={{ minHeight: 36 }} onClick={exportJson}>Export JSON</button>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <aside className="muf-panel" style={{ padding: 16, display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Inspector</h2>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Component type
            <select value={spec.kind} onChange={e => update({ kind: e.target.value as Kind })}><option value="popup">Popup shell</option><option value="heading">Heading</option><option value="card">Card</option><option value="button">Button</option><option value="form">Form</option></select>
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Title<input value={spec.title} onChange={e => update({ title: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Subtitle<input value={spec.subtitle} onChange={e => update({ subtitle: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Sample body<textarea rows={3} value={spec.body} onChange={e => update({ body: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Shell size<select value={spec.size} onChange={e => update({ size: e.target.value as Spec['size'] })}><option value="small">Small</option><option value="large">Large</option></select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Density<select value={spec.density} onChange={e => update({ density: e.target.value as Spec['density'] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Surface<select value={spec.surface} onChange={e => update({ surface: e.target.value as Spec['surface'] })}><option value="surface">Surface</option><option value="surface-alt">Alternate surface</option><option value="primary">Primary</option></select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>Accent<select value={spec.accent} onChange={e => update({ accent: e.target.value as Spec['accent'] })}><option value="primary">Primary</option><option value="success">Success</option><option value="warning">Warning</option><option value="danger">Danger</option></select></label>
          {([
            ['radius', 'Corner radius', 0, 32, 1], ['padding', 'Padding', 8, 32, 2],
            ['gap', 'Gap', 4, 24, 1], ['fontSize', 'Font size', 11, 22, 1]
          ] as const).map(([key, label, min, max, step]) => <label key={key} style={{ display: 'grid', gap: 5, fontSize: 12 }}>{label}: {spec[key]}{key === 'fontSize' ? 'px' : 'px'}<input type="range" min={min} max={max} step={step} value={spec[key]} onChange={e => update({ [key]: Number(e.target.value) } as Partial<Spec>)} /></label>)}
          <button className="muf-detail-btn" style={{ padding: 10 }} onClick={() => { setBaseline(clone(spec)); setNotice('Comparison baseline updated.'); }}>Set comparison baseline</button>
        </aside>
        <section style={{ minWidth: 0, display: 'grid', gap: 12 }}>
          <div className="muf-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13, marginRight: 8 }}>Preview viewport</strong>
            {(['phone', 'tablet', 'desktop'] as const).map(v => <button key={v} className="muf-detail-btn" style={{ flex: '0 0 auto', padding: '7px 10px', opacity: device === v ? 1 : .65 }} onClick={() => setDevice(v)}>{v}</button>)}
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />Compare baseline</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12, minWidth: 0, background: 'var(--muf-color-surface-alt, #f1f5f9)', border: '1px solid var(--muf-color-border, #e6e6de)', borderRadius: 16 }}>
            <div style={{ width: '100%', maxWidth: deviceWidth, minWidth: 0, display: 'grid', gridTemplateColumns: compare ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)', gap: 12, alignItems: 'start', transition: 'max-width .15s ease' }}>
              {preview(spec, 'CURRENT DESIGN')}{compare && preview(baseline, 'BASELINE')}
            </div>
          </div>
          <section className="muf-panel" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Export preview</h2><pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, padding: 12, borderRadius: 10, background: 'var(--muf-color-surface-alt, #f1f5f9)' }}>{css}</pre>
            <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 12, opacity: .8 }}>{notice}</p>
          </section>
        </section>
      </div>
    </div>
    <style>{`@media(max-width:760px){main>div>div{grid-template-columns:minmax(0,1fr)!important}.muf-panel input:not([type=range]),.muf-panel select,.muf-panel textarea{box-sizing:border-box;width:100%;min-width:0}.muf-panel button{max-width:100%}} .muf-panel input,.muf-panel select,.muf-panel textarea{border:1px solid var(--muf-color-border,#e6e6de);border-radius:8px;padding:8px;background:var(--muf-color-surface,#fffefb);color:inherit;font:inherit}.muf-panel input[type=range],.muf-panel input[type=checkbox]{width:auto}.muf-panel button:focus-visible{outline:2px solid var(--muf-ui-focus);outline-offset:2px}`}</style>
  </main>;
}

const mount = document.getElementById('muf-workbench-root');
if (mount) createRoot(mount).render(<React.StrictMode><MUFVisualWorkbench /></React.StrictMode>);
export default MUFVisualWorkbench;
