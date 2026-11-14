import { RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader, Segmented, useToast } from '../components/ui'
import { db, nowIso, profiloVuoto } from '../db/db'
import { CATEGORIE, CLASSI, DIVISIONI, TEMPI_DEFAULT, type Profilo as P, type TempiPersonali } from '../db/types'

const TEMPI: { k: keyof TempiPersonali; nome: string; desc: string; unita: string; step: number }[] = [
  { k: 'estrazione', nome: 'Estrazione', desc: 'Dal beep al primo colpo, bersaglio a 7 m, mani in posizione di resa', unita: 's', step: 0.01 },
  { k: 'split', nome: 'Split', desc: 'Tra due colpi sullo stesso bersaglio a 7–10 m', unita: 's', step: 0.01 },
  { k: 'transizioneVicina', nome: 'Transizione vicina', desc: 'Tra bersagli a circa 1 m di distanza', unita: 's', step: 0.01 },
  { k: 'transizioneLontana', nome: 'Transizione lontana', desc: 'Tra bersagli distanti o con grande angolo', unita: 's', step: 0.01 },
  { k: 'ricarica', nome: 'Ricarica', desc: 'Dall’ultimo colpo al primo colpo dopo il cambio caricatore', unita: 's', step: 0.01 },
  { k: 'entrataPosizione', nome: 'Entrata in posizione', desc: 'Dall’arrivo in posizione al primo colpo', unita: 's', step: 0.01 },
  { k: 'uscitaPosizione', nome: 'Uscita dalla posizione', desc: 'Dall’ultimo colpo al primo passo', unita: 's', step: 0.01 },
  { k: 'colpoPiastra', nome: 'Colpo su piastra', desc: 'Colpo singolo su metallo a media distanza', unita: 's', step: 0.01 },
  { k: 'velocitaMovimento', nome: 'Velocità di movimento', desc: 'Media tra posizioni, comprese partenza e frenata', unita: 'm/s', step: 0.1 },
]

const f2 = (n: number) => n.toFixed(2).replace('.', ',')

export default function Profilo() {
  const toast = useToast()
  const [p, setP] = useState<P | null>(null)
  const [testi, setTesti] = useState<Record<string, string>>({})
  const [sporco, setSporco] = useState(false)

  useEffect(() => {
    db.profilo.get('me').then((x) => {
      const base = x ?? profiloVuoto() // primo avvio: profilo vuoto
      setP(base)
      setTesti(Object.fromEntries(TEMPI.map((t) => [t.k, String(base.tempi[t.k]).replace('.', ',')])))
    })
  }, [])

  if (!p) return <div className="page"><PageHeader title="Profilo" /></div>

  const set = <K extends keyof P>(k: K, v: P[K]) => { setP({ ...p, [k]: v }); setSporco(true) }

  const setTempo = (k: keyof TempiPersonali, raw: string) => {
    setTesti((t) => ({ ...t, [k]: raw }))
    const n = Number(raw.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) {
      setP((prev) => prev && { ...prev, tempi: { ...prev.tempi, [k]: n } })
    }
    setSporco(true)
  }

  const ripristinaTempi = () => {
    setP({ ...p, tempi: { ...TEMPI_DEFAULT } })
    setTesti(Object.fromEntries(TEMPI.map((t) => [t.k, String(TEMPI_DEFAULT[t.k]).replace('.', ',')])))
    setSporco(true)
  }

  async function salva() {
    if (!p) return
    await db.profilo.put({ ...p, aggiornato: nowIso() })
    setSporco(false)
    toast('Profilo salvato')
  }

  const t = p.tempi
  const billDrill = t.estrazione + 5 * t.split
  const elPresidente = t.estrazione + 0.35 + 6 * t.split + 4 * t.transizioneVicina + t.ricarica
  const spostamento5m = t.uscitaPosizione + 5 / t.velocitaMovimento + t.entrataPosizione

  return (
    <div className="page">
      <PageHeader
        title="Profilo"
        sub="I tuoi dati e i tuoi tempi: la base di ogni calcolo"
        actions={<button className="btn primary" onClick={salva} disabled={!sporco}><Save size={18} /> Salva</button>}
      />

      <section className="card form">
        <div className="card-title" style={{ marginBottom: 0 }}>Atleta</div>
        <div className="field">
          <label htmlFor="p-nome">Nome</label>
          <input id="p-nome" className="input" value={p.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="p-div">Divisione</label>
            <select id="p-div" className="select" value={p.divisione} onChange={(e) => set('divisione', e.target.value as P['divisione'])}>
              {DIVISIONI.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-classe">Classe</label>
            <select id="p-classe" className="select" value={p.classe} onChange={(e) => set('classe', e.target.value as P['classe'])}>
              {CLASSI.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="p-cat">Categoria</label>
            <select id="p-cat" className="select" value={p.categoria} onChange={(e) => set('categoria', e.target.value)}>
              {CATEGORIE.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-club">Club</label>
            <input id="p-club" className="input" value={p.club} onChange={(e) => set('club', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="p-arma">Arma principale</label>
          <input id="p-arma" className="input" value={p.arma} onChange={(e) => set('arma', e.target.value)} placeholder="Marca e modello" />
        </div>
        <div className="field">
          <span className="label">Mano forte</span>
          <Segmented label="Mano forte" value={p.manoForte} onChange={(v) => set('manoForte', v)}
            options={[{ value: 'destra', label: 'Destra' }, { value: 'sinistra', label: 'Sinistra' }]} />
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-title">
            <span>Tempi personali</span>
            <button className="btn ghost" onClick={ripristinaTempi} style={{ minHeight: 36 }}><RotateCcw size={16} /> Predefiniti</button>
          </div>
          <p className="prose" style={{ margin: '0 0 6px', fontSize: 13 }}>
            Inserisci i tuoi valori medi, non i migliori. Con il modulo Timer si aggiorneranno da soli.
          </p>
          {TEMPI.map((x) => (
            <div key={x.k} className="tempo-row">
              <div>
                <label className="n" htmlFor={`t-${x.k}`}>{x.nome}</label>
                <div className="d">{x.desc}</div>
              </div>
              <div className="unit-input">
                <input id={`t-${x.k}`} className="input" inputMode="decimal" value={testi[x.k] ?? ''} onChange={(e) => setTempo(x.k, e.target.value)} />
                <span>{x.unita}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-title">Stime con i tuoi tempi</div>
          <p className="prose" style={{ margin: '0 0 12px', fontSize: 13 }}>
            Un assaggio del motore di calcolo: con gli stessi tempi Hitframe stimerà drill e stage.
          </p>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' }}>
            <div className="stat">
              <div className="v">{f2(billDrill)} s</div>
              <div className="l">Bill Drill: estrazione e 6 colpi su un bersaglio</div>
            </div>
            <div className="stat">
              <div className="v">{f2(elPresidente)} s</div>
              <div className="l">El Presidente: giro, 12 colpi su 3 bersagli, una ricarica</div>
            </div>
            <div className="stat">
              <div className="v">{f2(spostamento5m)} s</div>
              <div className="l">Cambio posizione di 5 m: uscita, movimento ed entrata</div>
            </div>
          </div>
        </section>
      </div>

      {sporco && (
        <div className="row" style={{ position: 'sticky', bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 12px)', justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={salva}><Save size={18} /> Salva modifiche</button>
        </div>
      )}
    </div>
  )
}
