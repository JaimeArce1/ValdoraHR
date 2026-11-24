// API JSON di Valdora HR (SPEC §17). Ogni modifica passa da qui: risposta
// { ok: true, redirect } oppure { ok: false, errors: { <testid dell'errore>: messaggio } }.
import { USERS } from "./data.js";
import { canApprove, canEditEmployees, roleOf } from "./access.js";
import {
  CONTRACTS, HIRE_MIN, LEAVE_FROM, LEAVE_TO, PART_TIMES, TERMINATION_MAX, TODAY, WEEK,
  approvedLeaveOn, descendants, directReports, employee, entitlement, isActive, isCeased, leaveSummary,
  nextLeaveId, nextMatricola, pendingForApprover, workingDays,
} from "./domain.js";
import { addMonths, ageAt, formatItDate, parseHours, parseItDate } from "./util.js";

const REQUIRED = "Campo obbligatorio.";
const BAD_DATE = "Data non valida: usa GG/MM/AAAA.";
const PHONE_ERROR = "Telefono non valido: usa +39 seguito da 9 o 10 cifre.";
const CF_PATTERN = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+39(?:\s*\d){9,10}$/;

const ok = (redirect, flash) => ({ status: 200, body: { ok: true, redirect }, flash });
// Un errore di validazione è una risposta normale (200, ok: false), non un errore HTTP:
// un 4xx lascerebbe "Failed to load resource" nella console del browser anche sulla
// release pulita, e un test o un triage potrebbero leggerlo come un difetto.
const invalid = (errors) => ({ status: 200, body: { ok: false, errors } });
const denied = () => ({ status: 403, body: { ok: false, errors: {}, message: "Non hai i permessi per questa operazione." } });
const missing = () => ({ status: 404, body: { ok: false, errors: {}, message: "Risorsa non trovata." } });

const str = (value) => (typeof value === "string" ? value.trim() : "");

export function safeReturn(ritorno) {
  if (typeof ritorno !== "string" || !ritorno.startsWith("/") || ritorno.startsWith("//") || ritorno.includes("\\") || /[\u0000-\u001f\u007f]/.test(ritorno)) {
    return "/dashboard";
  }
  return ritorno;
}

const validPhone = (text) => PHONE_PATTERN.test(text);

/** `31000` o `31.000` → intero, altrimenti null. */
function parseRal(text) {
  if (/^\d+$/.test(text)) return Number(text);
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replaceAll(".", ""));
  return null;
}

// ------------------------------------------------------------------ accesso
function login(state, body) {
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const errors = {};
  if (!email) errors["login-email-error"] = "Inserisci l'email.";
  if (!password) errors["login-password-error"] = "Inserisci la password.";
  if (Object.keys(errors).length) return invalid(errors);
  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user || !employee(state.data, user.matricola)) return invalid({ "login-error": "Email o password non corrette." });
  state.user = user.matricola;
  return ok(safeReturn(body.ritorno));
}

function logout(state) {
  state.user = null;
  return ok("/accedi", "Sei uscito.");
}

