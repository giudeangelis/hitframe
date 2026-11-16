import { useLiveQuery } from 'dexie-react-hooks'
import { BadgeCheck, Copy, KeyRound, Lock, Mail, Share2, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Segmented, useToast } from '../components/ui'
import { getImp, setImp } from '../db/db'
import { getAccount } from '../google/auth'
import { fmt } from '../lib/date'
import {
  calcolaStato, CHIAVE_PUBBLICA, chiavePubblicaDa, CONTATTO, firmaLicenza, GIORNI_PROVA, impostaStato, leggiLicenza, NOMI_LICENZA, scadenzaPer, useLicenza,
  type DatiLicenza, type TipoLicenza,
} from './licenza'

/** Tiene aggiornato lo stato della licenza (da montare una volta, nel layout). */
export function GestoreLicenza() {
  const chiave = useLiveQuery(() => getImp<string | null>('licenza', null))
  const inizio = useLiveQuery(() => getImp<string | null>('inizioProva', null))
  const [account, setAcc] = useState(getAccount())
  useEffect(() => {
    const f = () => setAcc(getAccount())
    window.addEventListener('hf-account', f)
    return () => window.removeEventListener('hf-account', f)
  }, [])
  useEffect(() => {
    if (chiave === undefined || inizio === undefined) return
    if (!account) { impostaStato({ tipo: 'libera', giorniRimasti: null, scade: null, dati: null, inizioProva: null }); return }
    // primo accesso: parte la prova (la data viaggia con la sincronizzazione su tutti i dispositivi)
    if (!inizio) { void setImp('inizioProva', new Date().toISOString()); return }
    void calcolaStato(chiave, inizio, account.email).then(impostaStato)
  }, [chiave, inizio, account])
  // a mezzanotte la prova può finire: ricontrollo ogni ora
  useEffect(() => {
    const t = setInterval(() => {
      if (account && inizio) void calcolaStato(chiave ?? null, inizio, account.email).then(impostaStato)
    }, 3600_000)
    return () => clearInterval(t)
  }, [chiave, inizio, account])
  return null
}

/** Barra in alto: sempre visibile in sola lettura, altrimenti solo negli ultimi giorni. */
export function BannerLicenza() {
  const s = useLicenza()
  if (s.tipo === 'scaduta') {
    return (
      <Link to="/impostazioni#licenza" className="banner-licenza bloccato">
        <Lock size={16} /> <span><b>Sola lettura</b> · la prova è finita. I tuoi dati sono al sicuro: inserisci una licenza per continuare.</span>
      </Link>
    )
  }
  if ((s.tipo === 'prova' || s.tipo === 'licenza') && s.giorniRimasti !== null && s.giorniRimasti <= 3) {
    return (
      <Link to="/impostazioni#licenza" className="banner-licenza">
        <Timer size={16} /> <span>{s.tipo === 'prova' ? 'Prova gratuita' : 'Licenza'}: {s.giorniRimasti === 1 ? 'ultimo giorno' : `ancora ${s.giorniRimasti} giorni`}</span>
      </Link>
    )
  }
  return null
}

/** Una riga discreta per la Home durante la prova. */
export function RigaProva() {
  const s = useLicenza()
  if (s.tipo !== 'prova' || (s.giorniRimasti ?? 0) <= 3) return null
  return <Link to="/impostazioni#licenza" className="riga-prova"><Timer size={14} /> Prova gratuita: {s.giorniRimasti} giorni</Link>
}

const mailRichiesta = (email: string) =>
  `mailto:${CONTATTO}?subject=${encodeURIComponent('Licenza Hitframe')}&body=${encodeURIComponent(`Ciao, vorrei una licenza Hitframe per l’account ${email}.`)}`

