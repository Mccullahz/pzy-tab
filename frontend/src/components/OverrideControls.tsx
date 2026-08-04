// manual override controls: nudge what the roaster is doing mid-roast without
// editing the profile. an overridden value stops following the program until it
// is handed back to Auto. overrides are cleared when a new roast starts, so the
// program is always the starting point.
//
// rendered bare (no card chrome) -- RoastConsole composes these above the graph.

import type { OverrideParam, OverridePatch, Status } from '../lib/api';
import { useSettings } from '../lib/settings';
import { formatRor } from '../lib/format';

type Props = {
	status: Status | null;
	onSet: (patch: OverridePatch) => Promise<void> | void;
	onClear: (param: OverrideParam) => Promise<void> | void;
};

// anyManual reports whether the operator has taken over any value.
export function anyManual(status: Status | null): boolean {
	const ov = status?.overrides;
	return !!(ov && (ov.ror !== null || ov.fan_speed !== null || ov.drum_rpm !== null));
}

export default function OverrideControls({ status, onSet, onClear }: Props) {
	const { settings } = useSettings();
	const running = status?.running ?? false;
	const ov = status?.overrides;

	const ror = status?.target_ror ?? 0;
	const fan = status?.fan_speed ?? 0;
	const drum = status?.drum_rpm ?? 0;

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<Control
				label="Target ROR"
				value={formatRor(ror, settings.tempUnit).replace(` °${settings.tempUnit}/min`, '')}
				unit={`°${settings.tempUnit}/min`}
				manual={ov?.ror != null}
				disabled={!running}
				onStep={(d) => onSet({ ror: round1(ror + d) })}
				onAuto={() => onClear('ror')}
				step={1}
			/>
			<Control
				label="Fan Speed"
				value={String(fan)}
				unit="%"
				manual={ov?.fan_speed != null}
				disabled={!running}
				onStep={(d) => onSet({ fan_speed: clamp(fan + d, 0, 100) })}
				onAuto={() => onClear('fan_speed')}
				step={5}
			/>
			<Control
				label="Drum Speed"
				value={String(drum)}
				unit="RPM"
				manual={ov?.drum_rpm != null}
				disabled={!running}
				onStep={(d) => onSet({ drum_rpm: clamp(drum + d, 0, 200) })}
				onAuto={() => onClear('drum_rpm')}
				step={1}
			/>
		</div>
	);
}

function Control({
	label,
	value,
	unit,
	manual,
	disabled,
	step,
	onStep,
	onAuto,
}: {
	label: string;
	value: string;
	unit: string;
	manual: boolean;
	disabled: boolean;
	step: number;
	onStep: (delta: number) => void;
	onAuto: () => void;
}) {
	return (
		<div
			className={[
				'flex items-center justify-between gap-3 rounded-design border px-3 py-2 transition-opacity',
				manual ? 'border-theme-accent' : 'border-theme-border',
				disabled ? 'opacity-50' : '',
			].join(' ')}
		>
			<div className="min-w-0">
				<div className="text-[0.6rem] uppercase tracking-[0.15em] text-theme-muted">{label}</div>
				<div className="font-serif text-2xl tabular-nums text-theme-foreground">
					{value}
					<span className="ml-1 text-xs text-theme-muted">{unit}</span>
				</div>
				{manual ? (
					<button
						type="button"
						onClick={onAuto}
						disabled={disabled}
						className="text-[0.6rem] uppercase tracking-[0.15em] text-theme-accent hover:underline"
					>
						Manual · back to auto
					</button>
				) : (
					<span className="text-[0.6rem] uppercase tracking-[0.15em] text-theme-muted">Following profile</span>
				)}
			</div>

			<div className="flex shrink-0 gap-1">
				<StepButton label={`Decrease ${label}`} disabled={disabled} onClick={() => onStep(-step)}>
					–
				</StepButton>
				<StepButton label={`Increase ${label}`} disabled={disabled} onClick={() => onStep(step)}>
					+
				</StepButton>
			</div>
		</div>
	);
}

function StepButton({
	children,
	label,
	disabled,
	onClick,
}: {
	children: React.ReactNode;
	label: string;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className="h-11 w-11 rounded-full border border-theme-border text-lg text-theme-foreground transition-colors hover:border-theme-accent disabled:opacity-40"
		>
			{children}
		</button>
	);
}

function clamp(v: number, lo: number, hi: number) {
	return Math.min(Math.max(v, lo), hi);
}

function round1(v: number) {
	return Math.round(v * 10) / 10;
}
