// live roast graph (3f). plots the drum-temperature time-series, scrolling left
// as the roast progresses so the newest reading rides ~85% across the widget.
// overlaid: elapsed time, rate of rise and estimated stage (upper-left) plus a
// completion progress bar (upper-right).

import { useMemo } from 'react';
import type { Status } from '../lib/api';
import type { Sample } from '../hooks/useRoaster';
import type { PlanPoint } from '../lib/profile';
import { useSettings } from '../lib/settings';
import { formatClock, formatRor } from '../lib/format';

// graph coordinate space (stretched to the container via preserveAspectRatio).
const VW = 1000;
const VH = 300;
const PAD_Y = 18;

const WINDOW_SEC = 120; // visible time span
const ANCHOR = 0.85; // newest sample rides here once the window is full
const TEMP_MIN = 0;
const TEMP_MAX = 240; // full-scale for the vertical axis, degrees C

const GRID_TEMPS = [50, 100, 150, 200];

// the card chrome lives on the surrounding console, so this renders bare and
// takes its height from `className` (fixed inline, flex-filled when expanded).
export default function Chart({
	status,
	samples,
	plan = [],
	className = '',
}: {
	status: Status | null;
	samples: Sample[];
	plan?: PlanPoint[];
	className?: string;
}) {
	const { settings } = useSettings();

	const elapsed = status?.elapsed_seconds ?? 0;
	const ror = status?.ror ?? 0;
	const stage = status?.stage ?? 'Idle';
	const progress = status?.progress ?? 0;

	const { line, area, target } = useMemo(
		() => buildPaths(samples, elapsed, plan),
		[samples, elapsed, plan],
	);
	const hasCurve = samples.length >= 2;

	const yFor = (temp: number) => {
		const frac = Math.min(Math.max((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0), 1);
		return PAD_Y + (1 - frac) * (VH - 2 * PAD_Y);
	};

	return (
		<div className={['relative flex flex-col overflow-hidden', className].join(' ')}>
			{/* overlay: readouts + progress */}
			<div className="z-10 flex items-start justify-between gap-4">
				<div className="flex flex-wrap gap-x-8 gap-y-2">
					<Readout label="Elapsed Time" value={formatClock(elapsed)} />
					<Readout label="ROR" value={formatRor(ror, settings.tempUnit)} />
					<Readout label="Estimated Stage" value={stage} />
				</div>
				<div className="flex min-w-[9rem] flex-col items-end gap-1">
					<span className="text-sm text-theme-muted">{progress}% Complete</span>
					<div className="h-2 w-36 overflow-hidden rounded-full bg-theme-border/60">
						<div
							className="h-full rounded-full bg-theme-accent transition-all duration-comfortable ease-quiet"
							style={{ width: `${progress}%` }}
						/>
					</div>
					{/* two series share this axis, so identity is carried by the dash
					    pattern as well as the hue -- never by colour alone. */}
					{target && (
						<div className="mt-1 flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.1em] text-theme-muted">
							<LegendKey label="Actual" className="text-theme-accent" />
							<LegendKey label="Target" className="text-theme-muted" dashed />
						</div>
					)}
				</div>
			</div>

			{/* graph */}
			<div className="relative mt-3 min-h-0 flex-1">
				<svg
					viewBox={`0 0 ${VW} ${VH}`}
					preserveAspectRatio="none"
					className="absolute inset-0 h-full w-full"
				>
					<defs>
						<linearGradient id="roast-fill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
							<stop offset="100%" stopColor="currentColor" stopOpacity="0" />
						</linearGradient>
					</defs>

					{/* horizontal gridlines */}
					{GRID_TEMPS.map((t) => (
						<line
							key={t}
							x1="0"
							x2={VW}
							y1={yFor(t)}
							y2={yFor(t)}
							stroke="currentColor"
							className="text-theme-border"
							strokeWidth="1"
							strokeOpacity="0.5"
							vectorEffect="non-scaling-stroke"
						/>
					))}

					{/* the profile's planned curve, behind the live trace */}
					{target && (
						<path
							d={target}
							className="text-theme-muted"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeDasharray="6 5"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
						/>
					)}

					{hasCurve && (
						<>
							<path d={area} className="text-theme-accent" fill="url(#roast-fill)" stroke="none" />
							<path
								d={line}
								className="text-theme-accent"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinejoin="round"
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
						</>
					)}
				</svg>

				{!hasCurve && (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="font-serif text-xl text-theme-muted">
							{status?.running ? 'Warming up…' : 'Start a roast to plot the curve'}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

function Readout({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="text-[0.65rem] uppercase tracking-[0.2em] text-theme-muted">{label}</div>
			<div className="mt-0.5 font-serif text-lg text-theme-accent">{value}</div>
		</div>
	);
}

function LegendKey({
	label,
	className,
	dashed,
}: {
	label: string;
	className: string;
	dashed?: boolean;
}) {
	return (
		<span className="flex items-center gap-1.5">
			<svg width="16" height="2" className={className} aria-hidden="true">
				<line
					x1="0"
					y1="1"
					x2="16"
					y2="1"
					stroke="currentColor"
					strokeWidth="2"
					strokeDasharray={dashed ? '4 3' : undefined}
				/>
			</svg>
			{label}
		</span>
	);
}

// buildPaths maps the live samples (and the profile's planned curve) into SVG
// paths, windowed so the newest reading sits at ANCHOR across the widget once
// enough time has passed. both series share one time+temperature scale.
function buildPaths(
	samples: Sample[],
	elapsed: number,
	plan: PlanPoint[],
): { line: string; area: string; target: string } {
	const lastT = samples.length ? samples[samples.length - 1].t : 0;
	const tNow = Math.max(elapsed, lastT);
	const leftT = Math.max(0, tNow - WINDOW_SEC * ANCHOR);
	const rightT = leftT + WINDOW_SEC;

	const x = (t: number) => ((t - leftT) / WINDOW_SEC) * VW;
	const y = (temp: number) => {
		const frac = Math.min(Math.max((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0), 1);
		return PAD_Y + (1 - frac) * (VH - 2 * PAD_Y);
	};

	const project = (pts: { t: number; temp: number }[]) =>
		pts
			.filter((p) => p.t >= leftT - 2 && p.t <= rightT + 2)
			.map((p) => ({ x: x(p.t), y: y(p.temp) }));
	const toPath = (pts: { x: number; y: number }[]) =>
		pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

	const targetPts = project(plan);
	const target = targetPts.length >= 2 ? toPath(targetPts) : '';

	const pts = project(samples);
	if (pts.length < 2) return { line: '', area: '', target };

	const line = toPath(pts);
	const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${VH} L ${pts[0].x.toFixed(1)} ${VH} Z`;
	return { line, area, target };
}
