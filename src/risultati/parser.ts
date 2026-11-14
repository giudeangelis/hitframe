/**
 * Lettore dei PDF dei risultati FITDS / Practiscore-like (Overall, Stage Results, Score Verification).
 * Lavora solo sul testo con posizioni: nessuna rete, nessuna AI.
 */
import type { PaginaPdf, TestoPdf } from '../analisi/tipi'

export type TipoPdfRisultati = 'overall' | 'stage' | 'verify'

export interface RigaOverall { pos: number; pct: number; punti: number; nome: string; cat: string; reg: string; cls: string }
export interface RigaStage { pos: number; pts: number; tempo: number; hf: number; puntiStage: number; pct: number; num: number; nome: string }
export interface StageVerify { n: number; hf: number; pts: number; A: number; C: number; D: number; MI: number; NS: number; PE: number; tempo: number }
export interface Verify { num: number; nome: string; div: string; cls: string; factor: string; cat: string; stages: StageVerify[] }

export interface LetturaRisultati {
  gara: string
  overall: Record<string, RigaOverall[]> // per divisione
  stage: Record<string, Record<number, RigaStage[]>> // divisione → stage → righe
  verify: Verify[]
  tipi: TipoPdfRisultati[]
}

type Riga = { y: number; tok: string[] }

function righe(items: TestoPdf[], tol = 2): Riga[] {
  const ord = items.filter((i) => i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const out: { y: number; items: TestoPdf[] }[] = []
  for (const it of ord) {
    const r = out.find((x) => Math.abs(x.y - it.y) <= tol)
    if (r) r.items.push(it)
    else out.push({ y: it.y, items: [it] })
  }
  return out
    .map((r) => ({ y: r.y, tok: r.items.sort((a, b) => a.x - b.x).map((i) => i.str.replace(/\s+/g, ' ').trim()).filter(Boolean) }))
    .sort((a, b) => b.y - a.y)
}

const num = (s: string) => Number(s.replace(',', '.'))
const isInt = (s: string) => /^\d+$/.test(s)
const isDec = (s: string) => /^-?\d+(?:[.,]\d+)?$/.test(s)
const CATEGORIE = new Set(['L', 'J', 'SJ', 'S', 'SS', 'GS', 'LADY', 'JUNIOR', 'SENIOR', 'SUPER SENIOR', 'GRAND SENIOR'])

/** "PRODUCTION OPTICS -- Overall Match Results" → "Production Optics" */
export function nomeDivisione(s: string) {
  return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bPc\b/, 'PCC')
}

export function tipoPdf(pagine: PaginaPdf[]): TipoPdfRisultati | null {
  const t = pagine.slice(0, 2).flatMap((p) => p.items.map((i) => i.str)).join(' ')
  if (/Score Verification/i.test(t)) return 'verify'
  if (/Overall Stage Results|Stage Results/i.test(t)) return 'stage'
  if (/Overall Match Results|Match Results/i.test(t)) return 'overall'
  return null
}

export function leggiRisultati(pdfs: PaginaPdf[][]): LetturaRisultati {
  const out: LetturaRisultati = { gara: '', overall: {}, stage: {}, verify: [], tipi: [] }
  for (const pagine of pdfs) {
    const tipo = tipoPdf(pagine)
    if (!tipo) continue
    out.tipi.push(tipo)
    let verifyCorrente: Verify | null = null
    for (const p of pagine) {
      const rr = righe(p.items)
      let div = ''
      let stageN = 0
      for (let i = 0; i < rr.length; i++) {
        const t = rr[i].tok
        const testo = t.join(' ')
        const mDiv = testo.match(/^(.+?)\s+--\s+Overall (Match|Stage) Results/i)
        if (mDiv) {
          div = nomeDivisione(mDiv[1])
          const titolo = rr[i + 1]?.tok.join(' ')
          if (titolo && !out.gara && !/^Printed/i.test(titolo)) out.gara = titolo
          continue
        }
        if (i < 4 && !out.gara && tipo === 'verify' && i === 1 && !/^Printed/i.test(testo)) out.gara = testo
        if (tipo === 'overall' && div) {
          // pos, %, punti, nome, [cat], reg, [cls]
          if (t.length >= 5 && isInt(t[0]) && isDec(t[1]) && isDec(t[2]) && t[3].includes(',')) {
            const resto = t.slice(4)
            const iReg = resto.findIndex((x) => /^[A-Z]{3}$/.test(x))
            const reg = iReg >= 0 ? resto[iReg] : ''
            const cat = iReg > 0 ? resto.slice(0, iReg).find((x) => CATEGORIE.has(x.toUpperCase())) ?? '' : ''
            const cls = iReg >= 0 ? resto[iReg + 1] ?? '' : ''
            ;(out.overall[div] ??= []).push({ pos: +t[0], pct: num(t[1]), punti: num(t[2]), nome: t[3], cat, reg, cls: /^(GM|M|A|B|C|D|U)$/.test(cls) ? cls : '' })
          }
        } else if (tipo === 'stage' && div) {
          const mS = testo.match(/^Stage\s+0*(\d+)$/i)
          if (mS) { stageN = +mS[1]; continue }
          // pos, pts, tempo, hf, punti stage, %, #, nome
          // "# NOME" può arrivare in una sola cella
          const tt = t.length >= 7 && /^\d+\s+\S/.test(t[6]) ? [...t.slice(0, 6), t[6].split(' ')[0], t[6].replace(/^\d+\s+/, ''), ...t.slice(7)] : t
          if (stageN && tt.length >= 8 && isInt(tt[0]) && isDec(tt[1]) && isDec(tt[2]) && isDec(tt[3]) && isDec(tt[4]) && isDec(tt[5]) && isInt(tt[6])) {
            const r: RigaStage = { pos: +tt[0], pts: num(tt[1]), tempo: num(tt[2]), hf: num(tt[3]), puntiStage: num(tt[4]), pct: num(tt[5]), num: +tt[6], nome: tt.slice(7).join(' ') }
            ;((out.stage[div] ??= {})[stageN] ??= []).push(r)
          }
        } else if (tipo === 'verify') {
          const iDiv = t.findIndex((x) => /^DIV:/i.test(x))
          if (iDiv > 0 && isInt(t[0])) {
            const val = (re: RegExp) => (t.find((x) => re.test(x)) ?? '').replace(re, '').trim()
            verifyCorrente = {
              num: +t[0], nome: t.slice(1, iDiv).join(' '), div: val(/^DIV:\s*/i), cls: val(/^CLASS:\s*/i),
              factor: val(/^FACTOR:\s*/i), cat: val(/^CATEGORY:\s*/i), stages: [],
            }
            out.verify.push(verifyCorrente)
            continue
          }
          const mSt = testo.match(/^Stage\s+0*(\d+)\s/i)
          if (mSt && verifyCorrente) {
            const n = t.slice(1).filter(isDec).map(num)
            // FACTOR PTS A C D Ded MI NS PE Time
            if (n.length >= 10) {
              const [hf, pts, A, C, D, , MI, NS, PE, tempo] = n
              verifyCorrente.stages.push({ n: +mSt[1], hf, pts, A, C, D, MI, NS, PE, tempo })
            }
          }
        }
      }
    }
  }
  return out
}
