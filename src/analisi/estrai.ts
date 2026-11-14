import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PaginaPdf } from './tipi'

type PdfJs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<PdfJs> | null = null

/** Carica pdf.js solo quando serve (non pesa sull'avvio dell'app). */
export function caricaPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })
  return pdfjsPromise
}

export async function apriPdf(dati: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await caricaPdfJs()
  // pdf.js trasferisce il buffer al worker: gli passiamo una copia
  return pdfjs.getDocument({ data: new Uint8Array(dati.slice(0)) }).promise
}

export async function estraiPagine(doc: PDFDocumentProxy): Promise<PaginaPdf[]> {
  const pagine: PaginaPdf[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const items = tc.items
      .filter((i): i is Extract<typeof i, { str: string }> => 'str' in i)
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], h: i.height }))
    pagine.push({ numero: n, larghezza: vp.width, altezza: vp.height, items })
    page.cleanup()
  }
  return pagine
}

/**
 * Disegna la parte alta della pagina (il disegno dello stage) su un canvas.
 * tagliaY = coordinata PDF sotto la quale inizia la tabella.
 */
export async function disegnaStage(doc: PDFDocumentProxy, numeroPagina: number, canvas: HTMLCanvasElement, larghezzaCss: number, tagliaY: number) {
  const page = await doc.getPage(numeroPagina)
  const base = page.getViewport({ scale: 1 })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const scala = (larghezzaCss / base.width) * dpr
  const vp = page.getViewport({ scale: scala })
  const altezzaPdf = base.height - tagliaY // dalla cima della pagina alla tabella
  canvas.width = Math.round(vp.width)
  canvas.height = Math.round(altezzaPdf * scala)
  canvas.style.width = `${larghezzaCss}px`
  canvas.style.height = `${Math.round(altezzaPdf * (larghezzaCss / base.width))}px`
  const ctx = canvas.getContext('2d')!
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
}
