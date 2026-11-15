/**
 * Sincronizzazione con Google Calendar, tutta nel browser (nessun server).
 * Usa lo stesso accesso Google della sincronizzazione (vedi auth.ts),
 * permesso limitato ai calendari creati dall'app: Hitframe crea il suo calendario
 * "Hitframe" e non vede né tocca gli altri.
 */
import { addDays, addMinutes, format } from 'date-fns'
import { db, getImp, setImp } from '../db/db'
import { TIPI_EVENTO, type Evento } from '../db/types'
import { fromKey } from '../lib/date'
import { linkMaps } from '../lib/maps'

import { AccessoRichiesto, accessToken, dimenticaToken, haScope, SCOPE_CALENDARIO, tokenValido as tokenGoogleValido } from './auth'
export { AccessoRichiesto } from './auth'

export const SCOPE = SCOPE_CALENDARIO
const API = 'https://www.googleapis.com/calendar/v3'
const TZ = 'Europe/Rome'
const K_ATTIVO = 'hf-cal-attivo'

export interface ConfigGoogle {
  clientId: string
  email: string
  calendarId: string
  attivo: boolean
}

export const configVuota: ConfigGoogle = { clientId: '', email: '', calendarId: '', attivo: false }
export const getConfig = () => getImp<ConfigGoogle>('google', configVuota)
export async function setConfig(c: ConfigGoogle) {
  try { localStorage.setItem(K_ATTIVO, c.attivo ? '1' : '0') } catch { /* ignore */ }
  await setImp('google', c)
}
/** Il calendario è attivo su questo dispositivo? (letto in modo sincrono per l'accesso Google) */
export const calendarioAttivo = () => { try { return localStorage.getItem(K_ATTIVO) === '1' } catch { return false } }

/** Accesso valido e con il permesso per il calendario. */
export const tokenValido = () => tokenGoogleValido() && haScope(SCOPE)

/* ---------- API ---------- */

class ErroreApi extends Error {
  status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}

