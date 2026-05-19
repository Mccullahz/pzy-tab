// header navbar component

import { Link } from "react-router-dom"

const navigation = [
	{ name: 'Control', to: '/' },
	{ name: 'Profiles', to: '/' },
	{ name: 'Settings', to: '/' },
]

export default function NavBar() {
	return (
		<header className="top-0 bg-theme-nav duration-comfortable ease-quiet h-20">
			<nav className="relative mx-auto min-w-full px-gutter py-5 xl:px-page">
				<div className="flex items-center justify-between">
					{/*LOGO*/}
					<Link to="/" className="font-serif text-2xl font-extrabold text-theme-foreground">
						PZY ROASTER
					</Link>

					{/* Nav Items */}
					<div className="hidden md:flex items-center space-x-8">
						{navigation.map((item) => (
							<Link
								key={item.name}
								to={item.to}
								className="text-sm font-medium text-theme-foreground hover:text-theme-foreground/80 px-3 py-2 rounded-md"
							>
								{item.name}
							</Link>
						))}
					</div>
				</div>
			</nav>
		</header>
	)
}
