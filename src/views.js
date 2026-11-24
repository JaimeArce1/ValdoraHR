// Pagine HTML di Valdora HR (SPEC §3-§16). Ogni funzione restituisce il solo corpo;
// `layout` aggiunge intestazione, menu, messaggio e piede.
import { seedEmployee } from "./data.js";
import { canApprove, canEditEmployees, menu, roleOf } from "./access.js";
import {
  CONTRACTS, HOLIDAYS, LEAVE_STATUS, PAGE_SIZE, PART_TIMES, PROCESSED_MONTHS, TODAY,
  activeEmployees, allPending, byName, contractLabel, department, directReports, employee, filterEmployees,
  fullName, hoursLabel, isActive, isCeased, leaveSummary, listName, monthlyCost, onLeaveToday,
  payslipsFor, pendingForApprover, statusLabel, timesheet,
} from "./domain.js";
import { esc, formatHours, formatItDate, formatLongDate, formatMoney, monthLabel } from "./util.js";

const t = (id) => `data-testid="${id}"`;

// ------------------------------------------------------------------ layout
export function layout({ title, data, user, active, flash, body }) {
  const nav = user
    ? `<nav class="menu" aria-label="Menu principale">${menu(data, user)
        .map((item) => {
          const label = item.counter ? `${item.label} (${pendingForApprover(data, user).length})` : item.label;
          const current = item.href === active ? ' aria-current="page"' : "";
          return `<a href="${item.href}" ${t(item.id)}${current}>${esc(label)}</a>`;
        })
        .join("")}</nav>
      <div class="who"><span ${t("user-greeting")}>Ciao, ${esc(employee(data, user)?.nome || "")}</span>
      <button type="button" class="link-button" ${t("logout")} data-post="/api/esci">Esci</button></div>`
    : "";
  const flashBox = flash ? `<div class="flash" role="status" ${t("flash-message")}>${esc(flash)}</div>` : "";
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Valdora HR</title>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
</head>
<body>
<header class="topbar"><a class="logo" href="${user ? "/dashboard" : "/accedi"}">Valdora HR</a>${nav}</header>
<main>
${flashBox}
${body}
</main>
<footer><span ${t("system-date")}>Data di sistema: ${formatLongDate(TODAY)}</span> · Officine Valdora S.r.l. — dati inventati</footer>
</body>
</html>`;
}

const errorSlot = (id) => `<p class="error" ${t(`${id}-error`)} hidden></p>`;
const formError = (id) => `<p class="error form-error" ${t(id)} hidden></p>`;

function field({ id, name, label, value = "", type = "text", placeholder = "", readonly = false, hint = "" }) {
  return `<div class="field"><label for="${id}">${esc(label)}</label>
<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${t(id)}${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}${readonly ? " readonly" : ""}>
${hint ? `<small>${esc(hint)}</small>` : ""}${errorSlot(id)}</div>`;
}

function select({ id, name, label, options, value = "", extra = "" }) {
  const opts = options
    .map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}${o.attrs || ""}>${esc(o.label)}</option>`)
    .join("");
  return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" name="${name}" ${t(id)}${extra}>${opts}</select>${errorSlot(id)}</div>`;
}

// ------------------------------------------------------------------ accesso
export function loginPage({ ritorno }) {
  return `<section class="card narrow"><h1>Accedi</h1>
<form data-api="/api/accedi" novalidate>
<input type="hidden" name="ritorno" value="${esc(ritorno || "")}">
${field({ id: "login-email", name: "email", label: "Email", type: "email" })}
${field({ id: "login-password", name: "password", label: "Password", type: "password" })}
${formError("login-error")}
<button type="submit" class="primary" ${t("login-submit")}>Accedi</button>
</form>
<p class="muted">Ambiente di prova con dati inventati.</p></section>`;
}

