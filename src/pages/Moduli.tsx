import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { MODULI_EXTRA, MODULI_FUTURI, MODULI_PRINCIPALI, MODULO_IMPOSTAZIONI } from '../modules'

export default function Moduli() {
  return (
    <div className="page">
      <PageHeader title="Moduli" sub="Tutto Hitframe, pronto e in arrivo" />
      <div className="modules">
        {[...MODULI_EXTRA, ...MODULI_PRINCIPALI.slice(1), MODULO_IMPOSTAZIONI].map((m) => (
          <Link key={m.path} to={m.path} className="module">
            <m.icon size={26} />
            <div className="t">{m.label}</div>
            <div className="s">{m.descrizione}</div>
          </Link>
        ))}
      </div>
      <div className="nav-section" style={{ padding: '6px 2px 0' }}>In arrivo</div>
      <div className="modules">
        {MODULI_FUTURI.map((m) => (
          <Link key={m.path} to={m.path} className="module soon">
            <m.icon size={26} />
            <div className="t">{m.label}</div>
            <div className="s">{m.descrizione}</div>
            <span className="badge" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>Fase {m.fase}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
