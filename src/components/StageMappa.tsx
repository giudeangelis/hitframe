import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { TIPI_BERSAGLIO, type BersaglioMappa, type MappaStage, type TipoBersaglio } from '../analisi/mappa'
import { Segmented } from './ui'

type Strumento = 'seleziona' | 'posizione' | 'bersaglio' | 'visibilita'
type Sel = { tipo: 'pos' | 'bers' | 'partenza'; id: string } | null

export interface Sovrapposizione {
  /** percorso: partenza e posizioni nell'ordine del piano */
  punti: { x: number; y: number; etichetta: string }[]
  /** ordine di ingaggio: id bersaglio → numero */
  ordine: Record<string, number>
  /** bersagli ingaggiati in movimento */
  inMovimento: string[]
  ricariche: { x: number; y: number }[]
}

const DISTANZE = [3, 5, 7, 10, 12, 15, 20]

export default function StageMappa({ img, mappa, onChange, modifica, sovra }: {
  img: { url: string; w: number; h: number }
  mappa: MappaStage
  onChange?: (m: MappaStage) => void
  modifica: boolean
  sovra?: Sovrapposizione | null
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [strumento, setStrumento] = useState<Strumento>('seleziona')
  const [tipoNuovo, setTipoNuovo] = useState<TipoBersaglio>('carta')
  const [sel, setSel] = useState<Sel>(null)
  const [trascina, setTrascina] = useState<Sel>(null)
  const W = 1000
  const H = Math.round((1000 * img.h) / img.w)

  const aggiorna = (m: Partial<MappaStage>) => onChange?.({ ...mappa, ...m, fonte: mappa.fonte, aggiornata: new Date().toISOString() })

  function punto(e: React.PointerEvent): { x: number; y: number } {
    const svg = svgRef.current!
    const r = svg.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  function prossimoId(prefisso: string, esistenti: string[]) {
    let n = 1
    while (esistenti.includes(`${prefisso}${n}`)) n++
    return `${prefisso}${n}`
  }

  function tapSfondo(e: React.PointerEvent) {
    if (!modifica) return
    const p = punto(e)
    if (strumento === 'posizione') {
      const id = prossimoId('P', mappa.posizioni.map((x) => x.id))
      aggiorna({ posizioni: [...mappa.posizioni, { id, ...p, nota: '', vede: [] }] })
      setSel({ tipo: 'pos', id })
    } else if (strumento === 'bersaglio') {
      const pref = { carta: 'T', mini: 'T', popper: 'PP', miniPopper: 'MP', piastra: 'PL', noshoot: 'NS' }[tipoNuovo]
      const id = prossimoId(pref, mappa.bersagli.map((x) => x.id))
      const b: BersaglioMappa = { id, ...p, tipo: tipoNuovo, distanza: 8, parziale: false, mobile: false, attiva: [] }
      aggiorna({ bersagli: [...mappa.bersagli, b] })
      setSel({ tipo: 'bers', id })
    } else {
      setSel(null)
    }
  }

  function giuElemento(e: React.PointerEvent, s: NonNullable<Sel>) {
    e.stopPropagation()
    if (!modifica) {
      setSel(s)
      return
    }
    if (strumento === 'visibilita') {
      if (s.tipo === 'pos') setSel(s)
      else if (s.tipo === 'bers' && sel?.tipo === 'pos') {
        aggiorna({
          posizioni: mappa.posizioni.map((p) => p.id !== sel.id ? p : { ...p, vede: p.vede.includes(s.id) ? p.vede.filter((x) => x !== s.id) : [...p.vede, s.id] }),
        })
      }
      return
    }
    setSel(s)
    if (strumento === 'seleziona') {
      setTrascina(s);
      (e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  function muovi(e: React.PointerEvent) {
    if (!trascina || !modifica) return
    const p = punto(e)
    if (trascina.tipo === 'partenza') aggiorna({ partenza: { ...mappa.partenza, ...p } })
    else if (trascina.tipo === 'pos') aggiorna({ posizioni: mappa.posizioni.map((x) => (x.id === trascina.id ? { ...x, ...p } : x)) })
    else aggiorna({ bersagli: mappa.bersagli.map((x) => (x.id === trascina.id ? { ...x, ...p } : x)) })
  }

  const selPos = sel?.tipo === 'pos' ? mappa.posizioni.find((p) => p.id === sel.id) : undefined
  const selBers = sel?.tipo === 'bers' ? mappa.bersagli.find((b) => b.id === sel.id) : undefined
  const setBers = (b: Partial<BersaglioMappa>) => selBers && aggiorna({ bersagli: mappa.bersagli.map((x) => (x.id === selBers.id ? { ...x, ...b } : x)) })

  const X = (v: number) => v * W
  const Y = (v: number) => v * H
  const visibili = new Set(selPos?.vede ?? [])

  return (
    <div className="mappa">
      {modifica && (
        <div className="form" style={{ gap: 8 }}>
          <Segmented<Strumento> label="Strumento" value={strumento} onChange={(v) => { setStrumento(v); if (v !== 'visibilita') setSel(null) }}
            options={[{ value: 'seleziona', label: 'Sposta' }, { value: 'posizione', label: '+ Posizione' }, { value: 'bersaglio', label: '+ Bersaglio' }, { value: 'visibilita', label: 'Visibilità' }]} />
          {strumento === 'bersaglio' && (
            <div className="chips">
              {(Object.keys(TIPI_BERSAGLIO) as TipoBersaglio[]).map((t) => (
                <button key={t} type="button" className={`chip-giorno${tipoNuovo === t ? ' attivo' : ''}`} aria-pressed={tipoNuovo === t} onClick={() => setTipoNuovo(t)} style={{ padding: '0 10px' }}>
                  {TIPI_BERSAGLIO[t].nome}
                </button>
              ))}
            </div>
          )}
          <div className="hint" style={{ fontSize: 12, color: 'var(--faint)' }}>
            {strumento === 'seleziona' && 'Trascina partenza (S), posizioni e bersagli. Tocca un elemento per modificarlo.'}
            {strumento === 'posizione' && 'Tocca il punto a terra da cui si spara (box, finestra, porta).'}
            {strumento === 'bersaglio' && 'Scegli il tipo e tocca il centro del bersaglio sul disegno.'}
            {strumento === 'visibilita' && (selPos ? `Tocca i bersagli visibili da ${selPos.id}.` : 'Tocca prima una posizione.')}
          </div>
        </div>
      )}

      <div className="mappa-tela" style={{ aspectRatio: `${img.w} / ${img.h}` }}>
        <img src={img.url} alt="Disegno dello stage" draggable={false} />
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerDown={tapSfondo} onPointerMove={muovi} onPointerUp={() => setTrascina(null)}
          style={{ touchAction: modifica && strumento === 'seleziona' && trascina ? 'none' : 'manipulation' }}>
          {/* linee di visibilità della posizione selezionata */}
          {selPos && mappa.bersagli.filter((b) => visibili.has(b.id)).map((b) => (
            <line key={b.id} x1={X(selPos.x)} y1={Y(selPos.y)} x2={X(b.x)} y2={Y(b.y)} stroke="#e5ea1e" strokeWidth={2} strokeDasharray="6 6" opacity={0.8} />
          ))}

          {/* percorso del piano */}
          {sovra && sovra.punti.length > 1 && (
            <>
              <polyline points={sovra.punti.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="#000" strokeWidth={9} strokeLinejoin="round" opacity={0.5} />
              <polyline points={sovra.punti.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="#e5ea1e" strokeWidth={5} strokeLinejoin="round" markerEnd="url(#freccia)" />
            </>
          )}
          <defs>
            <marker id="freccia" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#e5ea1e" />
            </marker>
          </defs>
          {sovra?.ricariche.map((r, i) => (
            <g key={i} transform={`translate(${X(r.x)},${Y(r.y)})`}>
              <rect x={-24} y={-14} width={48} height={28} rx={6} fill="#4ea8ff" stroke="#000" strokeWidth={2} />
              <text x={0} y={6} textAnchor="middle" fontSize={17} fontWeight={800} fill="#06121f">RIC</text>
            </g>
          ))}

          {/* bersagli */}
          {mappa.bersagli.map((b) => {
            const metallo = TIPI_BERSAGLIO[b.tipo].metallo
            const ns = b.tipo === 'noshoot'
            const n = sovra?.ordine[b.id]
            const selez = sel?.tipo === 'bers' && sel.id === b.id
            const vis = visibili.has(b.id)
            return (
              <g key={b.id} transform={`translate(${X(b.x)},${Y(b.y)})`} onPointerDown={(e) => giuElemento(e, { tipo: 'bers', id: b.id })} style={{ cursor: 'pointer' }}>
                <circle r={26} fill="transparent" />
                {metallo
                  ? <circle r={b.tipo === 'miniPopper' ? 12 : 16} fill={vis ? '#e5ea1e' : '#d9d9d9'} stroke={selez ? '#e5ea1e' : '#000'} strokeWidth={selez ? 5 : 3} />
                  : <rect x={-13} y={-17} width={26} height={34} rx={4} fill={ns ? '#fff' : vis ? '#e5ea1e' : '#c8a26e'} stroke={selez ? '#e5ea1e' : '#000'} strokeWidth={selez ? 5 : 3} />}
                {ns && <path d="M-9,-11 L9,11 M9,-11 L-9,11" stroke="#d00" strokeWidth={4} />}
                {b.mobile && <circle r={22} fill="none" stroke="#b58cff" strokeWidth={3} strokeDasharray="5 4" />}
                <text x={0} y={-24} textAnchor="middle" fontSize={20} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={4} paintOrder="stroke">{b.id}</text>
                {n !== undefined && (
                  <g transform="translate(18,14)">
                    <circle r={13} fill={sovra?.inMovimento.includes(b.id) ? '#b58cff' : '#e5ea1e'} stroke="#000" strokeWidth={2} />
                    <text y={6} textAnchor="middle" fontSize={16} fontWeight={800} fill="#000">{n}</text>
                  </g>
                )}
              </g>
            )
          })}

          {/* posizioni */}
          {mappa.posizioni.map((p) => {
            const selez = sel?.tipo === 'pos' && sel.id === p.id
            return (
              <g key={p.id} transform={`translate(${X(p.x)},${Y(p.y)})`} onPointerDown={(e) => giuElemento(e, { tipo: 'pos', id: p.id })} style={{ cursor: 'pointer' }}>
                <circle r={30} fill="transparent" />
                <circle r={20} fill={selez ? '#e5ea1e' : '#141416'} stroke="#e5ea1e" strokeWidth={4} />
                <text y={7} textAnchor="middle" fontSize={19} fontWeight={800} fill={selez ? '#000' : '#e5ea1e'}>{p.id}</text>
              </g>
            )
          })}

          {/* partenza */}
          <g transform={`translate(${X(mappa.partenza.x)},${Y(mappa.partenza.y)})`} onPointerDown={(e) => giuElemento(e, { tipo: 'partenza', id: 'S' })} style={{ cursor: 'pointer' }}>
            <circle r={30} fill="transparent" />
            <path d="M0,-22 L20,14 L-20,14 z" fill="#3ddc84" stroke="#000" strokeWidth={3} />
            <text y={10} textAnchor="middle" fontSize={18} fontWeight={800} fill="#000">S</text>
          </g>
        </svg>
      </div>

      {modifica && selBers && strumento !== 'visibilita' && (
        <div className="card form" style={{ gap: 10 }}>
          <div className="row">
            <b>{selBers.id}</b>
            <div className="spacer" />
            <button className="btn icon ghost" aria-label={`Elimina ${selBers.id}`} onClick={() => {
              aggiorna({
                bersagli: mappa.bersagli.filter((x) => x.id !== selBers.id).map((x) => ({ ...x, attiva: x.attiva.filter((a) => a !== selBers.id) })),
                posizioni: mappa.posizioni.map((p) => ({ ...p, vede: p.vede.filter((v) => v !== selBers.id) })),
              })
              setSel(null)
            }}><Trash2 size={18} /></button>
          </div>
          <div className="chips">
            {(Object.keys(TIPI_BERSAGLIO) as TipoBersaglio[]).map((t) => (
              <button key={t} type="button" className={`chip-giorno${selBers.tipo === t ? ' attivo' : ''}`} style={{ padding: '0 10px' }} aria-pressed={selBers.tipo === t} onClick={() => setBers({ tipo: t })}>{TIPI_BERSAGLIO[t].nome}</button>
            ))}
          </div>
          {selBers.tipo !== 'noshoot' && (
            <>
              <div className="field">
                <span className="label">Distanza: {selBers.distanza} m</span>
                <div className="chips">
                  {DISTANZE.map((d) => <button key={d} type="button" className={`chip-giorno${selBers.distanza === d ? ' attivo' : ''}`} aria-pressed={selBers.distanza === d} onClick={() => setBers({ distanza: d })}>{d}</button>)}
                </div>
              </div>
              <div className="row">
                <label className="check"><input type="checkbox" checked={selBers.parziale} onChange={(e) => setBers({ parziale: e.target.checked })} /> Coperto in parte</label>
                <label className="check"><input type="checkbox" checked={selBers.mobile} onChange={(e) => setBers({ mobile: e.target.checked })} /> Mobile</label>
              </div>
              {TIPI_BERSAGLIO[selBers.tipo].metallo && (
                <div className="field">
                  <span className="label">Attiva</span>
                  <div className="chips">
                    {mappa.bersagli.filter((x) => x.id !== selBers.id && x.tipo !== 'noshoot').map((x) => (
                      <button key={x.id} type="button" className={`chip-giorno${selBers.attiva.includes(x.id) ? ' attivo' : ''}`} aria-pressed={selBers.attiva.includes(x.id)}
                        onClick={() => setBers({ attiva: selBers.attiva.includes(x.id) ? selBers.attiva.filter((a) => a !== x.id) : [...selBers.attiva, x.id] })}>{x.id}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modifica && selPos && (
        <div className="card form" style={{ gap: 10 }}>
          <div className="row">
            <b>{selPos.id}</b>
            <input className="input" style={{ flex: 1 }} value={selPos.nota} placeholder="Es. finestra sinistra" aria-label="Nota posizione"
              onChange={(e) => aggiorna({ posizioni: mappa.posizioni.map((p) => (p.id === selPos.id ? { ...p, nota: e.target.value } : p)) })} />
            <button className="btn icon ghost" aria-label={`Elimina ${selPos.id}`} onClick={() => { aggiorna({ posizioni: mappa.posizioni.filter((p) => p.id !== selPos.id) }); setSel(null) }}><Trash2 size={18} /></button>
          </div>
          <div className="field">
            <span className="label">Bersagli visibili da {selPos.id}</span>
            <div className="chips">
              {mappa.bersagli.filter((b) => b.tipo !== 'noshoot').map((b) => (
                <button key={b.id} type="button" className={`chip-giorno${selPos.vede.includes(b.id) ? ' attivo' : ''}`} aria-pressed={selPos.vede.includes(b.id)}
                  onClick={() => aggiorna({ posizioni: mappa.posizioni.map((p) => p.id !== selPos.id ? p : { ...p, vede: p.vede.includes(b.id) ? p.vede.filter((v) => v !== b.id) : [...p.vede, b.id] }) })}>{b.id}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modifica && (
        <div className="fields-2">
          <div className="field">
            <label htmlFor="m-larg">Larghezza campo: {mappa.larghezzaM} m</label>
            <input id="m-larg" type="range" min={8} max={40} step={1} value={mappa.larghezzaM} onChange={(e) => aggiorna({ larghezzaM: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="m-prof">Profondità: {mappa.profonditaM} m</label>
            <input id="m-prof" type="range" min={5} max={30} step={1} value={mappa.profonditaM} onChange={(e) => aggiorna({ profonditaM: Number(e.target.value) })} />
          </div>
        </div>
      )}
    </div>
  )
}
