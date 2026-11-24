# Deploy di Valdora HR su Netlify

Ogni release è un branch `release/<versione>` pubblicato da Netlify come **branch deploy**, con un URL proprio e dati propri:

| Branch | URL | Contenuto |
|---|---|---|
| `main` | `https://<sito>.netlify.app` (produzione) | sviluppo, non usato dalla pipeline |
| `release/1.0` | `https://release-1-0--<sito>.netlify.app` | release pulita, zero bug |
| `release/1.x` | `https://release-1-x--<sito>.netlify.app` | release con bug seminati (da fare) |

Le sessioni stanno in Netlify Blobs nello store **del singolo deploy**: due release non condividono mai dati, e un nuovo deploy dello stesso branch riparte da zero.

## 1. Repository GitHub

1. Crea su GitHub un repository **privato** vuoto, ad esempio `valdora-hr` (senza README, `.gitignore` o licenza). Privato perché più avanti conterrà il catalogo dei bug, cioè le risposte.
2. Da questa cartella collega il repository e carica i due branch:

```powershell
git remote add origin https://github.com/<proprietario>/valdora-hr.git
```

```powershell
git push -u origin main release/1.0
```

## 2. Sito Netlify

1. Su https://app.netlify.com: **Add new project → Import an existing project → GitHub**, autorizza l'accesso al solo repository `valdora-hr` e sceglilo.
2. Impostazioni di build: lascia quelle lette da `netlify.toml` (publish `public`, funzioni in `netlify/functions`, Node 22). Branch di produzione: `main`.
3. **Project name**: scegli il sottodominio (es. `valdora-hr-test`). Gli URL delle release diventano `release-1-0--valdora-hr-test.netlify.app`.
4. Attiva i branch deploy: **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Configure → Branch deploys: Let me add individual branches**, aggiungi `release/1.0` e salva. Ogni release futura va aggiunta qui. In alternativa scegli **All** (ogni branch pubblicato viene pubblicato).
5. Se il primo deploy di `release/1.0` non parte da solo dopo il punto 4, avvialo da **Deploys → Trigger deploy** o con un push vuoto sul branch:

```powershell
git commit --allow-empty -m "Avvia il branch deploy di release/1.0"
```

```powershell
git push origin release/1.0
```

Netlify Blobs non richiede configurazione: la funzione riceve l'accesso allo store automaticamente.

## 3. Verifica del deploy

```powershell
node scripts/smoke.mjs https://release-1-0--<sito>.netlify.app
```

Lo smoke test verifica pagine, redirect, file statici, 403/404 e lo stato in Blobs: una richiesta di ferie salvata si rilegge subito, un'altra sessione vede i dati iniziali, due approvazioni parallele vengono applicate entrambe. Non chiama le API vietate ai test. Deve finire con `Tutti i controlli passati`.

## 4. LABBGEN su questa release

Nel file `.env` di `MALLM_Agent_ASK`:

```
TARGET_APP_URL=https://release-1-0--<sito>.netlify.app
DOMAIN_CONTEXT_PATH=domain/valdora_hr.json
PLANNER_IMAGE_PATH=valdora_hr.png
```

- Il profilo `domain/valdora_hr.json` non fissa `target_origin`, quindi vale per ogni release: per passare a un'altra release si cambia solo `TARGET_APP_URL`.
- `PLANNER_IMAGE_PATH` indica lo screenshot della dashboard HR in `graph/images/valdora_hr.png`.
- La prima run sulla release 1.0 è la base dei falsi positivi: su un sito senza bug non dovrebbe produrre alcun `sut_bug`.

## Note

- Il sito è pubblico ma non indicizzato (`robots.txt`, `X-Robots-Tag`), e tutti i dati e gli utenti di prova sono inventati.
- I limiti del piano Netlify (minuti di build, invocazioni delle funzioni, Blobs) vanno controllati sul tuo account. Una run della pipeline fa qualche centinaio di richieste.