async function api<T>(metodo: string, percorso: string, corpo?: unknown): Promise<T> {
  const t = accessToken()
  if (!t || !haScope(SCOPE)) throw new AccessoRichiesto()
  const r = await fetch(`${API}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${t}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  if (r.status === 401) {
    dimenticaToken()
    throw new AccessoRichiesto()
  }
  if (!r.ok) {
    let msg = `Errore Google ${r.status}`
    try { msg = (await r.json())?.error?.message ?? msg } catch { /* ignore */ }
    throw new ErroreApi(r.status, msg)
  }
  return (r.status === 204 ? undefined : await r.json()) as T
}

async function assicuraCalendario(cfg: ConfigGoogle): Promise<string> {
  if (cfg.calendarId) return cfg.calendarId
  const cal = await api<{ id: string }>('POST', '/calendars', {
    summary: 'Hitframe',
    description: 'Allenamenti, gare e scadenze di iscrizione da Hitframe',
    timeZone: TZ,
  })
  await setConfig({ ...cfg, calendarId: cal.id })
  // il calendario è nuovo: gli id degli eventi precedenti non valgono più
  await db.eventi.toCollection().modify((e) => {
    if (e.google) e.google = { daSincronizzare: true }
  })
  return cal.id
}

/* ---------- Conversione eventi ---------- */

// Colori di Google Calendar: 11 Pomodoro, 6 Mandarino, 9 Mirtillo, 8 Grafite
const COLORI: Record<Evento['tipo'], string> = { gara: '11', fuoco: '6', bianco: '9', altro: '8' }
const VERSIONE_COLORI = 2

/** Quando cambiano i colori, rimette in coda gli eventi già inviati per aggiornarli su Google. */
export async function aggiornaColoriSeServe() {
  const cfg = await getConfig()
  if (!cfg.attivo) return
  if ((await getImp<number>('googleColori', 1)) >= VERSIONE_COLORI) return
  await db.eventi.toCollection().modify((e) => {
    if (e.google?.eventoId && (e.tipo === 'gara' || e.tipo === 'fuoco')) e.google.daSincronizzare = true
  })
  await setImp('googleColori', VERSIONE_COLORI)
}
const fmtDT = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss")
const giornoDopo = (k: string) => format(addDays(fromKey(k), 1), 'yyyy-MM-dd')

function descrizione(e: Evento): string {
  const righe: string[] = []
  if (e.note.trim()) righe.push(e.note.trim(), '')
  const maps = linkMaps(e)
  if (maps) righe.push(`Mappa: ${maps}`)
  if (e.tipo === 'gara' && e.gara) {
    const g = e.gara
    const info = [g.livello, g.numeroStage ? `${g.numeroStage} stage` : '', g.colpiTotali ? `${g.colpiTotali} colpi` : ''].filter(Boolean).join(' · ')
    if (info) righe.push(info)
    if (g.iscrizioneUrl) righe.push(`Iscrizione: ${g.iscrizioneUrl}`)
    righe.push(g.iscritto ? 'Iscritto ✓' : 'Non ancora iscritto')
  }
  if (e.tipo === 'fuoco' && e.colpiPianificati) righe.push(`Colpi pianificati: ${e.colpiPianificati}`)
  righe.push('', 'Da Hitframe')
  return righe.join('\n')
}

function risorsaEvento(e: Evento) {
  const base = {
    summary: e.tipo === 'gara' || /allenamento|bianco|fuoco/i.test(e.titolo) ? e.titolo : `${TIPI_EVENTO[e.tipo].breve} · ${e.titolo}`,
    location: e.luogo || undefined,
    description: descrizione(e),
    colorId: COLORI[e.tipo],
  }
  if (e.tipo !== 'gara' && e.ora) {
    const inizio = new Date(`${e.data}T${e.ora}:00`)
    const fine = addMinutes(inizio, e.durataMin || 90)
    return {
      ...base,
      start: { dateTime: fmtDT(inizio), timeZone: TZ },
      end: { dateTime: fmtDT(fine), timeZone: TZ },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    }
  }
  return {
    ...base,
    start: { date: e.data },
    end: { date: giornoDopo(e.dataFine || e.data) },
    // eventi di tutto il giorno: minuti prima della mezzanotte → 900 = il giorno prima alle 9:00
    reminders: {
      useDefault: false,
      overrides: e.tipo === 'gara'
        ? [{ method: 'popup', minutes: 900 }, { method: 'popup', minutes: 3780 }]
        : [{ method: 'popup', minutes: 900 }],
    },
  }
}

function risorsaIscrizione(e: Evento, tipo: 'apertura' | 'scadenza', data: string) {
  const inizio = new Date(`${data}T09:00:00`)
  const url = e.gara?.iscrizioneUrl
  return {
    summary: tipo === 'apertura' ? `Aprono le iscrizioni · ${e.titolo}` : `Scadenza iscrizione · ${e.titolo}`,
    description: [
      tipo === 'apertura' ? 'Oggi aprono le iscrizioni.' : 'Ultimo giorno per iscriversi.',
      url ? `Iscrizione: ${url}` : '',
      `Gara: ${e.titolo} (${e.data})`,
      '',
      'Da Hitframe',
    ].filter((x, i) => x || i > 1).join('\n'),
    colorId: '5',
    start: { dateTime: fmtDT(inizio), timeZone: TZ },
    end: { dateTime: fmtDT(addMinutes(inizio, 15)), timeZone: TZ },
    reminders: {
      useDefault: false,
      overrides: tipo === 'scadenza'
        ? [{ method: 'popup', minutes: 0 }, { method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 4320 }, { method: 'email', minutes: 1440 }]
        : [{ method: 'popup', minutes: 0 }],
    },
  }
}

/** Crea o aggiorna; se l'evento è stato cancellato su Google lo ricrea. */
async function upsert(calId: string, id: string | undefined, risorsa: unknown): Promise<string> {
  const cal = encodeURIComponent(calId)
  if (id) {
    try {
      const r = await api<{ id: string; status?: string }>('PUT', `/calendars/${cal}/events/${encodeURIComponent(id)}`, { ...(risorsa as object), status: 'confirmed' })
      return r.id
    } catch (err) {
      if (!(err instanceof ErroreApi && (err.status === 404 || err.status === 410))) throw err
    }
  }
  const r = await api<{ id: string }>('POST', `/calendars/${cal}/events`, risorsa)
  return r.id
}

async function rimuovi(calId: string, id: string | undefined) {
  if (!id) return
  try {
    await api('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`)
  } catch (err) {
    if (!(err instanceof ErroreApi && (err.status === 404 || err.status === 410))) throw err
  }
}

