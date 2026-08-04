// roast program preview: what a profile's steps will actually do.
//
// two stacked panels share one time axis -- predicted temperature above, the
// commanded ROR program below. deliberately NOT one chart with two y-scales:
// temperature (C) and rate of rise (C/min) are different measures, and stacked
// single-series panels stay honest and readable. each panel has one series, so
// its title names it and no legend is needed.

import type { Step } from '../lib/api';
import { planPoints, stepBounds, totalDuration, rorRange } from '../lib/profile';
import { formatClock } from '../lib/format';

const VW = 1000;
const TEMP_H = 200;
const ROR_H = 120;
const PAD = 14;

const TEMP_MAX = 240;
const TEMP_GRID = [50, 100, 150, 200];

export default function ProfilePlanChart({ steps }: { steps: Step[] }) {
	const total = totalDuration(steps);
	const bounds = stepBounds(steps);

	if (total <= 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-design-lg border border-theme-border bg-theme-subtle">
				<span className="text-sm text-theme-muted">Add a step to preview the program.</span>
			</div>
		);
	}

	const x = (t: number) => (t / total) * VW;

	// predicted temperature curve
	const tempY = (temp: number) =>
		PAD + (1 - Math.min(Math.max(temp / TEMP_MAX, 0), 1)) * (TEMP_H - 2 * PAD);
	const tempPath = planPoints(steps, 5)
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${tempY(p.temp).toFixed(1)}`)
		.join(' ');

	// commanded ROR program: flat across a hold, sloped across a ramp, and a
	// vertical jump wherever consecutive steps disagree.
	const { min: rMin, max: rMax } = rorRange(steps);
	const span = Math.max(rMax - rMin, 1);
	const rorY = (v: number) => PAD + (1 - (v - rMin) / span) * (ROR_H - 2 * PAD);
	const rorPts = steps.flatMap((s, i) => [
		{ t: bounds[i].start, v: s.ror },
		{ t: bounds[i].end, v: s.mode === 'ramp' ? s.ror_end : s.ror },
	]);
	const rorPath = rorPts
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${rorY(p.v).toFixed(1)}`)
		.join(' ');

	return (
		<div className="flex flex-col gap-1 rounded-design-lg border border-theme-border bg-theme-subtle p-4">
			<Panel title="Predicted Temperature" unit="°C" height={TEMP_H}>
				{TEMP_GRID.map((t) => (
					<g key={t}>
						<line
							x1="0"
							x2={VW}
							y1={tempY(t)}
							y2={tempY(t)}
							stroke="currentColor"
							className="text-theme-border"
							strokeOpacity="0.5"
							vectorEffect="non-scaling-stroke"
						/>
					</g>
				))}
				<StepBands bounds={bounds} x={x} height={TEMP_H} />
				<path
					d={tempPath}
					className="text-theme-accent"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
				/>
			</Panel>

			<Panel title="Commanded Rate of Rise" unit="°C/min" height={ROR_H}>
				<StepBands bounds={bounds} x={x} height={ROR_H} />
				<line
					x1="0"
					x2={VW}
					y1={rorY(0)}
					y2={rorY(0)}
					stroke="currentColor"
					className="text-theme-border"
					vectorEffect="non-scaling-stroke"
				/>
				<path
					d={rorPath}
					className="text-theme-foreground"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
				/>
			</Panel>

			{/* shared time axis */}
			<div className="relative mt-1 h-4">
				{bounds.map((b, i) => (
					<span
						key={i}
						className="absolute -translate-x-1/2 text-[0.6rem] tabular-nums text-theme-muted"
						style={{ left: `${(b.end / total) * 100}%` }}
					>
						{formatClock(b.end)}
					</span>
				))}
				<span className="absolute left-0 text-[0.6rem] tabular-nums text-theme-muted">0:00</span>
			</div>
		</div>
	);
}

function Panel({
	title,
	unit,
	height,
	children,
}: {
	title: string;
	unit: string;
	height: number;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-baseline justify-between">
				<span className="text-[0.65rem] uppercase tracking-[0.2em] text-theme-muted">{title}</span>
				<span className="text-[0.6rem] text-theme-muted">{unit}</span>
			</div>
			<svg
				viewBox={`0 0 ${VW} ${height}`}
				preserveAspectRatio="none"
				className="h-full w-full"
				style={{ height }}
			>
				{children}
			</svg>
		</div>
	);
}

// StepBands shades alternating steps so segment boundaries are readable without
// relying on the line alone.
function StepBands({
	bounds,
	x,
	height,
}: {
	bounds: { start: number; end: number }[];
	x: (t: number) => number;
	height: number;
}) {
	return (
		<>
			{bounds.map((b, i) =>
				i % 2 === 1 ? (
					<rect
						key={i}
						x={x(b.start)}
						y="0"
						width={x(b.end) - x(b.start)}
						height={height}
						className="text-theme-border"
						fill="currentColor"
						fillOpacity="0.18"
					/>
				) : null,
			)}
		</>
	);
}
