/**
 * Collegamento tra un'analisi (PDF della gara) e la gara nel calendario.
 * Sicuro = la data del PDF coincide con una sola gara in calendario; altrimenti si propone e si chiede.
 */
import { db } from '../db/db'
import type { AnalisiGara, Evento } from '../db/types'
import { leggiDateGara } from './date'

const VUOTE = new Set(['gara', 'prova', 'del', 'della', 'delle', 'dei', 'di', 'da', 'tiro', 'poligono', 'ipsc', 'fitds',
  'level', 'livello', 'campionato', 'match', 'the', 'and', 'tsn', 'asd', 'ssd', 'handgun', 'pistola', 'pdf', 'briefing'])

function parole(t: string): Set<string> {
  return new Set(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/)
    .filter((w) => (w.length >= 3 || /^\d+$/.test(w)) && !VUOTE.has(w)))
}

function infoDi(a: AnalisiGara) {
  return a.lettura.sezioni[a.sezione]?.info ?? a.lettura.sezioni[0]?.info
}

/** Quanto un'analisi somiglia a una gara: data (0..1, -1 se diversa) e nome (0..1). */
export function somiglianza(a: AnalisiGara, e: Evento): { data: number; nome: number } {
  const info = infoDi(a)
  const d = info ? leggiDateGara(info.date) : null
  let data = 0
  if (d) {
    const fine = e.dataFine || e.data
    if (e.data <= d.fine && fine >= d.inizio) data = 1
    else data = Math.abs(Date.parse(e.data) - Date.parse(d.inizio)) <= 86_400_000 ? 0.5 : -1
  }
  const pa = parole(`${info?.nome ?? ''} ${info?.campo ?? ''} ${a.nomeFile.replace(/\.pdf$/i, '')}`)
  const pe = parole(`${e.titolo} ${e.luogo}`)
  const comuni = [...pa].filter((w) => pe.has(w)).length
  const nome = pa.size && pe.size ? comuni / Math.min(pa.size, pe.size) : 0
  return { data, nome }
}

export interface Proposta { evento: Evento; sicuro: boolean }

/** La gara in calendario più probabile per un'analisi non ancora collegata. */
export async function propostaGara(a: AnalisiGara): Promise<Proposta | null> {
  const gare = (await db.eventi.where('tipo').equals('gara').toArray())
  const collegate = new Set((await db.analisi.toArray()).filter((x) => x.id !== a.id && x.eventoId).map((x) => x.eventoId))
  const rifiutate = new Set(a.eventiRifiutati ?? [])
  const voti = gare
    .filter((e) => e.id != null && !collegate.has(e.id) && !rifiutate.has(e.id))
    .map((e) => ({ e, s: somiglianza(a, e) }))
    .filter(({ s }) => s.data > 0 || (s.data === 0 && s.nome >= 0.5))
    .sort((x, y) => (y.s.data * 2 + y.s.nome) - (x.s.data * 2 + x.s.nome))
  if (!voti.length) return null
  const migliore = voti[0]
  const stessaData = voti.filter((v) => v.s.data === 1).length
  const sicuro = migliore.s.data === 1 && (stessaData === 1 || migliore.s.nome >= 0.5)
  return { evento: migliore.e, sicuro }
}

/** Collega da sola un'analisi quando la gara è certa. Restituisce l'id della gara collegata. */
export async function collegaSeSicuro(a: AnalisiGara): Promise<number | null> {
  if (a.id == null || a.eventoId) return a.eventoId ?? null
  const p = await propostaGara(a)
  if (!p?.sicuro || p.evento.id == null) return null
  await db.analisi.update(a.id, { eventoId: p.evento.id })
  return p.evento.id
}

/** Per la Home: trova (e collega) l'analisi di una gara tra quelle non ancora collegate. */
export async function collegaAnalisiPerGara(eventoId: number): Promise<void> {
  const libere = (await db.analisi.toArray()).filter((a) => !a.eventoId && !(a.eventiRifiutati ?? []).includes(eventoId))
  for (const a of libere) {
    const p = await propostaGara(a)
    if (p?.sicuro && p.evento.id === eventoId) {
      await db.analisi.update(a.id!, { eventoId })
      return
    }
  }
}
