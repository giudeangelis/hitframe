# Hitframe

App per il tiro dinamico IPSC: allenamento, gare, diario, munizioni e analisi dei PDF di gara.
Web app installabile (PWA) per iPhone e Mac, funziona offline. I dati restano sul dispositivo.

## Versione 0.2

- **Analisi gara**: carichi il PDF di briefing FITDS e l'app legge da sola tutti gli stage (tipo, colpi, punti, bersagli, partenza, condizioni, procedura, attivazioni), mostra il disegno di ogni stage, il profilo della gara, le priorità di allenamento e una stima di tempo e hit factor con i tuoi tempi. Riconosce i PDF con più libretti (Handgun e PCC). Pulsante per aggiungere la gara al calendario con date già compilate.
- Prova del lettore da terminale: `npx tsx scripts/prova-pdf.ts gara.pdf`

## Fase 1

- **Home**: prossima gara con conto alla rovescia, statistiche del mese, prossimi 14 giorni, ultime voci di diario, allenamenti da registrare
- **Calendario**: allenamenti a fuoco, in bianco, gare (anche di più giorni) e altro; colpi pianificati e sparati; dati di gara (livello, iscrizione, scadenza)
- **Diario**: voci collegate agli eventi, umore, energia, concentrazione, sonno, tag, link video, ricerca
- **Profilo**: divisione, classe, arma e **tempi personali**, con le prime stime (Bill Drill, El Presidente, cambio posizione)
- **Impostazioni**: backup e ripristino in JSON, cancellazione dati
- Moduli delle fasi successive già presenti nel menu come "in arrivo"

## Comandi

Serve Node.js 20 o più recente.

```bash
npm install        # una volta sola
npm run dev        # sviluppo, apre http://localhost:5173
npm run build      # crea la versione finale in dist/
npm run preview    # prova la versione finale in locale
```

## Pubblicare su GitHub Pages

1. Crea un repository su GitHub (per esempio `hitframe`) e carica questa cartella.
2. Su GitHub: **Settings → Pages → Source: GitHub Actions**.
3. A ogni push sul branch `main` il workflow `.github/workflows/deploy.yml` compila e pubblica l'app.
4. L'indirizzo sarà `https://<tuo-utente>.github.io/hitframe/`.

## Installare sull'iPhone

Apri l'indirizzo con Safari → tasto Condividi → **Aggiungi alla schermata Home**.
Sul Mac: Safari → File → **Aggiungi al Dock**, oppure Chrome → icona di installazione nella barra degli indirizzi.

## Struttura

```
src/
  db/           database locale (Dexie / IndexedDB), tipi, backup
  components/   layout, moduli di inserimento, elementi grafici comuni
  pages/        una pagina per modulo
  lib/          date e utilità
  modules.ts    elenco dei moduli (pronti e in arrivo)
```

Nota: i dati di ogni dispositivo sono separati. Per spostarli usa Backup → Ripristina.
La sincronizzazione automatica arriverà con il cloud, in una fase successiva.
