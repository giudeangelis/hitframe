import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { MODULI_EXTRA, MODULI_FUTURI, MODULI_PRINCIPALI, MODULO_ALTRO, MODULO_IMPOSTAZIONI } from '../modules'
import { Wordmark } from './ui'

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const tabs = [...MODULI_PRINCIPALI, MODULO_ALTRO]

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Menu principale">
        <div className="brand"><Wordmark size={30} /></div>
        {[...MODULI_PRINCIPALI, ...MODULI_EXTRA].map((m) => (
          <NavLink key={m.path} to={m.path} end={m.path === '/'} className="nav-link">
            <m.icon size={20} /> {m.label}
          </NavLink>
        ))}
        <div className="nav-section">Prossimi moduli</div>
        {MODULI_FUTURI.map((m) => (
          <NavLink key={m.path} to={m.path} className="nav-link">
            <m.icon size={20} /> {m.label}
            <span className="soon">Fase {m.fase}</span>
          </NavLink>
        ))}
        <div className="spacer" />
        <NavLink to={MODULO_IMPOSTAZIONI.path} className="nav-link">
          <MODULO_IMPOSTAZIONI.icon size={20} /> {MODULO_IMPOSTAZIONI.label}
        </NavLink>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navigazione">
        {tabs.map((m) => (
          <NavLink key={m.path} to={m.path} end={m.path === '/'} className="tab">
            <m.icon size={22} />
            {m.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
