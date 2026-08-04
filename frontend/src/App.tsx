import { Routes, Route } from 'react-router-dom';

import { SettingsProvider } from './lib/settings';
import Layout from './components/Layout';
import Control from './pages/Control';
import Profiles from './pages/Profiles';
import ProfileEditor from './pages/ProfileEditor';
import Settings from './pages/Settings';

export default function App() {
	return (
		<SettingsProvider>
			<Routes>
				<Route element={<Layout />}>
					<Route path="/" element={<Control />} />
					<Route path="/profiles" element={<Profiles />} />
					<Route path="/profiles/new" element={<ProfileEditor />} />
					<Route path="/profiles/:name/edit" element={<ProfileEditor />} />
					<Route path="/settings" element={<Settings />} />
				</Route>
			</Routes>
		</SettingsProvider>
	);
}
