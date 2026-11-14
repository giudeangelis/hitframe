/**
 * Mappa di uno stage disegnata sopra il disegno del PDF: partenza, posizioni di tiro,
 * bersagli con distanza stimata, visibilità e attivazioni. Coordinate normalizzate 0–1.
 */
import { chiedi, estraiJson, getConfigAI, ErroreAI } from '../ai/ai'
import type { StageLetto } from './tipi'
import { apriPdf, disegnaStage } from './estrai'

export type TipoBersaglio = 'carta' | 'mini' | 'popper' | 'miniPopper' | 'piastra' | 'noshoot'

export const TIPI_BERSAGLIO: Record<TipoBersaglio, { nome: string; colpi: number; metallo: boolean }> = {
  carta: { nome: 'Carta', colpi: 2, metallo: false },
  mini: { nome: 'Mini carta', colpi: 2, metallo: false },
  popper: { nome: 'Popper', colpi: 1, metallo: true },
  miniPopper: { nome: 'Mini popper', colpi: 1, metallo: true },
  piastra: { nome: 'Piastra', colpi: 1, metallo: true },
  noshoot: { nome: 'No-shoot', colpi: 0, metallo: false },
}

export interface Punto { id: string; x: number; y: number }
export interface BersaglioMappa extends Punto {
  tipo: TipoBersaglio
  distanza: number // metri dalla posizione più vicina da cui si ingaggia
  parziale: boolean // coperto da no-shoot o da ostacoli
  mobile: boolean
  attiva: string[] // bersagli attivati da questo (es. popper che attiva uno swinger)
}
export interface PosizioneMappa extends Punto {
  nota: string
  vede: string[]
}
export interface MappaStage {
  partenza: Punto & { nota: string }
  posizioni: PosizioneMappa[]
  bersagli: BersaglioMappa[]
  larghezzaM: number // larghezza del campo rappresentata dal disegno
  profonditaM: number
  fonte: 'ai' | 'manuale'
  lettura?: string
  aggiornata: string
}

export const chiaveMappa = (sezione: number, numero: number) => `${sezione}-${numero}`

export function mappaVuota(): MappaStage {
  return {
    partenza: { id: 'S', x: 0.5, y: 0.88, nota: '' },
    posizioni: [],
    bersagli: [],
    larghezzaM: 20,
    profonditaM: 15,
    fonte: 'manuale',
    aggiornata: new Date().toISOString(),
  }
}

const clamp = (v: unknown, a = 0, b = 1, def = 0.5) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : def
}

/** Distanza in metri sul terreno tra due punti della mappa. */
export function metri(m: MappaStage, a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot((a.x - b.x) * m.larghezzaM, (a.y - b.y) * m.profonditaM)
}

/** Pulisce e completa una mappa (anche quella arrivata dall'AI). */
export function normalizza(raw: Partial<MappaStage> & Record<string, unknown>, fonte: 'ai' | 'manuale'): MappaStage {
  const tipi = Object.keys(TIPI_BERSAGLIO) as TipoBersaglio[]
  const idsB = new Set<string>()
  const bersagli: BersaglioMappa[] = (Array.isArray(raw.bersagli) ? raw.bersagli : []).map((b: Partial<BersaglioMappa>, i: number) => {
    let id = String(b.id ?? `T${i + 1}`).toUpperCase().replace(/\s+/g, '')
    while (idsB.has(id)) id = `${id}b`
    idsB.add(id)
    return {
      id,
      tipo: tipi.includes(b.tipo as TipoBersaglio) ? (b.tipo as TipoBersaglio) : 'carta',
      x: clamp(b.x), y: clamp(b.y),
      distanza: clamp(b.distanza, 3, 25, 8),
      parziale: !!b.parziale,
      mobile: !!b.mobile,
      attiva: Array.isArray(b.attiva) ? b.attiva.map((x) => String(x).toUpperCase()) : [],
    }
  })
  for (const b of bersagli) b.attiva = b.attiva.filter((x) => idsB.has(x) && x !== b.id)
  const posizioni: PosizioneMappa[] = (Array.isArray(raw.posizioni) ? raw.posizioni : []).map((p: Partial<PosizioneMappa>, i: number) => ({
    id: `P${i + 1}`,
    x: clamp(p.x), y: clamp(p.y),
    nota: String(p.nota ?? ''),
    vede: (Array.isArray(p.vede) ? p.vede : []).map((x) => String(x).toUpperCase()).filter((x) => idsB.has(x)),
  }))
  const pa = (raw.partenza ?? {}) as Partial<Punto & { nota: string }>
  return {
    partenza: { id: 'S', x: clamp(pa.x, 0, 1, 0.5), y: clamp(pa.y, 0, 1, 0.88), nota: String(pa.nota ?? '') },
    posizioni,
    bersagli,
    larghezzaM: clamp(raw.larghezzaM, 6, 60, 20),
    profonditaM: clamp(raw.profonditaM, 4, 40, 15),
    fonte,
    lettura: typeof raw.lettura === 'string' ? raw.lettura : undefined,
    aggiornata: new Date().toISOString(),
  }
}

