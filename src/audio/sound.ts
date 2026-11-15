/**
 * BOWER JJ — Procedural Sound Engine
 * Built on Web Audio API: Zero external audio files required, 100% reliable, zero latency.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Crisp card snap / play sound
   */
  public playCardSnap() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  /**
   * Rapid card dealing flutter
   */
  public playDealCard() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /**
   * Trick sweep / collect sound
   */
  public playTrickWin(isPlayerTeam: boolean = true) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = isPlayerTeam ? [523.25, 659.25, 783.99] : [392.00, 329.63]; // C5, E5, G5 vs G4, E4

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  }

  /**
   * Trump call fanfare chime
   */
  public playTrumpCall() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [440, 554.37, 659.25]; // A4, C#5, E5
    chord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  /**
   * Euchre dramatic sting
   */
  public playEuchreStinger() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Victory fanfare
   */
  public playVictoryFanfare() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.0, d: 0.12 }, // C5
      { f: 659.25, t: 0.12, d: 0.12 }, // E5
      { f: 783.99, t: 0.24, d: 0.12 }, // G5
      { f: 1046.50, t: 0.38, d: 0.45 }, // C6
    ];

    melody.forEach(({ f, t, d }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.28, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + t);
      osc.stop(now + t + d + 0.05);
    });
  }

  /**
   * Button click / UI tap
   */
  public playUiClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.035);
  }

  /**
   * Anticipation charge hum before booster pack burst
   */
  public playPackCharge() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.65);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2800, now + 0.65);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.72);
  }

  /**
   * Booster foil tear / burst impact
   */
  public playPackBurst() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [220, 440, 659.25, 880, 1318.5].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.02);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.35 + idx * 0.02);
      gain.gain.setValueAtTime(0.18, now + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 + idx * 0.02);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.02);
      osc.stop(now + 0.48 + idx * 0.02);
    });
  }

  /**
   * Rarity-tuned card flip sound inside Pack Opening modal
   */
  public playCardFlipReveal(rarity: 'common' | 'rare' | 'epic' | 'legendary') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chords: Record<string, number[]> = {
      common: [440, 554.37],
      rare: [523.25, 659.25, 783.99],
      epic: [587.33, 739.99, 880, 1174.66],
      legendary: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98],
    };
    const notes = chords[rarity] || chords.common;
    const step = rarity === 'legendary' ? 0.075 : rarity === 'epic' ? 0.055 : 0.04;
    const dur = rarity === 'legendary' ? 0.7 : rarity === 'epic' ? 0.45 : 0.25;

    notes.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = rarity === 'legendary' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now + idx * step);
      gain.gain.setValueAtTime(rarity === 'legendary' ? 0.24 : 0.16, now + idx * step);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * step + dur);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * step);
      osc.stop(now + idx * step + dur + 0.04);
    });
  }
}

export const sounds = new SoundEngine();
