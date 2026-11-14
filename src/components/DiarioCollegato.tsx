import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, PenLine } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db/db'
import type { VoceDiario } from '../db/types'
import { quando } from '../lib/date'
import DiarioForm from './DiarioForm'

/** Le voci del diario legate a un evento o a una data: il diario parla con tutto il resto. */
export default function DiarioCollegato({ eventoId, date, titolo = 'Dal diario', invito }: { eventoId: number | null; date: string[]; titolo?: string; invito: string }) {
  const voci = useLiveQuery(
    () => db.diario.filter((v) => (eventoId !== null && v.eventoId === eventoId) || date.includes(v.data)).toArray(),
    [eventoId, date.join(',')],
  ) ?? []
  const [form, setForm] = useState<{ voce?: VoceDiario } | null>(null)
  return (
    <section className="card">
      <div className="card-title">
        <span><BookOpen size={18} style={{ verticalAlign: -3 }} /> {titolo}</span>
        <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm({})}><PenLine size={16} /> Scrivi</button>
      </div>
      {voci.length === 0 ? <p className="prose" style={{ margin: 0, fontSize: 13 }}>{invito}</p> : (
        <div className="list">
          {voci.map((v) => (
            <button key={v.id} className="item" style={{ display: 'block', textAlign: 'left', color: 'var(--text)' }} onClick={() => setForm({ voce: v })}>
              <div className="title">{v.titolo || 'Nota'}</div>
              <div className="meta">{quando(v.data)} · umore {v.umore}/5 · energia {v.energia}/5 · concentrazione {v.concentrazione}/5{v.sonnoOre ? ` · ${v.sonnoOre} h di sonno` : ''}</div>
              {v.testo && <div className="meta" style={{ marginTop: 4, color: 'var(--muted)' }}>{v.testo.length > 220 ? `${v.testo.slice(0, 220)}…` : v.testo}</div>}
            </button>
          ))}
        </div>
      )}
      {form && <DiarioForm voce={form.voce} data={date[date.length - 1]} eventoId={eventoId} onClose={() => setForm(null)} />}
    </section>
  )
}
