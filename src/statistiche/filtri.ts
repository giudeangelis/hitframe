/** Filtri delle statistiche: periodo (anno, semestre, trimestre) e arma usata. */
import type { Arma } from '../db/types'
import type { RisultatoGara } from '../risultati/motore'

export interface OpzionePeriodo { value: string; label: string; gruppo: string }

/** Le opzioni di periodo, costruite sugli anni in cui ci sono gare. */
export function opzioniPeriodo(date: string[]): OpzionePeriodo[] {
  const anni = [...new Set(date.map((d) => d.slice(0, 4)))].sort().reverse()
  const out: OpzionePeriodo[] = [
    { value: 'tutto', label: 'Tutte le gare', gruppo: '' },
    { value: 'u12', label: 'Ultimi 12 mesi', gruppo: '' },
  ]
  for (const a of anni) out.push({ value: `a:${a}`, label: `Anno ${a}`, gruppo: 'Anno' })
  for (const a of anni) for (const s of [2, 1]) if (date.some((d) => d.startsWith(a) && Math.ceil(+d.slice(5, 7) / 6) === s)) out.push({ value: `s:${a}-${s}`, label: `${s}° semestre ${a}`, gruppo: 'Semestre' })
  for (const a of anni) for (const t of [4, 3, 2, 1]) if (date.some((d) => d.startsWith(a) && Math.ceil(+d.slice(5, 7) / 3) === t)) out.push({ value: `t:${a}-${t}`, label: `${t}° trimestre ${a}`, gruppo: 'Trimestre' })
  return out
}

export function nelPeriodo(data: string, periodo: string): boolean {
  if (periodo === 'tutto') return true
  if (periodo === 'u12') return data >= new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const [tipo, v] = periodo.split(':')
  const anno = v.slice(0, 4)
  if (!data.startsWith(anno)) return false
  const mese = +data.slice(5, 7)
  if (tipo === 'a') return true
  if (tipo === 's') return Math.ceil(mese / 6) === +v.slice(5)
  if (tipo === 't') return Math.ceil(mese / 3) === +v.slice(5)
  return true
}

/** L'arma di una gara: quella indicata a mano, altrimenti l'ultima arma con "dal" non successivo alla gara. */
export function armaDiGara(r: Pick<RisultatoGara, 'data' | 'armaId'>, armi: Arma[]): Arma | null {
  if (r.armaId) return armi.find((a) => a.id === r.armaId) ?? null
  const valide = armi.filter((a) => a.dal && a.dal <= r.data).sort((a, b) => b.dal.localeCompare(a.dal))
  return valide[0] ?? null
}
