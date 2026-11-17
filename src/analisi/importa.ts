import { db, getProfilo, nowIso } from '../db/db'
import { apriPdf, estraiPagine } from './estrai'
import { leggiGara } from './parser'
import { collegaSeSicuro } from './collega'

/** Legge un PDF di gara e lo salva tra le analisi. Restituisce l'id. */
export async function importaPdf(file: File, eventoId: number | null = null): Promise<number> {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Il file non è un PDF.')
  }
  const dati = await file.arrayBuffer()
  let lettura
  try {
    const doc = await apriPdf(dati)
    lettura = leggiGara(await estraiPagine(doc))
    await doc.loadingTask.destroy()
  } catch (e) {
    console.error(e)
    throw new Error('Non riesco ad aprire questo PDF. Potrebbe essere protetto o danneggiato.')
  }
  if (!lettura.sezioni.length) {
    throw new Error('Non ho trovato stage nel formato standard FITDS/IPSC in questo PDF.')
  }
  // libretto predefinito: PCC se il tiratore è in PCC, altrimenti il primo non-PCC
  const profilo = await getProfilo()
  let sezione = 0
  if (lettura.sezioni.length > 1) {
    const pcc = profilo.divisione === 'PCC'
    const idx = lettura.sezioni.findIndex((s) => (pcc ? s.etichetta.includes('PCC') : !/^PCC$/.test(s.etichetta)))
    sezione = Math.max(0, idx)
  }
  const id = (await db.analisi.add({
    creato: nowIso(),
    nomeFile: file.name,
    pdf: new Blob([dati], { type: 'application/pdf' }),
    lettura,
    sezione,
    eventoId,
  })) as number
  if (eventoId == null) {
    const a = await db.analisi.get(id)
    if (a) await collegaSeSicuro(a).catch(() => null)
  }
  return id
}
