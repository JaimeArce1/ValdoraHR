// Le regole di src/domain.js devono riprodurre i fatti calcolati da scripts/gen_seed.py
// (data/facts.json), che sono anche i numeri citati da SPEC.md e dal profilo LABBGEN.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialData, seedEmployee } from "../src/data.js";
import {
  activeEmployees, allPending, directReports, entitlement, filterEmployees, leaveSummary, monthlyCost,
  nextLeaveId, nextMatricola, onLeaveToday, payslip, payslipsFor, pendingForApprover, timesheet, workingDays,
} from "../src/domain.js";
import { formatMoney, normalize } from "../src/util.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const data = initialData();
const money = (cents) => formatMoney(cents);

test("organico e conteggi", () => {
  assert.equal(data.dipendenti.length, facts.dipendenti_totali);
  assert.equal(activeEmployees(data).length, facts.dipendenti_attivi);
  for (const r of data.reparti) {
    assert.equal(filterEmployees(data, { reparto: r.codice }).length, facts.per_reparto_attivi[r.nome], r.nome);
  }
  for (const [code, count] of Object.entries(facts.per_contratto_attivi)) {
    assert.equal(filterEmployees(data, { contratto: code }).length, count, code);
  }
  assert.deepEqual(
    filterEmployees(data, { stato: "cessati" }).map((e) => `${e.nome} ${e.cognome} (${e.matricola})`),
    facts.dipendenti_cessati,
  );
  assert.equal(nextMatricola(data), facts.prossima_matricola);
  assert.equal(nextLeaveId(data), facts.prossimo_id_ferie);
  assert.equal(allPending(data).length, facts.richieste_in_attesa);
  assert.deepEqual(onLeaveToday(data).map((e) => `${e.nome} ${e.cognome}`), facts.in_ferie_oggi);
  assert.equal(money(monthlyCost(data)), facts.costo_mensile_personale);
});

test("pagine dell'elenco con i filtri di default", () => {
  const rows = filterEmployees(data, {});
  const pages = [];
  for (let i = 0; i < rows.length; i += 10) pages.push(rows.slice(i, i + 10));
  assert.deepEqual(
    pages.map((p) => [`${p[0].cognome} ${p[0].nome}`, `${p.at(-1).cognome} ${p.at(-1).nome}`, p.length]),
    facts.primo_e_ultimo_per_pagina,
  );
});

test("ricerca e ordinamento", () => {
  const names = (opts) => filterEmployees(data, opts).map((e) => `${e.nome} ${e.cognome}`);
  assert.deepEqual(names({ q: "rossi" }), ["Giulia Rossi", "Luca Rossi"]);
  assert.equal(names({ q: "rossi", stato: "tutti" }).length, 3);
  assert.deepEqual(names({ q: "rossi luca" }), ["Luca Rossi"]);
  assert.deepEqual(names({ q: "Luca Rossi" }), ["Luca Rossi"]);
  assert.deepEqual(names({ q: "niccolo" }), ["Niccolò Fabbri"]);
  assert.deepEqual(names({ q: "deluca" }), ["Andrea De Luca"]);
  assert.deepEqual(names({ q: "ria" }), ["Emanuele Mariani", "Ilaria Rinaldi"]);
  assert.deepEqual(names({ q: "vld-0012" }), ["Matteo Gallo"]);
  const firstPage = names({}).slice(7, 10);
  assert.deepEqual(firstPage, ["Federica Dalla Valle", "Gaia D'Angelo", "Andrea De Luca"]);
  for (const ordina of ["assunzione-asc", "assunzione-desc"]) {
    const order = names({ ordina }).filter((n) => ["Niccolò Fabbri", "Silvia Serra"].includes(n));
    assert.deepEqual(order, ["Niccolò Fabbri", "Silvia Serra"], ordina);
  }
  const desc = names({ ordina: "cognome-desc" });
  assert.ok(desc.indexOf("Giulia Rossi") < desc.indexOf("Luca Rossi"), "a parità di cognome il nome resta crescente");
  assert.equal(normalize("D'Angelo"), "dangelo");
});

test("ferie", () => {
  assert.equal(workingDays("2026-12-07", "2026-12-09"), 2);
  assert.equal(workingDays("2026-12-21", "2026-12-31"), 8);
  assert.equal(workingDays("2026-12-24", "2026-12-28"), 2);
  assert.equal(workingDays("2026-12-14", "2026-12-16"), 3);
  for (const [name, f] of Object.entries(facts.ferie_assunti_2026)) {
    assert.equal(entitlement(f.assunzione), f.spettanti, name);
  }
  assert.equal(entitlement("2026-11-18"), 4);
  for (const role of ["hr", "manager", "dipendente"]) {
    const u = facts.utenti[role];
    const s = leaveSummary(data, u.matricola);
    assert.deepEqual([s.entitled, s.used, s.pending, s.remaining, s.available],
      [u.ferie_spettanti, u.ferie_usate, u.ferie_in_attesa, u.ferie_residue, u.ferie_richiedibili], role);
    assert.equal(pendingForApprover(data, u.matricola).length, u.da_approvare, role);
    assert.equal(directReports(data, u.matricola).length, u.diretti_attivi, role);
  }
  const approvals = facts.approvazioni.map((a) => a.id);
  const shown = [...pendingForApprover(data, "VLD-0008"), ...pendingForApprover(data, "VLD-0006"), ...pendingForApprover(data, "VLD-0034")].map((l) => l.id);
  assert.deepEqual(shown, approvals);
  for (const a of facts.approvazioni) {
    assert.equal(leaveSummary(data, a.richiedente).available, a.disponibili_richiedente, a.id);
  }
});

test("presenze", () => {
  const sara = timesheet(data, "VLD-0010");
  assert.deepEqual([sara.expected, sara.total, sara.overtime], [32, 13.5, 0]);
  const paolo = timesheet(data, "VLD-0008");
  assert.deepEqual([paolo.expected, paolo.total], [40, 18.5]);
  const luca = timesheet(data, "VLD-0011");
  assert.equal(luca.total, 40, "una settimana di ferie vale le ore previste");
  assert.ok(luca.days.every((d) => d.leave && !d.editable));
});

test("buste paga", () => {
  const check = (slip, expected) => {
    assert.deepEqual(
      [money(slip.gross), money(slip.contributions), money(slip.taxable), money(slip.tax), money(slip.net)],
      [expected.lordo, expected.contributi, expected.imponibile, expected.irpef, expected.netto],
    );
  };
  for (const role of ["hr", "manager", "dipendente"]) {
    const u = facts.utenti[role];
    const slips = payslipsFor(seedEmployee(u.matricola));
    check(slips.find((s) => s.month === "2026-10"), u.busta_ottobre);
    check(slips.find((s) => s.month === "2026-03"), u.busta_marzo);
  }
  check(payslip(98000, 100), facts.busta_ottobre_esempio_alta);
  assert.deepEqual(payslipsFor(seedEmployee("VLD-0021")), []);
  assert.deepEqual(payslipsFor(seedEmployee("VLD-0030")).map((s) => s.month).at(-1), "2026-09");
  assert.deepEqual(payslipsFor(seedEmployee("VLD-0005")).map((s) => s.month), ["2026-09", "2026-10"]);
});
