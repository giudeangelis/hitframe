import { useState } from 'react'
import { db, nowIso } from '../db/db'
import { LIVELLI_GARA, TIPI_EVENTO, type Evento, type TipoEvento } from '../db/types'
import { linkMaps } from '../lib/maps'
import { dopoSalvataggio, primaDiEliminare } from '../google/calendar'
import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DRILLS } from '../allenamento/drills'
import { oggiKey } from '../lib/date'
import { numOrNull, Segmented, Sheet, useToast } from './ui'

const TITOLI_DEFAULT: Record<TipoEvento, string> = {
  fuoco: 'Allenamento a fuoco',
  bianco: 'Allenamento in bianco',
  gara: '',
  altro: '',
}

function nuovoEvento(data: string, tipo: TipoEvento): Evento {
  return {
    tipo,
    titolo: TITOLI_DEFAULT[tipo],
    data,
    dataFine: data,
    ora: '',
    durataMin: null,
    luogo: '',
    note: '',
    colpiPianificati: null,
    colpiSparati: null,
    completato: false,
    creato: nowIso(),
  }
}

const garaVuota = () => ({
  aperturaIscrizione: '',
  livello: 'Level II',
  organizzatore: '',
  iscrizioneUrl: '',
  scadenzaIscrizione: '',
  iscritto: false,
  numeroStage: null,
  colpiTotali: null,
})

