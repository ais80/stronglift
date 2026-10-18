// calc.js — plate math and warm-up set math. Pure functions, no DOM.
import { roundToStep, round2 } from "./program.js";

/**
 * Work out which plates to load per side for `targetWeight` on a `barWeight` bar,
 * from the plates actually on hand. Greedy, largest-first.
 * @param {number} targetWeight
 * @param {number} barWeight
 * @param {{weight:number, count:number}[]} availablePlates  total count owned (both sides)
 * @returns {{ perSide: {weight:number, count:number}[], exact: boolean, achievedWeight: number }}
 */
export function platesFor(targetWeight, barWeight, availablePlates) {
  const EPS = 1e-6;
  const perSideTarget = (targetWeight - barWeight) / 2;

  if (perSideTarget <= EPS) {
    return {
      perSide: [],
      exact: Math.abs(targetWeight - barWeight) < EPS,
      achievedWeight: barWeight,
    };
  }

  let remaining = perSideTarget;
  let usedSum = 0;
  const perSide = [];
  const sorted = [...availablePlates].sort((a, b) => b.weight - a.weight);

  for (const plate of sorted) {
    const maxPerSide = Math.floor(plate.count / 2);
    if (maxPerSide <= 0 || plate.weight <= 0) continue;
    const want = Math.floor((remaining + EPS) / plate.weight);
    const use = Math.min(maxPerSide, want);
    if (use > 0) {
      perSide.push({ weight: plate.weight, count: use });
      remaining -= use * plate.weight;
      usedSum += use * plate.weight;
    }
  }

  return {
    perSide,
    exact: remaining < EPS,
    achievedWeight: round2(barWeight + usedSum * 2),
  };
}

/**
 * Standard percentage-based warm-up ramp: empty bar, then ~40/60/80% of the work
 * weight, dropping reps as weight climbs. Skipped entirely for very light work sets.
 * @param {number} targetWeight
 * @param {number} barWeight
 * @param {number} step  rounding increment (plate step), default 2.5
 */
export function warmupSets(targetWeight, barWeight, step = 2.5) {
  if (targetWeight - barWeight < step * 2) return [];

  const ramp = [
    { pct: 0, reps: 5 },
    { pct: 0.4, reps: 5 },
    { pct: 0.6, reps: 3 },
    { pct: 0.8, reps: 2 },
  ];

  const sets = [];
  for (const { pct, reps } of ramp) {
    const weight =
      pct === 0 ? barWeight : roundToStep(barWeight + (targetWeight - barWeight) * pct, step);
    if (weight >= targetWeight) continue;
    if (sets.length && sets[sets.length - 1].weight === weight) continue;
    sets.push({ weight, reps });
  }
  return sets;
}

/** Epley estimated 1-rep max: an open, standard formula (not the source app's RPE table). */
export function estimate1RM(weight, reps) {
  if (reps <= 0) return 0;
  if (reps === 1) return round2(weight);
  return round2(weight * (1 + reps / 30));
}
