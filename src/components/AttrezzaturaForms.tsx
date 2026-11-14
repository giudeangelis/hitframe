import { useState } from 'react'
import { manutenzioniDefault, partiDefault, uid } from '../attrezzatura/calcoli'
import { db, nowIso } from '../db/db'
import { DIVISIONI, type Arma, type Divisione, type Intervento, type Manutenzione, type ParteArma, type Profilo } from '../db/types'
import { oggiKey } from '../lib/date'
import { numOrNull, Sheet, useToast } from './ui'

const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

export function ArmaForm({ arma, profilo, primaArma, onClose, onCreata }: { arma?: Arma; profilo: Profilo; primaArma: boolean; onClose: () => void; onCreata?: (id: number) => void }) {
  const toast = useToast()
  const oggi = oggiKey()
  const [a, setA] = useState<Arma>(() => arma ?? {
    nome: profilo.arma || '', modello: '', calibro: profilo.armaDettagli.calibro || '9x21', divisione: profilo.divisione, principale: primaArma,
    colpiIniziali: 0, dal: oggi, parti: [], manutenzioni: [], note: '', creato: nowIso(),
  })
  const [colpi, setColpi] = useState(txt(arma?.colpiIniziali ?? null))
  const [ottica, setOttica] = useState(profilo.armaDettagli.ottica)
  const [conferma, setConferma] = useState(false)

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const v: Arma = { ...a, nome: a.nome.trim(), colpiIniziali: Math.round(numOrNull(colpi) ?? 0) }
    if (!v.id) {
      v.parti = partiDefault(v.dal).map((p) => ({ ...p, colpiInstallazione: 0 }))
      v.manutenzioni = manutenzioniDefault(v.dal, ottica).map((m) => ({ ...m, ultimaColpi: v.colpiIniziali }))
    }
    await db.transaction('rw', db.armi, async () => {
      if (v.principale) await db.armi.toCollection().modify({ principale: false })
      if (v.id) await db.armi.put(v)
      else {
        const id = (await db.armi.add(v)) as number
        onCreata?.(id)
      }
    })
    toast(arma ? 'Arma aggiornata' : 'Arma aggiunta')
    onClose()
  }

  async function elimina() {
    await db.transaction('rw', db.armi, db.interventi, async () => {
      await db.interventi.where('armaId').equals(arma!.id!).delete()
      await db.armi.delete(arma!.id!)
    })
    toast('Arma eliminata')
    onClose()
  }

  return (
    <Sheet title={arma ? 'Modifica arma' : 'Nuova arma'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ar-nome">Nome</label>
            <input id="ar-nome" className="input" value={a.nome} onChange={(e) => setA({ ...a, nome: e.target.value })} required placeholder="Es. Strike One Ergal" />
          </div>
          <div className="field">
            <label htmlFor="ar-mod">Modello / matricola</label>
            <input id="ar-mod" className="input" value={a.modello} onChange={(e) => setA({ ...a, modello: e.target.value })} />
          </div>
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ar-cal">Calibro</label>
            <input id="ar-cal" className="input" value={a.calibro} onChange={(e) => setA({ ...a, calibro: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ar-div">Divisione</label>
            <select id="ar-div" className="select" value={a.divisione} onChange={(e) => setA({ ...a, divisione: e.target.value as Divisione })}>
              {DIVISIONI.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="fields-2">
          <div className="field">
            <label htmlFor="ar-colpi">Colpi già sparati</label>
            <input id="ar-colpi" className="input" inputMode="numeric" value={colpi} onChange={(e) => setColpi(e.target.value)} placeholder="Stima va bene" />
          </div>
          <div className="field">
            <label htmlFor="ar-dal">Conta il calendario dal</label>
            <input id="ar-dal" type="date" className="input" value={a.dal} onChange={(e) => setA({ ...a, dal: e.target.value })} />
          </div>
        </div>
        <label className="row" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={a.principale} onChange={(e) => setA({ ...a, principale: e.target.checked })} />
          Arma principale: le sessioni del calendario contano su questa, salvo diversa scelta
        </label>
        {!arma && (
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={ottica} onChange={(e) => setOttica(e.target.checked)} />
            Ha l’ottica (aggiungo il controllo di viti e batteria)
          </label>
        )}
        <div className="field">
          <label htmlFor="ar-note">Note</label>
          <textarea id="ar-note" className="textarea" value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} />
        </div>
        <div className="row">
          {arma && (conferma
            ? <button type="button" className="btn danger" onClick={elimina}>Conferma: elimina arma e storico</button>
            : <button type="button" className="btn ghost" onClick={() => setConferma(true)}>Elimina</button>)}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!a.nome.trim()}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}

/** Modifica di una voce di manutenzione o di una parte. */
export function VoceForm({ arma, voce, tipo, colpiAttuali, onClose }: {
  arma: Arma; voce?: Manutenzione | ParteArma; tipo: 'manutenzione' | 'parte'; colpiAttuali: number; onClose: () => void
}) {
  const toast = useToast()
  const oggi = oggiKey()
  const m = tipo === 'manutenzione' ? (voce as Manutenzione | undefined) : undefined
  const p = tipo === 'parte' ? (voce as ParteArma | undefined) : undefined
  const [nome, setNome] = useState(voce?.nome ?? '')
  const [f, setF] = useState({
    ogniColpi: txt(m ? m.ogniColpi : null), ogniGiorni: txt(m ? m.ogniGiorni : null),
    vita: txt(p ? p.vitaColpi : null), usati: txt(p ? Math.max(0, colpiAttuali - p.colpiInstallazione) : 0),
  })
  const [note, setNote] = useState(p?.note ?? '')

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    if (tipo === 'manutenzione') {
      const nuova: Manutenzione = { id: m?.id ?? uid(), nome: nome.trim(), ogniColpi: numOrNull(f.ogniColpi), ogniGiorni: numOrNull(f.ogniGiorni), ultimaColpi: m?.ultimaColpi ?? colpiAttuali, ultimaData: m?.ultimaData ?? oggi }
      const lista = m ? arma.manutenzioni.map((x) => (x.id === m.id ? nuova : x)) : [...arma.manutenzioni, nuova]
      await db.armi.update(arma.id!, { manutenzioni: lista })
    } else {
      const usati = Math.round(numOrNull(f.usati) ?? 0)
      const nuova: ParteArma = { id: p?.id ?? uid(), nome: nome.trim(), installata: p?.installata ?? oggi, colpiInstallazione: colpiAttuali - usati, vitaColpi: numOrNull(f.vita), note }
      const lista = p ? arma.parti.map((x) => (x.id === p.id ? nuova : x)) : [...arma.parti, nuova]
      await db.armi.update(arma.id!, { parti: lista })
    }
    toast('Salvato')
    onClose()
  }

  async function elimina() {
    if (tipo === 'manutenzione') await db.armi.update(arma.id!, { manutenzioni: arma.manutenzioni.filter((x) => x.id !== voce!.id) })
    else await db.armi.update(arma.id!, { parti: arma.parti.filter((x) => x.id !== voce!.id) })
    onClose()
  }

  return (
    <Sheet title={voce ? `Modifica ${voce.nome.toLowerCase()}` : tipo === 'manutenzione' ? 'Nuova manutenzione' : 'Nuova parte'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <div className="field">
          <label htmlFor="vo-nome">Nome</label>
          <input id="vo-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder={tipo === 'manutenzione' ? 'Es. Lubrificazione guide' : 'Es. Molla del cane'} />
        </div>
        {tipo === 'manutenzione' ? (
          <div className="fields-2">
            <div className="field"><label htmlFor="vo-c">Ogni (colpi)</label><input id="vo-c" className="input" inputMode="numeric" value={f.ogniColpi} onChange={(e) => setF({ ...f, ogniColpi: e.target.value })} /></div>
            <div className="field"><label htmlFor="vo-g">Ogni (giorni)</label><input id="vo-g" className="input" inputMode="numeric" value={f.ogniGiorni} onChange={(e) => setF({ ...f, ogniGiorni: e.target.value })} /></div>
          </div>
        ) : (
          <>
            <div className="fields-2">
              <div className="field"><label htmlFor="vo-v">Sostituire ogni (colpi)</label><input id="vo-v" className="input" inputMode="numeric" value={f.vita} onChange={(e) => setF({ ...f, vita: e.target.value })} placeholder="Vuoto = solo conteggio" /></div>
              <div className="field"><label htmlFor="vo-u">Colpi già fatti da questa parte</label><input id="vo-u" className="input" inputMode="numeric" value={f.usati} onChange={(e) => setF({ ...f, usati: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor="vo-n">Note</label><input id="vo-n" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </>
        )}
        <div className="row">
          {voce && <button type="button" className="btn ghost" onClick={elimina}>Elimina</button>}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!nome.trim()}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}

/** Intervento libero, o colpi sparati fuori calendario. */
export function InterventoForm({ arma, colpiAttuali, soloColpi, onClose }: { arma: Arma; colpiAttuali: number; soloColpi?: boolean; onClose: () => void }) {
  const toast = useToast()
  const [tipo, setTipo] = useState<Intervento['tipo']>(soloColpi ? 'colpi' : 'nota')
  const [data, setData] = useState(oggiKey())
  const [titolo, setTitolo] = useState('')
  const [descr, setDescr] = useState('')
  const [q, setQ] = useState('')
  const [costo, setCosto] = useState('')

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    const n = Math.round(numOrNull(q) ?? 0)
    await db.interventi.add({
      armaId: arma.id!, data, tipo,
      titolo: tipo === 'colpi' ? `${n} colpi fuori calendario` : titolo.trim(),
      descrizione: descr.trim(),
      colpiArma: colpiAttuali + (tipo === 'colpi' ? n : 0),
      colpiAggiunti: tipo === 'colpi' ? n : undefined,
      costo: numOrNull(costo),
      creato: nowIso(),
    })
    toast(tipo === 'colpi' ? 'Colpi aggiunti' : 'Intervento registrato')
    onClose()
  }

  return (
    <Sheet title={soloColpi ? 'Aggiungi colpi' : 'Nuovo intervento'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        {!soloColpi && (
          <select className="select" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Intervento['tipo'])}>
            <option value="nota">Nota</option>
            <option value="riparazione">Riparazione / modifica</option>
            <option value="manutenzione">Manutenzione</option>
            <option value="sostituzione">Sostituzione parte</option>
            <option value="colpi">Colpi fuori calendario</option>
          </select>
        )}
        {tipo === 'colpi' ? (
          <div className="field">
            <label htmlFor="in-q">Colpi sparati</label>
            <input id="in-q" className="input" inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} required />
            <span className="hint">Per sessioni non segnate in calendario: le sessioni completate con i colpi sparati contano già da sole.</span>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="in-t">Titolo</label>
            <input id="in-t" className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} required placeholder="Es. Canna nuova, scatto alleggerito…" />
          </div>
        )}
        <div className="fields-2">
          <div className="field"><label htmlFor="in-d">Data</label><input id="in-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></div>
          {tipo !== 'colpi' && <div className="field"><label htmlFor="in-c">Costo (€)</label><input id="in-c" className="input" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} /></div>}
        </div>
        <div className="field"><label htmlFor="in-ds">Note</label><textarea id="in-ds" className="textarea" value={descr} onChange={(e) => setDescr(e.target.value)} /></div>
        <div className="row">
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary">Salva</button>
        </div>
      </form>
    </Sheet>
  )
}
