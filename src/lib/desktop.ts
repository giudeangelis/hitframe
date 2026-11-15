/** Piccoli adattamenti per l'app desktop (Tauri): link esterni nel browser e controllo aggiornamenti. */
import { suDesktop, versioneDesktop } from '../google/auth'
import { richiesta } from './rete'

const REPO = 'hitframe/hitframe.github.io'
export const PAGINA_DOWNLOAD = `https://github.com/${REPO}/releases/latest`

export async function apriEsterno(url: string) {
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}

/** Nell'app desktop i link verso altri siti si aprono nel browser del computer. */
export function installaLinkEsterni() {
  if (!suDesktop()) return
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (/^(https?:|mailto:|tel:)/i.test(href) && !a.hasAttribute('download')) {
      e.preventDefault()
      void apriEsterno(href)
    }
  }, true)
  const originale = window.open.bind(window)
  window.open = ((url?: string | URL, ...resto: unknown[]) => {
    const u = String(url ?? '')
    if (/^(https?:|mailto:|tel:)/i.test(u)) { void apriEsterno(u); return null }
    return originale(url as string, ...(resto as [string?, string?]))
  }) as typeof window.open
}

const confronta = (a: string, b: string) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** C'è una versione desktop più recente su GitHub? */
export async function aggiornamentoDesktop(): Promise<{ attuale: string; nuova: string; url: string } | null> {
  const attuale = await versioneDesktop()
  if (!attuale) return null
  try {
    const r = await richiesta(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!r.ok) return null
    const j = await r.json() as { tag_name?: string; html_url?: string }
    const nuova = (j.tag_name ?? '').replace(/^[^0-9]*/, '')
    return nuova && confronta(nuova, attuale) > 0 ? { attuale, nuova, url: j.html_url ?? PAGINA_DOWNLOAD } : null
  } catch {
    return null
  }
}
