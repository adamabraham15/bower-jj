/**
 * BOWER JJ — Procedural Sound & Chill Lo-Fi Music Engine
 * Built on Web Audio API: Zero external copyrighted files, 100% original royalty-free synthesis,
 * smooth crossfading between Lobby & Gameplay scenes, and persistent independent Music/SFX controls.
 */

export type MusicScene = 'lobby' | 'game' | 'off';

export interface AudioPreferences {
  sfxMuted: boolean;
  sfxVolume: number; // 0.0 - 1.0
  musicEnabled: boolean;
  musicVolume: number; // 0.0 - 1.0
}

const AUDIO_PREFS_STORAGE_KEY = 'bower_jj_audio_prefs';

const DEFAULT_AUDIO_PREFS: AudioPreferences = {
  sfxMuted: false,
  sfxVolume: 0.85,
  musicEnabled: true,
  musicVolume: 0.38,
};

function clamp01(val: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.max(0, Math.min(1, val));
}

let memoryPrefsFallback: AudioPreferences | null = null;

export function loadSavedAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryPrefsFallback ? { ...memoryPrefsFallback } : { ...DEFAULT_AUDIO_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(AUDIO_PREFS_STORAGE_KEY);
    if (!raw) return memoryPrefsFallback ? { ...memoryPrefsFallback } : { ...DEFAULT_AUDIO_PREFS };
    const parsed = JSON.parse(raw);
    return {
      sfxMuted: Boolean(parsed.sfxMuted),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_AUDIO_PREFS.sfxVolume),
      musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : DEFAULT_AUDIO_PREFS.musicEnabled,
      musicVolume: clamp01(parsed.musicVolume, DEFAULT_AUDIO_PREFS.musicVolume),
    };
  } catch {
    return memoryPrefsFallback ? { ...memoryPrefsFallback } : { ...DEFAULT_AUDIO_PREFS };
  }
}

