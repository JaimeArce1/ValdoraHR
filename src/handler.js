// Gestore unico delle richieste: sessione, accesso, permessi, pagine e API.
// Indipendente dalla piattaforma: riceve una Request e uno store di sessioni e
// restituisce una Response. Lo store espone scritture condizionate:
//   get(id) -> { record, etag } | null
//   create(id, record) -> true se la chiave non esisteva
//   update(id, record, etag) -> true se l'etag era ancora quello letto
// così due invii ravvicinati della stessa sessione non si sovrascrivono.
import { randomUUID } from "node:crypto";
import { initialData } from "./data.js";
import { canApprove, canEditEmployees, canSeeEmployees, roleOf } from "./access.js";
import { runApi } from "./api.js";
import { employee, isCeased } from "./domain.js";
import {
  approvalsPage, ceasedEditPage, dashboardPage, departmentsPage, employeeDetailPage, employeeFormPage,
  employeesPage, forbiddenPage, layout, leavePage, loginPage, notFoundPage, orgChartPage, payslipPage,
  profilePage, timesheetPage,
} from "./views.js";

const SESSION_COOKIE = "vhr_session";
const FLASH_COOKIE = "vhr_flash";
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WRITE_ATTEMPTS = 5;

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null; // percent-encoding non valida: la risorsa non esiste
  }
}

