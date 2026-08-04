// control (landing) view. the live dashboard: gauge cluster, roast controls,
// manual overrides and the roast graph, all driven by the polled /status feed.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Step } from '../lib/api';
import { useRoaster } from '../hooks/useRoaster';
import { useSettings } from '../lib/settings';
import { planPoints } from '../lib/profile';
import Info from '../components/Info';
import Options from '../components/Options';
import RoastConsole from '../components/RoastConsole';

export default function Control() {
	const { status, samples, connected, start, stop, load, setOverride, clearOverride } = useRoaster();
	const { settings } = useSettings();

	// the active program's predicted curve, for the graph overlay. keyed off the
	// serialised steps so it only recomputes when the program actually changes,
	// not on every one-second poll.
	const stepsKey = JSON.stringify(status?.active_profile?.steps ?? []);
	const plan = useMemo(() => {
		const steps: Step[] = JSON.parse(stepsKey);
		return steps.length ? planPoints(steps, 5) : [];
	}, [stepsKey]);

	return (
		<div className="flex flex-col gap-4">
			{!connected && (
				<div className="rounded-design border border-theme-accent/60 bg-theme-accent/10 px-4 py-3 text-sm text-theme-foreground">
					Can’t reach the roaster at <span className="font-medium">{settings.backendUrl}</span>. Check the
					backend, or update the address in{' '}
					<Link to="/settings" className="text-theme-accent hover:underline">
						Settings
					</Link>
					.
				</div>
			)}

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="lg:col-span-5">
					<Info status={status} />
				</div>
				<div className="lg:col-span-7">
					<Options status={status} onStart={start} onStop={stop} onLoad={load} />
				</div>
			</div>

			<RoastConsole
				status={status}
				samples={samples}
				plan={plan}
				onStart={start}
				onStop={stop}
				onSet={setOverride}
				onClear={clearOverride}
			/>
		</div>
	);
}