export function saveAudioPreferences(prefs: AudioPreferences): void {
  memoryPrefsFallback = { ...prefs };
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

// Extended jazz / lo-fi chord voicings (in Hz)
const LOBBY_CHORD_PROGRESSIONS: number[][][] = [
  // Progression A: Fmaj9 -> Em7 -> Dm9 -> Cmaj9
  [
    [174.61, 220.0, 261.63, 329.63, 392.0],   // Fmaj9
    [164.81, 196.0, 246.94, 293.66, 392.0],   // Em7(11)
    [146.83, 174.61, 220.0, 261.63, 329.63],  // Dm9
    [130.81, 196.0, 246.94, 293.66, 329.63],  // Cmaj9
  ],
  // Progression B: Bbmaj7 -> Am7 -> Gm9 -> C9sus4
  [
    [116.54, 174.61, 220.0, 293.66, 349.23],  // Bbmaj7
    [110.0, 164.81, 196.0, 261.63, 329.63],   // Am7(11)
    [98.0, 146.83, 174.61, 220.0, 293.66],    // Gm9
    [130.81, 196.0, 233.08, 261.63, 349.23],  // C9sus4
  ],
];

// Subtle, focused atmospheric progressions for active matches
const GAME_CHORD_PROGRESSIONS: number[][][] = [
  // Progression A: Dm9 -> Am9 -> Bbmaj9 -> C6/9
  [
    [146.83, 220.0, 261.63, 329.63],          // Dm9
    [110.0, 196.0, 246.94, 261.63],           // Am9
    [116.54, 174.61, 220.0, 261.63],          // Bbmaj9
    [130.81, 164.81, 220.0, 293.66],          // C6/9
  ],
  // Progression B: Gm9 -> Dm9 -> Fmaj7 -> A7sus4
  [
    [98.0, 174.61, 220.0, 293.66],            // Gm9
    [146.83, 220.0, 261.63, 329.63],          // Dm9
    [174.61, 220.0, 261.63, 329.63],          // Fmaj7
    [110.0, 164.81, 196.0, 220.0],            // A7sus4
  ],
];

const LOFI_MELODY_SCALE = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicMasterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private prefs: AudioPreferences = loadSavedAudioPreferences();
  private currentScene: MusicScene = 'lobby';
  private musicLoopTimer: ReturnType<typeof setInterval> | null = null;
  private stepIndex: number = 0;
  private barIndex: number = 0;
  private hasBoundInteractionListener: boolean = false;
  private hasUserInteracted: boolean = false;
  private listeners: Set<(prefs: AudioPreferences) => void> = new Set();

  constructor() {
    this.bindFirstInteractionListener();
  }

  private bindFirstInteractionListener() {
    if (typeof window === 'undefined' || this.hasBoundInteractionListener) return;
    this.hasBoundInteractionListener = true;

    const onInteract = () => {
      this.hasUserInteracted = true;
      if (this.prefs.musicEnabled && this.currentScene !== 'off') {
        this.initContext();
        this.startMusicSequencer();
      }
    };

    window.addEventListener('pointerdown', onInteract, { passive: true });
    window.addEventListener('keydown', onInteract, { passive: true });
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.getEffectiveSfxGain(), this.ctx.currentTime);
        this.sfxGain.connect(this.ctx.destination);

        this.musicMasterGain = this.ctx.createGain();
        this.musicMasterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.musicMasterGain.connect(this.ctx.destination);

        this.updateMusicGainSmooth(0.8);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;

    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private getEffectiveSfxGain(): number {
    return this.prefs.sfxMuted ? 0 : this.prefs.sfxVolume;
  }

  private getEffectiveMusicGain(): number {
    if (!this.prefs.musicEnabled || this.currentScene === 'off') return 0;
    // Gameplay music sits slightly softer than lobby music so players can focus on cards
    const sceneMultiplier = this.currentScene === 'game' ? 0.72 : 1.0;
    return this.prefs.musicVolume * sceneMultiplier * 0.42;
  }

  private updateSfxGainSmooth() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const target = this.getEffectiveSfxGain();
    this.sfxGain.gain.cancelScheduledValues(now);
    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, now);
    this.sfxGain.gain.linearRampToValueAtTime(target, now + 0.06);
  }

  private updateMusicGainSmooth(rampSeconds: number = 0.6) {
    if (!this.ctx || !this.musicMasterGain) return;
    const now = this.ctx.currentTime;
    const target = this.getEffectiveMusicGain();
    this.musicMasterGain.gain.cancelScheduledValues(now);
    this.musicMasterGain.gain.setValueAtTime(Math.max(0.0001, this.musicMasterGain.gain.value), now);
    this.musicMasterGain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + rampSeconds);
  }

  private notifyListeners() {
    const snapshot = this.getAudioPreferences();
    this.listeners.forEach(cb => cb(snapshot));
  }

  public subscribe(listener: (prefs: AudioPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAudioPreferences(): AudioPreferences {
    return { ...this.prefs };
  }

  /**
   * Legacy mute setter: toggles SFX mute (and if muting all via quick-button, pauses music too)
   */
  public setMuted(muted: boolean) {
    this.prefs = {
      ...this.prefs,
      sfxMuted: muted,
      musicEnabled: !muted,
    };
    saveAudioPreferences(this.prefs);
    this.updateSfxGainSmooth();
    this.updateMusicGainSmooth(0.4);
    if (!muted && this.hasUserInteracted && this.currentScene !== 'off') {
      this.initContext();
      this.startMusicSequencer();
    } else if (muted) {
      this.stopMusicSequencerAfterFade();
    }
    this.notifyListeners();
  }

  public getMuted(): boolean {
    return this.prefs.sfxMuted && !this.prefs.musicEnabled;
  }

  public setSfxMuted(sfxMuted: boolean) {
    this.prefs = { ...this.prefs, sfxMuted };
    saveAudioPreferences(this.prefs);
    this.updateSfxGainSmooth();
    this.notifyListeners();
  }

  public setSfxVolume(sfxVolume: number) {
    const clamped = clamp01(sfxVolume, DEFAULT_AUDIO_PREFS.sfxVolume);
    this.prefs = {
      ...this.prefs,
      sfxVolume: clamped,
      sfxMuted: clamped === 0 ? true : false,
    };
    saveAudioPreferences(this.prefs);
    this.updateSfxGainSmooth();
    this.notifyListeners();
  }

  public setMusicEnabled(musicEnabled: boolean) {
    this.prefs = { ...this.prefs, musicEnabled };
    saveAudioPreferences(this.prefs);
    if (musicEnabled) {
      this.hasUserInteracted = true;
      this.initContext();
      this.startMusicSequencer();
      this.updateMusicGainSmooth(0.75);
    } else {
      this.updateMusicGainSmooth(0.45);
      this.stopMusicSequencerAfterFade();
    }
    this.notifyListeners();
  }

  public setMusicVolume(musicVolume: number) {
    const clamped = clamp01(musicVolume, DEFAULT_AUDIO_PREFS.musicVolume);
    const shouldEnable = clamped > 0;
    this.prefs = {
      ...this.prefs,
      musicVolume: clamped,
      musicEnabled: shouldEnable ? true : false,
    };
    saveAudioPreferences(this.prefs);
    if (shouldEnable) {
      this.hasUserInteracted = true;
      this.initContext();
      this.startMusicSequencer();
    } else {
      this.stopMusicSequencerAfterFade();
    }
    this.updateMusicGainSmooth(0.2);
    this.notifyListeners();
  }

  /**
   * Transitions smoothly between 'lobby' and 'game' background soundtracks
   */
  public setMusicScene(scene: MusicScene) {
    if (this.currentScene === scene) return;
    this.currentScene = scene;

    if (!this.ctx || !this.musicMasterGain) {
      if (this.hasUserInteracted && this.prefs.musicEnabled && scene !== 'off') {
        this.initContext();
        this.startMusicSequencer();
      }
      return;
    }

    // Smooth crossfade envelope
    const now = this.ctx.currentTime;
    const currentVal = Math.max(0.0001, this.musicMasterGain.gain.value);
    const nextTarget = Math.max(0.0001, this.getEffectiveMusicGain());

    this.musicMasterGain.gain.cancelScheduledValues(now);
    this.musicMasterGain.gain.setValueAtTime(currentVal, now);
    // Gentle dip then smooth rise into the new scene
    this.musicMasterGain.gain.linearRampToValueAtTime(Math.max(0.0001, nextTarget * 0.45), now + 0.35);
    this.musicMasterGain.gain.linearRampToValueAtTime(nextTarget, now + 1.2);

    if (scene === 'off') {
      this.stopMusicSequencerAfterFade();
    } else if (this.prefs.musicEnabled && this.hasUserInteracted) {
      this.startMusicSequencer();
    }
  }

  public getMusicScene(): MusicScene {
    return this.currentScene;
  }

  private startMusicSequencer() {
    if (this.musicLoopTimer || !this.prefs.musicEnabled || this.currentScene === 'off') return;
    if (!this.ctx) return;

    // 16th-note / 8th-note chill lo-fi step interval (~76 BPM -> 395ms per 8th note step)
    const stepMs = 395;
    this.scheduleLoFiStep();
    this.musicLoopTimer = setInterval(() => {
      if (!this.prefs.musicEnabled || this.currentScene === 'off') {
        this.stopMusicSequencerAfterFade();
        return;
      }
      this.scheduleLoFiStep();
    }, stepMs);
  }

  private stopMusicSequencerAfterFade() {
    if (this.musicLoopTimer) {
      clearInterval(this.musicLoopTimer);
      this.musicLoopTimer = null;
    }
  }

  private scheduleLoFiStep() {
    if (!this.ctx || !this.musicMasterGain || this.ctx.state !== 'running') return;
    if (!this.prefs.musicEnabled || this.currentScene === 'off') return;

    const now = this.ctx.currentTime;
    const stepInBar = this.stepIndex % 8; // 8 eighth-notes per bar (4/4 time)
    const isLobby = this.currentScene === 'lobby';

    const progressions = isLobby ? LOBBY_CHORD_PROGRESSIONS : GAME_CHORD_PROGRESSIONS;
    const progIdx = Math.floor(this.barIndex / 4) % progressions.length;
    const chordIdx = this.barIndex % 4;
    const currentChord = progressions[progIdx][chordIdx];

    // 1. Warm Rhodes / Lounge Pad Chord on Beat 1 (step 0) and gentle re-voicing on step 5
    if (stepInBar === 0) {
      this.playWarmChord(currentChord, now, isLobby ? 2.9 : 3.1, isLobby ? 0.16 : 0.13);
      // Warm sub-bass root note
      this.playWarmSubBass(currentChord[0] * 0.5, now, 2.6, isLobby ? 0.22 : 0.16);
    } else if (stepInBar === 5 && isLobby && Math.random() < 0.65) {
      // Subtle syncopated Rhodes chord ghost
      this.playWarmChord(currentChord.slice(1), now, 0.9, 0.07);
    }

    // 2. Soft Lo-Fi Percussion Groove (more present in Lobby, ultra-subtle pulse in Game)
    if (stepInBar === 0 || (stepInBar === 5 && isLobby)) {
      this.playSoftLoFiKick(now, isLobby ? 0.24 : 0.12);
    }
    if ((stepInBar === 2 || stepInBar === 6) && isLobby) {
      this.playSoftRimClick(now, 0.08);
    }
    if (stepInBar % 2 === 1 && isLobby) {
      this.playSoftBrushedHat(now, stepInBar === 3 || stepInBar === 7 ? 0.045 : 0.025);
    }

    // 3. Delicate Atmospheric Pentatonic Rhodes / Vibraphone Pluck
    const melodyChance = isLobby ? 0.42 : 0.24;
    if ((stepInBar === 1 || stepInBar === 3 || stepInBar === 4 || stepInBar === 6) && Math.random() < melodyChance) {
      const note = LOFI_MELODY_SCALE[Math.floor(Math.random() * LOFI_MELODY_SCALE.length)];
      this.playChillPluckNote(note, now, isLobby ? 0.95 : 1.35, isLobby ? 0.085 : 0.055);
    }

    this.stepIndex++;
    if (this.stepIndex % 8 === 0) {
      this.barIndex++;
    }
  }

  private playWarmChord(freqs: number[], startTime: number, duration: number, level: number) {
    if (!this.ctx || !this.musicMasterGain) return;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.currentScene === 'lobby' ? 1150 : 880, startTime);
    filter.Q.setValueAtTime(0.7, startTime);
    filter.connect(this.musicMasterGain);

    freqs.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      // Subtle analog detune warmth
      const detuneCents = (i - 1.5) * 3.5;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.detune.setValueAtTime(detuneCents, startTime);

      const noteLevel = level / Math.sqrt(freqs.length);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(noteLevel, startTime + 0.14 + i * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(startTime + i * 0.015);
      osc.stop(startTime + duration + 0.05);
    });
  }

  private playWarmSubBass(freq: number, startTime: number, duration: number, level: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(level, startTime + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicMasterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private playSoftLoFiKick(startTime: number, level: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.14);

    gain.gain.setValueAtTime(level, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.19);

    osc.connect(gain);
    gain.connect(this.musicMasterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.21);
  }

  private playSoftRimClick(startTime: number, level: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(390, startTime);
    osc.frequency.exponentialRampToValueAtTime(170, startTime + 0.035);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, startTime);
    filter.Q.setValueAtTime(1.8, startTime);

    gain.gain.setValueAtTime(level, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicMasterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  private playSoftBrushedHat(startTime: number, level: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    const noise = this.getNoiseBuffer();
    if (!noise) return;

    const src = this.ctx.createBufferSource();
    src.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(5200, startTime);
    filter.Q.setValueAtTime(1.5, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.055);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicMasterGain);

    src.start(startTime, Math.random() * 0.5, 0.06);
  }

  private playChillPluckNote(freq: number, startTime: number, duration: number, level: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, startTime);
    filter.frequency.exponentialRampToValueAtTime(550, startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(level, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0006, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicMasterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private getSfxDestination(): AudioNode | null {
    if (!this.ctx) return null;
    return this.sfxGain || this.ctx.destination;
  }

  /**
   * Crisp card snap / play sound
   */
  public playCardSnap() {
    this.hasUserInteracted = true;
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

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
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  /**
   * Rapid card dealing flutter
   */
  public playDealCard() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /**
   * Trick sweep / collect sound
   */
  public playTrickWin(isPlayerTeam: boolean = true) {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;
    const notes = isPlayerTeam ? [523.25, 659.25, 783.99] : [392.0, 329.63];

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.14);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  }

  /**
   * Trump call fanfare chime
   */
  public playTrumpCall() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;
    const chord = [440, 554.37, 659.25];
    chord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  /**
   * Euchre dramatic sting
   */
  public playEuchreStinger() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Victory fanfare
   */
  public playVictoryFanfare() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.0, d: 0.12 },
      { f: 659.25, t: 0.12, d: 0.12 },
      { f: 783.99, t: 0.24, d: 0.12 },
      { f: 1046.5, t: 0.38, d: 0.45 },
    ];

    melody.forEach(({ f, t, d }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.28, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + t);
      osc.stop(now + t + d + 0.05);
    });
  }

  /**
   * Button click / UI tap
   */
  public playUiClick() {
    this.hasUserInteracted = true;
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.035);
  }

  /**
   * Subtle crystalline shimmer when hovering/interacting with booster pack or unrevealed card
   */
  public playPackHover() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;
    [1046.5, 1318.5].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.018);
      gain.gain.setValueAtTime(0.04, now + i * 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + i * 0.018 + 0.075);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + i * 0.018);
      osc.stop(now + i * 0.018 + 0.08);
    });
  }

  /**
   * Anticipation charge hum & harmonic riser before booster pack tear/burst
   */
  public playPackCharge() {
    this.hasUserInteracted = true;
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;

    // Layer 1: Warm harmonic sawtooth riser
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.68);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + 0.68);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.58);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.74);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.76);

    // Layer 2: Shimmering fifth overtone riser
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(164.81, now);
    subOsc.frequency.exponentialRampToValueAtTime(880, now + 0.68);
    subGain.gain.setValueAtTime(0.02, now);
    subGain.gain.exponentialRampToValueAtTime(0.14, now + 0.6);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.74);
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(now);
    subOsc.stop(now + 0.76);
  }

  /**
   * Crisp foil seal tear / zipper rip sound when slicing open the top of the booster pack
   */
  public playPackTear() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;
    const noise = this.getNoiseBuffer();
    if (noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(6200, now + 0.28);
      filter.Q.setValueAtTime(2.2, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(now, 0, 0.32);
    }

    // Crisp metallic crimp teeth clicks
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.038;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800 + i * 260, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.022);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.028);
    }
  }

  /**
   * Booster foil burst impact + radiant chord bloom when cards fan out
   */
  public playPackBurst() {
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;

    // 1. Deep resonant sub-bass bloom
    const bass = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(130.81, now);
    bass.frequency.exponentialRampToValueAtTime(48, now + 0.45);
    bassGain.gain.setValueAtTime(0.32, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    bass.connect(bassGain);
    bassGain.connect(dest);
    bass.start(now);
    bass.stop(now + 0.52);

    // 2. Luminous harp/synth chord fan-out
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = idx < 3 ? 'triangle' : 'sine';
      const start = now + idx * 0.024;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.015, start + 0.55);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.62);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }

  /**
   * Rarity-tuned card flip sound inside Pack Opening modal
   * Common -> Crisp tactile snap + warm chime
   * Rare -> Sparkling cyan arpeggio
   * Epic -> Deep bass pulse + amethyst bell choir
   * Legendary -> Celestial golden fanfare + diamond cascade
   */
  public playCardFlipReveal(rarity: 'common' | 'rare' | 'epic' | 'legendary') {
    this.hasUserInteracted = true;
    if (this.prefs.sfxMuted) return;
    this.initContext();
    const dest = this.getSfxDestination();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;

    // Tactile card flip snap at t=0
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(520, now);
    snapOsc.frequency.exponentialRampToValueAtTime(130, now + 0.055);
    snapGain.gain.setValueAtTime(0.18, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    snapOsc.connect(snapGain);
    snapGain.connect(dest);
    snapOsc.start(now);
    snapOsc.stop(now + 0.065);

    if (rarity === 'epic' || rarity === 'legendary') {
      // Dramatic low-end impact for high-value pulls
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(rarity === 'legendary' ? 146.83 : 123.47, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.55);
      subGain.gain.setValueAtTime(rarity === 'legendary' ? 0.34 : 0.24, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      sub.connect(subGain);
      subGain.connect(dest);
      sub.start(now);
      sub.stop(now + 0.62);
    }

    const chords: Record<'common' | 'rare' | 'epic' | 'legendary', number[]> = {
      common: [440, 554.37, 659.25],
      rare: [523.25, 659.25, 783.99, 987.77, 1174.66],
      epic: [587.33, 739.99, 880, 1108.73, 1318.5, 1760],
      legendary: [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5, 1567.98, 2093.0],
    };

    const notes = chords[rarity] || chords.common;
    const step = rarity === 'legendary' ? 0.065 : rarity === 'epic' ? 0.05 : 0.038;
    const dur = rarity === 'legendary' ? 0.95 : rarity === 'epic' ? 0.65 : rarity === 'rare' ? 0.42 : 0.26;

    notes.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = rarity === 'legendary' ? (idx % 2 === 0 ? 'triangle' : 'sine') : 'sine';
      const start = now + idx * step;
      osc.frequency.setValueAtTime(f, start);
      const peakGain = rarity === 'legendary' ? 0.22 : rarity === 'epic' ? 0.18 : 0.14;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + dur + 0.04);

      // Add sparkling harmonic overtone on Rare/Epic/Legendary
      if (rarity !== 'common' && idx >= 2) {
        const shimmer = this.ctx!.createOscillator();
        const shimmerGain = this.ctx!.createGain();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(f * 2, start + 0.02);
        shimmerGain.gain.setValueAtTime(peakGain * 0.32, start + 0.02);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0005, start + dur * 0.85);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(dest);
        shimmer.start(start + 0.02);
        shimmer.stop(start + dur * 0.9);
      }
    });
  }
}

export const sounds = new SoundEngine();
