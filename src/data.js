// Dati iniziali di ogni sessione, dal seed generato da scripts/gen_seed.py.
import seed from "../data/seed.json" with { type: "json" };

export const SEED = seed;
const SEED_BY_MATRICOLA = new Map(seed.dipendenti.map((e) => [e.matricola, e]));

/** Il dipendente com'era nel seed (fonte delle buste paga già elaborate), o null. */
export const seedEmployee = (matricola) => SEED_BY_MATRICOLA.get(matricola) || null;

export const USERS = seed.utenti;

export function initialData() {
  return {
    reparti: structuredClone(seed.reparti),
    dipendenti: seed.dipendenti.map((e) => ({
      ...structuredClone(e),
      indirizzo: "",
      emergenza_nome: "",
      emergenza_telefono: "",
    })),
    ferie: structuredClone(seed.ferie),
    presenze: structuredClone(seed.presenze),
  };
}
