/**
 * Sincronizzazione a tre vie tra questo dispositivo e il file nel Drive dell'utente.
 *
 * Teniamo "la base": l'impronta di ogni record com'era all'ultima sincronizzazione riuscita.
 * Confrontando locale, remoto e base capiamo chi ha cambiato cosa (anche le cancellazioni)
 * e uniamo le modifiche record per record. Se lo stesso record è cambiato da entrambe le parti
 * vince quello di questo dispositivo; una cancellazione non vince mai su una modifica.
 */
import type { Table } from 'dexie'
import { db } from '../db/db'
import { BACKUP_VERSIONE } from '../db/backup'
import { carica, scarica, trovaFile, type FileRemoto } from './drive'
import { sospendiSegnalazioni } from './segnali'

export const SYNC_FORMATO = 'hitframe-sync'
const K_BASE = 'hf-sync-base'

type Rec = Record<string, unknown>
type Dati = Record<string, Rec[]>

interface FileSync {
  formato: typeof SYNC_FORMATO
  schema: number
  aggiornato: string
  dati: Dati
}

interface Base {
  version: string
  fileId: string
  hash: Record<string, Record<string, string>>
}

/* ---------- Tabelle e impronte ---------- */

const tabelle = () => db.tables as Table<Rec, unknown>[]
const chiaveDi = (t: Table<Rec, unknown>) => t.schema.primKey.keyPath as string

/** I PDF restano sul dispositivo: non viaggiano nel cloud. */
function perCloud(tabella: string, r: Rec): Rec {
  if (tabella === 'analisi' && 'pdf' in r) return { ...r, pdf: null }
  return r
}

// cyrb53: impronta veloce a 53 bit
function impronta(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** JSON con le chiavi in ordine: la stessa cosa dà sempre la stessa impronta. */
function stabile(v: unknown): string {
  return JSON.stringify(v, (_k, x) => {
    if (x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Blob)) {
      return Object.keys(x).sort().reduce((o, k) => { (o as Rec)[k] = (x as Rec)[k]; return o }, {} as Rec)
    }
    return x
  })
}
const hashRec = (tabella: string, r: Rec) => impronta(stabile(perCloud(tabella, r)))

interface Istantanea {
  record: Record<string, Map<string, Rec>>
  hash: Record<string, Record<string, string>>
}

async function istantaneaLocale(): Promise<Istantanea> {
  const record: Istantanea['record'] = {}
  const hash: Istantanea['hash'] = {}
  for (const t of tabelle()) {
    const k = chiaveDi(t)
    const m = new Map<string, Rec>()
    const h: Record<string, string> = {}
    for (const r of await t.toArray()) {
      const id = String(r[k])
      m.set(id, r)
      h[id] = hashRec(t.name, r)
    }
    record[t.name] = m
    hash[t.name] = h
  }
  return { record, hash }
}

function istantaneaRemota(f: FileSync): Istantanea {
  const record: Istantanea['record'] = {}
  const hash: Istantanea['hash'] = {}
  for (const t of tabelle()) {
    const k = chiaveDi(t)
    const m = new Map<string, Rec>()
    const h: Record<string, string> = {}
    for (const r of f.dati[t.name] ?? []) {
      const id = String(r[k])
      m.set(id, r)
      h[id] = hashRec(t.name, r)
    }
    record[t.name] = m
    hash[t.name] = h
  }
  return { record, hash }
}

/* ---------- Base ---------- */

export function leggiBase(): Base | null {
  try { return JSON.parse(localStorage.getItem(K_BASE) || 'null') } catch { return null }
}
function salvaBase(b: Base) {
  localStorage.setItem(K_BASE, JSON.stringify(b))
}
export function dimenticaBase() {
  localStorage.removeItem(K_BASE)
}

/* ---------- File remoto ---------- */

