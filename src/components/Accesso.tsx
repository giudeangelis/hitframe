import { CloudDownload, HardDrive, Loader2, LogIn, ShieldCheck, Smartphone, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { avviaAccesso, suDesktop } from '../google/auth'
import { scegli } from '../sync/collega'
import { Wordmark } from './ui'

function Schermo({ children }: { children: React.ReactNode }) {
  return (
    <div className="accesso">
      <div className="accesso-card">
        <Wordmark size={34} />
        {children}
      </div>
    </div>
  )
}

/** Primo avvio: si entra con Google. */
export function Benvenuto({ messaggio }: { messaggio?: string | null }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [attesa, setAttesa] = useState(false)
  useEffect(() => {
    const su = () => setOnline(true), giu = () => setOnline(false)
    window.addEventListener('online', su)
    window.addEventListener('offline', giu)
    return () => { window.removeEventListener('online', su); window.removeEventListener('offline', giu) }
  }, [])
  return (
    <Schermo>
      <h1 className="accesso-titolo">Allenamenti, gare e materiale.<br />Sempre con te, su ogni dispositivo.</h1>
      <ul className="accesso-punti">
        <li><HardDrive size={18} /> <span>I tuoi dati vengono salvati nel <b>tuo</b> Google Drive, in una cartella che vede solo Hitframe.</span></li>
        <li><Smartphone size={18} /> <span>Telefono e computer restano allineati da soli, senza backup a mano.</span></li>
        <li><WifiOff size={18} /> <span>Al poligono senza campo funziona tutto: si allinea appena torna la rete.</span></li>
        <li><ShieldCheck size={18} /> <span>Nessun server: Hitframe non riceve né conserva i tuoi dati.</span></li>
      </ul>
      {messaggio && <div role="alert" className="accesso-errore">{messaggio}</div>}
      <button className="btn primary accesso-btn" disabled={!online || attesa} onClick={() => { setAttesa(suDesktop()); avviaAccesso({ ritorno: '#/', dopo: 'collega', scegliAccount: true }) }}>
        {attesa ? <Loader2 size={20} className="spin" /> : <LogIn size={20} />} {attesa ? 'Completa l’accesso nel browser…' : 'Accedi con Google'}
      </button>
      {attesa && <p className="accesso-nota">Si è aperta una pagina di Google nel browser: entra con il tuo account e torna qui.</p>}
      {!online && <p className="accesso-nota">Per il primo accesso serve la connessione.</p>}
      <p className="accesso-nota">Serve un account Google (Gmail). <a href="privacy.html" target="_blank" rel="noreferrer">Privacy</a></p>
    </Schermo>
  )
}

export function Collegamento({ testo = 'Collego il tuo account…' }: { testo?: string }) {
  return (
    <Schermo>
      <div className="accesso-attesa"><Loader2 size={26} className="spin" /> {testo}</div>
    </Schermo>
  )
}

const elementi = (n: number) => (n === 1 ? '1 elemento' : `${n} elementi`)

/** Dati sia sul dispositivo sia nel cloud: quali tenere? */
export function SceltaDati({ nelCloud, suDispositivo, aggiornato, fatto }: {
  nelCloud: number; suDispositivo: number; aggiornato: string | null; fatto: (msg: string) => void
}) {
  const [occupato, setOccupato] = useState<'cloud' | 'dispositivo' | null>(null)
  const [errore, setErrore] = useState('')
  const quando = aggiornato ? format(new Date(aggiornato), "d MMMM yyyy 'alle' HH:mm", { locale: it }) : null

  async function vai(da: 'cloud' | 'dispositivo') {
    setOccupato(da)
    setErrore('')
    try {
      await scegli(da)
      fatto(da === 'cloud' ? 'Dati scaricati dal tuo Google Drive' : 'I dati di questo dispositivo ora sono nel tuo Google Drive')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito, riprova.')
      setOccupato(null)
    }
  }

  return (
    <Schermo>
      <h1 className="accesso-titolo">Quali dati vuoi usare?</h1>
      <p className="accesso-testo">
        Nel tuo Google Drive ci sono già dati Hitframe ({elementi(nelCloud)}{quando ? `, salvati il ${quando}` : ''}).
        Anche su questo dispositivo ce ne sono ({elementi(suDispositivo)}).
      </p>
      {(() => {
        // consigliamo la parte con più dati: è quasi sempre quella "vera"
        const consigliaCloud = nelCloud >= suDispositivo
        const cloud = (
          <button key="c" className={`btn accesso-btn${consigliaCloud ? ' primary' : ''}`} disabled={!!occupato} onClick={() => vai('cloud')}>
            {occupato === 'cloud' ? <Loader2 size={20} className="spin" /> : <CloudDownload size={20} />} Usa quelli del Google Drive ({elementi(nelCloud)})
          </button>
        )
        const disp = (
          <button key="d" className={`btn accesso-btn${consigliaCloud ? '' : ' primary'}`} disabled={!!occupato} onClick={() => vai('dispositivo')}>
            {occupato === 'dispositivo' ? <Loader2 size={20} className="spin" /> : <Smartphone size={20} />} Usa quelli di questo dispositivo ({elementi(suDispositivo)})
          </button>
        )
        const nota = <p key="n" className="accesso-nota">Consigliato: {consigliaCloud ? 'il Google Drive' : 'questo dispositivo'}, che ha più dati. L’altra scelta sostituisce i dati che scarti.</p>
        return consigliaCloud ? [cloud, disp, nota] : [disp, cloud, nota]
      })()}
      <p className="accesso-nota">In entrambi i casi tengo una copia di sicurezza dei dati scartati: la trovi in Impostazioni.</p>
      {errore && <div role="alert" className="accesso-errore">{errore}</div>}
    </Schermo>
  )
}
