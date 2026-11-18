/**
 * Lettore dei libretti "da club" (non FITDS): una pagina per stage con l'intestazione
 * testuale in alto ("Stage 2 … MEDIUM COURSE, COLPI MINIMI, PUNTEGGIO MASSIMO, Start Position,
 * Procedure, Briefing Note"), il disegno sotto e un piè di pagina col nome del campo.
 */
import { righe } from './parser'
import type { BersagliStage, InfoGara, PaginaPdf, StageLetto, TipoCorso } from './tipi'

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const ETICHETTA = /^(T|MT|P|MP|PP|PL|NS|M|S|SW|D|R|W|A|B)\d{1,2}$/

export function eStageClub(p: PaginaPdf): boolean {
  const t = righe(p.items).slice(0, 12).map((r) => r.testo).join('\n')
  return /\bStage\s*\d{1,2}\b/i.test(t) && /(SHORT|MEDIUM|LONG)\s+COURSE/i.test(t) && /COLPI\s+MINIMI|MINIMUM\s+ROUNDS/i.test(t)
}

function numero(t: string, re: RegExp): number {
  const m = t.match(re)
  return m ? Number(m[1]) : 0
}

function bersagli(testo: string): BersagliStage {
  // pdf.js a volte spezza le parole ("PO PPER S", "I PSC"): uniamo le lettere separate da spazi
  const t = testo.replace(/(?<=[A-Za-z])\s+(?=[A-Za-z])/g, '')
  const b = { carta: 0, miniCarta: 0, popper: 0, miniPopper: 0, piastre: 0, noShoot: 0 }
  const somma = (re: RegExp) => [...t.matchAll(re)].reduce((s, m) => s + Number(m[1]), 0)
  b.miniCarta = somma(/(\d{1,2})\s*(?:IPSC)?MINITARGETS?/gi)
  b.carta = somma(/(\d{1,2})\s*IPSCTARGETS?/gi)
  b.miniPopper = somma(/(\d{1,2})\s*(?:IPSC)?MINIPOPPERS?/gi)
  b.popper = somma(/(\d{1,2})\s*(?:IPSC)?POPPERS?/gi)
  b.piastre = somma(/(\d{1,2})\s*(?:IPSC)?(?:METAL)?PLATES?/gi)
  b.noShoot = somma(/(\d{1,2})\s*(?:PENAL[A-Z]*?TARGETS?|NO-?SHOOTS?)/gi)
  return b
}

/** Testo tra un'etichetta e la successiva. */
function blocco(t: string, da: RegExp, fine: RegExp[]): string {
  const m = t.match(da)
  if (!m || m.index == null) return ''
  let resto = t.slice(m.index + m[0].length)
  let taglio = resto.length
  for (const f of fine) {
    const x = resto.search(f)
    if (x >= 0 && x < taglio) taglio = x
  }
  resto = resto.slice(0, taglio)
  return norm(resto.replace(/^[\s:.]+/, ''))
}

