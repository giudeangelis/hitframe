import type { Componente, Divisione, Evento, Lotto, Ricetta, SessioneCrono } from '../db/types'

export const MS_FPS = 3.28084
export const GRANI_G = 0.06479891

export const toFps = (v: number, unita: 'ms' | 'fps') => (unita === 'ms' ? v * MS_FPS : v)
export const fromFps = (v: number, unita: 'ms' | 'fps') => (unita === 'ms' ? v / MS_FPS : v)

/** Power factor IPSC: grani × piedi al secondo / 1000. */
export const pf = (grani: number, fps: number) => (grani * fps) / 1000

/** Soglie IPSC handgun/PCC per divisione. */
export const SOGLIE: Record<Divisione, { minor: number; major: number | null }> = {
  Production: { minor: 125, major: null },
  'Production Optics': { minor: 125, major: null },
  Standard: { minor: 125, major: 170 },
  Open: { minor: 125, major: 160 },
  Classic: { minor: 125, major: 170 },
  Revolver: { minor: 125, major: 170 },
  Optics: { minor: 125, major: 160 },
  PCC: { minor: 125, major: null },
}

export interface StatVel { n: number; media: number; sd: number; es: number; min: number; max: number }

export function statVelocita(v: number[]): StatVel | null {
  const x = v.filter((n) => Number.isFinite(n) && n > 0)
  if (!x.length) return null
  const media = x.reduce((a, b) => a + b, 0) / x.length
  const sd = x.length > 1 ? Math.sqrt(x.reduce((a, b) => a + (b - media) ** 2, 0) / (x.length - 1)) : 0
  const min = Math.min(...x)
  const max = Math.max(...x)
  return { n: x.length, media, sd, es: max - min, min, max }
}

/** Legge velocità scritte come "352, 348 355" o una per riga. */
export function leggiVelocita(testo: string): number[] {
  const out: number[] = []
  for (const tok of testo.split(/[\s;]+/)) {
    if (!tok) continue
    // "352,5" è un decimale; "352,348,355" sono più valori
    const pezzi = /^\d+,\d{1,2}$/.test(tok) ? [tok.replace(',', '.')] : tok.split(',')
    for (const p of pezzi) {
      const n = Number(p)
      if (Number.isFinite(n) && n > 0) out.push(n)
    }
  }
  return out
}

/* Generatore casuale con seme: risultati stabili tra un rendering e l'altro */
function rng(seme: number) {
  let s = seme >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Probabilità di passare il cronografo di gara: si sparano 3 colpi; se il PF non basta
 * se ne sparano altri, uno alla volta fino a 6, e vale la media delle 3 velocità più alte.
 */
export function probabilitaCrono(mediaFps: number, sdFps: number, grani: number, soglia: number, prove = 6000): number {
  if (!mediaFps || !grani) return 0
  const r = rng(12345)
  const gauss = () => {
    const u = Math.max(r(), 1e-12)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
  }
  const sd = Math.max(sdFps, 0.5)
  const vMin = (soglia * 1000) / grani
  let ok = 0
  for (let i = 0; i < prove; i++) {
    const v: number[] = []
    for (let k = 0; k < 6; k++) {
      v.push(mediaFps + sd * gauss())
      if (v.length >= 3) {
        const top = [...v].sort((a, b) => b - a).slice(0, 3)
        if ((top[0] + top[1] + top[2]) / 3 >= vMin) { ok++; break }
      }
    }
  }
  return ok / prove
}

/** Velocità media che serve (fps) per passare il cronografo con la probabilità indicata. */
export function velocitaNecessaria(sdFps: number, grani: number, soglia: number, obiettivo = 0.99): number {
  let lo = (soglia * 1000) / grani - 4 * Math.max(sdFps, 1)
  let hi = (soglia * 1000) / grani + 4 * Math.max(sdFps, 1)
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2
    if (probabilitaCrono(m, sdFps, grani, soglia, 2500) >= obiettivo) hi = m
    else lo = m
  }
  return hi
}

/** Differenza prudenziale tra il tuo cronografo e quello di gara */
export const SCARTO_CRONO = 0.02

export interface EsitoCrono {
  stat: StatVel
  grani: number
  pfMedio: number
  pfMin: number
  soglia: number
  livello: 'minor' | 'major'
  probabilita: number
  /** Stessa probabilità se il cronografo di gara legge il 2% più basso del tuo (temperatura, strumento, arma) */
  probabilitaPrudente: number
  margine: number
  velNecessaria: number // fps, per il 99%
  giudizio: 'sicuro' | 'attenzione' | 'rischio'
}

export function valutaSessione(s: SessioneCrono, r: Ricetta, divisione: Divisione, livello: 'minor' | 'major' = 'minor'): EsitoCrono | null {
  const st = statVelocita(s.velocita.map((v) => toFps(v, s.unita)))
  if (!st) return null
  const grani = s.pesoMisurato ?? r.pesoPalla
  const soglie = SOGLIE[divisione]
  const soglia = livello === 'major' && soglie.major ? soglie.major : soglie.minor
  const probabilita = probabilitaCrono(st.media, st.sd, grani, soglia)
  const probabilitaPrudente = probabilitaCrono(st.media * (1 - SCARTO_CRONO), st.sd, grani, soglia)
  const pfMedio = pf(grani, st.media)
  return {
    stat: st,
    grani,
    pfMedio,
    pfMin: pf(grani, st.min),
    soglia,
    livello: livello === 'major' && soglie.major ? 'major' : 'minor',
    probabilita,
    probabilitaPrudente,
    margine: pfMedio - soglia,
    velNecessaria: velocitaNecessaria(st.sd, grani, soglia) / (1 - SCARTO_CRONO),
    giudizio: probabilitaPrudente >= 0.99 ? 'sicuro' : probabilita >= 0.99 ? 'attenzione' : 'rischio',
  }
}

