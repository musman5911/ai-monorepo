// muf-entity-grid — the shared photo-card grid for registry screens in
// all three farm apps (cows / birds / crops / workers). Same card physics
// as the agri crop grid (.muf-entity-* in muf-style.css) so every
// registry feels identical: photo header, status pill, round icon,
// stats rows, action row. The whole card is clickable when onOpen is
// given; action buttons inside are isolated from the card click.
import React from 'react';

export interface MufEntityStat {
  icon?: React.ReactNode;
  text: string;
}

export interface MufEntityItem {
  id: string | number;
  photo?: string | null;
  emoji?: string;
  name: string;
  sub?: string;
  chip?: string;
  status: string;
  statusTone?: 'good' | 'warn' | 'bad' | 'info' | 'muted';
  stats?: MufEntityStat[];
  actions?: React.ReactNode;
  /** Optional progress bar (0-100). Rendered below stats. Used by agri crops. */
  progress?: number;
  progressLabel?: string;
}

interface MufEntityGridProps {
  items: MufEntityItem[];
  onOpen?: (item: MufEntityItem) => void;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
}

export default function MufEntityGrid({
  items, onOpen, emptyIcon, emptyTitle = 'Nothing here yet', emptyHint = '',
}: MufEntityGridProps) {
  if (items.length === 0) {
    return (
      <div className="muf-entity-empty">
        <div>{emptyIcon}</div>
        <h4>{emptyTitle}</h4>
        {emptyHint ? <p>{emptyHint}</p> : null}
      </div>
    );
  }
  return (
    <div className="muf-entity-grid">
      {items.map((it) => {
        const emoji = it.emoji || '🌱';
        return (
          <article
            key={it.id}
            className="muf-entity-card"
            role={onOpen ? 'button' : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={onOpen ? () => onOpen(it) : undefined}
            onKeyDown={onOpen ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(it); }
            } : undefined}
          >
            <div className={it.photo ? "muf-entity-photo" : "muf-entity-photo muf-entity-photo-noimg"} style={it.photo ? { backgroundImage: `url(${it.photo})` } : undefined}>
              {it.photo ? <img src={it.photo} alt="" /> : <span className="muf-entity-emoji">{emoji}</span>}
              <span className="muf-entity-status" data-tone={it.statusTone || 'good'}>{it.status}</span>
              <span className="muf-entity-round-icon">{emoji}</span>
            </div>
            <div className="muf-entity-body">
              <div className="muf-entity-name">
                <div style={{ minWidth: 0 }}>
                  <h4>{it.name}</h4>
                  {it.sub ? <p>{it.sub}</p> : null}
                </div>
                {it.chip ? <span className="muf-entity-chip">{it.chip}</span> : null}
              </div>
              {it.stats && it.stats.length > 0 ? (
                <div className="muf-entity-stats">
                  {it.stats.map((s, i) => (
                    <span key={i}>{s.icon}<span style={{ minWidth: 0 }}>{s.text}</span></span>
                  ))}
                </div>
              ) : null}
              {typeof it.progress === 'number' ? (
                <div className="muf-entity-progress" onClick={(e) => e.stopPropagation()}>
                  <div><span>{it.progressLabel || 'Progress'}</span><strong>{it.progress}%</strong></div>
                  <div className="muf-entity-progress-track"><span style={{ width: `${it.progress}%` }} /></div>
                </div>
              ) : null}
              {it.actions ? (
                <div className="muf-entity-actions" onClick={(e) => e.stopPropagation()}>
                  {it.actions}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
