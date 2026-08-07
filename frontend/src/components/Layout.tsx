// app shell: fixed top bar, the routed page scrolling in between, and the
// portrait-only bottom tab bar. the document itself never scrolls -- content
// scrolls inside <main>, which is what makes this feel like an app rather
// than a web page on the tablet.

import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import TabBar from './TabBar';

export default function Layout() {
	return (
		<div className="flex h-full flex-col bg-theme-page text-theme-foreground">
			<NavBar />
			<main className="app-scroll flex-1 overflow-y-auto overflow-x-hidden">
				<div className="mx-auto w-full max-w-[1600px] px-gutter py-4 xl:px-page">
					<Outlet />
				</div>
			</main>
			<TabBar />
		</div>
	);
}
