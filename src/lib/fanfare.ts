import type { Rarity } from "./achievements";

/*
 * The sound of earning something: a rising arpeggio of bell tones that lands on a held chord.
 * The rarer the win, the longer and richer — a legendary one opens with a low swell and ends in a
 * shimmer of high notes. Pure Web Audio, no files.
 */

const NOTE = (n: number) => 261.63 * Math.pow(2, n / 12); // semitones from middle C

const RUNS: Record<Rarity, number[]> = {
  1: [0, 4, 7, 12],
  2: [0, 4, 7, 12, 16],
  3: [-5, 0, 4, 7, 12, 16, 19],
  4: [-12, -5, 0, 4, 7, 12, 16, 19, 24],
};

function bell(ctx: AudioContext, freq: number, at: number, length: number, volume: number) {
  // A bell: the note plus a quieter, slightly sharp octave that fades faster.
  for (const [mult, vol, len] of [
    [1, volume, length],
    [2.01, volume * 0.35, length * 0.6],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = mult === 1 ? "triangle" : "sine";
    osc.frequency.value = freq * mult;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
}

export function fanfare(rarity: Rarity) {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime + 0.05;
    const run = RUNS[rarity];
    const step = rarity >= 3 ? 0.085 : 0.075;

    if (rarity === 4) {
      // A low swell underneath it all.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(55, t);
      osc.frequency.exponentialRampToValueAtTime(82, t + 1.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 2.7);
    }

    run.forEach((n, i) => bell(ctx, NOTE(n), t + i * step, 1.1, 0.16));
    // Land on the chord, held.
    const end = t + run.length * step + 0.05;
    for (const n of [0, 4, 7, 12]) bell(ctx, NOTE(n + (rarity >= 3 ? 12 : 0)), end, 1.8 + rarity * 0.3, 0.09);
    // A shimmer of high notes for the rare ones.
    if (rarity >= 3)
      for (let i = 0; i < 6 + rarity * 2; i++) bell(ctx, NOTE(24 + [0, 4, 7, 12][i % 4] + (i % 3) * 12), end + 0.15 + i * 0.06, 0.5, 0.035);

    setTimeout(() => ctx.close().catch(() => {}), 6000);
  } catch {}
}

/** A buzz to match: short for common wins, a long rolling one for a legend. */
export const BUZZ: Record<Rarity, number[]> = {
  1: [30, 60, 60],
  2: [40, 60, 40, 60, 90],
  3: [50, 50, 50, 50, 140],
  4: [80, 60, 80, 60, 80, 60, 260],
};
