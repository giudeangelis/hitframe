import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Pencil, Plus, Star, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { avvisiArma, colpiArma, statoManutenzione, statoParte, type StatoVoce } from '../attrezzatura/calcoli'
import { ArmaForm, InterventoForm, VoceForm } from '../components/AttrezzaturaForms'
import { Empty, PageHeader, useToast } from '../components/ui'
import { db, normalizzaProfilo, nowIso } from '../db/db'
import type { Manutenzione, ParteArma } from '../db/types'
import { fmtMedio, oggiKey } from '../lib/date'

const COLORE: Record<StatoVoce['livello'], string> = { ok: 'var(--ok)', presto: 'var(--accent)', scaduta: 'var(--fuoco)' }
const n = (x: number) => x.toLocaleString('it-IT')

function Barra({ st }: { st: StatoVoce }) {
  return (
    <div className="progresso" aria-hidden="true">
      <span style={{ width: `${Math.min(100, st.quota * 100)}%`, background: COLORE[st.livello] }} />
    </div>
  )
}

export default function Attrezzatura() {
  const navigate = useNavigate()
  const oggi = oggiKey()
  const armi = useLiveQuery(() => db.armi.toArray())
  const eventi = useLiveQuery(() => db.eventi.toArray()) ?? []
  const interventi = useLiveQuery(() => db.interventi.toArray()) ?? []
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const [nuova, setNuova] = useState(false)

  if (!armi || !profilo) return <div className="page" />

  return (
    <div className="page">
      <PageHeader title="Attrezzatura" sub="Colpi, manutenzioni e parti di ogni arma"
        actions={<button className="btn primary" onClick={() => setNuova(true)}><Plus size={18} /> Arma</button>} />
      {armi.length === 0 ? (
        <div className="card">
          <Empty icon={<Wrench size={28} />} text="Aggiungi la tua arma: Hitframe conta i colpi dalle sessioni a fuoco e dalle gare completate in calendario e ti avvisa quando è ora di pulire o sostituire molle e canna."
            action={<button className="btn primary" onClick={() => setNuova(true)}><Plus size={18} /> Aggiungi arma</button>} />
        </div>
      ) : (
        <div className="list">
          {armi.map((a) => {
            const colpi = colpiArma(a, eventi, interventi)
            const avvisi = avvisiArma(a, colpi, oggi)
            return (
              <Link key={a.id} to={`/attrezzatura/${a.id}`} className="item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{a.principale && <Star size={14} color="var(--accent)" style={{ verticalAlign: -2, marginRight: 4 }} />}{a.nome}</div>
                  <div className="meta">{a.calibro} · {a.divisione} · {n(colpi)} colpi</div>
                  {avvisi.length > 0 && (
                    <div className="chips" style={{ marginTop: 6 }}>
                      {avvisi.slice(0, 3).map((x) => <span key={x.voce} className="badge" style={{ color: COLORE[x.stato.livello] }}>{x.voce}</span>)}
                    </div>
                  )}
                </div>
                <ChevronRight size={18} color="var(--faint)" />
              </Link>
            )
          })}
        </div>
      )}
      {nuova && <ArmaForm profilo={profilo} primaArma={armi.length === 0} onClose={() => setNuova(false)} onCreata={(id) => navigate(`/attrezzatura/${id}`)} />}
    </div>
  )
}

