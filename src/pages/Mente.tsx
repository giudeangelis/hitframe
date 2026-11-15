import { useLiveQuery } from 'dexie-react-hooks'
import { Brain, CheckCircle2, Circle, Pause, PenLine, Play, Plus, Quote, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader, Sheet, useToast } from '../components/ui'
import { db, getImp, nowIso, setImp } from '../db/db'
import { giorniDa, oggiKey } from '../lib/date'
import { DOMANDE_RIFLESSIONE, ESERCIZI, fraseDelGiorno, PAROLE_DEFAULT, ROUTINE_DEFAULT, type Esercizio } from '../mente/contenuti'

/** Esercizio guidato: una fase alla volta con il conto alla rovescia e l'animazione del respiro. */
function Guida({ es, onClose }: { es: Esercizio; onClose: () => void }) {
  const fasi = useMemo(() => Array.from({ length: es.ripeti ?? 1 }, () => es.fasi).flat(), [es])
  const [i, setI] = useState(0)
  const [resto, setResto] = useState(fasi[0].secondi)
  const [va, setVa] = useState(true)
  const finito = i >= fasi.length
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    if (!va || finito) return
    timer.current = setInterval(() => {
      setResto((r) => {
        if (r > 1) return r - 1
        setI((k) => {
          const n = k + 1
          if (n < fasi.length) setResto(fasi[n].secondi)
          if (navigator.vibrate) navigator.vibrate(30)
          return n
        })
        return 0
      })
    }, 1000)
    return () => clearInterval(timer.current)
  }, [va, finito, fasi])

  const f = fasi[Math.min(i, fasi.length - 1)]
  const giro = es.ripeti ? Math.floor(i / es.fasi.length) + 1 : null
  const scala = f.respiro === 'dentro' ? 1 : f.respiro === 'fuori' ? 0.55 : f.respiro === 'trattieni' ? undefined : 0.8
  return (
    <div className="guida-mente" role="dialog" aria-label={es.titolo}>
      <button className="btn icon ghost guida-chiudi" aria-label="Chiudi" onClick={onClose}><X size={24} /></button>
      <div className="kicker">{es.titolo}{giro ? ` · giro ${Math.min(giro, es.ripeti!)} di ${es.ripeti}` : ` · ${Math.min(i + 1, fasi.length)} di ${fasi.length}`}</div>
      {finito ? (
        <>
          <CheckCircle2 size={64} color="var(--ok)" />
          <h2>Fatto</h2>
          <p className="prose">Bel lavoro. Porta questa calma nel prossimo stage.</p>
          <div className="row">
            <button className="btn" onClick={() => { setI(0); setResto(fasi[0].secondi); setVa(true) }}><RotateCcw size={18} /> Ripeti</button>
            <button className="btn primary" onClick={onClose}>Chiudi</button>
          </div>
        </>
      ) : (
        <>
          <div className="respiro" style={{ transform: scala !== undefined ? `scale(${scala})` : undefined, transitionDuration: `${f.secondi}s` }}>
            <span>{resto}</span>
          </div>
          <p className="guida-testo">{f.testo}</p>
          <button className="btn" onClick={() => setVa((v) => !v)}>{va ? <><Pause size={18} /> Pausa</> : <><Play size={18} /> Riprendi</>}</button>
        </>
      )}
    </div>
  )
}

