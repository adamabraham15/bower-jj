/**
 * BOWER JJ — Sound FX & Mobile Haptics Suite
 * Web Audio API synthesized audio cues + mobile vibration triggers for pack opening,
 * card reveals, set completions, and game actions.
 */

import { sounds, loadSavedAudioPreferences } from '../audio/sound';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getVolumeLevel(): number {
  const prefs = loadSavedAudioPreferences();
  if (prefs.sfxMuted) return 0;
  return prefs.sfxVolume ?? 0.85;
}

/**
 * sfx_pack_tear: Crisp paper & metallic foil rip
 */
export function sfx_pack_tear(): void {
  const vol = getVolumeLevel();
  if (vol <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) {
    sounds.playPackTear();
    return;
  }

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.28);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Generate pink-ish noise with high-frequency crackle for realistic foil tearing
  let lastVal = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastVal = (lastVal + 0.05 * white) / 1.05;
    const crackle = Math.random() < 0.08 ? (Math.random() * 2 - 1) * 1.5 : 0;
    data[i] = (lastVal * 2.8 + crackle) * (1 - i / bufferSize);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + 0.28);
  filter.Q.setValueAtTime(2.2, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.35 * vol, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.29);
}

/**
 * sfx_card_flip: Fast air whoosh + snappy card snap
 */
export function sfx_card_flip(): void {
  const vol = getVolumeLevel();
  if (vol <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) {
    sounds.playCardSnap();
    return;
  }

  const now = ctx.currentTime;

  // Short whoosh oscillator
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.22 * vol, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);

  // High-frequency slap click
  setTimeout(() => {
    sounds.playCardSnap();
  }, 20);
}

/**
 * sfx_legendary_reveal: Low bass rumble with shimmering chime arpeggio
 */
export function sfx_legendary_reveal(): void {
  const vol = getVolumeLevel();
  if (vol <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) {
    sounds.playVictoryFanfare();
    return;
  }

  const now = ctx.currentTime;

  // Sub bass impact
  const subOsc = ctx.createOscillator();
  subOsc.type = 'triangle';
  subOsc.frequency.setValueAtTime(110, now);
  subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.65);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.01, now);
  subGain.gain.linearRampToValueAtTime(0.42 * vol, now + 0.04);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  subOsc.connect(subGain);
  subGain.connect(ctx.destination);

  subOsc.start(now);
  subOsc.stop(now + 0.72);

  // Shimmering chime arpeggio (Emaj7 / G#m / C#m crystal notes)
  const notes = [659.25, 830.61, 987.77, 1318.51, 1661.22, 1975.53];
  notes.forEach((freq, idx) => {
    const noteTime = now + 0.06 + idx * 0.05;
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(freq, noteTime);

    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.001, noteTime);
    chimeGain.gain.linearRampToValueAtTime(0.18 * vol, noteTime + 0.015);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.55);

    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);

    chime.start(noteTime);
    chime.stop(noteTime + 0.58);
  });
}

/**
 * sfx_set_complete: Brass fanfare with confetti pop
 */
export function sfx_set_complete(): void {
  const vol = getVolumeLevel();
  if (vol <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) {
    sounds.playVictoryFanfare();
    return;
  }

  const now = ctx.currentTime;

  // Brass triad chords: C -> F -> G -> High C
  const chords = [
    { notes: [261.63, 329.63, 392.0], start: 0.0, dur: 0.18 },
    { notes: [349.23, 440.0, 523.25], start: 0.16, dur: 0.18 },
    { notes: [392.0, 493.88, 587.33], start: 0.32, dur: 0.22 },
    { notes: [523.25, 659.25, 783.99, 1046.5], start: 0.52, dur: 0.85 },
  ];

  chords.forEach(({ notes, start, dur }) => {
    notes.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now + start);
      filter.frequency.exponentialRampToValueAtTime(4200, now + start + 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.linearRampToValueAtTime(0.12 * vol, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  });
}

/**
 * Mobile Haptics triggers
 */
export function hapticTear(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([25, 50]);
    } catch {
      // Ignore vibration error on unsupported platforms
    }
  }
}

export function hapticLegendary(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([50, 30, 80]);
    } catch {
      // Ignore vibration error
    }
  }
}

export function hapticTap(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(15);
    } catch {
      // Ignore
    }
  }
}
