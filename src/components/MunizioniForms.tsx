import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, nowIso } from '../db/db'
import { TIPI_COMPONENTE, TIPI_PALLA, type Componente, type Lotto, type Ricetta, type SessioneCrono, type TipoComponente } from '../db/types'
import { oggiKey } from '../lib/date'
import { consumoLotto, costoColpo, euro, leggiVelocita } from '../munizioni/calcoli'
import { numOrNull, Segmented, Sheet, useToast } from './ui'

const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

function Elimina({ onConferma }: { onConferma: () => void }) {
  const [c, setC] = useState(false)
  return c
    ? <button type="button" className="btn danger" onClick={onConferma}>Conferma eliminazione</button>
    : <button type="button" className="btn ghost" onClick={() => setC(true)}>Elimina</button>
}

/* ---------- Componente di magazzino ---------- */

export function ComponenteForm({ comp, tipo, onClose }: { comp?: Componente; tipo?: TipoComponente; onClose: () => void }) {
  const toast = useToast()
  const [c, setC] = useState<Componente>(() => comp ?? {
    tipo: tipo ?? 'palle', nome: '', quantita: 0, confezione: null, prezzoConfezione: null, sogliaMinima: null, riusi: null, note: '', creato: nowIso(),
  })
  const [f, setF] = useState({ quantita: txt(comp?.quantita ?? null), confezione: txt(comp?.confezione), prezzo: txt(comp?.prezzoConfezione), soglia: txt(comp?.sogliaMinima), riusi: txt(comp?.riusi) })
  const u = TIPI_COMPONENTE[c.tipo].unita

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const v: Componente = {
      ...c, nome: c.nome.trim(),
      quantita: numOrNull(f.quantita) ?? 0,
      confezione: numOrNull(f.confezione),
      prezzoConfezione: numOrNull(f.prezzo),
      sogliaMinima: numOrNull(f.soglia),
      riusi: c.tipo === 'bossoli' ? numOrNull(f.riusi) : null,
    }
    if (v.id) await db.componenti.put(v)
    else await db.componenti.add(v)
    toast('Magazzino aggiornato')
    onClose()
  }

  return (
    <Sheet title={comp ? 'Modifica componente' : 'Nuovo componente'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <Segmented<TipoComponente> label="Tipo" value={c.tipo} onChange={(t) => setC({ ...c, tipo: t })}
          options={(Object.keys(TIPI_COMPONENTE) as TipoComponente[]).map((t) => ({ value: t, label: TIPI_COMPONENTE[t].label }))} />
        <div className="field">
          <label htmlFor="co-nome">Nome</label>
          <input id="co-nome" className="input" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} required
            placeholder={{ palle: 'Es. HN 147 gr RN coated', polvere: 'Es. Vihtavuori N320', inneschi: 'Es. Fiocchi small pistol', bossoli: 'Es. 9x21 misti' }[c.tipo]} />
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="co-q">Quantità in magazzino ({u})</label>
            <input id="co-q" className="input" inputMode="decimal" value={f.quantita} onChange={(e) => setF({ ...f, quantita: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="co-s">Avvisami sotto ({u})</label>
            <input id="co-s" className="input" inputMode="decimal" value={f.soglia} onChange={(e) => setF({ ...f, soglia: e.target.value })} />
          </div>
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="co-conf">Confezione ({u})</label>
            <input id="co-conf" className="input" inputMode="decimal" value={f.confezione} onChange={(e) => setF({ ...f, confezione: e.target.value })} placeholder={c.tipo === 'polvere' ? '500' : '1000'} />
          </div>
          <div className="field">
            <label htmlFor="co-p">Prezzo confezione (€)</label>
            <input id="co-p" className="input" inputMode="decimal" value={f.prezzo} onChange={(e) => setF({ ...f, prezzo: e.target.value })} />
          </div>
        </div>
        {c.tipo === 'bossoli' && (
          <div className="field">
            <label htmlFor="co-r">Ricariche medie per bossolo</label>
            <input id="co-r" className="input" inputMode="numeric" value={f.riusi} onChange={(e) => setF({ ...f, riusi: e.target.value })} placeholder="8" />
            <span className="hint">Il costo del bossolo viene diviso per il numero di ricariche.</span>
          </div>
        )}
        <div className="row">
          {comp && <Elimina onConferma={async () => { await db.componenti.delete(comp.id!); toast('Componente eliminato'); onClose() }} />}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!c.nome.trim()}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}

/* ---------- Ricetta ---------- */

export function RicettaForm({ ricetta, onClose, onCreata }: { ricetta?: Ricetta; onClose: () => void; onCreata?: (id: number) => void }) {
  const toast = useToast()
  const comp = useLiveQuery(() => db.componenti.toArray()) ?? []
  const [r, setR] = useState<Ricetta>(() => ricetta ?? {
    nome: '', calibro: '9x21', palla: '', pesoPalla: 147, tipoPalla: TIPI_PALLA[0], polvere: '', carica: null, innesco: '', bossolo: '', oal: null, note: '',
    pallaId: null, polvereId: null, innescoId: null, bossoloId: null, archiviata: false, creato: nowIso(),
  })
  const [f, setF] = useState({ peso: txt(ricetta?.pesoPalla ?? 147), carica: txt(ricetta?.carica), oal: txt(ricetta?.oal) })
  const set = <K extends keyof Ricetta>(k: K, v: Ricetta[K]) => setR((p) => ({ ...p, [k]: v }))

  function collega(campo: 'pallaId' | 'polvereId' | 'innescoId' | 'bossoloId', testo: 'palla' | 'polvere' | 'innesco' | 'bossolo', id: string) {
    const c = comp.find((x) => x.id === Number(id))
    setR((p) => ({ ...p, [campo]: c?.id ?? null, [testo]: c ? c.nome : p[testo] }))
  }

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const v: Ricetta = { ...r, nome: r.nome.trim() || `${r.calibro} ${r.pesoPalla} gr`, pesoPalla: numOrNull(f.peso) ?? 0, carica: numOrNull(f.carica), oal: numOrNull(f.oal) }
    if (v.id) { await db.ricette.put(v); toast('Ricetta aggiornata') }
    else { const id = (await db.ricette.add(v)) as number; toast('Ricetta creata'); onCreata?.(id) }
    onClose()
  }

  const sel = (tipo: TipoComponente, campo: 'pallaId' | 'polvereId' | 'innescoId' | 'bossoloId', testo: 'palla' | 'polvere' | 'innesco' | 'bossolo', label: string, placeholder: string) => {
    const opzioni = comp.filter((c) => c.tipo === tipo)
    return (
      <div className="field">
        <label htmlFor={`ri-${testo}`}>{label}</label>
        {opzioni.length > 0 && (
          <select className="select" aria-label={`${label} dal magazzino`} value={r[campo] ?? ''} onChange={(e) => collega(campo, testo, e.target.value)}>
            <option value="">— non collegato al magazzino —</option>
            {opzioni.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {!r[campo] && <input id={`ri-${testo}`} className="input" value={r[testo]} onChange={(e) => set(testo, e.target.value)} placeholder={placeholder} />}
      </div>
    )
  }

  const costo = costoColpo({ ...r, carica: numOrNull(f.carica) }, comp)

  return (
    <Sheet title={ricetta ? 'Modifica ricetta' : 'Nuova ricetta'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ri-nome">Nome</label>
            <input id="ri-nome" className="input" value={r.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Es. Gara 147 coated" />
          </div>
          <div className="field">
            <label htmlFor="ri-cal">Calibro</label>
            <input id="ri-cal" className="input" value={r.calibro} onChange={(e) => set('calibro', e.target.value)} />
          </div>
        </div>
        {sel('palle', 'pallaId', 'palla', 'Palla', 'Marca e modello')}
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ri-peso">Peso palla (grani)</label>
            <input id="ri-peso" className="input" inputMode="decimal" value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="ri-tipo">Tipo palla</label>
            <select id="ri-tipo" className="select" value={r.tipoPalla} onChange={(e) => set('tipoPalla', e.target.value)}>
              {TIPI_PALLA.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {sel('polvere', 'polvereId', 'polvere', 'Polvere', 'Marca e nome')}
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ri-car">Carica (grani)</label>
            <input id="ri-car" className="input" inputMode="decimal" value={f.carica} onChange={(e) => setF({ ...f, carica: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ri-oal">OAL (mm)</label>
            <input id="ri-oal" className="input" inputMode="decimal" value={f.oal} onChange={(e) => setF({ ...f, oal: e.target.value })} />
          </div>
        </div>
        <p className="prose" style={{ margin: 0, fontSize: 12 }}>Hitframe registra i tuoi dati ma non suggerisce cariche: parti sempre dai manuali di ricarica e dai dati del produttore della polvere.</p>
        {sel('inneschi', 'innescoId', 'innesco', 'Innesco', 'Marca e tipo')}
        {sel('bossoli', 'bossoloId', 'bossolo', 'Bossolo', 'Marca o misti')}
        <div className="field">
          <label htmlFor="ri-note">Note</label>
          <textarea id="ri-note" className="textarea" value={r.note} onChange={(e) => set('note', e.target.value)} placeholder="Crimp, lubrificazione, arma usata…" />
        </div>
        {costo.totale !== null && <div className="badge" style={{ alignSelf: 'flex-start' }}>Costo per colpo {euro(costo.totale)}{costo.completo ? '' : ' (parziale)'}</div>}
        <div className="row">
          {ricetta && (
            <button type="button" className="btn ghost" onClick={async () => { await db.ricette.update(ricetta.id!, { archiviata: !ricetta.archiviata }); toast(ricetta.archiviata ? 'Ricetta riattivata' : 'Ricetta archiviata'); onClose() }}>
              {ricetta.archiviata ? 'Riattiva' : 'Archivia'}
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary">Salva</button>
        </div>
      </form>
    </Sheet>
  )
}

/* ---------- Sessione al cronografo ---------- */

export function CronoForm({ ricetta, sessione, onClose }: { ricetta: Ricetta; sessione?: SessioneCrono; onClose: () => void }) {
  const toast = useToast()
  const armi = useLiveQuery(() => db.armi.toArray()) ?? []
  const [s, setS] = useState<SessioneCrono>(() => sessione ?? {
    ricettaId: ricetta.id!, armaId: null, data: oggiKey(), unita: 'ms', velocita: [], pesoMisurato: null, temperatura: null, note: '', creato: nowIso(),
  })
  const [vel, setVel] = useState(sessione ? sessione.velocita.map(txt).join('  ') : '')
  const [f, setF] = useState({ peso: txt(sessione?.pesoMisurato), temp: txt(sessione?.temperatura) })
  const lette = leggiVelocita(vel)

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const v: SessioneCrono = { ...s, velocita: lette, pesoMisurato: numOrNull(f.peso), temperatura: numOrNull(f.temp) }
    if (v.id) await db.crono.put(v)
    else await db.crono.add(v)
    toast('Sessione salvata')
    onClose()
  }

  return (
    <Sheet title={sessione ? 'Modifica sessione' : 'Sessione al cronografo'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="cr-data">Data</label>
            <input id="cr-data" type="date" className="input" value={s.data} onChange={(e) => setS({ ...s, data: e.target.value })} />
          </div>
          <Segmented<'ms' | 'fps'> label="Unità" value={s.unita} onChange={(u) => setS({ ...s, unita: u })}
            options={[{ value: 'ms', label: 'm/s' }, { value: 'fps', label: 'fps' }]} />
        </div>
        <div className="field">
          <label htmlFor="cr-v">Velocità dei colpi</label>
          <textarea id="cr-v" className="textarea" value={vel} onChange={(e) => setVel(e.target.value)} placeholder={s.unita === 'ms' ? '265 268 262 270 266 …' : '870 878 862 …'} />
          <span className="hint">Separate da spazio o a capo. Lette: {lette.length}{lette.length && lette.length < 10 ? ' · meglio almeno 10 colpi' : ''}</span>
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="cr-peso">Peso palla pesata (gr)</label>
            <input id="cr-peso" className="input" inputMode="decimal" value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} placeholder={`${ricetta.pesoPalla}`} />
            <span className="hint">Vuoto = peso della ricetta</span>
          </div>
          <div className="field">
            <label htmlFor="cr-t">Temperatura (°C)</label>
            <input id="cr-t" className="input" inputMode="decimal" value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value })} />
          </div>
        </div>
        {armi.length > 0 && (
          <div className="field">
            <label htmlFor="cr-arma">Arma</label>
            <select id="cr-arma" className="select" value={s.armaId ?? ''} onChange={(e) => setS({ ...s, armaId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>
              {armi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="cr-note">Note</label>
          <input id="cr-note" className="input" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="Cronografo usato, lotto…" />
        </div>
        <div className="row">
          {sessione && <Elimina onConferma={async () => { await db.crono.delete(sessione.id!); toast('Sessione eliminata'); onClose() }} />}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!lette.length}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}

/* ---------- Lotto prodotto, acquistato o rettifica ---------- */

export function LottoForm({ ricetta, tipo = 'produzione', onClose }: { ricetta?: Ricetta; tipo?: 'produzione' | 'acquisto' | 'rettifica'; onClose: () => void }) {
  const toast = useToast()
  const comp = useLiveQuery(() => db.componenti.toArray()) ?? []
  const [data, setData] = useState(oggiKey())
  const [qTxt, setQ] = useState('')
  const [descr, setDescr] = useState('')
  const [prezzo, setPrezzo] = useState('')
  const [scarica, setScarica] = useState(true)
  const q = Math.round(numOrNull(qTxt) ?? 0)
  const costo = ricetta ? costoColpo(ricetta, comp).totale : null
  const consumo = ricetta && tipo === 'produzione' ? consumoLotto(ricetta, q) : null

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const l: Lotto = {
      ricettaId: tipo === 'produzione' ? ricetta?.id ?? null : null,
      descrizione: tipo === 'produzione' ? ricetta?.nome ?? '' : descr.trim() || (tipo === 'rettifica' ? 'Rettifica conteggio' : 'Munizioni commerciali'),
      data,
      quantita: q,
      costoColpo: tipo === 'produzione' ? costo : tipo === 'acquisto' && numOrNull(prezzo) && q ? numOrNull(prezzo)! / q : null,
      note: '',
      creato: nowIso(),
    }
    await db.transaction('rw', db.lotti, db.componenti, async () => {
      await db.lotti.add(l)
      if (consumo && scarica && ricetta) {
        const scala = async (id: number | null | undefined, n: number) => {
          if (!id || !n) return
          const c = await db.componenti.get(id)
          if (c) await db.componenti.update(id, { quantita: Math.max(0, Math.round((c.quantita - n) * 10) / 10) })
        }
        await scala(ricetta.pallaId, consumo.palle)
        await scala(ricetta.innescoId, consumo.inneschi)
        await scala(ricetta.polvereId, consumo.polvereG)
      }
    })
    toast(tipo === 'produzione' ? `${q} colpi aggiunti alla scorta` : 'Scorta aggiornata')
    onClose()
  }

  const titolo = { produzione: 'Colpi ricaricati', acquisto: 'Munizioni acquistate', rettifica: 'Rettifica scorta' }[tipo]
  return (
    <Sheet title={titolo} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        {tipo === 'produzione' && ricetta && <div className="badge" style={{ alignSelf: 'flex-start' }}>{ricetta.nome}</div>}
        {tipo !== 'produzione' && (
          <div className="field">
            <label htmlFor="lo-d">Descrizione</label>
            <input id="lo-d" className="input" value={descr} onChange={(e) => setDescr(e.target.value)} placeholder={tipo === 'rettifica' ? 'Es. conteggio dopo inventario' : 'Es. Fiocchi 9x21 124 gr'} />
          </div>
        )}
        <div className="fields-2">
          <div className="field">
            <label htmlFor="lo-q">{tipo === 'rettifica' ? 'Colpi (+ o −)' : 'Colpi'}</label>
            <input id="lo-q" className="input" inputMode="numeric" value={qTxt} onChange={(e) => setQ(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="lo-data">Data</label>
            <input id="lo-data" type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>
        {tipo === 'acquisto' && (
          <div className="field">
            <label htmlFor="lo-p">Prezzo totale (€)</label>
            <input id="lo-p" className="input" inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
          </div>
        )}
        {consumo && (consumo.palle || consumo.inneschi || consumo.polvereG) ? (
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={scarica} onChange={(e) => setScarica(e.target.checked)} />
            Scarica dal magazzino: {consumo.palle ? `${consumo.palle} palle` : ''}{consumo.inneschi ? ` · ${consumo.inneschi} inneschi` : ''}{consumo.polvereG ? ` · ${consumo.polvereG.toFixed(0)} g di polvere` : ''}
          </label>
        ) : null}
        {tipo === 'produzione' && costo !== null && q > 0 && <p className="prose" style={{ margin: 0 }}>Costo del lotto: {euro(costo * q, 2)} ({euro(costo)} a colpo)</p>}
        <div className="row">
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!q}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}
