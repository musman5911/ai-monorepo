// Extracted from BatchesTab.tsx — pure helpers for the batches view, no UI.
//
// TWIN SCOPE: flock-only (not a muf-* file). The path-normalisation helper
// deals with batch photo paths stored on the server; it has no equivalent
// in dairy/agri (no batches domain there).
import type { BatchWithSummary } from '../../types';

export const formatRs = (value: number) => `Rs ${Math.round(value || 0).toLocaleString()}`;

/**
 * Convert any stored batch-image path into a URL the browser can fetch.
 *
 * Handles three storage shapes the codebase has produced over time:
 *  - Windows-style absolute paths with backslashes (`C:\...\public\batches\foo.jpg`)
 *  - Paths that include the `public/` segment explicitly (`public/batches/foo.jpg`)
 *  - Already-clean URL paths (`/batches/foo.jpg`)
 *
 * Always returns a root-relative URL (`/batches/...`) so the backend's
 * express.static('public') handler serves the file correctly.
 */
export function normalizePublicAssetPath(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\/g, '/');
  const publicIndex = normalized.toLowerCase().indexOf('/public/');
  if (publicIndex >= 0) {
    return normalized.slice(publicIndex + '/public'.length);
  }
  if (normalized.toLowerCase().startsWith('public/')) {
    return `/${normalized.slice('public/'.length)}`;
  }
  if (normalized.startsWith('/')) return normalized;
  if (normalized.startsWith('batches/')) return `/${normalized}`;
  return normalized;
}

/**
 * Sort batches by profit/loss (highest first) for the comparison view.
 * Returns a new array — the input is not mutated.
 */
export function sortBatchesByProfitLoss(batches: BatchWithSummary[]): BatchWithSummary[] {
  return [...batches].sort((a, b) => b.summary.profit_loss - a.summary.profit_loss);
}