// ------------------------------------------------------------------ dipendenti
function validateEmployee(data, body, current) {
  const errors = {};
  const set = (id, message) => {
    if (!errors[`${id}-error`]) errors[`${id}-error`] = message;
  };
  const v = {
    nome: str(body.nome),
    cognome: str(body.cognome),
    codice_fiscale: current ? current.codice_fiscale : str(body.codice_fiscale).toUpperCase(),
    email: str(body.email).toLowerCase(),
    telefono: str(body.telefono),
    reparto: str(body.reparto),
    mansione: str(body.mansione),
    responsabile: str(body.responsabile),
    contratto: str(body.contratto),
    part_time: Number(str(body.part_time) || 100),
  };
  if (!v.nome) set("field-nome", REQUIRED);
  if (!v.cognome) set("field-cognome", REQUIRED);

  if (!current) {
    if (!v.codice_fiscale) set("field-codice-fiscale", REQUIRED);
    else if (!CF_PATTERN.test(v.codice_fiscale)) set("field-codice-fiscale", "Codice fiscale non valido: 16 caratteri, es. RSSMRA80A01H501U.");
    else {
      const owner = data.dipendenti.find((e) => e.codice_fiscale === v.codice_fiscale);
      if (owner) set("field-codice-fiscale", `Codice fiscale già presente (${owner.matricola}).`);
    }
  }

  const birthText = str(body.data_nascita);
  const birth = parseItDate(birthText);
  if (!birthText) set("field-data-nascita", REQUIRED);
  else if (!birth) set("field-data-nascita", BAD_DATE);

  if (!v.email) set("field-email", REQUIRED);
  else if (!EMAIL_PATTERN.test(v.email)) set("field-email", "Email non valida.");
  else if (!v.email.endsWith("@valdora.example")) set("field-email", "L'email aziendale deve terminare con @valdora.example.");
  else {
    const owner = data.dipendenti.find((e) => e.email.toLowerCase() === v.email && e.matricola !== current?.matricola);
    if (owner) set("field-email", `Email già assegnata a ${owner.matricola}.`);
  }

  if (v.telefono && !validPhone(v.telefono)) set("field-telefono", PHONE_ERROR);
  if (!data.reparti.some((r) => r.codice === v.reparto)) set("field-reparto", REQUIRED);
  if (!v.mansione) set("field-mansione", REQUIRED);

  const isDirector = current && !current.responsabile;
  if (!v.responsabile) {
    if (!isDirector) set("field-responsabile", REQUIRED);
  } else {
    const manager = employee(data, v.responsabile);
    if (!manager || !isActive(manager)) set("field-responsabile", REQUIRED);
    else if (current && v.responsabile === current.matricola) set("field-responsabile", "Un dipendente non può essere responsabile di sé stesso.");
    else if (current && descendants(data, current.matricola).has(v.responsabile)) set("field-responsabile", "Il responsabile scelto dipende già da questo dipendente.");
  }

  if (!CONTRACTS[v.contratto]) set("field-contratto", REQUIRED);
  if (!PART_TIMES.includes(v.part_time)) v.part_time = 100;

  const ralText = str(body.ral);
  const ral = parseRal(ralText);
  if (!ralText) set("field-ral", REQUIRED);
  else if (ral === null || ral < 18000 || ral > 120000) set("field-ral", "La RAL deve essere un numero intero fra 18.000 e 120.000.");

  let hire = current ? current.data_assunzione : null;
  if (!current) {
    const hireText = str(body.data_assunzione);
    hire = parseItDate(hireText);
    if (!hireText) set("field-data-assunzione", REQUIRED);
    else if (!hire) set("field-data-assunzione", BAD_DATE);
    else if (hire < HIRE_MIN || hire > TODAY) {
      set("field-data-assunzione", "La data di assunzione deve essere fra il 01/01/1990 e il 18/11/2026.");
      hire = null;
    }
  }

  if (birth && hire) {
    if (ageAt(birth, hire) < 16) set("field-data-nascita", "Il dipendente deve avere almeno 16 anni alla data di assunzione.");
    else if (v.contratto === "APP" && ageAt(birth, hire) >= 30) set("field-contratto", "L'apprendistato è riservato a chi ha meno di 30 anni all'assunzione.");
  }

  let end = null;
  if (v.contratto === "DET") {
    const endText = str(body.data_fine);
    end = parseItDate(endText);
    if (!endText) set("field-data-fine", REQUIRED);
    else if (!end) set("field-data-fine", BAD_DATE);
    else if (hire && end <= hire) set("field-data-fine", "La data di fine deve essere successiva all'assunzione.");
    else if (hire && end > addMonths(hire, 24)) set("field-data-fine", "Un contratto a tempo determinato dura al massimo 24 mesi.");
  }

  return { errors, values: { ...v, data_nascita: birth, data_assunzione: hire, data_fine_contratto: end, ral } };
}

function createEmployee(state, body) {
  const { data } = state;
  const { errors, values } = validateEmployee(data, body, null);
  if (Object.keys(errors).length) return invalid(errors);
  const matricola = nextMatricola(data);
  data.dipendenti.push({
    matricola,
    nome: values.nome,
    cognome: values.cognome,
    sesso: null,
    data_nascita: values.data_nascita,
    comune_nascita: null,
    codice_fiscale: values.codice_fiscale,
    email: values.email,
    telefono: values.telefono,
    reparto: values.reparto,
    mansione: values.mansione,
    responsabile: values.responsabile,
    contratto: values.contratto,
    data_fine_contratto: values.data_fine_contratto,
    part_time: values.part_time,
    ral: values.ral,
    ral_storico: [],
    data_assunzione: values.data_assunzione,
    data_cessazione: null,
    stato: "ATTIVO",
    ferie_spettanti: entitlement(values.data_assunzione),
    ruolo_applicativo: "dipendente",
    indirizzo: "",
    emergenza_nome: "",
    emergenza_telefono: "",
  });
  return ok(`/dipendenti/${matricola}`, `Dipendente ${matricola} creato.`);
}

