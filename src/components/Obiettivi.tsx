import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Circle, Flag, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db, normalizzaProfilo, nowIso } from '../db/db'
import type { Obiettivo, TipoObiettivo } from '../db/types'
import { fmt } from '../lib/date'
import { ETICHETTE_STATO, nuovoObiettivo, tappeSuggerite, valuta, type DatiAtleta, type Stato } from '../obiettivi/valuta'
import { puntiGara } from '../statistiche/calcoli'
import { numOrNull, Segmented, Sheet, useToast } from './ui'

export const COLORI_STATO: Record<Stato, string> = {
  raggiunto: 'var(--ok)', 'in-linea': 'var(--ok)', attenzione: 'var(--accent)', 'fuori-strada': 'var(--fuoco)', 'pochi-dati': 'var(--muted)',
}

/** Tutto quello che serve per valutare gli obiettivi. */
export function useDatiAtleta(): DatiAtleta | null {
  const risultati = useLiveQuery(() => db.risultati.toArray())
  const analisi = useLiveQuery(() => db.analisi.toArray())
  const eventi = useLiveQuery(() => db.eventi.toArray())
  const diario = useLiveQuery(() => db.diario.toArray())
  return useMemo(() => (risultati && analisi && eventi && diario ? { punti: puntiGara(risultati, analisi), eventi, diario } : null), [risultati, analisi, eventi, diario])
}

export function useObiettivi(): Obiettivo[] | undefined {
  return useLiveQuery(async () => (await db.profilo.get('me'))?.obiettivi ?? [])
}

async function salvaObiettivi(f: (l: Obiettivo[]) => Obiettivo[]) {
  const p = normalizzaProfilo(await db.profilo.get('me'))
  await db.profilo.put({ ...p, obiettivi: f(p.obiettivi ?? []), aggiornato: nowIso() })
}

const TIPI: { value: TipoObiettivo; label: string }[] = [
  { value: 'media', label: 'Media %' },
  { value: 'reale', label: 'Punt. reale' },
  { value: 'evento', label: 'Traguardo' },
  { value: 'libero', label: 'Libero' },
]

