import { useLiveQuery } from 'dexie-react-hooks'
import { getImp, setImp } from '../db/db'

const CHIAVE = 'drillPreferiti'

export function usePreferiti() {
  const lista = useLiveQuery(() => getImp<string[]>(CHIAVE, [])) ?? []
  const commuta = async (id: string) => {
    const attuale = await getImp<string[]>(CHIAVE, [])
    await setImp(CHIAVE, attuale.includes(id) ? attuale.filter((x) => x !== id) : [...attuale, id])
  }
  return { preferiti: lista, isPreferito: (id: string) => lista.includes(id), commuta }
}