function componiFile(ist: Istantanea): string {
  const dati: Dati = {}
  for (const [nome, m] of Object.entries(ist.record)) dati[nome] = [...m.values()].map((r) => perCloud(nome, r))
  const f: FileSync = { formato: SYNC_FORMATO, schema: BACKUP_VERSIONE, aggiornato: new Date().toISOString(), dati }
  return JSON.stringify(f)
}

async function leggiRemoto(f: FileRemoto): Promise<FileSync> {
  const parsed = JSON.parse(await scarica(f.id)) as FileSync
  if (parsed?.formato !== SYNC_FORMATO || !parsed.dati) throw new Error('Il file nel cloud non è leggibile.')
  if (parsed.schema > BACKUP_VERSIONE) throw new Error("I dati nel cloud arrivano da una versione più recente di Hitframe: aggiorna l'app.")
  return parsed
}

/* ---------- Applicazione delle modifiche in locale ---------- */

interface Modifiche { put: Record<string, Rec[]>; del: Record<string, unknown[]> }

async function applica(mod: Modifiche, locale: Istantanea) {
  const tocca = tabelle().filter((t) => (mod.put[t.name]?.length ?? 0) + (mod.del[t.name]?.length ?? 0) > 0)
  if (!tocca.length) return
  await sospendiSegnalazioni(() => db.transaction('rw', tocca, async () => {
    for (const t of tocca) {
      const k = chiaveDi(t)
      const daMettere = (mod.put[t.name] ?? []).map((r) => {
        // il PDF di un'analisi resta quello di questo dispositivo
        if (t.name === 'analisi') {
          const vecchio = locale.record[t.name].get(String(r[k]))
          return { ...r, pdf: vecchio?.pdf ?? null }
        }
        return r
      })
      if (daMettere.length) await t.bulkPut(daMettere)
      if (mod.del[t.name]?.length) await t.bulkDelete(mod.del[t.name])
    }
  }))
}

/* ---------- Operazioni ---------- */

export interface EsitoSync { ricevute: number; inviate: number; nulla: boolean }

export function contaRecord(ist: Istantanea, escludi = ['impostazioni']): number {
  return Object.entries(ist.record).filter(([n]) => !escludi.includes(n)).reduce((s, [, m]) => s + m.size, 0)
}

/** Situazione al primo collegamento di questo dispositivo. */
export async function situazioneIniziale() {
  const remoto = await trovaFile()
  const locale = await istantaneaLocale()
  let nelCloud = 0
  let aggiornato: string | null = null
  let file: FileSync | null = null
  if (remoto) {
    file = await leggiRemoto(remoto)
    nelCloud = contaRecord(istantaneaRemota(file), ['impostazioni', 'profilo'])
    aggiornato = file.aggiornato
  }
  return { remoto, file, nelCloud, aggiornato, suDispositivo: contaRecord(locale, ['impostazioni', 'profilo']) }
}

/** Il cloud diventa una copia di questo dispositivo. */
export async function usaDatiLocali(): Promise<void> {
  const locale = await istantaneaLocale()
  const f = await trovaFile()
  const r = await carica(componiFile(locale), f?.id)
  salvaBase({ version: r.version, fileId: r.id, hash: locale.hash })
}

/** Questo dispositivo diventa una copia del cloud. */
export async function usaDatiCloud(): Promise<void> {
  const f = await trovaFile()
  if (!f) return usaDatiLocali()
  const file = await leggiRemoto(f)
  const remota = istantaneaRemota(file)
  const locale = await istantaneaLocale()
  const mod: Modifiche = { put: {}, del: {} }
  for (const t of tabelle()) {
    mod.put[t.name] = [...remota.record[t.name].entries()]
      .filter(([id]) => locale.hash[t.name][id] !== remota.hash[t.name][id])
      .map(([, r]) => r)
    mod.del[t.name] = [...locale.record[t.name].entries()]
      .filter(([id]) => !remota.record[t.name].has(id))
      .map(([, r]) => r[chiaveDi(t)])
  }
  await applica(mod, locale)
  salvaBase({ version: f.version, fileId: f.id, hash: remota.hash })
}

