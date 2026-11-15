import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Pencil, Play, Plus, Share2, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DrillForm from '../components/DrillForm'
import DrillIstruzioni from '../components/DrillIstruzioni'
import DrillSimulazione from '../components/DrillSimulazione'
import DrillEsporta from '../components/DrillEsporta'
import { usePreferiti } from '../lib/preferiti'
import { ISTRUZIONI } from '../allenamento/schemi'
import ProvaForm from '../components/ProvaForm'
import { Empty, useToast } from '../components/ui'
import { CLASSE_A_OBIETTIVO, obiettivoPer, type ClasseObiettivo } from '../allenamento/drills'
import { fmt2, statistiche, trovaDrill } from '../allenamento/servizi'
import { db, normalizzaProfilo } from '../db/db'
import { quando } from '../lib/date'

const CLASSI_OB: ClasseObiettivo[] = ['C', 'B', 'A', 'M', 'GM']

/** Grafico minimo: tempi delle ultime prove con la linea dell'obiettivo. */
function Andamento({ valori, obiettivo }: { valori: number[]; obiettivo: number | null }) {
  if (valori.length < 2) return null
  const W = 320, H = 90, P = 8
  const tutti = obiettivo ? [...valori, obiettivo] : valori
  const min = Math.min(...tutti) * 0.95, max = Math.max(...tutti) * 1.05
  const x = (i: number) => P + (i * (W - 2 * P)) / (valori.length - 1)
  // tempo minore (più veloce) = più in alto
  const y = (v: number) => P + ((v - min) / (max - min || 1)) * (H - 2 * P)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Ultime ${valori.length} prove, da ${fmt2(valori[0])} a ${fmt2(valori[valori.length - 1])} secondi`}>
      {obiettivo && <line x1={P} x2={W - P} y1={y(obiettivo)} y2={y(obiettivo)} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} />}
      <polyline fill="none" stroke="var(--text)" strokeWidth={2} points={valori.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      {valori.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--text)" />)}
    </svg>
  )
}

export default function DrillDettaglio() {
  const { id = '' } = useParams()
  const toast = useToast()
  const personali = useLiveQuery(() => db.drillPersonali.toArray())
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const prove = useLiveQuery(() => db.prove.where('drillId').equals(id).reverse().sortBy('creato'), [id]) ?? []
  const [prova, setProva] = useState(false)
  const [modifica, setModifica] = useState(false)
  const [esporta, setEsporta] = useState(false)
  const { isPreferito, commuta } = usePreferiti()

  if (!personali || !profilo) return <div className="page" />
  const d = trovaDrill(id, personali)
  if (!d) {
    return (
      <div className="page">
        <Link to="/allenamento" className="btn ghost" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={18} /> Allenamento</Link>
        <div className="card">Drill non trovato.</div>
      </div>
    )
  }
  const st = statistiche(prove)
  const ob = obiettivoPer(d, profilo.classe)
  const miaClasse = CLASSE_A_OBIETTIVO[profilo.classe]
  const personale = d.personale ? personali.find((p) => `p-${p.id}` === d.id) : undefined

  return (
    <div className="page">
      <Link to="/allenamento" className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }}><ArrowLeft size={18} /> Allenamento</Link>
      <header className="page-header">
        <div>
          <h1>{d.nome}</h1>
          <div className="sub">{d.categoria} · {d.modalita === 'fuoco' ? 'a fuoco' : 'in bianco'}{d.personale ? ' · personale' : ''}</div>
        </div>
        <div className="row">
          <button className="btn icon ghost" aria-label={isPreferito(d.id) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} aria-pressed={isPreferito(d.id)} onClick={() => commuta(d.id)}>
            <Star size={20} color={isPreferito(d.id) ? 'var(--accent)' : undefined} fill={isPreferito(d.id) ? 'var(--accent)' : 'none'} />
          </button>
          <button className="btn" onClick={() => setEsporta(true)}><Share2 size={16} /> Esporta</button>
          {personale && <button className="btn" onClick={() => setModifica(true)}><Pencil size={16} /> Modifica</button>}
        </div>
      </header>

      <div className="row">
        <Link to={`/timer?drill=${d.id}`} className="btn primary"><Play size={18} /> Avvia con il timer</Link>
        <button className="btn" onClick={() => setProva(true)}><Plus size={18} /> Registra a mano</button>
      </div>

      <section className="card">
        {d.descrizione && <p style={{ margin: '0 0 12px' }}>{d.descrizione}</p>}
        <dl className="dettagli">
          <dt>Distanza</dt><dd>{d.distanza || '—'}</dd>
          <dt>Bersagli</dt><dd>{d.bersagli || '—'}</dd>
          <dt>{d.modalita === 'bianco' ? 'Azioni' : 'Colpi'}</dt><dd>{d.colpi}</dd>
          <dt>Partenza</dt><dd>{d.partenza || '—'}</dd>
        </dl>
      </section>

      <DrillIstruzioni d={d} personale={personale} />
      {d.modalita === 'fuoco' && <DrillSimulazione schema={personale ? personale.schema : ISTRUZIONI[d.id]?.schema} />}

      {!d.personale && (
        <section className="card">
          <div className="card-title">Obiettivi per classe</div>
          <div className="obiettivi">
            {CLASSI_OB.map((c) => (
              <div key={c} className={`ob${c === miaClasse ? ' mio' : ''}`}>
                <div className="c">{c}</div>
                <div className="v">{fmt2(d.obiettivi[c])}</div>
              </div>
            ))}
          </div>
          <p className="prose" style={{ fontSize: 12, margin: '10px 0 0' }}>Tempi indicativi su esecuzione pulita, in secondi. Evidenziata la tua classe ({profilo.classe}).</p>
        </section>
      )}

      <section className="card">
        <div className="card-title">I tuoi risultati</div>
        <div className="stats">
          <div className="stat"><div className="v">{st.n}</div><div className="l">Prove</div></div>
          <div className="stat"><div className="v" style={{ color: st.migliore !== null && st.migliore <= ob ? 'var(--accent)' : undefined }}>{fmt2(st.migliore)}</div><div className="l">Record (s)</div></div>
          <div className="stat"><div className="v">{fmt2(st.media)}</div><div className="l">Media ultime 10</div></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Andamento valori={st.ultime} obiettivo={ob || null} />
        </div>
      </section>

      <section className="card">
        <div className="card-title">Prove</div>
        {prove.length ? (
          <div className="list">
            {prove.map((p) => (
              <div key={p.id} className="item" style={{ cursor: 'default' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{fmt2(p.tempo)} s{p.hf !== null ? ` · HF ${fmt2(p.hf)}` : ''}</div>
                  <div className="meta">
                    {quando(p.data)}
                    {p.modalita === 'fuoco' ? ` · A${p.zone.A} C${p.zone.C} D${p.zone.D}${p.zone.M ? ` M${p.zone.M}` : ''}${p.zone.NS ? ` NS${p.zone.NS}` : ''}` : ''}
                    {p.colpi.length > 1 ? ` · primo ${fmt2(p.colpi[0])}` : ''}
                    {p.note ? ` · ${p.note}` : ''}
                  </div>
                </div>
                <button className="btn icon ghost" aria-label="Elimina prova" onClick={async () => { await db.prove.delete(p.id!); toast('Prova eliminata') }}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Nessuna prova su questo drill." />
        )}
      </section>

      {prova && <ProvaForm drillId={d.id} onClose={() => setProva(false)} />}
      {modifica && personale && <DrillForm drill={personale} onClose={() => setModifica(false)} />}
      {esporta && <DrillEsporta d={d} personale={personale} onClose={() => setEsporta(false)} />}
    </div>
  )
}
