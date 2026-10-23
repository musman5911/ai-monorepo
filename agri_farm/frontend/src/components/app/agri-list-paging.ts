export const AGRI_LIST_PAGE_SIZE = 40;

export function buildAgriPageQuery(skip, limit, filters = {}) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    const encoded = Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).join('|') : String(value).trim();
    if (encoded) params.set(key, encoded);
  }
  return params.toString();
}
export function mergeAgriPageRows(current, incoming) {
  const result = [...(Array.isArray(current) ? current : [])];
  const seen = new Set(result.filter((row) => row && row._id != null).map((row) => String(row._id)));
  for (const row of Array.isArray(incoming) ? incoming : []) {
    if (!row || row._id == null || !seen.has(String(row._id))) {
      result.push(row);
      if (row && row._id != null) seen.add(String(row._id));
    }
  }
  return result;
}
export function getAgriPageTotal(headers, fallback = 0) {
  const source = headers || {};
  const raw = source['x-total-count'] ?? source['X-Total-Count'];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const total = Number(raw);
  return Number.isSafeInteger(total) && total >= 0 ? total : fallback;
}
