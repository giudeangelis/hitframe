import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { getConfigAI, LINK_CHIAVI, MODELLI_DEFAULT, NOMI_FORNITORI, provaCollegamento, setConfigAI, type ConfigAI, type Fornitore } from '../ai/ai'
import { useToast } from './ui'
import { getImp, setImp } from '../db/db'

/** Riconosce il fornitore dal formato della chiave. */
export function fornitoreDaChiave(k: string): Fornitore | null {
  const s = k.trim()
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(s)) return 'gemini'
  if (/^sk-ant-/.test(s)) return 'claude'
  if (/^sk-[A-Za-z0-9_-]{20,}/.test(s)) return 'openai'
  return null
}

export default function ImpostazioniAI() {
  const toast = useToast()
  const salvata = useLiveQuery(() => getConfigAI())
  const chat = useLiveQuery(() => getImp<boolean>('chatAI', false))
  const [chiave, setChiave] = useState('')
  const [fornitore, setFornitore] = useState<Fornitore>('gemini')
  const [modello, setModello] = useState('')
  const [stato, setStato] = useState<'idle' | 'in-corso'>('idle')
  const [errore, setErrore] = useState('')
  const [cambia, setCambia] = useState(false)
  if (salvata === undefined) return null

  const riconosciuto = fornitoreDaChiave(chiave)
  const f = riconosciuto ?? fornitore

  async function collega(k = chiave) {
    const ff = fornitoreDaChiave(k) ?? fornitore
    const cfg: ConfigAI = { fornitore: ff, chiave: k.trim(), modello: modello.trim() || MODELLI_DEFAULT[ff] }
    setStato('in-corso')
    setErrore('')
    try {
      await provaCollegamento(cfg)
      await setConfigAI(cfg)
      setChiave('')
      setCambia(false)
      toast(`${NOMI_FORNITORI[ff]} collegato`)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Collegamento non riuscito')
    } finally {
      setStato('idle')
    }
  }

  async function verifica() {
    if (!salvata) return
    setStato('in-corso')
    setErrore('')
    try { toast(await provaCollegamento(salvata)) } catch (e) { setErrore(e instanceof Error ? e.message : 'Collegamento non riuscito') } finally { setStato('idle') }
  }

  const collegata = !!salvata?.chiave && !cambia
  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <span><Sparkles size={18} style={{ verticalAlign: -3 }} /> Assistente AI</span>
        {salvata?.chiave && <span className="badge" style={{ color: 'var(--ok)' }}><CheckCircle2 size={12} /> {NOMI_FORNITORI[salvata.fornitore]}</span>}
      </div>

      {collegata ? (
        <>
          <p className="prose" style={{ margin: 0 }}>
            Collegato a <b>{NOMI_FORNITORI[salvata!.fornitore]}</b>. La chiave resta sul tuo dispositivo e le richieste vanno direttamente al fornitore.
          </p>
          <div className="row">
            <button className="btn" onClick={verifica} disabled={stato === 'in-corso'}>{stato === 'in-corso' ? <><Loader2 size={16} className="spin" /> Verifico…</> : 'Prova collegamento'}</button>
            <button className="btn ghost" onClick={() => setCambia(true)}>Cambia chiave</button>
            <button className="btn ghost" onClick={async () => { await setConfigAI(null); toast('Assistente AI scollegato') }}>Scollega</button>
          </div>
          <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!chat} onChange={(e) => setImp('chatAI', e.target.checked)} />
            <span><b>Chat con il coach AI</b><br /><span className="meta">Un pulsante in basso a destra per fare domande sui tuoi dati, dalla pagina in cui sei. Spegnilo quando non serve.</span></span>
          </label>
        </>
      ) : (
        <>
          <p className="prose" style={{ margin: 0 }}>
            L’AI legge i disegni degli stage, ti scrive il quadro della situazione e risponde in chat sui tuoi dati. Serve una chiave personale: con Google è <b>gratuita</b> e si fa in un minuto.
          </p>
          <ol className="passi-ai">
            <li>
              <span>Apri Google AI Studio ed entra con il tuo account Google.</span>
              <a className="btn primary" href={LINK_CHIAVI.gemini} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ottieni la chiave gratuita</a>
            </li>
            <li><span>Premi <b>“Crea chiave API”</b> e poi <b>copia</b> la chiave (inizia con <code>AIza</code>).</span></li>
            <li><span>Torna qui e incollala: il resto lo fa Hitframe.</span></li>
          </ol>
          <div className="field">
            <label htmlFor="ai-k">Chiave</label>
            <input id="ai-k" className="input" type="password" autoComplete="off" value={chiave} placeholder="Incolla qui la chiave"
              onChange={(e) => setChiave(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text')
                if (fornitoreDaChiave(t)) { e.preventDefault(); setChiave(t.trim()); void collega(t) }
              }} />
            {chiave.trim() && <span className="hint">{riconosciuto ? `Riconosciuta: ${NOMI_FORNITORI[riconosciuto]}` : 'Formato non riconosciuto: scegli il fornitore qui sotto.'}</span>}
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => collega()} disabled={!chiave.trim() || stato === 'in-corso'}>
              {stato === 'in-corso' ? <><Loader2 size={16} className="spin" /> Collego…</> : 'Collega'}
            </button>
            {cambia && <button className="btn ghost" onClick={() => { setCambia(false); setChiave(''); setErrore('') }}>Annulla</button>}
          </div>
          <details className="guida">
            <summary>Usi Claude o ChatGPT?</summary>
            <div className="form" style={{ marginTop: 8 }}>
              <p className="prose" style={{ margin: 0, fontSize: 13 }}>
                Funzionano con una chiave a credito prepagato (l’abbonamento alla chat non basta): <a href={LINK_CHIAVI.claude} target="_blank" rel="noreferrer">chiave Claude</a> · <a href={LINK_CHIAVI.openai} target="_blank" rel="noreferrer">chiave ChatGPT</a>. Incollala sopra: il fornitore si riconosce da solo.
              </p>
              <div className="fields-2">
                <div className="field">
                  <label htmlFor="ai-f">Fornitore</label>
                  <select id="ai-f" className="select" value={f} disabled={!!riconosciuto} onChange={(e) => setFornitore(e.target.value as Fornitore)}>
                    {(Object.keys(NOMI_FORNITORI) as Fornitore[]).map((x) => <option key={x} value={x}>{NOMI_FORNITORI[x]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ai-m">Modello</label>
                  <input id="ai-m" className="input" value={modello} placeholder={MODELLI_DEFAULT[f]} onChange={(e) => setModello(e.target.value)} />
                </div>
              </div>
            </div>
          </details>
        </>
      )}
      {errore && <div role="alert" style={{ color: 'var(--accent-strong)', fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word' }}>{errore}</div>}
    </section>
  )
}
