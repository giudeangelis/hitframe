import { Trash2 } from 'lucide-react'
import { useRef, useState, type PointerEvent as PE } from 'react'
import type { ElementoSchema, Schema, TipoElemento } from '../allenamento/schemi'

const COL = {
  carta: '#c9a77a', cartaBordo: '#8a6c45', ns: '#f4f4f2', acciaio: '#a7b0ba', acciaioBordo: '#6c7581',
  tiratore: 'var(--accent)', muro: '#5b5b63', freccia: 'var(--gara)', linea: 'var(--fuoco)', tavolo: '#7a5a3a',
}

const LINEARI: TipoElemento[] = ['muro', 'freccia', 'linea']

interface Vista { minX: number; maxX: number; minY: number; maxY: number; W: number; H: number; sx: number; sy: number }

function calcolaVista(el: ElementoSchema[], fissa?: { minX: number; maxX: number; minY: number; maxY: number }): Vista {
  let minX: number, maxX: number, minY: number, maxY: number
  if (fissa) ({ minX, maxX, minY, maxY } = fissa)
  else {
    const xs = el.flatMap((e) => [e.x, e.x2 ?? e.x])
    const ys = el.flatMap((e) => [e.y, e.y2 ?? e.y])
    minX = Math.min(-2.5, ...xs) - 1.4; maxX = Math.max(2.5, ...xs) + 1.4
    minY = Math.min(-1, ...ys) - 1.2; maxY = Math.max(3, ...ys) + 2.4
  }
  const W = 360
  const sx = W / (maxX - minX)
  const sy = Math.min(sx, 400 / (maxY - minY))
  return { minX, maxX, minY, maxY, W, H: (maxY - minY) * sy, sx, sy }
}

const px = (v: Vista, x: number) => (x - v.minX) * v.sx
const py = (v: Vista, y: number) => v.H - (y - v.minY) * v.sy

/** Sagoma IPSC vista di fronte, centrata in (cx, cy), alta h. */
function Sagoma({ cx, cy, h, fill, stroke, testa = true }: { cx: number; cy: number; h: number; fill: string; stroke: string; testa?: boolean }) {
  const w = h * 0.6
  const b = h * 0.75 // corpo
  const top = cy - h / 2 + (h - b)
  const c = w * 0.22
  const corpo = `M${cx - w / 2 + c},${top} L${cx + w / 2 - c},${top} L${cx + w / 2},${top + c} L${cx + w / 2},${top + b - c} L${cx + w / 2 - c},${top + b} L${cx - w / 2 + c},${top + b} L${cx - w / 2},${top + b - c} L${cx - w / 2},${top + c} Z`
  const hw = w * 0.32, hh = h - b
  return (
    <g>
      <path d={corpo} fill={fill} stroke={stroke} strokeWidth={1} />
      {testa && <rect x={cx - hw / 2} y={top - hh} width={hw} height={hh} fill={fill} stroke={stroke} strokeWidth={1} />}
    </g>
  )
}

