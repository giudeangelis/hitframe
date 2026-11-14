import { Check } from 'lucide-react'
import { PageHeader } from '../components/ui'
import type { Modulo } from '../modules'

export default function InArrivo({ modulo }: { modulo: Modulo }) {
  return (
    <div className="page">
      <PageHeader title={modulo.label} sub={modulo.descrizione} />
      <section className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <modulo.icon size={30} color="var(--accent)" />
          <span className="badge">In arrivo · Fase {modulo.fase}</span>
        </div>
        <div className="list" style={{ gap: 10 }}>
          {modulo.dettagli?.map((d) => (
            <div key={d} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <Check size={18} color="var(--ok)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
