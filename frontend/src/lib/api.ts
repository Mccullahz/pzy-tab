// typed client for the roaster backend. base URL is configurable (Settings page)
// because the frontend and backend are served from different ports in dev/kiosk.

export type StepMode = 'hold' | 'ramp';

// one segment of a roast program: holds or ramps a target ROR while commanding
// a fan speed and drum rpm.
export type Step = {
	duration_sec: number;
	mode: StepMode;
	ror: number; // target at step start, C/min
	ror_end: number; // target at step end; used when mode === 'ramp'
	fan_speed: number; // %
	drum_rpm: number;
};

export type Profile = {
	name: string;
	roast_level: string;
	target_weight: string;
	steps: Step[];
	duration_sec: number; // derived server-side: sum of step durations
};

// a marketplace listing: a profile plus its catalog metadata.
export type MarketProfile = Profile & {
	author: string;
	description: string;
	downloads: number;
};

// null means "follow the profile".
export type Overrides = {
	ror: number | null;
	fan_speed: number | null;
	drum_rpm: number | null;
};

export type OverridePatch = Partial<{ ror: number; fan_speed: number; drum_rpm: number }>;
export type OverrideParam = 'ror' | 'fan_speed' | 'drum_rpm' | 'all';

export type Status = {
	running: boolean;
	temperature: number; // C
	fan_speed: number; // %
	drum_rpm: number;
	heat_level: string; // L / M / H
	elapsed_seconds: number;
	ror: number; // observed, C/min
	target_ror: number; // commanded by program/override, C/min
	stage: string;
	progress: number; // %
	step_index: number; // active step, -1 when none
	overrides: Overrides;
	active_profile: Profile | null;
};

function join(base: string, path: string): string {
	return base.replace(/\/$/, '') + path;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(join(base, path), {
		headers: { 'Content-Type': 'application/json' },
		...init,
	});
	if (!res.ok) {
		throw new Error(`${path} -> ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export function getStatus(base: string): Promise<Status> {
	return request<Status>(base, '/status');
}

export function startRoast(base: string): Promise<Status> {
	return request<Status>(base, '/start-roast', { method: 'POST' });
}

export function stopRoast(base: string): Promise<Status> {
	return request<Status>(base, '/stop-roast', { method: 'POST' });
}

export function getProfiles(base: string): Promise<Profile[]> {
	return request<Profile[]>(base, '/profiles');
}

export function saveProfile(base: string, profile: Profile): Promise<Profile[]> {
	return request<Profile[]>(base, '/profiles', {
		method: 'POST',
		body: JSON.stringify(profile),
	});
}

export function deleteProfile(base: string, name: string): Promise<Profile[]> {
	return request<Profile[]>(base, `/profiles?name=${encodeURIComponent(name)}`, {
		method: 'DELETE',
	});
}

export function loadProfile(base: string, name: string): Promise<Status> {
	return request<Status>(base, '/load-profile', {
		method: 'POST',
		body: JSON.stringify({ name }),
	});
}

export function setOverride(base: string, patch: OverridePatch): Promise<Status> {
	return request<Status>(base, '/override', {
		method: 'POST',
		body: JSON.stringify(patch),
	});
}

export function clearOverride(base: string, param: OverrideParam = 'all'): Promise<Status> {
	return request<Status>(base, `/override?param=${param}`, { method: 'DELETE' });
}

// --- fulfillment orders -------------------------------------------------
// present only when this deployment is configured for storefront sync
// (docs/SYNC.md); a standalone roaster reports sync_enabled: false and the
// order queue is hidden entirely.

export type Capabilities = {
	sync_enabled: boolean;
};

// a line item as snapshotted by the store at order.created (contract -7.3).
export type OrderItem = {
	product_id?: string;
	name?: string;
	roast?: number;
	quantity?: number;
	net_weight_grams?: number;
	unit_cents?: number;
	kind?: string;
};

// mirrors sync.OrderState. the roast floor deliberately sees order id, items
// and weights but no customer PII (contract -9).
export type Order = {
	order_id: string;
	fulfillment_status: string;
	fulfillment_ordinal: number;
	held: boolean;
	placed_at?: string; // RFC3339, carried on order.created
	hold_reason?: string;
	terminal?: string;
	items?: OrderItem[];
	total_weight_grams?: number;
	tracking_number?: string;
	carrier?: string;
};

export type OrderBoard = {
	orders: Order[];
	active_order_id: string;
};

export function getCapabilities(base: string): Promise<Capabilities> {
	return request<Capabilities>(base, '/capabilities');
}

export function getOrders(base: string): Promise<OrderBoard> {
	return request<OrderBoard>(base, '/orders');
}

// claiming an order advances it to in_progress and attaches subsequent roast
// events to it. pass "" to release without advancing anything.
export function selectOrder(base: string, orderId: string): Promise<OrderBoard> {
	return request<OrderBoard>(base, '/orders/select', {
		method: 'POST',
		body: JSON.stringify({ order_id: orderId }),
	});
}

// browsed from a separate marketplace host (configurable in Settings), which is
// why this takes its own base rather than reusing the roaster's.
export function getMarketplace(base: string): Promise<MarketProfile[]> {
	return request<MarketProfile[]>(base, '/marketplace');
}

export async function checkHealth(base: string): Promise<boolean> {
	try {
		const res = await fetch(join(base, '/health'));
		return res.ok;
	} catch {
		return false;
	}
}
