// Utilità senza stato: testo, date, importi, ore.
// Date sempre come stringhe ISO `AAAA-MM-GG`; i calcoli passano da Date.UTC, mai
// dall'ora locale, così il fuso orario non sposta mai un giorno.

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Testo normalizzato (SPEC G8): senza maiuscole, accenti, spazi e apostrofi. */
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s'’]/g, "");
}

export function compareText(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// ------------------------------------------------------------------ date
function toUtc(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms) {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso, days) {
  return fromUtc(toUtc(iso) + days * 86400000);
}

/** 0 = lunedì ... 6 = domenica. */
export function weekday(iso) {
  return (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Stesso giorno del mese `months` mesi dopo; l'ultimo del mese se quel giorno non esiste. */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Anni compiuti alla data `at`. */
export function ageAt(birthIso, atIso) {
  const [by, bm, bd] = birthIso.split("-").map(Number);
  const [ay, am, ad] = atIso.split("-").map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  return age;
}

/** `GG/MM/AAAA` (giorno e mese anche a una cifra) → ISO, o null se non è una data vera. */
export function parseItDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text ?? "").trim());
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatItDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export function formatLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// ------------------------------------------------------------------ importi
/** Centesimi interi → `1.907,69 €` (punto delle migliaia anche a quattro cifre). */
export function formatMoney(cents) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const rest = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${euros},${rest} €`;
}

/** Divisione intera arrotondata al più vicino, metà per eccesso (numeri non negativi). */
export function divRoundHalfUp(numerator, denominator) {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

// ------------------------------------------------------------------ ore
export function formatHours(hours) {
  const value = Math.round(hours * 10) / 10;
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

/** `7,5` / `7.5` / `` → numero a mezz'ore fra 0 e 12, o null. */
export function parseHours(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") return 0;
  if (!/^\d{1,2}([.,]\d)?$/.test(raw)) return null;
  const value = Number(raw.replace(",", "."));
  if (value < 0 || value > 12 || (value * 2) % 1 !== 0) return null;
  return value;
}