function ListaModificabile({ chiave, predefiniti, titolo, segnabile = false, placeholder }: { chiave: string; predefiniti: string[]; titolo: string; segnabile?: boolean; placeholder: string }) {
  const voci = useLiveQuery(() => getImp<string[]>(chiave, predefiniti), [chiave]) ?? predefiniti
  const [fatte, setFatte] = useState<Set<number>>(new Set())
  const [nuova, setNuova] = useState('')
  const [modifica, setModifica] = useState(false)
  const salva = (v: string[]) => setImp(chiave, v)
  return (
    <section className="card">
      <div className="card-title">
        <span>{titolo}</span>
        <button className="btn ghost" style={{ minHeight: 32 }} onClick={() => setModifica((m) => !m)}>{modifica ? 'Fatto' : 'Modifica'}</button>
      </div>
      <div className="obiettivo-tappe" style={{ marginTop: 0 }}>
        {voci.map((v, i) => (
          <div key={v + i} className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            {segnabile && !modifica ? (
              <button className={`tappa${fatte.has(i) ? ' fatta' : ''}`} style={{ flex: 1 }} onClick={() => setFatte((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })}>
                {fatte.has(i) ? <CheckCircle2 size={16} color="var(--ok)" /> : <Circle size={16} />} <span>{v}</span>
              </button>
            ) : <span style={{ flex: 1, fontSize: segnabile ? 14 : 22, fontFamily: segnabile ? undefined : 'var(--display)', fontWeight: segnabile ? 400 : 800, fontStyle: segnabile ? undefined : 'italic', textTransform: segnabile ? undefined : 'uppercase' }}>{v}</span>}
            {modifica && <button className="btn icon ghost" style={{ width: 36, minHeight: 36 }} aria-label="Togli" onClick={() => salva(voci.filter((_, k) => k !== i))}><Trash2 size={15} /></button>}
          </div>
        ))}
      </div>
      {modifica && (
        <div className="row" style={{ flexWrap: 'nowrap', marginTop: 8 }}>
          <input className="input" style={{ flex: 1 }} value={nuova} onChange={(e) => setNuova(e.target.value)} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter' && nuova.trim()) { void salva([...voci, nuova.trim()]); setNuova('') } }} />
          <button className="btn" onClick={() => { if (nuova.trim()) { void salva([...voci, nuova.trim()]); setNuova('') } }}><Plus size={16} /></button>
        </div>
      )}
      {segnabile && !modifica && fatte.size > 0 && <button className="btn ghost" style={{ marginTop: 6, minHeight: 32 }} onClick={() => setFatte(new Set())}><RotateCcw size={14} /> Azzera</button>}
    </section>
  )
}

function Riflessione({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [r, setR] = useState(['', '', ''])
  const [conc, setConc] = useState(3)
  async function salva() {
    const testo = DOMANDE_RIFLESSIONE.map((d, i) => `${d}\n${r[i].trim() || '—'}`).join('\n\n')
    const oggi = oggiKey()
    const gara = await db.eventi.where('data').between(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), oggi, true, true).filter((e) => e.tipo === 'gara').last()
    await db.diario.add({ data: oggi, titolo: 'Riflessione dopo la gara', testo, umore: 3, energia: 3, concentrazione: conc, sonnoOre: null, tag: ['mente', 'gara'], eventoId: gara?.id ?? null, videoUrl: '', creato: nowIso(), aggiornato: nowIso() })
    toast('Salvata nel diario')
    onClose()
  }
  return (
    <Sheet title="Riflessione dopo la gara" onClose={onClose}>
      <div className="form">
        {DOMANDE_RIFLESSIONE.map((d, i) => (
          <div key={d} className="field">
            <label htmlFor={`rif-${i}`}>{d}</label>
            <textarea id={`rif-${i}`} className="input" rows={2} value={r[i]} onChange={(e) => setR((x) => x.map((v, k) => (k === i ? e.target.value : v)))} />
          </div>
        ))}
        <div className="field">
          <label htmlFor="rif-conc">Concentrazione in gara: {conc}/5</label>
          <input id="rif-conc" type="range" min={1} max={5} value={conc} onChange={(e) => setConc(+e.target.value)} />
        </div>
        <button className="btn primary" onClick={salva}><PenLine size={18} /> Salva nel diario</button>
      </div>
    </Sheet>
  )
}

