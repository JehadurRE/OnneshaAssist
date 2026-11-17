/**
 * Web Audio API Sound Synthesizer
 * Zero-asset audio engine for interactive game sounds (ticks, chimes, buzzers, drumrolls, fanfare).
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private volume: number = 0.85;
  private listeners: Array<() => void> = [];

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const savedMuted = localStorage.getItem("onnesha_sound_muted");
        if (savedMuted === "1" || savedMuted === "true") this.muted = true;
        const savedVol = Number(localStorage.getItem("onnesha_sound_volume"));
        if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) {
          this.volume = savedVol;
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private initCtx() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(isMuted: boolean) {
    this.muted = isMuted;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("onnesha_sound_muted", isMuted ? "1" : "0");
      } catch {
        // ignore
      }
    }
    this.emit();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(nextVol: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(nextVol) ? nextVol : 0.85));
    this.volume = clamped;
    if (clamped > 0 && this.muted) {
      this.muted = false;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("onnesha_sound_muted", "0");
        } catch {
          // ignore
        }
      }
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("onnesha_sound_volume", String(clamped));
      } catch {
        // ignore
      }
    }
    this.emit();
  }

  private scaledGain(base: number): number {
    return Math.max(0.001, base * this.volume);
  }

  // Timer Tick (crisp click)
  public playTick() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(this.scaledGain(0.12), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // ignore
    }
  }

  // Urgent Tick for last 5 seconds
  public playUrgentTick() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(this.scaledGain(0.2), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // ignore
    }
  }

  // Correct Answer Chime (Major Chord Arpeggio: C5 -> E5 -> G5 -> C6)
  public playCorrect() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.07);
        gain.gain.linearRampToValueAtTime(this.scaledGain(0.22), ctx.currentTime + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.35);
      });
    } catch {
      // ignore
    }
  }

  // Incorrect Answer Low Buzzer
  public playIncorrect() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(this.scaledGain(0.2), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      // ignore
    }
  }

  // Suspense Drumroll / Rising Tension
  public playDrumroll() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        const t = ctx.currentTime + i * 0.06;
        osc.frequency.setValueAtTime(130 + i * 15, t);
        gain.gain.setValueAtTime(this.scaledGain(0.1 + (i / count) * 0.15), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      }
    } catch {
      // ignore
    }
  }

  // Whoosh for rank shifting
  public playWhoosh() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(this.scaledGain(0.15), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }

  // Grand Fanfare for 1st, 2nd, 3rd Podium
  public playFanfare() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const melody = [
        { f: 523.25, d: 0.15 },
        { f: 523.25, d: 0.15 },
        { f: 523.25, d: 0.15 },
        { f: 659.25, d: 0.4 },
        { f: 587.33, d: 0.2 },
        { f: 783.99, d: 0.6 },
      ];
      let offset = 0;
      melody.forEach(({ f, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0, ctx.currentTime + offset);
        gain.gain.linearRampToValueAtTime(this.scaledGain(0.25), ctx.currentTime + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + d);
        offset += d * 0.9;
      });
    } catch {
      // ignore
    }
  }
}

export const audioEngine = new SoundEngine();
