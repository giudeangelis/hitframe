/**
 * Libreria dei drill. Gli obiettivi per classe sono indicativi (tempo pulito, tutte A o quasi),
 * pensati per IPSC Handgun e modificabili con un obiettivo personale.
 */
import type { Classe, TempiPersonali } from '../db/types'

export const CATEGORIE_DRILL = [
  'Estrazione', 'Split', 'Transizioni', 'Ricariche', 'Movimento', 'Metallo', 'Precisione', 'Mano forte/debole', 'Partenze',
] as const
export type CategoriaDrill = (typeof CATEGORIE_DRILL)[number]

export type ClasseObiettivo = 'GM' | 'M' | 'A' | 'B' | 'C'

/** Come ricavare un tempo tecnico dai colpi registrati dal timer (indici: intervallo che termina al colpo i). */
export interface Misura {
  tempo: keyof TempiPersonali
  calcolo: 'primo' | 'intervalli'
  indici?: number[] // per 'intervalli': colpo i (0-based) meno colpo i-1; vuoto = tutti
}

export interface Drill {
  id: string
  nome: string
  categoria: CategoriaDrill
  modalita: 'fuoco' | 'bianco'
  descrizione: string
  distanza: string
  bersagli: string
  colpi: number // colpi a fuoco (o "azioni" in bianco)
  partenza: string
  obiettivi: Record<ClasseObiettivo, number> // secondi
  focus: string[] // id delle priorità di gara (motore.ts) che allena
  misure?: Misura[]
  personale?: boolean
}

const o = (GM: number, M: number, A: number, B: number, C: number) => ({ GM, M, A, B, C })