/* ---------- Immagine del disegno ---------- */

const cacheImg = new Map<string, Promise<{ url: string; w: number; h: number }>>()

/** Il disegno dello stage come immagine JPEG (per l'editor e per l'AI). */
export function immagineDisegno(chiave: string, pdf: Blob, pagina: number, tagliaY: number, larghezza = 1200) {
  const k = `${chiave}|${pagina}|${larghezza}`
  let p = cacheImg.get(k)
  if (!p) {
    p = (async () => {
      const doc = await apriPdf(await pdf.arrayBuffer())
      const canvas = document.createElement('canvas')
      // disegnaStage tiene conto del devicePixelRatio: qui vogliamo pixel esatti
      const dpr = window.devicePixelRatio || 1
      await disegnaStage(doc, pagina, canvas, larghezza / Math.min(dpr, 2), tagliaY)
      const url = canvas.toDataURL('image/jpeg', 0.85)
      await doc.loadingTask.destroy()
      return { url, w: canvas.width, h: canvas.height }
    })()
    cacheImg.set(k, p)
    p.catch(() => cacheImg.delete(k))
  }
  return p
}

/* ---------- Proposta dell'AI ---------- */

const SISTEMA = `Sei un tiratore IPSC di livello Grand Master e Range Officer esperto. Leggi disegni di stage IPSC (prospettiva 3D tipo
FITDS) e ne ricavi una mappa tecnica. Nelle gare FITDS i bersagli stanno tra 3 e 20 metri dal tiratore.
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo.`

export async function proponiMappaAI(img: { url: string }, s: StageLetto): Promise<MappaStage> {
  const cfg = await getConfigAI()
  if (!cfg?.chiave) throw new ErroreAI('Collega un assistente AI in Impostazioni.')
  const b = s.bersagli
  const testo = `Dati letti dal briefing dello stage ${s.numero}:
- Tipo: ${s.tipo} course, colpi minimi ${s.colpi}, punti ${s.puntiMax}
- Bersagli: ${b.carta} carta, ${b.miniCarta} mini carta, ${b.popper} popper, ${b.miniPopper} mini popper, ${b.piastre} piastre, ${b.noShoot} no-shoot
- Etichette visibili nel disegno: ${s.etichetteDisegno.join(' ') || 'non lette'}
- Posizione di partenza: ${s.posizionePartenza}
- Condizione di pronto: ${s.prontoTiratore} / ${s.prontoArma}
- Procedura: ${s.procedura}
- Note: ${s.note}

Analizza l'immagine del disegno e restituisci questo JSON:
{
  "lettura": "2-3 frasi: come è fatto lo stage, ripari, aree di tiro, insidie",
  "larghezzaM": numero (metri di larghezza del campo rappresentati nell'immagine),
  "profonditaM": numero (metri di profondità dal fondo dei bersagli alla zona di partenza),
  "partenza": {"x": 0-1, "y": 0-1, "nota": "dove e come si parte"},
  "posizioni": [{"x": 0-1, "y": 0-1, "nota": "es. box sinistro, finestra, porta", "vede": ["T1","T2"]}],
  "bersagli": [{"id": "T1", "tipo": "carta|mini|popper|miniPopper|piastra|noshoot", "x": 0-1, "y": 0-1,
                "distanza": metri dalla posizione più vicina da cui si ingaggia (3-20),
                "parziale": true se coperto in parte da no-shoot o ostacoli, "mobile": true se si muove,
                "attiva": ["id dei bersagli che attiva, se è un attivatore"]}]
}
Regole:
- x,y sono coordinate normalizzate sull'immagine fornita: (0,0) in alto a sinistra, (1,1) in basso a destra. Per i bersagli usa il punto centrale; per le posizioni il punto a terra dove sta il tiratore.
- Usa gli id del disegno se leggibili (T1, PP1, MP1, PL1, NS1...); altrimenti numerali da sinistra a destra.
- Il numero di bersagli per tipo deve corrispondere ai dati del briefing.
- Le posizioni sono i punti utili da cui sparare (aree delimitate da fault line, finestre, porte, angoli dei ripari). Includi la zona di partenza come posizione se da lì si vedono bersagli.
- "vede" elenca solo i bersagli realmente ingaggiabili da quella posizione, tenendo conto di pareti e ripari.`
  const risposta = await chiedi(cfg, {
    sistema: SISTEMA,
    testo,
    immagine: { mime: 'image/jpeg', base64: img.url.split(',')[1] },
    maxToken: 4000,
  })
  const m = normalizza(estraiJson(risposta), 'ai')
  if (!m.bersagli.length) throw new ErroreAI('L’AI non ha trovato bersagli nel disegno. Prova a mappare a mano.')
  return m
}
