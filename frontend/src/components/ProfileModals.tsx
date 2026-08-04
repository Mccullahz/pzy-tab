// load + save profile modals. both fetch the current profile list from the
// backend when opened so they always reflect what's stored.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import * as api from '../lib/api';
import type { Profile } from '../lib/api';
import { useSettings } from '../lib/settings';
import { formatDuration } from '../lib/format';
import { DEFAULT_STEPS, totalDuration } from '../lib/profile';
import { CheckIcon } from './icons';

const inputClass =
	'w-full rounded-design border border-theme-border bg-theme-page/40 px-3 py-2 text-theme-foreground outline-none transition-colors focus:border-theme-accent';

// --- Load ------------------------------------------------------------------

type LoadProps = {
	open: boolean;
	onClose: () => void;
	onLoad: (name: string) => Promise<void> | void;
	activeName?: string;
};

export function LoadProfileModal({ open, onClose, onLoad, activeName }: LoadProps) {
	const { settings } = useSettings();
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setError(null);
		api.getProfiles(settings.backendUrl).then(setProfiles).catch(() => setError('Could not reach the roaster.'));
	}, [open, settings.backendUrl]);

	const choose = async (name: string) => {
		setBusy(name);
		setError(null);
		try {
			await onLoad(name);
			onClose();
		} catch {
			setError('Failed to load that profile.');
		} finally {
			setBusy(null);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title="Load Profile">
			{error && <p className="mb-3 text-sm text-theme-accent">{error}</p>}
			<div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
				{profiles.length === 0 && !error && (
					<p className="py-8 text-center text-sm text-theme-muted">No saved profiles yet.</p>
				)}
				{profiles.map((p) => {
					const isActive = p.name === activeName;
					return (
						<button
							key={p.name}
							type="button"
							disabled={busy !== null}
							onClick={() => choose(p.name)}
							className={[
								'flex items-center justify-between gap-4 rounded-design border px-4 py-3 text-left transition-all',
								isActive ? 'border-theme-accent bg-theme-page/40' : 'border-theme-border hover:border-theme-accent',
								busy !== null ? 'opacity-60' : '',
							].join(' ')}
						>
							<div>
								<div className="font-serif text-lg text-theme-foreground">{p.name}</div>
								<div className="text-sm text-theme-muted">
									{p.roast_level} • {p.target_weight} • {formatDuration(p.duration_sec)} •{' '}
									{p.steps?.length ?? 0} steps
								</div>
							</div>
							{isActive && <CheckIcon className="h-5 w-5 shrink-0 text-theme-accent" />}
						</button>
					);
				})}
			</div>
		</Modal>
	);
}

// --- Save ------------------------------------------------------------------

type SaveProps = {
	open: boolean;
	onClose: () => void;
	activeProfile: Profile | null;
	onSaved?: () => void;
};

type FormState = { name: string; roast_level: string; target_weight: string };

const EMPTY: FormState = { name: '', roast_level: '', target_weight: '' };

export function SaveProfileModal({ open, onClose, activeProfile, onSaved }: SaveProps) {
	const { settings } = useSettings();
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [form, setForm] = useState<FormState>(EMPTY);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// the program being saved: whatever the roaster is currently set to run.
	const steps = activeProfile?.steps?.length ? activeProfile.steps : DEFAULT_STEPS;

	useEffect(() => {
		if (!open) return;
		setError(null);
		api.getProfiles(settings.backendUrl).then(setProfiles).catch(() => setProfiles([]));
		setForm(
			activeProfile
				? {
						name: activeProfile.name,
						roast_level: activeProfile.roast_level,
						target_weight: activeProfile.target_weight,
					}
				: EMPTY,
		);
	}, [open, activeProfile, settings.backendUrl]);

	const trimmedName = form.name.trim();
	const willOverwrite = profiles.some((p) => p.name === trimmedName);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!trimmedName) return;
		setBusy(true);
		setError(null);
		try {
			await api.saveProfile(settings.backendUrl, {
				name: trimmedName,
				roast_level: form.roast_level.trim(),
				target_weight: form.target_weight.trim(),
				steps,
				duration_sec: 0, // derived server-side from the steps
			});
			onSaved?.();
			onClose();
		} catch {
			setError('Failed to save the profile.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title="Save Profile">
			<form onSubmit={submit} className="flex flex-col gap-4">
				{/* what's actually being saved -- the program, not just the label. */}
				<div className="rounded-design border border-theme-border bg-theme-page/40 px-4 py-3 text-sm">
					<span className="text-theme-muted">Saving the active program: </span>
					<span className="text-theme-foreground">
						{steps.length} steps • {formatDuration(totalDuration(steps))}
					</span>
					<Link to="/profiles" onClick={onClose} className="ml-2 text-theme-accent hover:underline">
						Edit steps
					</Link>
				</div>

				{profiles.length > 0 && (
					<div>
						<div className="mb-2 text-xs uppercase tracking-[0.15em] text-theme-muted">Overwrite existing</div>
						<div className="flex flex-wrap gap-2">
							{profiles.map((p) => (
								<button
									key={p.name}
									type="button"
									onClick={() => setForm((f) => ({ ...f, name: p.name }))}
									className="rounded-full border border-theme-border px-3 py-1 text-sm text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-foreground"
								>
									{p.name}
								</button>
							))}
						</div>
					</div>
				)}

				<label className="flex flex-col gap-1">
					<span className="text-xs uppercase tracking-[0.15em] text-theme-muted">Profile Name</span>
					<input
						className={inputClass}
						value={form.name}
						onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
						placeholder="e.g. Colombia Huila"
						autoFocus
					/>
				</label>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label className="flex flex-col gap-1">
						<span className="text-xs uppercase tracking-[0.15em] text-theme-muted">Roast Level</span>
						<input
							className={inputClass}
							value={form.roast_level}
							onChange={(e) => setForm((f) => ({ ...f, roast_level: e.target.value }))}
							placeholder="AG:70-75"
						/>
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-xs uppercase tracking-[0.15em] text-theme-muted">Target Weight</span>
						<input
							className={inputClass}
							value={form.target_weight}
							onChange={(e) => setForm((f) => ({ ...f, target_weight: e.target.value }))}
							placeholder="2.5KG"
						/>
					</label>
				</div>

				{error && <p className="text-sm text-theme-accent">{error}</p>}

				<div className="flex items-center justify-between gap-4 pt-2">
					<span className="text-sm text-theme-muted">
						{willOverwrite ? `Overwrites "${trimmedName}".` : 'Saved as a new profile.'}
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-full border border-theme-border px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:text-theme-foreground"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={busy || !trimmedName}
							className="rounded-full bg-theme-accent px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-accent-fg transition-transform hover:scale-[1.02] disabled:opacity-50"
						>
							{busy ? 'Saving…' : 'Save'}
						</button>
					</div>
				</div>
			</form>
		</Modal>
	);
}