export default function EventoForm({
  evento, data, tipo = 'fuoco', onClose, onSalvato,
}: { evento?: Evento; data?: string; tipo?: TipoEvento; onClose: () => void; onSalvato?: (id: number) => void }) {
  const toast = useToast()
  const [e, setE] = useState<Evento>(() => evento ?? nuovoEvento(data ?? oggiKey(), tipo))
  const [confermaElimina, setConfermaElimina] = useState(false)
  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setE((p) => ({ ...p, [k]: v }))
  const gara = e.gara ?? garaVuota()
  const setGara = <K extends keyof typeof gara>(k: K, v: (typeof gara)[K]) => setE((p) => ({ ...p, gara: { ...(p.gara ?? garaVuota()), [k]: v } }))

  const cambiaTipo = (t: TipoEvento) => {
    setE((p) => ({
      ...p,
      tipo: t,
      titolo: !p.titolo || Object.values(TITOLI_DEFAULT).includes(p.titolo) ? TITOLI_DEFAULT[t] : p.titolo,
      gara: t === 'gara' ? p.gara ?? garaVuota() : p.gara,
      dataFine: t === 'gara' ? p.dataFine : p.data,
    }))
  }

  const passato = e.data <= oggiKey()
  const valido = e.titolo.trim() !== '' && e.data !== ''

  async function salva(ev: React.FormEvent) {
    ev.preventDefault()
    if (!valido) return
    const pulito: Evento = {
      ...e,
      titolo: e.titolo.trim(),
      dataFine: e.tipo === 'gara' && e.dataFine >= e.data ? e.dataFine : e.data,
      gara: e.tipo === 'gara' ? gara : undefined,
    }
    const id = (pulito.id ? await db.eventi.put(pulito) : await db.eventi.add(pulito)) as number
    onSalvato?.(id)
    toast(evento?.id ? 'Evento aggiornato' : 'Evento aggiunto')
    onClose()
    dopoSalvataggio(id).then((r) => r === 'ok' && toast('Inviato a Google Calendar'))
  }

  async function elimina() {
    if (!e.id) return
    await primaDiEliminare(e)
    await db.eventi.delete(e.id)
    toast('Evento eliminato')
    onClose()
  }

  return (
    <Sheet title={evento?.id ? 'Modifica evento' : 'Nuovo evento'} onClose={onClose}>
      <form className="form" onSubmit={salva}>
        <Segmented
          label="Tipo di evento"
          value={e.tipo}
          onChange={cambiaTipo}
          options={(Object.keys(TIPI_EVENTO) as TipoEvento[]).map((t) => ({ value: t, label: TIPI_EVENTO[t].breve }))}
        />

        <div className="field">
          <label htmlFor="ev-titolo">{e.tipo === 'gara' ? 'Nome della gara' : 'Titolo'}</label>
          <input id="ev-titolo" className="input" value={e.titolo} onChange={(x) => set('titolo', x.target.value)}
            placeholder={e.tipo === 'gara' ? 'Es. 3ª prova Campionato Italiano' : ''} required />
        </div>

        <div className="fields-2">
          <div className="field">
            <label htmlFor="ev-data">{e.tipo === 'gara' ? 'Dal' : 'Data'}</label>
            <input id="ev-data" type="date" className="input" value={e.data}
              onChange={(x) => setE((p) => ({ ...p, data: x.target.value, dataFine: p.dataFine < x.target.value ? x.target.value : p.dataFine }))} required />
          </div>
          {e.tipo === 'gara' ? (
            <div className="field">
              <label htmlFor="ev-fine">Al</label>
              <input id="ev-fine" type="date" className="input" min={e.data} value={e.dataFine} onChange={(x) => set('dataFine', x.target.value)} />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="ev-ora">Ora</label>
              <input id="ev-ora" type="time" className="input" value={e.ora} onChange={(x) => set('ora', x.target.value)} />
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="ev-luogo">{e.tipo === 'gara' ? 'Campo di tiro' : 'Luogo'}</label>
          <input id="ev-luogo" className="input" value={e.luogo} onChange={(x) => set('luogo', x.target.value)}
            placeholder={e.tipo === 'bianco' ? 'Casa' : 'Poligono'} />
        </div>
        {e.tipo !== 'bianco' && (
          <div className="field">
            <label htmlFor="ev-maps">Posizione su Google Maps</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="ev-maps" type="url" className="input" value={e.mapsUrl ?? ''} onChange={(x) => set('mapsUrl', x.target.value)}
                placeholder={e.luogo ? 'Automatico dal luogo, oppure incolla il link del pin' : 'Incolla un link di Google Maps'} />
              {linkMaps(e) && (
                <a className="btn icon" href={linkMaps(e)} target="_blank" rel="noreferrer" aria-label="Apri in Google Maps"><MapPin size={20} /></a>
              )}
            </div>
            <span className="hint">{e.mapsUrl ? 'Uso il link che hai incollato.' : e.luogo ? 'Link creato dal nome del luogo: finisce anche su Google Calendar.' : ''}</span>
          </div>
        )}

        {e.tipo === 'gara' ? (
          <>
            <div className="fields-2">
              <div className="field">
                <label htmlFor="ev-livello">Livello</label>
                <select id="ev-livello" className="select" value={gara.livello} onChange={(x) => setGara('livello', x.target.value)}>
                  {LIVELLI_GARA.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ev-org">Organizzatore</label>
                <input id="ev-org" className="input" value={gara.organizzatore} onChange={(x) => setGara('organizzatore', x.target.value)} />
              </div>
            </div>
            <div className="fields-2">
              <div className="field">
                <label htmlFor="ev-stage">Stage</label>
                <input id="ev-stage" inputMode="numeric" className="input" value={gara.numeroStage ?? ''} onChange={(x) => setGara('numeroStage', numOrNull(x.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="ev-colpitot">Colpi minimi</label>
                <input id="ev-colpitot" inputMode="numeric" className="input" value={gara.colpiTotali ?? ''} onChange={(x) => setGara('colpiTotali', numOrNull(x.target.value))} />
              </div>
            </div>
            <div className="fields-2">
              <div className="field">
                <label htmlFor="ev-apre">Apertura iscrizioni</label>
                <input id="ev-apre" type="date" className="input" value={gara.aperturaIscrizione ?? ''} onChange={(x) => setGara('aperturaIscrizione', x.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ev-scad">Scadenza iscrizione</label>
                <input id="ev-scad" type="date" className="input" min={gara.aperturaIscrizione || undefined} value={gara.scadenzaIscrizione} onChange={(x) => setGara('scadenzaIscrizione', x.target.value)} />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={gara.iscritto} onChange={(x) => setGara('iscritto', x.target.checked)} />
              Iscritto
            </label>
            {(gara.aperturaIscrizione || gara.scadenzaIscrizione) && !gara.iscritto && (
              <span className="hint" style={{ marginTop: -8 }}>Promemoria in Home e, se collegato, su Google Calendar con notifica.</span>
            )}
            <div className="field">
              <label htmlFor="ev-url">Link iscrizione</label>
              <input id="ev-url" type="url" className="input" value={gara.iscrizioneUrl} onChange={(x) => setGara('iscrizioneUrl', x.target.value)} placeholder="https://mare2.fitds.it/" />
            </div>
          </>
        ) : (
          <div className="fields-2">
            <div className="field">
              <label htmlFor="ev-durata">Durata (minuti)</label>
              <input id="ev-durata" inputMode="numeric" className="input" value={e.durataMin ?? ''} onChange={(x) => set('durataMin', numOrNull(x.target.value))} />
            </div>
            {e.tipo === 'fuoco' && (
              <div className="field">
                <label htmlFor="ev-colpi">Colpi pianificati</label>
                <input id="ev-colpi" inputMode="numeric" className="input" value={e.colpiPianificati ?? ''} onChange={(x) => set('colpiPianificati', numOrNull(x.target.value))} />
              </div>
            )}
          </div>
        )}

        {passato && e.tipo !== 'altro' && (
          <div className="fields-2">
            <label className="check">
              <input type="checkbox" checked={e.completato} onChange={(x) => set('completato', x.target.checked)} />
              {e.tipo === 'gara' ? 'Gara disputata' : 'Svolto'}
            </label>
            {e.tipo !== 'bianco' && (
              <div className="field">
                <label htmlFor="ev-sparati">Colpi sparati</label>
                <input id="ev-sparati" inputMode="numeric" className="input" value={e.colpiSparati ?? ''} onChange={(x) => set('colpiSparati', numOrNull(x.target.value))} />
              </div>
            )}
          </div>
        )}

        {e.drill && e.drill.length > 0 && (
          <div className="field">
            <span className="label">Drill della sessione</span>
            <div className="chips">
              {e.drill.map((id) => {
                const d = DRILLS.find((x) => x.id === id)
                return d ? <Link key={id} to={`/allenamento/${id}`} className="badge" style={{ textDecoration: 'none', padding: '6px 10px' }} onClick={onClose}>{d.nome}</Link> : null
              })}
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="ev-note">Note</label>
          <textarea id="ev-note" className="textarea" style={{ minHeight: 90 }} value={e.note} onChange={(x) => set('note', x.target.value)}
            placeholder={e.tipo === 'gara' ? 'Squad, orari, obiettivi…' : 'Cosa allenare, drill, obiettivi…'} />
        </div>

        <div className="row">
          {evento?.id && (confermaElimina ? (
            <button type="button" className="btn danger" onClick={elimina}>Conferma eliminazione</button>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfermaElimina(true)}>Elimina</button>
          ))}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn primary" disabled={!valido}>Salva</button>
        </div>
      </form>
    </Sheet>
  )
}
