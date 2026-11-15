import { useLiveQuery } from 'dexie-react-hooks'
import { Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Schema } from '../allenamento/schemi'
import { fmtHf, fmtS } from '../analisi/motore'
import { calcolaPiano, consiglio, type Stile } from '../analisi/piano'
import { db, normalizzaProfilo } from '../db/db'
import type { Profilo } from '../db/types'
import { versoMappa } from '../stage/geometria'
import { Segmented } from './ui'

export function simula(schema: Schema | undefined, profilo: Profilo) {
  if (!schema) return null
  const m = versoMappa(schema)
  if (!m) return null
  const ag = calcolaPiano(m.mappa, m.stage, profilo, 'aggressivo')
  const co = calcolaPiano(m.mappa, m.stage, profilo, 'conservativo')
  if (!ag || !co) return null
  return { aggressivo: ag, conservativo: co, consiglio: consiglio(ag, co) }
}

/** Stima del drill con i tempi tecnici e le abilità del profilo: piano aggressivo e conservativo. */
export default function DrillSimulazione({ schema, compatta = false }: { schema?: Schema; compatta?: boolean }) {
  const profilo = useLiveQuery(async () => normalizzaProfilo(await db.profilo.get('me')))
  const sim = useMemo(() => (profilo ? simula(schema, profilo) : null), [schema, profilo])
  const [stile, setStile] = useState<Stile | null>(null)
  if (!sim || !profilo) return null
  const scelto = stile ?? sim.consiglio.scelta
  const p = sim[scelto]
  return (
    <section className="card">
      <div className="card-title"><span><Play size={18} style={{ verticalAlign: -3 }} /> Simulazione con il tuo profilo</span></div>
      <div className="confronto">
        {(['aggressivo', 'conservativo'] as Stile[]).map((x) => (
          <button key={x} className={`stat${sim.consiglio.scelta === x ? ' vince' : ''}`} onClick={() => setStile(x)} aria-pressed={scelto === x}
            style={{ textAlign: 'left', cursor: 'pointer', color: 'var(--text)', outline: !compatta && scelto === x ? '2px solid var(--text)' : undefined }}>
            <div className="l" style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{x}</div>
            <div className="v">{fmtS(sim[x].tempo)}</div>
            <div className="l">HF {fmtHf(sim[x].hf)} · {Math.round(sim[x].puntiAttesi)} punti attesi</div>
          </button>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 14 }}><b>Consiglio:</b> {sim.consiglio.testo}</p>
      {!compatta && (
        <>
          <div style={{ marginTop: 10 }}><Segmented<Stile> label="Piano" value={scelto} onChange={setStile} options={[{ value: 'aggressivo', label: 'Aggressivo' }, { value: 'conservativo', label: 'Conservativo' }]} /></div>
          <div className="piano-passi" style={{ marginTop: 10 }}>
            {p.passi.map((x, i) => (
              <div key={i} className={`passo ${x.tipo}`}>
                <span className="ic">{x.tipo === 'partenza' ? 'S' : x.tipo === 'movimento' ? '→' : x.tipo === 'ricarica' ? 'R' : x.posizione?.replace('P', '') ?? i}</span>
                <div><div className="t">{x.titolo}</div><div className="d">{x.dettaglio}</div></div>
                <span className="s">{fmtS(x.tempo)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="prose" style={{ fontSize: 12, margin: '8px 0 0' }}>Calcolata con i tuoi tempi tecnici, la classe {profilo.classe} e le abilità del questionario.</p>
    </section>
  )
}
