/**
 * Motore di analisi: profilo della gara, stime di tempo dai tempi personali,
 * priorità di allenamento. Tutto deterministico, niente AI.
 */
import type { Classe, Divisione, Profilo, TempiPersonali } from '../db/types'
import type { StageLetto } from './tipi'

/* ---------- Profilo gara ---------- */

export interface ProfiloGara {
  stage: number
  colpi: number
  punti: number
  perTipo: Record<'Short' | 'Medium' | 'Long', number>
  colpiCarta: number
  colpiMetallo: number
  quotaMetallo: number // 0-1
  bersagliCarta: number
  miniCarta: number
  miniPopper: number
  noShoot: number
  stageConNoShoot: number
  stageMobili: number
  stageManoForte: number
  stageManoDebole: number
  partenzeSpeciali: number
  stageMovimento: number // medium + long
}

export const metalli = (s: StageLetto) => s.bersagli.popper + s.bersagli.miniPopper + s.bersagli.piastre
export const carte = (s: StageLetto) => s.bersagli.carta + s.bersagli.miniCarta

export function partenzaSpeciale(s: StageLetto): string[] {
  const out: string[] = []
  if (s.flag.armaSuTavolo) out.push('arma su tavolo/oggetto')
  if (s.flag.armaScarica) out.push('arma scarica')
  if (s.flag.colpoNonCamerato) out.push('colpo non camerato')
  if (s.flag.partenzaGirato) out.push('partenza girato')
  if (s.flag.seduto) out.push('seduto')
  return out
}

export function profiloGara(stages: StageLetto[]): ProfiloGara {
  const p: ProfiloGara = {
    stage: stages.length, colpi: 0, punti: 0, perTipo: { Short: 0, Medium: 0, Long: 0 },
    colpiCarta: 0, colpiMetallo: 0, quotaMetallo: 0, bersagliCarta: 0, miniCarta: 0, miniPopper: 0,
    noShoot: 0, stageConNoShoot: 0, stageMobili: 0, stageManoForte: 0, stageManoDebole: 0,
    partenzeSpeciali: 0, stageMovimento: 0,
  }
  for (const s of stages) {
    p.colpi += s.colpi
    p.punti += s.puntiMax
    p.perTipo[s.tipo]++
    const m = metalli(s)
    p.colpiMetallo += m
    p.colpiCarta += Math.max(0, s.colpi - m)
    p.bersagliCarta += carte(s)
    p.miniCarta += s.bersagli.miniCarta
    p.miniPopper += s.bersagli.miniPopper
    p.noShoot += s.bersagli.noShoot
    if (s.bersagli.noShoot) p.stageConNoShoot++
    if (s.flag.mobili) p.stageMobili++
    if (s.flag.manoForte) p.stageManoForte++
    if (s.flag.manoDebole) p.stageManoDebole++
    if (partenzaSpeciale(s).length) p.partenzeSpeciali++
    if (s.tipo !== 'Short') p.stageMovimento++
  }
  p.quotaMetallo = p.colpi ? p.colpiMetallo / p.colpi : 0
  return p
}

/* ---------- Stima del tempo per stage ---------- */

/** Capienza indicativa del caricatore per divisione (pistola 9 mm). */
export const CAPIENZA: Record<Divisione, number> = {
  Production: 15,
  'Production Optics': 15,
  Standard: 20,
  Open: 27,
  Classic: 10,
  Revolver: 8,
  Optics: 20,
  PCC: 30,
}

/** Percentuale indicativa dei punti ottenuti per classe. */
export const PERC_PUNTI: Record<Classe, number> = {
  D: 0.72, C: 0.78, B: 0.83, A: 0.87, Master: 0.91, 'Grand Master': 0.94,
}

/** Spostamenti medi stimati, senza conoscere il disegno. */
const SPOSTAMENTI = { Short: { n: 0, m: 0 }, Medium: { n: 2, m: 4 }, Long: { n: 3, m: 5.5 } }

