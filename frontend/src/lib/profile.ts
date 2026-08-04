// pure roast-program math, shared by the profile editor (previewing an unsaved
// draft) and the control graph (overlaying the active program's target curve).
//
// IMPORTANT: targetRorAt and planPoints mirror the backend simulator in
// data/roast.go (commandLocked + Tick). If the step semantics change there, they
// must change here too, or the predicted curve will drift from the real one.

import type { Step, StepMode } from './api';

export const AMBIENT_C = 22; // mirrors data.ambientTemp
export const MAX_C = 260; // mirrors data.maxTemp

export const DEFAULT_STEPS: Step[] = [
	{ duration_sec: 120, mode: 'hold', ror: 26, ror_end: 26, fan_speed: 75, drum_rpm: 62 },
	{ duration_sec: 240, mode: 'ramp', ror: 26, ror_end: 14, fan_speed: 70, drum_rpm: 60 },
	{ duration_sec: 240, mode: 'ramp', ror: 14, ror_end: 8, fan_speed: 60, drum_rpm: 58 },
	{ duration_sec: 120, mode: 'hold', ror: 8, ror_end: 8, fan_speed: 50, drum_rpm: 55 },
];

// newStep continues from the previous step's end so added steps start sensible.
export function newStep(prev?: Step): Step {
	const ror = prev ? (prev.mode === 'ramp' ? prev.ror_end : prev.ror) : 20;
	return {
		duration_sec: 120,
		mode: 'hold',
		ror,
		ror_end: ror,
		fan_speed: prev?.fan_speed ?? 70,
		drum_rpm: prev?.drum_rpm ?? 60,
	};
}

export function totalDuration(steps: Step[]): number {
	return steps.reduce((sum, s) => sum + Math.max(0, s.duration_sec), 0);
}

// stepBounds returns each step's [start, end) in elapsed seconds.
export function stepBounds(steps: Step[]): { start: number; end: number }[] {
	let acc = 0;
	return steps.map((s) => {
		const start = acc;
		acc += s.duration_sec;
		return { start, end: acc };
	});
}

// targetRorAt resolves the commanded ROR at an elapsed second, interpolating
// across ramp steps and holding the final value past the end of the program.
export function targetRorAt(steps: Step[], t: number): number {
	let acc = 0;
	for (const s of steps) {
		if (t < acc + s.duration_sec) {
			if (s.mode === 'ramp' && s.duration_sec > 0) {
				const f = (t - acc) / s.duration_sec;
				return s.ror + (s.ror_end - s.ror) * f;
			}
			return s.ror;
		}
		acc += s.duration_sec;
	}
	if (steps.length > 0) {
		const last = steps[steps.length - 1];
		return last.mode === 'ramp' ? last.ror_end : last.ror;
	}
	return 0;
}

export type PlanPoint = { t: number; temp: number };

// planPoints integrates the commanded ROR into the predicted temperature curve,
// one second at a time (matching the backend), emitting a point every
// `resolution` seconds to keep the path light.
export function planPoints(steps: Step[], resolution = 5): PlanPoint[] {
	const total = totalDuration(steps);
	if (total <= 0) return [];

	const pts: PlanPoint[] = [{ t: 0, temp: AMBIENT_C }];
	let temp = AMBIENT_C;
	for (let t = 1; t <= total; t++) {
		temp = Math.min(Math.max(temp + targetRorAt(steps, t) / 60, AMBIENT_C), MAX_C);
		if (t % resolution === 0 || t === total) pts.push({ t, temp });
	}
	return pts;
}

// predictedFinalTemp is where the program is expected to land.
export function predictedFinalTemp(steps: Step[]): number {
	const pts = planPoints(steps, 60);
	return pts.length ? pts[pts.length - 1].temp : AMBIENT_C;
}

// rorRange spans the commanded ROR values, for scaling the editor's ROR axis.
export function rorRange(steps: Step[]): { min: number; max: number } {
	const vals = steps.flatMap((s) => [s.ror, s.mode === 'ramp' ? s.ror_end : s.ror]);
	if (vals.length === 0) return { min: 0, max: 30 };
	return { min: Math.min(0, ...vals), max: Math.max(...vals, 10) };
}

export const STEP_MODES: StepMode[] = ['hold', 'ramp'];