export const DRILLS: Drill[] = [
  // ---------- A fuoco ----------
  {
    id: 'estrazione', nome: 'Estrazione', categoria: 'Estrazione', modalita: 'fuoco',
    descrizione: 'Dal beep, estrazione e un colpo in zona A. Misura pura dell’estrazione.',
    distanza: '7 m', bersagli: '1 bersaglio IPSC', colpi: 1, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(0.85, 0.95, 1.1, 1.3, 1.5), focus: ['short', 'partenze'],
    misure: [{ tempo: 'estrazione', calcolo: 'primo' }],
  },
  {
    id: 'bill', nome: 'Bill Drill', categoria: 'Split', modalita: 'fuoco',
    descrizione: 'Estrazione e 6 colpi sullo stesso bersaglio. Tutte A: il ritmo si regola sull’immagine delle mire.',
    distanza: '7 m', bersagli: '1 bersaglio IPSC', colpi: 6, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(1.8, 2.1, 2.5, 3.0, 3.5), focus: ['short'],
    misure: [{ tempo: 'estrazione', calcolo: 'primo' }, { tempo: 'split', calcolo: 'intervalli' }],
  },
  {
    id: 'doppiette', nome: 'Estrazione e doppietta', categoria: 'Split', modalita: 'fuoco',
    descrizione: 'Estrazione e due colpi in A. Il secondo colpo parte appena il punto rientra.',
    distanza: '7 m', bersagli: '1 bersaglio IPSC', colpi: 2, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(1.1, 1.25, 1.45, 1.7, 2.0), focus: ['short'],
    misure: [{ tempo: 'estrazione', calcolo: 'primo' }, { tempo: 'split', calcolo: 'intervalli' }],
  },
  {
    id: 'blake', nome: 'Blake Drill', categoria: 'Transizioni', modalita: 'fuoco',
    descrizione: 'Tre bersagli a 1 m l’uno dall’altro, due colpi ciascuno. Gli occhi arrivano prima dell’arma.',
    distanza: '7 m', bersagli: '3 bersagli IPSC a 1 m', colpi: 6, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(2.0, 2.3, 2.7, 3.2, 3.8), focus: ['short', 'metallo'],
    misure: [{ tempo: 'estrazione', calcolo: 'primo' }, { tempo: 'transizioneVicina', calcolo: 'intervalli', indici: [2, 4] }, { tempo: 'split', calcolo: 'intervalli', indici: [1, 3, 5] }],
  },
  {
    id: 'presidente', nome: 'El Presidente', categoria: 'Ricariche', modalita: 'fuoco',
    descrizione: 'Spalle ai bersagli. Al beep giro, due colpi su ciascuno dei tre bersagli, ricarica, di nuovo due colpi ciascuno.',
    distanza: '10 m', bersagli: '3 bersagli IPSC a 1 m', colpi: 12, partenza: 'Spalle ai bersagli, mani sopra le spalle',
    obiettivi: o(5.0, 5.8, 6.8, 8.0, 9.5), focus: ['ricariche', 'partenze'],
    misure: [{ tempo: 'ricarica', calcolo: 'intervalli', indici: [6] }],
  },
  {
    id: 'ricarica', nome: 'Ricarica 2-R-2', categoria: 'Ricariche', modalita: 'fuoco',
    descrizione: 'Due colpi, ricarica, due colpi sullo stesso bersaglio. Con un solo colpo nel primo caricatore la ricarica è a carrello aperto.',
    distanza: '7 m', bersagli: '1 bersaglio IPSC', colpi: 4, partenza: 'Pronto, arma puntata in basso',
    obiettivi: o(2.2, 2.5, 2.9, 3.4, 4.0), focus: ['ricariche'],
    misure: [{ tempo: 'ricarica', calcolo: 'intervalli', indici: [2] }],
  },
  {
    id: 'accelerator', nome: 'Accelerator', categoria: 'Transizioni', modalita: 'fuoco',
    descrizione: 'Tre bersagli a 7, 15 e 25 m, due colpi ciascuno. Allena il cambio di ritmo con la distanza.',
    distanza: '7 / 15 / 25 m', bersagli: '3 bersagli IPSC', colpi: 6, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(3.0, 3.5, 4.2, 5.0, 6.0), focus: ['noshoot', 'metallo'],
    misure: [{ tempo: 'transizioneLontana', calcolo: 'intervalli', indici: [2, 4] }],
  },
  {
    id: 'carta-metallo', nome: 'Carta–metallo', categoria: 'Metallo', modalita: 'fuoco',
    descrizione: 'Due carte (due colpi ciascuna) e un mini popper a 15 m. Doppietta veloce, poi colpo singolo preciso.',
    distanza: '7 m carta · 15 m popper', bersagli: '2 IPSC + 1 mini popper', colpi: 5, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(2.2, 2.6, 3.1, 3.7, 4.4), focus: ['metallo', 'mobili'],
    misure: [{ tempo: 'colpoPiastra', calcolo: 'intervalli', indici: [4] }],
  },
  {
    id: 'piastre', nome: 'Sei piastre', categoria: 'Metallo', modalita: 'fuoco',
    descrizione: 'Plate rack o sei piastre in fila. Un colpo ciascuna, il punto si ferma sulla piastra prima di premere.',
    distanza: '10 m', bersagli: '6 piastre da 20 cm', colpi: 6, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(2.8, 3.3, 4.0, 4.8, 5.8), focus: ['metallo'],
    misure: [{ tempo: 'colpoPiastra', calcolo: 'intervalli' }],
  },
  {
    id: 'parziali', nome: 'Bersagli parzialmente coperti', categoria: 'Precisione', modalita: 'fuoco',
    descrizione: 'Due bersagli coperti a metà da no-shoot, due colpi ciascuno. Solo A: penalità zero.',
    distanza: '10 m', bersagli: '2 IPSC con no-shoot', colpi: 4, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(2.2, 2.6, 3.0, 3.6, 4.3), focus: ['noshoot'],
  },
  {
    id: 'teste', nome: 'Teste a 7 m', categoria: 'Precisione', modalita: 'fuoco',
    descrizione: 'Due colpi nella testa di due bersagli. Allena la precisione sotto il timer.',
    distanza: '7 m', bersagli: '2 IPSC (solo testa)', colpi: 4, partenza: 'Mani in resa, arma in fondina',
    obiettivi: o(2.4, 2.8, 3.3, 3.9, 4.6), focus: ['noshoot'],
  },
  {
    id: 'ingresso', nome: 'Ingresso in posizione', categoria: 'Movimento', modalita: 'fuoco',
    descrizione: 'Partenza 4 m fuori dal box. Entra e ingaggia due bersagli, due colpi ciascuno, appena i piedi sono dentro.',
    distanza: '7 m dal box', bersagli: '2 IPSC', colpi: 4, partenza: 'Fuori dal box, mani in resa',
    obiettivi: o(2.5, 2.9, 3.4, 4.0, 4.8), focus: ['movimento'],
  },
  {
    id: 'box-box', nome: 'Box to box', categoria: 'Movimento', modalita: 'fuoco',
    descrizione: 'Due colpi su T1, spostamento di 5 m, due colpi su T2. Il primo passo parte con l’ultimo colpo.',
    distanza: '7 m', bersagli: '2 IPSC visibili da box diversi', colpi: 4, partenza: 'Nel primo box, mani in resa',
    obiettivi: o(3.2, 3.7, 4.3, 5.0, 6.0), focus: ['movimento', 'ricariche'],
  },
  {
    id: 'movimento', nome: 'Tiro in movimento', categoria: 'Movimento', modalita: 'fuoco',
    descrizione: 'Camminando lungo una linea di 6 m, due colpi su ciascuno dei quattro bersagli larghi.',
    distanza: '5–7 m', bersagli: '4 IPSC', colpi: 8, partenza: 'Inizio linea, mani in resa',
    obiettivi: o(3.6, 4.2, 5.0, 6.0, 7.2), focus: ['movimento'],
  },
  {
    id: 'mano-forte', nome: 'Mano forte', categoria: 'Mano forte/debole', modalita: 'fuoco',
    descrizione: 'Solo mano forte, due colpi su ciascuno di tre bersagli a 1 m.',
    distanza: '7 m', bersagli: '3 IPSC a 1 m', colpi: 6, partenza: 'Pronto, arma puntata in basso',
    obiettivi: o(3.0, 3.5, 4.2, 5.0, 6.0), focus: ['mano'],
  },
  {
    id: 'mano-debole', nome: 'Mano debole', categoria: 'Mano forte/debole', modalita: 'fuoco',
    descrizione: 'Arma sul tavolo o passaggio di mano. Due colpi su ciascuno di due bersagli, solo mano debole.',
    distanza: '7 m', bersagli: '2 IPSC', colpi: 4, partenza: 'Arma sul tavolo, mani sui segni',
    obiettivi: o(3.5, 4.2, 5.0, 6.0, 7.0), focus: ['mano'],
  },
  {
    id: 'tavolo', nome: 'Arma dal tavolo', categoria: 'Partenze', modalita: 'fuoco',
    descrizione: 'Arma carica sul tavolo. Presa, due colpi su un bersaglio.',
    distanza: '7 m', bersagli: '1 IPSC', colpi: 2, partenza: 'Mani sui segni, arma sul tavolo',
    obiettivi: o(1.4, 1.6, 1.9, 2.2, 2.6), focus: ['partenze'],
  },
  {
    id: 'scarica', nome: 'Arma scarica', categoria: 'Partenze', modalita: 'fuoco',
    descrizione: 'Arma scarica sul tavolo, caricatore accanto. Inserimento, cameratura e due colpi.',
    distanza: '7 m', bersagli: '1 IPSC', colpi: 2, partenza: 'Mani sui segni',
    obiettivi: o(2.0, 2.3, 2.7, 3.1, 3.6), focus: ['partenze'],
  },
  {
    id: 'giro', nome: 'Giro a 180°', categoria: 'Partenze', modalita: 'fuoco',
    descrizione: 'Spalle ai bersagli. Giro, estrazione e due colpi.',
    distanza: '7 m', bersagli: '1 IPSC', colpi: 2, partenza: 'Spalle ai bersagli, mani in resa',
    obiettivi: o(1.5, 1.7, 2.0, 2.3, 2.7), focus: ['partenze'],
  },
  // ---------- In bianco (par time) ----------
  {
    id: 'b-estrazione', nome: 'Estrazione in bianco', categoria: 'Estrazione', modalita: 'bianco',
    descrizione: 'Al beep estrazione e scatto pulito prima del secondo beep. Abbassa il par di 0,05 s quando riesci 10 volte su 10.',
    distanza: '3–7 m (bersaglio in scala)', bersagli: '1 bersaglio ridotto', colpi: 1, partenza: 'Mani in resa',
    obiettivi: o(0.7, 0.8, 0.95, 1.1, 1.3), focus: ['short', 'partenze'],
  },
  {
    id: 'b-ricarica', nome: 'Ricarica in bianco', categoria: 'Ricariche', modalita: 'bianco',
    descrizione: 'Dal pronto, ricarica e mire sul bersaglio prima del par. Caricatori zavorrati.',
    distanza: '—', bersagli: '1 bersaglio ridotto', colpi: 1, partenza: 'Arma puntata, carrello in chiusura',
    obiettivi: o(0.8, 0.9, 1.05, 1.25, 1.5), focus: ['ricariche'],
  },
  {
    id: 'b-transizioni', nome: 'Transizioni in bianco', categoria: 'Transizioni', modalita: 'bianco',
    descrizione: 'Tre bersagli: uno scatto ciascuno. Gli occhi si spostano per primi, l’arma segue.',
    distanza: 'Parete di casa', bersagli: '3 bersagli ridotti', colpi: 3, partenza: 'Mani in resa',
    obiettivi: o(1.2, 1.4, 1.6, 1.9, 2.2), focus: ['short', 'metallo', 'noshoot'],
  },
  {
    id: 'b-ingressi', nome: 'Ingressi in bianco', categoria: 'Movimento', modalita: 'bianco',
    descrizione: 'Due passi verso la posizione, mire sul bersaglio e scatto appena i piedi si fermano.',
    distanza: 'Stanza', bersagli: '2 bersagli ridotti', colpi: 2, partenza: 'Fuori dalla posizione',
    obiettivi: o(1.5, 1.7, 2.0, 2.4, 2.8), focus: ['movimento'],
  },
  {
    id: 'b-mano', nome: 'Una mano in bianco', categoria: 'Mano forte/debole', modalita: 'bianco',
    descrizione: 'Impugnatura a una mano, scatto pulito su due bersagli. Alterna mano forte e debole.',
    distanza: 'Parete di casa', bersagli: '2 bersagli ridotti', colpi: 2, partenza: 'Arma puntata in basso',
    obiettivi: o(1.4, 1.6, 1.9, 2.3, 2.7), focus: ['mano'],
  },
]

