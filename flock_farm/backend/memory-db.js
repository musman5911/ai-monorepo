// DEV-ONLY in-memory database backend.
//
// Activated ONLY when MEMORY_DB=true and no MONGODB_URI is set (see db.js).
// It patches mongoose.model() so every model in the app runs against plain
// in-process arrays instead of a real MongoDB — data lives until restart.
// Production/Replit (with MONGODB_URI) never touches this file's logic.
//
// It implements just the subset of the Mongoose API this app uses:
//   find / findOne / findById (+ .sort/.select chaining)
//   findOneAndUpdate / findByIdAndDelete / create / insertMany
//   countDocuments / deleteMany / updateMany
//   doc.save / doc.validate / doc.deleteOne / doc.toObject
//   schema statics & methods, defaults, timestamps, required/enum validation
//   query operators: $or, $ne, $gt, $exists, $in
//   update operators: $set, $inc
//
// The pure query/match/update engine lives in the shared muf twin
// (../muf-query.mjs — same byte-identical file in all three backends),
// wired with the flock dialect: loose (string-tolerant) equality and
// nulls-last sorting.

import mongoose from 'mongoose';
import {
  mufNewId as newObjectId,
  mufGetPath as getPath,
  mufEq as eq,
  mufMatchValue,
  mufMatches,
  mufSort,
  mufApplyUpdate as applyUpdate,
} from './muf-query.mjs';

// flock dialect: numbers and string ids compare by String()
function matchValue(docVal, cond) {
  return mufMatchValue(docVal, cond, { loose: true });
}

function matches(doc, filter = {}) {
  return mufMatches(doc, filter, { loose: true });
}

function sortDocs(docs, spec) {
  return mufSort(docs, spec, { nullsLast: true });
}

class Query {
  constructor(exec) {
    this._exec = exec;
    this._sort = null;
    this._skip = 0;
    this._limit = null;
  }
  sort(spec) { this._sort = spec; return this; }
  select() { return this; }
  skip(count) { this._skip = Math.max(0, Number(count) || 0); return this; }
  limit(count) { this._limit = Math.max(0, Number(count) || 0); return this; }
  lean() { return this; }
  then(resolve, reject) {
    try {
      let result = this._exec(this._sort);
      if (Array.isArray(result)) {
        result = result.slice(this._skip, this._limit == null ? undefined : this._skip + this._limit);
      }
      return Promise.resolve(result).then(resolve, reject);
    } catch (err) { return Promise.reject(err).then(resolve, reject); }
  }
  catch(fn) { return this.then((v) => v, fn); }
}

function duplicateKeyError(field) {
  const err = new Error(`E11000 duplicate key error (memory db): ${field}`);
  err.code = 11000;
  return err;
}

