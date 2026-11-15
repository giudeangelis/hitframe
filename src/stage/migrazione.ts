import { db, getImp, nowIso, setImp } from '../db/db'
import { colpi } from './geometria'

/** Dalla 0.12 lo stage designer è dentro "Crea drill": gli stage già disegnati diventano drill personali. */
export async function migraStageDesigner() {
  if (await getImp('stageMigrati', false)) return
  const stage = await db.stageLab.toArray()
  for (const s of stage) {
    await db.drillPersonali.add({
      nome: s.nome, categoria: 'Movimento', modalita: 'fuoco', descrizione: s.note, distanza: '', bersagli: '',
      colpi: colpi(s.schema), partenza: s.partenza, obiettivo: null, creato: nowIso(),
      schema: s.schema, allestimento: `Campo ${s.larghezza} × ${s.profondita} m.`,
    })
  }
  await setImp('stageMigrati', true)
}