export const CLASSE_A_OBIETTIVO: Record<Classe, ClasseObiettivo> = {
  'Grand Master': 'GM', Master: 'M', A: 'A', B: 'B', C: 'C', D: 'C',
}

/** Obiettivo per la classe del tiratore (la D usa la C con un 15% in più). */
export function obiettivoPer(d: Drill, classe: Classe): number {
  const v = d.obiettivi[CLASSE_A_OBIETTIVO[classe]]
  return classe === 'D' ? v * 1.15 : v
}

/** Drill suggeriti per una priorità di gara. */
export function drillPerFocus(focusId: string, modalita?: 'fuoco' | 'bianco'): Drill[] {
  return DRILLS.filter((d) => d.focus.includes(focusId) && (!modalita || d.modalita === modalita))
}

/** Ricava i tempi tecnici dai colpi di una prova. */
export function misuraTempi(d: Drill, colpi: number[]): Partial<Record<keyof TempiPersonali, number>> {
  const out: Partial<Record<keyof TempiPersonali, number>> = {}
  if (!colpi.length) return out
  for (const m of d.misure ?? []) {
    if (m.calcolo === 'primo') out[m.tempo] = colpi[0]
    else {
      const idx = m.indici ?? colpi.map((_, i) => i).filter((i) => i > 0)
      const vals = idx.filter((i) => i > 0 && i < colpi.length).map((i) => colpi[i] - colpi[i - 1])
      if (vals.length) out[m.tempo] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
  }
  return out
}