/** Sincronizzazione normale: unisce le modifiche delle due parti. */
export async function sincronizza(): Promise<EsitoSync> {
  const base = leggiBase()
  if (!base) {
    await usaDatiLocali()
    return { ricevute: 0, inviate: 1, nulla: false }
  }
  const remoto = await trovaFile()
  const locale = await istantaneaLocale()
  if (!remoto) {
    // il file è stato cancellato (per esempio da un altro dispositivo): lo ricreiamo
    const r = await carica(componiFile(locale))
    salvaBase({ version: r.version, fileId: r.id, hash: locale.hash })
    return { ricevute: 0, inviate: 1, nulla: false }
  }

  const localeCambiato = tabelle().some((t) => !ugualiHash(locale.hash[t.name], base.hash[t.name] ?? {}))
  const remotoCambiato = remoto.version !== base.version || remoto.id !== base.fileId

  if (!localeCambiato && !remotoCambiato) return { ricevute: 0, inviate: 0, nulla: true }

  if (!remotoCambiato) {
    const r = await carica(componiFile(locale), remoto.id)
    salvaBase({ version: r.version, fileId: r.id, hash: locale.hash })
    return { ricevute: 0, inviate: 1, nulla: false }
  }

  const remota = istantaneaRemota(await leggiRemoto(remoto))
  const unito: Istantanea = { record: {}, hash: {} }
  const mod: Modifiche = { put: {}, del: {} }
  let ricevute = 0
  let daInviare = false

  for (const t of tabelle()) {
    const n = t.name
    const L = locale.hash[n], R = remota.hash[n], B = base.hash[n] ?? {}
    const ids = new Set([...Object.keys(L), ...Object.keys(R), ...Object.keys(B)])
    const rec = new Map<string, Rec>()
    const hs: Record<string, string> = {}
    mod.put[n] = []
    mod.del[n] = []
    for (const id of ids) {
      const l = L[id], r = R[id], b = B[id]
      let scelta: 'l' | 'r'
      if (l === r) scelta = 'l'
      else if (l === b) scelta = 'r' // cambiato solo nel cloud
      else if (r === b) scelta = 'l' // cambiato solo qui
      else if (!l) scelta = 'r' // cancellato qui, modificato altrove: teniamo la modifica
      else scelta = 'l' // cambiato da entrambe le parti (o cancellato altrove): vince questo dispositivo
      if (scelta === 'l') {
        if (l) { rec.set(id, locale.record[n].get(id)!); hs[id] = l }
        if (l !== r) daInviare = true
      } else {
        if (r) {
          rec.set(id, remota.record[n].get(id)!)
          hs[id] = r
          mod.put[n].push(remota.record[n].get(id)!)
        } else if (l) {
          mod.del[n].push(locale.record[n].get(id)![chiaveDi(t)])
        }
        if (r !== l) ricevute++
      }
    }
    unito.record[n] = rec
    unito.hash[n] = hs
  }

  await applica(mod, locale)
  if (daInviare) {
    const r = await carica(componiFile(unito), remoto.id)
    salvaBase({ version: r.version, fileId: r.id, hash: unito.hash })
  } else {
    salvaBase({ version: remoto.version, fileId: remoto.id, hash: unito.hash })
  }
  return { ricevute, inviate: daInviare ? 1 : 0, nulla: false }
}

function ugualiHash(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => a[k] === b[k])
}

/** Ci sono modifiche locali non ancora inviate? (stima veloce per l'indicatore) */
export async function modificheInSospeso(): Promise<boolean> {
  const base = leggiBase()
  if (!base) return true
  const locale = await istantaneaLocale()
  return tabelle().some((t) => !ugualiHash(locale.hash[t.name], base.hash[t.name] ?? {}))
}
