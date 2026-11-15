/** Segnala "i dati sono cambiati" a chi deve sincronizzare, tranne quando è la sincronizzazione stessa a scrivere. */
let sospese = 0
const ascoltatori = new Set<() => void>()

export function segnalaModifica() {
  if (sospese > 0) return
  for (const f of ascoltatori) f()
}

export function suModifica(f: () => void) {
  ascoltatori.add(f)
  return () => { ascoltatori.delete(f) }
}

export async function sospendiSegnalazioni<T>(f: () => Promise<T>): Promise<T> {
  sospese++
  try {
    return await f()
  } finally {
    // gli hook di Dexie scattano dentro la transazione: un attimo di margine prima di riattivare
    setTimeout(() => { sospese-- }, 0)
  }
}

/** Id numerici unici tra dispositivi (millisecondi × 1000 + casuale), sotto 2^53. */
let ultimo = 0
export function nuovoId(): number {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000)
  if (id <= ultimo) id = ultimo + 1
  ultimo = id
  return id
}