export const forbiddenPage = () => `<section class="card"><h1>Accesso non consentito</h1><p ${t("forbidden-message")}>Non hai i permessi per aprire questa pagina.</p><p><a href="/dashboard">Torna alla dashboard</a></p></section>`;
export const notFoundPage = () => `<section class="card"><h1>404</h1><p ${t("not-found-message")}>Pagina non trovata.</p><p><a href="/dashboard" ${t("not-found-home")}>Torna alla dashboard</a></p></section>`;

// ------------------------------------------------------------------ dashboard
const kpi = (id, label, value) => `<div class="kpi"><span>${esc(label)}</span><strong ${t(id)}>${esc(value)}</strong></div>`;

function onLeaveList(people) {
  const items = people.map((e) => `<li ${t(`on-leave-${e.matricola}`)}>${esc(fullName(e))}</li>`).join("");
  return `<section class="card"><h2>In ferie oggi</h2><ul ${t("on-leave-list")}>${items || "<li class=\"muted\">Nessuno</li>"}</ul></section>`;
}

export function dashboardPage(data, user) {
  const role = roleOf(user);
  const me = employee(data, user);
  let cards = "";
  let extra = "";
  if (role === "hr") {
    const active = activeEmployees(data).length;
    cards = kpi("kpi-attivi", "Dipendenti attivi", active) + kpi("kpi-in-ferie-oggi", "In ferie oggi", onLeaveToday(data).length) +
      kpi("kpi-in-attesa", "Richieste in attesa", allPending(data).length) + kpi("kpi-costo-mensile", "Costo mensile del personale", formatMoney(monthlyCost(data)));
    extra = onLeaveList(onLeaveToday(data)) + `<section class="card"><h2>Paghe</h2>
<button type="button" class="primary" ${t("payroll-run")} data-open-dialog="payroll-dialog">Elabora paghe di novembre</button>
<dialog id="payroll-dialog" ${t("payroll-dialog")}><p ${t("payroll-dialog-text")}>Elaborare le buste paga di novembre 2026 per ${active} dipendenti attivi? L'operazione non si può annullare.</p>
<div class="actions"><button type="button" class="primary" ${t("payroll-confirm")} data-post="/api/paghe/elabora">Conferma</button>
<button type="button" ${t("payroll-cancel")} data-close-dialog>Annulla</button></div></dialog></section>`;
  } else if (role === "manager") {
    const team = new Set(directReports(data, user).map((e) => e.matricola));
    cards = kpi("kpi-team", "Diretti riporti attivi", team.size) + kpi("kpi-team-in-ferie", "In ferie oggi nel team", onLeaveToday(data, team).length) +
      kpi("kpi-da-approvare", "Da approvare", pendingForApprover(data, user).length);
    extra = onLeaveList(onLeaveToday(data, team));
  } else {
    const summary = leaveSummary(data, user);
    const last = payslipsFor(seedEmployee(user)).at(-1);
    cards = kpi("kpi-ferie-residue", "Ferie residue", summary.remaining) + kpi("kpi-ferie-in-attesa", "Ferie in attesa", summary.pending) +
      kpi("kpi-ultimo-netto", "Ultimo netto", last ? formatMoney(last.net) : "—");
  }
  return `<h1>Buongiorno, ${esc(me?.nome || "")}</h1><section class="kpis">${cards}</section>${extra}`;
}

// ------------------------------------------------------------------ elenco dipendenti
export function parseListQuery(url) {
  const p = url.searchParams;
  const pick = (name, allowed, fallback) => (allowed.includes(p.get(name)) ? p.get(name) : fallback);
  return {
    q: p.get("q") || "",
    reparto: pick("reparto", ["AMM", "HR", "PRD", "LOG", "VEN", "IT"], ""),
    stato: pick("stato", ["attivi", "cessati", "tutti"], "attivi"),
    contratto: pick("contratto", ["IND", "DET", "APP"], ""),
    ordina: pick("ordina", ["cognome-asc", "cognome-desc", "assunzione-desc", "assunzione-asc"], "cognome-asc"),
    pagina: p.get("pagina"),
  };
}

function listHref(url, page) {
  const params = new URLSearchParams(url.searchParams);
  params.set("pagina", String(page));
  return `/dipendenti?${params.toString()}`;
}

