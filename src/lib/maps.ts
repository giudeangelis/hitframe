/** Link di ricerca Google Maps per un luogo scritto a parole. */
export function mapsDaLuogo(luogo: string): string {
  const q = luogo.trim()
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''
}

/** Il link da usare: quello incollato dall'utente o quello automatico. */
export function linkMaps(e: { luogo: string; mapsUrl?: string }): string {
  return e.mapsUrl?.trim() || mapsDaLuogo(e.luogo)
}