function parseCookies(header) {
  const cookies = {};
  for (const part of (header || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return cookies;
}

function cookie(name, value, { secure, maxAge, httpOnly = true }) {
  return [`${name}=${value}`, "Path=/", "SameSite=Lax", httpOnly ? "HttpOnly" : "", secure ? "Secure" : "", maxAge !== undefined ? `Max-Age=${maxAge}` : ""]
    .filter(Boolean)
    .join("; ");
}

const BASE_HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };

/** Pagine: percorso → { title, active, allowed(role, data, user), render(...) }. */
function resolvePage(pathname) {
  const routes = {
    "/dashboard": { title: "Dashboard", render: ({ data, user }) => dashboardPage(data, user) },
    "/dipendenti": { title: "Dipendenti", allowed: ({ role }) => canSeeEmployees(role), render: ({ data, user, url }) => employeesPage(data, user, url) },
    "/dipendenti/nuovo": { title: "Nuovo dipendente", active: "/dipendenti", allowed: ({ role }) => canEditEmployees(role), render: ({ data }) => employeeFormPage(data) },
    "/reparti": { title: "Reparti", allowed: ({ role }) => canSeeEmployees(role), render: ({ data }) => departmentsPage(data) },
    "/organigramma": { title: "Organigramma", render: ({ data }) => orgChartPage(data) },
    "/ferie": { title: "Ferie", render: ({ data, user }) => leavePage(data, user) },
    "/ferie/approvazioni": { title: "Da approvare", allowed: ({ data, user }) => canApprove(data, user), render: ({ data, user }) => approvalsPage(data, user) },
    "/presenze": { title: "Presenze", render: ({ data, user }) => timesheetPage(data, user) },
    "/buste-paga": {
      title: "Buste paga",
      allowed: ({ role, user, url }) => {
        const asked = url.searchParams.get("matricola");
        return role === "hr" || !asked || asked === user;
      },
      exists: ({ data, url }) => !url.searchParams.get("matricola") || Boolean(employee(data, url.searchParams.get("matricola"))),
      render: ({ data, user, url }) => payslipPage(data, user, url),
    },
    "/profilo": { title: "Profilo", render: ({ data, user }) => profilePage(data, user) },
  };
  if (routes[pathname]) return { active: pathname, ...routes[pathname] };
  let match = /^\/dipendenti\/([^/]+)\/modifica$/.exec(pathname);
  if (match) {
    const matricola = decodeSegment(match[1]);
    return {
      title: "Modifica dipendente",
      active: "/dipendenti",
      allowed: ({ role }) => canEditEmployees(role),
      exists: ({ data }) => Boolean(employee(data, matricola)),
      render: ({ data }) => {
        const e = employee(data, matricola);
        return isCeased(e) ? ceasedEditPage(e) : employeeFormPage(data, e);
      },
    };
  }
  match = /^\/dipendenti\/([^/]+)$/.exec(pathname);
  if (match) {
    const matricola = decodeSegment(match[1]);
    return {
      title: "Scheda dipendente",
      active: "/dipendenti",
      allowed: ({ role }) => canSeeEmployees(role),
      exists: ({ data }) => Boolean(employee(data, matricola)),
      render: ({ data, user }) => employeeDetailPage(data, user, employee(data, matricola)),
    };
  }
  return null;
}

export async function handle(request, sessions) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const cookies = parseCookies(request.headers.get("cookie"));
  const setCookies = [];

  let sessionId = cookies[SESSION_COOKIE];
  let known = Boolean(sessionId && SESSION_ID.test(sessionId));
  if (!known) {
    sessionId = randomUUID();
    setCookies.push(cookie(SESSION_COOKIE, sessionId, { secure }));
  }
  // Copia dei dati iniziali solo alla prima scrittura: finché la sessione legge, vale il seed.
  const load = async () => {
    const stored = known ? await sessions.get(sessionId) : null;
    const loaded = stored?.record ?? { v: 1, user: null, data: initialData() };
    if (loaded.user && !employee(loaded.data, loaded.user)) loaded.user = null;
    return { state: loaded, exists: Boolean(stored), etag: stored?.etag ?? null };
  };
  let { state, exists, etag } = await load();

  const headers = new Headers(BASE_HEADERS);
  const finish = async (response) => {
    for (const value of setCookies) response.headers.append("set-cookie", value);
    return response;
  };

  // ------------------------------------------------------------ API
  if (url.pathname.startsWith("/api/")) {
    let body = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }
    let result;
    for (let attempt = 1; ; attempt += 1) {
      result = runApi(state, url.pathname, request.method, body);
      if (!result.changed) break;
      const saved = exists ? await sessions.update(sessionId, state, etag) : await sessions.create(sessionId, state);
      if (saved) break;
      if (attempt >= WRITE_ATTEMPTS) {
        result = { status: 503, body: { ok: false, errors: {}, message: "Operazione non riuscita, riprova." } };
        break;
      }
      // Un'altra richiesta della stessa sessione ha scritto prima: rileggi e riapplica.
      known = true;
      ({ state, exists, etag } = await load());
    }
    if (result.flash) setCookies.push(cookie(FLASH_COOKIE, encodeURIComponent(result.flash), { secure }));
    headers.set("content-type", "application/json; charset=utf-8");
    return finish(new Response(JSON.stringify(result.body), { status: result.status, headers }));
  }

  // ------------------------------------------------------------ pagine
  let flash = "";
  if (cookies[FLASH_COOKIE]) {
    try {
      flash = decodeURIComponent(cookies[FLASH_COOKIE]);
    } catch {
      flash = "";
    }
    setCookies.push(cookie(FLASH_COOKIE, "", { secure, maxAge: 0 }));
  }
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const redirect = (location) => {
    headers.set("location", location);
    return finish(new Response(null, { status: 302, headers }));
  };
  const html = (status, title, body, active = "") => {
    headers.set("content-type", "text/html; charset=utf-8");
    const page = layout({ title, data: state.data, user: state.user, active, flash, body });
    return finish(new Response(request.method === "HEAD" ? null : page, { status, headers }));
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    headers.set("allow", "GET, HEAD");
    return finish(new Response("Metodo non consentito", { status: 405, headers }));
  }

  if (pathname === "/accedi") return html(200, "Accedi", loginPage({ ritorno: url.searchParams.get("ritorno") }));
  if (pathname === "/") return redirect(state.user ? "/dashboard" : "/accedi");
  if (!state.user) return redirect(`/accedi?ritorno=${encodeURIComponent(pathname + url.search)}`);

  const page = resolvePage(pathname);
  if (!page) return html(404, "Pagina non trovata", notFoundPage());
  const context = { data: state.data, user: state.user, role: roleOf(state.user), url };
  if (page.allowed && !page.allowed(context)) return html(403, "Accesso non consentito", forbiddenPage());
  if (page.exists && !page.exists(context)) return html(404, "Pagina non trovata", notFoundPage());
  return html(200, page.title, page.render(context), page.active);
}
