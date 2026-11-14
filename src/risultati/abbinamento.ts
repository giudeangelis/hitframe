/**
 * Abbina gli stage della classifica a quelli del libretto di gara.
 * Dal 2026 la numerazione dei risultati non segue più quella del libretto: si confrontano
 * punti massimi (vincolo), no-shoot, quota di carta, mancati e tempo per colpo.
 */
import type { StageLetto } from '../analisi/tipi'
import { metalli } from '../analisi/motore'
import type { RisultatoGara } from './motore'

export interface Abbinamento {
  mappa: Record<number, number> // stage risultati → stage libretto
  incerti: number[] // stage dei risultati con un'alternativa quasi equivalente
}

interface FeatR { n: number; V: number; ns: number; cd: number; miss: number; tpc: number }
interface FeatB { n: number; V: number; ns: number; carta: number; rischio: number; tpc: number }

const media = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length)
const mediana = (x: number[]) => { const s = [...x].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }

function featRisultati(r: RisultatoGara): FeatR[] {
  return Object.keys(r.valoreStage).map(Number).map((n) => {
    let A = 0, C = 0, D = 0, MI = 0, NS = 0, k = 0
    const tempi: number[] = []
    for (const c of r.concorrenti) {
      const s = c.stages[n]
      if (!s || s.tempo <= 0) continue
      tempi.push(s.tempo)
      if (s.A === undefined) continue
      A += s.A; C += s.C ?? 0; D += s.D ?? 0; MI += s.MI ?? 0; NS += s.NS ?? 0; k++
    }
    const colpi = r.valoreStage[n] / 5
    const hit = A + C + D
    return { n, V: r.valoreStage[n], ns: k ? NS / k : 0, cd: hit ? (C + D) / hit : 0, miss: hit + MI ? MI / (hit + MI) : 0, tpc: mediana(tempi) / colpi }
  })
}

function featLibretto(stages: StageLetto[]): FeatB[] {
  return stages.map((s) => {
    const met = metalli(s)
    const colpi = s.colpi || s.puntiMax / 5
    const carta = Math.max(0, colpi - met) / colpi
    const posizioni = Math.max(1, (s.etichetteDisegno ?? []).filter((e) => /^P\d/i.test(e)).length)
    return {
      n: s.numero, V: s.puntiMax, ns: s.bersagli.noShoot,
      carta,
      rischio: met / colpi + (s.flag.mobili ? 0.25 : 0) + (s.flag.manoDebole || s.flag.manoForte ? 0.2 : 0),
      // più tempo per colpo con partenze speciali, una mano, tanti metalli
      tpc: 1 + (s.flag.manoDebole || s.flag.manoForte ? 0.35 : 0) + (s.flag.armaSuTavolo || s.flag.armaScarica ? 0.15 : 0) + met / colpi * 0.4 + posizioni * 0.02,
    }
  })
}

export function abbinaStage(r: RisultatoGara, stages: StageLetto[]): Abbinamento | null {
  const R = featRisultati(r)
  const B = featLibretto(stages)
  if (!R.length || R.length !== B.length) return null
  const nr = (x: number, m: number) => (m > 0 ? x / m : 0)
  const mCd = media(R.map((x) => x.cd)), mCarta = media(B.map((x) => x.carta))
  const mMiss = media(R.map((x) => x.miss)), mRis = media(B.map((x) => x.rischio))
  const mTr = media(R.map((x) => x.tpc)), mTb = media(B.map((x) => x.tpc))
  const costo = (a: FeatR, b: FeatB) => {
    if (a.V !== b.V) return 1e6
    const nsR = a.ns > 0.03, nsB = b.ns > 0
    let c = nsR !== nsB ? 3 : 0
    c += Math.abs(Math.log1p(a.ns * 4) - Math.log1p(b.ns)) * 0.6
    c += Math.abs(nr(a.cd, mCd) - nr(b.carta, mCarta)) * 2
    c += Math.abs(nr(a.miss, mMiss) - nr(b.rischio, mRis)) * 0.8
    c += Math.abs(nr(a.tpc, mTr) - nr(b.tpc, mTb)) * 1.5
    return c
  }
  const n = R.length
  const M = R.map((a) => B.map((b) => costo(a, b)))
  // programmazione dinamica sulle assegnazioni (n ≤ 16)
  if (n > 16) return null
  const size = 1 << n
  const dp = new Float64Array(size).fill(Infinity)
  const da = new Int16Array(size).fill(-1)
  dp[0] = 0
  for (let mask = 0; mask < size; mask++) {
    if (dp[mask] === Infinity) continue
    const i = popcount(mask)
    if (i >= n) continue
    for (let j = 0; j < n; j++) {
      if (mask & (1 << j)) continue
      const v = dp[mask] + M[i][j]
      const nm = mask | (1 << j)
      if (v < dp[nm]) { dp[nm] = v; da[nm] = j }
    }
  }
  if (dp[size - 1] >= 1e6) return null
  const scelta: number[] = new Array(n)
  let mask = size - 1
  for (let i = n - 1; i >= 0; i--) { const j = da[mask]; scelta[i] = j; mask &= ~(1 << j) }
  const mappa: Record<number, number> = {}
  const incerti: number[] = []
  R.forEach((a, i) => {
    mappa[a.n] = B[scelta[i]].n
    // incerto se scambiandolo con un altro stage dello stesso valore il costo cresce poco
    const alt = R.some((b, k) => k !== i && b.V === a.V && M[i][scelta[k]] + M[k][scelta[i]] - M[i][scelta[i]] - M[k][scelta[k]] < 0.6)
    if (alt) incerti.push(a.n)
  })
  return { mappa, incerti }
}

function popcount(x: number) { let c = 0; while (x) { x &= x - 1; c++ } return c }