export function employeesPage(data, user, url) {
  const role = roleOf(user);
  const query = parseListQuery(url);
  const rows = filterEmployees(data, query);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const requested = /^\d+$/.test(query.pagina || "") ? Number(query.pagina) : 1;
  const page = requested < 1 ? 1 : Math.min(requested, pages);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showRal = role === "hr";
  const count = rows.length === 1 ? "1 dipendente" : `${rows.length} dipendenti`;
  const opt = (value, label) => ({ value, label });
  const filters = `<form class="filters" method="get" action="/dipendenti">
${field({ id: "filter-q", name: "q", label: "Cerca", value: query.q, placeholder: "Nome, cognome o matricola" })}
${select({ id: "filter-reparto", name: "reparto", label: "Reparto", value: query.reparto, options: [opt("", "Tutti i reparti"), ...data.reparti.map((r) => opt(r.codice, r.nome))] })}
${select({ id: "filter-stato", name: "stato", label: "Stato", value: query.stato, options: [opt("attivi", "Attivi"), opt("cessati", "Cessati"), opt("tutti", "Tutti")] })}
${select({ id: "filter-contratto", name: "contratto", label: "Contratto", value: query.contratto, options: [opt("", "Tutti"), ...Object.entries(CONTRACTS).map(([k, v]) => opt(k, v))] })}
${select({ id: "filter-ordina", name: "ordina", label: "Ordina per", value: query.ordina, options: [opt("cognome-asc", "Cognome A-Z"), opt("cognome-desc", "Cognome Z-A"), opt("assunzione-desc", "Assunti più di recente"), opt("assunzione-asc", "Assunti meno di recente")] })}
<div class="filter-actions"><button type="submit" class="primary" ${t("filter-submit")}>Applica</button><a href="/dipendenti" ${t("filter-reset")}>Azzera filtri</a></div>
</form>`;
  const body = shown
    .map((e) => `<tr ${t(`employee-row-${e.matricola}`)}><td>${e.matricola}</td><td><a href="/dipendenti/${e.matricola}" ${t(`employee-link-${e.matricola}`)}>${esc(listName(e))}</a></td>
<td>${esc(department(data, e.reparto)?.nome || e.reparto)}</td><td>${esc(e.mansione)}</td><td>${esc(CONTRACTS[e.contratto])}</td>
<td><span class="badge ${isCeased(e) ? "off" : "on"}" ${t(`employee-status-${e.matricola}`)}>${statusLabel(e)}</span></td>${showRal ? `<td class="num" ${t(`employee-ral-${e.matricola}`)}>${formatMoney(e.ral * 100)}</td>` : ""}</tr>`)
    .join("");
  const table = shown.length
    ? `<table class="grid"><thead><tr><th>Matricola</th><th>Dipendente</th><th>Reparto</th><th>Mansione</th><th>Contratto</th><th>Stato</th>${showRal ? "<th>RAL</th>" : ""}</tr></thead><tbody>${body}</tbody></table>`
    : `<p class="empty" ${t("results-empty")}>Nessun dipendente trovato.</p>`;
  const link = (id, label, target, enabled) =>
    enabled ? `<a href="${listHref(url, target)}" ${t(id)}>${label}</a>` : `<a role="link" aria-disabled="true" class="disabled" ${t(id)}>${label}</a>`;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1)
    .map((n) => `<a href="${listHref(url, n)}" ${t(`page-link-${n}`)}${n === page ? ' aria-current="page"' : ""}>${n}</a>`)
    .join("");
  const pager = `<nav class="pager" aria-label="Pagine" ${t("pagination")}>${link("page-prev", "Precedente", page - 1, page > 1)}${numbers}${link("page-next", "Successiva", page + 1, page < pages)}
<span ${t("page-info")}>Pagina ${page} di ${pages}</span></nav>`;
  const newButton = role === "hr" ? `<a class="button primary" href="/dipendenti/nuovo" ${t("new-employee")}>Nuovo dipendente</a>` : "";
  return `<div class="page-head"><h1>Dipendenti</h1>${newButton}</div>${filters}
<p class="count" ${t("results-count")}>${count}</p>${table}${pager}`;
}

