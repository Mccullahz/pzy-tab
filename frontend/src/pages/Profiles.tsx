// profiles view. browse, load, edit and delete saved roast programs, import from
// the marketplace, or create a new one. loading a profile makes it the program
// the roaster will execute on the next roast.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import type { Profile } from '../lib/api';
import { useSettings } from '../lib/settings';
import { formatClock } from '../lib/format';
import MarketplaceModal from '../components/MarketplaceModal';
import { PlusIcon, TrashIcon, CheckIcon, FolderIcon } from '../components/icons';

export default function Profiles() {
	const { settings } = useSettings();
	const navigate = useNavigate();
	const url = settings.backendUrl;

	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [activeName, setActiveName] = useState<string | undefined>();
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [marketOpen, setMarketOpen] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const [ps, st] = await Promise.all([api.getProfiles(url), api.getStatus(url)]);
			setProfiles(ps);
			setActiveName(st.active_profile?.name);
			setError(null);
		} catch {
			setError('Could not reach the roaster.');
		}
	}, [url]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const load = async (name: string) => {
		setBusy(name);
		try {
			await api.loadProfile(url, name);
			await refresh();
		} finally {
			setBusy(null);
		}
	};

	const remove = async (name: string) => {
		setBusy(name);
		try {
			await api.deleteProfile(url, name);
			setConfirmDelete(null);
			await refresh();
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-serif text-3xl text-theme-foreground">Profiles</h1>
					<p className="mt-1 text-sm text-theme-muted">
						Roast programs. Load one to make it active for the next roast.
					</p>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setMarketOpen(true)}
						className="inline-flex items-center gap-2 rounded-full border border-theme-border px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-foreground transition-colors hover:border-theme-accent"
					>
						<FolderIcon className="h-5 w-5" />
						Marketplace
					</button>
					<button
						type="button"
						onClick={() => navigate('/profiles/new')}
						className="inline-flex items-center gap-2 rounded-full bg-theme-accent px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-accent-fg transition-transform hover:scale-[1.02]"
					>
						<PlusIcon className="h-5 w-5" />
						New Profile
					</button>
				</div>
			</div>

			{error && <p className="text-sm text-theme-accent">{error}</p>}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{profiles.map((p) => {
					const isActive = p.name === activeName;
					return (
						<div
							key={p.name}
							className={[
								'flex flex-col gap-4 rounded-design-lg border bg-theme-subtle p-5 shadow-xl shadow-black/10',
								isActive ? 'border-theme-accent' : 'border-theme-border',
							].join(' ')}
						>
							<div className="flex items-start justify-between gap-3">
								<h2 className="font-serif text-2xl text-theme-foreground">{p.name}</h2>
								{isActive && (
									<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-theme-accent px-2 py-0.5 text-xs uppercase tracking-[0.15em] text-theme-accent">
										<CheckIcon className="h-3.5 w-3.5" /> Active
									</span>
								)}
							</div>

							<dl className="grid grid-cols-4 gap-2 text-sm">
								<Field label="Roast" value={p.roast_level || '—'} />
								<Field label="Target" value={p.target_weight || '—'} />
								<Field label="Time" value={formatClock(p.duration_sec)} />
								<Field label="Steps" value={String(p.steps?.length ?? 0)} />
							</dl>

							{confirmDelete === p.name ? (
								<div className="mt-auto flex items-center justify-between gap-2 rounded-design border border-theme-accent/60 bg-theme-accent/10 px-3 py-2">
									<span className="text-sm text-theme-foreground">Delete this profile?</span>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => remove(p.name)}
											disabled={busy === p.name}
											className="rounded-full bg-theme-accent px-3 py-1 text-xs uppercase tracking-[0.1em] text-theme-accent-fg"
										>
											Delete
										</button>
										<button
											type="button"
											onClick={() => setConfirmDelete(null)}
											className="rounded-full border border-theme-border px-3 py-1 text-xs uppercase tracking-[0.1em] text-theme-muted"
										>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div className="mt-auto flex items-center gap-2">
									<button
										type="button"
										onClick={() => load(p.name)}
										disabled={isActive || busy === p.name}
										className="flex-1 rounded-full border border-theme-border px-4 py-2 text-sm uppercase tracking-[0.15em] text-theme-foreground transition-colors hover:border-theme-accent disabled:opacity-50"
									>
										{isActive ? 'Loaded' : busy === p.name ? 'Loading…' : 'Load'}
									</button>
									<Link
										to={`/profiles/${encodeURIComponent(p.name)}/edit`}
										className="rounded-full border border-theme-border px-4 py-2 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:text-theme-foreground"
									>
										Edit
									</Link>
									<button
										type="button"
										onClick={() => setConfirmDelete(p.name)}
										aria-label="Delete profile"
										className="rounded-full border border-theme-border p-2 text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-accent"
									>
										<TrashIcon className="h-5 w-5" />
									</button>
								</div>
							)}
						</div>
					);
				})}

				{profiles.length === 0 && !error && (
					<p className="text-sm text-theme-muted">
						No profiles saved yet. Create one, or import from the marketplace.
					</p>
				)}
			</div>

			<MarketplaceModal
				open={marketOpen}
				onClose={() => setMarketOpen(false)}
				onImported={refresh}
				existingNames={profiles.map((p) => p.name)}
			/>
		</div>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-[0.6rem] uppercase tracking-[0.15em] text-theme-muted">{label}</dt>
			<dd className="mt-0.5 font-medium text-theme-foreground">{value}</dd>
		</div>
	);
}