export default function Mente() {
  const [esercizio, setEsercizio] = useState<Esercizio | null>(null)
  const [riflessione, setRiflessione] = useState(false)
  const eventi = useLiveQuery(() => db.eventi.where('tipo').equals('gara').toArray()) ?? []
  const diario = useLiveQuery(() => db.diario.orderBy('data').reverse().limit(5).toArray()) ?? []

  // consiglio di oggi in base a calendario e diario
  const oggi = oggiKey()
  const prossima = eventi.filter((e) => e.data >= oggi).sort((a, b) => a.data.localeCompare(b.data))[0]
  const recente = eventi.filter((e) => e.data < oggi && giorniDa(e.data) >= -3).sort((a, b) => b.data.localeCompare(a.data))[0]
  const ultima = diario[0]
  const consiglio = (() => {
    if (recente && !diario.some((v) => v.tag.includes('mente') && v.data >= recente.data)) {
      return { testo: `Dopo “${recente.titolo}”: tre domande per chiudere la gara e portarti dietro quello che serve.`, azione: () => setRiflessione(true), etichetta: 'Rifletti sulla gara' }
    }
    if (prossima && giorniDa(prossima.data) <= 3) {
      return { testo: `${giorniDa(prossima.data) === 0 ? 'Oggi si gara' : `Gara tra ${giorniDa(prossima.data)} giorni`}: visualizza gli stage che conosci e ripassa la routine.`, azione: () => setEsercizio(ESERCIZI.find((e) => e.id === 'visualizzazione')!), etichetta: 'Visualizzazione' }
    }
    if (ultima && (ultima.concentrazione <= 2 || ultima.umore <= 2 || ultima.energia <= 2)) {
      return { testo: 'Nell’ultima voce del diario eri sottotono: parti da due minuti di respirazione quadrata.', azione: () => setEsercizio(ESERCIZI[0]), etichetta: 'Respirazione' }
    }
    const es = ESERCIZI[Math.floor(Date.now() / 86400000) % ESERCIZI.length]
    return { testo: `Esercizio del giorno: ${es.titolo.toLowerCase()}. ${es.quando}.`, azione: () => setEsercizio(es), etichetta: 'Inizia' }
  })()

  return (
    <div className="page">
      <PageHeader title="Mente" sub="La parte dell’allenamento che non fa rumore" />

      <section className="card frase-giorno">
        <Quote size={22} />
        <p>{fraseDelGiorno()}</p>
      </section>

      <section className="card">
        <div className="card-title"><span><Brain size={18} style={{ verticalAlign: -3 }} /> Per te oggi</span></div>
        <p style={{ margin: '0 0 10px' }}>{consiglio.testo}</p>
        <button className="btn primary" onClick={consiglio.azione}><Play size={18} /> {consiglio.etichetta}</button>
      </section>

      <section className="card">
        <div className="card-title">Esercizi guidati</div>
        <div className="list">
          {ESERCIZI.map((es) => (
            <button key={es.id} className="item" onClick={() => setEsercizio(es)}>
              <Play size={18} color="var(--accent)" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="title">{es.titolo} <span className="meta">· {es.durata}</span></div>
                <div className="meta">{es.quando}</div>
                <div className="meta" style={{ marginTop: 2, color: 'var(--faint)' }}>{es.perche}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <ListaModificabile chiave="paroleChiave" predefiniti={PAROLE_DEFAULT} titolo="Le tue parole chiave" placeholder="Es. Mani morbide" />
      <ListaModificabile chiave="routineMentale" predefiniti={ROUTINE_DEFAULT} titolo="Routine di gara" segnabile placeholder="Aggiungi un passo" />

      <section className="card">
        <div className="card-title">Dopo la gara</div>
        <p className="prose" style={{ margin: '0 0 10px', fontSize: 14 }}>Tre domande per chiudere la gara: le risposte finiscono nel diario e nelle statistiche di testa e corpo.</p>
        <button className="btn" onClick={() => setRiflessione(true)}><PenLine size={18} /> Rifletti sulla gara</button>
      </section>

      {esercizio && <Guida es={esercizio} onClose={() => setEsercizio(null)} />}
      {riflessione && <Riflessione onClose={() => setRiflessione(false)} />}
    </div>
  )
}
