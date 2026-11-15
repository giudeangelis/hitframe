import { Download, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { suDesktop, versioneDesktop } from '../google/auth'
import { aggiornamentoDesktop, PAGINA_DOWNLOAD } from '../lib/desktop'

/** Scheda "App per computer": nel browser invita a scaricarla, nell'app mostra versione e aggiornamenti. */
export function AppComputer() {
  const [versione, setVersione] = useState<string | null>(null)
  const [nuova, setNuova] = useState<{ nuova: string; url: string } | null>(null)
  useEffect(() => {
    void versioneDesktop().then(setVersione)
    void aggiornamentoDesktop().then((a) => a && setNuova(a))
  }, [])
  const desktop = suDesktop()
  // sul telefono non serve
  if (!desktop && /iphone|ipad|android/i.test(navigator.userAgent)) return null
  return (
    <section className="card form">
      <div className="card-title" style={{ marginBottom: 0 }}><span><Monitor size={18} style={{ verticalAlign: -3 }} /> App per computer</span></div>
      {desktop ? (
        <>
          <p className="prose" style={{ margin: 0 }}>Stai usando l’app Hitframe per computer, versione {versione ?? '…'}.</p>
          {nuova ? (
            <a className="btn primary" href={nuova.url} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}><Download size={18} /> Scarica la versione {nuova.nuova}</a>
          ) : <div className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>È la versione più recente.</div>}
        </>
      ) : (
        <>
          <p className="prose" style={{ margin: 0 }}>Hitframe esiste anche come app per Mac e Windows, sincronizzata con il telefono tramite il tuo Google Drive.</p>
          <a className="btn" href={PAGINA_DOWNLOAD} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}><Download size={18} /> Scarica l’app per computer</a>
        </>
      )}
    </section>
  )
}
