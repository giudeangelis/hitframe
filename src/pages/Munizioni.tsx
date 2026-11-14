import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Calculator, ChevronRight, Package, Plus, ShoppingCart, SlidersHorizontal, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ComponenteForm, LottoForm, RicettaForm } from '../components/MunizioniForms'
import { Empty, numOrNull, PageHeader, Segmented, Sheet } from '../components/ui'
import { profiloGara } from '../analisi/motore'
import { db, normalizzaProfilo } from '../db/db'
import { TIPI_COMPONENTE, type Componente, type Divisione, type Ricetta, type TipoComponente } from '../db/types'
import { fmtMedio, oggiKey, quando } from '../lib/date'
import {
  colpiProducibili, costoColpo, costoUnitario, euro, fabbisogno, num1, pf, probabilitaCrono, scorta, SCARTO_CRONO, SOGLIE, toFps, valutaSessione, velocitaNecessaria,
} from '../munizioni/calcoli'

type Vista = 'ricette' | 'magazzino' | 'calcolatore'

export const GIUDIZIO = {
  sicuro: { testo: 'Sicuro al cronografo', colore: 'var(--ok)' },
  attenzione: { testo: 'Al limite', colore: 'var(--accent)' },
  rischio: { testo: 'A rischio', colore: 'var(--fuoco)' },
} as const

