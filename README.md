# Valdora HR — SUT a release bacate per LABBGEN

Sito multi-pagina con un gestionale HR (società fittizia Officine Valdora S.r.l.) da far testare a LABBGEN. Ogni **release** è un deploy Netlify con un URL proprio e un insieme noto di bug seminati, così la pipeline si misura su difetti di cui si conosce la verità (SC-005).

## Stato

| Pezzo | Stato |
|---|---|
| Specifica v1.0 (`SPEC.md`) | scritta |
| Dati iniziali (`data/seed.json`, `data/facts.json`, `scripts/gen_seed.py`) | generati |
| Profilo di dominio LABBGEN | `MALLM_Agent_ASK/domain/valdora_hr.json` |
| Sito v1.0 senza bug | costruito e verificato in locale (`npm test`, browser) |
| Catalogo dei bug e release | da fare |
| Deploy Netlify | release 1.0 online su https://valdorahr.netlify.app (caricata con `npm run build:upload`), smoke test superato |

## Struttura

| Percorso | Contenuto |
|---|---|
| `src/handler.js` | gestore unico: sessione (cookie), accesso, permessi, pagine, API |
| `src/views.js`, `src/api.js` | pagine HTML e API JSON (validazioni e modifiche) |
| `src/domain.js`, `src/util.js` | regole di business (ferie, buste paga, ordinamenti, formati) |
| `public/assets/` | CSS e script del browser (invii via `fetch`, dialoghi, anteprima giorni) |
| `netlify/functions/site.mjs` | funzione Netlify che serve tutto il sito, sessioni in Netlify Blobs |
| `dev/server.mjs` | server locale con lo stesso gestore e sessioni in memoria |
| `tests/` | regole contro `data/facts.json` e flussi HTTP del sito |

## In locale

```powershell
npm test
```

```powershell
node dev/server.mjs
```

Serve Node 22.12 o successivo (richiesto da `@netlify/blobs` 11). Il sito risponde su http://localhost:8888 (porta da `PORT`). Le sessioni stanno in memoria: un riavvio riparte dai dati iniziali.

## Regole del progetto

- **La specifica descrive il sito corretto.** La release 1.0 la rispetta per intero. Ogni bug seminato viola una regola scritta nella specifica e, per essere rilevabile come `sut_bug`, anche una regola del profilo di dominio.
- **I numeri hanno una sola fonte**: `scripts/gen_seed.py`. Se cambi i dati, rigenera e riallinea specifica e profilo:

  ```powershell
  python scripts/gen_seed.py
  ```

- **Le risposte non si pubblicano.** Catalogo dei bug e manifest delle release non finiscono mai nella cartella pubblicata né nel bundle: il bug attivo è scelto al build e il codice dei bug spenti viene eliminato.
- **Bug sistematici**: deterministici e riproducibili, mai casuali a ogni richiesta.

## Release (piano)

- `release/1.0`: nessun bug. Una run qui deve dare zero `sut_bug` (base dei falsi positivi).
- `release/1.x`: bug nuovi, bug ereditati, bug corretti, una regressione e modifiche legittime (etichette o `data-testid` rinominati, da non contare come bug).
- Il branch `release/1.3` è servito da Netlify come `release-1-3--<sito>.netlify.app`. Il profilo non fissa `target_origin`, così lo stesso profilo vale per ogni release: si cambia solo `TARGET_APP_URL`.
