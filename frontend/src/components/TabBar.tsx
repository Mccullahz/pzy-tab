// bottom tab bar -- the portrait navigation, per docs/redesign-port.pdf.
// hidden in landscape, where the tabs move into the top bar instead. thumbs
// live at the bottom of a hand-held tablet; that's where navigation belongs.

import { NavLink } from 'react-router-dom';
import { tabs } from './tabs';

export default function TabBar() {
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
								'flex min-w-[96px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium uppercase tracking-[0.15em] transition-colors duration-comfortable ease-quiet',
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
