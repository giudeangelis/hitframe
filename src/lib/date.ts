import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

/** Data locale in formato YYYY-MM-DD (senza conversioni UTC). */
export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

export const oggiKey = () => toKey(new Date())

export const fromKey = (k: string) => parseISO(k)

export const fmt = (k: string, pattern: string) => format(fromKey(k), pattern, { locale: it })

export const fmtLungo = (k: string) => fmt(k, 'EEEE d MMMM yyyy')
export const fmtMedio = (k: string) => fmt(k, 'EEE d MMM')

export function giorniDa(k: string): number {
  return differenceInCalendarDays(fromKey(k), new Date())
}

export function quando(k: string): string {
  const g = giorniDa(k)
  if (g === 0) return 'Oggi'
  if (g === 1) return 'Domani'
  if (g === -1) return 'Ieri'
  if (g > 1 && g < 7) return `Tra ${g} giorni`
  return fmtMedio(k)
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
