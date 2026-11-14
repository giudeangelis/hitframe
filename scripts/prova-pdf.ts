// Prova il lettore su PDF locali: npx tsx scripts/prova-pdf.ts file1.pdf [file2.pdf ...]
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'
import { leggiGara } from '../src/analisi/parser'
import type { PaginaPdf } from '../src/analisi/tipi'

for (const file of process.argv.slice(2)) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise
  const pagine: PaginaPdf[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n)
    const vp = p.getViewport({ scale: 1 })
    const tc = await p.getTextContent()
    pagine.push({ numero: n, larghezza: vp.width, altezza: vp.height, items: tc.items.filter((i: any) => 'str' in i).map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5], h: i.height })) })
  }
  const g = leggiGara(pagine)
  console.log(`\n### ${file.split('/').pop()}`)
  console.log('avvisi:', g.avvisi)
  for (const sez of g.sezioni) {
  console.log(`-- ${sez.etichetta}`, sez.info, sez.avvisi)
  for (const s of sez.stages) {
    const b = s.bersagli
    const f = Object.entries(s.flag).filter(([, v]) => v).map(([k]) => k).join(',')
    console.log(`S${s.numero} p${s.pagina} ${s.lingua} ${s.tipo.padEnd(6)} colpi ${s.colpi} pt ${s.puntiMax} | C${b.carta} MC${b.miniCarta} P${b.popper} MP${b.miniPopper} PL${b.piastre} NS${b.noShoot} | ${f} | etich:${s.etichetteDisegno.join(' ')}`)
    if (process.env.DETT) console.log('  partenza:', s.posizionePartenza, '\n  tiratore:', s.prontoTiratore, '\n  arma:', s.prontoArma, '\n  proc:', s.procedura, '\n  note:', s.note, '\n  attiv:', s.attivazioni)
  }
}}
