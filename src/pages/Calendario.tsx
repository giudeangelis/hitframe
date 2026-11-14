import { addDays, addMonths, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventoForm from '../components/EventoForm'
import EventoItem from '../components/EventoItem'
import { Empty, PageHeader } from '../components/ui'
import { db } from '../db/db'
import { TIPI_EVENTO, type Evento, type TipoEvento } from '../db/types'
import { capitalize, fmt, fmtLungo, fromKey, oggiKey, toKey } from '../lib/date'

const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function Calendario() {
  const [params, setParams] = useSearchParams()
  const oggi = oggiKey()
  const [mese, setMese] = useState(() => startOfMonth(new Date()))
  const [selezionato, setSelezionato] = useState(oggi)
  const [form, setForm] = useState<{ evento?: Evento; data?: string; tipo?: TipoEvento } | null>(
    () => (params.get('nuovo') ? { data: oggi, tipo: (params.get('nuovo') as TipoEvento) || 'fuoco' } : null),
  )

  const inizio = startOfWeek(startOfMonth(mese), { weekStartsOn: 1 })
  const fine = endOfWeek(endOfMonth(mese), { weekStartsOn: 1 })
  const da = toKey(inizio)
  const a = toKey(fine)

  // Prende anche le gare di più giorni iniziate prima della griglia
  const eventi = useLiveQuery(
    () => db.eventi.where('data').between(toKey(addDays(inizio, -7)), a, true, true).toArray(),
    [da, a],
  ) ?? []

  const perGiorno = useMemo(() => {
    const map = new Map<string, Evento[]>()
    for (const e of eventi) {
      let d = fromKey(e.data)
      const fineEv = fromKey(e.dataFine || e.data)
      while (d <= fineEv) {
        const k = toKey(d)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(e)
        d = addDays(d, 1)
      }
    }
    for (const list of map.values()) list.sort((x, y) => (x.ora || '99').localeCompare(y.ora || '99'))
    return map
  }, [eventi])

  const giorni: Date[] = []
  for (let d = inizio; d <= fine; d = addDays(d, 1)) giorni.push(d)

  const delGiorno = perGiorno.get(selezionato) ?? []

  const chiudiForm = () => {
    setForm(null)
    if (params.has('nuovo')) setParams({}, { replace: true })
  }

  return (
    <div className="page">
      <PageHeader
        title="Calendario"
        sub="Allenamenti a fuoco, in bianco e gare"
        actions={
          <button className="btn primary" onClick={() => setForm({ data: selezionato })}>
            <CalendarPlus size={18} /> Nuovo
          </button>
        }
      />

      <section className="card">
        <div className="cal-head" style={{ marginBottom: 12 }}>
          <h2>{capitalize(fmt(toKey(mese), 'MMMM yyyy'))}</h2>
          <button className="btn icon" onClick={() => setMese((m) => addMonths(m, -1))} aria-label="Mese precedente"><ChevronLeft size={20} /></button>
          <button className="btn" onClick={() => { setMese(startOfMonth(new Date())); setSelezionato(oggi) }}>Oggi</button>
          <button className="btn icon" onClick={() => setMese((m) => addMonths(m, 1))} aria-label="Mese successivo"><ChevronRight size={20} /></button>
        </div>
        <div className="cal-grid" role="grid" aria-label={fmt(toKey(mese), 'MMMM yyyy')}>
          {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
          {giorni.map((d) => {
            const k = toKey(d)
            const evs = perGiorno.get(k) ?? []
            const cls = ['cal-day', !isSameMonth(d, mese) && 'other', k === oggi && 'today', k === selezionato && 'selected'].filter(Boolean).join(' ')
            return (
              <button
                key={k}
                className={cls}
                onClick={() => setSelezionato(k)}
                onDoubleClick={() => setForm({ data: k })}
                aria-label={`${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} eventi` : ''}`}
                aria-pressed={k === selezionato}
              >
                {d.getDate()}
                <span className="cal-dots">
                  {evs.slice(0, 4).map((e, i) => <span key={`${e.id}-${i}`} className={`dot ${e.tipo}`} />)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          {(Object.keys(TIPI_EVENTO) as TipoEvento[]).map((t) => (
            <span key={t}><span className={`dot ${t}`} /> {TIPI_EVENTO[t].breve}</span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <span>{capitalize(fmtLungo(selezionato))}</span>
          <button className="btn ghost" onClick={() => setForm({ data: selezionato })} aria-label="Aggiungi evento in questo giorno">
            <CalendarPlus size={18} />
          </button>
        </div>
        {delGiorno.length ? (
          <div className="list">
            {delGiorno.map((e) => <EventoItem key={e.id} e={e} conData={false} onClick={() => setForm({ evento: e })} />)}
          </div>
        ) : (
          <Empty text="Niente in programma." action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setForm({ data: selezionato, tipo: 'fuoco' })}><span className="dot fuoco" /> Fuoco</button>
              <button className="btn" onClick={() => setForm({ data: selezionato, tipo: 'bianco' })}><span className="dot bianco" /> In bianco</button>
              <button className="btn" onClick={() => setForm({ data: selezionato, tipo: 'gara' })}><span className="dot gara" /> Gara</button>
            </div>
          } />
        )}
      </section>

      {form && (
        <EventoForm
          key={form.evento?.id ?? `${form.data}-${form.tipo}`}
          evento={form.evento}
          data={form.data}
          tipo={form.tipo}
          onClose={chiudiForm}
        />
      )}
    </div>
  )
}
