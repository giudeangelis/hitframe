import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import EventoForm from '../components/EventoForm'
import EventoItem from '../components/EventoItem'
import { Empty, PageHeader } from '../components/ui'
import { tuttiDrill } from '../allenamento/servizi'
import { db } from '../db/db'
import type { Evento, TipoEvento } from '../db/types'
import { oggiKey } from '../lib/date'

/** Le sessioni di allenamento: in programma e svolte, con i loro drill. */
export default function Sessioni() {
  const oggi = oggiKey()
  const eventi = useLiveQuery(() => db.eventi.filter((e) => e.tipo === 'fuoco' || e.tipo === 'bianco').toArray()) ?? []
  const personali = useLiveQuery(() => db.drillPersonali.toArray()) ?? []
  const [form, setForm] = useState<{ e?: Evento; tipo?: TipoEvento } | null>(null)
  const drills = tuttiDrill(personali)
  const prossime = eventi.filter((e) => e.data >= oggi && !e.completato).sort((a, b) => a.data.localeCompare(b.data))
  const passate = eventi.filter((e) => e.data < oggi || e.completato).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30)

  const riga = (e: Evento) => (
    <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <EventoItem e={e} onClick={() => setForm({ e })} />
      {!!e.drill?.length && (
        <div className="chips" style={{ paddingLeft: 12 }}>
          {e.drill.map((id) => {
            const d = drills.find((x) => x.id === id)
            return d ? <Link key={id} to={`/allenamento/${id}`} className={`badge ${d.modalita}`} style={{ padding: '5px 10px' }}>{d.nome}</Link> : null
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="page">
      <PageHeader title="Sessioni" sub="Allenamenti in programma e svolti"
        actions={<>
          <button className="btn primary" onClick={() => setForm({ tipo: 'fuoco' })}><Plus size={18} /> A fuoco</button>
          <button className="btn" onClick={() => setForm({ tipo: 'bianco' })}><Plus size={18} /> In bianco</button>
        </>} />
      <section className="card">
        <div className="card-title">In programma</div>
        {prossime.length ? <div className="list">{prossime.map(riga)}</div> : <Empty text="Nessuna sessione in programma: pianificane una, poi aggiungi i drill dalla scheda di ogni drill o dall’analisi della gara." />}
      </section>
      {passate.length > 0 && (
        <section className="card">
          <div className="card-title">Svolte e passate</div>
          <div className="list">{passate.map(riga)}</div>
        </section>
      )}
      {form && <EventoForm key={form.e?.id ?? 'nuova'} evento={form.e} tipo={form.tipo} onClose={() => setForm(null)} />}
    </div>
  )
}
