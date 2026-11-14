import { apriPdf, estraiPagine } from '../analisi/estrai'
import type { PaginaPdf } from '../analisi/tipi'
import { leggiRisultati, tipoPdf, type LetturaRisultati } from './parser'
import { dataStampa } from './motore'

export interface LetturaFile { lettura: LetturaRisultati; data: string | null; scartati: string[] }

/** Legge uno o più PDF di risultati (Overall, Stage Results, Score Verification). */
export async function leggiFileRisultati(files: File[]): Promise<LetturaFile> {
  const tutte: PaginaPdf[][] = []
  const scartati: string[] = []
  let data: string | null = null
  for (const f of files) {
    const doc = await apriPdf(await f.arrayBuffer())
    const pagine = await estraiPagine(doc)
    await doc.loadingTask.destroy()
    if (!tipoPdf(pagine)) { scartati.push(f.name); continue }
    data ??= dataStampa(pagine[0].items.map((i) => i.str))
    tutte.push(pagine)
  }
  return { lettura: leggiRisultati(tutte), data, scartati }
}
