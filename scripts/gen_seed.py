"""Genera i dati iniziali di Valdora HR (data/seed.json) e i fatti derivati
(data/facts.json) che specifica e profilo di dominio citano.

Deterministico: nessun numero casuale. Rieseguirlo produce gli stessi file.
I fatti sono calcolati qui con le regole della specifica (SPEC.md), cosi la
specifica, il profilo LABBGEN e l'app non possono divergere sui numeri: l'app
li verifichera nei propri test contro facts.json.

Uso:  python scripts/gen_seed.py
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYSTEM_DATE = date(2026, 11, 18)  # mercoledi
CURRENT_WEEK = [date(2026, 11, 16) + timedelta(days=i) for i in range(5)]  # lun-ven
HOLIDAYS_2026 = [date(2026, 1, 1), date(2026, 1, 6), date(2026, 4, 6), date(2026, 4, 25),
                 date(2026, 5, 1), date(2026, 6, 2), date(2026, 8, 15), date(2026, 11, 1),
                 date(2026, 12, 8), date(2026, 12, 25), date(2026, 12, 26)]
FERIE_SPETTANTI = 26
PASSWORD = "Valdora2026!"
EMAIL_DOMAIN = "valdora.example"

REPARTI = [
    ("AMM", "Amministrazione"),
    ("HR", "Risorse Umane"),
    ("PRD", "Produzione"),
    ("LOG", "Logistica"),
    ("VEN", "Vendite"),
    ("IT", "Sistemi informativi"),
]

# matricola, nome, cognome, sesso, nascita, comune(Belfiore), reparto, mansione,
# responsabile, contratto, fine contratto, % part-time, RAL, assunzione, cessazione
EMPLOYEES = [
    (1, "Marco", "Esposito", "M", "1968-04-12", "F839", "AMM", "Direttore generale", None, "IND", None, 100, 98000, "2004-03-01", None),
    (2, "Chiara", "Romano", "F", "1985-09-23", "H501", "AMM", "Contabile", 1, "IND", None, 100, 38000, "2012-05-14", None),
    (3, "Davide", "Colombo", "M", "1981-01-30", "F205", "AMM", "Controller", 1, "IND", None, 100, 46000, "2015-10-01", None),
    (4, "Federica", "Dalla Valle", "F", "1990-07-08", "A944", "AMM", "Impiegata amministrativa", 1, "IND", None, 50, 29000, "2019-02-04", None),
    (5, "Gaia", "D'Angelo", "F", "2005-02-17", "F839", "AMM", "Apprendista amministrativa", 1, "APP", None, 100, 22000, "2026-09-01", None),
    (6, "Laura", "Bianchi", "F", "1979-11-03", "F205", "HR", "Responsabile Risorse Umane", 1, "IND", None, 100, 52000, "2010-09-13", None),
    (7, "Niccolò", "Fabbri", "M", "1992-03-21", "A944", "HR", "Addetto paghe", 6, "IND", None, 100, 33000, "2018-10-01", None),
    (8, "Paolo", "Neri", "M", "1976-06-25", "L219", "PRD", "Responsabile Produzione", 1, "IND", None, 100, 56000, "2008-01-07", None),
    (9, "Alessandro", "Rossi", "M", "1988-12-02", "L219", "PRD", "Operaio", 8, "IND", None, 100, 26000, "2016-04-11", "2026-06-30"),
    (10, "Sara", "Conti", "F", "1991-05-19", "D612", "PRD", "Tecnica di produzione", 8, "IND", None, 80, 31000, "2017-03-06", None),
    (11, "Luca", "Rossi", "M", "1987-08-14", "L219", "PRD", "Operaio specializzato", 8, "IND", None, 100, 28500, "2013-11-04", None),
    (12, "Matteo", "Gallo", "M", "1994-02-27", "L219", "PRD", "Operaio", 8, "IND", None, 100, 26000, "2020-07-01", None),
    (13, "Elena", "Marino", "F", "1983-10-09", "F205", "PRD", "Capoturno", 8, "IND", None, 100, 34000, "2011-09-19", None),
    (14, "Andrea", "De Luca", "M", "1986-04-04", "F839", "PRD", "Manutentore", 8, "IND", None, 100, 30500, "2014-02-17", None),
    (15, "Francesca", "Greco", "F", "1998-06-30", "H501", "PRD", "Operaia", 8, "DET", "2027-05-31", 100, 25000, "2025-12-01", None),
    (16, "Simone", "Bruno", "M", "1995-09-12", "L219", "PRD", "Operaio", 8, "IND", None, 100, 26000, "2021-03-15", None),
    (17, "Giulia", "Rossi", "F", "1989-01-25", "A944", "PRD", "Addetta qualità", 8, "IND", None, 100, 32000, "2015-05-04", None),
    (18, "Stefano", "Lombardi", "M", "1980-03-16", "L219", "PRD", "Operaio", 8, "IND", None, 60, 26000, "2009-10-12", None),
    (19, "Martina", "Moretti", "F", "2004-12-01", "D612", "PRD", "Apprendista operaia", 8, "APP", None, 100, 21500, "2025-09-15", None),
    (20, "Riccardo", "Barbieri", "M", "1997-07-22", "L219", "PRD", "Operaio", 8, "DET", "2027-02-28", 100, 25500, "2026-03-02", None),
    (21, "Giorgio", "Fontana", "M", "1975-05-05", "F205", "LOG", "Magazziniere", 22, "IND", None, 100, 27000, "2006-06-05", "2025-12-31"),
    (22, "Valentina", "Santoro", "F", "1982-08-29", "H501", "LOG", "Responsabile Logistica", 1, "IND", None, 100, 47000, "2012-01-16", None),
    (23, "Emanuele", "Mariani", "M", "1993-11-11", "H501", "LOG", "Magazziniere", 22, "IND", None, 100, 27000, "2019-09-02", None),
    (24, "Ilaria", "Rinaldi", "F", "1990-02-14", "F205", "LOG", "Pianificatrice", 22, "IND", None, 100, 33500, "2017-11-20", None),
    (25, "Tommaso", "Caruso", "M", "1984-12-19", "F839", "LOG", "Autista", 22, "IND", None, 100, 29000, "2014-08-25", None),
    (26, "Beatrice", "Ferrara", "F", "1996-04-27", "F839", "LOG", "Magazziniera", 22, "IND", None, 70, 26500, "2022-01-10", None),
    (27, "Lorenzo", "Galli", "M", "1999-10-03", "A944", "LOG", "Carrellista", 22, "DET", "2027-03-31", 100, 25000, "2026-04-01", None),
    (28, "Roberta", "Martini", "F", "1978-02-08", "H501", "VEN", "Responsabile Vendite", 1, "IND", None, 100, 61000, "2007-04-02", None),
    (29, "Fabio", "Leone", "M", "1988-06-15", "F205", "VEN", "Commerciale", 28, "IND", None, 100, 39000, "2016-09-05", None),
    (30, "Daniele", "Longo", "M", "1991-09-01", "H501", "VEN", "Commerciale", 28, "IND", None, 100, 38000, "2020-02-03", "2026-09-30"),
    (31, "Serena", "Gentile", "F", "1994-03-28", "D612", "VEN", "Customer care", 28, "IND", None, 50, 27000, "2021-10-18", None),
    (32, "Michele", "Martinelli", "M", "1985-07-07", "F205", "VEN", "Commerciale estero", 28, "IND", None, 100, 44000, "2013-06-10", None),
    (33, "Anna", "Vitale", "F", "1997-01-13", "A944", "VEN", "Assistente commerciale", 28, "IND", None, 100, 29500, "2022-05-02", None),
    (34, "Nicola", "Lombardo", "M", "1980-10-20", "L219", "IT", "Responsabile Sistemi informativi", 1, "IND", None, 100, 58000, "2011-03-07", None),
    (35, "Silvia", "Serra", "F", "1993-05-31", "A944", "IT", "Sviluppatrice", 34, "IND", None, 100, 41000, "2018-10-01", None),
    (36, "Pietro", "Coppola", "M", "1989-03-09", "H501", "IT", "Sistemista", 34, "IND", None, 100, 37000, "2016-01-11", None),
]

# Aumento di RAL: unico nel seed, per verificare che una busta paga usi la RAL
# in vigore nel proprio mese e non quella attuale.
RAL_HISTORY = {10: [("2017-03-06", 29000), ("2026-07-01", 31000)]}

TEST_USERS = {6: "hr", 8: "manager", 10: "dipendente"}

# Richieste di ferie del 2026. Le approvate formano i giorni gia usati.
# id, matricola, inizio, fine, stato, motivo
LEAVES = [
    ("F-1001", 11, "2026-11-16", "2026-11-20", "APPROVATA", "Ferie"),
    ("F-1002", 24, "2026-11-18", "2026-11-19", "APPROVATA", "Visita parenti"),
    ("F-1003", 29, "2026-11-17", "2026-11-17", "APPROVATA", ""),
    ("F-1004", 10, "2026-12-07", "2026-12-09", "IN_ATTESA", "Ponte dell'Immacolata"),
    ("F-1005", 12, "2026-12-21", "2026-12-31", "IN_ATTESA", "Festività natalizie"),
    ("F-1006", 13, "2026-12-14", "2026-12-18", "IN_ATTESA", ""),
    ("F-1007", 7, "2026-12-23", "2026-12-24", "IN_ATTESA", ""),
    ("F-1008", 35, "2026-12-28", "2026-12-30", "IN_ATTESA", "Viaggio"),
    ("F-1009", 10, "2026-08-10", "2026-08-21", "APPROVATA", "Ferie estive"),
    ("F-1010", 10, "2026-01-02", "2026-01-02", "APPROVATA", ""),
    ("F-1011", 13, "2026-10-26", "2026-10-30", "RIFIUTATA", "Settimana di vacanza"),
]
# Data di invio delle richieste in attesa: distinte, cosi l'ordine "dalla piu
# vecchia" delle approvazioni e determinato.
SUBMITTED_ON = {"F-1004": "2026-11-02", "F-1005": "2026-11-05", "F-1006": "2026-11-09",
                "F-1007": "2026-11-10", "F-1008": "2026-11-12"}
REJECTION_REASONS = {"F-1011": "Inventario di fine mese, servono tutti i capoturno."}

# Ferie estive generate per chi non ne ha gia nel seed: due settimane in agosto
# (10 giorni), una in meno (5) per chi e stato assunto nel 2026.
SUMMER_START = date(2026, 8, 10)

# Presenze gia registrate nella settimana corrente (ore per giorno, lun-mar).
TIMESHEETS = {
    10: {"2026-11-16": "6.5", "2026-11-17": "7"},
    8: {"2026-11-16": "9", "2026-11-17": "9.5"},
    6: {"2026-11-16": "8", "2026-11-17": "8"},
}

# ---------------------------------------------------------------- codice fiscale
MONTHS = "ABCDEHLMPRST"
ODD = {**dict(zip("0123456789", [1, 0, 5, 7, 9, 13, 15, 17, 19, 21])),
       **dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                  [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23]))}
EVEN = {**{str(i): i for i in range(10)}, **{c: i for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ")}}


def _letters(text: str) -> tuple[str, str]:
    import unicodedata
    plain = "".join(c for c in unicodedata.normalize("NFD", text.upper()) if c.isalpha() and c.isascii())
    cons = "".join(c for c in plain if c not in "AEIOU")
    vows = "".join(c for c in plain if c in "AEIOU")
    return cons, vows


def _surname_code(surname: str) -> str:
    cons, vows = _letters(surname)
    return (cons + vows + "XXX")[:3]


def _name_code(name: str) -> str:
    cons, vows = _letters(name)
    if len(cons) >= 4:
        return cons[0] + cons[2] + cons[3]
    return (cons + vows + "XXX")[:3]


def codice_fiscale(nome: str, cognome: str, sesso: str, nascita: date, comune: str) -> str:
    day = nascita.day + (40 if sesso == "F" else 0)
    partial = (_surname_code(cognome) + _name_code(nome) + f"{nascita.year % 100:02d}"
               + MONTHS[nascita.month - 1] + f"{day:02d}" + comune)
    total = sum(ODD[c] if i % 2 == 0 else EVEN[c] for i, c in enumerate(partial))
    return partial + chr(ord("A") + total % 26)


# ---------------------------------------------------------------- calcoli
CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def payslip(ral: int, part_time: int) -> dict[str, str]:
    """Busta paga mensile (SPEC.md, regola delle buste paga)."""
    lordo = money(Decimal(ral) * Decimal(part_time) / Decimal(100) / Decimal(13))
    contributi = money(lordo * Decimal("0.0919"))
    imponibile = lordo - contributi
    soglia = Decimal("2333.33")
    irpef = money(min(imponibile, soglia) * Decimal("0.23")
                  + max(imponibile - soglia, Decimal(0)) * Decimal("0.35"))
    netto = imponibile - irpef
    return {k: str(v) for k, v in
            {"lordo": lordo, "contributi": contributi, "imponibile": imponibile,
             "irpef": irpef, "netto": netto}.items()}


def ferie_spettanti(assunto: date) -> int:
    """26 giorni l'anno; chi e assunto nel 2026 ne matura 26 x mesi/12, per difetto,
    contando i mesi dal mese di assunzione incluso a dicembre."""
    if assunto.year < 2026:
        return FERIE_SPETTANTI
    months = 12 - assunto.month + 1
    return FERIE_SPETTANTI * months // 12


def working_days(start: date, end: date) -> int:
    days, d = 0, start
    while d <= end:
        if d.weekday() < 5 and d not in HOLIDAYS_2026:
            days += 1
        d += timedelta(days=1)
    return days


def it_money(value: str) -> str:
    whole, cents = f"{Decimal(value):.2f}".split(".")
    groups = []
    while len(whole) > 3:
        groups.insert(0, whole[-3:])
        whole = whole[:-3]
    groups.insert(0, whole)
    return ".".join(groups) + "," + cents + " €"


def ral_on(matricola: int, ral: int, month_start: date) -> int:
    current = ral
    for since, value in RAL_HISTORY.get(matricola, []):
        if date.fromisoformat(since) <= month_start:
            current = value
    return current


# ---------------------------------------------------------------- build
def build() -> tuple[dict, dict]:
    emps = []
    for (num, nome, cognome, sesso, nascita, comune, rep, mansione, resp, contratto, fine,
         pt, ral, assunto, cessato) in EMPLOYEES:
        mat = f"VLD-{num:04d}"
        local = f"{nome}.{cognome}".lower()
        import unicodedata
        local = "".join(c for c in unicodedata.normalize("NFD", local) if c.isascii() and (c.isalnum() or c == "."))
        stato = "CESSATO" if cessato and date.fromisoformat(cessato) <= SYSTEM_DATE else "ATTIVO"
        emps.append({
            "matricola": mat,
            "nome": nome,
            "cognome": cognome,
            "sesso": sesso,
            "data_nascita": nascita,
            "comune_nascita": comune,
            "codice_fiscale": codice_fiscale(nome, cognome, sesso, date.fromisoformat(nascita), comune),
            "email": f"{local}@{EMAIL_DOMAIN}",
            "telefono": f"+39 3{num % 10}{(num * 7) % 10} {100 + num * 13:03d} {1000 + num * 97:04d}"[:17],
            "reparto": rep,
            "mansione": mansione,
            "responsabile": f"VLD-{resp:04d}" if resp else None,
            "contratto": contratto,
            "data_fine_contratto": fine,
            "part_time": pt,
            "ral": ral,
            "ral_storico": [{"dal": d, "ral": v} for d, v in RAL_HISTORY.get(num, [])],
            "data_assunzione": assunto,
            "data_cessazione": cessato,
            "stato": stato,
            "ferie_spettanti": ferie_spettanti(date.fromisoformat(assunto)),
            "ruolo_applicativo": TEST_USERS.get(num, "dipendente"),
        })
    by_mat = {e["matricola"]: e for e in emps}

    leaves = []
    for lid, num, start, end, stato, motivo in LEAVES:
        mat = f"VLD-{num:04d}"
        leaves.append({
            "id": lid, "matricola": mat, "inizio": start, "fine": end, "stato": stato,
            "motivo": motivo, "giorni": working_days(date.fromisoformat(start), date.fromisoformat(end)),
            "motivo_rifiuto": REJECTION_REASONS.get(lid),
            "creata_il": SUBMITTED_ON.get(lid, start),
        })
    # Ferie estive generate: per ogni dipendente attivo senza approvate in agosto.
    next_id = 2001
    has_summer = {l["matricola"] for l in leaves if l["stato"] == "APPROVATA" and l["inizio"].startswith("2026-08")}
    for e in emps:
        if e["stato"] != "ATTIVO" or e["matricola"] in has_summer or e["responsabile"] is None:
            continue
        assunto = date.fromisoformat(e["data_assunzione"])
        if assunto > SUMMER_START:
            continue
        length = 5 if assunto.year == 2026 else 10
        start = SUMMER_START + timedelta(days=7 * (next_id % 2))  # 10/08 o 17/08
        end_days, d, end = 0, start, start
        while end_days < length:
            if d.weekday() < 5 and d not in HOLIDAYS_2026:
                end_days += 1
                end = d
            d += timedelta(days=1)
        leaves.append({
            "id": f"F-{next_id}", "matricola": e["matricola"], "inizio": start.isoformat(),
            "fine": end.isoformat(), "stato": "APPROVATA", "motivo": "Ferie estive",
            "giorni": working_days(start, end),
            "motivo_rifiuto": None, "creata_il": "2026-06-01",
        })
        next_id += 1
    leaves.sort(key=lambda l: l["id"])

    timesheets = [{"matricola": f"VLD-{num:04d}", "giorno": day, "ore": ore}
                  for num, days in TIMESHEETS.items() for day, ore in days.items()]

    users = [{"email": by_mat[f"VLD-{num:04d}"]["email"], "password": PASSWORD,
              "matricola": f"VLD-{num:04d}", "ruolo": role} for num, role in TEST_USERS.items()]

    seed = {
        "data_di_sistema": SYSTEM_DATE.isoformat(),
        "settimana_corrente": [d.isoformat() for d in CURRENT_WEEK],
        "festivita": [d.isoformat() for d in HOLIDAYS_2026],
        "reparti": [{"codice": c, "nome": n,
                     "responsabile": next((e["matricola"] for e in emps if e["reparto"] == c
                                           and e["mansione"].startswith(("Responsabile", "Direttore"))), None)}
                    for c, n in REPARTI],
        "dipendenti": emps,
        "ferie": leaves,
        "presenze": timesheets,
        "utenti": users,
        "mesi_elaborati": [f"2026-{m:02d}" for m in range(1, 11)],
    }
    return seed, facts(seed)


def facts(seed: dict) -> dict:
    emps = seed["dipendenti"]
    active = [e for e in emps if e["stato"] == "ATTIVO"]
    leaves = seed["ferie"]
    today = SYSTEM_DATE.isoformat()

    spettanti = {e["matricola"]: e["ferie_spettanti"] for e in emps}

    def usati(mat: str) -> int:
        return sum(l["giorni"] for l in leaves if l["matricola"] == mat and l["stato"] == "APPROVATA")

    def in_attesa(mat: str) -> int:
        return sum(l["giorni"] for l in leaves if l["matricola"] == mat and l["stato"] == "IN_ATTESA")

    def lordo_ottobre(e: dict) -> Decimal:
        return Decimal(payslip(ral_on(int(e["matricola"][4:]), e["ral"], date(2026, 10, 1)), e["part_time"])["lordo"])

    per_reparto = {r["nome"]: sum(1 for e in active if e["reparto"] == r["codice"]) for r in seed["reparti"]}
    pending = sorted((l for l in leaves if l["stato"] == "IN_ATTESA"), key=lambda l: (l["creata_il"], l["id"]))
    manager_of = {e["matricola"]: e["responsabile"] for e in emps}
    on_leave_today = sorted(f"{e['nome']} {e['cognome']}" for e in active
                            if any(l["matricola"] == e["matricola"] and l["stato"] == "APPROVATA"
                                   and l["inizio"] <= today <= l["fine"] for l in leaves))
    cost = sum((lordo_ottobre(e) for e in active), Decimal(0))

    def person(mat: str) -> dict:
        e = next(x for x in emps if x["matricola"] == mat)
        rals = {m: ral_on(int(mat[4:]), e["ral"], date.fromisoformat(m + "-01")) for m in ("2026-03", "2026-10")}
        return {
            "nome": f"{e['nome']} {e['cognome']}",
            "matricola": mat,
            "email": e["email"],
            "codice_fiscale": e["codice_fiscale"],
            "ferie_usate": usati(mat),
            "ferie_spettanti": spettanti[mat],
            "ferie_residue": spettanti[mat] - usati(mat),
            "ferie_in_attesa": in_attesa(mat),
            "ferie_richiedibili": spettanti[mat] - usati(mat) - in_attesa(mat),
            "busta_ottobre": {k: it_money(v) for k, v in payslip(rals["2026-10"], e["part_time"]).items()},
            "busta_marzo": {k: it_money(v) for k, v in payslip(rals["2026-03"], e["part_time"]).items()},
            "da_approvare": sum(1 for l in pending if manager_of[l["matricola"]] == mat),
            "diretti_attivi": sum(1 for x in active if x["responsabile"] == mat),
        }

    alpha = sorted(active, key=lambda e: (_sort_key(e["cognome"]), _sort_key(e["nome"]), e["matricola"]))
    pages = [alpha[i:i + 10] for i in range(0, len(alpha), 10)]
    return {
        "dipendenti_totali": len(emps),
        "dipendenti_attivi": len(active),
        "dipendenti_cessati": [f"{e['nome']} {e['cognome']} ({e['matricola']})" for e in
                               sorted((e for e in emps if e["stato"] == "CESSATO"), key=lambda e: _sort_key(e["cognome"]))],
        "per_reparto_attivi": per_reparto,
        "per_contratto_attivi": {c: sum(1 for e in active if e["contratto"] == c) for c in ("IND", "DET", "APP")},
        "part_time_attivi": sum(1 for e in active if e["part_time"] < 100),
        "richieste_in_attesa": len(pending),
        "in_ferie_oggi": on_leave_today,
        "costo_mensile_personale": it_money(str(cost)),
        "prossima_matricola": f"VLD-{max(int(e['matricola'][4:]) for e in emps) + 1:04d}",
        "prossimo_id_ferie": f"F-{max(int(l['id'][2:]) for l in leaves) + 1}",
        "ricerca_rossi_attivi": sum(1 for e in active if e["cognome"] == "Rossi"),
        "ricerca_rossi_tutti": sum(1 for e in emps if e["cognome"] == "Rossi"),
        "pagine_elenco_attivi": len(pages),
        "primo_e_ultimo_per_pagina": [[f"{p[0]['cognome']} {p[0]['nome']}", f"{p[-1]['cognome']} {p[-1]['nome']}", len(p)] for p in pages],
        "approvazioni": [{"id": l["id"], "richiedente": l["matricola"], "approvatore": manager_of[l["matricola"]],
                          "giorni": l["giorni"], "inviata_il": l["creata_il"],
                          "disponibili_richiedente": spettanti[l["matricola"]] - usati(l["matricola"]) - in_attesa(l["matricola"])}
                         for l in pending],
        "busta_ottobre_esempio_alta": {"chi": "Marco Esposito (VLD-0001)",
                                       **{k: it_money(v) for k, v in payslip(98000, 100).items()}},
        "giorni_esempio": {
            "07/12-09/12/2026": working_days(date(2026, 12, 7), date(2026, 12, 9)),
            "21/12-31/12/2026": working_days(date(2026, 12, 21), date(2026, 12, 31)),
        },
        "ferie_assunti_2026": {f"{e['nome']} {e['cognome']}": {"assunzione": e["data_assunzione"],
                                                                "spettanti": e["ferie_spettanti"],
                                                                "usati": usati(e["matricola"])}
                               for e in emps if e["data_assunzione"].startswith("2026")},
        "utenti": {
            "hr": person("VLD-0006"),
            "manager": person("VLD-0008"),
            "dipendente": person("VLD-0010"),
        },
    }


def _sort_key(text: str) -> str:
    import unicodedata
    plain = unicodedata.normalize("NFD", text.casefold())
    return "".join(c for c in plain if c.isalnum() and c.isascii())


def main() -> None:
    seed, fact = build()
    out = ROOT / "data"
    out.mkdir(exist_ok=True)
    (out / "seed.json").write_text(json.dumps(seed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "facts.json").write_text(json.dumps(fact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(fact, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