export function leggiStageClub(p: PaginaPdf): (Omit<StageLetto, 'numero'> & { numeroLetto: number }) | null {
  if (!eStageClub(p)) return null
  const rr = righe(p.items)
  // fine dell'intestazione: la riga delle note di briefing (e le sue continuazioni ravvicinate)
  let fineIdx = rr.findIndex((r) => /Br[ei]a?fing\s*Note/i.test(r.testo))
  if (fineIdx < 0) fineIdx = rr.findIndex((r) => /Safety\s+angles?/i.test(r.testo))
  if (fineIdx < 0) fineIdx = rr.findIndex((r) => /Procedur/i.test(r.testo))
  if (fineIdx < 0) return null
  while (fineIdx + 1 < rr.length) {
    const r = rr[fineIdx + 1]
    if (rr[fineIdx].y - r.y > 16 || r.items.every((i) => ETICHETTA.test(i.str.trim()) || /^["“”]?[A-Z]["“”]?$/.test(i.str.trim()))) break
    fineIdx++
  }
  const intest = rr.slice(0, fineIdx + 1)
  const t = intest.map((r) => r.testo).join('\n')
    .replace(/\b(M|N|P) (P|S|L)(\d{1,2})\b/g, '$1$2$3') // "M P1" → "MP1"
  const tipoM = t.match(/(SHORT|MEDIUM|LONG)\s+COURSE/i)!
  const tipo = (tipoM[1][0].toUpperCase() + tipoM[1].slice(1).toLowerCase()) as TipoCorso
  const fineEtichette = [/Procedur\w*\s*:/i, /Safety\s+angles?/i, /Br[ei]a?fing\s*Note/i, /Start\s+Position/i]
  const partenza = blocco(t, /Start\s+Position\s*:?/i, fineEtichette)
  const procedura = blocco(t, /Procedur\w*\s*:?/i, fineEtichette)
  const note = blocco(t, /Br[ei]a?fing\s*Note\s*:?/i, fineEtichette).replace(/^\.+$/, '')
  // "In A con la mano forte… Arma carica in fondina. (PCC: …)": separa posizione e arma
  const iArma = partenza.search(/\bArma\b|\bHandgun\b|\bPistola\b/i)
  const posizionePartenza = iArma > 0 ? norm(partenza.slice(0, iArma)).replace(/\.$/, '') : partenza
  const prontoArma = iArma > 0 ? norm(partenza.slice(iArma)) : ''

  const cimaDisegno = intest[intest.length - 1].y - 8
  // piè di pagina: righe con testo vero nel 15% basso della pagina
  const piede = rr.filter((r) => r.y < p.altezza * 0.15 && /[a-z]{4,}/i.test(r.testo))
  const fondoDisegno = piede.length ? Math.max(...piede.map((r) => r.y + (r.items[0]?.h || 10))) + 6 : 24

  const etichetteDisegno = [...new Set(
    p.items.filter((i) => i.y < cimaDisegno && i.y > fondoDisegno && ETICHETTA.test(i.str.trim())).map((i) => i.str.trim()),
  )].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))

  const s = {
    numeroLetto: numero(t, /\bStage\s*(\d{1,2})\b/i),
    pagina: p.numero,
    lingua: 'it' as const,
    tipo,
    colpi: numero(t, /COLPI\s+MINIMI\s*:?\s*(\d{1,3})/i) || numero(t, /MINIMUM\s+ROUNDS\s*:?\s*(\d{1,3})/i),
    puntiMax: numero(t, /PUNTEGGIO\s+MASSIMO\s*:?\s*(\d{1,3})/i) || numero(t, /MAXIMUM\s+POINTS\s*:?\s*(\d{1,3})/i),
    segnalePartenza: /segnale\s+acustico|audible/i.test(procedura) ? 'Acustico' : '',
    bersagli: bersagli(t),
    posizionePartenza,
    prontoTiratore: '',
    prontoArma,
    procedura,
    note,
    etichetteDisegno,
    tabellaTopY: fondoDisegno,
    disegnoTopY: cimaDisegno,
    flag: {} as StageLetto['flag'],
    attivazioni: [] as string[],
  }
  return s
}

/** Copertina di un libretto da club: nome, campo, date, esercizi e colpi se scritti. */
export function leggiInfoClub(pagine: PaginaPdf[]): InfoGara {
  const info: InfoGara = { nome: '', campo: '', date: '', tipoEvento: 'Gara di club', livello: '', matchDirector: '', esercizi: null, colpi: null, punti: null }
  const p = pagine[0]
  if (!p) return info
  const rr = righe(p.items).filter((r) => /[a-z]/i.test(r.testo))
  const tutto = rr.map((r) => r.testo).join('\n')
  const anno = tutto.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear())
  const date = tutto.match(/(\d{1,2}\s*[-–]\s*)*\d{1,2}\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(\s+\d{4})?/i)
  if (date) info.date = /\d{4}$/.test(date[0]) ? date[0] : `${date[0]} ${anno}`
  const titoli = rr.slice(0, 3).map((r) => r.testo).filter((x) => !/\d{1,2}\s*[-–]\s*\d{1,2}|ESERCIZI|Iscrizioni/i.test(x))
  info.nome = norm(titoli.slice(0, 2).join(' – '))
  info.campo = titoli[1] ?? ''
  const es = tutto.match(/(\d{1,2})\s+ESERCIZI/i)
  if (es) info.esercizi = Number(es[1])
  const co = tutto.match(/(\d{2,4})\s+colpi/i)
  if (co) info.colpi = Number(co[1])
  return info
}
