import { Cloud, CloudAlert, CloudOff, LogIn, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { rinnovaAccesso, sincronizzaOra, useStatoSync, type StatoSync } from '../sync/stato'
import { getAccount } from '../google/auth'

export function descriviStato(s: StatoSync): string {
  const quando = s.ultima ? formatDistanceToNow(new Date(s.ultima), { locale: it, addSuffix: true }) : null
  switch (s.fase) {
    case 'in-corso': return 'Sincronizzo…'
    case 'in-attesa': return 'Modifiche in invio tra pochi secondi'
    case 'offline': return 'Senza rete: le modifiche partono quando torna'
    case 'accesso': return 'Tocca per riaccedere a Google e sincronizzare'
    case 'errore': return `Sincronizzazione non riuscita: ${s.messaggio}`
    case 'ok': return quando ? `Tutto sincronizzato (${quando})` : 'Tutto sincronizzato'
    default: return 'Sincronizzazione spenta'
  }
}

/** La nuvoletta nella barra in alto. */
export default function NuvolaSync({ conTesto = false }: { conTesto?: boolean }) {
  const s = useStatoSync()
  if (!getAccount()) return null
  const titolo = descriviStato(s)
  const Icona = s.fase === 'in-corso' ? RefreshCw
    : s.fase === 'offline' ? CloudOff
    : s.fase === 'accesso' ? LogIn
    : s.fase === 'errore' ? CloudAlert
    : Cloud
  const colore = s.fase === 'errore' || s.fase === 'accesso' ? 'var(--accent-strong)' : s.fase === 'ok' ? 'var(--ok)' : 'var(--muted)'
  return (
    <button
      className={conTesto ? 'nav-link nuvola nuvola-testo' : 'btn icon ghost topbar-btn nuvola'}
      aria-label={titolo}
      title={titolo}
      onClick={() => (s.fase === 'accesso' ? rinnovaAccesso(true) : void sincronizzaOra())}
      style={{ color: colore }}
    >
      <Icona size={21} className={s.fase === 'in-corso' ? 'spin' : ''} />
      {s.fase === 'in-attesa' && <span className="nuvola-punto" />}
      {conTesto && <span className="nuvola-etichetta">{s.fase === 'ok' ? 'Sincronizzato' : s.fase === 'in-corso' ? 'Sincronizzo…' : s.fase === 'offline' ? 'Senza rete' : s.fase === 'accesso' ? 'Riaccedi' : s.fase === 'errore' ? 'Errore sync' : 'In invio'}</span>}
    </button>
  )
}
