import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronRight, FileUp, Medal } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, PageHeader, Sheet, useToast } from '../components/ui'
import { db, normalizzaProfilo } from '../db/db'
import { fmtMedio, oggiKey } from '../lib/date'
import { leggiFileRisultati, type LetturaFile } from '../risultati/importa'
import { cercaTiratore, costruisciRisultato, elencoTiratori, nomeLeggibile, trovaPerNome, type RisultatoGara } from '../risultati/motore'
import { getImp, setImp } from '../db/db'
import { Plus, Star, X } from 'lucide-react'

const TIPI = { overall: 'Classifica generale', stage: 'Classifiche degli stage', verify: 'Statini (Score Verification)' }

export default function Risultati() {
  const toast = useToast()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const risultati = useLiveQuery(() => db.risultati.orderBy('data').reverse().toArray())
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const [stato, setStato] = useState<'' | 'lettura'>('')
  const [errore, setErrore] = useState('')
  const [scelta, setScelta] = useState<LetturaFile | null>(null)
  const [coda, setCoda] = useState<LetturaFile[]>([])
  const [filtro, setFiltro] = useState('')

  async function salva(lf: LetturaFile, divisione: string, num: number, vai = true) {
    const r = costruisciRisultato(lf.lettura, divisione, num, lf.data ?? oggiKey())
    // collega la gara del calendario più vicina alla data
    const gare = await db.eventi.where('tipo').equals('gara').toArray()
    const vicina = gare.filter((g) => Math.abs(Date.parse(g.data) - Date.parse(r.data)) <= 3 * 86400000).sort((a, b) => Math.abs(Date.parse(a.data) - Date.parse(r.data)) - Math.abs(Date.parse(b.data) - Date.parse(r.data)))[0]
    r.eventoId = vicina?.id ?? null
    // stessa gara già importata: la sostituisco
    const doppia = (await db.risultati.toArray()).find((x) => x.gara === r.gara && x.data === r.data)
    if (doppia) { r.avversari = doppia.avversari; await db.risultati.delete(doppia.id!) }
    const id = (await db.risultati.add(r)) as number
    if (vai) { toast('Risultati importati'); navigate(`/risultati/${id}`) }
    return id
  }

  /** Dopo una scelta manuale, passa alla gara successiva della coda. */
  function prossima(resto: LetturaFile[]) {
    const [p, ...altre] = resto
    setCoda(altre)
    setScelta(p ?? null)
    setFiltro('')
    if (!p) toast('Risultati importati')
  }

  async function carica(files: FileList | null) {
    if (!files?.length) return
    setErrore('')
    setStato('lettura')
    try {
      const { gare } = await leggiFileRisultati([...files])
      const valide = gare.filter((g) => Object.keys(g.lettura.stage).length)
      if (!valide.length) {
        setErrore(gare.length
          ? 'Manca il PDF delle classifiche degli stage (Stage Results): serve per i calcoli. Aggiungilo insieme agli altri.'
          : 'Non riconosco questi PDF. Servono i risultati esportati dal sistema di gara: Overall, Stage Results e Score Verification.')
        return
      }
      const daScegliere: LetturaFile[] = []
      let ultimo = 0
      for (const lf of valide) {
        const io = profilo?.nome ? cercaTiratore(lf.lettura, profilo.nome) : null
        if (io) ultimo = await salva(lf, io.divisione, io.num, false)
        else daScegliere.push(lf)
      }
      if (daScegliere.length) prossima(daScegliere)
      else if (valide.length === 1) { toast('Risultati importati'); navigate(`/risultati/${ultimo}`) }
      else toast(`${valide.length} gare importate`)
    } catch (e) {
      console.error(e)
      setErrore('Non riesco a leggere questi PDF.')
    } finally {
      setStato('')
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="page">
      <PageHeader title="Risultati" sub="Classifiche, errori, avversari e cosa allenare" />
      <section className="card form">
        <p className="prose" style={{ margin: 0 }}>
          Carica insieme i PDF dei risultati, anche di più gare in una volta: <b>classifica generale</b> (Overall), <b>classifiche degli stage</b> (Stage Results) e <b>statini</b> (Score Verification).
          Ti trovo dal nome del profilo e calcolo dove hai perso punti e quanto pesa ogni errore.
        </p>
        <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => carica(e.target.files)} />
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => input.current?.click()} disabled={stato === 'lettura'}>
          <FileUp size={18} /> {stato === 'lettura' ? 'Leggo i PDF…' : 'Carica i PDF dei risultati'}
        </button>
        {errore && <div className="card avviso"><AlertTriangle size={18} color="var(--accent)" style={{ flexShrink: 0 }} /> {errore}</div>}
      </section>

      {risultati && risultati.length === 0 && <div className="card"><Empty icon={<Medal size={28} />} text="Nessuna gara importata." /></div>}
      {risultati && risultati.length > 0 && (
        <div className="list">
          {risultati.map((r) => {
            const me = r.concorrenti.find((c) => c.num === r.mioNum)
            return (
              <Link key={r.id} to={`/risultati/${r.id}`} className="item">
                <Medal size={22} color="var(--accent)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{r.gara}</div>
                  <div className="meta">{fmtMedio(r.data)} · {r.divisione} · {me ? `${me.pos}° su ${r.concorrenti.length} · ${me.pct.toFixed(2).replace('.', ',')}%` : ''}</div>
                </div>
                <ChevronRight size={18} color="var(--faint)" />
              </Link>
            )
          })}
        </div>
      )}

      {risultati && risultati.length > 0 && <Rivali risultati={risultati} />}

      {scelta && (
        <Sheet title="Chi sei in classifica?" onClose={() => prossima(coda)}>
          <p className="prose" style={{ marginTop: 0 }}><b>{scelta.lettura.gara}</b></p>
          <p className="prose" style={{ marginTop: 0 }}>
            {profilo?.nome ? `Non trovo “${profilo.nome}”.` : 'Nel profilo manca il nome.'} Scegli il tuo nome: {scelta.lettura.tipi.map((t) => TIPI[t]).join(', ')} letti.
          </p>
          <input className="input" placeholder="Cerca cognome" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Cerca cognome" />
          <div className="list" style={{ marginTop: 10, maxHeight: 360, overflow: 'auto' }}>
            {elencoTiratori(scelta.lettura).filter((t) => t.nome.toLowerCase().includes(filtro.toLowerCase())).slice(0, 60).map((t) => (
              <button key={`${t.divisione}-${t.num}`} className="item" style={{ textAlign: 'left', color: 'var(--text)' }} onClick={async () => { const s = scelta; const id = await salva(s, t.divisione, t.num, false); if (coda.length) prossima(coda); else { setScelta(null); toast('Risultati importati'); navigate(`/risultati/${id}`) } }}>
                <div className="title">{t.nome}</div>
                <div className="meta">{t.divisione} · #{t.num}</div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

function Rivali({ risultati }: { risultati: RisultatoGara[] }) {
  const rivali = useLiveQuery(() => getImp<string[]>('rivali', [])) ?? []
  const [nome, setNome] = useState('')
  const nomi = [...new Set(risultati.flatMap((r) => r.concorrenti.filter((c) => c.num !== r.mioNum).map((c) => nomeLeggibile(c.nome))))].sort()
  const aggiungi = async () => {
    const n = nome.trim()
    if (!n) return
    await setImp('rivali', [...new Set([...rivali, n])])
    setNome('')
  }
  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}><span><Star size={18} style={{ verticalAlign: -3 }} /> Avversari che segui</span></div>
      <p className="prose" style={{ margin: 0, fontSize: 13 }}>Scrivi i nomi con cui vuoi il confronto diretto: li ritrovo in ogni gara importata, nella sezione Avversari.</p>
      <div className="row">
        <input className="input" style={{ flex: 1 }} list="nomi-rivali" placeholder="Nome e cognome" aria-label="Nome avversario" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aggiungi()} />
        <datalist id="nomi-rivali">{nomi.map((n) => <option key={n} value={n} />)}</datalist>
        <button className="btn" onClick={aggiungi} disabled={!nome.trim()}><Plus size={16} /> Aggiungi</button>
      </div>
      {rivali.length > 0 && (
        <div className="list">
          {rivali.map((n) => {
            const gare = risultati.map((r) => ({ r, c: trovaPerNome(r, n), io: r.concorrenti.find((x) => x.num === r.mioNum) })).filter((x) => x.c)
            return (
              <div key={n} className="item" style={{ display: 'block' }}>
                <div className="row">
                  <div className="title" style={{ flex: 1 }}>{n}</div>
                  <button className="btn ghost icon" aria-label={`Smetti di seguire ${n}`} onClick={() => setImp('rivali', rivali.filter((x) => x !== n))}><X size={16} /></button>
                </div>
                <div className="meta">
                  {gare.length === 0 ? 'Non presente nelle gare importate (stessa divisione).' : gare.map(({ r, c, io }) => {
                    const d = (io?.punti ?? 0) - c!.punti
                    return <div key={r.id}>{r.gara}: {c!.pos}° · tu {io?.pos}° · {d >= 0 ? `+${d.toFixed(1).replace('.', ',')}` : d.toFixed(1).replace('.', ',')} punti</div>
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
