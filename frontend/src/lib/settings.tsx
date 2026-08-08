// app-wide settings, persisted to localStorage. these are operator preferences
// (where the backend lives, how often to poll, units, theme) rather than roast
// state, so they belong on the client, not the roaster.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type TempUnit = 'C' | 'F';
export type Theme = 'dark' | 'light';

export type Settings = {
	backendUrl: string;
	marketplaceUrl: string;
	pollMs: number;
	tempUnit: TempUnit;
	theme: Theme;
};

// same-origin by default: the dev server proxies /api to the backend, so the app
// works from any device on the LAN without being told the roaster's IP. an
// absolute URL still works here if the backend lives somewhere else.
const SAME_ORIGIN_API = '/api';

const DEFAULTS: Settings = {
	backendUrl: SAME_ORIGIN_API,
	// the real marketplace service doesn't exist yet; this points at the stub
	// catalog served by the roaster backend. repoint when the real host ships.
	marketplaceUrl: SAME_ORIGIN_API,
	pollMs: 1000,
	tempUnit: 'C',
	theme: 'dark',
};

const STORAGE_KEY = 'pzy-settings';

// devices set up before the proxy existed have the old localhost default
// persisted, which points a tablet at itself. rewrite it rather than leaving
// them stuck on an unreachable backend.
const LEGACY_DEFAULTS = ['http://localhost:8080', 'http://127.0.0.1:8080'];

function migrate(url: unknown): string | undefined {
	if (typeof url !== 'string') return undefined;
	return LEGACY_DEFAULTS.includes(url.replace(/\/$/, '')) ? SAME_ORIGIN_API : url;
}

function load(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const stored = JSON.parse(raw) as Partial<Settings>;
			return {
				...DEFAULTS,
				...stored,
				backendUrl: migrate(stored.backendUrl) ?? DEFAULTS.backendUrl,
				marketplaceUrl: migrate(stored.marketplaceUrl) ?? DEFAULTS.marketplaceUrl,
			};
		}
	} catch {
		/* fall through to defaults */
	}
	return DEFAULTS;
}

type SettingsContextValue = {
	settings: Settings;
	update: (patch: Partial<Settings>) => void;
	reset: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState<Settings>(load);

	// keep the document theme class and persisted copy in sync with state.
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		document.documentElement.classList.toggle('dark', settings.theme === 'dark');
	}, [settings]);

	const value = useMemo<SettingsContextValue>(
		() => ({
			settings,
			update: (patch) => setSettings((s) => ({ ...s, ...patch })),
			reset: () => setSettings(DEFAULTS),
		}),
		[settings],
	);

	return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
	const ctx = useContext(SettingsContext);
	if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
	return ctx;
}