/* ---------- Costi ---------- */

export const costoUnitario = (c?: Componente | null) =>
  c && c.prezzoConfezione && c.confezione ? c.prezzoConfezione / c.confezione : null

export interface CostoColpo { palla: number | null; polvere: number | null; innesco: number | null; bossolo: number | null; totale: number | null; completo: boolean }

export function costoColpo(r: Ricetta, comp: Componente[]): CostoColpo {
  const trova = (id?: number | null) => (id ? comp.find((c) => c.id === id) : undefined)
  const palla = costoUnitario(trova(r.pallaId))
  const pg = costoUnitario(trova(r.polvereId))
  const polvere = pg !== null && r.carica ? pg * r.carica * GRANI_G : null
  const innesco = costoUnitario(trova(r.innescoId))
  const b = trova(r.bossoloId)
  const bu = costoUnitario(b)
  const bossolo = bu !== null ? bu / Math.max(1, b?.riusi ?? 1) : null
  const parti = [palla, polvere, innesco, bossolo]
  const noti = parti.filter((x): x is number => x !== null)
  return { palla, polvere, innesco, bossolo, totale: noti.length ? noti.reduce((a, b) => a + b, 0) : null, completo: noti.length === 4 }
}

/** Componenti consumati producendo n colpi. */
export function consumoLotto(r: Ricetta, n: number) {
  return {
    palle: r.pallaId ? n : 0,
    inneschi: r.innescoId ? n : 0,
    polvereG: r.polvereId && r.carica ? n * r.carica * GRANI_G : 0,
  }
}

/** Quanti colpi puoi ancora produrre con il magazzino, componente limitante compreso. */
export function colpiProducibili(r: Ricetta, comp: Componente[]): { colpi: number; limite: string } | null {
  const lim: { colpi: number; nome: string }[] = []
  const c = (id?: number | null) => (id ? comp.find((x) => x.id === id) : undefined)
  const p = c(r.pallaId); if (p) lim.push({ colpi: p.quantita, nome: 'palle' })
  const i = c(r.innescoId); if (i) lim.push({ colpi: i.quantita, nome: 'inneschi' })
  const pw = c(r.polvereId); if (pw && r.carica) lim.push({ colpi: Math.floor(pw.quantita / (r.carica * GRANI_G)), nome: 'polvere' })
  if (!lim.length) return null
  const m = lim.reduce((a, b) => (b.colpi < a.colpi ? b : a))
  return { colpi: Math.max(0, Math.floor(m.colpi)), limite: m.nome }
}

/* ---------- Scorte di munizioni pronte ---------- */

const contaConsumo = (e: Evento) => e.completato && (e.tipo === 'fuoco' || e.tipo === 'gara') && (e.colpiSparati ?? 0) > 0

/** Scorta = munizioni prodotte o comprate − colpi sparati nelle sessioni completate dalla data del primo lotto. */
export function scorta(lotti: Lotto[], eventi: Evento[]) {
  if (!lotti.length) return { pronte: 0, prodotte: 0, sparati: 0, dal: null as string | null }
  const dal = lotti.reduce((a, l) => (l.data < a ? l.data : a), lotti[0].data)
  const prodotte = lotti.reduce((a, l) => a + l.quantita, 0)
  const sparati = eventi.filter((e) => contaConsumo(e) && e.data >= dal).reduce((a, e) => a + (e.colpiSparati ?? 0), 0)
  return { pronte: prodotte - sparati, prodotte, sparati, dal }
}

export interface Fabbisogno { gara: Evento; colpiGara: number; colpiAllenamenti: number; totale: number; mancano: number }

/** Colpi che servono fino alla prossima gara: allenamenti a fuoco pianificati + gara (+15% e 8 colpi di cronografo). */
export function fabbisogno(eventi: Evento[], pronte: number, oggi: string, colpiDaAnalisi?: (g: Evento) => number | null): Fabbisogno | null {
  const gara = eventi.filter((e) => e.tipo === 'gara' && e.data >= oggi && !e.completato).sort((a, b) => a.data.localeCompare(b.data))[0]
  if (!gara) return null
  const minimi = gara.gara?.colpiTotali ?? colpiDaAnalisi?.(gara) ?? (gara.gara?.numeroStage ? gara.gara.numeroStage * 20 : 150)
  const colpiGara = Math.ceil(minimi * 1.15) + 8
  const colpiAllenamenti = eventi
    .filter((e) => e.tipo === 'fuoco' && !e.completato && e.data >= oggi && e.data <= gara.data)
    .reduce((a, e) => a + (e.colpiPianificati ?? 0), 0)
  const totale = colpiGara + colpiAllenamenti
  return { gara, colpiGara, colpiAllenamenti, totale, mancano: Math.max(0, totale - pronte) }
}

export const euro = (n: number | null | undefined, dec = 3) =>
  n === null || n === undefined ? '—' : `${n.toFixed(dec).replace('.', ',')} €`
export const num1 = (n: number) => n.toFixed(1).replace('.', ',')
