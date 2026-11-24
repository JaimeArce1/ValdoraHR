// Ruoli e permessi (SPEC §2).
import { USERS } from "./data.js";
import { directReports } from "./domain.js";

export function roleOf(matricola) {
  return USERS.find((u) => u.matricola === matricola)?.ruolo || "dipendente";
}

export const canSeeEmployees = (role) => role === "hr" || role === "manager";
export const canEditEmployees = (role) => role === "hr";
export const canApprove = (data, matricola) => directReports(data, matricola).length > 0;

/** Voci del menu che l'utente può aprire, nell'ordine della SPEC §3. */
export function menu(data, user) {
  const role = roleOf(user);
  const items = [{ id: "nav-dashboard", href: "/dashboard", label: "Dashboard" }];
  if (canSeeEmployees(role)) items.push({ id: "nav-dipendenti", href: "/dipendenti", label: "Dipendenti" });
  if (canSeeEmployees(role)) items.push({ id: "nav-reparti", href: "/reparti", label: "Reparti" });
  items.push({ id: "nav-organigramma", href: "/organigramma", label: "Organigramma" });
  items.push({ id: "nav-ferie", href: "/ferie", label: "Ferie" });
  if (canApprove(data, user)) items.push({ id: "nav-approvazioni", href: "/ferie/approvazioni", label: "Da approvare", counter: true });
  items.push({ id: "nav-presenze", href: "/presenze", label: "Presenze" });
  items.push({ id: "nav-buste-paga", href: "/buste-paga", label: "Buste paga" });
  items.push({ id: "nav-profilo", href: "/profilo", label: "Profilo" });
  return items;
}