/** Sezione "Licenza" in Impostazioni. */
export function SezioneLicenza() {
  const toast = useToast()
  const s = useLicenza()
  const account = getAccount()
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState('')
  const firmaLocale = (() => { try { return !!localStorage.getItem('hf-chiave-firma') } catch { return false } })()
  if (!account) return null

  async function attiva() {
    setErrore('')
    const d = await leggiLicenza(codice)
    if (typeof d === 'string') { setErrore(d); return }
    if (d.e.toLowerCase() !== account!.email.toLowerCase()) { setErrore(`Questa licenza è per ${d.e}, ma sei entrato con ${account!.email}.`); return }
    if (d.x && d.x < new Date().toISOString().slice(0, 10)) { setErrore(`Licenza scaduta il ${fmt(d.x, 'd MMM yyyy')}.`); return }
    await setImp('licenza', codice.trim())
    setCodice('')
    toast(`Licenza ${NOMI_LICENZA[d.t].toLowerCase()} attivata`)
  }

  const descr = s.tipo === 'licenza'
    ? s.dati?.t === 'perpetua' ? 'Licenza perpetua attiva.' : `Licenza ${NOMI_LICENZA[s.dati!.t].toLowerCase()} attiva fino al ${fmt(s.scade!, 'd MMM yyyy')}.`
    : s.tipo === 'prova' ? `Prova gratuita di ${GIORNI_PROVA} giorni: ${s.giorniRimasti === 1 ? 'ultimo giorno' : `ancora ${s.giorniRimasti} giorni`} (fino al ${fmt(s.scade!, 'd MMM yyyy')}).`
    : s.tipo === 'scaduta' ? `La prova è finita il ${fmt(s.scade!, 'd MMM yyyy')}: Hitframe è in sola lettura. I tuoi dati restano tutti; con una licenza riparti da dove eri.`
    : ''

  return (
    <section className="card form" id="licenza">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <span><KeyRound size={18} style={{ verticalAlign: -3 }} /> Licenza</span>
        {s.tipo === 'licenza' && <span className="badge" style={{ color: 'var(--ok)' }}><BadgeCheck size={12} /> {NOMI_LICENZA[s.dati!.t]}</span>}
        {s.tipo === 'scaduta' && <span className="badge" style={{ color: 'var(--accent-strong)' }}><Lock size={12} /> Sola lettura</span>}
      </div>
      <p className="prose" style={{ margin: 0 }}>{descr}</p>
      {!(s.tipo === 'licenza' && s.dati?.t === 'perpetua') && (
        <>
          <div className="field">
            <label htmlFor="lic-cod">Codice di licenza</label>
            <textarea id="lic-cod" className="input" rows={2} value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="HF1-…" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
            <span className="hint">La licenza vale per l’account con cui sei entrato: <b>{account.email}</b>.</span>
          </div>
          <div className="row">
            <button className="btn primary" onClick={attiva} disabled={!codice.trim()}>Attiva</button>
            <a className="btn ghost" href={mailRichiesta(account.email)}><Mail size={16} /> Chiedi una licenza</a>
          </div>
          {errore && <div role="alert" style={{ color: 'var(--accent-strong)', fontSize: 13 }}>{errore}</div>}
        </>
      )}
      {firmaLocale && <Link to="/licenze" className="btn ghost" style={{ alignSelf: 'flex-start' }}><KeyRound size={16} /> Genera licenze</Link>}
    </section>
  )
}

interface Emessa extends DatiLicenza { codice: string; creata: string }

