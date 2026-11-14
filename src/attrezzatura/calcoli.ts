import type { Arma, Evento, Intervento, Manutenzione, ParteArma } from '../db/types'

export const uid = () => Math.random().toString(36).slice(2, 9)

export function partiDefault(oggi: string): ParteArma[] {
  return [
    { id: uid(), nome: 'Canna', installata: oggi, colpiInstallazione: 0, vitaColpi: null, note: 'Controlla precisione e rigatura: la vita dipende da palla e cariche.' },
    { id: uid(), nome: 'Molla di recupero', installata: oggi, colpiInstallazione: 0, vitaColpi: 5000, note: '' },
    { id: uid(), nome: 'Molla del percussore', installata: oggi, colpiInstallazione: 0, vitaColpi: 15000, note: '' },
    { id: uid(), nome: 'Estrattore', installata: oggi, colpiInstallazione: 0, vitaColpi: 20000, note: '' },
    { id: uid(), nome: 'Molle dei caricatori', installata: oggi, colpiInstallazione: 0, vitaColpi: 10000, note: '' },
  ]
}

export function manutenzioniDefault(oggi: string, ottica: boolean): Manutenzione[] {
  const m: Manutenzione[] = [
    { id: uid(), nome: 'Pulizia ordinaria', ogniColpi: 500, ogniGiorni: 30, ultimaColpi: 0, ultimaData: oggi },
    { id: uid(), nome: 'Pulizia completa e ispezione', ogniColpi: 2500, ogniGiorni: 180, ultimaColpi: 0, ultimaData: oggi },
    { id: uid(), nome: 'Pulizia caricatori', ogniColpi: 2000, ogniGiorni: 90, ultimaColpi: 0, ultimaData: oggi },
  ]
  if (ottica) m.push({ id: uid(), nome: 'Controllo viti ottica e batteria', ogniColpi: 1500, ogniGiorni: 90, ultimaColpi: 0, ultimaData: oggi })
  return m
}

const usaArma = (e: Evento, a: Arma) => (e.armaId ? e.armaId === a.id : a.principale)

/** Colpi totali dell'arma: iniziali + sessioni a fuoco e gare completate + colpi aggiunti a mano. */
export function colpiArma(a: Arma, eventi: Evento[], interventi: Intervento[]): number {
  const sessioni = eventi
    .filter((e) => e.completato && (e.tipo === 'fuoco' || e.tipo === 'gara') && e.data >= a.dal && usaArma(e, a))
    .reduce((s, e) => s + (e.colpiSparati ?? 0), 0)
  const extra = interventi.filter((i) => i.armaId === a.id && i.tipo === 'colpi').reduce((s, i) => s + (i.colpiAggiunti ?? 0), 0)
  return a.colpiIniziali + sessioni + extra
}

const giorniTra = (da: string, a: string) => Math.round((Date.parse(a) - Date.parse(da)) / 86400000)

export interface StatoVoce { quota: number; testo: string; livello: 'ok' | 'presto' | 'scaduta' }

export function statoParte(p: ParteArma, colpi: number): StatoVoce {
  const usati = Math.max(0, colpi - p.colpiInstallazione)
  if (!p.vitaColpi) return { quota: 0, testo: `${usati.toLocaleString('it-IT')} colpi`, livello: 'ok' }
  const quota = usati / p.vitaColpi
  return {
    quota,
    testo: `${usati.toLocaleString('it-IT')} / ${p.vitaColpi.toLocaleString('it-IT')} colpi`,
    livello: quota >= 1 ? 'scaduta' : quota >= 0.85 ? 'presto' : 'ok',
  }
}

export function statoManutenzione(m: Manutenzione, colpi: number, oggi: string): StatoVoce {
  const dc = Math.max(0, colpi - m.ultimaColpi)
  const dg = Math.max(0, giorniTra(m.ultimaData, oggi))
  const qc = m.ogniColpi ? dc / m.ogniColpi : 0
  const qg = m.ogniGiorni ? dg / m.ogniGiorni : 0
  const quota = Math.max(qc, qg)
  const parti: string[] = []
  if (m.ogniColpi) parti.push(`${dc}/${m.ogniColpi} colpi`)
  if (m.ogniGiorni) parti.push(`${dg}/${m.ogniGiorni} giorni`)
  return { quota, testo: parti.join(' · ') || 'nessun intervallo', livello: quota >= 1 ? 'scaduta' : quota >= 0.85 ? 'presto' : 'ok' }
}

export interface Avviso { armaId: number; arma: string; voce: string; stato: StatoVoce }

export function avvisiArma(a: Arma, colpi: number, oggi: string): Avviso[] {
  const out: Avviso[] = []
  for (const m of a.manutenzioni) {
    const st = statoManutenzione(m, colpi, oggi)
    if (st.livello !== 'ok') out.push({ armaId: a.id!, arma: a.nome, voce: m.nome, stato: st })
  }
  for (const p of a.parti) {
    const st = statoParte(p, colpi)
    if (st.livello !== 'ok') out.push({ armaId: a.id!, arma: a.nome, voce: `Sostituzione ${p.nome.toLowerCase()}`, stato: st })
  }
  return out.sort((x, y) => y.stato.quota - x.stato.quota)
}
