import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Gauge, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CronoForm, LottoForm, RicettaForm } from '../components/MunizioniForms'
import { Empty } from '../components/ui'
import { db, normalizzaProfilo } from '../db/db'
import type { SessioneCrono } from '../db/types'
import { fmtMedio } from '../lib/date'
import { colpiProducibili, costoColpo, euro, fromFps, num1, SOGLIE, valutaSessione } from '../munizioni/calcoli'
import { GIUDIZIO } from './Munizioni'

export default function RicettaDettaglio() {
  const { id } = useParams()
  const rid = Number(id)
  const r = useLiveQuery(() => db.ricette.get(rid), [rid])
  const sessioni = useLiveQuery(() => db.crono.where('ricettaId').equals(rid).reverse().sortBy('data'), [rid]) ?? []
  const comp = useLiveQuery(() => db.componenti.toArray()) ?? []
  const lotti = useLiveQuery(() => db.lotti.where('ricettaId').equals(rid).toArray(), [rid]) ?? []
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const [form, setForm] = useState<null | 'modifica' | 'crono' | 'lotto' | SessioneCrono>(null)

  if (r === undefined || !profilo) return <div className="page" />
  if (!r) return <div className="page"><Link to="/munizioni" className="btn ghost"><ArrowLeft size={18} /> Munizioni</Link><div className="card">Ricetta non trovata.</div></div>

  const div = profilo.divisione
  const costo = costoColpo(r, comp)
  const prod = colpiProducibili(r, comp)
  const ultima = sessioni[0]
  const es = ultima ? valutaSessione(ultima, r, div, 'minor') : null
  const esMajor = ultima && SOGLIE[div].major ? valutaSessione(ultima, r, div, 'major') : null
  const unita = ultima?.unita ?? 'ms'
  const v = (fps: number) => unita === 'ms' ? `${num1(fromFps(fps, 'ms'))} m/s` : `${Math.round(fps)} fps`
  const prodotti = lotti.reduce((a, l) => a + l.quantita, 0)

  return (
    <div className="page">
      <Link to="/munizioni" className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }}><ArrowLeft size={18} /> Munizioni</Link>
      <header className="page-header">
        <div>
          <h1>{r.nome}</h1>
          <div className="sub">{r.calibro} · {r.pesoPalla} gr · {r.tipoPalla}</div>
        </div>
        <button className="btn" onClick={() => setForm('modifica')}><Pencil size={16} /> Modifica</button>
      </header>

      <section className="card">
        <dl className="dettagli">
          <dt>Palla</dt><dd>{r.palla || '—'} · {r.pesoPalla} gr</dd>
          <dt>Polvere</dt><dd>{r.polvere || '—'}{r.carica ? ` · ${num1(r.carica)} gr` : ''}</dd>
          <dt>Innesco</dt><dd>{r.innesco || '—'}</dd>
          <dt>Bossolo</dt><dd>{r.bossolo || '—'}</dd>
          <dt>OAL</dt><dd>{r.oal ? `${num1(r.oal)} mm` : '—'}</dd>
          {r.note && <><dt>Note</dt><dd>{r.note}</dd></>}
        </dl>
        <div className="chips" style={{ marginTop: 10 }}>
          <span className="badge">Costo {euro(costo.totale)} a colpo{costo.totale !== null && !costo.completo ? ' (parziale)' : ''}</span>
          {costo.totale !== null && <span className="badge">{euro(costo.totale * 1000, 0)} ogni 1000</span>}
          {prod && <span className="badge">Componenti per {prod.colpi} colpi (limita: {prod.limite})</span>}
          {prodotti > 0 && <span className="badge">{prodotti} colpi prodotti</span>}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => setForm('lotto')}><Plus size={18} /> Ricaricati</button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <span><Gauge size={18} style={{ verticalAlign: -3 }} /> Cronografo</span>
          <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm('crono')}><Plus size={16} /> Sessione</button>
        </div>
        {!es ? (
          <Empty text="Spara almeno 10 colpi al cronografo con l’arma di gara e inserisci le velocità: calcolo PF, dispersione e la probabilità di passare il controllo in gara." />
        ) : (
          <>
            <div className="card" style={{ background: 'var(--bg)', borderColor: GIUDIZIO[es.giudizio].colore, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: GIUDIZIO[es.giudizio].colore }}>{GIUDIZIO[es.giudizio].testo} · {div} minor {es.soglia}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>
                {es.giudizio === 'sicuro' && <>Margine di {num1(es.margine)} punti di PF: passi il cronografo anche se in gara legge un po’ più basso del tuo.</>}
                {es.giudizio === 'attenzione' && <>Con il tuo cronografo passi, ma se quello di gara legge il 2% in meno la probabilità scende al {Math.round(es.probabilitaPrudente * 100)}%. Punta a una media di almeno {v(es.velNecessaria)}.</>}
                {es.giudizio === 'rischio' && <>Rischi di non fare il minor. Per stare tranquillo serve una media di almeno {v(es.velNecessaria)} con questa dispersione.</>}
              </div>
            </div>
            <div className="stats">
              <div className="stat"><div className="v">{num1(es.pfMedio)}</div><div className="l">PF medio · minimo {num1(es.pfMin)}</div></div>
              <div className="stat"><div className="v">{v(es.stat.media).replace(/ .*/, '')}</div><div className="l">Media {unita === 'ms' ? 'm/s' : 'fps'} su {es.stat.n} colpi</div></div>
              <div className="stat"><div className="v">{v(es.stat.sd).replace(/ .*/, '')}</div><div className="l">Dev. standard · ES {v(es.stat.es)}</div></div>
            </div>
            <p className="prose" style={{ fontSize: 13, margin: '10px 0 0' }}>
              Probabilità di passare il cronografo di gara: {Math.round(es.probabilita * 100)}% con le tue letture, {Math.round(es.probabilitaPrudente * 100)}% se in gara legge il 2% in meno. Peso usato: {es.grani} gr.
              {esMajor && <> Major {esMajor.soglia}: {Math.round(esMajor.probabilita * 100)}% (serve circa {v(esMajor.velNecessaria)}).</>}
            </p>
          </>
        )}
        {sessioni.length > 0 && (
          <div className="list" style={{ marginTop: 12 }}>
            {sessioni.map((s) => {
              const e = valutaSessione(s, r, div)
              return (
                <button key={s.id} className="item" style={{ textAlign: 'left', color: 'var(--text)' }} onClick={() => setForm(s)}>
                  <div style={{ flex: 1 }}>
                    <div className="title">{fmtMedio(s.data)}{s.temperatura !== null ? ` · ${s.temperatura}°C` : ''}</div>
                    <div className="meta">{s.velocita.length} colpi · media {e ? (s.unita === 'ms' ? `${num1(fromFps(e.stat.media, 'ms'))} m/s` : `${Math.round(e.stat.media)} fps`) : '—'}{s.note ? ` · ${s.note}` : ''}</div>
                  </div>
                  {e && <b style={{ color: GIUDIZIO[e.giudizio].colore }}>PF {num1(e.pfMedio)}</b>}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {form === 'modifica' && <RicettaForm ricetta={r} onClose={() => setForm(null)} />}
      {form === 'crono' && <CronoForm ricetta={r} onClose={() => setForm(null)} />}
      {form === 'lotto' && <LottoForm ricetta={r} onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && <CronoForm ricetta={r} sessione={form} onClose={() => setForm(null)} />}
    </div>
  )
}
