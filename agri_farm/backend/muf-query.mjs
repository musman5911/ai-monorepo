// muf-query.mjs — shared in-memory query/match/update engine used by the
// memory-db.js of all three farm backends (dairy / flock / agri).
//
// One file, three byte-identical copies (backend/muf-query.mjs in each app).
// Each app's memory-db.js keeps its own model/document API on top and passes
// its dialect options:
//   - { loose: true }   flock (string-tolerant equality)
//   - { nullsLast }     flock (missing values sort last)

import crypto from 'crypto';

// 24-hex id that passes MongoDB ObjectId validation
export function mufNewId() {
  return crypto.randomBytes(12).toString('hex');
}

export function mufClone(v) {
  if (Array.isArray(v)) return v.map(mufClone);
  if (v && typeof v === 'object' && v instanceof Date) return new Date(v.getTime());
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = mufClone(v[k]);
    return out;
  }
  return v;
}

export function mufGetPath(obj, path) {
  if (obj == null) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function mufSetPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// Loose equality (flock dialect): numbers and strings compare by String()
export function mufEq(a, b) {
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return ta === tb;
  }
  if (b === null) return a == null;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function toComparable(v) {
  if (v instanceof Date) return v.getTime();
  return v;
}

// Sort compare: Dates by timestamp, nulls/undefined count as smallest
export function mufCompare(a, b) {
  a = toComparable(a);
  b = toComparable(b);
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function mufIsOperatorObject(cond) {
  return cond !== null && typeof cond === 'object' && !Array.isArray(cond)
    && !(cond instanceof Date) && Object.keys(cond).length > 0
    && Object.keys(cond).every((k) => k.startsWith('$'));
}

export function mufMatchValue(docVal, cond, { loose = false } = {}) {
  if (mufIsOperatorObject(cond)) {
    return Object.entries(cond).every(([op, v]) => {
      switch (op) {
        case '$ne': return loose ? !mufEq(docVal, v) : !(docVal === v);
        case '$gt': return docVal != null && mufCompare(docVal, v) > 0;
        case '$gte': return docVal != null && mufCompare(docVal, v) >= 0;
        case '$lt': return docVal != null && mufCompare(docVal, v) < 0;
        case '$lte': return docVal != null && mufCompare(docVal, v) <= 0;
        case '$exists': return Boolean(v) === (docVal !== undefined && docVal !== null);
        case '$in': return Array.isArray(v) && v.some((x) => (loose ? mufEq(docVal, x) : docVal === x));
        case '$nin': return !(Array.isArray(v) && v.some((x) => (loose ? mufEq(docVal, x) : docVal === x)));
        case '$regex':
          try { return new RegExp(v).test(String(docVal ?? '')); } catch { return false; }
        case '$type': return true; // not needed in memory mode
        default: return true;
      }
    });
  }
  return loose ? mufEq(docVal, cond) : docVal === cond;
}

export function mufMatches(doc, filter = {}, opts = {}) {
  if (!filter) return true;
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return Array.isArray(cond) && cond.some((sub) => mufMatches(doc, sub, opts));
    if (key === '$and') return Array.isArray(cond) && cond.every((sub) => mufMatches(doc, sub, opts));
    return mufMatchValue(mufGetPath(doc, key), cond, opts);
  });
}

export function mufSort(rows, sortSpec, { nullsLast = false } = {}) {
  if (!sortSpec) return rows;
  const entries = Array.isArray(sortSpec) ? sortSpec : Object.entries(sortSpec);
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = mufGetPath(a, field);
      const bv = mufGetPath(b, field);
      if (nullsLast) {
        const an = av === undefined || av === null;
        const bn = bv === undefined || bv === null;
        if (an || bn) {
          if (an && bn) continue;
          return an ? 1 : -1;
        }
      }
      const c = mufCompare(av, bv);
      if (c !== 0) return dir < 0 ? -c : c;
    }
    return 0;
  });
  return sorted;
}

export function mufPullMatch(item, cond) {
  if (!mufIsOperatorObject(cond)) return item === cond;
  return Object.entries(cond).every(([k, v]) => mufGetPath(item, k) === v);
}

export function mufApplyUpdate(doc, update) {
  const hasOperator = Object.keys(update).some((k) => k.startsWith('$'));
  if (!hasOperator) {
    // Bare object == $set
    for (const [k, v] of Object.entries(update)) mufSetPath(doc, k, v);
    return;
  }
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) mufSetPath(doc, k, v);
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[k])) doc[k] = [];
      doc[k].push(v);
    }
  }
  if (update.$pull) {
    for (const [k, v] of Object.entries(update.$pull)) {
      if (!Array.isArray(doc[k])) continue;
      doc[k] = doc[k].filter((item) => !mufPullMatch(item, v));
    }
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) doc[k] = (Number(doc[k]) || 0) + v;
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) delete doc[k];
  }
}

export function mufProject(doc, selectSpec) {
  let fields;
  if (typeof selectSpec === 'string') {
    fields = selectSpec.split(/\s+/).filter(Boolean);
  } else if (Array.isArray(selectSpec)) {
    fields = selectSpec;
  } else if (selectSpec && typeof selectSpec === 'object') {
    fields = Object.keys(selectSpec).filter((k) => selectSpec[k]);
  } else {
    return doc;
  }
  const out = {};
  if (!fields.includes('-_id')) out._id = doc._id;
  for (const f of fields) {
    if (f.startsWith('-')) continue;
    out[f] = mufGetPath(doc, f);
  }
  return out;
}
