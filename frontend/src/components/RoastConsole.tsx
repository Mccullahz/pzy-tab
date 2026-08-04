// roast console: the live controls and the graph in one surface, controls above
// the plot. it pops out to a full-screen dialog so the curve can be read from
// across the room mid-roast -- the same body renders inline and expanded, just
// with the graph flexing to fill instead of a fixed height.
//
// the compact start/stop lives here (rather than only on the big button up in
// Options) so the console stays self-sufficient when expanded.

import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import type { OverrideParam, OverridePatch, Status } from '../lib/api';
import type { Sample } from '../hooks/useRoaster';
import type { PlanPoint } from '../lib/profile';
import Chart from './Chart';
import OverrideControls, { anyManual } from './OverrideControls';
import { PlayIcon, PauseIcon, ExpandIcon, CollapseIcon } from './icons';

type Props = {
	status: Status | null;
	samples: Sample[];
	plan: PlanPoint[];
	onStart: () => Promise<void> | void;
	onStop: () => Promise<void> | void;
	onSet: (patch: OverridePatch) => Promise<void> | void;
	onClear: (param: OverrideParam) => Promise<void> | void;
};

export default function RoastConsole(props: Props) {
	const [expanded, setExpanded] = useState(false);

	return (
		<>
			<section className="flex flex-col rounded-design-lg border border-theme-border bg-theme-subtle p-4 shadow-xl shadow-black/10">
				<ConsoleBody {...props} expanded={false} onToggleExpand={() => setExpanded(true)} />
			</section>

			<Dialog open={expanded} onClose={() => setExpanded(false)} transition className="relative z-50">
				<DialogBackdrop
					transition
					className="fixed inset-0 bg-black/70 backdrop-blur-sm transition duration-300 ease-quiet data-[closed]:opacity-0"
				/>
				<div className="fixed inset-0 p-3 sm:p-6">
					<DialogPanel
						transition
						className="flex h-full w-full flex-col rounded-design-lg border border-theme-border bg-theme-subtle p-4 shadow-2xl shadow-black/40 transition duration-300 ease-quiet data-[closed]:scale-95 data-[closed]:opacity-0"
					>
						<ConsoleBody {...props} expanded onToggleExpand={() => setExpanded(false)} />
					</DialogPanel>
				</div>
			</Dialog>
		</>
	);
}

function ConsoleBody({
	status,
	samples,
	plan,
	onStart,
	onStop,
	onSet,
	onClear,
	expanded,
	onToggleExpand,
}: Props & { expanded: boolean; onToggleExpand: () => void }) {
	const [busy, setBusy] = useState(false);
	const running = status?.running ?? false;
	const manual = anyManual(status);

	const toggle = async () => {
		setBusy(true);
		try {
			await (running ? onStop() : onStart());
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			{/* header */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<StartStopButton running={running} busy={busy} onClick={toggle} />
					<h2 className="text-xs uppercase tracking-[0.2em] text-theme-muted">Manual Override</h2>
				</div>

				<div className="flex items-center gap-2">
					{running ? (
						manual && (
							<button
								type="button"
								onClick={() => onClear('all')}
								className="rounded-full border border-theme-accent px-4 py-1.5 text-xs uppercase tracking-[0.15em] text-theme-accent transition-colors hover:bg-theme-accent/10"
							>
								Resume Profile
							</button>
						)
					) : (
						<span className="text-xs text-theme-muted">Start a roast to adjust</span>
					)}
					<button
						type="button"
						onClick={onToggleExpand}
						aria-label={expanded ? 'Exit full screen' : 'View full screen'}
						className="rounded-full border border-theme-border p-2 text-theme-muted transition-colors hover:border-theme-accent hover:text-theme-foreground"
					>
						{expanded ? <CollapseIcon className="h-5 w-5" /> : <ExpandIcon className="h-5 w-5" />}
					</button>
				</div>
			</div>

			{/* controls */}
			<div className="mt-3">
				<OverrideControls status={status} onSet={onSet} onClear={onClear} />
			</div>

			{/* graph */}
			<Chart
				status={status}
				samples={samples}
				plan={plan}
				className={expanded ? 'mt-4 min-h-0 flex-1' : 'mt-4 h-72 lg:h-80'}
			/>
		</>
	);
}

function StartStopButton({
	running,
	busy,
	onClick,
}: {
	running: boolean;
	busy: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			className={[
				'relative inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium uppercase tracking-[0.15em]',
				'transition-all duration-comfortable ease-quiet disabled:opacity-70',
				running
					? 'border-theme-accent bg-theme-accent text-theme-accent-fg'
					: 'border-theme-accent bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20',
			].join(' ')}
		>
			{running && (
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 animate-pulse rounded-full ring-2 ring-theme-accent/50"
				/>
			)}
			{running ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
			{running ? 'Stop' : 'Start'}
		</button>
	);
}
