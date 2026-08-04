// profile editor: build the roast program the roaster will execute.
//
// each step holds or ramps a target ROR while commanding a fan speed and drum
// rpm for its slice of the roast. the preview chart re-renders as you type, so
// you can see the resulting curve before committing.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as api from '../lib/api';
import type { Step, StepMode } from '../lib/api';
import { useSettings } from '../lib/settings';
import { DEFAULT_STEPS, newStep, totalDuration, predictedFinalTemp } from '../lib/profile';
import { formatClock, formatTemp } from '../lib/format';
import ProfilePlanChart from '../components/ProfilePlanChart';
import { PlusIcon, TrashIcon } from '../components/icons';

const inputClass =
	'w-full rounded-design border border-theme-border bg-theme-page/40 px-3 py-2 text-theme-foreground outline-none transition-colors focus:border-theme-accent';
const cellClass =
	'w-full rounded-design border border-theme-border bg-theme-page/40 px-2 py-2 text-center tabular-nums text-theme-foreground outline-none transition-colors focus:border-theme-accent';

type Form = {
	name: string;
	roast_level: string;
	target_weight: string;
	steps: Step[];
};

export default function ProfileEditor() {
	const { name: routeName } = useParams();
	const navigate = useNavigate();
	const { settings } = useSettings();
	const isNew = !routeName;

	const [form, setForm] = useState<Form>({
		name: '',
		roast_level: '',
		target_weight: '',
		steps: DEFAULT_STEPS,
	});
	const [loading, setLoading] = useState(!isNew);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (isNew) return;
		let alive = true;
		api
			.getProfiles(settings.backendUrl)
			.then((ps) => {
				if (!alive) return;
				const p = ps.find((x) => x.name === routeName);
				if (!p) {
					setError(`No profile named "${routeName}".`);
					return;
				}
				setForm({
					name: p.name,
					roast_level: p.roast_level,
					target_weight: p.target_weight,
					steps: p.steps,
				});
			})
			.catch(() => alive && setError('Could not reach the roaster.'))
			.finally(() => alive && setLoading(false));
		return () => {
			alive = false;
		};
	}, [isNew, routeName, settings.backendUrl]);

	const patchStep = useCallback((i: number, patch: Partial<Step>) => {
		setForm((f) => ({
			...f,
			steps: f.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
		}));
	}, []);

	const setMode = (i: number, mode: StepMode) =>
		// leaving ramp pins the end value back to the start so the row can't keep a
		// stale, invisible ror_end.
		patchStep(i, mode === 'hold' ? { mode, ror_end: form.steps[i].ror } : { mode });

	const addStep = () =>
		setForm((f) => ({ ...f, steps: [...f.steps, newStep(f.steps[f.steps.length - 1])] }));

	const removeStep = (i: number) =>
		setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));

	const moveStep = (i: number, dir: -1 | 1) =>
		setForm((f) => {
			const j = i + dir;
			if (j < 0 || j >= f.steps.length) return f;
			const steps = [...f.steps];
			[steps[i], steps[j]] = [steps[j], steps[i]];
			return { ...f, steps };
		});

	const trimmed = form.name.trim();
	const canSave = trimmed.length > 0 && form.steps.length > 0 && !saving;

	const save = async () => {
		if (!canSave) return;
		setSaving(true);
		setError(null);
		try {
			await api.saveProfile(settings.backendUrl, {
				name: trimmed,
				roast_level: form.roast_level.trim(),
				target_weight: form.target_weight.trim(),
				steps: form.steps,
				duration_sec: 0, // derived server-side from the steps
			});
			// an edit that changes the name is a rename: the save created a new
			// profile, so drop the one it replaced.
			if (!isNew && routeName && routeName !== trimmed) {
				await api.deleteProfile(settings.backendUrl, routeName);
			}
			navigate('/profiles');
		} catch {
			setError('Failed to save the profile.');
			setSaving(false);
		}
	};

	if (loading) return <p className="text-sm text-theme-muted">Loading…</p>;

	const total = totalDuration(form.steps);

	return (
		<div className="flex flex-col gap-6">
			{/* header */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-serif text-3xl text-theme-foreground">
						{isNew ? 'New Profile' : 'Edit Profile'}
					</h1>
					<p className="mt-1 text-sm text-theme-muted">
						Each step holds or ramps a target rate of rise while commanding fan and drum.
					</p>
				</div>
				<div className="flex gap-2">
					<Link
						to="/profiles"
						className="rounded-full border border-theme-border px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:text-theme-foreground"
					>
						Cancel
					</Link>
					<button
						type="button"
						onClick={save}
						disabled={!canSave}
						className="rounded-full bg-theme-accent px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-accent-fg transition-transform hover:scale-[1.02] disabled:opacity-40"
					>
						{saving ? 'Saving…' : 'Save Profile'}
					</button>
				</div>
			</div>

			{error && <p className="text-sm text-theme-accent">{error}</p>}

			{/* metadata */}
			<section className="grid grid-cols-1 gap-4 rounded-design-lg border border-theme-border bg-theme-subtle p-5 sm:grid-cols-3">
				<Field label="Profile Name">
					<input
						className={inputClass}
						value={form.name}
						onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
						placeholder="e.g. Colombia Huila"
					/>
				</Field>
				<Field label="Roast Level">
					<input
						className={inputClass}
						value={form.roast_level}
						onChange={(e) => setForm((f) => ({ ...f, roast_level: e.target.value }))}
						placeholder="AG:70-75"
					/>
				</Field>
				<Field label="Target Weight">
					<input
						className={inputClass}
						value={form.target_weight}
						onChange={(e) => setForm((f) => ({ ...f, target_weight: e.target.value }))}
						placeholder="2.5KG"
					/>
				</Field>
			</section>

			{/* summary + preview */}
			<div className="grid grid-cols-3 gap-4">
				<Summary label="Total Time" value={formatClock(total)} />
				<Summary label="Steps" value={String(form.steps.length)} />
				<Summary
					label="Predicted Finish"
					value={formatTemp(predictedFinalTemp(form.steps), settings.tempUnit)}
				/>
			</div>

			<ProfilePlanChart steps={form.steps} />

			{/* steps */}
			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-xs uppercase tracking-[0.2em] text-theme-muted">Steps</h2>
					<button
						type="button"
						onClick={addStep}
						className="inline-flex items-center gap-2 rounded-full border border-theme-border px-4 py-1.5 text-sm uppercase tracking-[0.15em] text-theme-foreground transition-colors hover:border-theme-accent"
					>
						<PlusIcon className="h-4 w-4" />
						Add Step
					</button>
				</div>

				<div className="overflow-x-auto">
					<div className="min-w-[52rem]">
						{/* column headers */}
						<div className="grid grid-cols-[2rem_7rem_9rem_6rem_6rem_6rem_6rem_5rem] items-end gap-2 px-1 pb-2">
							<Head>#</Head>
							<Head>Duration</Head>
							<Head>Mode</Head>
							<Head>ROR Start</Head>
							<Head>ROR End</Head>
							<Head>Fan %</Head>
							<Head>Drum RPM</Head>
							<Head> </Head>
						</div>

						<div className="flex flex-col gap-2">
							{form.steps.map((s, i) => (
								<div
									key={i}
									className="grid grid-cols-[2rem_7rem_9rem_6rem_6rem_6rem_6rem_5rem] items-center gap-2 rounded-design border border-theme-border bg-theme-subtle p-2"
								>
									<span className="text-center text-sm tabular-nums text-theme-muted">{i + 1}</span>

									<div>
										<input
											type="number"
											min={1}
											className={cellClass}
											value={s.duration_sec}
											onChange={(e) => patchStep(i, { duration_sec: Number(e.target.value) })}
										/>
										<div className="mt-0.5 text-center text-[0.6rem] tabular-nums text-theme-muted">
											{formatClock(s.duration_sec)}
										</div>
									</div>

									<ModeToggle mode={s.mode} onChange={(m) => setMode(i, m)} />

									<input
										type="number"
										className={cellClass}
										value={s.ror}
										onChange={(e) => {
											const ror = Number(e.target.value);
											patchStep(i, s.mode === 'hold' ? { ror, ror_end: ror } : { ror });
										}}
									/>

									<input
										type="number"
										disabled={s.mode === 'hold'}
										className={`${cellClass} disabled:opacity-40`}
										value={s.ror_end}
										onChange={(e) => patchStep(i, { ror_end: Number(e.target.value) })}
									/>

									<input
										type="number"
										min={0}
										max={100}
										className={cellClass}
										value={s.fan_speed}
										onChange={(e) => patchStep(i, { fan_speed: Number(e.target.value) })}
									/>

									<input
										type="number"
										min={0}
										className={cellClass}
										value={s.drum_rpm}
										onChange={(e) => patchStep(i, { drum_rpm: Number(e.target.value) })}
									/>

									<div className="flex items-center justify-end gap-1">
										<IconBtn label="Move step up" onClick={() => moveStep(i, -1)} disabled={i === 0}>
											↑
										</IconBtn>
										<IconBtn
											label="Move step down"
											onClick={() => moveStep(i, 1)}
											disabled={i === form.steps.length - 1}
										>
											↓
										</IconBtn>
										<button
											type="button"
											aria-label="Remove step"
											onClick={() => removeStep(i)}
											disabled={form.steps.length === 1}
											className="rounded-full border border-theme-border p-1.5 text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-accent disabled:opacity-30"
										>
											<TrashIcon className="h-4 w-4" />
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

function Head({ children }: { children: React.ReactNode }) {
	return <span className="text-[0.6rem] uppercase tracking-[0.15em] text-theme-muted">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1">
			<span className="text-xs uppercase tracking-[0.15em] text-theme-muted">{label}</span>
			{children}
		</label>
	);
}

function Summary({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-design-lg border border-theme-border bg-theme-subtle p-4 text-center">
			<div className="text-[0.65rem] uppercase tracking-[0.2em] text-theme-muted">{label}</div>
			<div className="mt-1 font-serif text-2xl text-theme-foreground">{value}</div>
		</div>
	);
}

function ModeToggle({ mode, onChange }: { mode: StepMode; onChange: (m: StepMode) => void }) {
	return (
		<div className="inline-flex rounded-full border border-theme-border p-0.5">
			{(['hold', 'ramp'] as StepMode[]).map((m) => (
				<button
					key={m}
					type="button"
					onClick={() => onChange(m)}
					className={[
						'flex-1 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.1em] transition-colors',
						m === mode ? 'bg-theme-accent text-theme-accent-fg' : 'text-theme-muted hover:text-theme-foreground',
					].join(' ')}
				>
					{m}
				</button>
			))}
		</div>
	);
}

function IconBtn({
	children,
	label,
	onClick,
	disabled,
}: {
	children: React.ReactNode;
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			disabled={disabled}
			className="rounded-full border border-theme-border px-2 py-1 text-xs text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-foreground disabled:opacity-30"
		>
			{children}
		</button>
	);
}
