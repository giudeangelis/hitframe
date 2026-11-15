import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { getConfigAI, LINK_CHIAVI, MODELLI_DEFAULT, NOMI_FORNITORI, provaCollegamento, setConfigAI, type ConfigAI, type Fornitore } from '../ai/ai'
import { useToast } from './ui'
import { getImp, setImp } from '../db/db'

export default function ImpostazioniAI() {
  const toast = useToast()
  const salvata = useLiveQuery(() => getConfigAI())
  const [bozza, setBozza] = useState<ConfigAI | null>(null)
  const [prova, setProva] = useState<'idle' | 'in-corso'>('idle')
  const [errore, setErrore] = useState('')
  const chat = useLiveQuery(() => getImp<boolean>('chatAI', false))
  if (salvata === undefined) return null
  const c: ConfigAI = bozza ?? salvata ?? { fornitore: 'claude', chiave: '', modello: MODELLI_DEFAULT.claude }
  const set = (x: Partial<ConfigAI>) => setBozza({ ...c, ...x })

  async function salva() {
    await setConfigAI({ ...c, modello: c.modello.trim() || MODELLI_DEFAULT[c.fornitore] })
    setBozza(null)
    toast('Assistente AI salvato')
  }

  async function verifica() {
    setProva('in-corso')
    setErrore('')
    try {
      toast(await provaCollegamento(c))
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Collegamento non riuscito')
    } finally {
      setProva('idle')
    }
  }

  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <span><Sparkles size={18} style={{ verticalAlign: -3 }} /> Assistente AI</span>
        {salvata?.chiave && <span className="badge" style={{ color: 'var(--ok)' }}><CheckCircle2 size={12} /> {NOMI_FORNITORI[salvata.fornitore]}</span>}
      </div>
      <p className="prose" style={{ margin: 0 }}>
        Facoltativo. Legge i disegni degli stage e propone la mappa (posizioni e bersagli) che poi correggi tu.
        La chiave resta su questo dispositivo e le richieste vanno direttamente al fornitore: il costo, se c’è, è sul tuo account.
      </p>
      <div className="field">
        <label htmlFor="ai-f">Fornitore</label>
        <select id="ai-f" className="select" value={c.fornitore} onChange={(e) => {
          const f = e.target.value as Fornitore
          set({ fornitore: f, modello: MODELLI_DEFAULT[f] })
        }}>
          {(Object.keys(NOMI_FORNITORI) as Fornitore[]).map((f) => <option key={f} value={f}>{NOMI_FORNITORI[f]}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ai-k">Chiave API</label>
        <input id="ai-k" className="input" type="password" autoComplete="off" value={c.chiave} onChange={(e) => set({ chiave: e.target.value })} placeholder="Incolla la chiave" />
        <span className="hint">Si crea qui: <a href={LINK_CHIAVI[c.fornitore]} target="_blank" rel="noreferrer">{LINK_CHIAVI[c.fornitore].replace('https://', '')}</a>{c.fornitore === 'claude' ? ' (l’abbonamento a Claude non include le API: serve credito sulla console)' : ''}</span>
      </div>
      <div className="field">
        <label htmlFor="ai-m">Modello</label>
        <input id="ai-m" className="input" value={c.modello} onChange={(e) => set({ modello: e.target.value })} />
        <span className="hint">Lascia quello proposto, salvo novità del fornitore.</span>
      </div>
      <div className="row">
        <button className="btn primary" onClick={salva} disabled={!c.chiave.trim()}>Salva</button>
        <button className="btn" onClick={verifica} disabled={!c.chiave.trim() || prova === 'in-corso'}>{prova === 'in-corso' ? 'Verifico…' : 'Prova collegamento'}</button>
        {salvata && <button className="btn ghost" onClick={async () => { await setConfigAI(null); setBozza(null); toast('Assistente AI scollegato') }}>Scollega</button>}
      </div>
      {salvata && (
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!chat} onChange={(e) => setImp('chatAI', e.target.checked)} />
          <span><b>Chat con il coach AI</b><br /><span className="meta">Un pulsante in basso a destra per fare domande sui tuoi dati, dalla pagina in cui sei. Spegnilo quando non serve.</span></span>
        </label>
      )}
      {errore && <div role="alert" style={{ color: 'var(--accent-strong)', fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word' }}>{errore}</div>}
    </section>
  )
}
