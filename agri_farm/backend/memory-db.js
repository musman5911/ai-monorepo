/**
 * In-memory data store that mimics enough of the Mongoose / PyMongo API for
 * the backend routes to run without a MongoDB connection.
 *
 * Activated via MEMORY_MODE=1 (or the legacy ALLOW_MEMORY_MODE=1) when no
 * MONGO_URI is configured. Data lives only in RAM and is lost when the
 * process exits — for local/demo/preview use only. Production (real
 * MONGO_URI) never touches this module.
 *
 * The pure query/match/update engine lives in the shared muf twin
 * (../muf-query.mjs — same byte-identical file in all three backends).
 * This file only adds the collection-style API the agri routes call.
 *
 * Same file name and role as dairy_farm/backend/memory-db.js and
 * flock_farm/backend/memory-db.js.
 */
import {
  mufNewId as generateId,
  mufClone as cloneValue,
  mufGetPath as getPath,
  mufSetPath as setPath,
  mufCompare as compare,
  mufIsOperatorObject as isOperatorObject,
  mufMatches as matches,
  mufSort as sortResults,
  mufApplyUpdate as applyUpdate,
  mufPullMatch as pullMatch,
  mufProject as project,
} from './muf-query.mjs';

class MemQuery {
  constructor(model, params) {
    this._model = model;
    this._params = params;
    this._promise = null;
  }
  sort(s) { this._params.sort = s; return this; }
  limit(n) { this._params.limit = n; return this; }
  skip(n) { this._params.skip = n; return this; }
  select(f) { this._params.select = f; return this; }
  lean() { this._params.lean = true; return this; }
  then(res, rej) { return this._exec().then(res, rej); }
  catch(rej) { return this._exec().catch(rej); }
  finally(f) { return this._exec().finally(f); }
  _exec() {
    if (!this._promise) this._promise = Promise.resolve(this._model._runQuery(this._params));
    return this._promise;
  }
}

function extractDefaults(schema) {
  const defaults = {};
  for (const name of Object.keys(schema.paths || {})) {
    if (name === '_id' || name === '__v') continue;
    const p = schema.paths[name];
    const dv = p && p.defaultValue;
    if (dv === undefined || dv === null) continue;
    defaults[name] = typeof dv === 'function' ? dv : cloneValue(dv);
  }
  return defaults;
}

function createModel(name, schema) {
  const store = [];
  const defaults = extractDefaults(schema);

  const toDoc = (raw) => {
    const d = Object.assign({}, raw);
    for (const [k, v] of Object.entries(defaults)) {
      if (d[k] === undefined) d[k] = typeof v === 'function' ? v.call(null) : cloneValue(v);
    }
    if (d._id === undefined || d._id === null) d._id = generateId();
    return d;
  };

  const model = {
    _name: name,
    _store: store,
    _defaults: defaults,

    collection: {
      async createIndex() { /* no-op in memory mode */ },
    },

    _runQuery({ op, filter, sort, limit, skip, select, lean }) {
      let rows = store.filter((d) => matches(d, filter || {}));
      if (sort) rows = sortResults(rows, sort);
      if (skip) rows = rows.slice(skip);
      if (limit != null) rows = rows.slice(0, limit);
      if (op === 'findOne' || op === 'findById') {
        const one = rows[0] || null;
        return one ? cloneValue(one) : null;
      }
      if (select) rows = rows.map((d) => project(d, select));
      return rows.map((d) => cloneValue(d));
    },

    find(filter) {
      return new MemQuery(this, { op: 'find', filter: filter || {} });
    },
    findOne(filter) {
      return new MemQuery(this, { op: 'findOne', filter: filter || {} });
    },
    findById(id) {
      return new MemQuery(this, { op: 'findById', filter: { _id: id } });
    },

    async create(doc) {
      const d = toDoc(doc || {});
      store.push(d);
      return cloneValue(d);
    },

    async insertOne(doc) {
      const d = toDoc(doc || {});
      store.push(d);
      return { insertedId: d._id, acknowledged: true };
    },

    async insertMany(docs) {
      const out = [];
      for (const doc of docs || []) {
        const d = toDoc(doc || {});
        store.push(d);
        out.push(cloneValue(d));
      }
      return out;
    },

    async updateOne(filter, update, opts = {}) {
      let d = store.find((x) => matches(x, filter || {})) || null;
      if (!d && opts.upsert) {
        const base = {};
        for (const [k, v] of Object.entries(filter || {})) {
          if (v !== null && typeof v !== 'object') base[k] = v;
        }
        d = toDoc(base);
        store.push(d);
      }
      if (!d) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(d, update || {});
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async replaceOne(filter, doc) {
      const idx = store.findIndex((x) => matches(x, filter || {}));
      if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
      const replacement = toDoc(doc || {});
      replacement._id = store[idx]._id; // _id is immutable in MongoDB replaceOne
      store[idx] = replacement;
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async deleteOne(filter) {
      const idx = store.findIndex((x) => matches(x, filter || {}));
      if (idx === -1) return { deletedCount: 0 };
      store.splice(idx, 1);
      return { deletedCount: 1 };
    },

    async deleteMany(filter) {
      const before = store.length;
      const keep = [];
      for (const d of store) {
        if (!matches(d, filter || {})) keep.push(d);
      }
      store.length = 0;
      store.push(...keep);
      return { deletedCount: before - store.length };
    },

    async updateMany(filter, update) {
      let n = 0;
      for (const d of store) {
        if (matches(d, filter || {})) {
          applyUpdate(d, update || {});
          n++;
        }
      }
      return { modifiedCount: n };
    },

    async countDocuments(filter) {
      return store.filter((d) => matches(d, filter || {})).length;
    },
  };

  if (schema.statics) {
    for (const k of Object.keys(schema.statics)) model[k] = schema.statics[k];
  }

  return model;
}

/**
 * Create a full set of memory models keyed by model name.
 * schemaMap: { User: UserSchema, Crop: CropSchema, ... }
 */
function createStore(schemaMap) {
  const models = {};
  for (const [name, schema] of Object.entries(schemaMap)) {
    models[name] = createModel(name, schema);
  }
  return models;
}

export { createStore };