function Elemento({ e, v, sel }: { e: ElementoSchema; v: Vista; sel: boolean }) {
  const x = px(v, e.x), y = py(v, e.y)
  const s = Math.max(16, Math.min(30, v.sx * 0.6))
  const evid = sel ? { filter: 'drop-shadow(0 0 4px var(--accent))' } : undefined
  const etichetta = (dy: number) => (
    <>
      {e.id && <text x={x} y={y + dy} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text)">{e.id}</text>}
      {e.nota && <text x={x} y={y - s * 0.75 - 4} textAnchor="middle" fontSize={9.5} fill="var(--accent)">{e.nota}</text>}
    </>
  )
  switch (e.t) {
    case 'carta':
    case 'mini':
      return <g style={evid}><Sagoma cx={x} cy={y} h={e.t === 'mini' ? s * 0.75 : s} fill={COL.carta} stroke={COL.cartaBordo} />{etichetta(s * 0.5 + 11)}</g>
    case 'noshoot':
      return <g style={evid}><Sagoma cx={x} cy={y} h={s} fill={COL.ns} stroke="#999" /><text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#c33">NS</text></g>
    case 'popper':
    case 'miniPopper': {
      const r = e.t === 'popper' ? s * 0.32 : s * 0.24
      return (
        <g style={evid}>
          <rect x={x - r * 0.35} y={y - r * 0.2} width={r * 0.7} height={r * 1.6} fill={COL.acciaio} stroke={COL.acciaioBordo} />
          <circle cx={x} cy={y - r * 0.6} r={r} fill={COL.acciaio} stroke={COL.acciaioBordo} />
          {etichetta(r * 1.6 + 11)}
        </g>
      )
    }
    case 'piastra':
      return <g style={evid}><circle cx={x} cy={y} r={s * 0.22} fill={COL.acciaio} stroke={COL.acciaioBordo} />{e.id && <text x={x} y={y + s * 0.22 + 11} textAnchor="middle" fontSize={9} fill="var(--muted)">{e.id}</text>}</g>
    case 'tiratore': {
      const r = 9
      const dir = e.verso === 'indietro' ? 1 : -1
      return (
        <g style={evid}>
          <circle cx={x} cy={y} r={r} fill={COL.tiratore} />
          <path d={`M${x - 5},${y + dir * 4} L${x},${y + dir * (r + 7)} L${x + 5},${y + dir * 4}`} fill={COL.tiratore} />
          <text x={x} y={y + 3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill="var(--accent-ink)">TU</text>
          {e.verso === 'indietro' && <text x={x} y={y + 26} textAnchor="middle" fontSize={9} fill="var(--muted)">di spalle</text>}
        </g>
      )
    }
    case 'box': {
      const l = 1.3 * v.sx
      return <g style={evid}><rect x={x - l / 2} y={y - l / 2} width={l} height={l} fill="none" stroke="var(--muted)" strokeDasharray="5 3" strokeWidth={1.5} />{e.id && <text x={x - l / 2 + 4} y={y - l / 2 + 11} fontSize={9} fill="var(--muted)">{e.id}</text>}</g>
    }
    case 'tavolo': {
      const w = 1.2 * v.sx, h = Math.max(10, 0.5 * v.sy)
      return <g style={evid}><rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={2} fill={COL.tavolo} /><text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="#fff">tavolo</text></g>
    }
    case 'muro':
    case 'freccia':
    case 'linea': {
      const x2 = px(v, e.x2 ?? e.x), y2 = py(v, e.y2 ?? e.y)
      if (e.t === 'muro') return <line style={evid} x1={x} y1={y} x2={x2} y2={y2} stroke={COL.muro} strokeWidth={7} strokeLinecap="round" />
      if (e.t === 'linea') return <line style={evid} x1={x} y1={y} x2={x2} y2={y2} stroke={COL.linea} strokeWidth={2} strokeDasharray="6 4" />
      return <line style={evid} x1={x} y1={y} x2={x2} y2={y2} stroke={COL.freccia} strokeWidth={3} markerEnd="url(#punta)" />
    }
  }
}

function Tela({ schema, v, sel, children, svgRef, onPointerDown, onPointerMove, onPointerUp, etichetta }: {
  schema: Schema; v: Vista; sel?: number | null; children?: React.ReactNode; svgRef?: React.Ref<SVGSVGElement>
  onPointerDown?: (e: PE<SVGSVGElement>) => void; onPointerMove?: (e: PE<SVGSVGElement>) => void; onPointerUp?: (e: PE<SVGSVGElement>) => void; etichetta: string
}) {
  const tutte = [...new Set(schema.elementi.filter((e) => ['carta', 'mini', 'popper', 'miniPopper', 'piastra'].includes(e.t) && e.y > 0).map((e) => Math.round(e.y * 2) / 2))].sort((a, b) => a - b)
  // niente etichette sovrapposte
  const distanze = tutte.filter((d, i) => i === 0 || (d - tutte[i - 1]) * v.sy >= 14)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${v.W} ${v.H}`} width="100%" role="img" aria-label={etichetta} className="drill-schema"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{ touchAction: onPointerDown ? 'none' : undefined }}>
      <defs>
        <marker id="punta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={COL.freccia} /></marker>
      </defs>
      <rect x={0} y={0} width={v.W} height={v.H} fill="var(--bg)" rx={10} />
      {/* parapalle */}
      <rect x={0} y={0} width={v.W} height={10} fill="#2a2a30" rx={4} />
      {/* linea di tiro */}
      <line x1={8} x2={v.W - 8} y1={py(v, 0)} y2={py(v, 0)} stroke="var(--faint)" strokeDasharray="2 4" />
      {/* distanze */}
      {distanze.map((d) => (
        <g key={d}>
          <line x1={22} x2={v.W - 8} y1={py(v, d)} y2={py(v, d)} stroke="var(--surface-3)" strokeDasharray="1 5" />
          <text x={6} y={py(v, d) + 3} fontSize={9.5} fontWeight={700} fill="var(--muted)">{String(d).replace('.', ',')} m</text>
        </g>
      ))}
      {schema.elementi.map((e, i) => <Elemento key={i} e={e} v={v} sel={sel === i} />)}
      {children}
    </svg>
  )
}

export function DrillSchema({ schema, titolo }: { schema: Schema; titolo: string }) {
  const v = calcolaVista(schema.elementi)
  return <Tela schema={schema} v={v} etichetta={`Disegno del drill ${titolo}`} />
}

/* ---------- Editor per i drill personali ---------- */

const STRUMENTI: { t: TipoElemento | 'sposta'; label: string }[] = [
  { t: 'sposta', label: 'Sposta' }, { t: 'carta', label: 'Carta' }, { t: 'mini', label: 'Mini' }, { t: 'noshoot', label: 'No-shoot' },
  { t: 'popper', label: 'Popper' }, { t: 'miniPopper', label: 'Mini popper' }, { t: 'piastra', label: 'Piastra' }, { t: 'tiratore', label: 'Tiratore' },
  { t: 'box', label: 'Box' }, { t: 'tavolo', label: 'Tavolo' }, { t: 'muro', label: 'Parete' }, { t: 'linea', label: 'Fault line' }, { t: 'freccia', label: 'Movimento' },
]

const arrot = (n: number) => Math.round(n * 4) / 4

export function EditorSchema({ schema, onChange }: { schema: Schema; onChange: (s: Schema) => void }) {
  const [strumento, setStrumento] = useState<TipoElemento | 'sposta'>('carta')
  const [sel, setSel] = useState<number | null>(null)
  const [prof, setProf] = useState(() => Math.max(10, ...schema.elementi.map((e) => Math.max(e.y, e.y2 ?? 0) + 2)) > 12 ? 25 : 12)
  const svg = useRef<SVGSVGElement>(null)
  const trascina = useRef<{ i: number; dx: number; dy: number; linea?: boolean } | null>(null)
  const v = calcolaVista(schema.elementi, { minX: -6, maxX: 6, minY: -5, maxY: prof })
  const el = schema.elementi

  const punto = (e: PE<SVGSVGElement>) => {
    const p = svg.current!.createSVGPoint()
    p.x = e.clientX; p.y = e.clientY
    const q = p.matrixTransform(svg.current!.getScreenCTM()!.inverse())
    return { x: q.x / v.sx + v.minX, y: (v.H - q.y) / v.sy + v.minY }
  }
  const aggiorna = (i: number, patch: Partial<ElementoSchema>) => onChange({ elementi: el.map((e, k) => (k === i ? { ...e, ...patch } : e)) })
  const vicino = (x: number, y: number) => {
    let best = -1, dist = 0.9
    el.forEach((e, i) => {
      const d = LINEARI.includes(e.t)
        ? Math.min(Math.hypot(e.x - x, e.y - y), Math.hypot((e.x2 ?? e.x) - x, (e.y2 ?? e.y) - y))
        : Math.hypot(e.x - x, e.y - y)
      if (d < dist) { dist = d; best = i }
    })
    return best
  }

  function down(e: PE<SVGSVGElement>) {
    const p = punto(e)
    svg.current!.setPointerCapture(e.pointerId)
    if (strumento === 'sposta') {
      const i = vicino(p.x, p.y)
      setSel(i >= 0 ? i : null)
      if (i >= 0) trascina.current = { i, dx: p.x - el[i].x, dy: p.y - el[i].y }
      return
    }
    const nuovo: ElementoSchema = { t: strumento, x: arrot(p.x), y: arrot(p.y) }
    if (LINEARI.includes(strumento)) { nuovo.x2 = nuovo.x; nuovo.y2 = nuovo.y }
    if (['carta', 'mini'].includes(strumento)) {
      nuovo.id = `T${el.filter((x) => x.t === 'carta' || x.t === 'mini').length + 1}`
      nuovo.nota = '×2'
    }
    if (strumento === 'popper' || strumento === 'miniPopper') nuovo.id = `${strumento === 'popper' ? 'PP' : 'MP'}${el.filter((x) => x.t === strumento).length + 1}`
    const i = el.length
    onChange({ elementi: [...el, nuovo] })
    setSel(i)
    trascina.current = LINEARI.includes(strumento) ? { i, dx: 0, dy: 0, linea: true } : { i, dx: 0, dy: 0 }
  }
  function move(e: PE<SVGSVGElement>) {
    const t = trascina.current
    if (!t) return
    const p = punto(e)
    if (t.linea) aggiorna(t.i, { x2: arrot(p.x), y2: arrot(p.y) })
    else {
      const o = el[t.i]
      const nx = arrot(p.x - t.dx), ny = arrot(p.y - t.dy)
      const patch: Partial<ElementoSchema> = { x: nx, y: ny }
      if (LINEARI.includes(o.t)) { patch.x2 = (o.x2 ?? o.x) + nx - o.x; patch.y2 = (o.y2 ?? o.y) + ny - o.y }
      aggiorna(t.i, patch)
    }
  }
  function up() {
    const t = trascina.current
    trascina.current = null
    // linea troppo corta = annulla
    if (t?.linea) {
      const e = el[t.i]
      if (e && Math.hypot((e.x2 ?? e.x) - e.x, (e.y2 ?? e.y) - e.y) < 0.5) { onChange({ elementi: el.filter((_, k) => k !== t.i) }); setSel(null) }
    }
  }

  const s = sel !== null ? el[sel] : null
  return (
    <div className="form" style={{ gap: 10 }}>
      <div className="chips">
        {STRUMENTI.map((x) => (
          <button type="button" key={x.t} className={`chip-giorno${strumento === x.t ? ' attivo' : ''}`} style={{ padding: '0 10px', minHeight: 34 }} onClick={() => setStrumento(x.t)}>{x.label}</button>
        ))}
      </div>
      <p className="prose" style={{ margin: 0, fontSize: 12 }}>
        {strumento === 'sposta' ? 'Trascina un elemento per spostarlo, toccalo per modificarlo.' : LINEARI.includes(strumento as TipoElemento) ? 'Trascina sul disegno per tracciare.' : 'Tocca il disegno per aggiungere. I bersagli in alto, tu in basso.'}
      </p>
      <Tela schema={schema} v={v} sel={sel} svgRef={svg} onPointerDown={down} onPointerMove={move} onPointerUp={up} etichetta="Editor del disegno del drill" />
      <div className="row" style={{ fontSize: 13 }}>
        <span className="label">Profondità</span>
        {[12, 25].map((p) => <button type="button" key={p} className={`chip-giorno${prof === p ? ' attivo' : ''}`} style={{ minHeight: 30 }} onClick={() => setProf(p)}>{p} m</button>)}
      </div>
      {s && sel !== null && (
        <div className="card" style={{ background: 'var(--bg)', padding: 12 }}>
          <div className="fields-3">
            {['carta', 'mini', 'popper', 'miniPopper', 'piastra', 'box'].includes(s.t) && (
              <div className="field"><label htmlFor="se-id">Nome</label><input id="se-id" className="input" value={s.id ?? ''} onChange={(e) => aggiorna(sel, { id: e.target.value })} /></div>
            )}
            {['carta', 'mini', 'popper', 'miniPopper'].includes(s.t) && (
              <div className="field"><label htmlFor="se-nota">Colpi / nota</label><input id="se-nota" className="input" value={s.nota ?? ''} onChange={(e) => aggiorna(sel, { nota: e.target.value })} /></div>
            )}
            {!LINEARI.includes(s.t) && (
              <div className="field"><label htmlFor="se-y">Distanza (m)</label><input id="se-y" className="input" inputMode="decimal" value={String(s.y).replace('.', ',')} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) aggiorna(sel, { y: n }) }} /></div>
            )}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {s.t === 'tiratore' && (
              <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => aggiorna(sel, { verso: s.verso === 'indietro' ? 'avanti' : 'indietro' })}>
                {s.verso === 'indietro' ? 'Di spalle' : 'Fronte ai bersagli'}
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="btn ghost" style={{ minHeight: 36 }} onClick={() => { onChange({ elementi: el.filter((_, k) => k !== sel) }); setSel(null) }}><Trash2 size={16} /> Togli</button>
          </div>
        </div>
      )}
    </div>
  )
}
