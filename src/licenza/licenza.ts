/**
 * Licenze Hitframe, senza server.
 * - Al primo accesso parte una prova di 14 giorni (la data d'inizio viaggia con la sincronizzazione).
 * - Una chiave di licenza è firmata con la chiave privata di chi distribuisce l'app (Ed25519):
 *   l'app la verifica offline con la chiave pubblica qui sotto e la accetta solo per l'email Google indicata.
 * - Senza licenza valida l'app resta consultabile in sola lettura: niente dati persi.
 */
import * as ed from '@noble/ed25519'
import { useSyncExternalStore } from 'react'

export const CHIAVE_PUBBLICA = '_LbVDOhxqrCuRYejwkSbLTekYqhyJFxAwXfOvWOsIuw'
export const GIORNI_PROVA = 14
export const CONTATTO = 'giuseppedeangelis.ipsc@gmail.com'

export type TipoLicenza = 'g14' | 'g30' | 'perpetua'
export const NOMI_LICENZA: Record<TipoLicenza, string> = { g14: '14 giorni', g30: '30 giorni', perpetua: 'Perpetua' }
export const GIORNI_LICENZA: Record<TipoLicenza, number | null> = { g14: 14, g30: 30, perpetua: null }

export interface DatiLicenza {
  e: string // email Google
  t: TipoLicenza
  i: string // emessa il (YYYY-MM-DD)
  x: string | null // scade il (YYYY-MM-DD, compreso) o null
  n?: string // nome
}

const b64u = {
  enc: (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
    return Uint8Array.from(b, (c) => c.charCodeAt(0))
  },
}
const testo = new TextEncoder()

export async function firmaLicenza(d: DatiLicenza, privata: string): Promise<string> {
  const payload = testo.encode(JSON.stringify(d))
  const sig = await ed.signAsync(payload, b64u.dec(privata))
  return `HF1-${b64u.enc(payload)}.${b64u.enc(sig)}`
}

export async function chiavePubblicaDa(privata: string) {
  return b64u.enc(await ed.getPublicKeyAsync(b64u.dec(privata)))
}

/** Legge e verifica una chiave. Restituisce i dati o un messaggio d'errore. */
export async function leggiLicenza(chiave: string): Promise<DatiLicenza | string> {
  const k = chiave.trim().replace(/\s+/g, '')
  const m = k.match(/^HF1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/)
  if (!m) return 'Il codice non ha il formato giusto: deve iniziare con HF1-.'
  try {
    const payload = b64u.dec(m[1])
    const ok = await ed.verifyAsync(b64u.dec(m[2]), payload, b64u.dec(CHIAVE_PUBBLICA))
    if (!ok) return 'Codice non valido.'
    return JSON.parse(new TextDecoder().decode(payload)) as DatiLicenza
  } catch {
    return 'Codice non valido.'
  }
}

/* ---------- Stato della licenza ---------- */

export interface StatoLicenza {
  tipo: 'licenza' | 'prova' | 'scaduta' | 'libera'
  giorniRimasti: number | null
  scade: string | null
  dati: DatiLicenza | null
  inizioProva: string | null
}

let stato: StatoLicenza = { tipo: 'libera', giorniRimasti: null, scade: null, dati: null, inizioProva: null }
const ascoltatori = new Set<() => void>()
export const statoLicenza = () => stato
export const solaLettura = () => stato.tipo === 'scaduta'
export function useLicenza() {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => { ascoltatori.delete(f) } }, statoLicenza)
}

const oggi = () => new Date().toISOString().slice(0, 10)
const giorniTra = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const aggiungiGiorni = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10)

/**
 * Calcola lo stato. `chiave`: licenza salvata; `inizioProva`: data del primo accesso; `email`: account Google.
 * La licenza vale se è firmata, è per questa email e non è scaduta; altrimenti conta la prova.
 */
export async function calcolaStato(chiave: string | null, inizioProva: string | null, email: string | null): Promise<StatoLicenza> {
  if (chiave && email) {
    const d = await leggiLicenza(chiave)
    if (typeof d !== 'string' && d.e.toLowerCase() === email.toLowerCase()) {
      if (!d.x) return { tipo: 'licenza', giorniRimasti: null, scade: null, dati: d, inizioProva }
      if (d.x >= oggi()) return { tipo: 'licenza', giorniRimasti: giorniTra(oggi(), d.x) + 1, scade: d.x, dati: d, inizioProva }
    }
  }
  if (!inizioProva) return { tipo: 'libera', giorniRimasti: null, scade: null, dati: null, inizioProva }
  const fine = aggiungiGiorni(inizioProva.slice(0, 10), GIORNI_PROVA - 1)
  if (fine >= oggi()) return { tipo: 'prova', giorniRimasti: giorniTra(oggi(), fine) + 1, scade: fine, dati: null, inizioProva }
  return { tipo: 'scaduta', giorniRimasti: 0, scade: fine, dati: null, inizioProva }
}

export function impostaStato(s: StatoLicenza) {
  stato = s
  for (const f of ascoltatori) f()
}

/** Scadenza di una nuova licenza a partire da oggi. */
export function scadenzaPer(t: TipoLicenza, da = oggi()): string | null {
  const g = GIORNI_LICENZA[t]
  return g ? aggiungiGiorni(da, g - 1) : null
}

export class ErroreSolaLettura extends Error {
  constructor() { super('Periodo di prova finito: Hitframe è in sola lettura. Inserisci una licenza in Impostazioni per continuare.') }
}
