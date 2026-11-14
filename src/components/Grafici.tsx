import { useState } from 'react'

export interface Serie { nome: string; valori: (number | null)[]; colore: string; tratteggio?: boolean }

/**
 * Grafico a linee leggero: una scala sola, etichette dirette sull'ultimo punto,
 * tooltip al tocco o al passaggio del mouse su ogni gara.
 */
export function GraficoLinee({ etichette, serie, formato, invertito = false, minimo, massimo, titolo }: {
  etichette: string[]; serie: Serie[]; formato: (n: number) => string; invertito?: boolean; minimo?: number; massimo?: number; titolo: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 360, H = 190, PL = 38, PR = 64, PT = 12, PB = 26
  const tutti = serie.flatMap((s) => s.valori.filter((v): v is number => v !== null))
  if (!tutti.length) return null
  let lo = minimo ?? Math.min(...tutti), hi = massimo ?? Math.max(...tutti)
  if (hi - lo < 1e-9) { lo -= 1; hi += 1 }
  const pad = (hi - lo) * 0.12
  if (minimo === undefined) lo -= pad
  if (massimo === undefined) hi += pad
  const n = etichette.length
  const x = (i: number) => PL + (n === 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1))
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo)
    return PT + (invertito ? t : 1 - t) * (H - PT - PB)
  }
  const ticks = [0, 0.5, 1].map((t) => lo + t * (hi - lo))
  // etichette dirette senza sovrapposizioni
  const yEtichetta = serie.map((s) => { const u = [...s.valori].reverse().find((v) => v !== null); return u == null ? 0 : y(u) })
  const ordine = yEtichetta.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  for (let k = 1; k < ordine.length; k++) {
    const [v0] = ordine[k - 1]; const [v1, i1] = ordine[k]
    if (v1 - yEtichetta[ordine[k - 1][1]] < 12) yEtichetta[i1] = Math.max(v1, v0 + 12)
  }
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titolo} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--surface-3)" strokeWidth={1} />
            <text x={PL - 6} y={y(t) + 3} fontSize={9.5} textAnchor="end" fill="var(--faint)">{formato(t)}</text>
          </g>
        ))}
        {etichette.map((e, i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize={9} textAnchor="middle" fill={hover === i ? 'var(--text)' : 'var(--faint)'}>{e}</text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--faint)" strokeDasharray="3 3" />}
        {serie.map((s, si) => {
          const pts = s.valori.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => p !== null)
          const ultimo = [...s.valori].reverse().find((v) => v !== null)
          const iUltimo = s.valori.lastIndexOf(ultimo ?? null)
          return (
            <g key={s.nome}>
              <polyline fill="none" stroke={s.colore} strokeWidth={2} strokeDasharray={s.tratteggio ? '5 4' : undefined} strokeLinejoin="round" points={pts.map((p) => p.join(',')).join(' ')} />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={s.tratteggio ? 3 : 4} fill={s.tratteggio ? 'var(--bg)' : s.colore} stroke={s.colore} strokeWidth={s.tratteggio ? 1.5 : 0} />)}
              {ultimo !== undefined && ultimo !== null && (
                <text x={x(iUltimo) + 8} y={yEtichetta[si] + 3} fontSize={10} fill="var(--muted)">{s.nome}</text>
              )}
            </g>
          )
        })}
        {/* aree sensibili per il tooltip, più larghe dei punti */}
        {etichette.map((_, i) => (
          <rect key={i} x={x(i) - (W - PL - PR) / Math.max(2, n) / 2} y={0} width={(W - PL - PR) / Math.max(2, n)} height={H} fill="transparent"
            onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="tooltip-grafico" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="t">{etichette[hover]}</div>
          {serie.map((s) => s.valori[hover] !== null && (
            <div key={s.nome}><i style={{ background: s.colore }} />{s.nome}: <b>{formato(s.valori[hover]!)}</b></div>
          ))}
        </div>
      )}
      {serie.length > 1 && (
        <div className="legenda-schema" style={{ marginTop: 4 }}>
          {serie.map((s) => <span key={s.nome}><i style={{ background: s.colore, height: 3 }} />{s.nome}{s.tratteggio ? ' (tratteggio)' : ''}</span>)}
        </div>
      )}
    </div>
  )
}

/** Radar delle abilità (1–5), con un eventuale confronto tratteggiato. */
export function Radar({ assi, valori, confronto, titolo }: { assi: string[]; valori: number[]; confronto?: number[]; titolo: string }) {
  const W = 340, H = 300, cx = W / 2, cy = H / 2 + 4, R = 100
  const n = assi.length
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const p = (i: number, v: number) => [cx + Math.cos(ang(i)) * (R * v) / 5, cy + Math.sin(ang(i)) * (R * v) / 5]
  const poly = (vv: number[]) => vv.map((v, i) => p(i, v).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titolo}>
      {[1, 2, 3, 4, 5].map((l) => <polygon key={l} points={poly(new Array(n).fill(l))} fill="none" stroke="var(--surface-3)" />)}
      {assi.map((a, i) => {
        const [x, y] = p(i, 5.9)
        const [x1, y1] = p(i, 5)
        return (
          <g key={a}>
            <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="var(--surface-3)" />
            <text x={x} y={y + 3} fontSize={9} textAnchor={Math.abs(x - cx) < 10 ? 'middle' : x > cx ? 'start' : 'end'} fill="var(--muted)">{a}</text>
          </g>
        )
      })}
      {confronto && <polygon points={poly(confronto)} fill="none" stroke="var(--faint)" strokeWidth={1.5} strokeDasharray="4 3" />}
      <polygon points={poly(valori)} fill="rgba(229,234,30,0.18)" stroke="var(--accent)" strokeWidth={2} />
      {valori.map((v, i) => { const [x, y] = p(i, v); return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--accent)"><title>{`${assi[i]}: ${v}/5`}</title></circle> })}
    </svg>
  )
}
