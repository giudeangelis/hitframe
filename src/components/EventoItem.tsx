import { CheckCircle2, Crosshair } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { tuttiDrill } from '../allenamento/servizi'
import { db } from '../db/db'
import { TIPI_EVENTO, type Evento } from '../db/types'
import { fmt, quando } from '../lib/date'

export function eventoMeta(e: Evento): string {
  const parti: string[] = []
  if (e.tipo === 'gara' && e.dataFine !== e.data) parti.push(`fino al ${fmt(e.dataFine, 'd MMM')}`)
  if (e.tipo === 'gara' && e.gara?.iscritto && e.gara.turno) parti.push(e.gara.turno)
  if (e.ora) parti.push(e.ora)
  if (e.luogo) parti.push(e.luogo)
  if (e.tipo === 'gara' && e.gara?.livello) parti.push(e.gara.livello)
  if (e.colpiPianificati && e.tipo === 'fuoco') parti.push(`${e.colpiPianificati} colpi`)
  if (e.durataMin) parti.push(`${e.durataMin} min`)
  return parti.join(' · ') || TIPI_EVENTO[e.tipo].label
}

/** I drill della sessione come scorciatoie: al poligono apri il drill e registri la prova nella sessione. */
function DrillSessione({ e }: { e: Evento }) {
  const personali = useLiveQuery(() => db.drillPersonali.toArray()) ?? []
  if (!e.drill?.length) return null
  const tutti = tuttiDrill(personali)
  return (
    <div className="drill-sessione">
      {e.drill.map((id, i) => {
        const d = tutti.find((x) => x.id === id)
        return d ? (
          <Link key={id} to={`/allenamento/${id}?evento=${e.id}`} className="chip">
            <Crosshair size={12} style={{ verticalAlign: -1 }} /> {i + 1}. {d.nome}
          </Link>
        ) : null
      })}
    </div>
  )
}

export default function EventoItem({ e, onClick, conData = true }: { e: Evento; onClick: () => void; conData?: boolean }) {
  return (
    <>
    <button className={`item${e.completato ? ' done' : ''}`} onClick={onClick}>
      {conData ? (
        <div className="datebox" aria-hidden="true">
          <div className="d">{fmt(e.data, 'd')}</div>
          <div className="m">{fmt(e.data, 'MMM')}</div>
        </div>
      ) : (
        <span className={`dot ${e.tipo}`} aria-hidden="true" />
      )}
      <span className={`bar ${e.tipo}`} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title">{e.titolo}</div>
        <div className="meta">{conData ? `${quando(e.data)} · ` : ''}{eventoMeta(e)}</div>
      </div>
      {e.completato && <CheckCircle2 size={20} color="var(--ok)" aria-label="Completato" />}
      {e.tipo === 'gara' && !e.completato && (
        <span className={`badge ${e.gara?.iscritto ? 'gara' : ''}`}>{e.gara?.iscritto ? 'Iscritto' : 'Da iscrivere'}</span>
      )}
    </button>
    {!e.completato && <DrillSessione e={e} />}
    </>
  )
}
