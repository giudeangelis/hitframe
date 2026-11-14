import Dexie, { type EntityTable } from 'dexie'
import type { AnalisiGara, Evento, Impostazione, Profilo, VoceDiario } from './types'
import { TEMPI_DEFAULT } from './types'

export class HitframeDB extends Dexie {
  profilo!: EntityTable<Profilo, 'id'>
  eventi!: EntityTable<Evento, 'id'>
  diario!: EntityTable<VoceDiario, 'id'>
  impostazioni!: EntityTable<Impostazione, 'chiave'>
  analisi!: EntityTable<AnalisiGara, 'id'>

  constructor() {
    super('hitframe')
    // Versione 1 dello schema. Nuovi moduli = nuove versioni, mai modifiche distruttive.
    this.version(1).stores({
      profilo: 'id',
      eventi: '++id, data, tipo, completato',
      diario: '++id, data, eventoId, *tag',
      impostazioni: 'chiave',
    })
    // v2: analisi dei PDF di gara
    this.version(2).stores({
      analisi: '++id, creato, eventoId',
    })
  }
}

export const db = new HitframeDB()

export const nowIso = () => new Date().toISOString()

export function profiloVuoto(): Profilo {
  return {
    id: 'me',
    nome: '',
    divisione: 'Production',
    classe: 'C',
    categoria: 'Nessuna',
    club: '',
    arma: '',
    manoForte: 'destra',
    tempi: { ...TEMPI_DEFAULT },
    aggiornato: nowIso(),
  }
}

export async function getProfilo(): Promise<Profilo> {
  return (await db.profilo.get('me')) ?? profiloVuoto()
}