export function makeMemoryModel(name, schema) {
  const store = [];
  const paths = [];
  schema.eachPath((p, type) => {
    if (p === '_id' || p === '__v') return;
    paths.push({ path: p, options: type.options || {}, type });
  });
  const timestamps = !!(schema.options && schema.options.timestamps);
  const uniquePaths = paths
    .filter((p) => p.options.unique === true || (p.options.index && p.options.index.unique === true))
    .map((p) => p.path);

  class MemoryDoc {
    constructor(fields = {}) {
      Object.assign(this, fields);
      if (!this._id) this._id = newObjectId();
      for (const { path, options } of paths) {
        if (getPath(this, path) === undefined && options.default !== undefined && !path.includes('.')) {
          this[path] = typeof options.default === 'function' ? options.default() : options.default;
        }
      }
      if (timestamps) {
        if (!this.createdAt) this.createdAt = new Date();
        if (!this.updatedAt) this.updatedAt = new Date();
      }
    }

    async validate() {
      for (const { path, options } of paths) {
        if (path.includes('.')) continue;
        const value = this[path];
        const required = Array.isArray(options.required) ? options.required[0] : options.required;
        if (required && (value === undefined || value === null || value === '')) {
          throw new Error(`Path \`${path}\` is required.`);
        }
        if (options.enum && Array.isArray(options.enum) && value != null && !options.enum.includes(value)) {
          throw new Error(`\`${value}\` is not a valid enum value for path \`${path}\`.`);
        }
        if (typeof options.min === 'number' && typeof value === 'number' && value < options.min) {
          throw new Error(`Path \`${path}\` (${value}) is less than minimum allowed value (${options.min}).`);
        }
        if (typeof options.minlength === 'number' && typeof value === 'string' && value.length < options.minlength) {
          throw new Error(`Path \`${path}\` is shorter than the minimum allowed length (${options.minlength}).`);
        }
      }
    }

    _checkUnique() {
      for (const field of uniquePaths) {
        const value = this[field];
        if (value === undefined || value === null) continue;
        const clash = store.find((d) => d !== this && eq(d[field], value));
        if (clash) throw duplicateKeyError(field);
      }
    }

    async save() {
      if (timestamps) this.updatedAt = new Date();
      await this.validate();
      this._checkUnique();
      if (!store.includes(this)) store.push(this);
      return this;
    }

    async deleteOne() {
      const i = store.indexOf(this);
      if (i >= 0) store.splice(i, 1);
      return this;
    }

    toObject() { return JSON.parse(JSON.stringify({ ...this }, bufferSafe)); }
    toJSON() { return this.toObject(); }
  }

  // Buffers must survive toObject for the Image model
  function bufferSafe(_key, value) { return value; }
  MemoryDoc.prototype.toObject = function toObject() {
    const out = {};
    for (const [k, v] of Object.entries(this)) out[k] = v;
    return out;
  };
  MemoryDoc.prototype.toJSON = MemoryDoc.prototype.toObject;

  Object.assign(MemoryDoc.prototype, schema.methods || {});

  const Model = {
    modelName: name,
    _store: store,

    find(filter = {}) {
      return new Query((sort) => sortDocs(store.filter((d) => matches(d, filter)), sort));
    },
    findOne(filter = {}) {
      return new Query((sort) => sortDocs(store.filter((d) => matches(d, filter)), sort)[0] || null);
    },
    findById(id) {
      return new Query(() => store.find((d) => eq(d._id, id)) || null);
    },
    async countDocuments(filter = {}) {
      return store.filter((d) => matches(d, filter)).length;
    },
    async create(fields) {
      const doc = new MemoryDoc(fields);
      await doc.save();
      return doc;
    },
    async insertMany(items) {
      const docs = [];
      for (const item of items) {
        const doc = item instanceof MemoryDoc ? item : new MemoryDoc(item);
        await doc.save();
        docs.push(doc);
      }
      return docs;
    },
    async deleteOne(filter = {}) {
      const idx = store.findIndex((doc) => matches(doc, filter));
      if (idx === -1) return { deletedCount: 0 };
      store.splice(idx, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(filter = {}) {
      const keep = store.filter((d) => !matches(d, filter));
      const deletedCount = store.length - keep.length;
      store.length = 0;
      store.push(...keep);
      return { deletedCount };
    },
    async updateMany(filter, update) {
      let n = 0;
      for (const doc of store) {
        if (matches(doc, filter)) { applyUpdate(doc, update); n += 1; }
      }
      return { modifiedCount: n };
    },
    async findOneAndUpdate(filter, update, options = {}) {
      const doc = store.find((d) => matches(d, filter));
      if (!doc) {
        if (options.upsert) {
          const base = {};
          for (const [k, v] of Object.entries(filter)) if (!k.startsWith('$')) base[k] = v;
          const fresh = new MemoryDoc(base);
          applyUpdate(fresh, update);
          await fresh.save();
          return fresh;
        }
        return null;
      }
      applyUpdate(doc, update);
      if (timestamps) doc.updatedAt = new Date();
      return doc;
    },
    async findByIdAndUpdate(id, update, options = {}) {
      const doc = store.find((d) => eq(d._id, id));
      if (!doc) return null;
      applyUpdate(doc, update);
      if (timestamps) doc.updatedAt = new Date();
      return doc;
    },
    async findOneAndDelete(filter = {}) {
      const doc = store.find((d) => matches(d, filter));
      if (doc) await doc.deleteOne();
      return doc || null;
    },
    async findByIdAndDelete(id) {
      const doc = store.find((d) => eq(d._id, id));
      if (doc) await doc.deleteOne();
      return doc || null;
    },
  };

  Object.assign(Model, schema.statics || {});
  return Model;
}

export function enableMemoryDb() {
  const registry = new Map();
  mongoose.model = function patchedModel(name, schema) {
    if (registry.has(name)) return registry.get(name);
    if (!schema) throw new Error(`Memory DB: model "${name}" requested before registration`);
    const model = makeMemoryModel(name, schema);
    registry.set(name, model);
    return model;
  };
  console.warn('⚠️  MEMORY_DB mode: using in-process data store — all data is lost on restart. NEVER use in production.');
}