/** Pagina riservata (#/licenze): genera licenze firmate. Funziona solo con la chiave privata di chi distribuisce l'app. */
export function PaginaLicenze() {
  const toast = useToast()
  const [privata, setPrivata] = useState(() => { try { return localStorage.getItem('hf-chiave-firma') ?? '' } catch { return '' } })
  const [bozzaPriv, setBozzaPriv] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoLicenza>('g14')
  const [ultimo, setUltimo] = useState<Emessa | null>(null)
  const emesse = useLiveQuery(() => getImp<Emessa[]>('licenzeEmesse', [])) ?? []

  useEffect(() => {
    if (!privata) { setOk(null); return }
    void chiavePubblicaDa(privata).then((p) => setOk(p === CHIAVE_PUBBLICA)).catch(() => setOk(false))
  }, [privata])

  async function salvaPriv() {
    const k = bozzaPriv.trim()
    try {
      if ((await chiavePubblicaDa(k)) !== CHIAVE_PUBBLICA) { toast('Chiave di firma non corretta'); return }
    } catch { toast('Chiave di firma non corretta'); return }
    localStorage.setItem('hf-chiave-firma', k)
    setPrivata(k)
    setBozzaPriv('')
  }

  async function genera(e: React.FormEvent) {
    e.preventDefault()
    const d: DatiLicenza = { e: email.trim().toLowerCase(), t: tipo, i: new Date().toISOString().slice(0, 10), x: scadenzaPer(tipo), ...(nome.trim() ? { n: nome.trim() } : {}) }
    const codice = await firmaLicenza(d, privata)
    const nuova: Emessa = { ...d, codice, creata: new Date().toISOString() }
    await setImp('licenzeEmesse', [nuova, ...emesse])
    setUltimo(nuova)
    setEmail(''); setNome('')
  }

  const testoInvio = (x: Emessa) => `Ciao${x.n ? ` ${x.n}` : ''}! Ecco la tua licenza Hitframe (${NOMI_LICENZA[x.t].toLowerCase()}${x.x ? `, valida fino al ${fmt(x.x, 'd MMM yyyy')}` : ''}).\n\n1. Apri https://hitframe.github.io ed entra con Google usando ${x.e}\n2. Impostazioni → Licenza → incolla il codice e premi Attiva\n\n${x.codice}`
  const copia = async (t: string) => { await navigator.clipboard.writeText(t); toast('Copiato') }
  const condividi = async (x: Emessa) => {
    const t = testoInvio(x)
    if (navigator.share) { try { await navigator.share({ text: t }) } catch { /* annullato */ } } else await copia(t)
  }

  if (!privata || ok === false) {
    return (
      <div className="page">
        <PageHeader title="Genera licenze" sub="Riservato a chi distribuisce Hitframe" />
        <section className="card form">
          <p className="prose" style={{ margin: 0 }}>Incolla la chiave di firma (resta solo su questo dispositivo).</p>
          <input className="input" type="password" value={bozzaPriv} onChange={(e) => setBozzaPriv(e.target.value)} placeholder="Chiave di firma" aria-label="Chiave di firma" />
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={salvaPriv} disabled={!bozzaPriv.trim()}>Continua</button>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Genera licenze" sub={`${emesse.length} licenze emesse`} />
      <form className="card form" onSubmit={genera}>
        <div className="field">
          <label htmlFor="gl-email">Email Google del tiratore</label>
          <input id="gl-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" />
        </div>
        <div className="field">
          <label htmlFor="gl-nome">Nome (facoltativo)</label>
          <input id="gl-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <Segmented<TipoLicenza> label="Tipo" value={tipo} onChange={setTipo}
          options={[{ value: 'g14', label: '14 giorni' }, { value: 'g30', label: '30 giorni' }, { value: 'perpetua', label: 'Perpetua' }]} />
        <span className="hint" style={{ marginTop: -8 }}>{tipo === 'perpetua' ? 'Non scade mai.' : `Valida da oggi fino al ${fmt(scadenzaPer(tipo)!, 'd MMM yyyy')}.`}</span>
        <button className="btn primary" type="submit" style={{ alignSelf: 'flex-start' }}><KeyRound size={16} /> Genera</button>
      </form>

      {ultimo && (
        <section className="card form">
          <div className="card-title" style={{ marginBottom: 0 }}>Licenza per {ultimo.e}</div>
          <code className="codice-licenza">{ultimo.codice}</code>
          <div className="row">
            <button className="btn primary" onClick={() => condividi(ultimo)}><Share2 size={16} /> Invia</button>
            <button className="btn" onClick={() => copia(ultimo.codice)}><Copy size={16} /> Copia codice</button>
          </div>
        </section>
      )}

      {emesse.length > 0 && (
        <section className="card">
          <div className="card-title">Licenze emesse</div>
          <div className="list">
            {emesse.map((x) => (
              <div key={x.codice} className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.n ? `${x.n} · ` : ''}{x.e}</div>
                  <div className="meta">{NOMI_LICENZA[x.t]} · emessa il {fmt(x.i, 'd MMM yyyy')}{x.x ? ` · scade il ${fmt(x.x, 'd MMM yyyy')}` : ''}</div>
                </div>
                <button className="btn icon ghost" aria-label="Invia di nuovo" onClick={() => condividi(x)}><Share2 size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
