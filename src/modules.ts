import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Crosshair,
  FileSearch,
  Home,
  ListChecks,
  Medal,
  Package,
  Settings,
  Target,
  Timer,
  Trophy,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface Voce { path: string; label: string; icon: LucideIcon; descrizione?: string }

export interface Area extends Voce {
  id: 'oggi' | 'allenati' | 'gare' | 'progressi' | 'materiale'
  /** sezioni dell'area, mostrate come schede in alto */
  sezioni: Voce[]
  /** prefissi di percorso che appartengono all'area */
  prefissi: string[]
}

/** Le cinque aree della barra in basso: il ciclo del tiratore. */
export const AREE: Area[] = [
  { id: 'oggi', path: '/', label: 'Oggi', icon: Home, sezioni: [], prefissi: [] },
  {
    id: 'allenati', path: '/allenamento', label: 'Allenati', icon: Target,
    sezioni: [
      { path: '/allenamento', label: 'Drill', icon: Target },
      { path: '/sessioni', label: 'Sessioni', icon: ListChecks },
      { path: '/stage-designer', label: 'Stage', icon: Crosshair },
      { path: '/timer', label: 'Timer', icon: Timer },
    ],
    prefissi: ['/allenamento', '/sessioni', '/stage-designer', '/timer'],
  },
  {
    id: 'gare', path: '/gare', label: 'Gare', icon: Trophy,
    sezioni: [
      { path: '/gare', label: 'Le mie gare', icon: Trophy },
      { path: '/analisi-gara', label: 'Libretti', icon: FileSearch },
      { path: '/risultati', label: 'Risultati', icon: Medal },
    ],
    prefissi: ['/gare', '/analisi-gara', '/risultati'],
  },
  {
    id: 'progressi', path: '/statistiche', label: 'Progressi', icon: BarChart3,
    sezioni: [
      { path: '/statistiche', label: 'Statistiche', icon: BarChart3 },
      { path: '/profilo', label: 'Atleta e abilità', icon: User },
    ],
    prefissi: ['/statistiche', '/profilo'],
  },
  {
    id: 'materiale', path: '/attrezzatura', label: 'Materiale', icon: Wrench,
    sezioni: [
      { path: '/attrezzatura', label: 'Armi', icon: Wrench },
      { path: '/munizioni', label: 'Munizioni', icon: Package },
    ],
    prefissi: ['/attrezzatura', '/munizioni'],
  },
]

/** Sempre a portata di mano, in alto: cose personali e trasversali. */
export const STRUMENTI: Voce[] = [
  { path: '/calendario', label: 'Calendario', icon: CalendarDays },
  { path: '/diario', label: 'Diario', icon: BookOpen },
  { path: '/impostazioni', label: 'Impostazioni', icon: Settings },
]

export function areaDi(pathname: string): Area | undefined {
  if (pathname === '/') return AREE[0]
  return AREE.find((a) => a.prefissi.some((p) => pathname === p || pathname.startsWith(p + '/')))
}

/** Usato dalla pagina "in arrivo" per i moduli futuri. */
export interface Modulo { path: string; label: string; descrizione: string; icon: LucideIcon; pronto: boolean; fase?: number; dettagli?: string[] }
