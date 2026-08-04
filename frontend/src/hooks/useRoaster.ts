// polls /status on the configured interval and keeps a running time-series of
// (elapsed, temperature) samples for the live graph. also exposes the roast
// control actions, each of which folds its fresh Status back into local state so
// the UI reacts immediately without waiting for the next poll.

import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../lib/settings';
import * as api from '../lib/api';
import type { OverrideParam, OverridePatch, Status } from '../lib/api';

export type Sample = { t: number; temp: number };

// cap the retained series; a 13 min roast at 1 Hz is ~780 points.
const MAX_SAMPLES = 1500;

export function useRoaster() {
	const { settings } = useSettings();
	const { backendUrl, pollMs } = settings;

	const [status, setStatus] = useState<Status | null>(null);
	const [samples, setSamples] = useState<Sample[]>([]);
	const [connected, setConnected] = useState(true);

	const ingest = useCallback((s: Status) => {
		setStatus(s);
		setSamples((prev) => {
			// idle and reset: clear any leftover series from a previous roast.
			if (!s.running && s.elapsed_seconds === 0) return prev.length ? [] : prev;
			const last = prev[prev.length - 1];
			// a fresh roast rewinds elapsed -> start a new series at the origin.
			if (last && s.elapsed_seconds < last.t) {
				return [{ t: s.elapsed_seconds, temp: s.temperature }];
			}
			// only append when the clock has advanced to a new second.
			if (!last || s.elapsed_seconds > last.t) {
				const next = [...prev, { t: s.elapsed_seconds, temp: s.temperature }];
				return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
			}
			return prev;
		});
	}, []);

	useEffect(() => {
		let alive = true;
		const poll = async () => {
			try {
				const s = await api.getStatus(backendUrl);
				if (!alive) return;
				setConnected(true);
				ingest(s);
			} catch {
				if (alive) setConnected(false);
			}
		};
		poll();
		const id = setInterval(poll, pollMs);
		return () => {
			alive = false;
			clearInterval(id);
		};
	}, [backendUrl, pollMs, ingest]);

	const start = useCallback(async () => ingest(await api.startRoast(backendUrl)), [backendUrl, ingest]);
	const stop = useCallback(async () => ingest(await api.stopRoast(backendUrl)), [backendUrl, ingest]);
	const load = useCallback(
		async (name: string) => ingest(await api.loadProfile(backendUrl, name)),
		[backendUrl, ingest],
	);
	const setOverride = useCallback(
		async (patch: OverridePatch) => ingest(await api.setOverride(backendUrl, patch)),
		[backendUrl, ingest],
	);
	const clearOverride = useCallback(
		async (param: OverrideParam) => ingest(await api.clearOverride(backendUrl, param)),
		[backendUrl, ingest],
	);

	return { status, samples, connected, start, stop, load, setOverride, clearOverride };
}
