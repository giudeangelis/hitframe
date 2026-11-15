import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Circle, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { idPersonale, tuttiDrill } from '../allenamento/servizi'
import { db } from '../db/db'
import { usePreferiti } from '../lib/preferiti'
import { Segmented, Sheet } from './ui'

type Filtro = 'tutti' | 'preferiti' | 'miei'

/** Scelta di più drill o stage (catalogo + creati da te) da collegare a una sessione. */
export default function SceltaDrill({ scelti, modalita, onConferma, onClose }: {
  scelti: string[]; modalita?: 'fuoco' | 'bianco'; onConferma: (ids: string[]) => void; onClose: () => void
}) {
  const personali = useLiveQuery(() => db.drillPersonali.toArray()) ?? []
  const { isPreferito } = usePreferiti()
  const [sel, setSel] = useState<string[]>(scelti)
  const [cerca, setCerca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('tutti')
  const tutti = useMemo(() => tuttiDrill(personali), [personali])
  const mieiId = new Set(personali.map((p) => idPersonale(p.id!)))
  const lista = tutti
    .filter((d) => filtro !== 'preferiti' || isPreferito(d.id))
    .filter((d) => filtro !== 'miei' || mieiId.has(d.id))
    .filter((d) => !cerca.trim() || d.nome.toLowerCase().includes(cerca.trim().toLowerCase()))
    .sort((a, b) => {
      // prima quelli già scelti, poi preferiti, poi stessa modalità della sessione
      const pa = (sel.includes(a.id) ? 0 : 4) + (isPreferito(a.id) ? 0 : 2) + (modalita && a.modalita !== modalita ? 1 : 0)
      const pb = (sel.includes(b.id) ? 0 : 4) + (isPreferito(b.id) ? 0 : 2) + (modalita && b.modalita !== modalita ? 1 : 0)
      return pa - pb || a.nome.localeCompare(b.nome)
    })
  const commuta = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Sheet title="Drill e stage della sessione" onClose={onClose}>
      <div className="form">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Search size={18} color="var(--muted)" />
          <input className="input" style={{ flex: 1 }} value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome" aria-label="Cerca drill" />
        </div>
        <Segmented<Filtro> label="Mostra" value={filtro} onChange={setFiltro}
          options={[{ value: 'tutti', label: 'Tutti' }, { value: 'preferiti', label: 'Preferiti' }, { value: 'miei', label: 'Creati da me' }]} />
        <div className="list" style={{ maxHeight: '48vh', overflowY: 'auto' }}>
          {lista.length === 0 && <div className="meta" style={{ padding: 8 }}>Nessun drill trovato.</div>}
          {lista.map((d) => {
            const on = sel.includes(d.id)
            return (
              <button key={d.id} type="button" className="item" onClick={() => commuta(d.id)} aria-pressed={on}>
                {on ? <CheckCircle2 size={20} color="var(--accent)" /> : <Circle size={20} color="var(--muted)" />}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="title">{d.nome} {isPreferito(d.id) && <Star size={13} fill="var(--accent)" color="var(--accent)" style={{ verticalAlign: -1 }} />}</div>
                  <div className="meta">{d.modalita === 'bianco' ? 'In bianco' : 'A fuoco'}{d.colpi ? ` · ${d.colpi} colpi` : ''}{mieiId.has(d.id) ? ' · creato da te' : ''}</div>
                </div>
                {on && <span className="badge">{sel.indexOf(d.id) + 1}</span>}
              </button>
            )
          })}
        </div>
        <button type="button" className="btn primary" onClick={() => { onConferma(sel); onClose() }}>
          Conferma {sel.length ? `(${sel.length})` : ''}
        </button>
      </div>
    </Sheet>
  )
}