// ------------------------------------------------------------------ scheda
const row = (label, id, value) => `<dt>${esc(label)}</dt><dd ${t(id)}>${value}</dd>`;

function leaveBlock(data, matricola) {
  const s = leaveSummary(data, matricola);
  return `<dl class="facts">${row("Spettanti", "leave-entitled", s.entitled)}${row("Usati", "leave-used", s.used)}${row("In attesa", "leave-pending", s.pending)}${row("Residui", "leave-remaining", s.remaining)}${row("Disponibili", "leave-available", s.available)}</dl>`;
}

export function employeeDetailPage(data, user, e) {
  const role = roleOf(user);
  const manager = e.responsabile ? employee(data, e.responsabile) : null;
  const reports = directReports(data, e.matricola);
  const dept = department(data, e.reparto);
  const actions = [];
  if (canEditEmployees(role)) actions.push(`<a class="button" href="/dipendenti/${e.matricola}/modifica" ${t("edit-employee")}>Modifica</a>`);
  if (canEditEmployees(role) && isCeased(e)) {
    actions.push(`<button type="button" class="danger" ${t("delete-employee")} data-open-dialog="delete-dialog">Elimina definitivamente</button>
<dialog id="delete-dialog" ${t("delete-dialog")}><p ${t("delete-dialog-text")}>Eliminare definitivamente ${esc(fullName(e))} (${e.matricola})? L'operazione non si può annullare.</p>
<div class="actions"><button type="button" class="danger" ${t("delete-confirm")} data-post="/api/dipendenti/elimina" data-payload='${esc(JSON.stringify({ matricola: e.matricola }))}'>Conferma</button>
<button type="button" ${t("delete-cancel")} data-close-dialog>Annulla</button></div></dialog>`);
  }
  return `<div class="page-head"><h1 ${t("employee-name")}>${esc(fullName(e))}</h1><div class="actions">${actions.join("")}</div></div>
<p><span ${t("employee-matricola")}>${e.matricola}</span> · <span class="badge ${isCeased(e) ? "off" : "on"}" ${t("employee-status")}>${statusLabel(e)}</span></p>
<div class="columns">
<section class="card"><h2>Anagrafica</h2><dl class="facts">
${row("Codice fiscale", "employee-cf", esc(e.codice_fiscale))}${row("Data di nascita", "employee-birthdate", formatItDate(e.data_nascita))}
${row("Email", "employee-email", esc(e.email))}${row("Telefono", "employee-phone", esc(e.telefono || "—"))}</dl></section>
<section class="card"><h2>Contratto</h2><dl class="facts">
${row("Reparto", "employee-reparto", `<a href="/dipendenti?reparto=${e.reparto}">${esc(dept?.nome || e.reparto)}</a>`)}
${row("Mansione", "employee-mansione", esc(e.mansione))}
${row("Responsabile", "employee-manager", manager ? `<a href="/dipendenti/${manager.matricola}">${esc(fullName(manager))}</a>` : "—")}
${row("Contratto", "employee-contract", esc(contractLabel(e)))}${row("Orario", "employee-hours", hoursLabel(e.part_time))}
${role === "hr" ? row("RAL", "employee-ral", formatMoney(e.ral * 100)) : ""}
${row("Assunzione", "employee-hire-date", formatItDate(e.data_assunzione))}${row("Cessazione", "employee-end-date", formatItDate(e.data_cessazione))}</dl></section>
<section class="card"><h2>Ferie 2026</h2>${leaveBlock(data, e.matricola)}</section>
<section class="card"><h2>Diretti riporti</h2><ul ${t("reports-list")}>${reports.map((r) => `<li ${t(`report-${r.matricola}`)}><a href="/dipendenti/${r.matricola}">${esc(fullName(r))}</a></li>`).join("") || '<li class="muted">Nessuno</li>'}</ul></section>
</div>`;
}