function updateEmployee(state, body) {
  const { data } = state;
  const current = employee(data, str(body.matricola));
  if (!current) return missing();
  if (isCeased(current)) return invalid({});
  const { errors, values } = validateEmployee(data, body, current);
  if (Object.keys(errors).length) return invalid(errors);
  Object.assign(current, {
    nome: values.nome,
    cognome: values.cognome,
    email: values.email,
    telefono: values.telefono,
    reparto: values.reparto,
    mansione: values.mansione,
    responsabile: values.responsabile || null,
    contratto: values.contratto,
    data_fine_contratto: values.data_fine_contratto,
    part_time: values.part_time,
    ral: values.ral,
    data_nascita: values.data_nascita,
  });
  return ok(`/dipendenti/${current.matricola}`, "Modifiche salvate.");
}

function terminateEmployee(state, body) {
  const { data } = state;
  const current = employee(data, str(body.matricola));
  if (!current) return missing();
  if (isCeased(current)) return invalid({});
  const text = str(body.data);
  const date = parseItDate(text);
  const id = "termination-date-error";
  if (!text) return invalid({ [id]: REQUIRED });
  if (!date) return invalid({ [id]: BAD_DATE });
  if (date < current.data_assunzione || date > TERMINATION_MAX) return invalid({ [id]: "La data di cessazione deve essere fra la data di assunzione e il 16/02/2027." });
  const reports = directReports(data, current.matricola).length;
  if (reports === 1) return invalid({ [id]: "Assegna prima un nuovo responsabile al suo diretto riporto." });
  if (reports > 1) return invalid({ [id]: `Assegna prima un nuovo responsabile ai suoi ${reports} diretti riporti.` });
  current.data_cessazione = date;
  if (isCeased(current)) {
    current.stato = "CESSATO";
    for (const l of data.ferie) if (l.matricola === current.matricola && l.stato === "IN_ATTESA") l.stato = "ANNULLATA";
  }
  return ok(`/dipendenti/${current.matricola}`, "Cessazione registrata.");
}

function deleteEmployee(state, body) {
  const { data } = state;
  const current = employee(data, str(body.matricola));
  if (!current) return missing();
  if (!isCeased(current)) return invalid({});
  data.dipendenti = data.dipendenti.filter((e) => e !== current);
  data.ferie = data.ferie.filter((l) => l.matricola !== current.matricola);
  data.presenze = data.presenze.filter((p) => p.matricola !== current.matricola);
  return ok("/dipendenti", `Dipendente ${current.matricola} eliminato.`);
}

// ------------------------------------------------------------------ ferie
function requestLeave(state, body) {
  const { data, user } = state;
  const errors = {};
  const startText = str(body.inizio);
  const endText = str(body.fine);
  const start = parseItDate(startText);
  const end = parseItDate(endText);
  const reason = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!startText) errors["leave-start-error"] = REQUIRED;
  else if (!start) errors["leave-start-error"] = BAD_DATE;
  if (!endText) errors["leave-end-error"] = REQUIRED;
  else if (!end) errors["leave-end-error"] = BAD_DATE;
  else if (start && end < start) errors["leave-end-error"] = "La data di fine non può precedere l'inizio.";
  if (reason.length > 200) errors["leave-reason-error"] = "Al massimo 200 caratteri.";
  if (Object.keys(errors).length) return invalid(errors);

  const general = (message) => invalid({ "leave-error": message });
  if (start < LEAVE_FROM || end > LEAVE_TO) return general("Le ferie si chiedono dal 19/11/2026 al 31/12/2026.");
  const days = workingDays(start, end);
  if (days === 0) return general("Il periodo non contiene giorni lavorativi.");
  const overlap = data.ferie
    .filter((l) => l.matricola === user && ["IN_ATTESA", "APPROVATA"].includes(l.stato) && l.inizio <= end && start <= l.fine)
    .sort((a, b) => (a.inizio < b.inizio ? -1 : a.inizio > b.inizio ? 1 : 0))[0];
  if (overlap) return general(`Il periodo si sovrappone alla richiesta ${overlap.id}.`);
  const available = leaveSummary(data, user).available;
  if (days > available) return general(`Giorni richiesti (${days}) oltre i disponibili (${available}).`);

  const id = nextLeaveId(data);
  data.ferie.push({ id, matricola: user, inizio: start, fine: end, stato: "IN_ATTESA", motivo: reason, giorni: days, motivo_rifiuto: null, creata_il: TODAY });
  return ok("/ferie", `Richiesta ${id} inviata.`);
}

function withdrawLeave(state, body) {
  const leave = state.data.ferie.find((l) => l.id === str(body.id));
  if (!leave) return missing();
  if (leave.matricola !== state.user || leave.stato !== "IN_ATTESA") return denied();
  leave.stato = "ANNULLATA";
  return ok("/ferie", `Richiesta ${leave.id} ritirata.`);
}

