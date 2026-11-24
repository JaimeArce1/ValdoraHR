// Smoke test di un deploy di Valdora HR (o del server locale).
// Uso:  node scripts/smoke.mjs https://release-1-0--<sito>.netlify.app
// Verifica pagine, redirect, file statici, 404 e, soprattutto, lo stato per sessione
// in Netlify Blobs: scrittura e rilettura subito dopo, sessioni separate, due invii
// paralleli della stessa sessione che non si perdono. Non tocca le API vietate ai test.
const base = (process.argv[2] || "http://localhost:8888").replace(/\/+$/, "");
const PASSWORD = "Valdora2026!";
let failures = 0;

function check(label, condition, detail = "") {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${!condition && detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}

function browser() {
  const jar = new Map();
  async function send(method, path, body) {
    const headers = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";").map((s) => s.trim());
      const [k, v] = pair.split("=");
      if (attrs.some((a) => a.toLowerCase() === "max-age=0")) jar.delete(k);
      else jar.set(k, v);
    }
    return res;
  }
  return {
    jar,
    async page(path) {
      const res = await send("GET", path);
      return { status: res.status, headers: res.headers, text: await res.text() };
    },
    async post(path, body = {}) {
      const res = await send("POST", path, body);
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    async login(email) {
      return this.post("/api/accedi", { email, password: PASSWORD });
    },
  };
}

const value = (html, testid) => {
  const match = new RegExp(`data-testid="${testid}"[^>]*>([^<]*)<`).exec(html);
  return match ? match[1].trim() : null;
};

console.log(`Valdora HR smoke test su ${base}\n`);

// Pagine e redirect senza accesso.
const anon = browser();
let r = await anon.page("/accedi");
check("GET /accedi risponde 200 con il modulo", r.status === 200 && r.text.includes('data-testid="login-email"'), `status ${r.status}`);
check("le pagine non sono in cache (private, no-store)", /no-store/.test(r.headers.get("cache-control") || ""), r.headers.get("cache-control"));
check("cookie di sessione assegnato", anon.jar.has("vhr_session"));
r = await anon.page("/dashboard");
check("senza accesso /dashboard porta ad /accedi?ritorno=%2Fdashboard", r.status === 302 && r.headers.get("location") === "/accedi?ritorno=%2Fdashboard", `${r.status} ${r.headers.get("location")}`);
const css = await fetch(`${base}/assets/site.css`);
check("file statico /assets/site.css servito come CSS", css.status === 200 && /text\/css/.test(css.headers.get("content-type") || ""), `${css.status} ${css.headers.get("content-type")}`);

// Accesso e lettura.
const sara = browser();
let login = await sara.login("sara.conti@valdora.example");
check("accesso di Sara Conti", login.body.ok === true, JSON.stringify(login.body));
r = await sara.page("/dashboard");
check("dashboard: ferie residue 15", value(r.text, "kpi-ferie-residue") === "15", value(r.text, "kpi-ferie-residue"));
check("piede con la data di sistema", value(r.text, "system-date") === "Data di sistema: mercoledì 18 novembre 2026");
r = await sara.page("/dipendenti");
check("permessi: il dipendente riceve 403 su /dipendenti", r.status === 403, `status ${r.status}`);
r = await sara.page("/pagina-inesistente");
check("indirizzo sconosciuto con accesso: 404 del sito", r.status === 404 && value(r.text, "not-found-message") === "Pagina non trovata.", `status ${r.status}`);

// Scrittura in Blobs e rilettura immediata (consistenza strong).
const sent = await sara.post("/api/ferie", { inizio: "14/12/2026", fine: "16/12/2026" });
check("nuova richiesta di ferie salvata", sent.body.ok === true, JSON.stringify(sent.body));
r = await sara.page("/ferie");
check("la richiesta si rilegge subito (in attesa 5, F-2031)", value(r.text, "leave-pending") === "5" && value(r.text, "leave-status-F-2031") === "In attesa", `in attesa ${value(r.text, "leave-pending")}`);
check("messaggio dopo l'invio", value(r.text, "flash-message") === "Richiesta F-2031 inviata.", value(r.text, "flash-message"));

// Sessione nuova: dati iniziali.
const other = browser();
await other.login("sara.conti@valdora.example");
r = await other.page("/ferie");
check("un'altra sessione riparte dai dati iniziali (in attesa 2)", value(r.text, "leave-pending") === "2", value(r.text, "leave-pending"));

// Due approvazioni parallele nella stessa sessione (scritture condizionate).
const paolo = browser();
login = await paolo.login("paolo.neri@valdora.example");
check("accesso di Paolo Neri", login.body.ok === true);
const both = await Promise.all([paolo.post("/api/ferie/approva", { id: "F-1004" }), paolo.post("/api/ferie/approva", { id: "F-1005" })]);
check("le due approvazioni rispondono ok", both.every((x) => x.body.ok === true), JSON.stringify(both.map((x) => x.status)));
r = await paolo.page("/ferie/approvazioni");
check("entrambe applicate: Da approvare (1)", value(r.text, "nav-approvazioni") === "Da approvare (1)", value(r.text, "nav-approvazioni"));

console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli passati");
process.exitCode = failures ? 1 : 0;
