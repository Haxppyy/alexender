import type { Rarity } from "./achievements";

/*
 * The sounds of winning, made with Web Audio — no files.
 *  - victory(): a brass call, "ta-ta-ta-taaa", over war drums; grander the rarer the win.
 *  - ping(): a bright note as each reward drops into the chest when you claim.
 */

const NOTE = (n: number) => 261.63 * Math.pow(2, n / 12); // semitones from middle C

/** A horn: two slightly detuned saws through a filter that opens as the note swells. */
function horn(ctx: AudioContext, freq: number, at: number, length: number, volume: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, at);
  filter.frequency.exponentialRampToValueAtTime(2600, at + 0.08);
  filter.frequency.exponentialRampToValueAtTime(1200, at + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.04);
  gain.gain.setValueAtTime(volume * 0.85, at + length * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.25);
  filter.connect(gain).connect(ctx.destination);
  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(at);
    osc.stop(at + length + 0.3);
  }
}

/** A war drum: a low thump that falls in pitch. */
function drum(ctx: AudioContext, at: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.35);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.55);
}

function bell(ctx: AudioContext, freq: number, at: number, length: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

function play(build: (ctx: AudioContext, t: number) => number) {
  try {
    const ctx = new AudioContext();
    const seconds = build(ctx, ctx.currentTime + 0.05);
    setTimeout(() => ctx.close().catch(() => {}), (seconds + 1) * 1000);
  } catch {}
}

/** Battle won. */
export function victory(rarity: Rarity) {
  play((ctx, t) => {
    const v = 0.07 + rarity * 0.012;
    // The call: three short notes, then the long one — a fifth higher for the rare wins.
    const call = rarity >= 3 ? [7, 7, 7, 12, 16, 19] : [7, 7, 7, 12];
    const beats = rarity >= 3 ? [0, 0.13, 0.26, 0.42, 0.72, 1.0] : [0, 0.13, 0.26, 0.42];
    call.forEach((n, i) => horn(ctx, NOTE(n), t + beats[i], i === call.length - 1 ? 1.3 : 0.11, v));
    // The harmony under the last note.
    const last = t + beats[beats.length - 1];
    for (const n of rarity >= 3 ? [0, 7, 12] : [0, 4]) horn(ctx, NOTE(n), last, 1.3, v * 0.6);
    // Drums on the beats; a roll for legends.
    const hits = rarity === 4 ? [0, 0.13, 0.26, 0.42, 0.52, 0.62, 0.72, 1.0] : rarity >= 2 ? [0, 0.42] : [0.42];
    hits.forEach((h) => drum(ctx, t + h, 0.5));
    return beats[beats.length - 1] + 1.8;
  });
}

/** One reward landing in the chest — each a step higher than the last. */
export function ping(i: number) {
  play((ctx, t) => {
    const n = 24 + [0, 4, 7, 12, 16, 19, 24][Math.min(i, 6)];
    bell(ctx, NOTE(n), t, 0.5, 0.12);
    bell(ctx, NOTE(n + 12), t + 0.04, 0.35, 0.05);
    return 0.6;
  });
}

/** A buzz to match: short for common wins, a long rolling one for a legend. */
export const BUZZ: Record<Rarity, number[]> = {
  1: [30, 60, 60],
  2: [40, 60, 40, 60, 90],
  3: [50, 50, 50, 50, 140],
  4: [80, 60, 80, 60, 80, 60, 260],
};
