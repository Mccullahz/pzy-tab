// top app bar. portrait shows only the wordmark (navigation lives in the
// bottom TabBar); landscape pulls the tabs up here, per the redesign pdfs.
// active route is highlighted so the operator always knows which view they're
// on -- this is a utility panel, not a marketing site.

import { NavLink } from 'react-router-dom';
import { tabs } from './tabs';

export default function NavBar() {
	return (
		<header className="shrink-0 border-b border-theme-border bg-theme-nav pt-[env(safe-area-inset-top)] backdrop-blur">
			<nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-gutter xl:px-page">
				{/* logo */}
				<NavLink to="/" className="font-serif text-2xl font-extrabold tracking-wide text-theme-foreground">
					PZY ROASTER
				</NavLink>

				{/* nav items -- landscape only */}
				<div className="hidden items-center gap-2 sm:gap-4 landscape:flex">
					{tabs.map((tab) => (
						<NavLink
							key={tab.name}
							to={tab.to}
							end={tab.end}
							className={({ isActive }) =>
								[
									'rounded-full px-4 py-2 text-sm font-medium uppercase tracking-[0.15em] transition-colors duration-comfortable ease-quiet',
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
		</header>
	);
}