// ------------------------------------------------------------------ nuovo / modifica
function managerOptions(data, current, allowEmpty) {
  const base = allowEmpty ? [{ value: "", label: "— Nessuno —" }] : [{ value: "", label: "-- Scegli --" }];
  return base.concat(activeEmployees(data).sort(byName).map((e) => ({ value: e.matricola, label: `${listName(e)} (${e.matricola})` })));
}

export function employeeFormPage(data, e = null) {
  const editing = Boolean(e);
  const v = e || {};
  const isDirector = editing && !e.responsabile;
  const deptOptions = [{ value: "", label: "-- Scegli --" }].concat(
    data.reparti.map((r) => {
      const manager = employee(data, r.responsabile);
      const prefill = manager && isActive(manager) ? r.responsabile : "";
      return { value: r.codice, label: r.nome, attrs: ` data-manager="${prefill}"` };
    }),
  );
  const contractOptions = [{ value: "", label: "-- Scegli --" }].concat(Object.entries(CONTRACTS).map(([k, label]) => ({ value: k, label })));
  const ptOptions = PART_TIMES.map((pt) => ({ value: String(pt), label: hoursLabel(pt) }));
  const showEnd = v.contratto === "DET";
  const form = `<form class="card form-grid" data-api="${editing ? "/api/dipendenti/aggiorna" : "/api/dipendenti"}" ${t("employee-form")}${editing ? "" : " data-prefill-manager"} novalidate>
${editing ? `<input type="hidden" name="matricola" value="${e.matricola}">` : ""}
${field({ id: "field-nome", name: "nome", label: "Nome", value: v.nome })}
${field({ id: "field-cognome", name: "cognome", label: "Cognome", value: v.cognome })}
${field({ id: "field-codice-fiscale", name: "codice_fiscale", label: "Codice fiscale", value: v.codice_fiscale, readonly: editing })}
${field({ id: "field-data-nascita", name: "data_nascita", label: "Data di nascita", value: v.data_nascita ? formatItDate(v.data_nascita) : "", placeholder: "GG/MM/AAAA" })}
${field({ id: "field-email", name: "email", label: "Email aziendale", value: v.email, type: "email" })}
${field({ id: "field-telefono", name: "telefono", label: "Telefono", value: v.telefono, placeholder: "+39 ..." })}
${select({ id: "field-reparto", name: "reparto", label: "Reparto", value: v.reparto || "", options: deptOptions })}
${field({ id: "field-mansione", name: "mansione", label: "Mansione", value: v.mansione })}
${select({ id: "field-responsabile", name: "responsabile", label: "Responsabile", value: v.responsabile || "", options: managerOptions(data, v.responsabile, isDirector) })}
${select({ id: "field-contratto", name: "contratto", label: "Contratto", value: v.contratto || "", options: contractOptions })}
<div id="field-data-fine-wrap"${showEnd ? "" : " hidden"}>${field({ id: "field-data-fine", name: "data_fine", label: "Fine contratto", value: v.data_fine_contratto ? formatItDate(v.data_fine_contratto) : "", placeholder: "GG/MM/AAAA" })}</div>
${select({ id: "field-part-time", name: "part_time", label: "Orario", value: String(v.part_time || 100), options: ptOptions })}
${field({ id: "field-ral", name: "ral", label: "RAL (€)", value: v.ral ? String(v.ral) : "", hint: "RAL a tempo pieno" })}
${field({ id: "field-data-assunzione", name: "data_assunzione", label: "Data di assunzione", value: v.data_assunzione ? formatItDate(v.data_assunzione) : "", placeholder: "GG/MM/AAAA", readonly: editing })}
<div class="actions"><button type="submit" class="primary" ${t("form-submit")}>Salva</button><a class="button" href="${editing ? `/dipendenti/${e.matricola}` : "/dipendenti"}" ${t("form-cancel")}>Annulla</a></div>
</form>`;
  if (!editing) return `<h1>Nuovo dipendente</h1>${form}`;
  const termination = `<form class="card" data-api="/api/dipendenti/cessa" novalidate><h2>Cessazione</h2>
<input type="hidden" name="matricola" value="${e.matricola}">
${field({ id: "termination-date", name: "data", label: "Data di cessazione", value: e.data_cessazione ? formatItDate(e.data_cessazione) : "", placeholder: "GG/MM/AAAA" })}
<button type="submit" class="danger" ${t("termination-submit")}>Registra cessazione</button></form>`;
  return `<h1>Modifica ${esc(fullName(e))}</h1>${form}${termination}`;
}

