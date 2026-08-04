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

const DEFAULTS: Settings = {
	backendUrl: 'http://localhost:8080',
	// the real marketplace service doesn't exist yet; this points at the stub
	// catalog served by the roaster backend. repoint when the real host ships.
	marketplaceUrl: 'http://localhost:8080',
	pollMs: 1000,
	tempUnit: 'C',
	theme: 'dark',
};

const STORAGE_KEY = 'pzy-settings';

function load(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
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
