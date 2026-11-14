import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarSync, Link2Off, LogIn, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db/db'
import {
  avviaAccesso, configVuota, contaInSospeso, getConfig, redirectUri, scollega, setConfig, sincronizzaTutto, tokenValido,
  AccessoRichiesto, type ConfigGoogle,
} from '../google/calendar'
import { useToast } from './ui'

function useConfig(): ConfigGoogle | undefined {
  return useLiveQuery(() => getConfig())
}

/** Pulsante unico: sincronizza se l'accesso è valido, altrimenti passa da Google e poi sincronizza. */
function useSincronizza(ritorno: string) {
  const toast = useToast()
  const [occupato, setOccupato] = useState(false)
  async function vai(cfg: ConfigGoogle) {
    if (!tokenValido()) {
      avviaAccesso(cfg, ritorno, true)
      return
    }
    setOccupato(true)
    try {
      const r = await sincronizzaTutto()
      toast(r.inviati + r.eliminati ? `Google Calendar aggiornato (${r.inviati + r.eliminati} modifiche)` : 'Già tutto aggiornato')
    } catch (e) {
      if (e instanceof AccessoRichiesto) avviaAccesso(cfg, ritorno, true)
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
        <div className="meta">{tokenValido() ? 'Un tocco per sincronizzare.' : 'Serve un rapido accesso a Google, poi parte da sola.'}</div>
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
  const [bozza, setBozza] = useState<{ clientId: string; email: string } | null>(null)
  const { vai, occupato } = useSincronizza('#/impostazioni')
  if (!cfg) return null
  const form = bozza ?? { clientId: cfg.clientId, email: cfg.email }
  const configurato = cfg.attivo && cfg.clientId

  async function collega() {
    const clientId = form.clientId.trim()
    if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
      toast('Il Client ID deve finire con .apps.googleusercontent.com')
      return
    }
    const nuova = { ...(cfg ?? configVuota), clientId, email: form.email.trim(), attivo: true }
    await setConfig(nuova)
    avviaAccesso(nuova, '#/impostazioni', true)
  }

  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <span><CalendarSync size={18} style={{ verticalAlign: -3 }} /> Google Calendar</span>
        {configurato && <span className="badge" style={{ color: tokenValido() ? 'var(--ok)' : 'var(--muted)' }}>{tokenValido() ? 'Collegato' : 'Da riaccedere'}</span>}
      </div>

      {configurato ? (
        <>
          <p className="prose" style={{ margin: 0 }}>
            Gli eventi vanno nel calendario <b>Hitframe</b>{cfg.email ? ` di ${cfg.email}` : ''}: gare con promemoria il giorno prima e 3 giorni prima,
            apertura e scadenza delle iscrizioni con notifica, allenamenti con promemoria un’ora prima.
          </p>
          <p className="prose" style={{ margin: 0, fontSize: 13 }}>
            Ogni modifica viene inviata subito se l’accesso è attivo (dura circa un’ora). Altrimenti resta in coda: trovi il pulsante Sincronizza nel calendario.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => vai(cfg)} disabled={occupato}>
              {tokenValido() ? <RefreshCw size={18} className={occupato ? 'spin' : ''} /> : <LogIn size={18} />}
              {tokenValido() ? 'Sincronizza tutto' : 'Accedi e sincronizza'}
            </button>
            <button className="btn ghost" onClick={async () => { await scollega(); toast('Google Calendar scollegato') }}>
              <Link2Off size={18} /> Scollega
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="prose" style={{ margin: 0 }}>
            Collega il tuo account Google: Hitframe crea un calendario <b>Hitframe</b> e ci tiene allineati gare, allenamenti e scadenze di iscrizione, con le notifiche sul telefono.
            L’app può vedere e modificare solo quel calendario, non gli altri.
          </p>
          <details className="guida">
            <summary>Prima volta: crea il Client ID (5 minuti, gratis)</summary>
            <ol>
              <li>Apri <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a> con il tuo account e crea un progetto, per esempio “Hitframe”.</li>
              <li>In <b>API e servizi → Libreria</b> cerca <b>Google Calendar API</b> e premi <b>Abilita</b>.</li>
              <li>In <b>Schermata consenso OAuth</b> (Google Auth Platform): tipo <b>Esterno</b>, nome app “Hitframe”, la tua email. In <b>Pubblico / Utenti di test</b> aggiungi l’indirizzo Gmail che vuoi collegare.</li>
              <li>In <b>Client → Crea client</b>: tipo <b>Applicazione web</b>. In <b>Origini JavaScript autorizzate</b> metti <code>{window.location.origin}</code>, in <b>URI di reindirizzamento autorizzati</b> metti <code>{redirectUri()}</code>.</li>
              <li>Copia il <b>Client ID</b> e incollalo qui sotto.</li>
            </ol>
          </details>
          <div className="field">
            <label htmlFor="g-client">Client ID</label>
            <input id="g-client" className="input" value={form.clientId} onChange={(e) => setBozza({ ...form, clientId: e.target.value })}
              placeholder="123456789-abc.apps.googleusercontent.com" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="g-email">Account Google</label>
            <input id="g-email" type="email" className="input" value={form.email} onChange={(e) => setBozza({ ...form, email: e.target.value })}
              placeholder="nome@gmail.com" autoComplete="email" />
          </div>
          <div className="row">
            <button className="btn primary" onClick={collega} disabled={!form.clientId.trim()}><LogIn size={18} /> Collega Google Calendar</button>
          </div>
        </>
      )}
    </section>
  )
}
