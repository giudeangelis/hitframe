import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, Download, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getAccount } from '../google/auth'
import { elencoCopie, esciDalDispositivo, scaricaCopia } from '../sync/collega'
import { rinnovaAccesso, sincronizzaOra, useStatoSync } from '../sync/stato'
import { descriviStato } from './NuvolaSync'
import { useToast } from './ui'

/** Account Google e sincronizzazione. */
export default function ImpostazioniAccount() {
  const toast = useToast()
  const s = useStatoSync()
  const account = getAccount()
  const copie = useLiveQuery(() => elencoCopie(), [], [])
  const [conferma, setConferma] = useState(false)
  const [uscendo, setUscendo] = useState(false)
  if (!account) return null

  async function esci() {
    setUscendo(true)
    await esciDalDispositivo()
  }

  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <span><Cloud size={18} style={{ verticalAlign: -3 }} /> Account e sincronizzazione</span>
      </div>
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        {account.foto && <img src={account.foto} alt="" width={40} height={40} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />}
        <div>
          <div style={{ fontWeight: 700 }}>{account.nome || account.email}</div>
          <div className="meta" style={{ color: 'var(--muted)', fontSize: 13 }}>{account.email}</div>
        </div>
      </div>
      <p className="prose" style={{ margin: 0 }}>
        I dati sono salvati su questo dispositivo e nel tuo Google Drive, in una cartella nascosta che vede solo Hitframe.
        Si allineano da soli tra telefono e computer. I PDF delle gare restano sul dispositivo dove li hai caricati.
      </p>
      <div className="meta" style={{ fontSize: 13, color: s.fase === 'errore' || s.fase === 'accesso' ? 'var(--accent-strong)' : 'var(--muted)' }}>{descriviStato(s)}</div>
      <div className="row">
        {s.fase === 'accesso'
          ? <button className="btn primary" onClick={() => rinnovaAccesso(false)}><RefreshCw size={18} /> Accedi e sincronizza</button>
          : <button className="btn" onClick={() => sincronizzaOra().then(() => toast('Sincronizzazione completata'))} disabled={s.fase === 'in-corso'}>
              <RefreshCw size={18} className={s.fase === 'in-corso' ? 'spin' : ''} /> Sincronizza ora
            </button>}
        {conferma ? (
          <>
            <button className="btn danger" onClick={esci} disabled={uscendo}><LogOut size={18} /> Sì, esci</button>
            <button className="btn ghost" onClick={() => setConferma(false)}>Annulla</button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setConferma(true)}><LogOut size={18} /> Esci</button>
        )}
      </div>
      {conferma && (
        <div className="hint" style={{ fontSize: 12, color: 'var(--faint)' }}>
          Uscendo, i dati vengono tolti da questo dispositivo ma restano nel tuo Google Drive: tornano quando rientri.
        </div>
      )}
      {copie.length > 0 && (
        <details className="guida">
          <summary>Copie di sicurezza ({copie.length})</summary>
          <p className="prose" style={{ fontSize: 13 }}>Copie salvate su questo dispositivo quando dei dati sono stati sostituiti. Si aprono con Ripristina.</p>
          {copie.map((c) => (
            <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>{c.motivo} · {format(new Date(c.creato), 'd MMM yyyy HH:mm', { locale: it })}</span>
              <button className="btn ghost" onClick={() => scaricaCopia(c)}><Download size={16} /> Scarica</button>
            </div>
          ))}
        </details>
      )}
    </section>
  )
}
