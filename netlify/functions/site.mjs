// Unica funzione del sito: rende ogni pagina e risponde alle API.
// I file statici (public/assets, robots.txt) hanno la precedenza (preferStatic).
import { getDeployStore } from "@netlify/blobs";
import { handle } from "../../src/handler.js";

let warnedNoEtag = false;

// Lo store è legato al deploy: due release (due branch deploy) non condividono mai
// le sessioni. Lettura `strong`: dopo un invio la pagina successiva vede il dato nuovo.
// Scritture condizionate sull'etag: due invii ravvicinati della stessa sessione non
// si sovrascrivono (il gestore rilegge e riapplica).
function blobSessions() {
  const store = getDeployStore({ name: "sessions", consistency: "strong" });
  return {
    async get(id) {
      const entry = await store.getWithMetadata(id, { type: "json" });
      return entry ? { record: entry.data, etag: entry.etag ?? null } : null;
    },
    async create(id, record) {
      return (await store.setJSON(id, record, { onlyIfNew: true })).modified;
    },
    async update(id, record, etag) {
      if (!etag) {
        // La sandbox locale di `netlify dev` non restituisce etag: senza, la scrittura
        // condizionata è impossibile e si scrive senza condizione (niente protezione
        // dalla concorrenza). In produzione l'etag c'è; lo smoke test lo verifica.
        if (!warnedNoEtag) {
          console.warn("Netlify Blobs: nessun etag in lettura, scritture delle sessioni senza condizione");
          warnedNoEtag = true;
        }
        await store.setJSON(id, record);
        return true;
      }
      return (await store.setJSON(id, record, { onlyIfMatch: etag })).modified;
    },
  };
}

export default async (request) => handle(request, blobSessions());

export const config = {
  path: "/*",
  preferStatic: true,
};
