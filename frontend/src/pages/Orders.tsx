// order queue. the roast floor's view of what the storefront has sent over (docs/SYNC.md). claiming an order puts it on the drum: it advances to in_progress, and the roast you start next reports roasting, then roasted, back to the store automatically.
//
// this board is read _mostly_ by design. the store owns order existence and everything after roasted (shipping, cancellation); the only thing the roaster originates here is which order it's working.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import type { Order } from '../lib/api';
import { useSettings } from '../lib/settings';
import {
	DEFAULT_HIDDEN,
	FILTERABLE_STATUSES,
	ORDINALS,
	STATUS_LABELS,
	TONE_CHIP,
	TONE_DOT,
	TONE_EDGE,
	labelOf,
	sortOrders,
	statusOf,
	toneOf,
} from '../lib/fulfillment';
import type { SortDir, SortField, Tone } from '../lib/fulfillment';
import Modal from '../components/Modal';
import { CheckIcon, FilterIcon, SortAscIcon, SortDescIcon } from '../components/icons';

const POLL_MS = 5000;

export default function Orders() {
	const { settings } = useSettings();
	const navigate = useNavigate();
	const url = settings.backendUrl;

	const [orders, setOrders] = useState<Order[]>([]);
	const [activeId, setActiveId] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	// board controls. `hidden` is the set of statuses filtered OUT, so the default (ship-and-beyond) needs no special casing on first render.
	const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN);
	const [sortField, setSortField] = useState<SortField>('status');
	const [sortDir, setSortDir] = useState<SortDir>('asc');
	const [filterOpen, setFilterOpen] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const board = await api.getOrders(url);
			setOrders(board.orders);
			setActiveId(board.active_order_id);
			setError(null);
		} catch {
			setError('Could not reach the roaster.');
		}
	}, [url]);

	// the store pushes on its own schedule, so poll rather than wait for the operator to navigate back.
	useEffect(() => {
		refresh();
		const id = setInterval(refresh, POLL_MS);
		return () => clearInterval(id);
	}, [refresh]);

	const claim = async (orderId: string) => {
		setBusy(orderId);
		try {
			const board = await api.selectOrder(url, orderId);
			setOrders(board.orders);
			setActiveId(board.active_order_id);
		} catch {
			setError('Could not claim that order. It may have moved on — refreshing.');
			await refresh();
		} finally {
			setBusy(null);
		}
	};

	const release = async () => {
		setBusy(activeId);
		try {
			const board = await api.selectOrder(url, '');
			setOrders(board.orders);
			setActiveId(board.active_order_id);
		} finally {
			setBusy(null);
		}
	};

	const active = orders.find((o) => o.order_id === activeId);

	const visible = useMemo(() => {
		// the claimed order always shows, whatever the filter says -- hiding what's on the drum would be actively misleading.
		const kept = orders.filter((o) => o.order_id === activeId || !hidden.includes(statusOf(o)));
		return sortOrders(kept, sortField, sortDir);
	}, [orders, hidden, sortField, sortDir, activeId]);

	const hiddenCount = orders.length - visible.length;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-serif text-3xl text-theme-foreground">Orders</h1>
					<p className="mt-1 text-sm text-theme-muted">
						Sent over from the storefront. Claim one to put it on the drum.
					</p>
				</div>
				{active && (
					<button
						type="button"
						onClick={release}
						disabled={busy !== null}
						className="min-h-[44px] rounded-full border border-theme-border px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-foreground disabled:opacity-50"
					>
						Release
					</button>
				)}
			</div>

			<BoardControls
				hiddenCount={hiddenCount}
				filterActive={hidden.length > 0}
				onOpenFilter={() => setFilterOpen(true)}
				sortField={sortField}
				sortDir={sortDir}
				onSortField={setSortField}
				onToggleDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
			/>

			{error && <p className="text-sm text-theme-accent">{error}</p>}

			{active && (
				<div className="rounded-design-lg border border-theme-accent bg-theme-subtle p-5 shadow-xl shadow-black/10">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<div className="text-xs uppercase tracking-[0.2em] text-theme-muted">On the drum</div>
							<div className="mt-1 font-serif text-2xl text-theme-foreground">{active.order_id}</div>
						</div>
						<button
							type="button"
							onClick={() => navigate('/')}
							className="min-h-[44px] rounded-full bg-theme-accent px-5 py-2 text-sm uppercase tracking-[0.15em] text-theme-accent-fg transition-transform hover:scale-[1.02]"
						>
							Go to Control
						</button>
					</div>
					<p className="mt-3 text-sm text-theme-muted">
						Starting a roast reports <span className="text-theme-foreground">Roasting</span> against this
						order; running the program to the end reports{' '}
						<span className="text-theme-foreground">Roasted</span> and frees the drum. Stopping by hand
						reports neither.
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{visible.map((o) => (
					<OrderCard
						key={o.order_id}
						order={o}
						isActive={o.order_id === activeId}
						busy={busy === o.order_id}
						hasActive={activeId !== ''}
						onClaim={() => claim(o.order_id)}
					/>
				))}
			</div>

			{visible.length === 0 && !error && (
				<p className="text-sm text-theme-muted">
					{orders.length === 0
						? 'No orders on the board. They arrive as the storefront sends them.'
						: `Nothing matches this filter — ${orders.length} order${orders.length === 1 ? '' : 's'} hidden.`}
				</p>
			)}

			<FilterModal
				open={filterOpen}
				onClose={() => setFilterOpen(false)}
				hidden={hidden}
				counts={countByStatus(orders)}
				onToggle={(status) =>
					setHidden((h) => (h.includes(status) ? h.filter((s) => s !== status) : [...h, status]))
				}
				onShowAll={() => setHidden([])}
				onReset={() => setHidden(DEFAULT_HIDDEN)}
			/>
		</div>
	);
}

