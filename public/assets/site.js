// Valdora HR: comportamento nel browser. Ogni modifica è una richiesta HTTP alle API
// (fetch POST JSON); gli errori tornano dal server e compaiono sotto i campi.
(function () {
  "use strict";

  const byTestId = (id) => document.querySelector(`[data-testid="${CSS.escape(id)}"]`);

  function clearErrors(scope) {
    scope.querySelectorAll('[data-testid$="-error"]').forEach((el) => {
      el.textContent = "";
      el.hidden = true;
    });
  }

  function showErrors(errors) {
    for (const [id, message] of Object.entries(errors || {})) {
      const el = byTestId(id);
      if (!el) continue;
      el.textContent = message;
      el.hidden = false;
    }
  }

  async function post(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (response.status === 401) {
      window.location.assign(`/accedi?ritorno=${encodeURIComponent(location.pathname + location.search)}`);
      return null;
    }
    return body;
  }

  // Un solo invio alla volta per pagina: mentre è in corso, ogni controllo che modifica
  // dati resta disabilitato. Playwright aspetta che un controllo torni abilitato prima
  // di cliccarlo, quindi due azioni cliccate di fila partono una dopo l'altra, e la
  // seconda sulla pagina ricaricata con lo stato aggiornato.
  let busy = false;
  function lock(on) {
    busy = on;
    document.querySelectorAll('button[data-post], form[data-api] [type="submit"]').forEach((el) => {
      el.disabled = on;
    });
  }

  async function send(path, payload, onFailure) {
    if (busy) return;
    lock(true);
    let leaving = false;
    try {
      const body = await post(path, payload);
      if (!body) {
        leaving = true;
        return;
      }
      if (body.ok) {
        leaving = true;
        window.location.assign(body.redirect || location.pathname + location.search);
        return;
      }
      onFailure(body);
    } finally {
      if (!leaving) lock(false);
    }
  }

  // Moduli con data-api: invio JSON, poi redirect o errori sotto i campi.
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.api) return;
    event.preventDefault();
    const payload = {};
    new FormData(form).forEach((value, key) => {
      payload[key] = String(value);
    });
    send(form.dataset.api, payload, (body) => {
      clearErrors(form);
      showErrors(body.errors);
    });
  });

  // Pulsanti: dialoghi, rifiuto in riga e azioni singole con data-post (approva, ritira, esci, conferme).
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.openDialog) {
      document.getElementById(button.dataset.openDialog)?.showModal();
      return;
    }
    if (button.hasAttribute("data-close-dialog")) {
      button.closest("dialog")?.close();
      return;
    }
    if (button.dataset.reveal) {
      const box = document.getElementById(button.dataset.reveal);
      if (box) {
        box.hidden = false;
        box.querySelector("textarea, input")?.focus();
      }
      return;
    }
    if (!button.dataset.post) return;
    const payload = button.dataset.payload ? JSON.parse(button.dataset.payload) : {};
    if (button.dataset.fieldMotivo) payload.motivo = byTestId(button.dataset.fieldMotivo)?.value || "";
    send(button.dataset.post, payload, (body) => {
      if (!body.errors || !Object.keys(body.errors).length) {
        // Azione non più valida (es. richiesta già decisa in un'altra scheda): ricarica lo stato vero.
        window.location.reload();
        return;
      }
      const scope = button.closest("tr, dialog, form, section") || document;
      clearErrors(scope);
      showErrors(body.errors);
    });
  });

  // Nuovo dipendente / modifica: responsabile preimpostato dal reparto, fine contratto solo per il determinato.
  const reparto = byTestId("field-reparto");
  const responsabile = byTestId("field-responsabile");
  // Solo nel nuovo dipendente: in modifica cambiare reparto non tocca il responsabile.
  if (reparto && responsabile && reparto.form && reparto.form.hasAttribute("data-prefill-manager")) {
    reparto.addEventListener("change", () => {
      const manager = reparto.selectedOptions[0]?.dataset.manager;
      if (manager) responsabile.value = manager;
    });
  }
  const contratto = byTestId("field-contratto");
  const endWrap = document.getElementById("field-data-fine-wrap");
  if (contratto && endWrap) {
    const sync = () => {
      endWrap.hidden = contratto.value !== "DET";
    };
    contratto.addEventListener("change", sync);
    sync();
  }

  // Ferie: anteprima dei giorni lavorativi mentre si scrivono le date.
  const start = byTestId("leave-start");
  const end = byTestId("leave-end");
  const preview = byTestId("leave-days-preview");
  if (start && end && preview) {
    const holidays = new Set((start.form.dataset.holidays || "").split(",").filter(Boolean));
    const parse = (text) => {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
      if (!m) return null;
      const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const ms = Date.UTC(y, mo - 1, d);
      const date = new Date(ms);
      if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
      return ms;
    };
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10); // ms è mezzanotte UTC: nessuno spostamento di fuso
    const update = () => {
      const a = parse(start.value);
      const b = parse(end.value);
      if (a === null || b === null || b < a) {
        preview.hidden = true;
        preview.textContent = "";
        return;
      }
      let days = 0;
      for (let ms = a; ms <= b; ms += 86400000) {
        const weekday = new Date(ms).getUTCDay();
        if (weekday !== 0 && weekday !== 6 && !holidays.has(iso(ms))) days += 1;
      }
      preview.textContent = `Giorni lavorativi: ${days}`;
      preview.hidden = false;
    };
    start.addEventListener("input", update);
    end.addEventListener("input", update);
    update();
  }
})();