export function ArmaDettaglio() {
  const { id } = useParams()
  const aid = Number(id)
  const toast = useToast()
  const oggi = oggiKey()
  const a = useLiveQuery(() => db.armi.get(aid), [aid])
  const eventi = useLiveQuery(() => db.eventi.toArray()) ?? []
  const interventi = useLiveQuery(() => db.interventi.where('armaId').equals(aid).toArray(), [aid]) ?? []
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const [form, setForm] = useState<null | 'arma' | 'intervento' | 'colpi' | { tipo: 'manutenzione' | 'parte'; voce?: Manutenzione | ParteArma }>(null)

  if (a === undefined || !profilo) return <div className="page" />
  if (!a) return <div className="page"><Link to="/attrezzatura" className="btn ghost"><ArrowLeft size={18} /> Attrezzatura</Link><div className="card">Arma non trovata.</div></div>

  const colpi = colpiArma(a, eventi, interventi)
  const avvisi = avvisiArma(a, colpi, oggi)
  const sessioni = eventi.filter((e) => e.completato && (e.tipo === 'fuoco' || e.tipo === 'gara') && e.data >= a.dal && (e.armaId ? e.armaId === a.id : a.principale) && (e.colpiSparati ?? 0) > 0)
  const storico = [
    ...interventi.map((i) => ({ data: i.data, titolo: i.titolo, meta: [i.descrizione, i.costo ? `${i.costo} €` : '', `a ${n(i.colpiArma)} colpi`].filter(Boolean).join(' · '), id: `i${i.id}`, del: () => db.interventi.delete(i.id!) })),
  ].sort((x, y) => y.data.localeCompare(x.data))

  async function fatta(m: Manutenzione) {
    await db.armi.update(a!.id!, { manutenzioni: a!.manutenzioni.map((x) => (x.id === m.id ? { ...x, ultimaColpi: colpi, ultimaData: oggi } : x)) })
    await db.interventi.add({ armaId: a!.id!, data: oggi, tipo: 'manutenzione', titolo: m.nome, descrizione: '', colpiArma: colpi, manutenzioneId: m.id, costo: null, creato: nowIso() })
    toast(`${m.nome}: fatto`)
  }
  async function sostituita(p: ParteArma) {
    await db.armi.update(a!.id!, { parti: a!.parti.map((x) => (x.id === p.id ? { ...x, colpiInstallazione: colpi, installata: oggi } : x)) })
    await db.interventi.add({ armaId: a!.id!, data: oggi, tipo: 'sostituzione', titolo: `${p.nome} sostituita`, descrizione: `Dopo ${n(Math.max(0, colpi - p.colpiInstallazione))} colpi`, colpiArma: colpi, parteId: p.id, costo: null, creato: nowIso() })
    toast(`${p.nome}: contatore azzerato`)
  }

  return (
    <div className="page">
      <Link to="/attrezzatura" className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }}><ArrowLeft size={18} /> Attrezzatura</Link>
      <header className="page-header">
        <div>
          <h1>{a.nome}</h1>
          <div className="sub">{[a.modello, a.calibro, a.divisione, a.principale ? 'principale' : ''].filter(Boolean).join(' · ')}</div>
        </div>
        <button className="btn" onClick={() => setForm('arma')}><Pencil size={16} /> Modifica</button>
      </header>

      <section className="card">
        <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="stat"><div className="v">{n(colpi)}</div><div className="l">Colpi totali</div></div>
          <div className="stat"><div className="v">{sessioni.length}</div><div className="l">Sessioni e gare dal {fmtMedio(a.dal)}</div></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setForm('colpi')}><Plus size={18} /> Colpi fuori calendario</button>
        </div>
        <p className="prose" style={{ fontSize: 12, margin: '10px 0 0' }}>I colpi arrivano dalle sessioni a fuoco e dalle gare segnate come completate, con i colpi sparati.</p>
      </section>

      {avvisi.length > 0 && (
        <div className="card avviso">
          <AlertTriangle size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div>{avvisi.map((x) => `${x.voce} (${x.stato.livello === 'scaduta' ? 'scaduta' : 'a breve'})`).join(' · ')}</div>
        </div>
      )}

      <section className="card">
        <div className="card-title">
          <span>Manutenzione</span>
          <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm({ tipo: 'manutenzione' })}><Plus size={16} /> Voce</button>
        </div>
        <div className="list">
          {a.manutenzioni.map((m) => {
            const st = statoManutenzione(m, colpi, oggi)
            return (
              <div key={m.id} className="item" style={{ alignItems: 'center' }}>
                <button style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, color: 'var(--text)', padding: 0, cursor: 'pointer' }} onClick={() => setForm({ tipo: 'manutenzione', voce: m })}>
                  <div className="title">{m.nome}</div>
                  <div className="meta">{st.testo} · ultima {fmtMedio(m.ultimaData)}</div>
                  <Barra st={st} />
                </button>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => fatta(m)} aria-label={`${m.nome} fatta`}><Check size={16} /> Fatto</button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <span>Parti e usura</span>
          <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm({ tipo: 'parte' })}><Plus size={16} /> Parte</button>
        </div>
        <div className="list">
          {a.parti.map((p) => {
            const st = statoParte(p, colpi)
            return (
              <div key={p.id} className="item" style={{ alignItems: 'center' }}>
                <button style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, color: 'var(--text)', padding: 0, cursor: 'pointer' }} onClick={() => setForm({ tipo: 'parte', voce: p })}>
                  <div className="title">{p.nome}</div>
                  <div className="meta">{st.testo}{p.colpiInstallazione > 0 ? ` · sostituita il ${fmtMedio(p.installata)}` : ''}{p.note ? ` · ${p.note}` : ''}</div>
                  {p.vitaColpi ? <Barra st={st} /> : null}
                </button>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => sostituita(p)}>Sostituita</button>
              </div>
            )
          })}
        </div>
        <p className="prose" style={{ fontSize: 12, margin: '10px 0 0' }}>Gli intervalli sono indicativi: adattali a quanto consiglia il produttore della tua arma.</p>
      </section>

      <section className="card">
        <div className="card-title">
          <span>Storico</span>
          <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setForm('intervento')}><Plus size={16} /> Intervento</button>
        </div>
        {storico.length === 0 ? <p className="prose" style={{ margin: 0 }}>Nessun intervento registrato.</p> : (
          <div className="list">
            {storico.map((s) => (
              <div key={s.id} className="item" style={{ padding: '8px 12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="title" style={{ fontSize: 14 }}>{s.titolo}</div>
                  <div className="meta">{fmtMedio(s.data)} · {s.meta}</div>
                </div>
                <button className="btn ghost" style={{ minHeight: 32, padding: '0 8px' }} aria-label="Elimina" onClick={s.del}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {form === 'arma' && <ArmaForm arma={a} profilo={profilo} primaArma={false} onClose={() => setForm(null)} />}
      {form === 'intervento' && <InterventoForm arma={a} colpiAttuali={colpi} onClose={() => setForm(null)} />}
      {form === 'colpi' && <InterventoForm arma={a} colpiAttuali={colpi} soloColpi onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && <VoceForm arma={a} tipo={form.tipo} voce={form.voce} colpiAttuali={colpi} onClose={() => setForm(null)} />}
    </div>
  )
}
