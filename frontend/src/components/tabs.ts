// the app's destinations, shared by NavBar (landscape) and TabBar (portrait).
// `end` keeps Control from matching every route, while the Profiles tab stays
// lit on the editor subroutes. Orders is conditional: it only exists on
// deployments configured for storefront sync (docs/SYNC.md).

import { useCapabilities } from '../hooks/useCapabilities';

export type Tab = { name: string; to: string; end: boolean };

const baseTabs: Tab[] = [
	{ name: 'Control', to: '/', end: true },
	{ name: 'Profiles', to: '/profiles', end: false },
	{ name: 'Settings', to: '/settings', end: true },
];

export function useTabs(): Tab[] {
	const { sync_enabled } = useCapabilities();
	if (!sync_enabled) return baseTabs;
	// slot Orders next to Control: on a synced install it's where the shift starts, before you pick a profile.
	return [baseTabs[0], { name: 'Orders', to: '/orders', end: true }, ...baseTabs.slice(1)];
}