export interface StimaStage {
  totale: number
  partenza: number
  tiro: number
  ricariche: number
  nRicariche: number
  movimento: number
  spostamenti: number
  attese: number
  hitFactor: number
  puntiAttesi: number
}

export function stimaStage(s: StageLetto, profilo: Pick<Profilo, 'divisione' | 'classe' | 'tempi'>): StimaStage {
  const t: TempiPersonali = profilo.tempi
  const trans = s.tipo === 'Short' ? t.transizioneVicina : s.tipo === 'Medium' ? (t.transizioneVicina + t.transizioneLontana) / 2 : t.transizioneLontana

  // partenza
  let partenza = t.estrazione
  if (s.flag.armaSuTavolo) partenza += 0.35
  if (s.flag.armaScarica) partenza += 0.9 // inserire il caricatore e camerare
  else if (s.flag.colpoNonCamerato) partenza += 0.5
  if (s.flag.partenzaGirato) partenza += 0.45
  if (s.flag.seduto) partenza += 0.4

  // tiro: carta 2 colpi (secondo colpo = split), metallo 1 colpo con un po' più di mira
  const nCarta = carte(s)
  const nMetallo = metalli(s)
  const bersagli = nCarta + nMetallo
  const extraMetallo = Math.max(0, t.colpoPiastra - t.split)
  let tiro = nCarta * t.split + nMetallo * extraMetallo + Math.max(0, bersagli - 1) * trans
  const mano = s.flag.manoForte || s.flag.manoDebole
  if (mano) tiro *= s.flag.manoDebole ? 1.45 : 1.25

  // ricariche
  const cap = CAPIENZA[profilo.divisione] ?? 15
  let nRicariche = Math.max(0, Math.ceil(s.colpi / cap) - 1)
  if (s.flag.ricaricaObbligatoria) nRicariche = Math.max(1, nRicariche)
  // con stage lunghi conviene una ricarica di sicurezza in movimento
  if (s.tipo === 'Long' && nRicariche === 1 && s.colpi > cap * 0.8) nRicariche = 2
  const ricariche = nRicariche * Math.max(0, t.ricarica - t.split * 0.5)

  // movimento
  const mv = SPOSTAMENTI[s.tipo]
  const movimento = mv.n * (t.uscitaPosizione + mv.m / t.velocitaMovimento + t.entrataPosizione)

  // attese per bersagli attivati
  const attese = s.flag.mobili ? Math.min(1.2, 0.4 * Math.max(1, s.attivazioni.length)) : 0

  const totale = partenza + tiro + ricariche + movimento + attese
  const puntiAttesi = s.puntiMax * (PERC_PUNTI[profilo.classe] ?? 0.85)
  return {
    totale, partenza, tiro, ricariche, nRicariche, movimento, spostamenti: mv.n, attese,
    hitFactor: totale > 0 ? puntiAttesi / totale : 0, puntiAttesi,
  }
}

/* ---------- Priorità di allenamento ---------- */