export default function Munizioni() {
  const [params, setParams] = useSearchParams()
  const vista = (params.get('vista') as Vista) ?? 'ricette'
  const navigate = useNavigate()
  const oggi = oggiKey()
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const ricette = useLiveQuery(() => db.ricette.toArray()) ?? []
  const comp = useLiveQuery(() => db.componenti.toArray()) ?? []
  const lotti = useLiveQuery(() => db.lotti.orderBy('data').reverse().toArray()) ?? []
  const crono = useLiveQuery(() => db.crono.orderBy('data').reverse().toArray()) ?? []
  const eventi = useLiveQuery(() => db.eventi.toArray()) ?? []
  const colpiAnalisi = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const a of await db.analisi.toArray()) {
      if (!a.eventoId) continue
      const sez = a.lettura.sezioni[a.sezione] ?? a.lettura.sezioni[0]
      if (sez) m.set(a.eventoId, profiloGara(sez.stages).colpi)
    }
    return m
  }) ?? new Map<number, number>()

  const [form, setForm] = useState<null | { tipo: 'ricetta' } | { tipo: 'componente'; comp?: Componente; t?: TipoComponente } | { tipo: 'lotto'; modo: 'produzione' | 'acquisto' | 'rettifica'; ricetta?: Ricetta } | { tipo: 'scegliRicetta' }>(null)

  const attive = ricette.filter((r) => !r.archiviata)
  const sc = useMemo(() => scorta(lotti, eventi), [lotti, eventi])
  const fab = useMemo(() => fabbisogno(eventi, sc.pronte, oggi, (g) => colpiAnalisi.get(g.id!) ?? null), [eventi, sc.pronte, oggi, colpiAnalisi])
  const sottoSoglia = comp.filter((c) => c.sogliaMinima !== null && c.quantita <= c.sogliaMinima)
  const divisione: Divisione = profilo?.divisione ?? 'Production'

  if (!profilo) return <div className="page" />

  const ricaricati = () => {
    if (attive.length === 1) setForm({ tipo: 'lotto', modo: 'produzione', ricetta: attive[0] })
    else if (attive.length > 1) setForm({ tipo: 'scegliRicetta' })
    else setForm({ tipo: 'ricetta' })
  }

  return (
    <div className="page">
      <PageHeader title="Munizioni" sub={`Ricette, cronografo, scorte · ${divisione}: minor ${SOGLIE[divisione].minor}${SOGLIE[divisione].major ? ` · major ${SOGLIE[divisione].major}` : ''}`} />

      <section className="card">
        <div className="card-title"><span><Package size={18} style={{ verticalAlign: -3 }} /> Scorta pronta</span></div>
        {lotti.length === 0 ? (
          <p className="prose" style={{ margin: '0 0 12px' }}>
            Registra le munizioni che ricarichi o compri: Hitframe scala da sola i colpi delle sessioni a fuoco e delle gare che segni come completate.
          </p>
        ) : (
          <div className="stats">
            <div className="stat"><div className="v" style={{ color: sc.pronte < 0 ? 'var(--fuoco)' : undefined }}>{sc.pronte}</div><div className="l">Colpi pronti</div></div>
            <div className="stat"><div className="v">{sc.prodotte}</div><div className="l">Prodotti o comprati dal {sc.dal ? fmtMedio(sc.dal) : '—'}</div></div>
            <div className="stat"><div className="v">{sc.sparati}</div><div className="l">Sparati in calendario</div></div>
          </div>
        )}
        {fab && (
          <div className={`card${fab.mancano ? ' avviso' : ''}`} style={{ marginTop: 12, padding: 12, background: 'var(--bg)' }}>
            {fab.mancano ? <AlertTriangle size={18} color="var(--accent)" style={{ flexShrink: 0 }} /> : null}
            <div style={{ fontSize: 14 }}>
              <b>{fab.gara.titolo}</b> {quando(fab.gara.data)}: servono circa <b>{fab.totale}</b> colpi
              ({fab.colpiGara} per la gara con margine e cronografo{fab.colpiAllenamenti ? `, ${fab.colpiAllenamenti} per gli allenamenti in calendario` : ''}).
              {' '}{fab.mancano ? <>Ne mancano <b style={{ color: 'var(--accent)' }}>{fab.mancano}</b>.</> : 'Sei coperto.'}
            </div>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={ricaricati}><Plus size={18} /> Ricaricati</button>
          <button className="btn" onClick={() => setForm({ tipo: 'lotto', modo: 'acquisto' })}><ShoppingCart size={18} /> Acquistati</button>
          <button className="btn ghost" onClick={() => setForm({ tipo: 'lotto', modo: 'rettifica' })}><SlidersHorizontal size={18} /> Rettifica</button>
        </div>
        {lotti.length > 0 && (
          <details className="guida" style={{ marginTop: 12 }}>
            <summary>Movimenti ({lotti.length})</summary>
            <div className="list" style={{ marginTop: 8 }}>
              {lotti.slice(0, 30).map((l) => (
                <div key={l.id} className="item" style={{ padding: '8px 12px' }}>
                  <div style={{ flex: 1 }}>
                    <div className="title" style={{ fontSize: 14 }}>{l.descrizione}</div>
                    <div className="meta">{fmtMedio(l.data)}{l.costoColpo ? ` · ${euro(l.costoColpo)} a colpo` : ''}</div>
                  </div>
                  <b style={{ color: l.quantita < 0 ? 'var(--fuoco)' : undefined }}>{l.quantita > 0 ? '+' : ''}{l.quantita}</b>
                  <button className="btn ghost" style={{ minHeight: 32, padding: '0 8px' }} aria-label="Elimina movimento" onClick={() => db.lotti.delete(l.id!)}>×</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {sottoSoglia.length > 0 && (
        <div className="card avviso">
          <AlertTriangle size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div>Da riordinare: {sottoSoglia.map((c) => `${c.nome} (${Math.round(c.quantita)} ${TIPI_COMPONENTE[c.tipo].unita})`).join(', ')}</div>
        </div>
      )}

      <Segmented<Vista> label="Sezione" value={vista} onChange={(v) => setParams({ vista: v }, { replace: true })}
        options={[{ value: 'ricette', label: 'Ricette' }, { value: 'magazzino', label: 'Magazzino' }, { value: 'calcolatore', label: 'Calcolatore PF' }]} />

      {vista === 'ricette' && (
        <section className="card">
          <div className="card-title">
            <span>Ricette</span>
            <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm({ tipo: 'ricetta' })}><Plus size={16} /> Nuova</button>
          </div>
          {ricette.length === 0 ? (
            <Empty icon={<Package size={28} />} text="Aggiungi la tua ricarica: palla, polvere, carica e OAL. Poi registra le velocità al cronografo per sapere se passi il controllo in gara." />
          ) : (
            <div className="list">
              {[...attive, ...ricette.filter((r) => r.archiviata)].map((r) => {
                const ultima = crono.find((c) => c.ricettaId === r.id)
                const es = ultima ? valutaSessione(ultima, r, divisione) : null
                const costo = costoColpo(r, comp)
                const prod = colpiProducibili(r, comp)
                return (
                  <Link key={r.id} to={`/munizioni/ricetta/${r.id}`} className="item" style={{ opacity: r.archiviata ? 0.55 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title">{r.nome}{r.archiviata ? ' · archiviata' : ''}</div>
                      <div className="meta">{r.calibro} · {r.pesoPalla} gr {r.tipoPalla.split(' (')[0].toLowerCase()}{r.polvere ? ` · ${r.polvere}` : ''}{r.carica ? ` ${num1(r.carica)} gr` : ''}</div>
                      <div className="chips" style={{ marginTop: 6 }}>
                        {es ? <span className="badge" style={{ color: GIUDIZIO[es.giudizio].colore }}>PF {num1(es.pfMedio)} · {GIUDIZIO[es.giudizio].testo.toLowerCase()}</span> : <span className="badge">nessun dato al cronografo</span>}
                        {costo.totale !== null && <span className="badge">{euro(costo.totale)} a colpo</span>}
                        {prod && <span className="badge">componenti per {prod.colpi} colpi</span>}
                      </div>
                    </div>
                    <ChevronRight size={18} color="var(--faint)" />
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {vista === 'magazzino' && (
        <section className="card">
          <div className="card-title">
            <span>Magazzino componenti</span>
            <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm({ tipo: 'componente' })}><Plus size={16} /> Aggiungi</button>
          </div>
          {comp.length === 0 ? (
            <Empty icon={<Wrench size={28} />} text="Inserisci palle, polvere, inneschi e bossoli con quantità e prezzo: avrai il costo per colpo, quanti colpi puoi ancora caricare e l’avviso quando riordinare." />
          ) : (
            (Object.keys(TIPI_COMPONENTE) as TipoComponente[]).map((t) => {
              const lista = comp.filter((c) => c.tipo === t)
              if (!lista.length) return null
              const u = TIPI_COMPONENTE[t].unita
              return (
                <div key={t} style={{ marginBottom: 12 }}>
                  <div className="label" style={{ marginBottom: 6 }}>{TIPI_COMPONENTE[t].label}</div>
                  <div className="list">
                    {lista.map((c) => {
                      const cu = costoUnitario(c)
                      const basso = c.sogliaMinima !== null && c.quantita <= c.sogliaMinima
                      return (
                        <button key={c.id} className="item" style={{ textAlign: 'left', width: '100%', color: 'var(--text)' }} onClick={() => setForm({ tipo: 'componente', comp: c })}>
                          <div style={{ flex: 1 }}>
                            <div className="title">{c.nome}</div>
                            <div className="meta">{cu !== null ? `${t === 'polvere' ? euro(cu * 1000, 2) + ' al kg' : euro(cu, 3) + ' al pezzo'}` : 'prezzo non inserito'}</div>
                          </div>
                          <b style={{ color: basso ? 'var(--accent)' : undefined }}>{Math.round(c.quantita).toLocaleString('it-IT')} {u}</b>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </section>
      )}

      {vista === 'calcolatore' && <CalcolatorePF divisione={divisione} />}

      {form?.tipo === 'ricetta' && <RicettaForm onClose={() => setForm(null)} onCreata={(id) => navigate(`/munizioni/ricetta/${id}`)} />}
      {form?.tipo === 'componente' && <ComponenteForm comp={form.comp} tipo={form.t} onClose={() => setForm(null)} />}
      {form?.tipo === 'lotto' && <LottoForm tipo={form.modo} ricetta={form.ricetta} onClose={() => setForm(null)} />}
      {form?.tipo === 'scegliRicetta' && (
        <Sheet title="Con quale ricetta?" onClose={() => setForm(null)}>
          <div className="list">
            {attive.map((r) => (
              <button key={r.id} className="item" style={{ textAlign: 'left', color: 'var(--text)' }} onClick={() => setForm({ tipo: 'lotto', modo: 'produzione', ricetta: r })}>
                <div className="title">{r.nome}</div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

function CalcolatorePF({ divisione }: { divisione: Divisione }) {
  const [peso, setPeso] = useState('125')
  const [vel, setVel] = useState('')
  const [sd, setSd] = useState('')
  const [unita, setUnita] = useState<'ms' | 'fps'>('ms')
  const g = numOrNull(peso) ?? 0
  const v = numOrNull(vel)
  const sdN = numOrNull(sd)
  const fps = v ? toFps(v, unita) : null
  const sdFps = sdN !== null ? toFps(sdN, unita) : 8
  const soglie = SOGLIE[divisione]
  const conv = (f: number) => (unita === 'ms' ? `${num1(f / 3.28084)} m/s` : `${Math.round(f)} fps`)

  const righe = [{ nome: 'Minor', s: soglie.minor }, ...(soglie.major ? [{ nome: 'Major', s: soglie.major }] : [])]
  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}><span><Calculator size={18} style={{ verticalAlign: -3 }} /> Calcolatore power factor</span></div>
      <Segmented<'ms' | 'fps'> label="Unità" value={unita} onChange={setUnita} options={[{ value: 'ms', label: 'm/s' }, { value: 'fps', label: 'fps' }]} />
      <div className="fields-3">
        <div className="field"><label htmlFor="pf-g">Palla (grani)</label><input id="pf-g" className="input" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
        <div className="field"><label htmlFor="pf-v">Velocità media</label><input id="pf-v" className="input" inputMode="decimal" value={vel} onChange={(e) => setVel(e.target.value)} /></div>
        <div className="field"><label htmlFor="pf-sd">Dev. standard</label><input id="pf-sd" className="input" inputMode="decimal" value={sd} onChange={(e) => setSd(e.target.value)} placeholder={unita === 'ms' ? '2,5' : '8'} /></div>
      </div>
      {fps && g ? (
        <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="stat"><div className="v">{num1(pf(g, fps))}</div><div className="l">Power factor medio</div></div>
          <div className="stat"><div className="v">{Math.round(probabilitaCrono(fps * (1 - SCARTO_CRONO), sdFps, g, soglie.minor) * 100)}%</div><div className="l">Probabilità di passare il minor, con il cronografo di gara 2% più lento</div></div>
        </div>
      ) : null}
      {g > 0 && (
        <div className="list">
          {righe.map((r) => (
            <div key={r.nome} className="item" style={{ padding: '10px 12px' }}>
              <div style={{ flex: 1 }}>
                <div className="title">{r.nome} {r.s}</div>
                <div className="meta">Minimo esatto {conv((r.s * 1000) / g)} · consigliato {conv(velocitaNecessaria(sdFps, g, r.s) / (1 - SCARTO_CRONO))}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="prose" style={{ margin: 0, fontSize: 12 }}>
        In gara si pesa una palla e se ne sparano 3: se il PF non basta si continua fino a 6 colpi e vale la media delle 3 velocità più alte.
        Il “consigliato” tiene conto della tua dispersione e di un cronografo di gara che legge il 2% in meno.
      </p>
    </section>
  )
}
