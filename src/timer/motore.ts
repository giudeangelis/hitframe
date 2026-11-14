/**
 * Shot timer nel browser: beep con Web Audio e rilevamento dei colpi dal microfono
 * con un AudioWorklet (precisione al campione, nessuna dipendenza dal frame rate).
 */

const WORKLET = `
class Rilevatore extends AudioWorkletProcessor {
  constructor() {
    super()
    this.soglia = 0.5
    this.minimo = 0.07
    this.ultimo = -1
    this.picco = 0
    this.blocchi = 0
    this.port.onmessage = (e) => Object.assign(this, e.data)
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    let max = 0, idx = 0
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i] < 0 ? -ch[i] : ch[i]
      if (v > max) { max = v; idx = i }
    }
    const t = currentTime + idx / sampleRate
    if (max >= this.soglia && t - this.ultimo >= this.minimo) {
      this.ultimo = t
      this.port.postMessage({ tipo: 'colpo', t, livello: max })
    }
    if (max > this.picco) this.picco = max
    if (++this.blocchi >= 12) {
      this.port.postMessage({ tipo: 'livello', v: this.picco })
      this.picco = 0
      this.blocchi = 0
    }
    return true
  }
}
registerProcessor('hf-rilevatore', Rilevatore)
`

export type Ritardo = 'casuale' | 'fisso' | 'immediato'

export interface OpzioniTimer {
  ritardo: Ritardo
  ritardoFisso: number // s
  ritardoMin: number
  ritardoMax: number
  par: number | null // s dal beep di partenza
  microfono: boolean
  soglia: number // 0-1
  intervalloMinimo: number // s tra due colpi (anti eco)
  durataMax: number // s di ascolto dopo il beep
}

export const OPZIONI_DEFAULT: OpzioniTimer = {
  ritardo: 'casuale',
  ritardoFisso: 3,
  ritardoMin: 1.5,
  ritardoMax: 4,
  par: null,
  microfono: true,
  soglia: 0.5,
  intervalloMinimo: 0.07,
  durataMax: 120,
}

export type StatoTimer = 'pronto' | 'attesa' | 'ascolto' | 'fermo'

export interface Ascoltatore {
  stato?: (s: StatoTimer) => void
  colpo?: (tempo: number, livello: number) => void
  livello?: (v: number) => void
  par?: () => void
  errore?: (msg: string) => void
}

const BEEP_HZ = 2800
const BEEP_S = 0.3
const PAR_S = 0.18

export class ShotTimer {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private nodo: AudioWorkletNode | null = null
  private sorgente: MediaStreamAudioSourceNode | null = null
  private tBeep = 0
  private finestreBeep: [number, number][] = []
  private timers: number[] = []
  private uscite: GainNode[] = []
  private wake: { release: () => Promise<void> } | null = null
  stato: StatoTimer = 'pronto'
  colpi: number[] = []
  private on: Ascoltatore

  constructor(on: Ascoltatore) {
    this.on = on
  }

  private async assicuraAudio() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC({ latencyHint: 'interactive' })
    }
    if (this.ctx.state !== 'running') await this.ctx.resume()
    return this.ctx
  }

  /** Apre il microfono (va chiamato da un tocco dell'utente). */
  async apriMicrofono(soglia: number, minimo: number) {
    const ctx = await this.assicuraAudio()
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    }
    if (!this.nodo) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
      await ctx.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      this.nodo = new AudioWorkletNode(ctx, 'hf-rilevatore', { numberOfInputs: 1, numberOfOutputs: 0 })
      this.sorgente = ctx.createMediaStreamSource(this.stream)
      this.sorgente.connect(this.nodo)
      this.nodo.port.onmessage = (e) => this.messaggio(e.data)
    }
    this.nodo.port.postMessage({ soglia, minimo })
  }

  impostaSoglia(soglia: number, minimo = 0.07) {
    this.nodo?.port.postMessage({ soglia, minimo })
  }

  private messaggio(d: { tipo: string; t?: number; livello?: number; v?: number }) {
    if (d.tipo === 'livello') {
      this.on.livello?.(d.v ?? 0)
      return
    }
    if (d.tipo !== 'colpo' || this.stato !== 'ascolto' || d.t === undefined) return
    // il microfono sente anche i nostri beep: li scartiamo
    if (this.finestreBeep.some(([a, b]) => d.t! >= a && d.t! <= b)) return
    const tempo = d.t - this.tBeep
    if (tempo < 0.05) return
    this.colpi.push(tempo)
    this.on.colpo?.(tempo, d.livello ?? 0)
  }

  private suona(t: number, durata: number, freq = BEEP_HZ) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.35, t + 0.005)
    g.gain.setValueAtTime(0.35, t + durata - 0.01)
    g.gain.linearRampToValueAtTime(0, t + durata)
    osc.connect(g).connect(ctx.destination)
    this.uscite.push(g)
    osc.start(t)
    osc.stop(t + durata + 0.02)
    this.finestreBeep.push([t - 0.03, t + durata + 0.12])
  }

  private imposta(s: StatoTimer) {
    this.stato = s
    this.on.stato?.(s)
  }

  async avvia(o: OpzioniTimer) {
    this.ferma(false)
    try {
      const ctx = await this.assicuraAudio()
      if (o.microfono) await this.apriMicrofono(o.soglia, o.intervalloMinimo)
      try {
        this.wake = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null
      } catch { /* facoltativo */ }
      this.colpi = []
      this.finestreBeep = []
      this.uscite = []
      const ritardo = o.ritardo === 'immediato' ? 0.3 : o.ritardo === 'fisso' ? o.ritardoFisso : o.ritardoMin + Math.random() * (o.ritardoMax - o.ritardoMin)
      this.tBeep = ctx.currentTime + ritardo
      this.suona(this.tBeep, BEEP_S)
      if (o.par) this.suona(this.tBeep + o.par, PAR_S, 3300)
      this.imposta('attesa')
      this.timers.push(window.setTimeout(() => this.imposta('ascolto'), ritardo * 1000))
      if (o.par) this.timers.push(window.setTimeout(() => this.on.par?.(), (ritardo + o.par) * 1000))
      this.timers.push(window.setTimeout(() => this.ferma(), (ritardo + Math.max(o.durataMax, (o.par ?? 0) + 1)) * 1000))
      if (!o.microfono && o.par) {
        // in bianco il giro finisce poco dopo il par
        this.timers.push(window.setTimeout(() => this.ferma(), (ritardo + o.par + 0.6) * 1000))
      }
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Permesso del microfono negato: abilitalo nelle impostazioni del browser.'
        : 'Audio non disponibile su questo dispositivo.'
      this.on.errore?.(msg)
      this.imposta('pronto')
    }
  }

  /** Ferma l'ascolto. Se la partenza non era ancora avvenuta, il beep viene annullato. */
  ferma(notifica = true) {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    // annulla i beep programmati e non ancora suonati
    for (const g of this.uscite) g.disconnect()
    this.uscite = []
    this.wake?.release().catch(() => {})
    this.wake = null
    if (this.stato !== 'pronto' && this.stato !== 'fermo') this.imposta(notifica ? 'fermo' : 'pronto')
  }

  rimuoviColpo(i: number) {
    this.colpi.splice(i, 1)
  }

  chiudi() {
    this.ferma(false)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.sorgente?.disconnect()
    this.nodo = null
    this.ctx?.close()
    this.ctx = null
  }
}
