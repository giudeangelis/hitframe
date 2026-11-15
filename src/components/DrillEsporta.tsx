import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileText, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ISTRUZIONI, type Istruzioni } from '../allenamento/schemi'
import { obiettivoPer, type Drill } from '../allenamento/drills'
import { fmtHf, fmtS } from '../analisi/motore'
import { db, normalizzaProfilo } from '../db/db'
import type { DrillPersonale } from '../db/types'
import { fmtLungo, oggiKey } from '../lib/date'
import { DrillSchema } from './DrillSchema'
import { simula } from './DrillSimulazione'
import { Sheet, useToast } from './ui'

/** Scheda del drill da condividere: disegno, spiegazione e simulazione con il profilo. */
export default function DrillEsporta({ d, personale, onClose }: { d: Drill; personale?: DrillPersonale; onClose: () => void }) {
  const toast = useToast()
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const nodo = useRef<HTMLDivElement>(null)
  const [lavoro, setLavoro] = useState(false)
  if (!profilo) return null
  const ist: Partial<Istruzioni> | undefined = personale
    ? { allestimento: personale.allestimento, passi: personale.passi, attenzione: personale.attenzione, schema: personale.schema }
    : ISTRUZIONI[d.id]
  const sim = d.modalita === 'fuoco' ? simula(ist?.schema, profilo) : null
  const ob = d.personale ? personale?.obiettivo ?? null : obiettivoPer(d, profilo.classe)
  const nomeFile = `hitframe-${d.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  async function immagine(condividi: boolean) {
    if (!nodo.current) return
    setLavoro(true)
    try {
      const { toJpeg } = await import('html-to-image')
      const url = await toJpeg(nodo.current, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff' })
      if (condividi && navigator.canShare) {
        const blob = await (await fetch(url)).blob()
        const file = new File([blob], `${nomeFile}.jpg`, { type: 'image/jpeg' })
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: d.nome }); return }
      }
      const a = document.createElement('a')
      a.href = url; a.download = `${nomeFile}.jpg`
      document.body.appendChild(a); a.click(); a.remove()
      toast('Immagine salvata')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Non riesco a creare l’immagine')
    } finally { setLavoro(false) }
  }

  function pdf() {
    document.body.classList.add('stampa-scheda')
    const fine = () => { document.body.classList.remove('stampa-scheda'); window.removeEventListener('afterprint', fine) }
    window.addEventListener('afterprint', fine)
    window.print()
    setTimeout(fine, 1500)
  }

  return (
    <Sheet title="Esporta il drill" onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={() => immagine(true)} disabled={lavoro}><Share2 size={18} /> Condividi immagine</button>
        <button className="btn" onClick={() => immagine(false)} disabled={lavoro}><Download size={18} /> JPEG</button>
        <button className="btn" onClick={pdf}><FileText size={18} /> PDF</button>
      </div>
      <div className="scheda-export" ref={nodo}>
        <div className="se-testa">
          <div>
            <div className="se-kicker">{d.categoria} · {d.modalita === 'fuoco' ? 'a fuoco' : 'in bianco'}</div>
            <div className="se-titolo">{d.nome}</div>
          </div>
          <div className="se-marchio"><span>Hit</span>frame</div>
        </div>
        {d.descrizione && <p className="se-descr">{d.descrizione}</p>}
        <div className="se-dati">
          <div><b>Distanza</b>{d.distanza || '—'}</div>
          <div><b>Bersagli</b>{d.bersagli || '—'}</div>
          <div><b>{d.modalita === 'bianco' ? 'Azioni' : 'Colpi'}</b>{d.colpi}</div>
          <div><b>Partenza</b>{d.partenza || '—'}</div>
          {ob ? <div><b>Obiettivo {d.personale ? '' : `classe ${profilo.classe}`}</b>{fmtS(ob)}</div> : null}
        </div>
        {!!ist?.schema?.elementi.length && <div className="se-disegno"><DrillSchema schema={ist.schema} titolo={d.nome} /></div>}
        {ist?.allestimento && <><div className="se-sez">Allestimento</div><p>{ist.allestimento}</p></>}
        {!!ist?.passi?.length && <><div className="se-sez">Esecuzione</div><ol>{ist.passi.map((p, i) => <li key={i}>{p}</li>)}</ol></>}
        {!!ist?.attenzione?.length && <><div className="se-sez">Attenzione a</div><ul>{ist.attenzione.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
        {sim && (
          <>
            <div className="se-sez">Simulazione con il profilo di {profilo.nome || 'tiratore'} ({profilo.classe})</div>
            <div className="se-sim">
              {(['aggressivo', 'conservativo'] as const).map((x) => (
                <div key={x} className={sim.consiglio.scelta === x ? 'vince' : ''}>
                  <b>{x}</b><span className="t">{fmtS(sim[x].tempo)}</span><span>HF {fmtHf(sim[x].hf)}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 6 }}>{sim.consiglio.testo}</p>
          </>
        )}
        <div className="se-piede">{profilo.nome ? `${profilo.nome} · ` : ''}{profilo.divisione} · {fmtLungo(oggiKey())}</div>
      </div>
    </Sheet>
  )
}