/** Scheda di un obiettivo con il giudizio sull'andamento. */
export function CardObiettivo({ o, dati, onModifica, compatta = false }: { o: Obiettivo; dati: DatiAtleta; onModifica?: () => void; compatta?: boolean }) {
  const v = valuta(o, dati)
  const toast = useToast()
  const segna = (i: number) => salvaObiettivi((l) => l.map((x) => (x.id === o.id ? { ...x, tappe: x.tappe.map((t, k) => (k === i ? { ...t, fatto: !t.fatto } : t)) } : x)))
    .then(() => toast(o.tappe[i].fatto ? 'Tappa riaperta' : 'Tappa completata'))
  return (
    <div className="obiettivo">
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        <Flag size={18} color={COLORI_STATO[v.stato]} style={{ marginTop: 3, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">{o.titolo || 'Obiettivo'}</div>
          <div className="meta">{o.orizzonte === 'breve' ? 'Breve termine' : 'Lungo termine'} · entro {fmt(o.entro, 'd MMM yyyy')}{o.classe ? ` · classe ${o.classe}` : ''}</div>
          <span className="badge" style={{ color: COLORI_STATO[v.stato], marginTop: 6, display: 'inline-block' }}>{ETICHETTE_STATO[v.stato]}</span>
        </div>
        {onModifica && <button className="btn icon ghost" style={{ width: 36, minHeight: 36 }} aria-label="Modifica obiettivo" onClick={onModifica}><Pencil size={16} /></button>}
      </div>
      <div style={{ marginTop: 8, fontWeight: 700 }}>{v.titolo}</div>
      {v.avanzamento !== null && <div className="progresso" style={{ height: 8 }}><span style={{ width: `${v.avanzamento}%`, background: COLORI_STATO[v.stato] }} /></div>}
      {!compatta && (
        <>
          <ul className="obiettivo-righe">{v.dettagli.map((d) => <li key={d}>{d}</li>)}</ul>
          {v.azioni.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 6 }}>Cosa fare</div>
              <ul className="obiettivo-righe azioni">{v.azioni.map((d) => <li key={d}>{d}</li>)}</ul>
            </>
          )}
          {o.tappe.length > 0 && (
            <div className="obiettivo-tappe">
              {o.tappe.map((t, i) => (
                <button key={i} className={`tappa${t.fatto ? ' fatta' : ''}`} onClick={() => segna(i)}>
                  {t.fatto ? <CheckCircle2 size={16} color="var(--ok)" /> : <Circle size={16} />} <span>{t.testo}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {compatta && v.azioni[0] && <div className="meta" style={{ marginTop: 6 }}>{v.azioni[0]}</div>}
    </div>
  )
}

function EditorObiettivo({ iniziale, onClose }: { iniziale: Obiettivo; onClose: () => void }) {
  const toast = useToast()
  const [o, setO] = useState<Obiettivo>(iniziale)
  const [nuovaTappa, setNuovaTappa] = useState('')
  const [testiNum, setTestiNum] = useState({ min: iniziale.min?.toString().replace('.', ',') ?? '', max: iniziale.max?.toString().replace('.', ',') ?? '' })
  const set = <K extends keyof Obiettivo>(k: K, v: Obiettivo[K]) => setO((p) => ({ ...p, [k]: v }))
  const esiste = !!iniziale.titolo
  const suggerite = tappeSuggerite(o).filter((s) => !o.tappe.some((t) => t.testo === s))

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    if (!o.titolo.trim()) return
    const pulito = { ...o, titolo: o.titolo.trim(), min: numOrNull(testiNum.min) ?? undefined, max: numOrNull(testiNum.max) ?? undefined }
    await salvaObiettivi((l) => (l.some((x) => x.id === o.id) ? l.map((x) => (x.id === o.id ? pulito : x)) : [...l, pulito]))
    toast(esiste ? 'Obiettivo aggiornato' : 'Obiettivo aggiunto')
    onClose()
  }
  async function elimina() {
    await salvaObiettivi((l) => l.filter((x) => x.id !== o.id))
    toast('Obiettivo eliminato')
    onClose()
  }
  const aggiungiTappa = (testo: string) => {
    if (!testo.trim()) return
    set('tappe', [...o.tappe, { testo: testo.trim(), fatto: false }])
    setNuovaTappa('')
  }

  return (
    <Sheet title={esiste ? 'Modifica obiettivo' : 'Nuovo obiettivo'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <Segmented<'breve' | 'lungo'> label="Orizzonte" value={o.orizzonte} onChange={(v) => set('orizzonte', v)}
          options={[{ value: 'breve', label: 'Breve termine' }, { value: 'lungo', label: 'Lungo termine' }]} />
        <div className="field">
          <label htmlFor="ob-titolo">Obiettivo</label>
          <input id="ob-titolo" className="input" value={o.titolo} onChange={(e) => set('titolo', e.target.value)}
            placeholder={o.orizzonte === 'breve' ? 'Es. Confermare la classe Master nel 2027' : 'Es. Partecipare ai Mondiali Handgun 2029'} required />
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ob-entro">Entro</label>
            <input id="ob-entro" type="date" className="input" value={o.entro} onChange={(e) => set('entro', e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ob-classe">Classe collegata</label>
            <select id="ob-classe" className="input" value={o.classe ?? ''} onChange={(e) => set('classe', e.target.value || undefined)}>
              <option value="">Nessuna</option>
              {['D', 'C', 'B', 'A', 'Master', 'Grand Master'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <Segmented<TipoObiettivo> label="Come lo misuro" value={o.tipo} onChange={(v) => set('tipo', v)} options={TIPI} />
        {(o.tipo === 'media' || o.tipo === 'reale') && (
          <>
            <div className="fields-2">
              <div className="field">
                <label htmlFor="ob-min">{o.tipo === 'media' ? 'Media minima %' : 'Reale minimo'}</label>
                <input id="ob-min" className="input" inputMode="decimal" value={testiNum.min} onChange={(e) => setTestiNum((t) => ({ ...t, min: e.target.value }))} placeholder="82" />
              </div>
              <div className="field">
                <label htmlFor="ob-max">{o.tipo === 'media' ? 'Fino a %' : 'Fino a'}</label>
                <input id="ob-max" className="input" inputMode="decimal" value={testiNum.max} onChange={(e) => setTestiNum((t) => ({ ...t, max: e.target.value }))} placeholder="89" />
              </div>
            </div>
            <span className="hint" style={{ marginTop: -8 }}>
              {o.tipo === 'media' ? 'Percentuale in classifica di divisione, come nelle classifiche ufficiali.' : 'Punteggio reale: non dipende da chi c’era in gara (100 = Grand Master in forma).'}
            </span>
          </>
        )}
        <div className="field">
          <label htmlFor="ob-tappa">Tappe intermedie</label>
          {o.tappe.map((t, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{t.testo}</span>
              <button type="button" className="btn icon ghost" style={{ width: 36, minHeight: 36 }} aria-label="Togli tappa" onClick={() => set('tappe', o.tappe.filter((_, k) => k !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="ob-tappa" className="input" style={{ flex: 1 }} value={nuovaTappa} onChange={(e) => setNuovaTappa(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungiTappa(nuovaTappa) } }} placeholder="Es. 3 gare Level III nel 2027" />
            <button type="button" className="btn" onClick={() => aggiungiTappa(nuovaTappa)}><Plus size={16} /></button>
          </div>
          {suggerite.length > 0 && (
            <div className="chips" style={{ marginTop: 6 }}>
              <span className="meta"><Sparkles size={13} style={{ verticalAlign: -2 }} /> Suggerite:</span>
              {suggerite.map((s) => <button type="button" key={s} className="chip" onClick={() => aggiungiTappa(s)}>+ {s}</button>)}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="ob-note">Note</label>
          <textarea id="ob-note" className="input" rows={2} value={o.note} onChange={(e) => set('note', e.target.value)} />
        </div>
        <div className="row">
          <button type="submit" className="btn primary">Salva</button>
          {esiste && <button type="button" className="btn ghost danger" onClick={elimina}><Trash2 size={16} /> Elimina</button>}
        </div>
      </form>
    </Sheet>
  )
}

/** Sezione "Obiettivi" nel profilo. */
export function SezioneObiettivi() {
  const lista = useObiettivi()
  const dati = useDatiAtleta()
  const [modifica, setModifica] = useState<Obiettivo | null>(null)
  if (!lista || !dati) return null
  const ordinati = [...lista].sort((a, b) => (a.orizzonte === b.orizzonte ? a.entro.localeCompare(b.entro) : a.orizzonte === 'breve' ? -1 : 1))
  return (
    <section className="card">
      <div className="card-title">
        <span>Obiettivi</span>
        <button className="btn" style={{ minHeight: 36 }} onClick={() => setModifica(nuovoObiettivo())}><Plus size={16} /> Aggiungi</button>
      </div>
      {ordinati.length === 0 ? (
        <p className="prose" style={{ margin: 0, fontSize: 14 }}>
          Scrivi dove vuoi arrivare e entro quando: per esempio “confermare la classe Master nel 2027 con una media tra l’82 e l’89%”.
          Gara dopo gara ti dico se l’andamento basta o cosa correggere.
        </p>
      ) : (
        <div className="list">{ordinati.map((o) => <CardObiettivo key={o.id} o={o} dati={dati} onModifica={() => setModifica(o)} />)}</div>
      )}
      {modifica && <EditorObiettivo iniziale={modifica} onClose={() => setModifica(null)} />}
    </section>
  )
}
