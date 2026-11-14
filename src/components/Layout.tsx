import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AREE, STRUMENTI, areaDi } from '../modules'
import { aggiornaColoriSeServe, sincronizzaDopoAccesso, sincronizzaTutto } from '../google/calendar'
import { useToast, Wordmark } from './ui'

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const toast = useToast()
  useEffect(() => {
    aggiornaColoriSeServe()
  }, [])
  useEffect(() => {
    const msg = sessionStorage.getItem('hf-msg')
    if (msg) {
      sessionStorage.removeItem('hf-msg')
      toast(msg)
    } else if (sincronizzaDopoAccesso()) {
      sincronizzaTutto()
        .then((r) => toast(`Google Calendar aggiornato (${r.inviati + r.eliminati} modifiche)`))
        .catch(() => toast('Sincronizzazione non riuscita: riprova da Impostazioni'))
    }
  }, [toast])

  const area = areaDi(pathname)
  const attiva = (p: string) => pathname === p || pathname.startsWith(p + '/')

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Menu principale">
        <div className="brand"><Link to="/" style={{ textDecoration: 'none' }}><Wordmark size={30} /></Link></div>
        {AREE.map((a) => (
          <div key={a.id}>
            <NavLink to={a.path} end={a.path === '/'} className={() => `nav-link${area?.id === a.id ? ' active' : ''}`}>
              <a.icon size={20} /> {a.label}
            </NavLink>
            {area?.id === a.id && a.sezioni.length > 1 && (
              <div className="nav-sub">
                {a.sezioni.map((s) => (
                  <NavLink key={s.path} to={s.path} className={() => `nav-sublink${attiva(s.path) ? ' active' : ''}`}>{s.label}</NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="spacer" />
        {STRUMENTI.map((s) => (
          <NavLink key={s.path} to={s.path} className="nav-link"><s.icon size={20} /> {s.label}</NavLink>
        ))}
      </aside>

      <main className="main">
        <header className="topbar">
          <Link to="/" style={{ textDecoration: 'none' }} aria-label="Oggi"><Wordmark size={24} /></Link>
          <div className="row" style={{ gap: 4 }}>
            {STRUMENTI.map((s) => (
              <NavLink key={s.path} to={s.path} className="btn icon ghost topbar-btn" aria-label={s.label} title={s.label}>
                <s.icon size={21} />
              </NavLink>
            ))}
          </div>
        </header>
        {area && area.sezioni.length > 1 && (
          <nav className="sottomenu" aria-label={`Sezioni di ${area.label}`}>
            {area.sezioni.map((s) => (
              <Link key={s.path} to={s.path} className={`sottomenu-voce${attiva(s.path) ? ' attiva' : ''}`} aria-current={attiva(s.path) ? 'page' : undefined}>
                <s.icon size={15} /> {s.label}
              </Link>
            ))}
          </nav>
        )}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navigazione">
        {AREE.map((a) => (
          <NavLink key={a.id} to={a.path} end={a.path === '/'} className={() => `tab${area?.id === a.id ? ' active' : ''}`}>
            <a.icon size={22} />
            {a.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
