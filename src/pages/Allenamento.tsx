import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Sparkles, Timer as TimerIcon, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DrillForm from '../components/DrillForm'
import ProvaForm from '../components/ProvaForm'
import { Empty, PageHeader, Segmented } from '../components/ui'
import { CATEGORIE_DRILL, drillPerFocus, obiettivoPer, type Drill } from '../allenamento/drills'
import { fmt2, statistiche, tuttiDrill } from '../allenamento/servizi'
import { focusAllenamento } from '../analisi/motore'
import { db, normalizzaProfilo } from '../db/db'
import type { Prova } from '../db/types'
import { capitalize, fmt, oggiKey, quando } from '../lib/date'

export default function Allenamento() {
  const [params, setParams] = useSearchParams()
  const vista = (params.get('vista') as 'drill' | 'storico') ?? 'drill'
  const [modo, setModo] = useState<'tutti' | 'fuoco' | 'bianco'>('tutti')
  const [cat, setCat] = useState<string>('')
  const [nuovoDrill, setNuovoDrill] = useState(false)
  const [nuovaProva, setNuovaProva] = useState(false)

  const personali = useLiveQuery(() => db.drillPersonali.toArray()) ?? []
  const prove = useLiveQuery(() => db.prove.orderBy('creato').reverse().toArray()) ?? []
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const oggi = oggiKey()

  // Prossima gara con analisi: drill consigliati dalle priorità
  const consigliati = useLiveQuery(async () => {
    const gare = await db.eventi.where('data').aboveOrEqual(oggi).filter((e) => e.tipo === 'gara').sortBy('data')
    for (const g of gare) {
      const a = await db.analisi.where('eventoId').equals(g.id!).first()
      if (!a) continue
      const sez = a.lettura.sezioni[a.sezione] ?? a.lettura.sezioni[0]
      const focus = focusAllenamento(sez.stages).slice(0, 3)
      const ids = new Set<string>()
      const drills: Drill[] = []
      for (const f of focus) for (const d of drillPerFocus(f.id)) if (!ids.has(d.id)) { ids.add(d.id); drills.push(d) }
      return { gara: g.titolo, focus: focus.map((f) => f.titolo), drills: drills.slice(0, 6) }
    }
    return null
  }, [oggi])

  const elenco = useMemo(() => tuttiDrill(personali), [personali])
  const perDrill = useMemo(() => {
    const m = new Map<string, Prova[]>()
    for (const p of prove) {
      if (!m.has(p.drillId)) m.set(p.drillId, [])
      m.get(p.drillId)!.push(p)
    }
    return m
  }, [prove])

  const filtrati = elenco.filter((d) => (modo === 'tutti' || d.modalita === modo) && (!cat || d.categoria === cat))
  const nomeDrill = (id: string) => elenco.find((d) => d.id === id)?.nome ?? 'Drill eliminato'

  const storicoPerGiorno = useMemo(() => {
    const g: { data: string; prove: Prova[] }[] = []
    for (const p of prove) {
      const ultimo = g[g.length - 1]
      if (ultimo?.data === p.data) ultimo.prove.push(p)
      else g.push({ data: p.data, prove: [p] })
    }
    return g
  }, [prove])

  return (
    <div className="page">
      <PageHeader
        title="Allenamento"
        sub="Drill, prove e progressi"
        actions={
          <>
            <Link to="/timer" className="btn primary"><TimerIcon size={18} /> Timer</Link>
            <button className="btn" onClick={() => setNuovaProva(true)}><Plus size={18} /> Prova</button>
          </>
        }
      />

      <Segmented label="Vista" value={vista} onChange={(v) => setParams(v === 'drill' ? {} : { vista: v }, { replace: true })}
        options={[{ value: 'drill', label: 'Drill' }, { value: 'storico', label: `Storico (${prove.length})` }]} />

      {vista === 'drill' ? (
        <>
          {consigliati && consigliati.drills.length > 0 && (
            <section className="card">
              <div className="card-title"><span><Sparkles size={18} style={{ verticalAlign: -3 }} /> Per {consigliati.gara}</span></div>
              <p className="prose" style={{ margin: '0 0 10px', fontSize: 13 }}>Dalle priorità della gara: {consigliati.focus.join(', ').toLowerCase()}.</p>
              <div className="drill-scroll">
                {consigliati.drills.map((d) => <DrillCard key={d.id} d={d} prove={perDrill.get(d.id) ?? []} obiettivo={profilo ? obiettivoPer(d, profilo.classe) : null} compatta />)}
              </div>
            </section>
          )}

          <div className="row">
            <Segmented label="Modalità" value={modo} onChange={setModo}
              options={[{ value: 'tutti', label: 'Tutti' }, { value: 'fuoco', label: 'A fuoco' }, { value: 'bianco', label: 'In bianco' }]} />
            <select className="select" style={{ width: 'auto', flex: 1 }} aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Tutte le categorie</option>
              {CATEGORIE_DRILL.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="drill-grid">
            {filtrati.map((d) => <DrillCard key={d.id} d={d} prove={perDrill.get(d.id) ?? []} obiettivo={profilo ? obiettivoPer(d, profilo.classe) : null} />)}
          </div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setNuovoDrill(true)}><Plus size={18} /> Crea un drill personale</button>
        </>
      ) : prove.length === 0 ? (
        <div className="card">
          <Empty text="Nessuna prova registrata. Usa il timer o registra a mano tempo e zone." action={<Link to="/timer" className="btn primary"><TimerIcon size={18} /> Apri il timer</Link>} />
        </div>
      ) : (
        storicoPerGiorno.map((g) => (
          <section key={g.data} className="form" style={{ gap: 8 }}>
            <div className="nav-section" style={{ padding: '4px 2px' }}>{capitalize(fmt(g.data, 'EEEE d MMMM'))} · {quando(g.data)}</div>
            <div className="list">
              {g.prove.map((p) => (
                <Link key={p.id} to={`/allenamento/${p.drillId}`} className="item">
                  <span className={`dot ${p.modalita}`} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="title">{nomeDrill(p.drillId)}</div>
                    <div className="meta">
                      {p.modalita === 'fuoco'
                        ? `A${p.zone.A} C${p.zone.C} D${p.zone.D}${p.zone.M ? ` M${p.zone.M}` : ''}${p.zone.NS ? ` NS${p.zone.NS}` : ''}${p.note ? ` · ${p.note}` : ''}`
                        : p.note}
                    </div>
                  </div>
                  <div className="stage-stima">
                    <div className="v">{fmt2(p.tempo)} s</div>
                    {p.hf !== null && <div className="l">HF {fmt2(p.hf)}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      {nuovoDrill && <DrillForm onClose={() => setNuovoDrill(false)} />}
      {nuovaProva && <ProvaForm onClose={() => setNuovaProva(false)} />}
    </div>
  )
}

function DrillCard({ d, prove, obiettivo, compatta }: { d: Drill; prove: Prova[]; obiettivo: number | null; compatta?: boolean }) {
  const st = statistiche(prove)
  const raggiunto = st.migliore !== null && obiettivo !== null && st.migliore <= obiettivo
  return (
    <Link to={`/allenamento/${d.id}`} className={`drill-card${compatta ? ' compatta' : ''}`}>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <span className={`dot ${d.modalita}`} aria-hidden="true" />
        <span className="meta" style={{ flex: 1 }}>{d.categoria}{d.personale ? ' · personale' : ''}</span>
        {raggiunto && <Trophy size={16} color="var(--accent)" aria-label="Obiettivo raggiunto" />}
      </div>
      <div className="t">{d.nome}</div>
      {!compatta && <div className="s">{d.distanza} · {d.colpi} {d.modalita === 'bianco' ? 'azioni' : 'colpi'}</div>}
      <div className="row" style={{ marginTop: 'auto', gap: 8 }}>
        {obiettivo ? <span className="badge">Obiettivo {fmt2(obiettivo)} s</span> : null}
        {st.migliore !== null && <span className="badge" style={{ color: 'var(--accent)' }}>Record {fmt2(st.migliore)}</span>}
      </div>
    </Link>
  )
}
