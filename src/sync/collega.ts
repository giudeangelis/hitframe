/** Primo collegamento di un dispositivo all'account Google, e uscita. */
import Dexie, { type EntityTable } from 'dexie'
import { cancellaTutto, creaBackup } from '../db/backup'
import { esci, getAccount, leggiProfiloGoogle, setAccount } from '../google/auth'
import { allineaFlagCalendario } from '../google/calendar'
import { scarica } from './drive'
import { dimenticaBase, situazioneIniziale, usaDatiCloud, usaDatiLocali } from './motore'
import { sincronizzaOra } from './stato'

/* ---------- Copie di sicurezza (solo su questo dispositivo) ---------- */

interface Copia { id?: number; creato: string; motivo: string; testo: string }
class CopieDB extends Dexie {
  copie!: EntityTable<Copia, 'id'>
  constructor() {
    super('hitframe-copie')
    this.version(1).stores({ copie: '++id, creato' })
  }
}
const copieDb = new CopieDB()

export async function salvaCopia(motivo: string, testo?: string) {
  const t = testo ?? JSON.stringify(await creaBackup())
  await copieDb.copie.add({ creato: new Date().toISOString(), motivo, testo: t })
  // ne teniamo al massimo 3
  const tutte = await copieDb.copie.orderBy('creato').toArray()
  for (const c of tutte.slice(0, Math.max(0, tutte.length - 3))) await copieDb.copie.delete(c.id!)
}
export const elencoCopie = () => copieDb.copie.orderBy('creato').reverse().toArray()
export function scaricaCopia(c: Copia) {
  const blob = new Blob([c.testo], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hitframe-copia-${c.creato.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ---------- Collegamento ---------- */

export type EsitoCollega =
  | { tipo: 'fatto'; messaggio: string }
  | { tipo: 'scelta'; nelCloud: number; suDispositivo: number; aggiornato: string | null }

/** Dopo il ritorno da Google: legge l'account e decide cosa fare con i dati. */
export async function completaCollegamento(): Promise<EsitoCollega> {
  const p = await leggiProfiloGoogle()
  const precedente = getAccount()
  if (precedente && precedente.email !== p.email) dimenticaBase()
  setAccount({ ...p, collegato: precedente?.collegato ?? new Date().toISOString() })
  const s = await situazioneIniziale()
  if (!s.remoto || s.nelCloud === 0) {
    // nel cloud non c'è niente di utile: teniamo i dati di questo dispositivo, senza chiedere
    await usaDatiLocali()
    return { tipo: 'fatto', messaggio: s.suDispositivo ? 'Account collegato: i tuoi dati ora sono anche nel tuo Google Drive' : 'Account collegato' }
  }
  if (s.suDispositivo === 0) {
    await usaDatiCloud()
    await allineaFlagCalendario()
    return { tipo: 'fatto', messaggio: `Bentornato: ho scaricato i tuoi dati (${s.nelCloud} elementi)` }
  }
  return { tipo: 'scelta', nelCloud: s.nelCloud, suDispositivo: s.suDispositivo, aggiornato: s.aggiornato }
}

/** Scelta al primo collegamento quando ci sono dati sia qui sia nel cloud. */
export async function scegli(da: 'cloud' | 'dispositivo') {
  if (da === 'cloud') {
    await salvaCopia('Dati del dispositivo prima del collegamento')
    await usaDatiCloud()
    await allineaFlagCalendario()
  } else {
    // salviamo anche una copia di quello che c'era nel cloud
    const s = await situazioneIniziale()
    if (s.remoto) {
      try { await salvaCopia('Dati del cloud prima della sostituzione', await scarica(s.remoto.id)) } catch { /* ignore */ }
    }
    await usaDatiLocali()
  }
}

/** Esce dall'account: prima invia le ultime modifiche, poi libera il dispositivo. I dati restano nel Drive. */
export async function esciDalDispositivo() {
  try { await sincronizzaOra() } catch { /* ignore */ }
  await salvaCopia('Dati del dispositivo all’uscita')
  dimenticaBase()
  await cancellaTutto()
  await esci()
}
