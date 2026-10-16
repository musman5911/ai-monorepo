/* ─────────────────────────────────────────────────────────────
 * muf-charts — shared smooth green area chart (muf twin file).
 * Identical in dairy_farm & flock_farm (TSX); agri_farm carries
 * the same file with types stripped (muf-charts.jsx).
 * No chart library needed — pure SVG, works in light & dark mode.
 * ──────────────────────────────────────────────────────────── */
import React, { useMemo, useState } from 'react';

export const MUF_CHART_GREEN = '#16a34a';

export interface MufChartPoint {
  label: string;
  value: number;
}

/** Short number: 1500 → 1.5k, 2,400,000 → 2.4M */
export function mufCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

/** Round a max value up to a "nice" ceiling for the y axis. */
export function mufNiceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const unit = max / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return nice * pow;
}

/** Catmull-Rom → cubic bezier smooth path through the points. */
export function mufSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

let mufGradSeq = 0;

interface MufAreaChartProps {
  data: MufChartPoint[];
  height?: number;
  color?: string;
  /** formats the hovered value, e.g. v => `Rs ${v.toLocaleString()}` */
  format?: (v: number) => string;
  emptyText?: string;
}

/**
 * Smooth green area chart used on all three dashboards.
 * Hover / touch shows the nearest point's label + value.
 */
export function MufAreaChart({
  data,
  height = 190,
  color = MUF_CHART_GREEN,
  format,
  emptyText = 'No data yet',
}: MufAreaChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useMemo(() => `muf-area-grad-${++mufGradSeq}`, []);

  const W = 640;
  const H = height;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 22;

  const fmt = format || ((v: number) => v.toLocaleString());

  const { pts, areaPath, linePath, yTicks, xTicks } = useMemo(() => {
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const maxV = mufNiceMax(Math.max(...data.map((d) => d.value), 0));
    const px = (i: number) =>
      padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const py = (v: number) => padT + innerH - (Math.max(v, 0) / maxV) * innerH;
    const pts = data.map((d, i) => ({ x: px(i), y: py(d.value) }));
    const linePath = mufSmoothPath(pts);
    const areaPath =
      pts.length > 1
        ? `${linePath} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z`
        : '';
    const yTicks = [0, 0.5, 1].map((f) => ({
      y: py(maxV * f),
      label: mufCompact(maxV * f),
    }));
    // up to 6 x labels, always including first & last
    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    const xTicks = data
      .map((d, i) => ({ i, x: px(i), label: d.label }))
      .filter((t, _, arr) => t.i % step === 0 || t.i === arr.length - 1);
    return { pts, areaPath, linePath, yTicks, xTicks };
  }, [data, H]);

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic"
        style={{ height }}
      >
        {emptyText}
      </div>
    );
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setHover(best);
  };

  const hovered = hover !== null && data[hover] ? { pt: pts[hover], d: data[hover] } : null;
  const tipText = hovered ? `${hovered.d.label} · ${fmt(hovered.d.value)}` : '';
  const tipW = Math.max(60, tipText.length * 6.4 + 16);
  const tipX = hovered ? Math.min(Math.max(hovered.pt.x - tipW / 2, padL), W - padR - tipW) : 0;
  const tipY = hovered ? Math.max(hovered.pt.y - 34, 2) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full select-none"
      style={{ height: 'auto', touchAction: 'pan-y' }}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* horizontal gridlines + y labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={t.y} y2={t.y}
            stroke="#94a3b8" strokeOpacity="0.22" strokeDasharray="3 4" strokeWidth="1" />
          <text x={padL - 5} y={t.y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {t.label}
          </text>
        </g>
      ))}

      {/* area + line */}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* last point dot */}
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.4"
          fill={color} stroke="#ffffff" strokeWidth="1.4" />
      )}

      {/* x labels */}
      {xTicks.map((t) => (
        <text key={t.i} x={t.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {t.label}
        </text>
      ))}

      {/* hover marker + tooltip */}
      {hovered && (
        <g pointerEvents="none">
          <line x1={hovered.pt.x} x2={hovered.pt.x} y1={padT} y2={H - padB}
            stroke={color} strokeOpacity="0.35" strokeWidth="1" />
          <circle cx={hovered.pt.x} cy={hovered.pt.y} r="4" fill={color}
            stroke="#ffffff" strokeWidth="1.6" />
          <rect x={tipX} y={tipY} width={tipW} height="22" rx="6"
            fill="#0f172a" fillOpacity="0.92" />
          <text x={tipX + tipW / 2} y={tipY + 14.5} textAnchor="middle"
            fontSize="10" fontWeight="600" fill="#f1f5f9">
            {tipText}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Simple vertical bar chart for category breakdowns (e.g. expenses by type). */
export function MufBarChart({
  data,
  height = 160,
  color = MUF_CHART_GREEN,
  format,
  emptyText = 'No data yet',
}: MufChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 22;

  const fmt = format || ((v: number) => v.toLocaleString());
  const maxV = mufNiceMax(Math.max(...data.map((d) => d.value), 0));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = data.length > 0 ? Math.min(48, innerW / data.length - 4) : 0;
  const gap = data.length > 1 ? (innerW - barW * data.length) / (data.length - 1) : 0;

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  const yTicks = [0, 0.5, 1].map((f) => ({
    y: padT + innerH - (maxV * f / maxV) * innerH,
    label: mufCompact(maxV * f),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height: 'auto' }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#94a3b8" strokeOpacity="0.22" strokeDasharray="3 4" strokeWidth="1" />
          <text x={padL - 5} y={t.y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{t.label}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padL + i * (barW + gap);
        const h = (d.value / maxV) * innerH;
        const y = padT + innerH - h;
        const isHover = hover === i;
        return (
          <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <rect x={x} y={y} width={barW} height={h} rx="4" fill={color} fillOpacity={isHover ? 0.9 : 0.65} />
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.label}</text>
            {isHover && (
              <g pointerEvents="none">
                <rect x={x + barW / 2 - 30} y={y - 24} width="60" height="18" rx="4" fill="#0f172a" fillOpacity="0.92" />
                <text x={x + barW / 2} y={y - 11} textAnchor="middle" fontSize="9" fontWeight="600" fill="#f1f5f9">{fmt(d.value)}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface MufChartProps {
  data: MufChartPoint[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
  emptyText?: string;
}