// BoardControls holds the filter + sort affordances: a wrapping row of pill buttons rather than a menu, so it stays one tap deep and survives a narrow portrait screen. every target clears 44px.
function BoardControls({
	hiddenCount,
	filterActive,
	onOpenFilter,
	sortField,
	sortDir,
	onSortField,
	onToggleDir,
}: {
	hiddenCount: number;
	filterActive: boolean;
	onOpenFilter: () => void;
	sortField: SortField;
	sortDir: SortDir;
	onSortField: (f: SortField) => void;
	onToggleDir: () => void;
}) {
	const DirIcon = sortDir === 'asc' ? SortAscIcon : SortDescIcon;

	return (
		<div className="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onClick={onOpenFilter}
				className={[
					'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-2 text-sm uppercase tracking-[0.15em] transition-colors',
					filterActive
						? 'border-theme-accent text-theme-foreground'
						: 'border-theme-border text-theme-muted hover:text-theme-foreground',
				].join(' ')}
			>
				<FilterIcon className="h-5 w-5" />
				Filter
				{hiddenCount > 0 && (
					<span className="rounded-full bg-theme-accent px-2 py-0.5 text-xs tracking-normal text-theme-accent-fg">
						{hiddenCount}
					</span>
				)}
			</button>

			<div className="inline-flex min-h-[44px] items-center rounded-full border border-theme-border p-1">
				{(
					[
						['status', 'Status'],
						['placed', 'Date'],
					] as [SortField, string][]
				).map(([value, label]) => (
					<button
						key={value}
						type="button"
						onClick={() => onSortField(value)}
						className={[
							'rounded-full px-4 py-1.5 text-sm transition-colors',
							value === sortField
								? 'bg-theme-accent text-theme-accent-fg'
								: 'text-theme-muted hover:text-theme-foreground',
						].join(' ')}
					>
						{label}
					</button>
				))}
				<button
					type="button"
					onClick={onToggleDir}
					aria-label={`Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'} — tap to reverse`}
					title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
					className="ml-1 rounded-full p-2 text-theme-muted transition-colors hover:text-theme-foreground"
				>
					<DirIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	);
}

