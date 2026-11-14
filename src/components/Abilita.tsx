import { ChevronLeft, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { DOMANDE, ETICHETTE_LIVELLO, puntiForzaDeboli, type Abilita } from '../abilita/questionario'
import { db, getProfilo, nowIso } from '../db/db'
import { fmtMedio, giorniDa, oggiKey } from '../lib/date'
import { Sheet, useToast } from './ui'

export function QuestionarioAbilita({ iniziale, onClose, onSalvato }: {
  iniziale?: Abilita; onClose: () => void; onSalvato: (a: Abilita) => void
}) {
  const toast = useToast()
  const [i, setI] = useState(0)
  const [risposte, setRisposte] = useState<Abilita>({ ...(iniziale ?? {}) })
  const d = DOMANDE[i]

  async function scegli(livello: number) {
    const nuove = { ...risposte, [d.area]: livello }
    setRisposte(nuove)
    if (i < DOMANDE.length - 1) {
      setI(i + 1)
      return
    }
    const p = await getProfilo()
    const storico = [...(p.storicoAbilita ?? []), { data: oggiKey(), valori: nuove }].slice(-24)
    await db.profilo.put({ ...p, abilita: nuove, storicoAbilita: storico, aggiornato: nowIso() })
    toast('Abilità salvate')
    onSalvato(nuove)
    onClose()
  }

  return (
    <Sheet title="Le tue abilità" onClose={onClose}>
      <div className="form">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {i > 0 && <button className="btn icon ghost" onClick={() => setI(i - 1)} aria-label="Domanda precedente"><ChevronLeft size={20} /></button>}
          <div className="meter" style={{ flex: 1, margin: 0 }} aria-hidden="true"><span style={{ width: `${((i + 1) / DOMANDE.length) * 100}%` }} /></div>
          <span className="meta" style={{ color: 'var(--muted)', fontSize: 13 }}>{i + 1}/{DOMANDE.length}</span>
        </div>
        <div className="label" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{d.titolo}</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{d.testo}</div>
        <p className="prose" style={{ margin: 0, fontSize: 13 }}>Rispondi pensando a come vai davvero in gara, non nel tuo giorno migliore.</p>
        <div className="list">
          {d.opzioni.map((o) => (
            <button key={o.testo} className="item" onClick={() => scegli(o.livello)}
              style={risposte[d.area] === o.livello ? { borderColor: 'var(--accent)' } : undefined} aria-pressed={risposte[d.area] === o.livello}>
              <span className="title" style={{ fontWeight: 500 }}>{o.testo}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

export function RiepilogoAbilita({ abilita, storico, onQuestionario }: {
  abilita?: Abilita; storico?: { data: string }[]; onQuestionario: () => void
}) {
  const ultimo = storico?.[storico.length - 1]?.data
  const vecchio = ultimo ? -giorniDa(ultimo) > 60 : false
  if (!abilita || !Object.keys(abilita).length) {
    return (
      <section className="card form">
        <div className="card-title" style={{ marginBottom: 0 }}>Abilità</div>
        <p className="prose" style={{ margin: 0 }}>
          {DOMANDE.length} domande, circa 3 minuti. Servono a Hitframe per scegliere i piani di stage adatti a te: dove osare e dove andare sul sicuro.
        </p>
        <div className="row"><button className="btn primary" onClick={onQuestionario}><ClipboardCheck size={18} /> Fai il questionario</button></div>
      </section>
    )
  }
  const { forti, deboli } = puntiForzaDeboli(abilita)
  return (
    <section className="card">
      <div className="card-title">
        <span>Abilità</span>
        <button className="btn ghost" style={{ minHeight: 36 }} onClick={onQuestionario}><ClipboardCheck size={16} /> Rifai</button>
      </div>
      {ultimo && <p className="prose" style={{ margin: '0 0 10px', fontSize: 13 }}>Aggiornate il {fmtMedio(ultimo)}{vecchio ? ': rifai il questionario, sono passati più di due mesi.' : '.'}</p>}
      <div className="abilita-lista">
        {DOMANDE.map((d) => {
          const v = abilita[d.area]
          return (
            <div key={d.area} className="abilita-riga">
              <span className="n">{d.titolo}</span>
              <div className="barre" aria-label={`${d.titolo}: ${v ?? 'non valutata'} su 5`}>
                {[1, 2, 3, 4, 5].map((k) => <span key={k} className={v && k <= v ? 'on' : ''} />)}
              </div>
              <span className="l">{v ? ETICHETTE_LIVELLO[v] : '—'}</span>
            </div>
          )
        })}
      </div>
      {(forti.length > 0 || deboli.length > 0) && (
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
          {forti.length > 0 && <div style={{ flex: 1, minWidth: 180 }}><div className="label">Punti di forza</div><div className="meta" style={{ color: 'var(--text)' }}>{forti.map((x) => x.titolo).join(', ')}</div></div>}
          {deboli.length > 0 && <div style={{ flex: 1, minWidth: 180 }}><div className="label">Da allenare</div><div className="meta" style={{ color: 'var(--text)' }}>{deboli.map((x) => x.titolo).join(', ')}</div></div>}
        </div>
      )}
    </section>
  )
}
