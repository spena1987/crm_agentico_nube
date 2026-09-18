/**
 * Utilidades de audio para feedback clínico inmediato en Quirófano y Recepción (Web Audio API).
 * Permite confirmar lecturas de escáner sin requerir archivos de audio externos.
 */

class AudioFeedbackEngine {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          this.ctx = new AudioCtx()
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    } catch {
      return null
    }
  }

  /**
   * Tono doble agudo ascendente (880 Hz -> 1760 Hz):
   * Confirmación médica de éxito (paciente verificado, LIO coincidente, etc.).
   */
  public beepExito() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
        gain.gain.setValueAtTime(0.18, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }

      playTone(880, 0, 0.08)
      playTone(1760, 0.09, 0.12)
    } catch (e) {
      console.warn('Audio feedback blocked by browser:', e)
    }
  }

  /**
   * Tono grave descendente/disonante (330 Hz -> 220 Hz):
   * Alerta clínica inmediata (discrepancia de LIO, lente vencido, paciente incorrecto).
   */
  public beepAlerta() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
        gain.gain.setValueAtTime(0.2, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }

      playTone(330, 0, 0.14)
      playTone(220, 0.15, 0.22)
    } catch (e) {
      console.warn('Audio feedback error:', e)
    }
  }

  /**
   * Clic sutil de captura (1200 Hz, 35ms):
   * Confirma que el escáner envió una ráfaga y está siendo procesada.
   */
  public beepScan() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.04)
    } catch (e) {
      console.warn('Audio feedback error:', e)
    }
  }
}

export const audioFeedback = new AudioFeedbackEngine()
export const reproducirBeepExito = () => audioFeedback.beepExito()
export const reproducirBeepAlerta = () => audioFeedback.beepAlerta()
export const reproducirBeepScan = () => audioFeedback.beepScan()