// the filter lives in a dialog rather than an inline chip row: eight statuses would wrap into a wall on a portrait tablet, and a sheet gives each one a proper thumb-sized target.
function FilterModal({
	open,
	onClose,
	hidden,
	counts,
	onToggle,
	onShowAll,
	onReset,
}: {
	open: boolean;
	onClose: () => void;
	hidden: string[];
	counts: Record<string, number>;
	onToggle: (status: string) => void;
	onShowAll: () => void;
	onReset: () => void;
}) {
	return (
		<Modal open={open} onClose={onClose} title="Filter by status">
			<div className="flex flex-col gap-2">
				{FILTERABLE_STATUSES.map((status) => {
					const shown = !hidden.includes(status);
					const tone = toneForStatus(status);
					return (
						<button
							key={status}
							type="button"
							onClick={() => onToggle(status)}
							aria-pressed={shown}
							className={[
								'flex min-h-[52px] items-center justify-between gap-3 rounded-design border px-4 py-3 text-left transition-colors',
								shown ? 'border-theme-border bg-theme-subtle' : 'border-theme-border/50 opacity-50',
							].join(' ')}
						>
							<span className="flex items-center gap-3">
								<span className={['h-2.5 w-2.5 rounded-full', TONE_DOT[tone]].join(' ')} />
								<span className="text-theme-foreground">{STATUS_LABELS[status] ?? status}</span>
								<span className="text-xs text-theme-muted">{counts[status] ?? 0}</span>
							</span>
							<span
								className={[
									'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
									shown
										? 'border-theme-accent bg-theme-accent text-theme-accent-fg'
										: 'border-theme-border text-transparent',
								].join(' ')}
							>
								<CheckIcon className="h-4 w-4" />
							</span>
						</button>
					);
				})}
			</div>

			<div className="mt-5 flex gap-2">
				<button
					type="button"
					onClick={onShowAll}
					className="min-h-[44px] flex-1 rounded-full border border-theme-border px-4 py-2 text-sm uppercase tracking-[0.15em] text-theme-foreground transition-colors hover:border-theme-accent"
				>
					Show all
				</button>
				<button
					type="button"
					onClick={onReset}
					className="min-h-[44px] flex-1 rounded-full border border-theme-border px-4 py-2 text-sm uppercase tracking-[0.15em] text-theme-muted transition-colors hover:text-theme-foreground"
				>
					Reset
				</button>
			</div>
		</Modal>
	);
}

