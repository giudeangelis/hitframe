import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Crosshair,
  FileSearch,
  Home,
  LayoutGrid,
  Package,
  Settings,
  Target,
  Timer,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface Modulo {
  path: string
  label: string
  descrizione: string
  icon: LucideIcon
  pronto: boolean
  fase?: number
  dettagli?: string[]
}

/** Nella barra in basso del telefono (più "Altro"). */
export const MODULI_PRINCIPALI: Modulo[] = [
  { path: '/', label: 'Home', descrizione: 'Panoramica', icon: Home, pronto: true },
  { path: '/calendario', label: 'Calendario', descrizione: 'Allenamenti e gare', icon: CalendarDays, pronto: true },
  { path: '/allenamento', label: 'Allenamento', descrizione: 'Drill, prove, progressi', icon: Target, pronto: true },
  { path: '/timer', label: 'Timer', descrizione: 'Shot timer e par time', icon: Timer, pronto: true },
]

export const MODULI_FUTURI: Modulo[] = [
  {
    path: '/munizioni', label: 'Munizioni', descrizione: 'Ricette, lotti, power factor', icon: Package, pronto: false, fase: 3,
    dettagli: ['Ricette di ricarica e lotti', 'Calcolatore power factor con soglie per divisione', 'Magazzino componenti e costo per colpo'],
  },
  {
    path: '/attrezzatura', label: 'Attrezzatura', descrizione: 'Armi, canne, manutenzione', icon: Wrench, pronto: false, fase: 3,
    dettagli: ['Conteggio colpi per arma, canna e molle', 'Avvisi di manutenzione', 'Storico interventi'],
  },
  {
    path: '/stage-designer', label: 'Stage Designer', descrizione: 'Progetta stage di allenamento', icon: Crosshair, pronto: false, fase: 4,
    dettagli: ['Bersagli, piastre, ostacoli e fault line', 'Simulatore con tempo ideale dal tuo profilo', 'Export PDF'],
  },
  {
    path: '/statistiche', label: 'Statistiche', descrizione: 'Andamento e punti deboli', icon: BarChart3, pronto: false, fase: 5,
    dettagli: ['Andamento dei tempi personali', 'Radar delle abilità', 'Confronto con i risultati di gara'],
  },
]

/** Moduli pronti che non stanno nella barra in basso del telefono. */
export const MODULI_EXTRA: Modulo[] = [
  { path: '/diario', label: 'Diario', descrizione: 'Sessioni, sensazioni, note', icon: BookOpen, pronto: true },
  { path: '/profilo', label: 'Profilo', descrizione: 'Atleta, arma e tempi', icon: User, pronto: true },
  { path: '/analisi-gara', label: 'Analisi gara', descrizione: 'PDF di gara, profilo e priorità', icon: FileSearch, pronto: true },
]

export const MODULO_IMPOSTAZIONI: Modulo = {
  path: '/impostazioni', label: 'Impostazioni', descrizione: 'Backup e dati', icon: Settings, pronto: true,
}

export const MODULO_ALTRO: Modulo = {
  path: '/moduli', label: 'Altro', descrizione: 'Tutti i moduli', icon: LayoutGrid, pronto: true,
}
