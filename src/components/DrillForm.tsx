import { useState } from 'react'
import { CATEGORIE_DRILL } from '../allenamento/drills'
import { EditorSchema } from './DrillSchema'
import { colpi as contaColpi, corso, isBersaglio, isPosizione, vede } from '../stage/geometria'
import { db, nowIso } from '../db/db'
import type { DrillPersonale } from '../db/types'
import { numOrNull, Segmented, Sheet, useToast } from './ui'

export default function DrillForm({ drill, onClose }: { drill?: DrillPersonale; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState<DrillPersonale>(() => drill ?? {
    nome: '', categoria: 'Transizioni', modalita: 'fuoco', descrizione: '', distanza: '', bersagli: '', colpi: 6, partenza: 'Mani in resa, arma in fondina', obiettivo: null, creato: nowIso(),
    schema: { elementi: [{ t: 'tiratore', x: 0, y: 0 }, { t: 'carta', x: 0, y: 7, id: 'T1', nota: '×2' }] },
  })
  const [passiTxt, setPassiTxt] = useState((drill?.passi ?? []).join('\n'))
  const [attTxt, setAttTxt] = useState((drill?.attenzione ?? []).join('\n'))
  const [selEl, setSelEl] = useState<number | null>(null)
  const [obTxt, setObTxt] = useState(drill?.obiettivo ? String(drill.obiettivo).replace('.', ',') : '')
  const [conferma, setConferma] = useState(false)
  const set = <K extends keyof DrillPersonale>(k: K, v: DrillPersonale[K]) => setD((p) => ({ ...p, [k]: v }))

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const righe = (t: string) => t.split('\n').map((x) => x.replace(/^\s*(\d+[.)]|[-•])\s*/, '').trim()).filter(Boolean)
    const pulito = { ...d, nome: d.nome.trim(), obiettivo: numOrNull(obTxt), passi: righe(passiTxt), attenzione: righe(attTxt) }
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
        <details className="guida" open={!drill?.stage}>
          <summary>Disegno e spiegazione</summary>
          <div className="form" style={{ marginTop: 10 }}>
            {drill?.stage
              ? <p className="prose" style={{ margin: 0 }}>Il disegno viene dallo studio dello stage {drill.stage.numero}.</p>
              : (() => {
                const sc = d.schema ?? { elementi: [] }
                const pos = selEl !== null && sc.elementi[selEl] && isPosizione(sc.elementi[selEl]) ? sc.elementi[selEl] : null
                const n = contaColpi(sc)
                return (
                  <>
                    <EditorSchema schema={sc} onChange={(x) => set('schema', x)} onSelect={setSelEl}
                      extra={(m) => pos && (
                        <g pointerEvents="none">
                          {sc.elementi.filter(isBersaglio).map((b, i) => {
                            const ok = vede(sc, pos, b)
                            const [x1, y1] = m(pos.x, pos.y), [x2, y2] = m(b.x, b.y)
                            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ok ? 'var(--ok)' : 'var(--fuoco)'} strokeWidth={ok ? 1.5 : 1} strokeDasharray={ok ? undefined : '3 4'} opacity={0.8} />
                          })}
                        </g>
                      )} />
                    <p className="prose" style={{ margin: 0, fontSize: 12 }}>
                      {n} colpi · {corso(n).tipo}{corso(n).oltre ? ' (oltre i 32 di un long course)' : ''}. Con Sposta tocca un box o il tiratore: in verde i bersagli visibili, in rosso quelli coperti da pareti e barili.
                      {n !== d.colpi && d.modalita === 'fuoco' && <> <button type="button" className="btn ghost" style={{ minHeight: 28, padding: '0 8px' }} onClick={() => set('colpi', n)}>Usa {n} colpi</button></>}
                    </p>
                  </>
                )
              })()}
            <div className="field">
              <label htmlFor="dr-all">Allestimento</label>
              <input id="dr-all" className="input" value={d.allestimento ?? ''} onChange={(e) => set('allestimento', e.target.value)} placeholder="Cosa preparare: bersagli, distanze, tavolo…" />
            </div>
            <div className="field">
              <label htmlFor="dr-passi">Esecuzione, un passo per riga</label>
              <textarea id="dr-passi" className="textarea" style={{ minHeight: 90 }} value={passiTxt} onChange={(e) => setPassiTxt(e.target.value)} placeholder={'Mani in resa\nAl beep due colpi su T1\n…'} />
            </div>
            <div className="field">
              <label htmlFor="dr-att">Attenzione a, uno per riga</label>
              <textarea id="dr-att" className="textarea" value={attTxt} onChange={(e) => setAttTxt(e.target.value)} />
            </div>
          </div>
        </details>
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