function OrderCard({
	order,
	isActive,
	busy,
	hasActive,
	onClaim,
}: {
	order: Order;
	isActive: boolean;
	busy: boolean;
	hasActive: boolean;
	onClaim: () => void;
}) {
	// only unclaimed, un-held, live orders that haven't been roasted yet can go on the drum. the ladder would reject anything else anyway (§4.3); this just avoids offering a button that can't work.
	const claimable =
		!isActive && !order.held && !order.terminal && order.fulfillment_ordinal < ORDINALS.roasting;
	const tone = toneOf(order);

	return (
		<div
			className={[
				'flex flex-col gap-4 rounded-design-lg border border-l-4 bg-theme-subtle p-5 shadow-xl shadow-black/10',
				isActive ? 'border-theme-accent' : 'border-theme-border',
				// the left edge carries the same colour as the chip, so status reads from across the room without hunting for the label.
				TONE_EDGE[tone],
				order.terminal ? 'opacity-60' : '',
			].join(' ')}
		>
			<div className="flex items-start justify-between gap-3">
				<h2 className="font-serif text-xl text-theme-foreground">{order.order_id}</h2>
				{isActive && (
					<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-theme-accent px-2 py-0.5 text-xs uppercase tracking-[0.15em] text-theme-accent">
						<CheckIcon className="h-3.5 w-3.5" /> On drum
					</span>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<StatusChip order={order} />
				{order.held && (
					<span className="rounded-full border border-theme-status-warn/50 px-2 py-0.5 text-xs uppercase tracking-[0.15em] text-theme-status-warn">
						Held{order.hold_reason ? `: ${order.hold_reason}` : ''}
					</span>
				)}
				{order.placed_at && <span className="text-xs text-theme-muted">{formatPlaced(order.placed_at)}</span>}
			</div>

			{order.items && order.items.length > 0 && (
				<ul className="flex flex-col gap-1 text-sm text-theme-foreground">
					{order.items.map((item, i) => (
						<li key={item.product_id ?? i} className="flex justify-between gap-3">
							<span>
								{item.quantity ? `${item.quantity} × ` : ''}
								{item.name ?? 'Unnamed item'}
							</span>
							{item.net_weight_grams != null && (
								<span className="shrink-0 text-theme-muted">{item.net_weight_grams} g</span>
							)}
						</li>
					))}
				</ul>
			)}

			{order.total_weight_grams != null && (
				<div className="text-xs uppercase tracking-[0.15em] text-theme-muted">
					Total {formatWeight(order.total_weight_grams)}
				</div>
			)}

			{order.tracking_number && (
				<div className="text-xs text-theme-muted">
					{order.carrier ?? 'Shipment'} · {order.tracking_number}
				</div>
			)}

			<div className="mt-auto">
				{claimable ? (
					<button
						type="button"
						onClick={onClaim}
						disabled={busy || hasActive}
						title={hasActive ? 'Release the order on the drum first' : undefined}
						className="min-h-[44px] w-full rounded-full border border-theme-border px-4 py-2 text-sm uppercase tracking-[0.15em] text-theme-foreground transition-colors hover:border-theme-accent disabled:opacity-50"
					>
						{busy ? 'Claiming…' : 'Claim'}
					</button>
				) : (
					<p className="text-xs text-theme-muted">{whyNotClaimable(order, isActive)}</p>
				)}
			</div>
		</div>
	);
}

function StatusChip({ order }: { order: Order }) {
	const tone = toneOf(order);
	// only a live roast pulses. a static dot everywhere else keeps the motion meaningful rather than decorative.
	const live = order.fulfillment_status === 'roasting' && !order.terminal && !order.held;

	return (
		<span
			className={[
				'inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-[0.15em]',
				TONE_CHIP[tone],
			].join(' ')}
		>
			<span className={['h-2 w-2 rounded-full', TONE_DOT[tone], live ? 'animate-pulse' : ''].join(' ')} />
			{labelOf(order)}
		</span>
	);
}

// the filter list styles a bare status string, which has no held/terminal overlay to consider -- unlike toneOf, which reads a whole order.
function toneForStatus(status: string): Tone {
	const terminal = status === 'canceled' || status === 'refunded' ? status : undefined;
	return toneOf({
		order_id: '',
		fulfillment_status: status,
		fulfillment_ordinal: ORDINALS[status] ?? 0,
		held: false,
		terminal,
	});
}

function countByStatus(orders: Order[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const o of orders) {
		const key = statusOf(o);
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return counts;
}

function whyNotClaimable(order: Order, isActive: boolean): string {
	if (isActive) return 'Claimed by this roaster.';
	if (order.terminal) return `Order was ${order.terminal} by the store.`;
	if (order.held) return 'On hold. The store has to lift it before this can be roasted.';
	if (order.fulfillment_ordinal >= ORDINALS.roasted) return 'Roasted. Waiting on the store to ship.';
	return 'Being roasted elsewhere.';
}

function formatPlaced(iso: string): string {
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return '';
	return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeight(grams: number): string {
	return grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${grams} g`;
}
