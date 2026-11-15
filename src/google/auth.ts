/**
 * Accesso con Google, tutto nel browser (nessun server).
 * Un solo accesso per sincronizzazione (cartella nascosta di Drive) e calendario.
 * Il token dura circa un'ora: quando scade, all'apertura dell'app facciamo un passaggio
 * lampo da Google (senza schermate, se l'utente è già entrato) per rinnovarlo.
 */

/** Client ID OAuth del progetto Google "Hitframe" (non è un segreto: identifica l'app). */
export const CLIENT_ID = '301990574899-oe6osgq7k8c938nk5s3i2pvlgd32e5ss.apps.googleusercontent.com'

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.appdata'
export const SCOPE_CALENDARIO = 'https://www.googleapis.com/auth/calendar.app.created'
const SCOPE_BASE = ['openid', 'email', 'profile', SCOPE_DRIVE]

const K_TOKEN = 'hf-google-token'
const K_STATE = 'hf-google-state'
const K_ACCOUNT = 'hf-account'
const K_DOPO = 'hf-google-dopo'
const K_SILENZIOSO = 'hf-google-silenzioso'
const K_REFRESH = 'hf-google-refresh'
const K_ESITO_DESKTOP = 'hf-esito-desktop'

/* ---------- App desktop (Mac/Windows) ---------- */

/** Siamo dentro l'app desktop (Tauri)? Lì l'accesso passa dal browser del computer. */
export const suDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function invoca<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

interface TokenDesktop { access_token: string; expires_in: number; scope: string; refresh_token?: string | null }

function salvaTokenDesktop(t: TokenDesktop) {
  localStorage.setItem(K_TOKEN, JSON.stringify({ accessToken: t.access_token, scade: Date.now() + t.expires_in * 1000, scope: t.scope }))
  if (t.refresh_token) localStorage.setItem(K_REFRESH, t.refresh_token)
}

/** Rinnova l'accesso senza schermate (solo app desktop, con il refresh token). */
export async function rinnovaSilenzioso(): Promise<boolean> {
  if (!suDesktop()) return false
  const r = localStorage.getItem(K_REFRESH)
  if (!r) return false
  try {
    salvaTokenDesktop(await invoca<TokenDesktop>('google_rinnova', { refreshToken: r }))
    return true
  } catch (e) {
    if (String(e).includes('ACCESSO_SCADUTO')) localStorage.removeItem(K_REFRESH)
    return false
  }
}
export const puoRinnovareDaSolo = () => suDesktop() && !!localStorage.getItem(K_REFRESH)

/** Versione dell'app desktop installata (null nel browser). */
export async function versioneDesktop(): Promise<string | null> {
  if (!suDesktop()) return null
  try { return await invoca<string>('versione_app') } catch { return null }
}

async function accessoDesktop(o: OpzioniAccesso, scope: string) {
  const ritorno = o.ritorno ?? window.location.hash ?? '#/'
  let esito: EsitoRitorno
  try {
    const t = await invoca<TokenDesktop>('google_accedi', {
      scope,
      loginHint: o.scegliAccount ? null : getAccount()?.email ?? null,
      scegliAccount: !!o.scegliAccount,
    })
    salvaTokenDesktop(t)
    esito = { messaggio: null, dopo: o.dopo ?? null, ok: true }
  } catch (e) {
    esito = { messaggio: String(e).replace(/^Error:\s*/, ''), dopo: null, ok: false }
  }
  sessionStorage.setItem(K_ESITO_DESKTOP, JSON.stringify(esito))
  window.location.hash = ritorno.startsWith('#') ? ritorno : `#${ritorno}`
  window.location.reload()
}

export interface Account {
  email: string
  nome: string
  foto?: string
  collegato: string // data del primo collegamento su questo dispositivo
}

interface Token { accessToken: string; scade: number; scope: string }

/* ---------- Configurazione ---------- */

/** Client ID in uso: quello dell'app; per le prove si può forzare da localStorage. */
export function clientId(): string {
  try { return localStorage.getItem('hf-client-id-prova') || CLIENT_ID } catch { return CLIENT_ID }
}
export const accessoDisponibile = () => clientId().length > 0

/* ---------- Account ---------- */

export function getAccount(): Account | null {
  try { return JSON.parse(localStorage.getItem(K_ACCOUNT) || 'null') } catch { return null }
}
export function setAccount(a: Account | null) {
  if (a) localStorage.setItem(K_ACCOUNT, JSON.stringify(a))
  else localStorage.removeItem(K_ACCOUNT)
  window.dispatchEvent(new Event('hf-account'))
}

/* ---------- Token ---------- */

