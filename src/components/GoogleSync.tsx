import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarSync, Link2Off, LogIn, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db/db'
import {
  configVuota, contaInSospeso, getConfig, scollega, setConfig, sincronizzaTutto, tokenValido,
  AccessoRichiesto, type ConfigGoogle,
} from '../google/calendar'
import { avviaAccesso, getAccount } from '../google/auth'
import { useToast } from './ui'

function useConfig(): ConfigGoogle | undefined {
  return useLiveQuery(() => getConfig())
}

/** Pulsante unico: sincronizza se l'accesso è valido, altrimenti passa da Google e poi sincronizza. */
function useSincronizza(ritorno: string) {
  const toast = useToast()
  const [occupato, setOccupato] = useState(false)
  async function vai(_cfg: ConfigGoogle) {
    if (!tokenValido()) {
      avviaAccesso({ ritorno, calendario: true, dopo: 'calendario' })
      return
    }
    setOccupato(true)
    try {
      const r = await sincronizzaTutto()
      toast(r.inviati + r.eliminati ? `Google Calendar aggiornato (${r.inviati + r.eliminati} modifiche)` : 'Già tutto aggiornato')
    } catch (e) {
      if (e instanceof AccessoRichiesto) avviaAccesso({ ritorno, calendario: true, dopo: 'calendario' })
      else toast(e instanceof Error ? e.message : 'Sincronizzazione non riuscita')
    } finally {
      setOccupato(false)
    }
  }
  return { vai, occupato }
}

/** Avviso nel calendario quando ci sono modifiche da inviare. */
export function BannerGoogle() {
  const cfg = useConfig()
  const n = useLiveQuery(() => contaInSospeso(), [], 0)
  const { vai, occupato } = useSincronizza('#/calendario')
  useLiveQuery(() => db.eventi.count()) // ricalcola quando cambiano gli eventi
  if (!cfg?.attivo || !n) return null
  return (
    <div className="item" style={{ cursor: 'default' }}>
      <CalendarSync size={20} color="var(--accent)" />
      <div style={{ flex: 1 }}>
        <div className="title">{n === 1 ? '1 modifica' : `${n} modifiche`} da inviare a Google Calendar</div>
        <div className="meta">{tokenValido() ? 'Un tocco per inviarle.' : 'Un tocco: rapido passaggio da Google, poi parte da sola.'}</div>
      </div>
      <button className="btn primary" onClick={() => vai(cfg)} disabled={occupato}>
        <RefreshCw size={16} className={occupato ? 'spin' : ''} /> Sincronizza
      </button>
    </div>
  )
}

/** Sezione nelle impostazioni. */
export function ImpostazioniGoogle() {
  const cfg = useConfig()
  const toast = useToast()
  const { vai, occupato } = useSincronizza('#/impostazioni')
  const account = getAccount()
  if (!cfg) return null
  const attivo = cfg.attivo

  async function attiva() {
    const nuova = { ...(cfg ?? configVuota), email: account?.email ?? '', attivo: true }
    await setConfig(nuova)
    if (tokenValido()) {
      try {
        const r = await sincronizzaTutto()
        toast(`Google Calendar collegato (${r.inviati} eventi inviati)`)
      } catch {
        avviaAccesso({ ritorno: '#/impostazioni', calendario: true, dopo: 'calendario' })
      }
    } else {
      avviaAccesso({ ritorno: '#/impostazioni', calendario: true, dopo: 'calendario' })
    }
  }

  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <span><CalendarSync size={18} style={{ verticalAlign: -3 }} /> Google Calendar</span>
        {attivo && <span className="badge" style={{ color: 'var(--ok)' }}>Attivo</span>}
      </div>
      {attivo ? (
        <>
          <p className="prose" style={{ margin: 0 }}>
            Gli eventi vanno nel calendario <b>Hitframe</b>{account?.email ? ` di ${account.email}` : ''}: gare con promemoria il giorno prima e 3 giorni prima,
            apertura e scadenza delle iscrizioni con notifica, allenamenti con promemoria un’ora prima. Si aggiorna da solo insieme alla sincronizzazione.
          </p>
          <div className="row">
            <button className="btn" onClick={() => vai(cfg)} disabled={occupato}>
              {tokenValido() ? <RefreshCw size={18} className={occupato ? 'spin' : ''} /> : <LogIn size={18} />}
              {tokenValido() ? 'Aggiorna ora' : 'Accedi e aggiorna'}
            </button>
            <button className="btn ghost" onClick={async () => { await scollega(); toast('Google Calendar scollegato') }}>
              <Link2Off size={18} /> Scollega
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="prose" style={{ margin: 0 }}>
            Hitframe crea nel tuo Google Calendar un calendario <b>Hitframe</b> con gare, allenamenti e scadenze di iscrizione, con le notifiche sul telefono.
            Può vedere e modificare solo quel calendario, non gli altri.
          </p>
          <div className="row">
            <button className="btn primary" onClick={attiva} disabled={!account}><LogIn size={18} /> Attiva Google Calendar</button>
          </div>
        </>
      )}
    </section>
  )
}
