// the fulfillment ladder as the UI needs it: ordering, labels, and the colour
// role each status carries. mirrored from the backend (contract §4.1) so the
// board can sort and filter without a round trip.

import type { Order } from './api';

export const ORDINALS: Record<string, number> = {
	new: 0,
	in_progress: 10,
	roasting: 20,
	roasted: 30,
	shipped: 50,
	delivered: 60,
};

export const STATUS_LABELS: Record<string, string> = {
	new: 'New',
	in_progress: 'In progress',
	roasting: 'Roasting',
	roasted: 'Roasted',
	shipped: 'Shipped',
	delivered: 'Delivered',
	canceled: 'Canceled',
	refunded: 'Refunded',
};

// every status the board can filter on, in ladder order. terminal states sit at
// the end because they're outcomes, not stages.
export const FILTERABLE_STATUSES = [
	'new',
	'in_progress',
	'roasting',
	'roasted',
	'shipped',
	'delivered',
	'canceled',
	'refunded',
];

// once an order ships it belongs to the store, not the roast floor. hidden by
// default so the board shows work rather than history — still one tap away.
export const DEFAULT_HIDDEN = ['shipped', 'delivered'];

// a terminal order's status field still reads 'new'/'roasting'/whatever it was
// when it died, so the board keys off this instead.
export function statusOf(order: Order): string {
	return order.terminal || order.fulfillment_status;
}

export function labelOf(order: Order): string {
	const status = statusOf(order);
	return STATUS_LABELS[status] ?? status;
}

// which colour role a status carries. grouped by who the order is waiting on,
// which is the question the roast floor actually asks of the board.
export type Tone = 'waiting' | 'active' | 'done' | 'away' | 'warn' | 'dead';

export function toneOf(order: Order): Tone {
	if (order.terminal) return 'dead';
	if (order.held) return 'warn';
	switch (order.fulfillment_status) {
		case 'new':
			return 'waiting';
		case 'in_progress':
		case 'roasting':
			return 'active';
		case 'roasted':
			return 'done';
		default:
			return 'away';
	}
}

// full class strings, not interpolated fragments: tailwind only ships classes
// it can see written out at build time.
export const TONE_CHIP: Record<Tone, string> = {
	waiting: 'border-theme-status-waiting/50 text-theme-status-waiting',
	active: 'border-theme-status-active/50 text-theme-status-active',
	done: 'border-theme-status-done/50 text-theme-status-done',
	away: 'border-theme-status-away/50 text-theme-status-away',
	warn: 'border-theme-status-warn/50 text-theme-status-warn',
	dead: 'border-theme-status-dead/50 text-theme-status-dead',
};

export const TONE_DOT: Record<Tone, string> = {
	waiting: 'bg-theme-status-waiting',
	active: 'bg-theme-status-active',
	done: 'bg-theme-status-done',
	away: 'bg-theme-status-away',
	warn: 'bg-theme-status-warn',
	dead: 'bg-theme-status-dead',
};

// the card's left edge, so a status is readable from across the room without
// finding the chip.
export const TONE_EDGE: Record<Tone, string> = {
	waiting: 'border-l-theme-status-waiting',
	active: 'border-l-theme-status-active',
	done: 'border-l-theme-status-done',
	away: 'border-l-theme-status-away',
	warn: 'border-l-theme-status-warn',
	dead: 'border-l-theme-status-dead',
};

export type SortField = 'status' | 'placed';
export type SortDir = 'asc' | 'desc';

// placed_at is optional on the wire (only order.created carries it), so orders
// without one sort to the end either way rather than jumping to the top.
function placedRank(order: Order): number {
	if (!order.placed_at) return Number.MAX_SAFE_INTEGER;
	const t = Date.parse(order.placed_at);
	return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

export function sortOrders(orders: Order[], field: SortField, dir: SortDir): Order[] {
	const flip = dir === 'asc' ? 1 : -1;

	return [...orders].sort((a, b) => {
		if (field === 'placed') {
			const delta = placedRank(a) - placedRank(b);
			if (delta !== 0) return delta * flip;
			return a.order_id.localeCompare(b.order_id);
		}

		// by status: ladder position, terminal orders after every live stage
		// since they're out of the flow entirely.
		const ra = a.terminal ? 1000 : (ORDINALS[a.fulfillment_status] ?? 999);
		const rb = b.terminal ? 1000 : (ORDINALS[b.fulfillment_status] ?? 999);
		if (ra !== rb) return (ra - rb) * flip;

		// within a stage, oldest order first regardless of direction: the tie
		// break is "what should I work next", not part of the chosen sort.
		const delta = placedRank(a) - placedRank(b);
		if (delta !== 0) return delta;
		return a.order_id.localeCompare(b.order_id);
	});
}
