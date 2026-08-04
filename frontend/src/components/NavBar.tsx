// header navbar. active route is highlighted so the operator always knows which
// view they're on -- this is a utility panel, not a marketing site.

import { NavLink } from 'react-router-dom';

const navigation = [
	{ name: 'Control', to: '/' },
	{ name: 'Profiles', to: '/profiles' },
	{ name: 'Settings', to: '/settings' },
];

export default function NavBar() {
	return (
		<header className="sticky top-0 z-20 h-20 border-b border-theme-border bg-theme-nav backdrop-blur duration-comfortable ease-quiet">
			<nav className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-gutter xl:px-page">
				{/* logo */}
				<NavLink to="/" className="font-serif text-2xl font-extrabold tracking-wide text-theme-foreground">
					PZY ROASTER
				</NavLink>

				{/* nav items */}
				<div className="flex items-center gap-2 sm:gap-4">
					{navigation.map((item) => (
						<NavLink
							key={item.name}
							to={item.to}
							end={item.to === '/'}
							className={({ isActive }) =>
								[
									'rounded-full px-4 py-2 text-sm font-medium uppercase tracking-[0.15em] transition-colors duration-comfortable ease-quiet',
									isActive
										? 'bg-theme-elevated text-theme-foreground'
										: 'text-theme-muted hover:text-theme-foreground',
								].join(' ')
							}
						>
							{item.name}
						</NavLink>
					))}
				</div>
			</nav>
		</header>
	);
}
