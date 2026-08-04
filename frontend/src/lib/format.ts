// small display formatters shared across widgets.

import type { TempUnit } from './settings';

export function formatTemp(celsius: number, unit: TempUnit): string {
	const value = unit === 'F' ? celsius * 1.8 + 32 : celsius;
	return `${Math.round(value)}°${unit}`;
}

// seconds as mm:ss, e.g. 516 -> "08:36".
export function formatClock(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const mm = Math.floor(s / 60)
		.toString()
		.padStart(2, '0');
	const ss = (s % 60).toString().padStart(2, '0');
	return `${mm}:${ss}`;
}

export function formatRor(ror: number, unit: TempUnit): string {
	// ROR is a delta, so only the scale changes between C and F, not the offset.
	const value = unit === 'F' ? ror * 1.8 : ror;
	const sign = value >= 0 ? '+' : '';
	return `${sign}${value.toFixed(1)} °${unit}/min`;
}

// compact human label, e.g. 720 -> "12 min".
export function formatDuration(totalSeconds: number): string {
	const m = Math.round(totalSeconds / 60);
	return `${m} min`;
}
