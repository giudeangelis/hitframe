/** Portale FITDS per le iscrizioni alle gare (MA.RE. 2.0, Match Registration). */
export const MARE_URL = 'https://mare2.fitds.it/'
export const linkIscrizione = (url?: string) => (url && /^https?:\/\//.test(url) ? url : MARE_URL)
