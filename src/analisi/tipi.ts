/** Testo estratto da una pagina PDF, coordinate in punti PDF (origine in basso a sinistra). */
export interface TestoPdf {
  str: string
  x: number
  y: number
  h: number
}

export interface PaginaPdf {
  numero: number // 1-based
  larghezza: number
  altezza: number
  items: TestoPdf[]
}

export type TipoCorso = 'Short' | 'Medium' | 'Long'

export interface BersagliStage {
  carta: number
  miniCarta: number
  popper: number
  miniPopper: number
  piastre: number
  noShoot: number
}

export interface StageLetto {
  numero: number
  pagina: number
  lingua: 'it' | 'en'
  tipo: TipoCorso
  colpi: number
  puntiMax: number
  segnalePartenza: string
  bersagli: BersagliStage
  posizionePartenza: string
  prontoTiratore: string
  prontoArma: string
  procedura: string
  note: string
  etichetteDisegno: string[]
  /** limite superiore della tabella, in punti PDF: sopra c'è il disegno */
  tabellaTopY: number
  /** libretti da club: il disegno sta sotto l'intestazione, fino a questa y (punti PDF) */
  disegnoTopY?: number
  flag: FlagStage
  attivazioni: string[]
}

export interface FlagStage {
  manoForte: boolean
  manoDebole: boolean
  mobili: boolean // bersagli mobili o attivati
  armaSuTavolo: boolean
  armaScarica: boolean // caricatore non inserito / arma scarica
  colpoNonCamerato: boolean
  partenzaGirato: boolean
  seduto: boolean
  ricaricaObbligatoria: boolean
  partenzaLibera: boolean
}

export interface InfoGara {
  nome: string
  campo: string
  date: string
  tipoEvento: string
  livello: string
  matchDirector: string
  esercizi: number | null
  colpi: number | null
  punti: number | null
}

export interface SezioneGara {
  etichetta: string // es. "Handgun", "PCC"
  info: InfoGara
  stages: StageLetto[]
  avvisi: string[]
}

export interface GaraLetta {
  sezioni: SezioneGara[]
  avvisi: string[]
  pagineTotali: number
}
