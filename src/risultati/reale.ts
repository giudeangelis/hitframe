/**
 * Punteggio reale: quanto vale la tua gara indipendentemente da chi c'era.
 *
 * La percentuale in classifica dipende dal vincitore: con tanti Grand Master davanti un 76% può valere
 * più di un 90% fatto in un campo di sole classi A. Qui stimiamo, stage per stage, l'hit factor di un
 * "Grand Master in forma" (riferimento fisso) usando tutti i tiratori presenti e la loro classe:
 * ogni classe rende in media una quota nota del livello GM (calibrata sui risultati FITDS reali).
 * Il punteggio reale è il tuo hit factor rispetto a quel riferimento, pesato sui punti degli stage.
 * 100 = livello di un Grand Master forte. Si scompone in precisione (punti fatti sui punti disponibili)
 * e velocità, entrambe confrontate con le prestazioni di riferimento dello stesso stage.
 */
import { colpiStage, type Concorrente, type RisultatoGara } from './motore'

/** Hit factor tipico di ogni classe rispetto a un GM (75° percentile, stesso stage). */
export const QUOTA_CLASSE: Record<string, number> = { GM: 1.0, M: 0.9, A: 0.85, B: 0.76, C: 0.65, D: 0.6 }
const TETTO = 1.2

function quantile(v: number[], p: number) {
  const s = [...v].sort((a, b) => a - b)
  const k = (s.length - 1) * p
  const f = Math.floor(k), c = Math.min(f + 1, s.length - 1)
  return s[f] + (s[c] - s[f]) * (k - f)
}
function medianaPesata(coppie: { v: number; w: number }[]) {
  const s = [...coppie].sort((a, b) => a.v - b.v)
  const tot = s.reduce((a, x) => a + x.w, 0)
  let acc = 0
  for (const x of s) { acc += x.w; if (acc >= tot / 2) return x.v }
  return s[s.length - 1]?.v ?? 0
}
const precisioneStage = (s: Concorrente['stages'][number], valore: number) => {
  const disp = 5 * (colpiStage(s) || valore / 5)
  return disp ? Math.max(0, s.pts) / disp : 0
}

export interface StageReale {
  n: number
  hfRif: number // hit factor del riferimento (GM in forma)
  indice: number // tuo HF / riferimento × 100
  precisione: number | null // tua precisione / precisione di riferimento × 100
  velocita: number | null
  vincitore: number // HF del vincitore / riferimento × 100
}

export interface Reale {
  indice: number // punteggio reale della gara (100 = GM in forma)
  precisione: number | null
  velocita: number | null
  forza: number // quanto forte era il campo: media del vincitore sul riferimento (100 = GM in forma)
  livello: 'altissimo' | 'alto' | 'medio' | 'basso'
  classi: Record<string, number>
  stages: StageReale[]
  affidabile: boolean // abbastanza tiratori con classe nota
}

/** Il riferimento per ogni stage (hit factor di un GM in forma). */
export function riferimenti(r: RisultatoGara): Record<number, number> {
  const out: Record<number, number> = {}
  for (const nStr of Object.keys(r.valoreStage)) {
    const n = +nStr
    const perClasse = new Map<string, number[]>()
    const tutti: number[] = []
    for (const c of r.concorrenti) {
      const s = c.stages[n]
      if (!s || s.hf <= 0) continue
      tutti.push(s.hf)
      if (QUOTA_CLASSE[c.cls] === undefined) continue
      const a = perClasse.get(c.cls) ?? []
      a.push(s.hf)
      perClasse.set(c.cls, a)
    }
    const stime = [...perClasse.entries()]
      .filter(([, v]) => v.length >= 2)
      .map(([cls, v]) => ({ v: quantile(v, 0.75) / QUOTA_CLASSE[cls], w: Math.min(v.length, 10) }))
    // senza classi utilizzabili: il riferimento è il migliore dello stage
    out[n] = stime.length ? medianaPesata(stime) : Math.max(...tutti, 0.0001)
  }
  return out
}

export function punteggioReale(r: RisultatoGara, num = r.mioNum): Reale | null {
  const me = r.concorrenti.find((c) => c.num === num)
  if (!me) return null
  const rif = riferimenti(r)
  const nStages = Object.keys(r.valoreStage).map(Number).sort((a, b) => a - b)
  const classi: Record<string, number> = {}
  for (const c of r.concorrenti) if (c.cls) classi[c.cls] = (classi[c.cls] ?? 0) + 1
  const conClasse = r.concorrenti.filter((c) => QUOTA_CLASSE[c.cls] !== undefined).length

  let num0 = 0, den = 0, numP = 0, numV = 0, denPV = 0, forza = 0
  const stages: StageReale[] = nStages.map((n) => {
    const s = me.stages[n]
    const valore = r.valoreStage[n]
    const hfRif = rif[n]
    const indice = s && hfRif ? Math.min(TETTO, s.hf / hfRif) : 0
    const top = Math.max(...r.concorrenti.map((c) => c.stages[n]?.hf ?? 0))
    forza += hfRif ? top / hfRif : 1
    num0 += valore * indice
    den += valore
    // precisione di riferimento: le prestazioni "da GM" dello stage (HF vicino al riferimento)
    let precisione: number | null = null, velocita: number | null = null
    if (r.conVerify && s && s.A !== undefined && s.hf > 0) {
      const forti = r.concorrenti.map((c) => c.stages[n]).filter((x) => x && x.A !== undefined && x.hf >= 0.9 * hfRif)
      const base = forti.length >= 3 ? forti : r.concorrenti.map((c) => c.stages[n]).filter((x) => x && x.A !== undefined).sort((a, b) => b!.hf - a!.hf).slice(0, 5)
      const precRif = base.length ? base.reduce((a, x) => a + precisioneStage(x!, valore), 0) / base.length : 0
      if (precRif > 0) {
        const p = precisioneStage(s, valore) / precRif
        precisione = p * 100
        velocita = (indice / Math.max(p, 0.01)) * 100
        numP += valore * p
        numV += valore * (indice / Math.max(p, 0.01))
        denPV += valore
      }
    }
    return { n, hfRif, indice: indice * 100, precisione, velocita, vincitore: hfRif ? (top / hfRif) * 100 : 100 }
  })

  const forzaMedia = (forza / Math.max(1, nStages.length)) * 100
  const gmM = (classi.GM ?? 0) + (classi.M ?? 0)
  const livello: Reale['livello'] = gmM >= 8 ? 'altissimo' : gmM >= 3 ? 'alto' : gmM >= 1 || (classi.A ?? 0) >= 8 ? 'medio' : 'basso'
  return {
    indice: den ? (num0 / den) * 100 : 0,
    precisione: denPV ? (numP / denPV) * 100 : null,
    velocita: denPV ? (numV / denPV) * 100 : null,
    forza: forzaMedia,
    livello,
    classi,
    stages,
    affidabile: conClasse >= 10,
  }
}

/** Frase breve sul livello del campo. */
export function descriviCampo(x: Reale): string {
  const ordine = ['GM', 'M', 'A', 'B', 'C', 'D']
  const comp = ordine.filter((k) => x.classi[k]).map((k) => `${x.classi[k]} ${k}`).join(', ')
  const lv = { altissimo: 'campo fortissimo', alto: 'campo forte', medio: 'campo di medio livello', basso: 'campo poco competitivo' }[x.livello]
  return `${lv[0].toUpperCase()}${lv.slice(1)}: ${comp}`
}
