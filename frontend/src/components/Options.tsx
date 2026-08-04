// right-hand control column: start/stop the roast (3b), open the load (3c) and
// save (3d) profile modals, and show the active profile (3e).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Status } from '../lib/api';
import { LoadProfileModal, SaveProfileModal } from './ProfileModals';
import { PlayIcon, PauseIcon, FolderIcon, BookmarkIcon, InfoIcon } from './icons';

type OptionsProps = {
	status: Status | null;
	onStart: () => Promise<void> | void;
	onStop: () => Promise<void> | void;
	onLoad: (name: string) => Promise<void> | void;
};

export default function Options({ status, onStart, onStop, onLoad }: OptionsProps) {
	const [loadOpen, setLoadOpen] = useState(false);
	const [saveOpen, setSaveOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	const running = status?.running ?? false;
	const active = status?.active_profile ?? null;

	const toggle = async () => {
		setBusy(true);
		try {
			await (running ? onStop() : onStart());
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="flex h-full flex-col gap-4">
			{/* start / stop. both states use the rose accent; a roast in progress reads
			    as the solid fill plus the pulsing ring, not a different hue. */}
			<button
				type="button"
				onClick={toggle}
				disabled={busy}
				className={[
					'relative flex min-h-[120px] items-center justify-center gap-4 rounded-design-lg border p-6 shadow-xl shadow-black/10',
					'font-serif text-4xl font-bold uppercase tracking-wide transition-all duration-comfortable ease-quiet hover:scale-[1.01] disabled:opacity-70',
					running
						? 'border-theme-accent bg-theme-accent text-theme-accent-fg'
						: 'border-theme-accent bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20',
				].join(' ')}
			>
				{running && (
					<span
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 animate-pulse rounded-design-lg ring-2 ring-theme-accent/50 ring-offset-2 ring-offset-theme-page"
					/>
				)}
				{running ? <PauseIcon className="h-9 w-9" /> : <PlayIcon className="h-9 w-9" />}
				{running ? 'Stop Roast' : 'Start Roast'}
			</button>

			{/* load / save */}
			<div className="grid grid-cols-2 gap-4">
				<ActionCard label="Load Profile" onClick={() => setLoadOpen(true)}>
					<FolderIcon className="h-8 w-8" />
				</ActionCard>
				<ActionCard label="Save Profile" onClick={() => setSaveOpen(true)}>
					<BookmarkIcon className="h-8 w-8" />
				</ActionCard>
			</div>

			{/* active profile */}
			<div className="flex flex-1 flex-col justify-center rounded-design-lg border border-theme-border bg-theme-subtle p-5 shadow-xl shadow-black/10">
				<div className="flex items-start justify-between gap-3">
					<span className="text-xs uppercase tracking-[0.2em] text-theme-muted">Active Profile</span>
					<Link
						to="/profiles"
						aria-label="Open profiles"
						className="rounded-full border border-theme-border p-1 text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-foreground"
					>
						<InfoIcon className="h-5 w-5" />
					</Link>
				</div>

				{active ? (
					<>
						<h3 className="mt-1 font-serif text-2xl text-theme-foreground">{active.name}</h3>
						<hr className="my-2 border-t border-theme-border" />
						<p className="text-sm text-theme-muted">
							{active.roast_level} • {active.target_weight} Target
						</p>
					</>
				) : (
					<>
						<h3 className="mt-1 font-serif text-2xl text-theme-muted">No profile selected</h3>
						<hr className="my-2 border-t border-theme-border" />
						<button
							type="button"
							onClick={() => setLoadOpen(true)}
							className="self-start text-sm text-theme-accent underline-offset-2 hover:underline"
						>
							Load a profile
						</button>
					</>
				)}
			</div>

			<LoadProfileModal
				open={loadOpen}
				onClose={() => setLoadOpen(false)}
				onLoad={onLoad}
				activeName={active?.name}
			/>
			<SaveProfileModal open={saveOpen} onClose={() => setSaveOpen(false)} activeProfile={active} />
		</section>
	);
}

function ActionCard({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-design-lg border border-theme-border bg-theme-elevated p-4 text-theme-foreground shadow-xl shadow-black/10 transition-all duration-comfortable ease-quiet hover:-translate-y-1 hover:border-theme-accent"
		>
			{children}
			<span className="text-xs uppercase tracking-[0.2em] text-theme-muted">{label}</span>
		</button>
	);
}
