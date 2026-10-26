// Helpers for finding references to Flock's immutable /api/images/:id URLs.
// Keep this recursive so future nested photo fields are included automatically.
const IMAGE_PATH = /^\/api\/images\/([a-f0-9]{24})$/i;

export function extractImageIds(value) {
  const ids = new Set();
  const visited = new Set();
  const visit = (item) => {
    if (typeof item === 'string') {
      const match = item.match(IMAGE_PATH);
      if (match) ids.add(match[1].toLowerCase());
      return;
    }
    if (!item || typeof item !== 'object' || visited.has(item)) return;
    visited.add(item);
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    for (const child of Object.values(item)) visit(child);
  };
  visit(value);
  return ids;
}

export function findUnreferencedImageIds(candidateIds, datastoreValues) {
  const referenced = new Set();
  for (const value of datastoreValues || []) {
    for (const id of extractImageIds(value)) referenced.add(id);
  }
  return [...new Set([...candidateIds].map((id) => String(id).toLowerCase()))]
    .filter((id) => !referenced.has(id));
}
