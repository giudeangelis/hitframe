// Modello dati di Hitframe. Tutto vive sul dispositivo (IndexedDB).

export const DIVISIONI = [
  'Production',
  'Production Optics',
  'Standard',
  'Open',
  'Classic',
  'Revolver',
  'Optics',
  'PCC',
] as const
export type Divisione = (typeof DIVISIONI)[number]

export const CLASSI = ['D', 'C', 'B', 'A', 'Master', 'Grand Master'] as const
export type Classe = (typeof CLASSI)[number]

export const CATEGORIE = ['Nessuna', 'Lady', 'Junior', 'Senior', 'Super Senior', 'Grand Senior'] as const

/** Tempi personali: la base per tutti i calcoli di tempo ideale. Secondi, tranne velocità. */
export interface TempiPersonali {
  estrazione: number // dal beep al primo colpo, bersaglio a 7 m
  split: number // tra due colpi sullo stesso bersaglio
  transizioneVicina: number // bersagli vicini, < 1 m di distanza tra loro
  transizioneLontana: number // bersagli distanti / grande angolo
  ricarica: number // da ultimo colpo a primo colpo dopo il cambio caricatore
  entrataPosizione: number // dall'arrivo in posizione al primo colpo
  uscitaPosizione: number // dall'ultimo colpo al primo passo
  velocitaMovimento: number // metri al secondo, spostamento medio tra posizioni
  colpoPiastra: number // colpo singolo su metallo a media distanza
}

export interface Profilo {
  id: 'me'
  nome: string
  divisione: Divisione
  classe: Classe
  categoria: string
  club: string
  arma: string
  manoForte: 'destra' | 'sinistra'
  tempi: TempiPersonali
  aggiornato: string // ISO
}

export const TEMPI_DEFAULT: TempiPersonali = {
  estrazione: 1.1,
  split: 0.22,
  transizioneVicina: 0.3,
  transizioneLontana: 0.5,
  ricarica: 1.4,
  entrataPosizione: 0.6,
  uscitaPosizione: 0.4,
  velocitaMovimento: 2.5,
  colpoPiastra: 0.35,
}

export type TipoEvento = 'fuoco' | 'bianco' | 'gara' | 'altro'

export const TIPI_EVENTO: Record<TipoEvento, { label: string; breve: string }> = {
  fuoco: { label: 'Allenamento a fuoco', breve: 'Fuoco' },
  bianco: { label: 'Allenamento in bianco', breve: 'In bianco' },
  gara: { label: 'Gara', breve: 'Gara' },
  altro: { label: 'Altro', breve: 'Altro' },
}

export const LIVELLI_GARA = ['Level I', 'Level II', 'Level III', 'Level IV', 'Level V'] as const

export interface DettagliGara {
  livello: string
  organizzatore: string
  iscrizioneUrl: string
  scadenzaIscrizione: string // YYYY-MM-DD o ''
  iscritto: boolean
  numeroStage: number | null
  colpiTotali: number | null
}

export interface Evento {
  id?: number
  tipo: TipoEvento
  titolo: string
  data: string // YYYY-MM-DD
  dataFine: string // YYYY-MM-DD, = data se singolo giorno
  ora: string // HH:mm o ''
  durataMin: number | null
  luogo: string
  note: string
  colpiPianificati: number | null
  colpiSparati: number | null
  completato: boolean
  gara?: DettagliGara
  creato: string
}

export interface VoceDiario {
  id?: number
  data: string // YYYY-MM-DD
  titolo: string
  testo: string
  umore: number // 1-5
  energia: number // 1-5
  concentrazione: number // 1-5
  sonnoOre: number | null
  tag: string[]
  eventoId: number | null
  videoUrl: string
  creato: string
  aggiornato: string
}

export interface Impostazione {
  chiave: string
  valore: unknown
}

/** Analisi di un PDF di gara letta sul dispositivo. */
export interface AnalisiGara {
  id?: number
  creato: string
  nomeFile: string
  pdf: Blob | null // null dopo un ripristino da backup
  lettura: import('../analisi/tipi').GaraLetta
  sezione: number // libretto scelto (es. Handgun o PCC)
  eventoId: number | null
}
