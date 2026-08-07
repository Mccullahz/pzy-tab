// the app's three destinations, shared by NavBar (landscape) and TabBar
// (portrait). `end` keeps Control from matching every route, while the
// Profiles tab stays lit on the editor subroutes.

export const tabs = [
	{ name: 'Control', to: '/', end: true },
	{ name: 'Profiles', to: '/profiles', end: false },
	{ name: 'Settings', to: '/settings', end: true },
];