export function ceasedEditPage(e) {
  return `<h1>Modifica ${esc(fullName(e))}</h1><p class="card" ${t("employee-ceased-note")}>Dipendente cessato il ${formatItDate(e.data_cessazione)}: i dati non sono modificabili.</p>`;
}

// ------------------------------------------------------------------ reparti, organigramma
export function departmentsPage(data) {
  let total = 0;
  const rows = data.reparti
    .map((r) => {
      const count = activeEmployees(data).filter((e) => e.reparto === r.codice).length;
      total += count;
      const manager = employee(data, r.responsabile);
      return `<tr ${t(`department-row-${r.codice}`)}><td><a href="/dipendenti?reparto=${r.codice}" ${t(`department-link-${r.codice}`)}>${esc(r.nome)}</a></td>
<td ${t(`department-manager-${r.codice}`)}>${manager && isActive(manager) ? esc(fullName(manager)) : "—"}</td><td class="num" ${t(`department-count-${r.codice}`)}>${count}</td></tr>`;
    })
    .join("");
  return `<h1>Reparti</h1><table class="grid"><thead><tr><th>Reparto</th><th>Responsabile</th><th>Dipendenti attivi</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><th colspan="2">Totale</th><td class="num" ${t("department-total")}>${total}</td></tr></tfoot></table>`;
}

