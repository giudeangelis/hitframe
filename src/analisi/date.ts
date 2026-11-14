const MESI: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Interpreta date come "16-17 MAGGIO 2026", "11 - 12 aprile 2026", "16-17-18 october 2026".
 * Restituisce primo e ultimo giorno in formato YYYY-MM-DD, oppure null.
 */
export function leggiDateGara(testo: string): { inizio: string; fine: string } | null {
  const t = testo.toLowerCase()
  const m = t.match(/((?:\d{1,2}\s*(?:[-–/,]|e|and)\s*)*\d{1,2})\s+([a-zà]+)\s+(\d{4})/)
  if (!m) return null
  const mese = MESI[m[2]]
  if (!mese) return null
  const giorni = m[1].match(/\d{1,2}/g)!.map(Number).filter((g) => g >= 1 && g <= 31)
  if (!giorni.length) return null
  const anno = Number(m[3])
  return {
    inizio: `${anno}-${pad(mese)}-${pad(Math.min(...giorni))}`,
    fine: `${anno}-${pad(mese)}-${pad(Math.max(...giorni))}`,
  }
}
