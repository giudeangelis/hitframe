import { addDays } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { drillPerFocus, DRILLS, type Drill } from '../allenamento/drills'
import type { Focus } from '../analisi/motore'
import { db, nowIso } from '../db/db'
import type { Evento } from '../db/types'
import { dopoSalvataggio, primaDiEliminare } from '../google/calendar'
import { fmtMedio, fromKey, toKey } from '../lib/date'
import { Sheet, useToast } from './ui'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] // indice 0 = lunedì

interface Sessione { data: string; tipo: 'fuoco' | 'bianco'; focus: Focus; drill: Drill[] }

/** Alterna le priorità e sceglie fino a 3 drill per sessione. */
function costruisci(da: string, a: string, giorniFuoco: number[], giorniBianco: number[], focus: Focus[]): Sessione[] {
  const out: Sessione[] = []
  if (!focus.length) return out
  let iF = 0
  let iB = 0
  for (let d = fromKey(da); toKey(d) <= a; d = addDays(d, 1)) {
    const gs = (d.getDay() + 6) % 7
    const k = toKey(d)
    if (giorniFuoco.includes(gs)) {
      const f = focus[iF++ % Math.min(focus.length, 4)]
      const drill = [...drillPerFocus(f.id, 'fuoco'), DRILLS.find((x) => x.id === 'bill')!].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 3)
      out.push({ data: k, tipo: 'fuoco', focus: f, drill })
    } else if (giorniBianco.includes(gs)) {
      const f = focus[iB++ % Math.min(focus.length, 4)]
      const base = drillPerFocus(f.id, 'bianco')
      const drill = [...base, DRILLS.find((x) => x.id === 'b-estrazione')!, DRILLS.find((x) => x.id === 'b-ricarica')!].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 3)
      out.push({ data: k, tipo: 'bianco', focus: f, drill })
    }
  }
  return out
}

export default function PianoForm({ analisiId, focus, dataGara, nomeGara, onClose }: {
  analisiId: number; focus: Focus[]; dataGara: string; nomeGara: string; onClose: () => void
}) {
  const toast = useToast()
  const esistenti = useLiveQuery(() => db.eventi.filter((e) => e.piano === analisiId).toArray(), [analisiId]) ?? []
  const [fuoco, setFuoco] = useState<number[]>([2, 5]) // mer, sab
  const [bianco, setBianco] = useState<number[]>([0, 1, 3, 4]) // lun, mar, gio, ven
  const [oraFuoco, setOraFuoco] = useState('15:00')
  const [oraBianco, setOraBianco] = useState('21:00')
  const [occupato, setOccupato] = useState(false)

  const da = toKey(addDays(new Date(), 1))
  const a = toKey(addDays(fromKey(dataGara), -1))
  const sessioni = useMemo(() => costruisci(da, a, fuoco, bianco, focus), [da, a, fuoco, bianco, focus])

  const toggle = (lista: number[], set: (v: number[]) => void, altra: number[], setAltra: (v: number[]) => void, g: number) => {
    if (lista.includes(g)) set(lista.filter((x) => x !== g))
    else {
      set([...lista, g])
      if (altra.includes(g)) setAltra(altra.filter((x) => x !== g))
    }
  }

  async function rimuoviEsistenti() {
    for (const e of esistenti) {
      await primaDiEliminare(e)
      await db.eventi.delete(e.id!)
    }
  }

  async function crea() {
    setOccupato(true)
    await rimuoviEsistenti()
    const ids: number[] = []
    for (const s of sessioni) {
      const ev: Evento = {
        tipo: s.tipo,
        titolo: `${s.tipo === 'fuoco' ? 'Fuoco' : 'In bianco'} · ${s.focus.titolo}`,
        data: s.data,
        dataFine: s.data,
        ora: s.tipo === 'fuoco' ? oraFuoco : oraBianco,
        durataMin: s.tipo === 'fuoco' ? 120 : 20,
        luogo: '',
        note: [`Verso: ${nomeGara}`, ...s.drill.map((d) => `• ${d.nome}`)].join('\n'),
        colpiPianificati: s.tipo === 'fuoco' ? s.drill.reduce((t, d) => t + d.colpi * 10, 0) : null,
        colpiSparati: null,
        completato: false,
        creato: nowIso(),
        piano: analisiId,
        drill: s.drill.map((d) => d.id),
      }
      ids.push((await db.eventi.add(ev)) as number)
    }
    toast(`${ids.length} sessioni aggiunte al calendario`)
    onClose()
    // invio a Google in sequenza, senza bloccare
    for (const id of ids) await dopoSalvataggio(id)
  }

  async function elimina() {
    setOccupato(true)
    await rimuoviEsistenti()
    toast('Piano rimosso dal calendario')
    onClose()
  }

  const nFuoco = sessioni.filter((s) => s.tipo === 'fuoco').length
  const nBianco = sessioni.length - nFuoco

  return (
    <Sheet title="Piano verso la gara" onClose={onClose}>
      <div className="form">
        <p className="prose" style={{ margin: 0 }}>
          Da domani a {fmtMedio(a)}, il giorno prima di <b>{nomeGara}</b>. Ogni sessione lavora su una delle priorità della gara, a rotazione, con i drill adatti.
        </p>
        {a < da && <div className="card avviso">La gara è troppo vicina per un piano.</div>}

        <div className="field">
          <span className="label">Giorni a fuoco</span>
          <div className="chips">
            {GIORNI.map((g, i) => (
              <button key={g} type="button" className={`chip-giorno${fuoco.includes(i) ? ' fuoco' : ''}`} aria-pressed={fuoco.includes(i)}
                onClick={() => toggle(fuoco, setFuoco, bianco, setBianco, i)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Giorni in bianco</span>
          <div className="chips">
            {GIORNI.map((g, i) => (
              <button key={g} type="button" className={`chip-giorno${bianco.includes(i) ? ' bianco' : ''}`} aria-pressed={bianco.includes(i)}
                onClick={() => toggle(bianco, setBianco, fuoco, setFuoco, i)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="pi-of">Ora a fuoco</label>
            <input id="pi-of" type="time" className="input" value={oraFuoco} onChange={(e) => setOraFuoco(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pi-ob">Ora in bianco</label>
            <input id="pi-ob" type="time" className="input" value={oraBianco} onChange={(e) => setOraBianco(e.target.value)} />
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg)' }}>
          <div className="title" style={{ fontWeight: 600, marginBottom: 6 }}>{nFuoco} a fuoco · {nBianco} in bianco</div>
          <div className="list" style={{ gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {sessioni.map((s) => (
              <div key={s.data} className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>
                <span className={`dot ${s.tipo}`} style={{ display: 'inline-block', marginRight: 6 }} />
                {fmtMedio(s.data)} · {s.focus.titolo} · {s.drill.map((d) => d.nome).join(', ')}
              </div>
            ))}
          </div>
        </div>

        {esistenti.length > 0 && (
          <p className="prose" style={{ margin: 0, fontSize: 13 }}>
            C’è già un piano per questa gara ({esistenti.length} sessioni): verrà sostituito, anche su Google Calendar.
          </p>
        )}

        <div className="row">
          {esistenti.length > 0 && <button className="btn ghost" onClick={elimina} disabled={occupato}>Rimuovi piano</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn primary" onClick={crea} disabled={occupato || !sessioni.length}>
            {esistenti.length ? 'Sostituisci piano' : 'Crea piano'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

