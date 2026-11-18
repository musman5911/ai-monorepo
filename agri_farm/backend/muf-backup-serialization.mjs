function plainBackupRecord(document) {
  const value = document && typeof document.toObject === 'function'
    ? document.toObject({ depopulate: true, flattenMaps: true })
    : document;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Backup records must be objects.');
  }
  const record = { ...value };
  const id = document?._id ?? record._id;
  if (id !== undefined && id !== null) record._id = String(id);
  delete record.$__;
  delete record._doc;
  delete record.$isNew;
  return record;
}

export function stringifyDocs(docs) {
  if (!Array.isArray(docs)) throw new TypeError('Backup documents must be an array.');
  return docs.map(plainBackupRecord);
}

export function stringifyBackupUsers(users) {
  return stringifyDocs(users).map((user) => {
    const { password, ...safeUser } = user;
    return safeUser;
  });
}
