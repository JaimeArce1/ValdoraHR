# Valdora HR — specifica funzionale v1.0

Gestionale delle risorse umane della società fittizia **Officine Valdora S.r.l.**, costruito come sito multi-pagina da far testare a LABBGEN (system under test). Questa specifica descrive il comportamento **corretto**: la release 1.0 la rispetta per intero, e ogni bug seminato nelle release successive è una deviazione da una regola scritta qui.

Fonte unica dei dati: `data/seed.json`. Fonte unica dei numeri citati: `data/facts.json`. Entrambi sono generati da `scripts/gen_seed.py`; se un numero di questa specifica e `facts.json` divergono, vale `facts.json` e la specifica va corretta.

Tutti i nomi, le persone e i dati sono inventati.

---

## 1. Principi generali

| # | Regola |
|---|---|
| G1 | **Data di sistema fissa: mercoledì 18 novembre 2026**, mostrata nel piede di ogni pagina (`system-date`: `Data di sistema: mercoledì 18 novembre 2026`). Età, scadenze, stato di un dipendente, ferie in corso e settimana delle presenze si calcolano su questa data, mai su quella reale. |
| G2 | **Stato per sessione del browser.** Al primo accesso il server assegna un cookie di sessione (`vhr_session`) e una copia dei dati iniziali solo per quella sessione. Ogni modifica (dipendenti, ferie, presenze, profilo) vale solo per quella sessione; un nuovo browser, o un nuovo contesto di browser, riparte dai dati iniziali. Uscire (`Esci`) non azzera i dati della sessione. |
| G3 | **Effetti su un altro utente**: per vederli si esce e si accede come l'altro utente **nello stesso browser** (stessa sessione). In un contesto nuovo si vedono i dati iniziali. Ogni test che parte da un contesto nuovo vede quindi i dati iniziali; due test che condividono la sessione si vedono le modifiche a vicenda. |
| G4 | **Pagine vere**: Valdora HR è un **sito multi-pagina**: ogni sezione è un URL distinto con la propria pagina HTML resa dal server (non un'app a pagina singola). Filtri, ordinamento e pagina dell'elenco stanno nella query string. |
| G5 | **Identificatori di test**: ogni controllo e ogni valore da verificare ha un `data-testid` stabile (elenco nelle sezioni sotto). Quelli variabili usano identificativi fissi del seed: matricola (`VLD-0010`), id richiesta (`F-1004`), codice reparto (`PRD`), data ISO (`2026-11-16`). |
| G6 | **Formati**: date `GG/MM/AAAA` in campi e tabelle, per esteso solo nel piede; importi in euro con il punto delle migliaia anche a quattro cifre, la virgola, due decimali, uno spazio normale e il simbolo (`1.907,69 €`); ore con la virgola e senza decimali se intere (`6,5`, `32`). |
| G7 | **Moduli**: niente validazione del browser (`novalidate`). Gli errori compaiono solo dopo l'invio. Gli errori di campo compaiono tutti insieme sotto il rispettivo campo (`<testid del campo>-error`); un modulo ha al più un errore generale (`login-error`, `leave-error`, `profile-emergency-error`), descritto nella sua sezione. Gli elementi d'errore sono sempre nella pagina, vuoti e nascosti finché non c'è un errore: si verificano con visibilità e testo, non con la loro presenza. Il modulo conserva i valori inseriti; correggendo un campo e reinviando, il suo errore scompare. Dopo un invio riuscito compare `flash-message`. |
| G8 | **Testo normalizzato**: ricerca e ordinamento alfabetico confrontano il testo senza maiuscole, accenti, spazi e apostrofi (`D'Angelo` → `dangelo`, `Dalla Valle` → `dallavalle`, `Niccolò` → `niccolo`). |
| G9 | **Ordine dei controlli su una pagina**: prima l'accesso (senza accesso → `/accedi?ritorno=…`, anche per un indirizzo inesistente), poi i permessi del ruolo (403), poi l'esistenza della risorsa (404). |
| G10 | **Permessi insufficienti**: stato HTTP 403 e pagina `Non hai i permessi per aprire questa pagina.` (`forbidden-message`). Il menu mostra solo le voci che l'utente può aprire. |
| G11 | **Indirizzi sconosciuti** (con accesso), comprese matricole inesistenti: stato HTTP 404 e pagina `Pagina non trovata.` (`not-found-message`) con il link alla dashboard (`not-found-home`). |
| G12 | **Azioni che i test non completano**: elaborare le buste paga (`POST /api/paghe/elabora`) ed eliminare definitivamente un dipendente (`POST /api/dipendenti/elimina`). I test verificano i dialoghi di conferma ma non premono Conferma. |
| G13 | **Intervalli di date**: dove la specifica dice "fra A e B", gli estremi sono inclusi salvo dove è scritto "successiva". |

## 2. Utenti e ruoli

Password di tutti gli utenti di prova: `Valdora2026!`

| Ruolo | Utente | Email | Matricola | Note |
|---|---|---|---|---|
| HR | Laura Bianchi | `laura.bianchi@valdora.example` | VLD-0006 | Responsabile Risorse Umane; 1 diretto riporto (Niccolò Fabbri), 1 richiesta da approvare |
| Manager | Paolo Neri | `paolo.neri@valdora.example` | VLD-0008 | Responsabile Produzione; 11 diretti riporti attivi, 3 richieste da approvare |
| Dipendente | Sara Conti | `sara.conti@valdora.example` | VLD-0010 | Produzione, part-time 80%, responsabile Paolo Neri |

**Matrice di accesso** (✓ = consentito, altrimenti 403):

| Pagina | HR | Manager | Dipendente |
|---|---|---|---|
| `/dashboard` | ✓ | ✓ | ✓ |
| `/dipendenti`, `/dipendenti/<matricola>` | ✓ | ✓ | — |
| `/dipendenti/nuovo`, `/dipendenti/<matricola>/modifica` | ✓ | — | — |
| `/reparti` | ✓ | ✓ | — |
| `/organigramma` | ✓ | ✓ | ✓ |
| `/ferie` | ✓ | ✓ | ✓ |
| `/ferie/approvazioni` | solo chi ha almeno un diretto riporto attivo, qualunque sia il ruolo (all'inizio Laura ✓, Paolo ✓, Sara —) |
| `/presenze`, `/profilo` | ✓ | ✓ | ✓ |
| `/buste-paga` | ✓ (di tutti) | ✓ (solo proprie) | ✓ (solo proprie) |

La RAL di un altro dipendente è visibile solo al ruolo HR (elenco, scheda, modulo); ognuno vede la propria nelle buste paga.

## 3. Struttura comune delle pagine

- Intestazione: logo `Valdora HR`; menu con, nell'ordine e solo se consentite, `nav-dashboard` (`Dashboard`), `nav-dipendenti` (`Dipendenti`), `nav-reparti` (`Reparti`), `nav-organigramma` (`Organigramma`), `nav-ferie` (`Ferie`), `nav-approvazioni` (`Da approvare (n)`), `nav-presenze` (`Presenze`), `nav-buste-paga` (`Buste paga`), `nav-profilo` (`Profilo`); saluto `user-greeting` (`Ciao, Laura`); pulsante `logout` (`Esci`).
- `nav-approvazioni` conta le richieste **In attesa** dei diretti riporti **attuali** dell'utente. Il numero è lo stesso su ogni pagina e cambia subito dopo un'approvazione, un rifiuto, un ritiro, una nuova richiesta di un diretto riporto o un cambio di responsabile. Assente per chi non ha diretti riporti attivi.
- Piede: `system-date`.

## 4. Accesso — `/accedi`

- Campi `login-email`, `login-password`, pulsante `login-submit` (`Accedi`).
- Errori di campo: email vuota → `Inserisci l'email.` (`login-email-error`); password vuota → `Inserisci la password.` (`login-password-error`). Errore generale, solo se entrambi i campi sono compilati e le credenziali non corrispondono: `Email o password non corrette.` (`login-error`). L'email non distingue le maiuscole.
- Qualunque indirizzo aperto senza accesso porta a `/accedi?ritorno=<percorso e query originali, codificati con encodeURIComponent>` (es. `/accedi?ritorno=%2Fpresenze`). Dopo l'accesso si apre il `ritorno` se è un percorso interno: inizia con una sola `/`, non con `//`, non contiene `\` né caratteri di controllo; altrimenti `/dashboard`. `/` porta a `/dashboard` (con accesso) o ad `/accedi` (senza).
- `/accedi` mostra sempre il modulo, anche a chi ha già effettuato l'accesso: accedere come un altro utente sostituisce quello corrente.
- `Esci` porta ad `/accedi` con `flash-message` `Sei uscito.`.

## 5. Dashboard — `/dashboard`

Titolo `Buongiorno, <nome>`. Riquadri per ruolo (il `testid` è sul solo valore):

| Ruolo | Etichetta | testid | Valore iniziale |
|---|---|---|---|
| HR | Dipendenti attivi | `kpi-attivi` | `33` |
| HR | In ferie oggi | `kpi-in-ferie-oggi` | `2` (dipendenti attivi con una richiesta Approvata che comprende il 18/11/2026) |
| HR | Richieste in attesa | `kpi-in-attesa` | `5` (richieste In attesa di tutta l'azienda) |
| HR | Costo mensile del personale | `kpi-costo-mensile` | `88.611,53 €` (vedi regola C1) |
| Manager | Diretti riporti attivi | `kpi-team` | `11` |
| Manager | In ferie oggi nel team | `kpi-team-in-ferie` | `1` |
| Manager | Da approvare | `kpi-da-approvare` | `3` |
| Dipendente | Ferie residue | `kpi-ferie-residue` | `15` |
| Dipendente | Ferie in attesa | `kpi-ferie-in-attesa` | `2` |
| Dipendente | Ultimo netto | `kpi-ultimo-netto` | `1.333,92 €` (netto dell'ultima busta paga propria, ottobre 2026) |

HR e manager vedono anche l'elenco `In ferie oggi` (`on-leave-list`, voci `on-leave-<matricola>` con `Nome Cognome`, ordinate per cognome), di tutta l'azienda per HR (Ilaria Rinaldi, Luca Rossi) e dei soli diretti riporti per il manager (Luca Rossi).

**C1 — costo mensile del personale**: somma dei lordi mensili (regola B2, ognuno già arrotondato al centesimo) dei dipendenti in stato **Attivo** (compresi quelli con `Cessazione prevista`), calcolati con la RAL e l'orario **attuali**. Cambia con le assunzioni, le cessazioni effettive e le modifiche di RAL o orario.

Il ruolo HR ha il pulsante `payroll-run` (`Elabora paghe di novembre`), che apre il dialogo `payroll-dialog` con il testo (`payroll-dialog-text`) `Elaborare le buste paga di novembre 2026 per 33 dipendenti attivi? L'operazione non si può annullare.` (il numero è sempre quello dei dipendenti attivi) e i pulsanti `payroll-confirm` (`Conferma`, invia `POST /api/paghe/elabora`) e `payroll-cancel` (`Annulla`, chiude il dialogo senza inviare nulla).

**Coerenza**: `kpi-attivi` = contatore di `/dipendenti` con i filtri di default = totale di `/reparti` = numero nel dialogo delle paghe.

## 6. Elenco dipendenti — `/dipendenti`

Filtri (modulo GET, applicati con `filter-submit` `Applica`; `filter-reset` `Azzera filtri` porta a `/dipendenti`):

| testid | Parametro | Opzioni: etichetta (`valore`), default in grassetto |
|---|---|---|
| `filter-q` | `q` | testo libero |
| `filter-reparto` | `reparto` | **Tutti i reparti** (``), Amministrazione (`AMM`), Risorse Umane (`HR`), Produzione (`PRD`), Logistica (`LOG`), Vendite (`VEN`), Sistemi informativi (`IT`) |
| `filter-stato` | `stato` | **Attivi** (`attivi`), Cessati (`cessati`), Tutti (`tutti`) |
| `filter-contratto` | `contratto` | **Tutti** (``), Tempo indeterminato (`IND`), Tempo determinato (`DET`), Apprendistato (`APP`) |
| `filter-ordina` | `ordina` | **Cognome A-Z** (`cognome-asc`), Cognome Z-A (`cognome-desc`), Assunti più di recente (`assunzione-desc`), Assunti meno di recente (`assunzione-asc`) |
| paginazione | `pagina` | numero di pagina, default 1 |

- **Ricerca**: un dipendente corrisponde se il testo normalizzato (G8) di `q` è contenuto in quello di `nome cognome`, di `cognome nome` o della matricola. Es. `rossi` → Giulia Rossi e Luca Rossi (2 attivi; 3 con stato Tutti, anche Alessandro Rossi); `rossi luca` e `luca rossi` → Luca Rossi; `niccolo` → Niccolò Fabbri; `deluca` → Andrea De Luca; `ria` → Emanuele Mariani e Ilaria Rinaldi; `vld-0012` → Matteo Gallo.
- Contatore `results-count`: `33 dipendenti` con i filtri di default; `1 dipendente` per uno; `0 dipendenti` senza risultati, insieme a `results-empty` `Nessun dipendente trovato.`.
- Tabella: righe `employee-row-<matricola>`; link `employee-link-<matricola>` (`Cognome Nome`) alla scheda; colonne Matricola, Reparto, Mansione, Contratto, Stato (`employee-status-<matricola>`: `Attivo`, `Cessato`, `Cessazione prevista`), RAL (`employee-ral-<matricola>`, solo HR).
- **Ordinamento**: la chiave scelta (cognome normalizzato, oppure data di assunzione) va nel verso scelto; a parità valgono sempre, in ordine crescente, cognome, nome e matricola. Es. Niccolò Fabbri e Silvia Serra, entrambi assunti il 01/10/2018, compaiono in quest'ordine in entrambi i versi dell'ordinamento per assunzione. Con l'ordinamento per cognome `Dalla Valle` precede `D'Angelo`, che precede `De Luca`.
- **10 righe per pagina.** Paginazione `pagination` con `page-prev` (`Precedente`), `page-link-<n>`, `page-next` (`Successiva`) e `page-info` (`Pagina 2 di 4`). La pagina corrente ha `aria-current="page"`; `Precedente` è disabilitato in prima pagina e `Successiva` in ultima. Cambiare pagina conserva filtri e ordinamento; applicare un filtro riporta a pagina 1; una `pagina` oltre l'ultima mostra l'ultima, una non numerica o minore di 1 mostra la prima.
- Con i filtri di default le pagine sono 4: pagina 1 da Barbieri Riccardo a De Luca Andrea, pagina 2 da Esposito Marco a Lombardo Nicola, pagina 3 da Mariani Emanuele a Rossi Luca, pagina 4 da Santoro Valentina a Vitale Anna (3 righe).
- Altri esempi: `reparto=PRD` → 12; `stato=cessati` → 3 (Giorgio Fontana VLD-0021, Daniele Longo VLD-0030, Alessandro Rossi VLD-0009, in quest'ordine); `contratto=DET` → 3; `contratto=APP` → 2.
- Il ruolo HR ha il pulsante `new-employee` (`Nuovo dipendente`).

## 7. Scheda dipendente — `/dipendenti/<matricola>`

- Intestazione: `employee-name` (`Nome Cognome`), `employee-matricola`, `employee-status`.
- Anagrafica: `employee-cf`, `employee-birthdate`, `employee-email`, `employee-phone`.
- Contratto: `employee-reparto` (link a `/dipendenti?reparto=<codice>`), `employee-mansione`, `employee-manager` (link alla scheda del responsabile; `—` per il Direttore generale), `employee-contract` (`Tempo indeterminato` / `Tempo determinato fino al GG/MM/AAAA` / `Apprendistato`), `employee-hours` (`Tempo pieno` o `Part-time N%`, es. `Part-time 80%`), `employee-ral` (solo HR, RAL a tempo pieno attuale, es. `31.000,00 €`), `employee-hire-date`, `employee-end-date` (data di cessazione, effettiva o prevista, altrimenti `—`).
- Ferie 2026: `leave-entitled`, `leave-used`, `leave-pending`, `leave-remaining`, `leave-available`: stesse regole (F2-F3) e stessi valori di `/ferie` per quella persona. Es. Matteo Gallo (VLD-0012): 26, 10, 8, 16, 8.
- Diretti riporti attivi: `reports-list`, voci `report-<matricola>` ordinate per cognome.
- HR: `edit-employee` (`Modifica`). Per un dipendente **cessato**, HR ha anche `delete-employee` (`Elimina definitivamente`), che apre `delete-dialog` con il testo `delete-dialog-text` (`Eliminare definitivamente Nome Cognome (VLD-xxxx)? L'operazione non si può annullare.`), `delete-confirm` (`Conferma`, invia `POST /api/dipendenti/elimina`) e `delete-cancel` (`Annulla`).

## 8. Nuovo dipendente — `/dipendenti/nuovo` (solo HR)

Campi (testo, salvo dove indicato; le date si scrivono `GG/MM/AAAA`):

| testid | Etichetta | Regole |
|---|---|---|
| `field-nome` | Nome | obbligatorio |
| `field-cognome` | Cognome | obbligatorio |
| `field-codice-fiscale` | Codice fiscale | obbligatorio; 16 caratteri nel formato 6 lettere, 2 cifre, 1 lettera, 2 cifre, 1 lettera, 3 cifre, 1 lettera, letto in maiuscolo (il carattere di controllo non è verificato); unico fra **tutti** i dipendenti, cessati compresi |
| `field-data-nascita` | Data di nascita | obbligatoria |
| `field-email` | Email aziendale | obbligatoria; formato email; deve finire con `@valdora.example`; unica fra **tutti** i dipendenti, cessati compresi, senza distinguere maiuscole; salvata in minuscolo |
| `field-telefono` | Telefono | facoltativo; `+39` seguito da 9 o 10 cifre, spazi ammessi |
| `field-reparto` | Reparto (select) | obbligatorio; opzioni `-- Scegli --` (``) e i reparti con valore il codice (`AMM`, `HR`, `PRD`, `LOG`, `VEN`, `IT`). Scegliendo un reparto, `field-responsabile` si preimposta subito sul responsabile di quel reparto (per Amministrazione il Direttore generale); solo nel nuovo dipendente, in modifica il responsabile non cambia da solo |
| `field-mansione` | Mansione | obbligatoria |
| `field-responsabile` | Responsabile (select) | obbligatorio (salvo per il Direttore generale in modifica); elenca solo i dipendenti **attivi** come `Cognome Nome (VLD-xxxx)`, valore la matricola, ordinati per cognome |
| `field-contratto` | Contratto (select) | obbligatorio: `-- Scegli --` (``), Tempo indeterminato (`IND`), Tempo determinato (`DET`), Apprendistato (`APP`) |
| `field-data-fine` | Fine contratto | visibile solo con Tempo determinato, e allora obbligatoria |
| `field-part-time` | Orario (select) | Tempo pieno (`100`, default), Part-time 90% (`90`) … Part-time 50% (`50`) a passi di 10 |
| `field-ral` | RAL (€) | obbligatoria; intero da 18.000 a 120.000; accetta `31000` e `31.000`; è la RAL a tempo pieno |
| `field-data-assunzione` | Data di assunzione | obbligatoria; fra il 01/01/1990 e la data di sistema (18/11/2026) |

Pulsanti: `form-submit` (`Salva`), `form-cancel` (`Annulla`, torna all'elenco).

Messaggi di errore di campo (testo esatto; se valgono più regole per lo stesso campo compare la prima della tabella):

| Caso | Messaggio |
|---|---|
| Campo obbligatorio vuoto | `Campo obbligatorio.` |
| Data non leggibile o inesistente | `Data non valida: usa GG/MM/AAAA.` |
| Codice fiscale di formato errato | `Codice fiscale non valido: 16 caratteri, es. RSSMRA80A01H501U.` |
| Codice fiscale già presente | `Codice fiscale già presente (VLD-0009).` (matricola di chi lo ha) |
| Email di formato errato | `Email non valida.` |
| Email di altro dominio | `L'email aziendale deve terminare con @valdora.example.` |
| Email già presente | `Email già assegnata a VLD-0010.` |
| Telefono errato | `Telefono non valido: usa +39 seguito da 9 o 10 cifre.` |
| Meno di 16 anni compiuti alla data di assunzione | `Il dipendente deve avere almeno 16 anni alla data di assunzione.` (su `field-data-nascita`) |
| Apprendistato con 30 anni compiuti alla data di assunzione | `L'apprendistato è riservato a chi ha meno di 30 anni all'assunzione.` (su `field-contratto`) |
| Assunzione fuori intervallo | `La data di assunzione deve essere fra il 01/01/1990 e il 18/11/2026.` |
| Fine contratto non successiva all'assunzione | `La data di fine deve essere successiva all'assunzione.` |
| Tempo determinato oltre 24 mesi | `Un contratto a tempo determinato dura al massimo 24 mesi.` La fine massima è lo stesso giorno del mese 24 mesi dopo l'assunzione, incluso (assunzione 01/04/2026 → fine fino al 01/04/2028; se quel giorno non esiste, l'ultimo del mese). |
| RAL non intera o fuori intervallo | `La RAL deve essere un numero intero fra 18.000 e 120.000.` |

Esito positivo: matricola successiva alla più alta esistente (la prima creata è **VLD-0037**), redirect alla scheda, `flash-message` `Dipendente VLD-0037 creato.`, stato Attivo, ferie spettanti come in F2, nessuna busta paga (novembre non è elaborato). Il nuovo dipendente entra subito in elenco, nei conteggi di reparto, nell'organigramma sotto il suo responsabile, nel `kpi-attivi`, nel dialogo delle paghe e nel `kpi-costo-mensile`.

## 9. Modifica e cessazione — `/dipendenti/<matricola>/modifica` (solo HR)

- Stessi campi del nuovo dipendente, precompilati; codice fiscale e data di assunzione in sola lettura. Errori in più su `field-responsabile`: il dipendente stesso → `Un dipendente non può essere responsabile di sé stesso.`; un dipendente che già dipende, direttamente o no, da quello modificato → `Il responsabile scelto dipende già da questo dipendente.`. Il Direttore generale (Marco Esposito) non ha responsabile e il campo per lui è facoltativo.
- Salvataggio → scheda con `Modifiche salvate.`. Un cambio di reparto sposta il dipendente fra i conteggi; un cambio di responsabile lo sposta nell'organigramma e sposta le sue richieste In attesa nelle approvazioni del nuovo responsabile. Le buste paga già elaborate non cambiano mai (B1).
- Sezione **Cessazione**: `termination-date`, `termination-submit` (`Registra cessazione`).
  - La data deve essere fra la data di assunzione e il 16/02/2027 (data di sistema + 90 giorni): `La data di cessazione deve essere fra la data di assunzione e il 16/02/2027.` (`termination-date-error`).
  - Chi ha diretti riporti attivi non si cessa: `Assegna prima un nuovo responsabile ai suoi 11 diretti riporti.` (con il numero esatto; per uno solo: `Assegna prima un nuovo responsabile al suo diretto riporto.`), su `termination-date-error`.
  - Data fino al 18/11/2026: stato **Cessato** subito. Data successiva: resta **Attivo** con stato `Cessazione prevista` e `employee-end-date` valorizzata; conta fra gli attivi fino a quella data.
  - Un dipendente che diventa Cessato esce da conteggi degli attivi, reparti, organigramma, costo mensile, dialogo delle paghe ed elenco dei responsabili selezionabili; le sue richieste di ferie **In attesa** diventano **Annullate** (e spariscono dalle approvazioni del responsabile). Flash `Cessazione registrata.`.
- Per un dipendente già cessato la pagina mostra solo `employee-ceased-note` (`Dipendente cessato il GG/MM/AAAA: i dati non sono modificabili.`).

## 10. Reparti — `/reparti` (HR, manager)

Tabella nell'ordine fisso Amministrazione, Risorse Umane, Produzione, Logistica, Vendite, Sistemi informativi; righe `department-row-<codice>` con nome (link `department-link-<codice>` a `/dipendenti?reparto=<codice>`), responsabile (`department-manager-<codice>`), dipendenti attivi (`department-count-<codice>`). Riga `department-total` con la somma.

Valori iniziali: Amministrazione 5 (Marco Esposito), Risorse Umane 2 (Laura Bianchi), Produzione 12 (Paolo Neri), Logistica 6 (Valentina Santoro), Vendite 5 (Roberta Martini), Sistemi informativi 3 (Nicola Lombardo); totale 33. Ogni conteggio è uguale al contatore di `/dipendenti?reparto=<codice>` con stato Attivi. Il responsabile conta nel proprio reparto.

## 11. Organigramma — `/organigramma`

Albero a liste annidate a partire da Marco Esposito (Direttore generale). Nodo `org-node-<matricola>` (contiene anche i nodi dei suoi riporti) con `org-name-<matricola>` (`Nome Cognome — Mansione`) e `org-reports-<matricola>` con il numero di diretti riporti attivi fra parentesi, anche `(0)`. I figli di un nodo sono ordinati per cognome. Ogni dipendente attivo compare **una sola volta**, sotto il proprio responsabile; i cessati non compaiono. Diretti riporti: Marco Esposito 9 (i 4 di Amministrazione e i 5 responsabili degli altri reparti), Paolo Neri 11, Valentina Santoro 5, Roberta Martini 4, Nicola Lombardo 2, Laura Bianchi 1.

## 12. Ferie — `/ferie`

Riepilogo 2026 dell'utente: `leave-entitled` (spettanti), `leave-used` (usati), `leave-pending` (in attesa), `leave-remaining` (residui), `leave-available` (disponibili).

| # | Regola |
|---|---|
| F1 | Giorni di una richiesta = giorni **lavorativi** del periodo: lunedì-venerdì, escluse le festività 2026 (01/01, 06/01, 06/04, 25/04, 01/05, 02/06, 15/08, 01/11, 08/12, 25/12, 26/12). Es. 07/12-09/12/2026 = 2 giorni; 21/12-31/12/2026 = 8 giorni; 24/12-28/12/2026 = 2 giorni. |
| F2 | Spettanti 2026: 26 giorni; chi è assunto nel 2026 ne ha 26 × mesi / 12, arrotondato per difetto, contando i mesi dal mese di assunzione incluso a dicembre (Riccardo Barbieri, assunto 02/03/2026: 21; Lorenzo Galli, 01/04/2026: 19; Gaia D'Angelo, 01/09/2026: 8; un assunto oggi, novembre: 4). |
| F3 | Usati = somma dei giorni delle richieste **Approvate** del 2026 (passate, in corso o future). Residui = spettanti − usati. In attesa = somma dei giorni delle richieste **In attesa**. Disponibili = residui − in attesa. Rifiutate e annullate non contano. |
| F4 | Valori iniziali di Sara Conti: spettanti 26, usati 11, in attesa 2, residui 15, disponibili 13. |

Modulo **Nuova richiesta**: `leave-start`, `leave-end` (`GG/MM/AAAA`), `leave-reason` (facoltativo, al massimo 200 caratteri), `leave-submit` (`Invia richiesta`). Quando entrambe le date sono valide e la fine non precede l'inizio, `leave-days-preview` mostra subito `Giorni lavorativi: N` e si aggiorna a ogni modifica delle date, prima dell'invio.

Errori di campo: data vuota → `Campo obbligatorio.`; data non valida → `Data non valida: usa GG/MM/AAAA.` (`leave-start-error` / `leave-end-error`); fine prima dell'inizio → `La data di fine non può precedere l'inizio.` (`leave-end-error`); motivo oltre 200 caratteri → `Al massimo 200 caratteri.` (`leave-reason-error`).

Solo se non ci sono errori di campo si valuta l'errore generale `leave-error`, che mostra **solo il primo** caso vero in quest'ordine:

1. Inizio o fine fuori dal 19/11/2026-31/12/2026 → `Le ferie si chiedono dal 19/11/2026 al 31/12/2026.`
2. Nessun giorno lavorativo → `Il periodo non contiene giorni lavorativi.`
3. Sovrapposta a una propria richiesta In attesa o Approvata → `Il periodo si sovrappone alla richiesta F-1004.` (se più d'una, quella che inizia per prima)
4. Più giorni dei disponibili → `Giorni richiesti (N) oltre i disponibili (M).`

Es. Sara Conti con 01/12/2026-31/12/2026 (21 giorni, si sovrappone a F-1004) riceve il messaggio di sovrapposizione.

Esito positivo: nuova richiesta **In attesa** con id successivo al più alto esistente (la prima è **F-2031**), `flash-message` `Richiesta F-2031 inviata.`, in attesa e disponibili aggiornati, e il contatore `Da approvare` del responsabile cresce di uno.

Elenco `Le mie richieste` (`leave-list`) per data di inizio decrescente: righe `leave-row-<id>` con periodo `leave-period-<id>` (`07/12/2026 - 09/12/2026`), giorni `leave-days-<id>` (solo il numero), stato `leave-status-<id>` (`In attesa`, `Approvata`, `Rifiutata`, `Annullata`) e, se rifiutata, `leave-rejection-<id>` con il motivo. Sara Conti all'inizio: F-1004 (In attesa), F-1009 (Approvata), F-1010 (Approvata). Una richiesta propria In attesa ha `leave-cancel-<id>` (`Ritira`): diventa Annullata, con `Richiesta F-1004 ritirata.`, e il riepilogo si aggiorna.

## 13. Approvazioni — `/ferie/approvazioni`

Solo richieste **In attesa** dei **diretti riporti attuali** dell'utente, dalla più vecchia per data di invio (`approval-sent-<id>`, nel seed F-1004 02/11, F-1005 05/11, F-1006 09/11, F-1007 10/11, F-1008 12/11/2026), a parità di data per id. Righe `approval-row-<id>`: richiedente `approval-requester-<id>` (`Nome Cognome`), periodo `approval-period-<id>` (`07/12/2026 - 09/12/2026`), giorni `approval-days-<id>` (solo il numero), `approval-available-<id>` (disponibili del richiedente come in F3, cioè già al netto di tutte le sue richieste In attesa, compresa questa), pulsanti `approve-<id>` (`Approva`) e `reject-<id>` (`Rifiuta`).

- Iniziali: Paolo Neri vede F-1004 (Sara Conti, 07/12/2026 - 09/12/2026, 2 giorni, disponibili 13), F-1005 (Matteo Gallo, 21/12/2026 - 31/12/2026, 8 giorni, disponibili 8), F-1006 (Elena Marino, 14/12/2026 - 18/12/2026, 5 giorni, disponibili 11); Laura Bianchi vede F-1007 (Niccolò Fabbri, 23/12/2026 - 24/12/2026, 2 giorni, disponibili 14).
- `Rifiuta` mostra nella riga `reject-reason-<id>` e `reject-confirm-<id>` (`Conferma rifiuto`); il motivo deve avere almeno 10 caratteri dopo aver tolto gli spazi iniziali e finali: `Indica un motivo di almeno 10 caratteri.` (`reject-reason-<id>-error`).
- Approvare o rifiutare toglie la riga, mostra `Richiesta F-1004 approvata.` / `Richiesta F-1004 rifiutata.` e riduce di uno `Da approvare (n)`. Un'approvazione sposta i giorni da In attesa a Usati del richiedente (residui calano, disponibili restano uguali); un rifiuto toglie i giorni da In attesa (disponibili crescono) e il motivo compare al richiedente.
- Nessuna richiesta: `approvals-empty` `Nessuna richiesta da approvare.`.

## 14. Presenze — `/presenze`

Settimana corrente dell'utente, da lunedì 16 a venerdì 20 novembre 2026: righe `timesheet-day-<data ISO>`, campo ore `timesheet-hours-<data ISO>`.

| # | Regola |
|---|---|
| P1 | Si compilano i giorni fino alla data di sistema (16, 17, 18); 19 e 20 sono disabilitati. |
| P2 | Ore da 0 a 12 a mezz'ore (`7,5` o `7.5`); un campo vuoto si salva e si mostra come `0`. Altrimenti `Inserisci da 0 a 12 ore, a mezz'ore (es. 7,5).` (`timesheet-hours-<data>-error`). |
| P3 | Un giorno con ferie approvate, anche futuro, mostra `Ferie` al posto del campo, non è modificabile e vale le ore giornaliere previste (8 × percentuale di orario / 100, es. `6,4` all'80%). |
| P4 | `timesheet-expected` = 40 × percentuale di orario / 100 (Sara Conti: `32`); `timesheet-total` = ore registrate + ore dei giorni di ferie della settimana; `timesheet-overtime` = totale − previste se positivo, altrimenti `0`. Totale e straordinario si arrotondano al decimo (es. Sara Conti con ferie approvate il 19 e il 20: `26,3`). I valori mostrati sono sempre calcolati sui dati salvati: cambiano dopo `timesheet-save` (`Salva presenze`, flash `Presenze salvate.`) o dopo un'approvazione, non mentre si digita. |
| P5 | Iniziali: Sara Conti 6,5 (lun) e 7 (mar), totale 13,5 su 32; Paolo Neri 9 e 9,5, totale 18,5 su 40; Laura Bianchi 8 e 8, totale 16 su 40. |

## 15. Buste paga — `/buste-paga`

Selettori (modulo GET, `payslip-show` `Mostra`): `payslip-month` (parametro `mese=AAAA-MM`, mesi del 2026 da gennaio a ottobre) e, solo per HR, `payslip-employee` (parametro `matricola`, tutti i dipendenti ordinati per cognome, cessati compresi). Default: l'utente stesso e, per il dipendente scelto, il mese della sua busta più recente.

| # | Regola |
|---|---|
| B1 | Mesi elaborati: da gennaio a ottobre 2026. Ognuno ha le buste dal mese di assunzione al mese di cessazione inclusi, entrambi interi. Le buste elaborate non cambiano più: modifiche di RAL, orario o cessazione successive non le toccano. |
| B2 | Lordo mensile = RAL a tempo pieno in vigore il primo giorno del mese × percentuale di orario / 100 / 13, arrotondato al centesimo. Contributi = 9,19% del lordo, arrotondato. Imponibile = lordo − contributi. IRPEF = 23% della parte di imponibile fino a 2.333,33 € più 35% della parte oltre, sommati e arrotondati **una volta sola**. Netto = imponibile − IRPEF. Arrotondamento al centesimo, metà per eccesso. |
| B3 | Valori mostrati: `payslip-ral` (RAL a tempo pieno in vigore il primo del mese), `payslip-hours` (`Tempo pieno` / `Part-time N%`), `payslip-gross`, `payslip-contributions`, `payslip-taxable`, `payslip-tax`, `payslip-net`. |
| B4 | Sara Conti: RAL 29.000 fino a giugno 2026 e 31.000 da luglio. Ottobre 2026: RAL 31.000,00 €, lordo 1.907,69 €, contributi 175,32 €, imponibile 1.732,37 €, IRPEF 398,45 €, netto 1.333,92 €. Marzo 2026: RAL 29.000,00 €, lordo 1.784,62 €, contributi 164,01 €, imponibile 1.620,61 €, IRPEF 372,74 €, netto 1.247,87 €. |
| B5 | Paolo Neri, ottobre 2026: lordo 4.307,69 €, contributi 395,88 €, imponibile 3.911,81 €, IRPEF 1.089,13 €, netto 2.822,68 €. Marco Esposito, ottobre 2026: lordo 7.538,46 €, contributi 692,78 €, imponibile 6.845,68 €, IRPEF 2.115,99 €, netto 4.729,69 €. |
| B6 | Un dipendente senza buste nel 2026 mostra `payslip-empty` `Nessuna busta paga elaborata nel 2026.` qualunque sia il mese (Giorgio Fontana, cessato il 31/12/2025, e ogni nuovo assunto). Altrimenti un mese senza busta per quella persona (prima dell'assunzione, dopo la cessazione, o non elaborato) mostra `payslip-empty` `Busta paga non disponibile per il mese scelto.`. Daniele Longo, cessato il 30/09/2026, ha buste da gennaio a settembre. |
| B7 | Un dipendente o un manager che indica una `matricola` diversa dalla propria riceve 403. |

## 16. Profilo — `/profilo`

Dati propri in sola lettura (nome, matricola, codice fiscale, email, reparto, responsabile) e modificabili: `profile-phone`, `profile-address`, `profile-emergency-name`, `profile-emergency-phone`, `profile-save` (`Salva`). Telefoni come in §8; il contatto di emergenza va indicato per intero o per niente: `Indica nome e telefono del contatto di emergenza, oppure nessuno dei due.` (`profile-emergency-error`). Esito: `Profilo aggiornato.`; i valori restano dopo il ricaricamento e il telefono nuovo compare in `employee-phone` della scheda vista da HR nella stessa sessione.

## 17. API (Netlify Functions)

Tutte sotto `/api/`, JSON, con il cookie di sessione. Le pagine HTML le chiamano con `fetch` per ogni modifica, quindi ogni invio è una richiesta HTTP che cambia stato (il write lock dello Scout può bloccarla).

| Metodo e path | Effetto |
|---|---|
| `POST /api/accedi`, `POST /api/esci` | accesso e uscita |
| `POST /api/dipendenti` | crea un dipendente |
| `POST /api/dipendenti/aggiorna` | modifica |
| `POST /api/dipendenti/cessa` | registra una cessazione |
| `POST /api/dipendenti/elimina` | **vietata ai test** |
| `POST /api/ferie`, `POST /api/ferie/ritira` | nuova richiesta, ritiro |
| `POST /api/ferie/approva`, `POST /api/ferie/rifiuta` | decisione del responsabile |
| `POST /api/presenze` | salva la settimana |
| `POST /api/profilo` | aggiorna il profilo |
| `POST /api/paghe/elabora` | **vietata ai test** |

## 18. Note di implementazione (determinismo su Netlify)

- **Stato**: Netlify Blobs (`@netlify/blobs` 11, Node 22) con lettura `consistency: 'strong'`, chiave = id della sessione, e lo store legato al deploy (`getDeployStore`), così due release non condividono mai i dati. Copia dei dati iniziali solo alla prima scrittura (prima si legge il seed). Scritture condizionate sull'etag (`onlyIfNew` / `onlyIfMatch`): se un'altra richiesta della stessa sessione ha scritto nel frattempo, il server rilegge e riapplica (fino a 5 volte), così due invii ravvicinati non si perdono. La sandbox locale di `netlify dev` non restituisce etag: lì si scrive senza condizione. In più, nel browser un solo invio alla volta: mentre è in corso, ogni controllo che modifica dati resta disabilitato. Le sessioni abbandonate non scadono: restano nello store del deploy finché il deploy esiste.
- **Una release per sottodominio** (branch deploy `release-1-3--<sito>.netlify.app`): cookie e dati non passano da una release all'altra.
- **Errori di validazione** come risposta 200 con `ok: false`, mai 4xx: un 4xx lascerebbe un errore nella console del browser anche sulla release pulita.
- **Cache**: ogni risposta HTML e API ha `Cache-Control: private, no-store`. Le pagine sono rese da una funzione, compresi 403 e 404 (con intestazione, sessione e piede), non dal 404 statico di Netlify.
- **Formati**: un formattatore proprio per gli importi (`Intl.NumberFormat('it-IT')` non mette il punto a quattro cifre e usa uno spazio non separabile); le date si confrontano come stringhe `AAAA-MM-GG` costruite dai componenti locali, mai con `toISOString()`, che in Europe/Rome sposta il giorno.
