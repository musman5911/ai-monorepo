function asVersion(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Restore the Flock key/value data as a snapshot.
 *
 * New multi-farm backups carry an authoritative farmBuckets array for each
 * known key. Replace that key across farms so data created after the snapshot
 * cannot silently survive a restore. Legacy backups carry only buckets and
 * continue to affect the default farm, preserving other farms.
 *
 * The caller runs this unscoped and holds all farm locks.
 */
export async function restoreFlockFarmBuckets({
  DataStore,
  bucketKeys,
  farmBuckets,
  buckets,
  defaultFarmId,
}) {
  for (const key of bucketKeys) {
    const rows = farmBuckets?.[key];
    if (Array.isArray(rows)) {
      const existingRows = await DataStore.find({ key }).lean();
      const priorVersions = new Map();
      for (const doc of existingRows) {
        const farmId = String(doc.farmId || defaultFarmId || '').trim();
        if (!farmId) continue;
        priorVersions.set(farmId, Math.max(priorVersions.get(farmId) || 0, asVersion(doc.version)));
      }

      // Delete only this business-data bucket. Monthly backups, image chunks,
      // egg locks and other internal DataStore keys are not touched.
      await DataStore.deleteMany({ key });
      for (const row of rows) {
        const farmId = String(row.farmId || '').trim();
        if (!farmId) continue;
        const version = Math.max(priorVersions.get(farmId) || 0, asVersion(row.version)) + 1;
        await DataStore.create({ key, farmId, value: row.value, version });
      }
      continue;
    }

    // Compatibility with pre-multi-farm snapshots. Only the default farm is
    // changed because those backups never contained other farms' data.
    if (!buckets || !Object.prototype.hasOwnProperty.call(buckets, key)) continue;
    const farmId = String(defaultFarmId || '').trim();
    if (!farmId) continue;
    const existingRows = await DataStore.find({ key }).lean();
    const current = existingRows.find((doc) => String(doc.farmId || farmId) === farmId) || null;

    if (buckets[key] === null) {
      if (current) await DataStore.deleteOne({ _id: current._id });
      continue;
    }

    const version = Math.max(asVersion(current?.version), 0) + 1;
    if (current) {
      await DataStore.findOneAndUpdate(
        { _id: current._id },
        { $set: { farmId, value: buckets[key], version } },
      );
    } else {
      await DataStore.create({ key, farmId, value: buckets[key], version });
    }
  }
}
