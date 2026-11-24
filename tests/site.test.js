// Flussi del sito sul gestore vero (stesso codice della funzione Netlify), con sessioni in memoria.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/handler.js";
import { memoryStore } from "../src/memory-store.js";

/** Un browser: cookie jar + store condiviso. */
function browser(store = memoryStore()) {
  const jar = new Map();
  const send = async (method, path, body) => {
    const headers = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body) headers["content-type"] = "application/json";
    const res = await handle(new Request(`https://valdora.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), store);
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split("; ");
      const [k, v] = pair.split("=");
      if (attrs.includes("Max-Age=0")) jar.delete(k);
      else jar.set(k, v);
    }
    return res;
  };
  return {
    store,
    get: (path) => send("GET", path),
    post: async (path, body) => {
      const res = await send("POST", path, body || {});
      return { status: res.status, body: await res.json() };
    },
    async html(path) {
      const res = await send("GET", path);
      return { status: res.status, text: await res.text(), location: res.headers.get("location") };
    },
    async login(email) {
      const r = await this.post("/api/accedi", { email, password: "Valdora2026!" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r;
    },
  };
}

const text = (html, testid) => {
  const m = new RegExp(`data-testid="${testid}"[^>]*>([^<]*)<`).exec(html);
  return m ? m[1].trim() : null;
};
const HR = "laura.bianchi@valdora.example";
const MANAGER = "paolo.neri@valdora.example";
const EMPLOYEE = "sara.conti@valdora.example";

test("accesso, ritorno e redirect", async () => {
  const b = browser();
  let r = await b.html("/presenze?x=1");
  assert.equal(r.status, 302);
  assert.equal(r.location, "/accedi?ritorno=%2Fpresenze%3Fx%3D1");
  r = await b.html("/pagina-inesistente");
  assert.equal(r.location, "/accedi?ritorno=%2Fpagina-inesistente");
  assert.equal((await b.html("/")).location, "/accedi");
  const empty = await b.post("/api/accedi", {});
  assert.deepEqual(empty.body.errors, { "login-email-error": "Inserisci l'email.", "login-password-error": "Inserisci la password." });
  const wrong = await b.post("/api/accedi", { email: HR, password: "no" });
  assert.deepEqual(wrong.body.errors, { "login-error": "Email o password non corrette." });
  const okLogin = await b.post("/api/accedi", { email: "Laura.Bianchi@VALDORA.example", password: "Valdora2026!", ritorno: "/presenze?x=1" });
  assert.equal(okLogin.body.redirect, "/presenze?x=1");
  for (const bad of ["//esempio.org", "https://esempio.org", "/\\esempio.org"]) {
    const res = await b.post("/api/accedi", { email: HR, password: "Valdora2026!", ritorno: bad });
    assert.equal(res.body.redirect, "/dashboard", bad);
  }
  r = await b.html("/accedi");
  assert.equal(r.status, 200, "/accedi mostra sempre il modulo");
  await b.post("/api/esci");
  r = await b.html("/accedi");
  assert.equal(text(r.text, "flash-message"), "Sei uscito.");
});

test("dashboard HR, menu e piede", async () => {
  const b = browser();
  await b.login(HR);
  const { text: page } = await b.html("/dashboard");
  assert.equal(text(page, "user-greeting"), "Ciao, Laura");
  assert.equal(text(page, "kpi-attivi"), "33");
  assert.equal(text(page, "kpi-in-ferie-oggi"), "2");
  assert.equal(text(page, "kpi-in-attesa"), "5");
  assert.equal(text(page, "kpi-costo-mensile"), "88.611,53 €");
  assert.equal(text(page, "nav-approvazioni"), "Da approvare (1)");
  assert.equal(text(page, "system-date"), "Data di sistema: mercoledì 18 novembre 2026");
  assert.match(page, /per 33 dipendenti attivi\? L'operazione non si può annullare\./);
  const labels = [...page.matchAll(/data-testid="nav-[a-z-]+"[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Dashboard", "Dipendenti", "Reparti", "Organigramma", "Ferie", "Da approvare (1)", "Presenze", "Buste paga", "Profilo"]);
});

test("permessi: 403 prima di 404", async () => {
  const b = browser();
  await b.login(EMPLOYEE);
  for (const path of ["/dipendenti", "/reparti", "/ferie/approvazioni", "/dipendenti/VLD-0012", "/dipendenti/VLD-9999", "/buste-paga?matricola=VLD-0008"]) {
    const r = await b.html(path);
    assert.equal(r.status, 403, path);
    assert.equal(text(r.text, "forbidden-message"), "Non hai i permessi per aprire questa pagina.");
  }
  assert.equal((await b.html("/pagina-inesistente")).status, 404);
  const m = browser();
  await m.login(MANAGER);
  assert.equal((await m.html("/dipendenti/nuovo")).status, 403);
  assert.equal((await m.html("/dipendenti/VLD-0012/modifica")).status, 403);
  assert.equal((await m.html("/dipendenti/VLD-9999")).status, 404);
  const page = (await m.html("/dipendenti")).text;
  assert.ok(!page.includes("employee-ral-"), "il manager non vede la RAL");
  assert.ok(!page.includes('data-testid="new-employee"'));
});

test("elenco: contatore, paginazione, ricerca", async () => {
  const b = browser();
  await b.login(HR);
  let page = (await b.html("/dipendenti")).text;
  assert.equal(text(page, "results-count"), "33 dipendenti");
  assert.equal(text(page, "page-info"), "Pagina 1 di 4");
  assert.match(page, /data-testid="page-prev"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-testid="page-prev"/);
  page = (await b.html("/dipendenti?q=rossi&stato=tutti&pagina=9")).text;
  assert.equal(text(page, "results-count"), "3 dipendenti");
  page = (await b.html("/dipendenti?q=zzz")).text;
  assert.equal(text(page, "results-count"), "0 dipendenti");
  assert.equal(text(page, "results-empty"), "Nessun dipendente trovato.");
  page = (await b.html("/dipendenti?q=gallo")).text;
  assert.equal(text(page, "results-count"), "1 dipendente");
  page = (await b.html("/dipendenti?pagina=2")).text;
  assert.equal(text(page, "employee-link-VLD-0012"), "Gallo Matteo");
  assert.equal(text(page, "page-info"), "Pagina 2 di 4");
});

test("ferie: anteprima lato server, errori nell'ordine, nuova richiesta, approvazione", async () => {
  const shared = memoryStore();
  const b = browser(shared);
  await b.login(EMPLOYEE);
  let page = (await b.html("/ferie")).text;
  assert.deepEqual(["leave-entitled", "leave-used", "leave-pending", "leave-remaining", "leave-available"].map((id) => text(page, id)), ["26", "11", "2", "15", "13"]);
  let r = await b.post("/api/ferie", { inizio: "01/12/2026", fine: "31/12/2026" });
  assert.deepEqual(r.body.errors, { "leave-error": "Il periodo si sovrappone alla richiesta F-1004." });
  r = await b.post("/api/ferie", { inizio: "10/11/2026", fine: "31/12/2026" });
  assert.deepEqual(r.body.errors, { "leave-error": "Le ferie si chiedono dal 19/11/2026 al 31/12/2026." });
  r = await b.post("/api/ferie", { inizio: "05/12/2026", fine: "06/12/2026" });
  assert.deepEqual(r.body.errors, { "leave-error": "Il periodo non contiene giorni lavorativi." });
  r = await b.post("/api/ferie", { inizio: "16/12/2026", fine: "14/12/2026" });
  assert.deepEqual(r.body.errors, { "leave-end-error": "La data di fine non può precedere l'inizio." });
  r = await b.post("/api/ferie", { inizio: "14/12/2026", fine: "16/12/2026" });
  assert.equal(r.body.redirect, "/ferie");
  page = (await b.html("/ferie")).text;
  assert.equal(text(page, "flash-message"), "Richiesta F-2031 inviata.");
  assert.equal(text(page, "leave-pending"), "5");
  assert.equal(text(page, "leave-available"), "10");
  assert.equal(text(page, "leave-status-F-2031"), "In attesa");
  // Stesso browser: esci e accedi come il responsabile.
  await b.post("/api/esci");
  await b.login(MANAGER);
  page = (await b.html("/ferie/approvazioni")).text;
  assert.equal(text(page, "nav-approvazioni"), "Da approvare (4)");
  assert.equal(text(page, "approval-available-F-1004"), "10");
  r = await b.post("/api/ferie/rifiuta", { id: "F-1005", motivo: "  corto  " });
  assert.deepEqual(r.body.errors, { "reject-reason-F-1005-error": "Indica un motivo di almeno 10 caratteri." });
  r = await b.post("/api/ferie/rifiuta", { id: "F-1005", motivo: "Fermo impianto programmato" });
  assert.equal(r.status, 200);
  r = await b.post("/api/ferie/approva", { id: "F-1004" });
  page = (await b.html("/ferie/approvazioni")).text;
  assert.equal(text(page, "flash-message"), "Richiesta F-1004 approvata.");
  assert.equal(text(page, "nav-approvazioni"), "Da approvare (2)");
  assert.equal((await b.post("/api/ferie/approva", { id: "F-1007" })).status, 403, "non è un suo diretto riporto");
});

test("ferie: oltre i disponibili", async () => {
  const b = browser();
  await b.login(EMPLOYEE);
  const r = await b.post("/api/ferie", { inizio: "10/12/2026", fine: "31/12/2026" });
  assert.deepEqual(r.body.errors, { "leave-error": "Giorni richiesti (15) oltre i disponibili (13)." });
});

test("nuovo dipendente, conteggi e cessazione", async () => {
  const b = browser();
  await b.login(HR);
  let r = await b.post("/api/dipendenti", {});
  for (const id of ["nome", "cognome", "codice-fiscale", "data-nascita", "email", "reparto", "mansione", "responsabile", "contratto", "ral", "data-assunzione"]) {
    assert.equal(r.body.errors[`field-${id}-error`], "Campo obbligatorio.", id);
  }
  const base = {
    nome: "Marta", cognome: "Pace", codice_fiscale: "pcamrt95a41l219x", data_nascita: "01/01/1995", email: "Marta.Pace@valdora.example",
    reparto: "LOG", mansione: "Magazziniera", responsabile: "VLD-0022", contratto: "DET", data_fine: "02/04/2028", part_time: "100", ral: "28.000", data_assunzione: "01/04/2026",
  };
  r = await b.post("/api/dipendenti", base);
  assert.deepEqual(r.body.errors, { "field-data-fine-error": "Un contratto a tempo determinato dura al massimo 24 mesi." });
  r = await b.post("/api/dipendenti", { ...base, codice_fiscale: "CNTSRA91E59D612J", email: "sara.conti@valdora.example", data_fine: "01/04/2028" });
  assert.deepEqual(r.body.errors, { "field-codice-fiscale-error": "Codice fiscale già presente (VLD-0010).", "field-email-error": "Email già assegnata a VLD-0010." });
  r = await b.post("/api/dipendenti", { ...base, data_fine: "01/04/2028" });
  assert.equal(r.body.redirect, "/dipendenti/VLD-0037");
  const detail = (await b.html("/dipendenti/VLD-0037")).text;
  assert.equal(text(detail, "flash-message"), "Dipendente VLD-0037 creato.");
  assert.equal(text(detail, "employee-email"), "marta.pace@valdora.example");
  assert.equal(text(detail, "leave-entitled"), "19");
  const dash = (await b.html("/dashboard")).text;
  assert.equal(text(dash, "kpi-attivi"), "34");
  assert.equal(text(dash, "kpi-costo-mensile"), "90.765,38 €");
  assert.equal(text((await b.html("/reparti")).text, "department-count-LOG"), "7");
  // Cessazioni.
  r = await b.post("/api/dipendenti/cessa", { matricola: "VLD-0008", data: "18/11/2026" });
  assert.deepEqual(r.body.errors, { "termination-date-error": "Assegna prima un nuovo responsabile ai suoi 11 diretti riporti." });
  r = await b.post("/api/dipendenti/cessa", { matricola: "VLD-0006", data: "18/11/2026" });
  assert.deepEqual(r.body.errors, { "termination-date-error": "Assegna prima un nuovo responsabile al suo diretto riporto." });
  r = await b.post("/api/dipendenti/cessa", { matricola: "VLD-0012", data: "17/02/2027" });
  assert.deepEqual(r.body.errors, { "termination-date-error": "La data di cessazione deve essere fra la data di assunzione e il 16/02/2027." });
  r = await b.post("/api/dipendenti/cessa", { matricola: "VLD-0012", data: "18/11/2026" });
  assert.equal(r.status, 200);
  assert.equal(text((await b.html("/dashboard")).text, "kpi-attivi"), "33");
  const list = (await b.html("/dipendenti?stato=cessati")).text;
  assert.equal(text(list, "results-count"), "4 dipendenti");
  const edit = (await b.html("/dipendenti/VLD-0012/modifica")).text;
  assert.equal(text(edit, "employee-ceased-note"), "Dipendente cessato il 18/11/2026: i dati non sono modificabili.");
  // Ciclo di responsabili.
  r = await b.post("/api/dipendenti/aggiorna", { ...base, matricola: "VLD-0008", nome: "Paolo", cognome: "Neri", email: "paolo.neri@valdora.example", reparto: "PRD", mansione: "Responsabile Produzione", responsabile: "VLD-0010", contratto: "IND", ral: "56000", data_nascita: "25/06/1976" });
  assert.deepEqual(r.body.errors, { "field-responsabile-error": "Il responsabile scelto dipende già da questo dipendente." });
});

test("buste paga e presenze", async () => {
  const b = browser();
  await b.login(HR);
  let page = (await b.html("/buste-paga?matricola=VLD-0008&mese=2026-10")).text;
  assert.equal(text(page, "payslip-tax"), "1.089,13 €");
  assert.equal(text(page, "payslip-net"), "2.822,68 €");
  page = (await b.html("/buste-paga?matricola=VLD-0021&mese=2026-10")).text;
  assert.equal(text(page, "payslip-empty"), "Nessuna busta paga elaborata nel 2026.");
  page = (await b.html("/buste-paga?matricola=VLD-0030&mese=2026-10")).text;
  assert.equal(text(page, "payslip-empty"), "Busta paga non disponibile per il mese scelto.");
  page = (await b.html("/buste-paga?matricola=VLD-0030")).text;
  assert.equal(text(page, "payslip-net") !== null, true, "senza mese: la busta più recente");
  const e = browser();
  await e.login(EMPLOYEE);
  page = (await e.html("/buste-paga")).text;
  assert.equal(text(page, "payslip-net"), "1.333,92 €");
  assert.equal(text(page, "payslip-ral"), "31.000,00 €");
  page = (await e.html("/buste-paga?mese=2026-03")).text;
  assert.equal(text(page, "payslip-ral"), "29.000,00 €");
  assert.equal(text(page, "payslip-net"), "1.247,87 €");
  page = (await e.html("/presenze")).text;
  assert.deepEqual([text(page, "timesheet-expected"), text(page, "timesheet-total"), text(page, "timesheet-overtime")], ["32", "13,5", "0"]);
  let r = await e.post("/api/presenze", { "ore-2026-11-16": "6,5", "ore-2026-11-17": "7", "ore-2026-11-18": "12,3" });
  assert.deepEqual(r.body.errors, { "timesheet-hours-2026-11-18-error": "Inserisci da 0 a 12 ore, a mezz'ore (es. 7,5)." });
  r = await e.post("/api/presenze", { "ore-2026-11-16": "12", "ore-2026-11-17": "12", "ore-2026-11-18": "12", "ore-2026-11-19": "9" });
  page = (await e.html("/presenze")).text;
  assert.deepEqual([text(page, "timesheet-total"), text(page, "timesheet-overtime")], ["36", "4"]);
});

test("la sessione nuova riparte dai dati iniziali", async () => {
  const store = memoryStore();
  const a = browser(store);
  await a.login(EMPLOYEE);
  await a.post("/api/ferie", { inizio: "14/12/2026", fine: "16/12/2026" });
  const b = browser(store);
  await b.login(EMPLOYEE);
  assert.equal(text((await b.html("/ferie")).text, "leave-pending"), "2");
});

test("due invii ravvicinati della stessa sessione non si perdono (store con latenza)", async () => {
  const b = browser(memoryStore({ delay: 5 }));
  await b.login(MANAGER);
  const [first, second] = await Promise.all([
    b.post("/api/ferie/approva", { id: "F-1004" }),
    b.post("/api/ferie/approva", { id: "F-1005" }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const page = (await b.html("/ferie/approvazioni")).text;
  assert.equal(text(page, "nav-approvazioni"), "Da approvare (1)");
  assert.ok(!page.includes('approval-row-F-1004') && !page.includes('approval-row-F-1005'));
});

test("presenze part-time con ferie approvate: totali al decimo", async () => {
  const b = browser();
  await b.login(EMPLOYEE);
  await b.post("/api/ferie", { inizio: "19/11/2026", fine: "20/11/2026" });
  await b.post("/api/esci");
  await b.login(MANAGER);
  assert.equal((await b.post("/api/ferie/approva", { id: "F-2031" })).status, 200);
  await b.post("/api/esci");
  await b.login(EMPLOYEE);
  let page = (await b.html("/presenze")).text;
  assert.equal(text(page, "timesheet-total"), "26,3");
  await b.post("/api/presenze", { "ore-2026-11-16": "6,5", "ore-2026-11-17": "7", "ore-2026-11-18": "7" });
  page = (await b.html("/presenze")).text;
  assert.deepEqual([text(page, "timesheet-total"), text(page, "timesheet-overtime")], ["33,3", "1,3"]);
});

test("ritorno con caratteri di controllo e percent-encoding non valido", async () => {
  const b = browser();
  const r = await b.post("/api/accedi", { email: HR, password: "Valdora2026!", ritorno: "/\t/example.org/" });
  assert.equal(r.body.redirect, "/dashboard");
  assert.equal((await b.html("/dipendenti/%E0%A4%A")).status, 404);
  assert.equal((await b.html("/dipendenti/%E0%A4%A/modifica")).status, 404);
});
