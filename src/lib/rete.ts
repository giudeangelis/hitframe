/**
 * fetch che funziona ovunque: nel browser è quello normale; nell'app desktop passa dal lato nativo
 * (plugin HTTP di Tauri), così i servizi esterni (Google, AI) non rifiutano l'origine dell'app.
 */
export async function richiesta(url: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { fetch: fetchNativo } = await import('@tauri-apps/plugin-http')
    return fetchNativo(url, init)
  }
  return fetch(url, init)
}
