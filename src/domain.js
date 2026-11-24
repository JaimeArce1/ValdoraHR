// Regole di business di Valdora HR (SPEC.md). Funzioni pure sul dataset di una sessione.
import { addDays, compareText, divRoundHalfUp, normalize, weekday } from "./util.js";

export const TODAY = "2026-11-18";
export const LEAVE_FROM = "2026-11-19";
export const LEAVE_TO = "2026-12-31";
export const HIRE_MIN = "1990-01-01";
export const TERMINATION_MAX = "2027-02-16";
export const HOLIDAYS = ["2026-01-01", "2026-01-06", "2026-04-06", "2026-04-25", "2026-05-01", "2026-06-02", "2026-08-15", "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26"];
export const WEEK = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
export const PROCESSED_MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
export const PAGE_SIZE = 10;

export const CONTRACTS = { IND: "Tempo indeterminato", DET: "Tempo determinato", APP: "Apprendistato" };
export const PART_TIMES = [100, 90, 80, 70, 60, 50];

// ------------------------------------------------------------------ dipendenti
export const fullName = (e) => `${e.nome} ${e.cognome}`;
export const listName = (e) => `${e.cognome} ${e.nome}`;
export const isCeased = (e) => Boolean(e.data_cessazione && e.data_cessazione <= TODAY);
export const isActive = (e) => !isCeased(e);

export function statusLabel(e) {
  if (isCeased(e)) return "Cessato";
  if (e.data_cessazione) return "Cessazione prevista";
  return "Attivo";
}

export const hoursLabel = (pt) => (pt === 100 ? "Tempo pieno" : `Part-time ${pt}%`);

export function contractLabel(e) {
  if (e.contratto === "DET") return `Tempo determinato fino al ${e.data_fine_contratto.split("-").reverse().join("/")}`;
  return CONTRACTS[e.contratto];
}

export function byName(a, b) {
  return compareText(a.cognome, b.cognome) || compareText(a.nome, b.nome) || (a.matricola < b.matricola ? -1 : a.matricola > b.matricola ? 1 : 0);
}

export const employee = (data, matricola) => data.dipendenti.find((e) => e.matricola === matricola) || null;
export const activeEmployees = (data) => data.dipendenti.filter(isActive);
export const directReports = (data, matricola) => activeEmployees(data).filter((e) => e.responsabile === matricola).sort(byName);
export const department = (data, code) => data.reparti.find((r) => r.codice === code) || null;

/** Tutti i dipendenti (attivi) che dipendono, direttamente o no, da `matricola`. */
export function descendants(data, matricola) {
  const found = new Set();
  const queue = [matricola];
  while (queue.length) {
    const current = queue.shift();
    for (const e of data.dipendenti) {
      if (e.responsabile === current && !found.has(e.matricola)) {
        found.add(e.matricola);
        queue.push(e.matricola);
      }
    }
  }
  return found;
}

export function nextMatricola(data) {
  const max = Math.max(0, ...data.dipendenti.map((e) => Number(e.matricola.slice(4))));
  return `VLD-${String(max + 1).padStart(4, "0")}`;
}

// ------------------------------------------------------------------ elenco
export function searchMatches(e, query) {
  const q = normalize(query);
  if (!q) return true;
  return normalize(`${e.nome}${e.cognome}`).includes(q) || normalize(`${e.cognome}${e.nome}`).includes(q) || normalize(e.matricola).includes(q);
}

export function filterEmployees(data, { q = "", reparto = "", stato = "attivi", contratto = "", ordina = "cognome-asc" }) {
  const rows = data.dipendenti.filter((e) => {
    if (stato === "attivi" && !isActive(e)) return false;
    if (stato === "cessati" && !isCeased(e)) return false;
    if (reparto && e.reparto !== reparto) return false;
    if (contratto && e.contratto !== contratto) return false;
    return searchMatches(e, q);
  });
  const sorters = {
    "cognome-asc": (a, b) => byName(a, b),
    "cognome-desc": (a, b) => compareText(b.cognome, a.cognome) || byName(a, b),
    "assunzione-asc": (a, b) => (a.data_assunzione < b.data_assunzione ? -1 : a.data_assunzione > b.data_assunzione ? 1 : byName(a, b)),
    "assunzione-desc": (a, b) => (a.data_assunzione > b.data_assunzione ? -1 : a.data_assunzione < b.data_assunzione ? 1 : byName(a, b)),
  };
  return rows.sort(sorters[ordina] || sorters["cognome-asc"]);
}

// ------------------------------------------------------------------ ferie
export function workingDays(start, end) {
  let days = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (weekday(day) < 5 && !HOLIDAYS.includes(day)) days += 1;
  }
  return days;
}

export function entitlement(hireIso) {
  const [year, month] = hireIso.split("-").map(Number);
  if (year < 2026) return 26;
  if (year > 2026) return 0;
  return Math.floor((26 * (12 - month + 1)) / 12);
}

