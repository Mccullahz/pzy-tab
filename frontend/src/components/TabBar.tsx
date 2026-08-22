// bottom tab bar -- the portrait navigation, per docs/redesign-port.pdf. hidden in landscape, where the tabs move into the top bar instead. thumbs live at the bottom of a hand-held tablet; that's where navigation belongs.

import { NavLink } from 'react-router-dom';
import { useTabs } from './tabs';

export default function TabBar() {
	const tabs = useTabs();

	return (
		<nav className="shrink-0 border-t border-theme-border bg-theme-nav pb-[env(safe-area-inset-bottom)] backdrop-blur landscape:hidden">
			<div className="flex h-16 items-center justify-around px-2">
				{tabs.map((tab) => (
					<NavLink
						key={tab.name}
						to={tab.to}
						end={tab.end}
						className={({ isActive }) =>
							[
								// flexes rather than a hard min-width: a synced install has a fourth tab, which must still fit across a narrow portrait screen.
								'flex min-w-[76px] max-w-[140px] flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm font-medium uppercase tracking-[0.15em] transition-colors duration-comfortable ease-quiet',
								isActive
									? 'bg-theme-elevated text-theme-foreground'
									: 'text-theme-muted active:bg-theme-subtle',
							].join(' ')
						}
					>
						{tab.name}
					</NavLink>
				))}
			</div>
		</nav>
	);
}
