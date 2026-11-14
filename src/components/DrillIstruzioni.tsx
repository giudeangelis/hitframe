import { useLiveQuery } from 'dexie-react-hooks'
import { ListChecks, MapPinned } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ISTRUZIONI, type Istruzioni } from '../allenamento/schemi'
import type { Drill } from '../allenamento/drills'
import { chiaveMappa, immagineDisegno } from '../analisi/mappa'
import { calcolaPiano } from '../analisi/piano'
import { db, normalizzaProfilo } from '../db/db'
import type { DrillPersonale } from '../db/types'
import { DrillSchema } from './DrillSchema'
import StageMappa from './StageMappa'

/** Disegno dello stage con il piano sovrapposto, per i drill nati dallo studio di uno stage. */
function DisegnoStage({ rif }: { rif: NonNullable<DrillPersonale['stage']> }) {
  const a = useLiveQuery(() => db.analisi.get(rif.analisiId), [rif.analisiId])
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const [img, setImg] = useState<{ url: string; w: number; h: number } | null>(null)
  const sez = a ? a.lettura.sezioni[a.sezione] ?? a.lettura.sezioni[0] : null
  const s = sez?.stages.find((x) => x.numero === rif.numero)
  const mappa = a?.mappe?.[chiaveMappa(a.sezione, rif.numero)]
  useEffect(() => {
    if (!a?.pdf || !s) return
    let ok = true
    immagineDisegno(String(a.id), a.pdf, s.pagina, s.tabellaTopY).then((r) => ok && setImg(r)).catch(() => {})
    return () => { ok = false }
  }, [a?.id, a?.pdf, s?.pagina, s?.tabellaTopY]) // eslint-disable-line react-hooks/exhaustive-deps
  const piano = useMemo(() => (mappa && s && profilo ? calcolaPiano(mappa, s, profilo, rif.stile) : null), [mappa, s, profilo, rif.stile])
  if (!a || !s) return <p className="prose" style={{ margin: 0 }}>L’analisi della gara di questo stage non c’è più.</p>
  if (!img || !mappa) return <p className="prose" style={{ margin: 0 }}>{a.pdf ? 'Carico il disegno…' : 'Il disegno non è disponibile: ricarica il PDF della gara.'}</p>
  const sovra = piano ? {
    punti: [mappa.partenza, ...piano.percorso.map((pid) => mappa.posizioni.find((p) => p.id === pid)!)].map((p) => ({ x: p.x, y: p.y, etichetta: p.id })),
    ordine: piano.ordine, inMovimento: piano.inMovimento, ricariche: piano.ricariche,
  } : null
  return (
    <>
      <StageMappa img={img} mappa={mappa} modifica={false} sovra={sovra} />
      <Link to={`/analisi-gara/${rif.analisiId}/stage/${rif.numero}`} className="btn ghost" style={{ alignSelf: 'flex-start' }}><MapPinned size={16} /> Apri lo studio dello stage</Link>
    </>
  )
}

export default function DrillIstruzioni({ d, personale }: { d: Drill; personale?: DrillPersonale }) {
  const ist: Partial<Istruzioni> | undefined = personale
    ? { allestimento: personale.allestimento, passi: personale.passi, attenzione: personale.attenzione, schema: personale.schema }
    : ISTRUZIONI[d.id]
  const haSchema = !!ist?.schema?.elementi.length
  const haTesto = !!(ist?.allestimento || ist?.passi?.length || ist?.attenzione?.length)
  if (!personale?.stage && !haSchema && !haTesto) return null
  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}><span><ListChecks size={18} style={{ verticalAlign: -3 }} /> Come si fa</span></div>
      {personale?.stage ? <DisegnoStage rif={personale.stage} /> : haSchema && <DrillSchema schema={ist!.schema!} titolo={d.nome} />}
      {haSchema && !personale?.stage && (
        <div className="legenda-schema">
          <span><i style={{ background: 'var(--accent)', borderRadius: 99 }} /> tu</span>
          <span><i style={{ background: '#c9a77a' }} /> carta</span>
          <span><i style={{ background: '#a7b0ba', borderRadius: 99 }} /> metallo</span>
          <span><i style={{ background: '#f4f4f2' }} /> no-shoot</span>
          <span><i style={{ background: 'var(--gara)', height: 3 }} /> movimento</span>
        </div>
      )}
      {ist?.allestimento && <div><div className="label">Allestimento</div><p style={{ margin: '4px 0 0' }}>{ist.allestimento}</p></div>}
      {!!ist?.passi?.length && (
        <div>
          <div className="label">Esecuzione</div>
          <ol className="passi-drill">{ist.passi.map((p, i) => <li key={i}>{p}</li>)}</ol>
        </div>
      )}
      {!!ist?.attenzione?.length && (
        <div>
          <div className="label">Attenzione a</div>
          <ul className="drill" style={{ marginLeft: 0 }}>{ist.attenzione.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
