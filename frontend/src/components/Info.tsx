// drum "gauge cluster": an arc gauge for live drum temperature plus a row of
// secondary readouts (fan speed, drum rpm, heat level). fed by /status (3a).

import type { Status } from '../lib/api';
import { useSettings } from '../lib/settings';
import { formatTemp } from '../lib/format';

const TEMP_MIN = 0;
const TEMP_MAX = 250; // full-scale for the gauge arc

// 270-degree arc with the gap at the bottom.
const R = 86;
const CIRC = 2 * Math.PI * R;
const ARC_FRACTION = 0.75; // portion of the ring the gauge spans

type StatItem = { label: string; value: string };

export default function Info({ status }: { status: Status | null }) {
	const { settings } = useSettings();
	const temp = status?.temperature ?? 0;
	const fraction = Math.min(Math.max((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0), 1);

	const stage = status?.stage ?? 'Idle';
	const running = status?.running ?? false;

	const stats: StatItem[] = [
		{ label: 'Fan Speed', value: status ? `${status.fan_speed}%` : '--' },
		{ label: 'Drum RPM', value: status ? `${status.drum_rpm}` : '--' },
		{ label: 'Heat Level', value: status?.heat_level ?? '--' },
	];

	return (
		<section className="flex h-full flex-col rounded-design-lg border border-theme-border bg-theme-subtle p-6 shadow-xl shadow-black/10">
			<h2 className="text-xs uppercase tracking-[0.2em] text-theme-muted">Drum Temperature</h2>

			{/* gauge */}
			<div className="flex flex-1 items-center justify-center py-4">
				<div className="relative aspect-square w-full max-w-[15rem]">
					<svg viewBox="0 0 200 200" className="h-full w-full rotate-[135deg]">
						{/* track */}
						<circle
							cx="100"
							cy="100"
							r={R}
							fill="none"
							stroke="currentColor"
							className="text-theme-border"
							strokeWidth="7"
							strokeLinecap="round"
							strokeDasharray={`${ARC_FRACTION * CIRC} ${CIRC}`}
						/>
						{/* value */}
						<circle
							cx="100"
							cy="100"
							r={R}
							fill="none"
							stroke="currentColor"
							className="text-theme-foreground transition-all duration-comfortable ease-quiet"
							strokeWidth="7"
							strokeLinecap="round"
							strokeDasharray={`${fraction * ARC_FRACTION * CIRC} ${CIRC}`}
						/>
					</svg>

					{/* centered readout */}
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
						<div className="text-center">
							<div className="text-[0.65rem] uppercase tracking-[0.2em] text-theme-muted">Drum Temp</div>
							<div className="font-serif text-5xl leading-none text-theme-foreground">
								{formatTemp(temp, settings.tempUnit)}
							</div>
						</div>
						<StatusPill running={running} stage={stage} />
					</div>
				</div>
			</div>

			{/* secondary readouts */}
			<div className="grid grid-cols-3 divide-x divide-theme-border">
				{stats.map((s) => (
					<div key={s.label} className="px-2 text-center">
						<div className="text-[0.65rem] uppercase tracking-[0.15em] text-theme-muted">{s.label}</div>
						<div className="mt-1 font-medium text-theme-foreground">{s.value}</div>
					</div>
				))}
			</div>
		</section>
	);
}

function StatusPill({ running, stage }: { running: boolean; stage: string }) {
	const label = running ? stage : stage === 'Cooling' ? 'Cooling' : 'Idle';
	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-page/40 px-3 py-1 text-sm text-theme-foreground">
			<span
				className={[
					'h-2 w-2 rounded-full',
					running ? 'animate-pulse bg-theme-accent' : 'bg-theme-muted',
				].join(' ')}
			/>
			{label}
		</span>
	);
}