function decideLeave(state, body, approve) {
  const { data, user } = state;
  const leave = data.ferie.find((l) => l.id === str(body.id));
  if (!leave) return missing();
  if (!pendingForApprover(data, user).includes(leave)) return denied();
  if (approve) {
    leave.stato = "APPROVATA";
    return ok("/ferie/approvazioni", `Richiesta ${leave.id} approvata.`);
  }
  const reason = str(body.motivo);
  if (reason.length < 10) return invalid({ [`reject-reason-${leave.id}-error`]: "Indica un motivo di almeno 10 caratteri." });
  leave.stato = "RIFIUTATA";
  leave.motivo_rifiuto = reason;
  return ok("/ferie/approvazioni", `Richiesta ${leave.id} rifiutata.`);
}

// ------------------------------------------------------------------ presenze, profilo, paghe
function saveTimesheet(state, body) {
  const { data, user } = state;
  const errors = {};
  const values = {};
  for (const day of WEEK) {
    if (day > TODAY || approvedLeaveOn(data, user, day)) continue;
    const hours = parseHours(body[`ore-${day}`]);
    if (hours === null) errors[`timesheet-hours-${day}-error`] = "Inserisci da 0 a 12 ore, a mezz'ore (es. 7,5).";
    else values[day] = hours;
  }
  if (Object.keys(errors).length) return invalid(errors);
  data.presenze = data.presenze.filter((p) => !(p.matricola === user && p.giorno in values));
  for (const [giorno, ore] of Object.entries(values)) data.presenze.push({ matricola: user, giorno, ore: String(ore) });
  return ok("/presenze", "Presenze salvate.");
}

function saveProfile(state, body) {
  const me = employee(state.data, state.user);
  const phone = str(body.telefono);
  const emergencyName = str(body.emergenza_nome);
  const emergencyPhone = str(body.emergenza_telefono);
  const errors = {};
  if (phone && !validPhone(phone)) errors["profile-phone-error"] = PHONE_ERROR;
  if (emergencyPhone && !validPhone(emergencyPhone)) errors["profile-emergency-phone-error"] = PHONE_ERROR;
  if (Boolean(emergencyName) !== Boolean(emergencyPhone)) errors["profile-emergency-error"] = "Indica nome e telefono del contatto di emergenza, oppure nessuno dei due.";
  if (Object.keys(errors).length) return invalid(errors);
  Object.assign(me, { telefono: phone, indirizzo: str(body.indirizzo), emergenza_nome: emergencyName, emergenza_telefono: emergencyPhone });
  return ok("/profilo", "Profilo aggiornato.");
}

function runPayroll() {
  // Azione vietata ai test (forbidden_requests del profilo): risponde senza toccare i dati.
  return ok("/dashboard", "Elaborazione delle buste paga di novembre avviata.");
}

// ------------------------------------------------------------------ routing
const ROUTES = {
  "/api/accedi": { auth: false, run: login },
  "/api/esci": { auth: false, run: logout },
  "/api/dipendenti": { auth: true, hr: true, run: createEmployee },
  "/api/dipendenti/aggiorna": { auth: true, hr: true, run: updateEmployee },
  "/api/dipendenti/cessa": { auth: true, hr: true, run: terminateEmployee },
  "/api/dipendenti/elimina": { auth: true, hr: true, run: deleteEmployee },
  "/api/ferie": { auth: true, run: requestLeave },
  "/api/ferie/ritira": { auth: true, run: withdrawLeave },
  "/api/ferie/approva": { auth: true, approver: true, run: (s, b) => decideLeave(s, b, true) },
  "/api/ferie/rifiuta": { auth: true, approver: true, run: (s, b) => decideLeave(s, b, false) },
  "/api/presenze": { auth: true, run: saveTimesheet },
  "/api/profilo": { auth: true, run: saveProfile },
  "/api/paghe/elabora": { auth: true, hr: true, run: runPayroll },
};

/** Esegue un'API: restituisce { status, body, flash, changed }. */
export function runApi(state, pathname, method, body) {
  const route = ROUTES[pathname];
  if (!route) return { ...missing(), changed: false };
  if (method !== "POST") return { status: 405, body: { ok: false, errors: {} }, changed: false };
  if (route.auth && !state.user) return { status: 401, body: { ok: false, errors: {}, redirect: "/accedi" }, changed: false };
  if (route.hr && !canEditEmployees(roleOf(state.user))) return { ...denied(), changed: false };
  if (route.approver && !canApprove(state.data, state.user)) return { ...denied(), changed: false };
  const result = route.run(state, body && typeof body === "object" ? body : {});
  return { ...result, changed: result.status === 200 && pathname !== "/api/paghe/elabora" };
}

export { formatItDate };
