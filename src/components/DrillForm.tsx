import { useState } from 'react'
import { CATEGORIE_DRILL } from '../allenamento/drills'
import { db, nowIso } from '../db/db'
import type { DrillPersonale } from '../db/types'
import { numOrNull, Segmented, Sheet, useToast } from './ui'

export default function DrillForm({ drill, onClose }: { drill?: DrillPersonale; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState<DrillPersonale>(() => drill ?? {
    nome: '', categoria: 'Transizioni', modalita: 'fuoco', descrizione: '', distanza: '', bersagli: '', colpi: 6, partenza: 'Mani in resa, arma in fondina', obiettivo: null, creato: nowIso(),
  })
  const [obTxt, setObTxt] = useState(drill?.obiettivo ? String(drill.obiettivo).replace('.', ',') : '')
  const [conferma, setConferma] = useState(false)
  const set = <K extends keyof DrillPersonale>(k: K, v: DrillPersonale[K]) => setD((p) => ({ ...p, [k]: v }))

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const pulito = { ...d, nome: d.nome.trim(), obiettivo: numOrNull(obTxt) }
    if (pulito.id) await db.drillPersonali.put(pulito)
    else await db.drillPersonali.add(pulito)
    toast(drill ? 'Drill aggiornato' : 'Drill creato')
    onClose()
  }

  async function elimina() {
    if (!d.id) return
    await db.drillPersonali.delete(d.id)
    toast('Drill eliminato')
    onClose()
  }

  return (
    <Sheet title={drill ? 'Modifica drill' : 'Nuovo drill'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <div className="field">
          <label htmlFor="dr-nome">Nome</label>
          <input id="dr-nome" className="input" value={d.nome} onChange={(e) => set('nome', e.target.value)} required />
        </div>
        <div className="fields-2">
          <Segmented label="Modalità" value={d.modalita} onChange={(v) => set('modalita', v)}
            options={[{ value: 'fuoco', label: 'A fuoco' }, { value: 'bianco', label: 'In bianco' }]} />
          <select className="select" aria-label="Categoria" value={d.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIE_DRILL.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dr-desc">Descrizione</label>
          <textarea id="dr-desc" className="textarea" style={{ minHeight: 90 }} value={d.descrizione} onChange={(e) => set('descrizione', e.target.value)} />
        </div>
        <div className="fields-3">
          <div className="field">
            <label htmlFor="dr-dist">Distanza</label>
            <input id="dr-dist" className="input" value={d.distanza} onChange={(e) => set('distanza', e.target.value)} placeholder="7 m" />
          </div>
          <div className="field">
            <label htmlFor="dr-colpi">{d.modalita === 'bianco' ? 'Azioni' : 'Colpi'}</label>
            <input id="dr-colpi" className="input" inputMode="numeric" value={d.colpi} onChange={(e) => set('colpi', Number(e.target.value) || 0)} />
          </div>
          <div className="field">
            <label htmlFor="dr-ob">Obiettivo (s)</label>
            <input id="dr-ob" className="input" inputMode="decimal" value={obTxt} onChange={(e) => setObTxt(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="dr-bers">Bersagli</label>
          <input id="dr-bers" className="input" value={d.bersagli} onChange={(e) => set('bersagli', e.target.value)} placeholder="3 IPSC + 2 mini popper" />
        </div>
        <div className="field">
          <label htmlFor="dr-part">Partenza</label>
          <input id="dr-part" className="input" value={d.partenza} onChange={(e) => set('partenza', e.target.value)} />
        </div>
        <div className="row">
          {drill && (conferma
            ? <button type="button" className="btn danger" onClick={elimina}>Conferma eliminazione</button>
            : <button type="button" className="btn ghost" onClick={() => setConferma(true)}>Elimina</button>)}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!d.nome.trim()}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}