/** Se il calendario Hitframe è stato cancellato su Google, al prossimo giro lo ricreiamo. */
async function seCalendarioSparito(err: unknown) {
  if (err instanceof ErroreApi && err.status === 404) {
    const cfg = await getConfig()
    await setConfig({ ...cfg, calendarId: '' })
  }
}

/* ---------- Operazioni pubbliche ---------- */

async function sincronizzaUno(calId: string, e: Evento) {
  const g = { ...(e.google ?? {}) }
  g.eventoId = await upsert(calId, g.eventoId, risorsaEvento(e))
  const gara = e.tipo === 'gara' ? e.gara : undefined
  const attivo = gara && !gara.iscritto
  if (attivo && gara?.aperturaIscrizione) g.aperturaId = await upsert(calId, g.aperturaId, risorsaIscrizione(e, 'apertura', gara.aperturaIscrizione))
  else { await rimuovi(calId, g.aperturaId); g.aperturaId = undefined }
  if (attivo && gara?.scadenzaIscrizione) g.scadenzaId = await upsert(calId, g.scadenzaId, risorsaIscrizione(e, 'scadenza', gara.scadenzaIscrizione))
  else { await rimuovi(calId, g.scadenzaId); g.scadenzaId = undefined }
  g.daSincronizzare = false
  g.ultimaSync = new Date().toISOString()
  await db.eventi.update(e.id!, { google: g })
}

/** Da chiamare dopo ogni salvataggio: segna l'evento e prova a inviarlo subito. */
export async function dopoSalvataggio(id: number): Promise<'ok' | 'in-coda' | 'spento'> {
  const cfg = await getConfig()
  if (!cfg.attivo) return 'spento'
  const e = await db.eventi.get(id)
  if (!e) return 'spento'
  await db.eventi.update(id, { google: { ...(e.google ?? {}), daSincronizzare: true } })
  if (!tokenValido()) return 'in-coda'
  try {
    const calId = await assicuraCalendario(cfg)
    await sincronizzaUno(calId, (await db.eventi.get(id))!)
    return 'ok'
  } catch (err) {
    console.warn(err)
    await seCalendarioSparito(err)
    return 'in-coda'
  }
}

/** Da chiamare prima di eliminare un evento in locale. */
export async function primaDiEliminare(e: Evento) {
  const cfg = await getConfig()
  const ids = [e.google?.eventoId, e.google?.aperturaId, e.google?.scadenzaId].filter(Boolean) as string[]
  if (!cfg.attivo || !cfg.calendarId || !ids.length) return
  const coda = await getImp<string[]>('googleDaEliminare', [])
  if (tokenValido()) {
    try {
      for (const id of ids) await rimuovi(cfg.calendarId, id)
      return
    } catch (err) {
      console.warn(err)
    }
  }
  await setImp('googleDaEliminare', [...coda, ...ids])
}

export async function contaInSospeso(): Promise<number> {
  const cfg = await getConfig()
  if (!cfg.attivo) return 0
  const eventi = await db.eventi.filter((e) => !e.google?.eventoId || !!e.google?.daSincronizzare).count()
  const coda = await getImp<string[]>('googleDaEliminare', [])
  return eventi + coda.length
}

/** Invia tutto ciò che manca o è cambiato. */
export async function sincronizzaTutto(): Promise<{ inviati: number; eliminati: number }> {
  const cfg = await getConfig()
  if (!cfg.attivo) return { inviati: 0, eliminati: 0 }
  const calId = await assicuraCalendario(cfg)
  const coda = await getImp<string[]>('googleDaEliminare', [])
  for (const id of coda) await rimuovi(calId, id)
  await setImp('googleDaEliminare', [])
  const daInviare = await db.eventi.filter((e) => !e.google?.eventoId || !!e.google?.daSincronizzare).toArray()
  try {
    for (const e of daInviare) await sincronizzaUno(calId, e)
  } catch (err) {
    await seCalendarioSparito(err)
    throw err
  }
  return { inviati: daInviare.length, eliminati: coda.length }
}

export async function scollega() {
  const cfg = await getConfig()
  await setConfig({ ...cfg, attivo: false })
}

/** Allinea il flag sincrono con la configurazione salvata (dopo una sincronizzazione o un aggiornamento). */
export async function allineaFlagCalendario() {
  const cfg = await getConfig()
  try { localStorage.setItem(K_ATTIVO, cfg.attivo ? '1' : '0') } catch { /* ignore */ }
}
