// settings view. operator preferences persisted on the device: where the backend
// lives, how often to poll it, temperature units and theme. also a quick health
// check so you can confirm the tablet can actually reach the roaster.

import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../lib/settings';
import type { Settings } from '../lib/settings';
import { checkHealth } from '../lib/api';

const inputClass =
	'w-full rounded-design border border-theme-border bg-theme-subtle px-3 py-2 text-theme-foreground outline-none transition-colors focus:border-theme-accent';

type Health = 'checking' | 'ok' | 'down';

export default function SettingsPage() {
	const { settings, update, reset } = useSettings();
	const [health, setHealth] = useState<Health>('checking');

	const runHealth = useCallback(async () => {
		setHealth('checking');
		setHealth((await checkHealth(settings.backendUrl)) ? 'ok' : 'down');
	}, [settings.backendUrl]);

	useEffect(() => {
		runHealth();
	}, [runHealth]);

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-8">
			<div>
				<h1 className="font-serif text-3xl text-theme-foreground">Settings</h1>
				<p className="mt-1 text-sm text-theme-muted">Device preferences for this tablet.</p>
			</div>

			{/* connection */}
			<Panel title="Connection">
				<Row
					label="Backend URL"
					hint="Where the roaster backend is reachable from this device. /api routes through whichever host served this page — leave it unless the backend lives elsewhere."
				>
					<UrlField
						value={settings.backendUrl}
						onApply={(v) => update({ backendUrl: v })}
						placeholder="/api"
					/>
				</Row>

				<Row label="Status" hint="Live reachability of the backend.">
					<div className="flex items-center gap-3">
						<span
							className={[
								'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
								health === 'down'
									? 'border-theme-accent/60 text-theme-foreground'
									: health === 'ok'
										? 'border-theme-border text-theme-foreground'
										: 'border-theme-border text-theme-muted',
							].join(' ')}
						>
							<span
								className={[
									'h-2 w-2 rounded-full',
									health === 'ok'
										? 'bg-theme-foreground'
										: health === 'down'
											? 'bg-theme-accent'
											: 'bg-theme-muted',
								].join(' ')}
							/>
							{health === 'ok' ? 'Connected' : health === 'down' ? 'Unreachable' : 'Checking…'}
						</span>
						<button
							type="button"
							onClick={runHealth}
							className="rounded-full border border-theme-border px-4 py-1 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:text-theme-foreground"
						>
							Test
						</button>
					</div>
				</Row>

				<Row label="Poll Interval" hint="How often the dashboard refreshes live readings.">
					<ToggleGroup<number>
						value={settings.pollMs}
						onChange={(v) => update({ pollMs: v })}
						options={[
							{ value: 500, label: '0.5s' },
							{ value: 1000, label: '1s' },
							{ value: 2000, label: '2s' },
							{ value: 5000, label: '5s' },
						]}
					/>
				</Row>
			</Panel>

			{/* marketplace */}
			<Panel title="Marketplace">
				<Row
					label="Marketplace URL"
					hint="Where shared roast profiles are browsed from. The public service isn't live yet; this defaults to the stub catalog on your roaster backend."
				>
					<UrlField
						value={settings.marketplaceUrl}
						onApply={(v) => update({ marketplaceUrl: v })}
						placeholder="/api"
					/>
				</Row>
			</Panel>

			{/* display */}
			<Panel title="Display">
				<Row label="Temperature Unit">
					<ToggleGroup<Settings['tempUnit']>
						value={settings.tempUnit}
						onChange={(v) => update({ tempUnit: v })}
						options={[
							{ value: 'C', label: '°C' },
							{ value: 'F', label: '°F' },
						]}
					/>
				</Row>
				<Row label="Theme">
					<ToggleGroup<Settings['theme']>
						value={settings.theme}
						onChange={(v) => update({ theme: v })}
						options={[
							{ value: 'dark', label: 'Dark' },
							{ value: 'light', label: 'Light' },
						]}
					/>
				</Row>
			</Panel>

			<div>
				<button
					type="button"
					onClick={reset}
					className="rounded-full border border-theme-border px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-foreground"
				>
					Reset to defaults
				</button>
			</div>
		</div>
	);
}

// UrlField edits a URL locally and only commits on Apply, so a live-polling URL
// isn't rewritten on every keystroke.
function UrlField({
	value,
	onApply,
	placeholder,
}: {
	value: string;
	onApply: (v: string) => void;
	placeholder: string;
}) {
	const [draft, setDraft] = useState(value);

	// resync if the value changes elsewhere (e.g. Reset to defaults).
	useEffect(() => setDraft(value), [value]);

	const apply = () => onApply(draft.trim() || value);

	return (
		<div className="flex gap-2">
			<input
				className={inputClass}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => e.key === 'Enter' && apply()}
				placeholder={placeholder}
			/>
			<button
				type="button"
				onClick={apply}
				disabled={draft.trim() === value}
				className="shrink-0 rounded-full bg-theme-accent px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-accent-fg transition-transform hover:scale-[1.02] disabled:opacity-40"
			>
				Apply
			</button>
		</div>
	);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="rounded-design-lg border border-theme-border bg-theme-subtle p-6 shadow-xl shadow-black/10">
			<h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-theme-muted">{title}</h2>
			<div className="flex flex-col divide-y divide-theme-border">{children}</div>
		</section>
	);
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
			<div className="sm:max-w-[16rem]">
				<div className="text-sm font-medium text-theme-foreground">{label}</div>
				{hint && <div className="mt-0.5 text-xs text-theme-muted">{hint}</div>}
			</div>
			<div className="sm:min-w-[16rem] sm:text-right">{children}</div>
		</div>
	);
}

function ToggleGroup<T extends string | number>({
	value,
	onChange,
	options,
}: {
	value: T;
	onChange: (v: T) => void;
	options: { value: T; label: string }[];
}) {
	return (
		<div className="inline-flex rounded-full border border-theme-border p-1">
			{options.map((o) => (
				<button
					key={String(o.value)}
					type="button"
					onClick={() => onChange(o.value)}
					className={[
						'rounded-full px-4 py-1.5 text-sm transition-colors',
						o.value === value ? 'bg-theme-accent text-theme-accent-fg' : 'text-theme-muted hover:text-theme-foreground',
					].join(' ')}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}