export function orgChartPage(data) {
  const node = (e) => {
    const children = directReports(data, e.matricola);
    return `<li ${t(`org-node-${e.matricola}`)}><span class="org-name" ${t(`org-name-${e.matricola}`)}>${esc(fullName(e))} — ${esc(e.mansione)}</span> <span class="muted" ${t(`org-reports-${e.matricola}`)}>(${children.length})</span>${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
  };
  const roots = activeEmployees(data).filter((e) => !e.responsabile).sort(byName);
  return `<h1>Organigramma</h1><ul class="org">${roots.map(node).join("")}</ul>`;
}

// ------------------------------------------------------------------ ferie
export function leavePage(data, user) {
  const own = data.ferie.filter((l) => l.matricola === user).sort((a, b) => (a.inizio < b.inizio ? 1 : a.inizio > b.inizio ? -1 : 0));
  const rows = own
    .map((l) => `<tr ${t(`leave-row-${l.id}`)}><td>${l.id}</td><td ${t(`leave-period-${l.id}`)}>${formatItDate(l.inizio)} - ${formatItDate(l.fine)}</td><td class="num" ${t(`leave-days-${l.id}`)}>${l.giorni}</td>
<td><span class="badge" ${t(`leave-status-${l.id}`)}>${LEAVE_STATUS[l.stato]}</span>${l.stato === "RIFIUTATA" ? `<div class="muted" ${t(`leave-rejection-${l.id}`)}>${esc(l.motivo_rifiuto || "")}</div>` : ""}</td>
<td>${l.stato === "IN_ATTESA" ? `<button type="button" ${t(`leave-cancel-${l.id}`)} data-post="/api/ferie/ritira" data-payload='${esc(JSON.stringify({ id: l.id }))}'>Ritira</button>` : ""}</td></tr>`)
    .join("");
  return `<h1>Ferie</h1>
<section class="card"><h2>Riepilogo 2026</h2>${leaveBlock(data, user)}</section>
<form class="card" data-api="/api/ferie" novalidate data-holidays="${HOLIDAYS.join(",")}"><h2>Nuova richiesta</h2>
<div class="row">${field({ id: "leave-start", name: "inizio", label: "Dal", placeholder: "GG/MM/AAAA" })}${field({ id: "leave-end", name: "fine", label: "Al", placeholder: "GG/MM/AAAA" })}</div>
<p class="preview" ${t("leave-days-preview")} hidden></p>
<div class="field"><label for="leave-reason">Motivo (facoltativo)</label><textarea id="leave-reason" name="motivo" rows="2" ${t("leave-reason")}></textarea>${errorSlot("leave-reason")}</div>
${formError("leave-error")}
<button type="submit" class="primary" ${t("leave-submit")}>Invia richiesta</button></form>
<section class="card"><h2>Le mie richieste</h2><table class="grid" ${t("leave-list")}><thead><tr><th>Id</th><th>Periodo</th><th>Giorni</th><th>Stato</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

export function approvalsPage(data, user) {
  const pending = pendingForApprover(data, user);
  const rows = pending
    .map((l) => {
      const who = employee(data, l.matricola);
      return `<tr ${t(`approval-row-${l.id}`)}><td>${l.id}</td><td ${t(`approval-requester-${l.id}`)}>${esc(fullName(who))}</td><td ${t(`approval-period-${l.id}`)}>${formatItDate(l.inizio)} - ${formatItDate(l.fine)}</td><td class="num" ${t(`approval-days-${l.id}`)}>${l.giorni}</td>
<td class="num" ${t(`approval-available-${l.id}`)}>${leaveSummary(data, l.matricola).available}</td><td ${t(`approval-sent-${l.id}`)}>${formatItDate(l.creata_il)}</td>
<td><div class="actions"><button type="button" class="primary" ${t(`approve-${l.id}`)} data-post="/api/ferie/approva" data-payload='${esc(JSON.stringify({ id: l.id }))}'>Approva</button>
<button type="button" ${t(`reject-${l.id}`)} data-reveal="reject-box-${l.id}">Rifiuta</button></div>
<div id="reject-box-${l.id}" class="reject-box" hidden><label for="reject-reason-${l.id}">Motivo del rifiuto</label>
<textarea id="reject-reason-${l.id}" rows="2" ${t(`reject-reason-${l.id}`)}></textarea>${errorSlot(`reject-reason-${l.id}`)}
<button type="button" class="danger" ${t(`reject-confirm-${l.id}`)} data-post="/api/ferie/rifiuta" data-payload='${esc(JSON.stringify({ id: l.id }))}' data-field-motivo="reject-reason-${l.id}">Conferma rifiuto</button></div></td></tr>`;
    })
    .join("");
  const table = pending.length
    ? `<table class="grid"><thead><tr><th>Id</th><th>Richiedente</th><th>Periodo</th><th>Giorni</th><th>Disponibili</th><th>Inviata il</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p class="empty" ${t("approvals-empty")}>Nessuna richiesta da approvare.</p>`;
  return `<h1>Richieste da approvare</h1>${table}`;
}

// ------------------------------------------------------------------ presenze
export function timesheetPage(data, user) {
  const sheet = timesheet(data, user);
  const rows = sheet.days
    .map((d) => {
      const cell = d.leave
        ? `<span class="badge">Ferie</span>`
        : `<input id="timesheet-hours-${d.day}" name="ore-${d.day}" ${t(`timesheet-hours-${d.day}`)} value="${d.hours === null ? "" : formatHours(d.hours)}" inputmode="decimal"${d.editable ? "" : " disabled"}>${errorSlot(`timesheet-hours-${d.day}`)}`;
      return `<tr ${t(`timesheet-day-${d.day}`)}><td><label for="timesheet-hours-${d.day}">${formatLongDate(d.day)}</label></td><td>${cell}</td></tr>`;
    })
    .join("");
  return `<h1>Presenze</h1><form class="card" data-api="/api/presenze" novalidate><table class="grid"><thead><tr><th>Giorno</th><th>Ore</th></tr></thead><tbody>${rows}</tbody></table>
<dl class="facts">${row("Ore previste", "timesheet-expected", formatHours(sheet.expected))}${row("Totale", "timesheet-total", formatHours(sheet.total))}${row("Straordinario", "timesheet-overtime", formatHours(sheet.overtime))}</dl>
<button type="submit" class="primary" ${t("timesheet-save")}>Salva presenze</button></form>`;
}

// ------------------------------------------------------------------ buste paga
export function payslipPage(data, user, url) {
  const role = roleOf(user);
  const target = role === "hr" ? url.searchParams.get("matricola") || user : user;
  const person = employee(data, target);
  const slips = payslipsFor(seedEmployee(target));
  const requested = url.searchParams.get("mese");
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : slips.at(-1)?.month || PROCESSED_MONTHS.at(-1);
  const slip = slips.find((s) => s.month === month);
  const selectors = [];
  if (role === "hr") {
    selectors.push(select({ id: "payslip-employee", name: "matricola", label: "Dipendente", value: target, options: [...data.dipendenti].sort(byName).map((e) => ({ value: e.matricola, label: `${listName(e)} (${e.matricola})` })) }));
  }
  selectors.push(select({ id: "payslip-month", name: "mese", label: "Mese", value: month, options: PROCESSED_MONTHS.map((m) => ({ value: m, label: monthLabel(m) })) }));
  let content;
  if (!slips.length) content = `<p class="empty" ${t("payslip-empty")}>Nessuna busta paga elaborata nel 2026.</p>`;
  else if (!slip) content = `<p class="empty" ${t("payslip-empty")}>Busta paga non disponibile per il mese scelto.</p>`;
  else {
    content = `<dl class="facts payslip">${row("RAL di riferimento", "payslip-ral", formatMoney(slip.ral * 100))}${row("Orario", "payslip-hours", hoursLabel(slip.partTime))}
${row("Lordo", "payslip-gross", formatMoney(slip.gross))}${row("Contributi INPS (9,19%)", "payslip-contributions", formatMoney(slip.contributions))}
${row("Imponibile", "payslip-taxable", formatMoney(slip.taxable))}${row("IRPEF", "payslip-tax", formatMoney(slip.tax))}${row("Netto", "payslip-net", formatMoney(slip.net))}</dl>`;
  }
  return `<h1>Buste paga</h1><form class="card filters" method="get" action="/buste-paga">${selectors.join("")}
<div class="filter-actions"><button type="submit" class="primary" ${t("payslip-show")}>Mostra</button></div></form>
<section class="card"><h2>${esc(person ? fullName(person) : target)} · ${esc(monthLabel(month))}</h2>${content}</section>`;
}

// ------------------------------------------------------------------ profilo
export function profilePage(data, user) {
  const e = employee(data, user);
  const manager = e.responsabile ? employee(data, e.responsabile) : null;
  return `<h1>Profilo</h1><section class="card"><dl class="facts">
${row("Nome", "profile-name", esc(fullName(e)))}${row("Matricola", "profile-matricola", e.matricola)}${row("Codice fiscale", "profile-cf", esc(e.codice_fiscale))}
${row("Email", "profile-email", esc(e.email))}${row("Reparto", "profile-reparto", esc(department(data, e.reparto)?.nome || ""))}${row("Responsabile", "profile-manager", manager ? esc(fullName(manager)) : "—")}</dl></section>
<form class="card" data-api="/api/profilo" novalidate><h2>Recapiti</h2>
${field({ id: "profile-phone", name: "telefono", label: "Telefono", value: e.telefono, placeholder: "+39 ..." })}
${field({ id: "profile-address", name: "indirizzo", label: "Indirizzo", value: e.indirizzo })}
${field({ id: "profile-emergency-name", name: "emergenza_nome", label: "Contatto di emergenza: nome", value: e.emergenza_nome })}
${field({ id: "profile-emergency-phone", name: "emergenza_telefono", label: "Contatto di emergenza: telefono", value: e.emergenza_telefono, placeholder: "+39 ..." })}
${formError("profile-emergency-error")}
<button type="submit" class="primary" ${t("profile-save")}>Salva</button></form>`;
}

export { canApprove };
