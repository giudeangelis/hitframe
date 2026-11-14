import type { CategoriaDrill, Drill } from './drills'
import { DRILLS } from './drills'
import type { Divisione, DrillPersonale, Prova } from '../db/types'

export const idPersonale = (id: number) => `p-${id}`

export function daPersonale(p: DrillPersonale): Drill {
  const v = p.obiettivo ?? 0
  return {
    id: idPersonale(p.id!),
    nome: p.nome,
    categoria: (p.categoria as CategoriaDrill) || 'Split',
    modalita: p.modalita,
    descrizione: p.descrizione,
    distanza: p.distanza,
    bersagli: p.bersagli,
    colpi: p.colpi,
    partenza: p.partenza,
    obiettivi: { GM: v, M: v, A: v, B: v, C: v },
    focus: [],
    personale: true,
  }
}

export function tuttiDrill(personali: DrillPersonale[]): Drill[] {
  return [...DRILLS, ...personali.map(daPersonale)]
}

export function trovaDrill(id: string, personali: DrillPersonale[]): Drill | undefined {
  return tuttiDrill(personali).find((d) => d.id === id)
}

/** Divisioni con fattore di potenza major di default. */
export const majorDiDefault = (d: Divisione) => ['Open', 'Standard', 'Classic'].includes(d)

export function puntiZone(z: Prova['zone'], major: boolean): number {
  return z.A * 5 + z.C * (major ? 4 : 3) + z.D * (major ? 2 : 1) - z.M * 10 - z.NS * 10
}

export function hitFactor(z: Prova['zone'], major: boolean, tempo: number | null): number | null {
  if (!tempo || tempo <= 0) return null
  return Math.max(0, puntiZone(z, major)) / tempo
}

export interface Statistiche {
  n: number
  migliore: number | null
  media: number | null
  ultime: number[] // tempi delle ultime prove, dalla più vecchia
  hfMigliore: number | null
  riuscite?: number
}

export function statistiche(prove: Prova[]): Statistiche {
  const conTempo = prove.filter((p) => p.tempo && p.tempo > 0)
  const tempi = conTempo.map((p) => p.tempo!)
  const ord = [...conTempo].sort((a, b) => a.creato.localeCompare(b.creato))
  const hf = prove.map((p) => p.hf).filter((x): x is number => x !== null)
  const ultime10 = tempi.length ? ord.slice(-10).map((p) => p.tempo!) : []
  return {
    n: prove.length,
    migliore: tempi.length ? Math.min(...tempi) : null,
    media: ultime10.length ? ultime10.reduce((a, b) => a + b, 0) / ultime10.length : null,
    ultime: ultime10,
    hfMigliore: hf.length ? Math.max(...hf) : null,
    riuscite: prove.filter((p) => p.riuscita).length,
  }
}

export const fmt2 = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(2).replace('.', ','))
