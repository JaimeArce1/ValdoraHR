// Store di sessioni in memoria con le stesse scritture condizionate di Netlify Blobs
// (etag = versione). Usato dal server locale e dai test; `delay` simula la latenza
// di uno store remoto fra lettura e scrittura.
export function memoryStore({ delay = 0 } = {}) {
  const entries = new Map();
  const wait = () => (delay ? new Promise((resolve) => setTimeout(resolve, delay)) : null);
  return {
    async get(id) {
      await wait();
      const entry = entries.get(id);
      return entry ? { record: JSON.parse(entry.json), etag: String(entry.version) } : null;
    },
    async create(id, record) {
      await wait();
      if (entries.has(id)) return false;
      entries.set(id, { json: JSON.stringify(record), version: 1 });
      return true;
    },
    async update(id, record, etag) {
      await wait();
      const entry = entries.get(id);
      if (!entry || String(entry.version) !== etag) return false;
      entries.set(id, { json: JSON.stringify(record), version: entry.version + 1 });
      return true;
    },
  };
}
