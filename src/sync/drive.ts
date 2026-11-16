/** Accesso alla cartella nascosta dell'app nel Google Drive dell'utente (appDataFolder). */
import { AccessoRichiesto, accessToken, dimenticaToken } from '../google/auth'
import { richiesta } from '../lib/rete'

const NOME = 'hitframe-dati.json.gz'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export interface FileRemoto { id: string; version: string; modifiedTime: string }

async function chiama(url: string, init: RequestInit = {}): Promise<Response> {
  const t = accessToken()
  if (!t) throw new AccessoRichiesto()
  const r = await richiesta(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } })
  if (r.status === 401) {
    dimenticaToken()
    throw new AccessoRichiesto()
  }
  if (r.status === 403) {
    let msg = 'Google Drive ha rifiutato la richiesta.'
    try {
      const j = await r.json()
      const motivo = j?.error?.errors?.[0]?.reason as string | undefined
      if (motivo === 'insufficientPermissions' || /scope/i.test(j?.error?.message ?? '')) {
        dimenticaToken()
        throw new AccessoRichiesto()
      }
      msg = j?.error?.message ?? msg
    } catch (e) {
      if (e instanceof AccessoRichiesto) throw e
    }
    throw new Error(msg)
  }
  if (!r.ok) throw new Error(`Google Drive non risponde (${r.status})`)
  return r
}

export async function trovaFile(): Promise<FileRemoto | null> {
  const q = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${NOME}' and trashed=false`,
    fields: 'files(id,version,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '5',
  })
  const r = await chiama(`${API}/files?${q}`)
  const j = await r.json() as { files: FileRemoto[] }
  return j.files[0] ?? null
}

async function comprimi(testo: string): Promise<Blob> {
  const s = new Blob([testo]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(s).blob()
}
async function decomprimi(b: Blob): Promise<string> {
  const s = b.stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(s).text()
}

export async function scarica(id: string): Promise<string> {
  const r = await chiama(`${API}/files/${id}?alt=media`)
  return decomprimi(await r.blob())
}

/** Crea o sovrascrive il file dei dati. Restituisce la nuova versione. */
export async function carica(testo: string, id?: string): Promise<FileRemoto> {
  const dati = await comprimi(testo)
  if (id) {
    const r = await chiama(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/gzip' },
      body: dati,
    })
    return r.json()
  }
  const meta = { name: NOME, parents: ['appDataFolder'], mimeType: 'application/gzip' }
  const b = `hf${crypto.randomUUID().replace(/-/g, '')}`
  const corpo = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${b}\r\nContent-Type: application/gzip\r\n\r\n`,
    dati,
    `\r\n--${b}--`,
  ])
  const r = await chiama(`${UPLOAD}/files?uploadType=multipart&fields=id,version,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: corpo,
  })
  return r.json()
}

/* ---------- PDF delle analisi di gara (un file per PDF, nella stessa cartella nascosta) ---------- */

export interface FilePdf { id: string; name: string; modifiedTime: string }

/** Carica un PDF e restituisce l'id del file nel Drive. */
export async function caricaPdf(pdf: Blob, nome: string): Promise<string> {
  const meta = { name: nome, parents: ['appDataFolder'], mimeType: 'application/pdf', appProperties: { hf: 'pdf' } }
  const b = `hf${crypto.randomUUID().replace(/-/g, '')}`
  const corpo = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${b}\r\nContent-Type: application/pdf\r\n\r\n`,
    pdf,
    `\r\n--${b}--`,
  ])
  const r = await chiama(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: corpo,
  })
  return ((await r.json()) as { id: string }).id
}

/** Scarica un PDF; null se nel Drive non c'è più. */
export async function scaricaPdf(id: string): Promise<Blob | null> {
  try {
    const r = await chiama(`${API}/files/${id}?alt=media`)
    return new Blob([await r.arrayBuffer()], { type: 'application/pdf' })
  } catch (e) {
    if (e instanceof Error && /\(404\)/.test(e.message)) return null
    throw e
  }
}

export async function elencaPdf(): Promise<FilePdf[]> {
  const out: FilePdf[] = []
  let pagina: string | undefined
  do {
    const q = new URLSearchParams({
      spaces: 'appDataFolder',
      q: "appProperties has { key='hf' and value='pdf' } and trashed=false",
      fields: 'nextPageToken,files(id,name,modifiedTime)',
      pageSize: '200',
    })
    if (pagina) q.set('pageToken', pagina)
    const j = await (await chiama(`${API}/files?${q}`)).json() as { files: FilePdf[]; nextPageToken?: string }
    out.push(...j.files)
    pagina = j.nextPageToken
  } while (pagina)
  return out
}

export async function eliminaFile(id: string) {
  await chiama(`${API}/files/${id}`, { method: 'DELETE' })
}

/** Cancella i dati dal Drive (per "Elimina i dati dal cloud"), PDF compresi. */
export async function eliminaRemoto() {
  const f = await trovaFile()
  if (f) await chiama(`${API}/files/${f.id}`, { method: 'DELETE' })
  for (const p of await elencaPdf()) await eliminaFile(p.id)
}
