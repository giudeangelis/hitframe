import { Trash2 } from 'lucide-react'
import { useRef, useState, type PointerEvent as PE } from 'react'
import type { ElementoSchema, Schema, TipoElemento } from '../allenamento/schemi'

const COL = {
  carta: '#c9a77a', cartaBordo: '#8a6c45', ns: '#f4f4f2', acciaio: '#2f6fd6', acciaioBordo: '#173f80',
  tiratore: 'var(--accent)', muro: '#5b5b63', freccia: 'var(--gara)', linea: 'var(--fuoco)', tavolo: '#7a5a3a',
}

const LINEARI: TipoElemento[] = ['muro', 'freccia', 'linea']

interface Vista { minX: number; maxX: number; minY: number; maxY: number; W: number; H: number; sx: number; sy: number }

function calcolaVista(el: ElementoSchema[], fissa?: { minX: number; maxX: number; minY: number; maxY: number }, hMax = 400): Vista {
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
  const sy = Math.min(sx, hMax / (maxY - minY))
  return { minX, maxX, minY, maxY, W, H: (maxY - minY) * sy, sx, sy }
}

const px = (v: Vista, x: number) => (x - v.minX) * v.sx
const py = (v: Vista, y: number) => v.H - (y - v.minY) * v.sy

/** Bersaglio IPSC ottagonale (46 × 58 cm) visto di fronte, con zone A, C e D accennate. */
function Sagoma({ cx, cy, h, fill, stroke, zone = true }: { cx: number; cy: number; h: number; fill: string; stroke: string; zone?: boolean }) {
  const ottagono = (w: number, hh: number, tx: number, ty: number) => {
    const l = cx - w / 2, r = cx + w / 2, t = cy - hh / 2, b = cy + hh / 2
    return `M${l + tx},${t} L${r - tx},${t} L${r},${t + ty} L${r},${b - ty} L${r - tx},${b} L${l + tx},${b} L${l},${b - ty} L${l},${t + ty} Z`
  }
  const w = h * 0.79
  return (
    <g>
      <path d={ottagono(w, h, w * 0.27, h * 0.24)} fill={fill} stroke={stroke} strokeWidth={1} />
      {zone && h >= 14 && (
        <>
          <path d={ottagono(w * 0.66, h * 0.8, w * 0.17, h * 0.17)} fill="none" stroke={stroke} strokeWidth={0.6} opacity={0.55} />
          <rect x={cx - w * 0.15} y={cy - h * 0.3} width={w * 0.3} height={h * 0.56} rx={w * 0.12} fill="none" stroke={stroke} strokeWidth={0.6} opacity={0.7} />
        </>
      )}
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
      return <g style={evid}><Sagoma cx={x} cy={y} h={s} fill={COL.ns} stroke="#999" zone={false} /><text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#c33">NS</text></g>
    case 'popper':
    case 'miniPopper': {
      // sagoma del popper IPSC: testa tonda, collo stretto, corpo che si allarga, base
      const h = e.t === 'popper' ? s * 1.35 : s * 0.85
      const top = y - h / 2
      const rT = h * 0.17, collo = h * 0.07, base = h * 0.2
      const yC = top + rT * 2
      const corpo = `M${x - collo},${yC - rT * 0.25} L${x - base},${y + h / 2 - h * 0.08} L${x + base},${y + h / 2 - h * 0.08} L${x + collo},${yC - rT * 0.25} Z`
      return (
        <g style={evid}>
          <path d={corpo} fill={COL.acciaio} stroke={COL.acciaioBordo} strokeWidth={1} />
          <circle cx={x} cy={top + rT} r={rT} fill={COL.acciaio} stroke={COL.acciaioBordo} strokeWidth={1} />
          <rect x={x - base * 1.15} y={y + h / 2 - h * 0.08} width={base * 2.3} height={h * 0.08} fill={COL.acciaioBordo} />
          {e.id && <text x={x} y={y + h / 2 + 11} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--text)">{e.id}</text>}
        </g>
      )
    }
    case 'piastra': {
      const r = s * 0.24
      const asta = e.variante !== 'terra'
      return (
        <g style={evid}>
          {asta
            ? <line x1={x} y1={y + r} x2={x} y2={y + r + s * 0.75} stroke={COL.acciaioBordo} strokeWidth={2} />
            : <line x1={x - r * 1.2} y1={y + r + 2} x2={x + r * 1.2} y2={y + r + 2} stroke={COL.acciaioBordo} strokeWidth={2.5} />}
          <circle cx={x} cy={y} r={r} fill={COL.acciaio} stroke={COL.acciaioBordo} strokeWidth={1} />
          {e.id && <text x={x} y={y + (asta ? r + s * 0.75 + 10 : r + 13)} textAnchor="middle" fontSize={9} fill="var(--muted)">{e.id}</text>}
        </g>
      )
    }
    case 'bobber': {
      // perno in basso, braccio che oscilla: l'arco con le frecce indica il movimento
      const L = s * 1.25
      const piatto = e.variante === 'piatto'
      const passata = e.variante === 'passata'
      const ang = (g: number) => [x + Math.sin((g * Math.PI) / 180) * L, y - Math.cos((g * Math.PI) / 180) * L]
      const [ax, ay] = ang(-55), [bx, by] = ang(55)
      const [tx, ty] = ang(25)
      return (
        <g style={evid}>
          <path d={`M${ax},${ay} A${L},${L} 0 0 1 ${bx},${by}`} fill="none" stroke="var(--gara)" strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#punta)" markerStart="url(#punta)" />
          <line x1={x} y1={y} x2={tx} y2={ty} stroke={COL.acciaioBordo} strokeWidth={2.5} />
          <circle cx={x} cy={y} r={3.5} fill="var(--text)" />
          {piatto
            ? <circle cx={tx} cy={ty} r={s * 0.3} fill={COL.acciaio} stroke={COL.acciaioBordo} />
            : <Sagoma cx={tx} cy={ty} h={s} fill={COL.carta} stroke={COL.cartaBordo} />}
          {passata && <rect x={x - L * 1.05} y={y - L * 1.2} width={L * 0.95} height={L * 1.15} fill="#5b5b63" opacity={0.9} rx={2} />}
          {e.id && <text x={x} y={y + 14} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--text)">{e.id}</text>}
          {e.nota && <text x={tx + s * 0.6} y={ty - s * 0.4} fontSize={9.5} fill="var(--accent)">{e.nota}</text>}
        </g>
      )
    }
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
    case 'barile': {
      const r = Math.max(7, 0.3 * v.sx)
      return <g style={evid}><circle cx={x} cy={y} r={r} fill="#1f5fae" stroke="#163f72" strokeWidth={1.5} /><circle cx={x} cy={y} r={r * 0.55} fill="none" stroke="#0e2a4d" strokeWidth={2} /></g>
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
  const tutte = [...new Set(schema.elementi.filter((e) => ['carta', 'mini', 'popper', 'miniPopper', 'piastra', 'bobber'].includes(e.t) && e.y > 0).map((e) => Math.round(e.y * 2) / 2))].sort((a, b) => a - b)
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

type Strumento = { t: TipoElemento | 'sposta'; label: string; variante?: string }
const STRUMENTI: Strumento[] = [
  { t: 'sposta', label: 'Sposta' }, { t: 'carta', label: 'Carta' }, { t: 'mini', label: 'Mini' }, { t: 'noshoot', label: 'No-shoot' },
  { t: 'popper', label: 'Popper' }, { t: 'miniPopper', label: 'Mini popper' },
  { t: 'piastra', label: 'Piastra su asta', variante: 'asta' }, { t: 'piastra', label: 'Piastra a terra', variante: 'terra' },
  { t: 'bobber', label: 'Bobber laterale', variante: 'laterale' }, { t: 'bobber', label: 'Bobber in passata', variante: 'passata' }, { t: 'bobber', label: 'Bobber con piatto', variante: 'piatto' },
  { t: 'tiratore', label: 'Tiratore' }, { t: 'box', label: 'Box' }, { t: 'tavolo', label: 'Tavolo' }, { t: 'barile', label: 'Barile' },
  { t: 'muro', label: 'Parete' }, { t: 'linea', label: 'Fault line' }, { t: 'freccia', label: 'Movimento' },
]
const chiave = (x: Strumento) => `${x.t}${x.variante ? `:${x.variante}` : ''}`

const arrot = (n: number) => Math.round(n * 4) / 4
const CAMPI = [
  { nome: '12 × 12 m', l: 12, p: 12 }, { nome: '12 × 25 m', l: 12, p: 25 }, { nome: '20 × 25 m', l: 20, p: 25 }, { nome: '30 × 30 m', l: 30, p: 30 },
]

export type Mappatore = (x: number, y: number) => [number, number]

export function EditorSchema({ schema, onChange, campo, extra, onSelect, strumenti }: {
  schema: Schema; onChange: (s: Schema) => void
  /** campo in metri (stage designer); senza, l'editor dei drill da 12 o 25 m */
  campo?: { larghezza: number; profondita: number }
  /** disegni aggiuntivi sopra lo schema (raggi visivi, percorso) */
  extra?: (m: Mappatore) => React.ReactNode
  onSelect?: (i: number | null) => void
  strumenti?: (TipoElemento | 'sposta')[]
}) {
  const [strumentoK, setStrumentoK] = useState('carta')
  const strumentoSel = STRUMENTI.find((x) => chiave(x) === strumentoK) ?? STRUMENTI[1]
  const strumento = strumentoSel.t
  const [sel, setSelInt] = useState<number | null>(null)
  const setSel = (i: number | null) => { setSelInt(i); onSelect?.(i) }
  const [dimInt, setDim] = useState(() => {
    const maxY = Math.max(10, ...schema.elementi.map((e) => Math.max(e.y, e.y2 ?? 0) + 2))
    const maxX = Math.max(5, ...schema.elementi.map((e) => Math.max(Math.abs(e.x), Math.abs(e.x2 ?? 0)) + 1))
    return CAMPI.find((c) => c.l / 2 >= maxX && c.p >= maxY) ?? CAMPI[CAMPI.length - 1]
  })
  const dim = campo ? { l: campo.larghezza, p: campo.profondita } : dimInt
  const svg = useRef<SVGSVGElement>(null)
  const trascina = useRef<{ i: number; dx: number; dy: number; linea?: boolean } | null>(null)
  const v = calcolaVista(schema.elementi, { minX: -dim.l / 2, maxX: dim.l / 2, minY: dim.p > 12 ? -3 : -5, maxY: dim.p }, dim.p > 12 ? 560 : 400)
  const mappa: Mappatore = (x, y) => [px(v, x), py(v, y)]
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
    const nuovo: ElementoSchema = { t: strumento, x: arrot(p.x), y: arrot(p.y), ...(strumentoSel.variante ? { variante: strumentoSel.variante } : {}) }
    if (strumento === 'bobber') { nuovo.id = `B${el.filter((x) => x.t === 'bobber').length + 1}`; nuovo.nota = strumentoSel.variante === 'piatto' ? '×1' : '×2' }
    if (LINEARI.includes(strumento)) { nuovo.x2 = nuovo.x; nuovo.y2 = nuovo.y }
    if (['carta', 'mini'].includes(strumento)) {
      nuovo.id = `T${el.filter((x) => x.t === 'carta' || x.t === 'mini').length + 1}`
      nuovo.nota = '×2'
    }
    if (strumento === 'popper' || strumento === 'miniPopper') nuovo.id = `${strumento === 'popper' ? 'PP' : 'MP'}${el.filter((x) => x.t === strumento).length + 1}`
    if (strumento === 'piastra') nuovo.id = `PL${el.filter((x) => x.t === 'piastra').length + 1}`
    if (strumento === 'box') nuovo.id = `P${el.filter((x) => x.t === 'box').length + 1}`
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
        {STRUMENTI.filter((x) => !strumenti || strumenti.includes(x.t)).map((x) => (
          <button type="button" key={chiave(x)} className={`chip-giorno${strumentoK === chiave(x) ? ' attivo' : ''}`} style={{ padding: '0 10px', minHeight: 34 }} onClick={() => setStrumentoK(chiave(x))}>{x.label}</button>
        ))}
      </div>
      <p className="prose" style={{ margin: 0, fontSize: 12 }}>
        {strumento === 'sposta' ? 'Trascina un elemento per spostarlo, toccalo per modificarlo.' : LINEARI.includes(strumento as TipoElemento) ? 'Trascina sul disegno per tracciare.' : 'Tocca il disegno per aggiungere. I bersagli in alto, tu in basso.'}
      </p>
      <Tela schema={schema} v={v} sel={sel} svgRef={svg} onPointerDown={down} onPointerMove={move} onPointerUp={up} etichetta="Editor del disegno">{extra?.(mappa)}</Tela>
      {!campo && (
        <div className="row" style={{ fontSize: 13 }}>
          <span className="label">Campo</span>
          {CAMPI.map((c) => <button type="button" key={c.nome} className={`chip-giorno${dim.l === c.l && dim.p === c.p ? ' attivo' : ''}`} style={{ minHeight: 30, padding: '0 10px' }} onClick={() => setDim(c)}>{c.nome}</button>)}
        </div>
      )}
      {s && sel !== null && (
        <div className="card" style={{ background: 'var(--bg)', padding: 12 }}>
          <div className="fields-3">
            {['carta', 'mini', 'popper', 'miniPopper', 'piastra', 'box', 'noshoot', 'bobber'].includes(s.t) && (
              <div className="field"><label htmlFor="se-id">Nome</label><input id="se-id" className="input" value={s.id ?? ''} onChange={(e) => aggiorna(sel, { id: e.target.value })} /></div>
            )}
            {['carta', 'mini', 'popper', 'miniPopper', 'bobber'].includes(s.t) && (
              <div className="field"><label htmlFor="se-nota">Colpi / nota</label><input id="se-nota" className="input" value={s.nota ?? ''} onChange={(e) => aggiorna(sel, { nota: e.target.value })} /></div>
            )}
            {!LINEARI.includes(s.t) && (
              <div className="field"><label htmlFor="se-x">Laterale (m)</label><input id="se-x" className="input" inputMode="decimal" value={String(s.x).replace('.', ',')} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) aggiorna(sel, { x: n }) }} /></div>
            )}
            {!LINEARI.includes(s.t) && (
              <div className="field"><label htmlFor="se-y">Distanza (m)</label><input id="se-y" className="input" inputMode="decimal" value={String(s.y).replace('.', ',')} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) aggiorna(sel, { y: n }) }} /></div>
            )}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {s.t === 'piastra' && (
              <button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => aggiorna(sel, { variante: s.variante === 'terra' ? 'asta' : 'terra' })}>
                {s.variante === 'terra' ? 'A terra' : 'Su asta da 1 m'}
              </button>
            )}
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