export interface Focus {
  id: string
  titolo: string
  perche: string
  drill: string[]
  peso: number // 0-100
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export function focusAllenamento(stages: StageLetto[], pg: ProfiloGara = profiloGara(stages)): Focus[] {
  const f: Focus[] = []
  const tot = Math.max(1, pg.stage)

  if (pg.colpiMetallo > 0) {
    f.push({
      id: 'metallo',
      titolo: 'Transizioni carta–metallo',
      perche: `${pg.colpiMetallo} colpi su metallo (${pct(pg.quotaMetallo)} del totale), ${pg.miniPopper} mini popper.`,
      drill: ['Due carte e un mini popper a 10–15 m: cambio di ritmo tra doppietta e colpo singolo', 'Plate rack o 4 piastre in fila, tempo sotto 3 s', 'Mini popper a 15 m: colpo singolo dal pronto'],
      peso: Math.min(100, 30 + pg.quotaMetallo * 250 + pg.miniPopper * 1.5),
    })
  }
  if (pg.noShoot > 0) {
    f.push({
      id: 'noshoot',
      titolo: 'Precisione vicino ai no-shoot',
      perche: `${pg.noShoot} no-shoot in ${pg.stageConNoShoot} stage su ${tot}.`,
      drill: ['Bersagli parzialmente coperti a 10 m: solo zone A', 'Teste coperte a 7 m dopo un movimento', 'Doppiette rallentate: accettare il tempo, non il rischio'],
      peso: Math.min(100, 25 + (pg.noShoot / tot) * 35),
    })
  }
  if (pg.stageMovimento > 0) {
    f.push({
      id: 'movimento',
      titolo: 'Ingressi, uscite e movimento',
      perche: `${pg.perTipo.Medium} medium e ${pg.perTipo.Long} long: ${pct(pg.stageMovimento / tot)} degli stage richiede spostamenti.`,
      drill: ['Ingresso in box con primo colpo sotto 1 s dall’arresto', 'Uscita: primo passo mentre parte l’ultimo colpo', 'Tiro in movimento su bersagli larghi a 5–7 m'],
      peso: Math.min(100, 20 + (pg.stageMovimento / tot) * 60),
    })
  }
  if (pg.perTipo.Long > 0 || pg.colpi / tot > 20) {
    f.push({
      id: 'ricariche',
      titolo: 'Ricariche in movimento',
      perche: `${pg.perTipo.Long} stage long: ricariche da pianificare tra le posizioni.`,
      drill: ['Ricarica camminando tra due box a 5 m', 'Ricarica di sicurezza dopo 12–15 colpi', 'In bianco: 50 ricariche lente, 50 a ritmo gara'],
      peso: Math.min(100, 15 + pg.perTipo.Long * 15),
    })
  }
  if (pg.stageMobili > 0) {
    f.push({
      id: 'mobili',
      titolo: 'Bersagli attivati e mobili',
      perche: `${pg.stageMobili} stage su ${tot} hanno attivazioni o bersagli mobili.`,
      drill: ['Attivare con il popper e ingaggiare subito altri bersagli', 'Contare i tempi del mover in allenamento', 'Decidere prima: aspettare o tornare dopo'],
      peso: Math.min(100, 15 + (pg.stageMobili / tot) * 45),
    })
  }
  if (pg.stageManoForte + pg.stageManoDebole > 0) {
    f.push({
      id: 'mano',
      titolo: 'Mano forte e mano debole',
      perche: `${pg.stageManoForte} stage a mano forte, ${pg.stageManoDebole} a mano debole.`,
      drill: ['6 colpi a mano forte su 3 bersagli a 7 m', 'Passaggio di mano dopo l’estrazione (mano debole)', 'In bianco: impugnatura a una mano, 10 min a sessione'],
      peso: 35 + (pg.stageManoForte + pg.stageManoDebole) * 12,
    })
  }
  if (pg.partenzeSpeciali > 0) {
    f.push({
      id: 'partenze',
      titolo: 'Partenze particolari',
      perche: `${pg.partenzeSpeciali} stage con partenza non standard (arma sul tavolo, scarica, colpo non camerato, girati o seduti).`,
      drill: ['Presa dal tavolo e primo colpo', 'Caricatore e cameratura sotto il timer', 'Giro e estrazione a 180°'],
      peso: 20 + pg.partenzeSpeciali * 8,
    })
  }
  if (pg.perTipo.Short > 0) {
    f.push({
      id: 'short',
      titolo: 'Velocità pura su short',
      perche: `${pg.perTipo.Short} stage short: estrazione e split pesano di più.`,
      drill: ['Bill Drill', 'Estrazioni su bersaglio a 7 m', 'Blake Drill (3 bersagli, 2 colpi)'],
      peso: 15 + (pg.perTipo.Short / tot) * 40,
    })
  }
  return f.sort((a, b) => b.peso - a.peso)
}

export const fmtS = (n: number) => `${n.toFixed(1).replace('.', ',')} s`
export const fmtHf = (n: number) => n.toFixed(2).replace('.', ',')
