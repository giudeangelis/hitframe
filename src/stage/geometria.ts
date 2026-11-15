/**
 * Stage designer: visibilità, conteggio colpi e conversione verso il pianificatore.
 * Coordinate in metri come gli schemi dei drill: x laterale, y verso i bersagli.
 */
import type { ElementoSchema, Schema } from '../allenamento/schemi'
import type { MappaStage, TipoBersaglio } from '../analisi/mappa'
import type { StageLetto } from '../analisi/tipi'

export const BERSAGLI = ['carta', 'mini', 'popper', 'miniPopper', 'piastra', 'bobber'] as const
export const isBersaglio = (e: ElementoSchema) => (BERSAGLI as readonly string[]).includes(e.t)
export const isPosizione = (e: ElementoSchema) => e.t === 'box' || e.t === 'tiratore'

export function colpi(s: Schema) {
  return s.elementi.reduce((a, e) => a + (e.t === 'carta' || e.t === 'mini' || (e.t === 'bobber' && e.variante !== 'piatto') ? 2 : isBersaglio(e) ? 1 : 0), 0)
}

export function corso(n: number): { tipo: 'Short' | 'Medium' | 'Long'; oltre: boolean } {
  return { tipo: n <= 12 ? 'Short' : n <= 24 ? 'Medium' : 'Long', oltre: n > 32 }
}

/* segmenti */
function interseca(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx)
  if (Math.abs(d) < 1e-9) return false
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d
  return t > 0.02 && t < 0.98 && u >= 0 && u <= 1
}
function distSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const l2 = (bx - ax) ** 2 + (by - ay) ** 2
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2)) : 0
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
}

/** Il bersaglio è visibile dalla posizione? Pareti e barili coprono; ci si può sporgere di mezzo metro. */
export function vede(s: Schema, pos: ElementoSchema, b: ElementoSchema): boolean {
  const ostacoli = s.elementi.filter((e) => e.t === 'muro' || e.t === 'barile')
  const punti = pos.t === 'box' ? [[pos.x, pos.y], [pos.x - 0.55, pos.y], [pos.x + 0.55, pos.y], [pos.x, pos.y + 0.5]] : [[pos.x, pos.y]]
  return punti.some(([x, y]) => ostacoli.every((o) => o.t === 'muro'
    ? !interseca(x, y, b.x, b.y, o.x, o.y, o.x2 ?? o.x, o.y2 ?? o.y)
    : distSegmento(o.x, o.y, x, y, b.x, b.y) > 0.38))
}

export function etichettaPosizione(s: Schema, e: ElementoSchema) {
  if (e.t === 'tiratore') return 'Partenza'
  const i = s.elementi.filter((x) => x.t === 'box').indexOf(e)
  return e.id || `P${i + 1}`
}

/** Converte il disegno in una mappa per il pianificatore (aggressivo/conservativo). */
export function versoMappa(s: Schema): { mappa: MappaStage; stage: StageLetto } | null {
  const el = s.elementi
  const bers = el.filter((e) => isBersaglio(e) || e.t === 'noshoot')
  const pos = el.filter((e) => e.t === 'box')
  const start = el.find((e) => e.t === 'tiratore') ?? pos[0]
  if (!bers.some(isBersaglio) || !start) return null
  const xs = el.flatMap((e) => [e.x, e.x2 ?? e.x]), ys = el.flatMap((e) => [e.y, e.y2 ?? e.y])
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1
  const W = maxX - minX, H = maxY - minY
  const nx = (x: number) => (x - minX) / W, ny = (y: number) => 1 - (y - minY) / H
  const ids = new Map<ElementoSchema, string>()
  let k = 0
  const pref: Record<string, string> = { carta: 'T', mini: 'T', popper: 'PP', miniPopper: 'MP', piastra: 'PL', bobber: 'B' }
  const usati = new Set<string>()
  for (const b of bers) {
    let id = b.t === 'noshoot' ? `NS${++k}` : (b.id || '').toUpperCase().replace(/\s+/g, '')
    if (!id || usati.has(id)) { let i = 1; while (usati.has(`${pref[b.t]}${i}`)) i++; id = `${pref[b.t]}${i}` }
    usati.add(id); ids.set(b, id)
  }
  const posizioni = (pos.length ? pos : [start]).map((p, i) => ({
    id: `P${i + 1}`, x: nx(p.x), y: ny(p.y), nota: etichettaPosizione(s, p),
    vede: bers.filter((b) => isBersaglio(b) && vede(s, p, b)).map((b) => ids.get(b)!),
  }))
  const bersagli = bers.map((b) => {
    const visto = pos.filter((p) => isBersaglio(b) && vede(s, p, b))
    const d = visto.length ? Math.min(...visto.map((p) => Math.hypot(p.x - b.x, p.y - b.y))) : Math.hypot(start.x - b.x, start.y - b.y)
    const ns = bers.some((n) => n.t === 'noshoot' && Math.abs(n.x - b.x) < 0.6 && Math.abs(n.y - b.y) < 0.8)
    const tipo: TipoBersaglio = b.t === 'bobber' ? (b.variante === 'piatto' ? 'piastra' : 'carta') : (b.t as TipoBersaglio)
    return { id: ids.get(b)!, tipo, x: nx(b.x), y: ny(b.y), distanza: Math.max(3, Math.round(d * 2) / 2), parziale: ns || b.variante === 'passata', mobile: b.t === 'bobber', attiva: [] as string[] }
  })
  const n = colpi(s)
  const conta = (t: string) => bers.filter((b) => b.t === t).length
  const mappa: MappaStage = {
    partenza: { id: 'S', x: nx(start.x), y: ny(start.y), nota: '' },
    posizioni, bersagli, larghezzaM: W, profonditaM: H, fonte: 'manuale', aggiornata: new Date().toISOString(),
  }
  const stage = {
    numero: 1, pagina: 1, lingua: 'it', tipo: corso(n).tipo, colpi: n, puntiMax: n * 5, segnalePartenza: 'Audio',
    bersagli: { carta: conta('carta') + bers.filter((b) => b.t === 'bobber' && b.variante !== 'piatto').length, miniCarta: conta('mini'), popper: conta('popper'), miniPopper: conta('miniPopper'), piastre: conta('piastra') + bers.filter((b) => b.t === 'bobber' && b.variante === 'piatto').length, noShoot: conta('noshoot') },
    posizionePartenza: '', prontoTiratore: '', prontoArma: '', procedura: '', note: '', etichetteDisegno: [], tabellaTopY: 0,
    flag: { manoForte: false, manoDebole: false, mobili: el.some((e) => e.t === 'bobber'), armaSuTavolo: el.some((e) => e.t === 'tavolo'), armaScarica: false, colpoNonCamerato: false, partenzaGirato: start.verso === 'indietro', seduto: false, ricaricaObbligatoria: false, partenzaLibera: false },
    attivazioni: [],
  } as StageLetto
  return { mappa, stage }
}
