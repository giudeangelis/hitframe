import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, CalendarCheck, CalendarPlus, ChevronDown, Hand, Target, Timer, Trash2, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EventoForm from '../components/EventoForm'
import StageDisegno from '../components/StageDisegno'
import { Segmented, useToast } from '../components/ui'
import { leggiDateGara } from '../analisi/date'
import { carte, fmtHf, fmtS, focusAllenamento, metalli, partenzaSpeciale, profiloGara, stimaStage, type StimaStage } from '../analisi/motore'
import type { StageLetto } from '../analisi/tipi'
import { db, normalizzaProfilo, nowIso } from '../db/db'
import type { Evento } from '../db/types'
import { quando } from '../lib/date'

const fmtR = (a: number, b: number) => `${a.toFixed(1).replace('.', ',')}–${b.toFixed(1).replace('.', ',')} s`
const pct = (n: number) => `${Math.round(n * 100)}%`
/** Manda a capo le righe PCC per leggerle meglio. */
const aCapo = (t: string) => t.replace(/\s+(PCC\s*:)/g, '\n$1')

export default function AnalisiDettaglio() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const analisiId = Number(id)
  const a = useLiveQuery(() => db.analisi.get(analisiId), [analisiId])
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const evento = useLiveQuery(async () => (a?.eventoId ? (await db.eventi.get(a.eventoId)) ?? null : null), [a?.eventoId])
  const [aperto, setAperto] = useState<number | null>(null)
  const [nuovoEvento, setNuovoEvento] = useState<Evento | null>(null)
  const [confermaElimina, setConfermaElimina] = useState(false)

  const sez = a ? a.lettura.sezioni[a.sezione] ?? a.lettura.sezioni[0] : null
  const stages = useMemo(() => sez?.stages ?? [], [sez])
  const pg = useMemo(() => profiloGara(stages), [stages])
  const focus = useMemo(() => focusAllenamento(stages, pg), [stages, pg])
  const stime = useMemo(() => (profilo ? stages.map((s) => stimaStage(s, profilo)) : []), [stages, profilo])

  if (a === undefined || !profilo) return <div className="page" />
  if (a === null || !sez) {
    return (
      <div className="page">
        <Link to="/analisi-gara" className="btn ghost" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={18} /> Analisi gara</Link>
        <div className="card">Analisi non trovata.</div>
      </div>
    )
  }

  const info = sez.info
  const tempoTot = stime.reduce((t, s) => t + s.obiettivo, 0)
  const tempoMin = stime.reduce((t, s) => t + s.min, 0)
  const tempoMax = stime.reduce((t, s) => t + s.max, 0)
  const puntiTot = stime.reduce((t, s) => t + s.puntiAttesi, 0)
  const pesoMax = Math.max(...focus.map((f) => f.peso), 1)

  function preparaEvento() {
    const date = leggiDateGara(info.date)
    const oggi = new Date().toISOString().slice(0, 10)
    setNuovoEvento({
      tipo: 'gara',
      titolo: info.nome || a!.nomeFile.replace(/\.pdf$/i, ''),
      data: date?.inizio ?? oggi,
      dataFine: date?.fine ?? date?.inizio ?? oggi,
      ora: '',
      durataMin: null,
      luogo: info.campo,
      mapsUrl: '',
      note: info.matchDirector ? `Match Director: ${info.matchDirector}` : '',
      colpiPianificati: null,
      colpiSparati: null,
      completato: false,
      gara: {
        aperturaIscrizione: '',
        livello: info.livello || 'Level II',
        organizzatore: '',
        iscrizioneUrl: '',
        scadenzaIscrizione: '',
        iscritto: false,
        numeroStage: stages.length,
        colpiTotali: pg.colpi,
      },
      creato: nowIso(),
    })
  }

  async function elimina() {
    await db.analisi.delete(analisiId)
    toast('Analisi eliminata')
    nav('/analisi-gara')
  }

  return (
    <div className="page">
      <Link to="/analisi-gara" className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }}><ArrowLeft size={18} /> Analisi gara</Link>

      <header className="page-header">
        <div>
          <h1>{info.nome || a.nomeFile}</h1>
          <div className="sub">{[info.date, info.campo, info.livello].filter(Boolean).join(' · ')}</div>
        </div>
      </header>

      {a.lettura.sezioni.length > 1 && (
        <div className="field">
          <span className="label">Libretto</span>
          <Segmented
            label="Libretto"
            value={String(a.sezione)}
            onChange={(v) => { db.analisi.update(analisiId, { sezione: Number(v) }); setAperto(null) }}
            options={a.lettura.sezioni.map((s, i) => ({ value: String(i), label: s.etichetta }))}
          />
        </div>
      )}

      {[...a.lettura.avvisi.filter((x) => !/libretti/.test(x)), ...sez.avvisi].length > 0 && (
        <div className="card avviso">
          <AlertTriangle size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div>{[...a.lettura.avvisi.filter((x) => !/libretti/.test(x)), ...sez.avvisi].join(' ')}</div>
        </div>
      )}

      <div className="row">
        {evento ? (
          <Link to="/calendario" className="item" style={{ flex: 1 }}>
            <CalendarCheck size={20} color="var(--gara)" />
            <div style={{ flex: 1 }}>
              <div className="title">In calendario</div>
              <div className="meta">{evento.titolo} · {quando(evento.data)}</div>
            </div>
          </Link>
        ) : (
          <button className="btn primary" onClick={preparaEvento}><CalendarPlus size={18} /> Aggiungi al calendario</button>
        )}
      </div>

      <section className="card">
        <div className="card-title">Profilo della gara</div>
        <div className="stats">
          <div className="stat"><div className="v">{pg.stage}</div><div className="l">Stage · {pg.perTipo.Short} S · {pg.perTipo.Medium} M · {pg.perTipo.Long} L</div></div>
          <div className="stat"><div className="v">{pg.colpi}</div><div className="l">Colpi minimi · {pg.punti} punti</div></div>
          <div className="stat"><div className="v">{pct(pg.quotaMetallo)}</div><div className="l">Colpi su metallo ({pg.colpiMetallo})</div></div>
          <div className="stat"><div className="v">{pg.noShoot}</div><div className="l">No-shoot in {pg.stageConNoShoot} stage</div></div>
          <div className="stat"><div className="v">{pg.stageMobili}</div><div className="l">Stage con attivazioni o mobili</div></div>
          <div className="stat"><div className="v">{pg.stageManoForte + pg.stageManoDebole + pg.partenzeSpeciali}</div><div className="l">Mano forte/debole o partenze speciali</div></div>
        </div>
      </section>

      <section className="card">
        <div className="card-title"><span>Stima con i tuoi tempi</span><Link to="/profilo">Profilo</Link></div>
        <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="stat"><div className="v">{fmtS(tempoTot)}</div><div className="l">Tempo obiettivo totale · da {fmtS(tempoMin)} a {fmtS(tempoMax)}</div></div>
          <div className="stat"><div className="v">{fmtHf(tempoTot ? puntiTot / tempoTot : 0)}</div><div className="l">Hit factor medio all’obiettivo</div></div>
        </div>
        <p className="prose" style={{ fontSize: 13, margin: '10px 0 0' }}>
          Calcolata sui tuoi tempi di riferimento in gara (Short {profilo.riferimenti.Short.min}–{profilo.riferimenti.Short.max} s,
          Medium {profilo.riferimenti.Medium.min}–{profilo.riferimenti.Medium.max} s, Long {profilo.riferimenti.Long.min}–{profilo.riferimenti.Long.max} s),
          adattata a colpi, partenza e condizioni di ogni stage. L’obiettivo è un’esecuzione pulita nella parte bassa del tuo intervallo.
        </p>
      </section>

      <section className="card">
        <div className="card-title">Priorità di allenamento</div>
        <div className="list" style={{ gap: 14 }}>
          {focus.slice(0, 6).map((f, i) => (
            <div key={f.id} className="focus">
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
                <span className="focus-n">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="title">{f.titolo}</div>
                  <div className="meta">{f.perche}</div>
                </div>
              </div>
              <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round((f.peso / pesoMax) * 100)}%` }} /></div>
              <ul className="drill">{f.drill.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="form" style={{ gap: 8 }}>
        <div className="nav-section" style={{ padding: '4px 2px' }}>Stage</div>
        {stages.map((s, i) => (
          <StageCard key={`${a.sezione}-${s.numero}`} s={s} stima={stime[i]} aperto={aperto === s.numero}
            onToggle={() => setAperto(aperto === s.numero ? null : s.numero)} analisiId={analisiId} pdf={a.pdf} />
        ))}
      </section>

      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        {confermaElimina ? (
          <>
            <button className="btn danger" onClick={elimina}><Trash2 size={18} /> Conferma eliminazione</button>
            <button className="btn ghost" onClick={() => setConfermaElimina(false)}>Annulla</button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setConfermaElimina(true)}><Trash2 size={18} /> Elimina analisi</button>
        )}
      </div>

      {nuovoEvento && (
        <EventoForm
          evento={nuovoEvento}
          onClose={() => setNuovoEvento(null)}
          onSalvato={(eid) => db.analisi.update(analisiId, { eventoId: eid })}
        />
      )}
    </div>
  )
}

function StageCard({ s, stima, aperto, onToggle, analisiId, pdf }: {
  s: StageLetto; stima?: StimaStage; aperto: boolean; onToggle: () => void; analisiId: number; pdf: Blob | null
}) {
  const nMet = metalli(s)
  const speciali = partenzaSpeciale(s)
  return (
    <div className={`stage${aperto ? ' aperto' : ''}`}>
      <button className="stage-head" onClick={onToggle} aria-expanded={aperto}>
        <span className="stage-n">{s.numero}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">{s.tipo} course · {s.colpi} colpi</div>
          <div className="chips" style={{ marginTop: 6 }}>
            <span className="badge"><Target size={12} /> {carte(s)} carta</span>
            {nMet > 0 && <span className="badge">{nMet} metallo</span>}
            {s.bersagli.noShoot > 0 && <span className="badge">{s.bersagli.noShoot} NS</span>}
            {s.flag.mobili && <span className="badge gara"><Zap size={12} /> attivazioni</span>}
            {(s.flag.manoForte || s.flag.manoDebole) && <span className="badge fuoco"><Hand size={12} /> {s.flag.manoDebole ? 'mano debole' : 'mano forte'}</span>}
            {speciali.map((x) => <span key={x} className="badge bianco">{x}</span>)}
          </div>
        </div>
        {stima && (
          <div className="stage-stima">
            <div className="v">{fmtS(stima.obiettivo)}</div>
            <div className="l">{fmtR(stima.min, stima.max)}</div>
          </div>
        )}
        <ChevronDown size={20} className="chev" />
      </button>
      {aperto && (
        <div className="stage-body">
          <StageDisegno analisiId={analisiId} pdf={pdf} pagina={s.pagina} tagliaY={s.tabellaTopY} alt={`Disegno dello stage ${s.numero}`} />
          {stima && (
            <div className="stima-righe">
              <div><Timer size={14} /> Obiettivo <b>{fmtS(stima.obiettivo)}</b></div>
              <div>Intervallo <b>{fmtR(stima.min, stima.max)}</b></div>
              <div><Target size={14} /> HF obiettivo <b>{fmtHf(stima.hfObiettivo)}</b></div>
              <div>HF da <b>{fmtHf(stima.hfMin)}</b> a <b>{fmtHf(stima.hfMax)}</b></div>
              {stima.fattori.length > 0 && <div style={{ gridColumn: '1 / -1' }}>Considerato: {stima.fattori.join(' · ')}</div>}
            </div>
          )}
          <dl className="dettagli">
            <dt>Bersagli</dt>
            <dd>
              {[
                s.bersagli.carta && `${s.bersagli.carta} carta`,
                s.bersagli.miniCarta && `${s.bersagli.miniCarta} mini carta`,
                s.bersagli.popper && `${s.bersagli.popper} popper`,
                s.bersagli.miniPopper && `${s.bersagli.miniPopper} mini popper`,
                s.bersagli.piastre && `${s.bersagli.piastre} piastre`,
                s.bersagli.noShoot && `${s.bersagli.noShoot} no-shoot`,
              ].filter(Boolean).join(' · ')} · {s.puntiMax} punti
            </dd>
            {s.posizionePartenza && <><dt>Partenza</dt><dd>{aCapo(s.posizionePartenza)}</dd></>}
            {s.prontoTiratore && <><dt>Pronto tiratore</dt><dd>{aCapo(s.prontoTiratore)}</dd></>}
            {s.prontoArma && <><dt>Pronto arma</dt><dd>{aCapo(s.prontoArma)}</dd></>}
            {s.procedura && <><dt>Procedura</dt><dd>{s.procedura}</dd></>}
            {s.note && <><dt>Note</dt><dd>{s.note}</dd></>}
            {s.etichetteDisegno.length > 0 && <><dt>Nel disegno</dt><dd>{s.etichetteDisegno.join(' ')}</dd></>}
          </dl>
          <div className="meta" style={{ fontSize: 12 }}>Pagina {s.pagina} del PDF</div>
        </div>
      )}
    </div>
  )
}