function leggiToken(): Token | null {
  try {
    const t = JSON.parse(localStorage.getItem(K_TOKEN) || 'null') as Token | null
    return t && t.scade > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
}
export const tokenValido = () => leggiToken() !== null
export const accessToken = () => leggiToken()?.accessToken ?? null
export function haScope(s: string) {
  const t = leggiToken()
  return !!t && t.scope.split(' ').includes(s)
}
export function dimenticaToken() {
  try { localStorage.removeItem(K_TOKEN) } catch { /* ignore */ }
}

export class AccessoRichiesto extends Error {
  constructor() { super('Serve accedere di nuovo a Google.') }
}

/** Indirizzo a cui Google rimanda dopo l'accesso (registrato nella Google Cloud Console). */
export const redirectUri = () => `${window.location.origin}${window.location.pathname}`

export interface OpzioniAccesso {
  ritorno?: string
  /** Senza schermate: se serve un'interazione Google torna con un errore e mostriamo il pulsante. */
  silenzioso?: boolean
  /** Aggiunge il permesso per il calendario Hitframe. */
  calendario?: boolean
  /** Azione da eseguire al ritorno (es. 'sync', 'calendario'). */
  dopo?: string
  /** Fa scegliere l'account (primo accesso o cambio account). */
  scegliAccount?: boolean
}

/** Porta l'utente da Google. Al ritorno l'app riprende da `ritorno`. */
export function avviaAccesso(o: OpzioniAccesso = {}) {
  const ritorno = o.ritorno ?? window.location.hash ?? '#/'
  const state = `${crypto.randomUUID()}|${ritorno}`
  localStorage.setItem(K_STATE, state)
  if (o.dopo) localStorage.setItem(K_DOPO, o.dopo)
  else localStorage.removeItem(K_DOPO)
  if (o.silenzioso) sessionStorage.setItem(K_SILENZIOSO, '1')
  const cal = o.calendario ?? (() => { try { return localStorage.getItem('hf-cal-attivo') === '1' } catch { return false } })()
  const scope = [...SCOPE_BASE, ...(cal ? [SCOPE_CALENDARIO] : [])].join(' ')
  if (suDesktop()) {
    // nell'app desktop si passa dal browser del computer; un rinnovo "silenzioso" usa il refresh token
    if (o.silenzioso) {
      void rinnovaSilenzioso().then((ok) => {
        sessionStorage.setItem(K_ESITO_DESKTOP, JSON.stringify({ messaggio: null, dopo: ok ? o.dopo ?? null : null, ok }))
        if (ok) window.location.reload()
      })
      return
    }
    void accessoDesktop(o, scope)
    return
  }
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope,
    include_granted_scopes: 'true',
    state,
  })
  const acc = getAccount()
  if (acc?.email && !o.scegliAccount) q.set('login_hint', acc.email)
  if (o.silenzioso) q.set('prompt', 'none')
  else if (o.scegliAccount) q.set('prompt', 'select_account')
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`)
}

export interface EsitoRitorno {
  messaggio: string | null
  dopo: string | null
  ok: boolean
}

/**
 * Da chiamare all'avvio, prima del router: se l'URL contiene il ritorno da Google salva il token
 * e ripristina la pagina dell'app.
 */
export function gestisciRitornoAccesso(): EsitoRitorno | null {
  const desk = sessionStorage.getItem(K_ESITO_DESKTOP)
  if (desk) {
    sessionStorage.removeItem(K_ESITO_DESKTOP)
    try { return JSON.parse(desk) as EsitoRitorno } catch { return null }
  }
  const h = window.location.hash
  if (!/^#(access_token|error|state)=/.test(h) && !/[#&](access_token|error)=/.test(h)) return null
  const p = new URLSearchParams(h.slice(1))
  const atteso = localStorage.getItem(K_STATE)
  const state = p.get('state') ?? ''
  const ritorno = state.split('|')[1] || '#/'
  const dopo = localStorage.getItem(K_DOPO)
  const silenzioso = sessionStorage.getItem(K_SILENZIOSO) === '1'
  localStorage.removeItem(K_STATE)
  localStorage.removeItem(K_DOPO)
  sessionStorage.removeItem(K_SILENZIOSO)
  window.history.replaceState(null, '', `${window.location.pathname}${ritorno.startsWith('#') ? ritorno : `#${ritorno}`}`)
  const err = p.get('error')
  if (err) {
    // un rinnovo silenzioso fallito non è un errore da mostrare: comparirà il pulsante "Accedi"
    if (silenzioso) return { messaggio: null, dopo: null, ok: false }
    return { messaggio: err === 'access_denied' ? 'Accesso a Google annullato.' : `Google ha risposto: ${err}`, dopo: null, ok: false }
  }
  if (!atteso || atteso !== state) return { messaggio: 'Accesso a Google non valido: riprova.', dopo: null, ok: false }
  const token = p.get('access_token')
  const sec = Number(p.get('expires_in') || '3600')
  if (!token) return { messaggio: 'Accesso a Google non riuscito.', dopo: null, ok: false }
  localStorage.setItem(K_TOKEN, JSON.stringify({ accessToken: token, scade: Date.now() + sec * 1000, scope: p.get('scope') ?? '' }))
  return { messaggio: null, dopo, ok: true }
}

/** Prova veloce: Google è raggiungibile? (al poligono il segnale può esserci "a metà") */
export async function googleRaggiungibile(ms = 2500): Promise<boolean> {
  if (navigator.onLine === false) return false
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    await fetch('https://accounts.google.com/generate_204', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/** Nome, email e foto dell'account appena entrato. */
export async function leggiProfiloGoogle(): Promise<Pick<Account, 'email' | 'nome' | 'foto'>> {
  const t = accessToken()
  if (!t) throw new AccessoRichiesto()
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${t}` } })
  if (r.status === 401) { dimenticaToken(); throw new AccessoRichiesto() }
  if (!r.ok) throw new Error(`Google non risponde (${r.status})`)
  const j = await r.json() as { email?: string; name?: string; picture?: string }
  return { email: j.email ?? '', nome: j.name ?? '', foto: j.picture }
}

/** Chiude l'accesso su questo dispositivo e revoca il token. I dati locali restano. */
export async function esci() {
  const t = localStorage.getItem(K_REFRESH) ?? accessToken()
  dimenticaToken()
  localStorage.removeItem(K_REFRESH)
  setAccount(null)
  if (t) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: 'POST' }) } catch { /* ignore */ }
  }
}
