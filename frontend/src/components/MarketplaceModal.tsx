// browse shared roast programs and import them into the local profile library.
//
// the public marketplace service doesn't exist yet. this talks to whatever host
// is configured as the marketplace URL in Settings (which currently defaults to
// a stub catalog on the roaster backend) and degrades to a clear "unavailable"
// state when nothing answers -- so it stays honest once pointed at a real host.

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import * as api from '../lib/api';
import type { MarketProfile } from '../lib/api';
import { useSettings } from '../lib/settings';
import { formatClock } from '../lib/format';
import { CheckIcon } from './icons';

type Props = {
	open: boolean;
	onClose: () => void;
	onImported: () => void;
	existingNames: string[];
};

type State = 'loading' | 'ready' | 'unavailable';

export default function MarketplaceModal({ open, onClose, onImported, existingNames }: Props) {
	const { settings } = useSettings();
	const [items, setItems] = useState<MarketProfile[]>([]);
	const [state, setState] = useState<State>('loading');
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const fetchCatalog = useCallback(() => {
		setState('loading');
		setError(null);
		api
			.getMarketplace(settings.marketplaceUrl)
			.then((list) => {
				setItems(list);
				setState('ready');
			})
			.catch(() => setState('unavailable'));
	}, [settings.marketplaceUrl]);

	useEffect(() => {
		if (open) fetchCatalog();
	}, [open, fetchCatalog]);

	const install = async (m: MarketProfile) => {
		setBusy(m.name);
		setError(null);
		try {
			await api.saveProfile(settings.backendUrl, {
				name: m.name,
				roast_level: m.roast_level,
				target_weight: m.target_weight,
				steps: m.steps,
				duration_sec: 0, // derived server-side
			});
			onImported();
		} catch {
			setError('Failed to import that profile.');
		} finally {
			setBusy(null);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title="Profile Marketplace">
			{state === 'loading' && <p className="py-10 text-center text-sm text-theme-muted">Loading catalog…</p>}

			{state === 'unavailable' && (
				<div className="flex flex-col items-center gap-2 py-10 text-center">
					<p className="font-serif text-xl text-theme-foreground">Marketplace unavailable</p>
					<p className="max-w-sm text-sm text-theme-muted">
						Nothing answered at <span className="text-theme-foreground">{settings.marketplaceUrl}</span>. The
						public marketplace isn’t live yet — you can point this at another host in Settings.
					</p>
					<button
						type="button"
						onClick={fetchCatalog}
						className="mt-2 rounded-full border border-theme-border px-4 py-1.5 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:text-theme-foreground"
					>
						Retry
					</button>
				</div>
			)}

			{state === 'ready' && (
				<>
					{error && <p className="mb-3 text-sm text-theme-accent">{error}</p>}
					<div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
						{items.length === 0 && (
							<p className="py-8 text-center text-sm text-theme-muted">No profiles published yet.</p>
						)}
						{items.map((m) => {
							const owned = existingNames.includes(m.name);
							return (
								<div
									key={m.name}
									className="flex items-center justify-between gap-4 rounded-design border border-theme-border px-4 py-3"
								>
									<div className="min-w-0">
										<div className="font-serif text-lg text-theme-foreground">{m.name}</div>
										<p className="truncate text-sm text-theme-muted">{m.description}</p>
										<div className="mt-1 text-xs text-theme-muted">
											{m.roast_level} • {m.target_weight} • {formatClock(m.duration_sec)} •{' '}
											{m.steps.length} steps
										</div>
										<div className="mt-0.5 text-xs text-theme-muted">
											by {m.author} • {m.downloads.toLocaleString()} downloads
										</div>
									</div>
									<button
										type="button"
										onClick={() => install(m)}
										disabled={busy !== null}
										className={[
											'shrink-0 rounded-full px-4 py-2 text-xs uppercase tracking-[0.15em] transition-transform hover:scale-[1.02] disabled:opacity-50',
											owned
												? 'border border-theme-border text-theme-muted'
												: 'bg-theme-accent text-theme-accent-fg',
										].join(' ')}
									>
										{busy === m.name ? 'Saving…' : owned ? 'Update' : 'Save'}
									</button>
								</div>
							);
						})}
					</div>
					{items.some((m) => existingNames.includes(m.name)) && (
						<p className="mt-3 flex items-center gap-1.5 text-xs text-theme-muted">
							<CheckIcon className="h-3.5 w-3.5" />
							“Update” overwrites the copy already in your library.
						</p>
					)}
				</>
			)}
		</Modal>
	);
}