export function leaveSummary(data, matricola) {
  const e = employee(data, matricola);
  const own = data.ferie.filter((l) => l.matricola === matricola);
  const used = own.filter((l) => l.stato === "APPROVATA").reduce((sum, l) => sum + l.giorni, 0);
  const pending = own.filter((l) => l.stato === "IN_ATTESA").reduce((sum, l) => sum + l.giorni, 0);
  const entitled = e ? e.ferie_spettanti : 0;
  return { entitled, used, pending, remaining: entitled - used, available: entitled - used - pending };
}

export const LEAVE_STATUS = { IN_ATTESA: "In attesa", APPROVATA: "Approvata", RIFIUTATA: "Rifiutata", ANNULLATA: "Annullata" };

export function nextLeaveId(data) {
  const max = Math.max(0, ...data.ferie.map((l) => Number(l.id.slice(2))));
  return `F-${max + 1}`;
}

/** Richieste In attesa dei diretti riporti attuali (attivi) di `matricola`, dalla più vecchia. */
export function pendingForApprover(data, matricola) {
  const reports = new Set(directReports(data, matricola).map((e) => e.matricola));
  return data.ferie
    .filter((l) => l.stato === "IN_ATTESA" && reports.has(l.matricola))
    .sort((a, b) => (a.creata_il < b.creata_il ? -1 : a.creata_il > b.creata_il ? 1 : Number(a.id.slice(2)) - Number(b.id.slice(2))));
}

export const allPending = (data) => data.ferie.filter((l) => l.stato === "IN_ATTESA" && isActive(employee(data, l.matricola) || {}));

export function onLeaveToday(data, among = null) {
  return activeEmployees(data)
    .filter((e) => (among ? among.has(e.matricola) : true))
    .filter((e) => data.ferie.some((l) => l.matricola === e.matricola && l.stato === "APPROVATA" && l.inizio <= TODAY && TODAY <= l.fine))
    .sort(byName);
}

export function approvedLeaveOn(data, matricola, day) {
  return data.ferie.some((l) => l.matricola === matricola && l.stato === "APPROVATA" && l.inizio <= day && day <= l.fine);
}

// ------------------------------------------------------------------ presenze
export function timesheet(data, matricola) {
  const e = employee(data, matricola);
  const pt = e ? e.part_time : 100;
  const dailyLeave = (8 * pt) / 100;
  const days = WEEK.map((day) => {
    const leave = approvedLeaveOn(data, matricola, day);
    const entry = data.presenze.find((p) => p.matricola === matricola && p.giorno === day);
    return { day, leave, editable: !leave && day <= TODAY, hours: leave ? dailyLeave : entry ? Number(entry.ore) : null };
  });
  // Le ore dei giorni di ferie (8 × percentuale) hanno un decimale: si arrotonda al
  // decimo ogni somma, altrimenti 6,4 + 6,4 + ... resta un numero in virgola mobile.
  const tenth = (x) => Math.round(x * 10) / 10;
  const expected = tenth((40 * pt) / 100);
  const total = tenth(days.reduce((sum, d) => sum + (d.hours || 0), 0));
  return { days, expected, total, overtime: tenth(Math.max(0, total - expected)) };
}

// ------------------------------------------------------------------ buste paga
const IRPEF_THRESHOLD = 233333; // centesimi

/** Busta paga in centesimi (SPEC B2): un solo arrotondamento per voce, IRPEF compresa. */
export function payslip(ral, partTime) {
  const gross = divRoundHalfUp(ral * partTime, 13);
  const contributions = divRoundHalfUp(gross * 919, 10000);
  const taxable = gross - contributions;
  const low = Math.min(taxable, IRPEF_THRESHOLD);
  const high = Math.max(taxable - IRPEF_THRESHOLD, 0);
  const tax = divRoundHalfUp(low * 23 + high * 35, 100);
  return { gross, contributions, taxable, tax, net: taxable - tax };
}

/** RAL in vigore il primo giorno del mese, dallo storico del seed. */
export function ralOn(seedEmployee, yearMonth) {
  let ral = seedEmployee.ral;
  for (const entry of seedEmployee.ral_storico || []) {
    if (entry.dal <= `${yearMonth}-01`) ral = entry.ral;
  }
  return ral;
}

/**
 * Buste paga elaborate di un dipendente: calcolate solo dal seed, così nessuna modifica
 * della sessione (RAL, orario, cessazione) cambia una busta già elaborata (SPEC B1).
 */
export function payslipsFor(seedEmployee) {
  if (!seedEmployee) return [];
  const from = seedEmployee.data_assunzione.slice(0, 7);
  const to = seedEmployee.data_cessazione ? seedEmployee.data_cessazione.slice(0, 7) : "9999-12";
  return PROCESSED_MONTHS.filter((m) => m >= from && m <= to).map((month) => {
    const ral = ralOn(seedEmployee, month);
    return { month, ral, partTime: seedEmployee.part_time, ...payslip(ral, seedEmployee.part_time) };
  });
}

/** Costo mensile del personale (SPEC C1): lordi attuali dei dipendenti in stato Attivo. */
export function monthlyCost(data) {
  return activeEmployees(data).reduce((sum, e) => sum + payslip(e.ral, e.part_time).gross, 0);
}
