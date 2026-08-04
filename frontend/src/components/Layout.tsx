// shared page chrome: nav on top, footer on the bottom, routed page in between.

import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import Footer from './Footer';

export default function Layout() {
	return (
		<div className="flex min-h-screen flex-col bg-theme-page text-theme-foreground">
			<NavBar />
			<main className="mx-auto w-full max-w-[1600px] flex-1 px-gutter py-6 xl:px-page">
				<Outlet />
			</main>
			<Footer />
		</div>
	);
}
