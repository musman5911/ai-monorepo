/**
 * In-memory data store that mimics enough of the Mongoose API for the
 * backend routes to run without a MongoDB connection.
 *
 * Activated via MEMORY_MODE=1. Data lives only in RAM and is lost when the
 * process exits. This is for local/demo/preview use only — production still
 * uses real MongoDB via db.js.
 *
 * The pure query/match/update engine lives in the shared muf twin
 * (../muf-query.mjs — same byte-identical file in all three backends).
 * This file only adds the Mongoose-style model API on top.
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

function createModel(name, schema) {
  const store = [];
  const defaults = extractDefaults(schema);
  const hasObjectId = !(schema.paths && schema.paths._id);

  const modelProto = {
    async save() {
      const idx = store.findIndex((x) => x._id === this._id);
      this.updatedAt = new Date();
      if (idx === -1) store.push(this);
      else store[idx] = this;
      return this;
    },
    async deleteOne() {
      const idx = store.findIndex((x) => x._id === this._id);
      if (idx !== -1) store.splice(idx, 1);
      return this;
    },
  };

  const toDoc = (raw) => {
    const d = Object.assign({}, raw);
    for (const [k, v] of Object.entries(defaults)) {
      if (d[k] === undefined) d[k] = typeof v === 'function' ? v.call(null) : cloneValue(v);
    }
    if (d._id === undefined || d._id === null) d._id = generateId();
    if (d.createdAt === undefined) d.createdAt = new Date();
    if (d.updatedAt === undefined) d.updatedAt = new Date();
    // Attach prototype (save/deleteOne + any schema methods)
    const proto = Object.create(modelProto);
    if (schema.methods) {
      for (const k of Object.keys(schema.methods)) proto[k] = schema.methods[k];
    }
    Object.setPrototypeOf(d, proto);
    return d;
  };

  const model = {
    _name: name,
    _store: store,
    _defaults: defaults,
    _hasObjectId: hasObjectId,

    collection: {
      async createIndex() { /* no-op in memory mode */ },
    },

    _runQuery({ op, filter, sort, limit, skip, select, lean }) {
      let rows = store.filter((d) => matches(d, filter || {}));
      if (sort) rows = sortResults(rows, sort);
      if (skip) rows = rows.slice(skip);
      if (limit != null) rows = rows.slice(0, limit);
      if (op === 'findOne' || op === 'findById') return rows[0] || null;
      if (select) rows = rows.map((d) => project(d, select));
      if (lean) rows = rows.map((d) => ({ ...d }));
      return rows;
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
      return d;
    },

    async insertMany(docs /*, opts */) {
      const out = [];
      for (const doc of docs || []) {
        const d = toDoc(doc || {});
        store.push(d);
        out.push(d);
      }
      return out;
    },

    async findByIdAndUpdate(id, update, opts = {}) {
      let d = store.find((x) => x._id === id) || null;
      if (!d && opts.upsert) {
        d = toDoc({ _id: id });
        if (opts.setDefaultsOnInsert) {
          for (const [k, v] of Object.entries(defaults)) {
            if (d[k] === undefined) d[k] = typeof v === 'function' ? v.call(null) : cloneValue(v);
          }
        }
        store.push(d);
      }
      if (!d) return null;
      applyUpdate(d, update || {});
      d.updatedAt = new Date();
      return opts.new === false ? d : d;
    },

    async findOneAndUpdate(filter, update, opts = {}) {
      let d = store.find((x) => matches(x, filter || {})) || null;
      if (!d && opts.upsert) {
        // Seed the new doc with any direct-equality fields from the filter
        const base = {};
        for (const [k, v] of Object.entries(filter || {})) {
          if (v !== null && typeof v !== 'object') base[k] = v;
        }
        d = toDoc(base);
        store.push(d);
      }
      if (!d) return null;
      applyUpdate(d, update || {});
      d.updatedAt = new Date();
      return d;
    },

    async findByIdAndDelete(id) {
      const idx = store.findIndex((x) => x._id === id);
      if (idx === -1) return null;
      const d = store[idx];
      store.splice(idx, 1);
      return d;
    },

    async findOneAndDelete(filter) {
      const idx = store.findIndex((d) => matches(d, filter || {}));
      if (idx === -1) return null;
      const d = store[idx];
      store.splice(idx, 1);
      return d;
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
          d.updatedAt = new Date();
          n++;
        }
      }
      return { modifiedCount: n };
    },

    async countDocuments(filter) {
      return store.filter((d) => matches(d, filter || {})).length;
    },

    async distinct(field, filter) {
      const seen = new Set();
      for (const d of store) {
        if (!matches(d, filter || {})) continue;
        const v = getPath(d, field);
        if (v !== undefined && v !== null) seen.add(v);
      }
      return Array.from(seen);
    },
  };

  // Attach schema statics (e.g. PasswordReset.generateCode / createCode)
  if (schema.statics) {
    for (const k of Object.keys(schema.statics)) {
      model[k] = schema.statics[k];
    }
  }

  return model;
}

/**
 * Create a full set of memory models keyed by model name.
 * schemaMap: { Cow: CowSchema, Milk: MilkSchema, ... }
 */
function createStore(schemaMap) {
  const models = {};
  for (const [name, schema] of Object.entries(schemaMap)) {
    models[name] = createModel(name, schema);
  }
  return models;
}

export { createStore };
